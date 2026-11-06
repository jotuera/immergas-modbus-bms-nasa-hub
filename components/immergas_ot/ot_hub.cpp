// Part of jotuera/immergas-modbus-bms-nasa-opentherm-hub - PolyForm Noncommercial 1.0.0 (c) 2026 JoTu.
#include "ot_hub.h"
#include "esphome/core/log.h"

namespace esphome {
namespace immergas_ot {

static const char *const TAG = "immergas_ot";

static const uint32_t OWN_GAP_MS = 250;      // between two own requests (about 3 frames a second)
static const uint32_t MIN_GAP_MS = 100;      // OpenTherm: at least 100 ms between frames
static const uint32_t REPLY_TIMEOUT_MS = 850;  // 34 ms frame + 800 ms the boiler may take
static const uint32_t ROOM_MIN_REPLY_MS = 20;  // a slave answers 20-800 ms after the request
static const uint32_t ROOM_MAX_AGE_MS = 650;   // a room request older than this is not forwarded any more
static const uint32_t UNKNOWN_RETRY_MS = 3600000;
static const uint32_t FOLLOW_REPEAT_MS = 10000;  // gateway: 57 again after this even when unchanged
static const uint32_t FOLLOW_ROOM_WINDOW_MS = 400;  // gateway: our 57 only right after a room unit exchange
static const uint8_t CYCLE_STEPS = 5;

void OtHub::setup() {
  if (!this->boiler_.setup("boiler")) {
    this->mark_failed();
    return;
  }
  if (this->mode_ == MODE_GATEWAY && !this->room_.setup("room")) {
    this->mark_failed();
    return;
  }
}

void OtHub::dump_config() {
  ESP_LOGCONFIG(TAG, "Immergas OpenTherm:");
  ESP_LOGCONFIG(TAG, "  Mode: %s", this->mode_ == MODE_MASTER ? "master (instead of the room unit)" : "gateway (room unit <-> boiler)");
  ESP_LOGCONFIG(TAG, "  Status low byte: 0x%02X", this->status_lb_);
  ESP_LOGCONFIG(TAG, "  Max. CH setpoint (57) follows the CH setpoint (1): %s", YESNO(this->follow_));
  if (this->ch_off_raw_) ESP_LOGCONFIG(TAG, "  CH setpoint while CH is off: %.1f", this->ch_off_raw_ / 256.0f);
  if (this->mode_ == MODE_GATEWAY) ESP_LOGCONFIG(TAG, "  Standalone after: %u ms without the room unit", (unsigned) this->standalone_after_ms_);
  ESP_LOGCONFIG(TAG, "  Polled Data-IDs: %u", (unsigned) this->polls_.size());
}

void OtHub::add_poll(uint8_t id) {
  for (auto p : this->polls_)
    if (p == id) return;
  this->polls_.push_back(id);
}

void OtHub::set_write(uint8_t id, uint16_t value, uint32_t period_ms) {
  auto it = this->writes_.find(id);
  if (it != this->writes_.end() && it->second.value == value && it->second.period_ms == period_ms) return;
  this->writes_[id] = Write{value, period_ms, 0};  // last 0 = due at once
}

void OtHub::clear_write(uint8_t id) { this->writes_.erase(id); }

void OtHub::set_flag(uint8_t flag, bool on) {
  if (on)
    this->flags_ |= flag;
  else
    this->flags_ &= ~flag;
}

void OtHub::set_override(uint8_t id, uint16_t value) { this->overrides_[id] = value; }
void OtHub::clear_override(uint8_t id) { this->overrides_.erase(id); }

// f8.8 values compared as signed (a CH setpoint is never negative, but stay correct)
uint16_t OtHub::limit_ch_(uint16_t raw) const {
  if (!this->follow_) return raw;
  auto it = this->writes_.find(57);
  if (it != this->writes_.end() && int16_t(raw) > int16_t(it->second.value)) return it->second.value;
  return raw;
}

uint16_t OtHub::follow_raw57_() const {
  int16_t v = int16_t(this->follow_raw_);
  const IdState &b = this->ids_[49];  // CH setpoint bounds: high byte = upper, low byte = lower (s8)
  if (b.seen) {
    int8_t hi = int8_t(b.value >> 8), lo = int8_t(b.value & 0xFF);
    if (hi > lo && lo > 0) {
      if (v < int16_t(lo) * 256) v = int16_t(lo) * 256;
      if (v > int16_t(hi) * 256) v = int16_t(hi) * 256;
    }
  }
  return uint16_t(v);
}

void OtHub::notify_(uint8_t id, bool from_room) {
  for (auto *l : this->listeners_) l->ot_update(id, from_room);
}

uint32_t OtHub::next_own_request_() {
  uint32_t now = esphome::millis();
  bool slot_only = this->mode_ == MODE_GATEWAY && !this->standalone_;  // the room unit sends 0 and 1 itself
  for (int guard = 0; guard < CYCLE_STEPS; guard++) {
    uint8_t step = this->cycle_step_;
    this->cycle_step_ = (this->cycle_step_ + 1) % CYCLE_STEPS;
    if (step == 0 && !slot_only)  // status: master flags + the low byte (0xCA = the "Immergas fix")
      return make_frame(READ_DATA, 0, (uint16_t(this->flags_) << 8) | this->status_lb_);
    if (step == 1 && !slot_only) {
      auto it = this->writes_.find(1);
      if (it != this->writes_.end()) {
        uint16_t v = this->limit_ch_(it->second.value);
        this->follow_raw_ = v;  // 57 keeps the real setpoint, also while CH is off
        this->follow_known_ = true;
        if (this->ch_off_raw_ && !(this->flags_ & FLAG_CH)) v = this->ch_off_raw_;
        return make_frame(WRITE_DATA, 1, v);
      }
      continue;
    }
    if (step == 2) {  // max. CH setpoint = CH setpoint, every cycle like the original room unit
      if (this->follow_ && this->follow_known_ && !slot_only) return make_frame(WRITE_DATA, 57, this->follow_raw57_());
      continue;
    }
    if (step == 3) {  // a write that is due
      for (auto &kv : this->writes_) {
        if (kv.first == 1 && !slot_only) continue;
        if (kv.first == 57 && this->follow_) continue;  // 57 follows the CH setpoint (own value = cap of 1)
        if (kv.second.last_ms != 0 && now - kv.second.last_ms < kv.second.period_ms) continue;
        if (this->ids_[kv.first].unknown && now - this->ids_[kv.first].ms < UNKNOWN_RETRY_MS) continue;
        kv.second.last_ms = now == 0 ? 1 : now;
        return make_frame(WRITE_DATA, kv.first, kv.second.value);
      }
    }
    // a read, round robin, skipping the IDs the boiler does not know (asked again after an hour)
    for (size_t k = 0; k < this->polls_.size(); k++) {
      uint8_t id = this->polls_[this->poll_i_];
      this->poll_i_ = (this->poll_i_ + 1) % this->polls_.size();
      if (id == 0 && !slot_only) continue;
      const IdState &s = this->ids_[id];
      if (s.unknown && now - s.ms < UNKNOWN_RETRY_MS) continue;
      return make_frame(READ_DATA, id, 0);
    }
  }
  return make_frame(READ_DATA, 0, (uint16_t(this->flags_) << 8) | this->status_lb_);
}

void OtHub::send_boiler_(uint32_t frame, Origin origin) {
  if (!this->boiler_.send(frame)) return;
  this->waiting_ = true;
  this->pending_req_ = frame;
  this->pending_origin_ = origin;
  this->sent_ms_ = esphome::millis();
  if (frame_type(frame) == WRITE_DATA && frame_id(frame) == 57) {
    this->sent57_ = frame_value(frame);
    this->sent57_ms_ = this->sent_ms_ == 0 ? 1 : this->sent_ms_;
  }
  ESP_LOGV(TAG, "-> boiler %08X (type %u id %u)", (unsigned) frame, frame_type(frame), frame_id(frame));
}

void OtHub::on_boiler_response_(uint32_t req, uint32_t resp) {
  uint8_t id = frame_id(resp), type = frame_type(resp);
  ESP_LOGV(TAG, "<- boiler %08X (type %u id %u)", (unsigned) resp, type, id);
  if (id != frame_id(req) || type < READ_ACK) {
    this->errors_++;
    ESP_LOGD(TAG, "boiler answered %08X to %08X - ignored", (unsigned) resp, (unsigned) req);
    return;
  }
  IdState &s = this->ids_[id];
  s.type = type;
  s.ms = esphome::millis();
  if (type == READ_ACK || type == WRITE_ACK) {
    s.seen = true;
    s.unknown = false;
    s.value = frame_value(resp);
  } else {
    s.unknown = true;  // UNKNOWN-DATAID / DATA-INVALID
  }
  this->notify_(id, false);
  if (this->pending_origin_ == ORIGIN_ROOM) {
    this->room_reply_ = resp;
    this->room_reply_pending_ = true;
  }
}

void OtHub::on_room_request_(uint32_t req) {
  uint32_t now = esphome::millis();
  uint8_t id = frame_id(req), type = frame_type(req);
  uint16_t value = frame_value(req);
  this->last_room_ms_ = now;
  if (this->standalone_) ESP_LOGI(TAG, "room unit online - gateway relays it");
  this->standalone_ = false;
  IdState &s = this->ids_[id];
  s.room_seen = true;
  s.room_type = type;
  s.room_value = value;
  s.room_ms = now;
  this->notify_(id, true);

  // the boiler does not know this ID: answer it here and use the boiler slot for the hub's own request
  if (type == READ_DATA && s.unknown && now - s.ms < UNKNOWN_RETRY_MS) {
    this->room_reply_ = make_frame(UNKNOWN_DATA_ID, id, value);
    this->room_reply_pending_ = true;
    this->room_req_ms_ = now;
    this->free_slot_ = true;
    return;
  }
  // optional: a fresh value of a read is answered from the cache (not the status)
  if (this->cache_ms_ > 0 && type == READ_DATA && id != 0 && s.seen && now - s.ms < this->cache_ms_) {
    this->room_reply_ = make_frame(READ_ACK, id, s.value);
    this->room_reply_pending_ = true;
    this->room_req_ms_ = now;
    this->free_slot_ = true;
    return;
  }
  if (id == 0 && this->flags_override_) {
    value = (uint16_t(this->flags_) << 8) | (value & 0xFF);
  } else if (type == WRITE_DATA) {
    auto it = this->overrides_.find(id);
    if (it != this->overrides_.end()) value = it->second;
    if (id == 1) {
      this->follow_raw_ = value;
      this->follow_known_ = true;
    } else if (id == 57 && this->follow_ && this->follow_known_) {
      value = this->follow_raw57_();  // a third-party unit writes its own limit here
    }
  }
  this->room_req_ = make_frame(type, id, value);
  this->room_req_ms_ = now;
  this->room_pending_ = true;
}

void OtHub::loop() {
  uint32_t now = esphome::millis();
  uint32_t frame;
  DecodeResult res;

  // boiler side: the answer to our request
  if (this->waiting_) {
    if (this->boiler_.poll(frame, res)) {
      if (res == DECODE_OK) {
        this->frames_ok_++;
        this->last_ok_ms_ = now;
        this->on_boiler_response_(this->pending_req_, frame);
      } else {
        this->errors_++;
      }
      this->waiting_ = false;
      this->done_ms_ = now;
    } else if (now - this->sent_ms_ > REPLY_TIMEOUT_MS) {
      this->timeouts_++;
      this->waiting_ = false;
      this->done_ms_ = now;
      ESP_LOGV(TAG, "no answer to %08X", (unsigned) this->pending_req_);
    }
  }

  // room side (gateway): requests of the room unit, our replies
  if (this->mode_ == MODE_GATEWAY) {
    if (this->room_.poll(frame, res)) {
      if (res == DECODE_OK && frame_type(frame) < READ_ACK)
        this->on_room_request_(frame);
      else if (res != DECODE_OK)
        this->errors_++;
    }
    if (this->room_reply_pending_ && !this->room_.tx_busy() && now - this->room_req_ms_ >= ROOM_MIN_REPLY_MS) {
      this->room_.send(this->room_reply_);
      this->room_reply_pending_ = false;
    }
    if (!this->standalone_ && now - this->last_room_ms_ > this->standalone_after_ms_) {
      this->standalone_ = true;
      ESP_LOGW(TAG, "room unit silent for %u s - the hub runs the boiler itself", (unsigned) (this->standalone_after_ms_ / 1000));
    }
  }

  // boiler side: the next request
  if (this->waiting_ || this->boiler_.tx_busy() || now - this->done_ms_ < MIN_GAP_MS) return;
  if (this->mode_ == MODE_GATEWAY && this->room_pending_) {
    this->room_pending_ = false;
    if (now - this->room_req_ms_ <= ROOM_MAX_AGE_MS) this->send_boiler_(this->room_req_, ORIGIN_ROOM);
    return;
  }
  if (this->standalone()) {
    if (now - this->done_ms_ >= OWN_GAP_MS) this->send_boiler_(this->next_own_request_(), ORIGIN_OWN);
    return;
  }
  // a room unit that does not write 57 itself: the hub sends it right after the room unit's exchange, when it
  // differs from the last one sent or every 10 s
  if (this->follow_ && this->follow_known_ && now - this->last_room_ms_ < FOLLOW_ROOM_WINDOW_MS) {
    uint16_t v = this->follow_raw57_();
    if (this->sent57_ms_ == 0 || v != this->sent57_ || now - this->sent57_ms_ > FOLLOW_REPEAT_MS) {
      this->send_boiler_(make_frame(WRITE_DATA, 57, v), ORIGIN_OWN);
      return;
    }
  }
  if (this->free_slot_) {
    this->free_slot_ = false;
    this->send_boiler_(this->next_own_request_(), ORIGIN_OWN);
  }
}

}  // namespace immergas_ot
}  // namespace esphome
