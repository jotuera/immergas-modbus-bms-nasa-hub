// Samsung NASA bus hub for ESPHome - PolyForm Noncommercial 1.0.0 (c) 2026 JoTu.
#include "f1f2_hub.h"

#include <algorithm>
#include <cmath>

#include "esphome/core/log.h"

namespace esphome {
namespace f1f2_nasa {

static const char *const TAG = "f1f2_nasa";
static const uint32_t RX_GAP_RESET_MS = 50;  // a pause inside a frame means it was truncated
static const uint32_t STATS_INTERVAL_MS = 10000;
static const uint32_t ADDRESS_CHECK_MS = 60000;  // time to collect devices before checking the addresses

// ---------------------------------------------------------------- ValueDecoder

bool ValueDecoder::decode(const Message &m, float &out) const {
  if (m.kind == MessageKind::STRUCTURE)
    return false;
  uint32_t v = m.value;
  for (uint32_t n : this->nan_values) {
    if (v == n) {
      out = NAN;
      return true;
    }
  }
  bool word = m.kind == MessageKind::VARIABLE;
  if (this->high_word) {
    v >>= 16;
    word = true;
  }
  double x;
  if (this->is_signed) {
    if (m.kind == MessageKind::ENUM)
      x = int8_t(v);
    else if (word)
      x = int16_t(v);
    else
      x = int32_t(v);
  } else {
    x = v;
  }
  out = float(x * this->multiply);
  return true;
}

// ---------------------------------------------------------------- setup / config

void NasaHub::setup() {
  if (this->flow_control_pin_ != nullptr) {
    this->flow_control_pin_->setup();
    this->flow_control_pin_->digital_write(false);
  }
  this->rx_.reserve(256);
  if (this->sniffer_)
    this->high_freq_.start();
}

void NasaHub::dump_config() {
  ESP_LOGCONFIG(TAG, "Samsung NASA hub:");
  ESP_LOGCONFIG(TAG, "  Own address: %s", this->address_.to_string().c_str());
  ESP_LOGCONFIG(TAG, "  Transmit: %s", YESNO(this->transmit_));
  if (this->transmit_) {
    ESP_LOGCONFIG(TAG, "  Read address: %s", this->read_address_.to_string().c_str());
    ESP_LOGCONFIG(TAG, "  Quiet time: %u ms, response timeout: %u ms, attempts: %u", this->quiet_time_,
                  this->response_timeout_, this->max_attempts_);
    ESP_LOGCONFIG(TAG, "  Poll interval: %u s, polled messages: %u", this->poll_interval_ / 1000,
                  unsigned(this->poll_ids_.size()));
    ESP_LOGCONFIG(TAG, "  NASA connection (bus access): %s; Emulate EHS panel (polling): %s",
                  YESNO(this->bus_enabled_), YESNO(this->panel_emulation_));
    ESP_LOGCONFIG(TAG, "  Write gate: %s; control whitelist: 0x406D (outing), 0x40A7 (FR limit)",
                  this->allow_write_ ? "ARMED" : "OFF (safe)");
  }
  size_t n = 0;
  for (auto &kv : this->listeners_)
    n += kv.second.size();
  ESP_LOGCONFIG(TAG, "  Entities: %u (message ids: %u)", unsigned(n), unsigned(this->listeners_.size()));
  ESP_LOGCONFIG(TAG, "  Indoor unit address: %s, outdoor unit address: %s",
                Address::from_raw(this->indoor_address_).to_string().c_str(),
                Address::from_raw(this->outdoor_address_).to_string().c_str());
  for (auto &kv : this->devices_)
    ESP_LOGCONFIG(TAG, "  Seen on bus: %s", this->device_label_(Address::from_raw(kv.first)).c_str());
  LOG_PIN("  Flow control pin: ", this->flow_control_pin_);
}

void NasaHub::register_listener(NasaListener *l) {
  this->listeners_[l->get_message_id()].push_back(l);
  if (l->get_poll() &&
      std::find(this->poll_ids_.begin(), this->poll_ids_.end(), l->get_message_id()) == this->poll_ids_.end())
    this->poll_ids_.push_back(l->get_message_id());
}

// ---------------------------------------------------------------- receive

void NasaHub::loop() {
  uint32_t now = millis();
  if (!this->rx_.empty() && now - this->last_rx_byte_ > RX_GAP_RESET_MS)
    this->rx_.clear();

  uint8_t buf[64];
  while (this->available() > 0) {
    size_t n = std::min<size_t>(this->available(), sizeof(buf));
    if (!this->read_array(buf, n))
      break;
    this->last_rx_byte_ = millis();
    if (this->bus_enabled_)
      this->feed(buf, n);  // NASA connection off = ignore the bus entirely (drain RX, do not dispatch)
  }

  // NASA connection (bus_enabled_) is the master fuse: off = no RX dispatch (entities are unavailable),
  // no polling, no writes - the device is disconnected from the bus. Nothing else to do this loop.
  if (!this->bus_enabled_) {
    this->rx_.clear();
    return;
  }

  // Emulate EHS panel (panel_emulation_) enables the active readback polling.
  if (this->transmit_) {
    if (this->panel_emulation_ && !this->poll_ids_.empty()) {
      bool due = !this->first_poll_done_ ? now > 30000 : now - this->last_poll_ >= this->poll_interval_;
      if (due)
        this->poll_now();
    }
    this->try_transmit_();
  }

  if (!this->addresses_checked_ && now > ADDRESS_CHECK_MS) {
    this->addresses_checked_ = true;
    this->check_addresses_();
  }

  if (now - this->last_stats_ >= STATS_INTERVAL_MS) {
    this->last_stats_ = now;
    this->publish_stats_();
  }
}

void NasaHub::feed(const uint8_t *data, size_t len) {
  for (size_t i = 0; i < len; i++)
    this->process_byte_(data[i]);
}

void NasaHub::process_byte_(uint8_t b) {
  if (this->rx_.empty() && b != NASA_START) {
    this->skipped_bytes_++;
    if (this->sniffer_ && this->skipped_.size() < 32)
      this->skipped_.push_back(b);
    this->last_skip_ms_ = this->last_rx_byte_;
    return;  // hunt for a start byte
  }
  if (this->rx_.empty())
    this->frame_start_ms_ = this->last_rx_byte_;
  this->rx_.push_back(b);
  if (this->rx_.size() < 3)
    return;
  size_t total = ((size_t(this->rx_[1]) << 8) | this->rx_[2]) + 2;
  if (total < NASA_MIN_FRAME || total > NASA_MAX_FRAME) {
    // Not a real start byte: drop it and resync on the next 0x32 already buffered.
    this->rx_.erase(this->rx_.begin());
    auto it = std::find(this->rx_.begin(), this->rx_.end(), NASA_START);
    this->rx_.erase(this->rx_.begin(), it);
    return;
  }
  if (this->rx_.size() < total)
    return;
  std::vector<uint8_t> frame;
  frame.swap(this->rx_);
  if (!this->process_frame_(frame.data(), frame.size())) {
    // Bad CRC / structure: the 0x32 was probably payload. Resync on the bytes after it.
    for (size_t i = 1; i < frame.size(); i++)
      this->process_byte_(frame[i]);
  }
}

bool NasaHub::process_frame_(const uint8_t *buf, size_t len) {
  Packet p;
  bool ok = p.decode(buf, len);
  if (this->sniffer_) {
    // one line per frame: device time [ms], silence since the previous frame [ms], bytes skipped in between
    uint32_t gap = this->frame_start_ms_ - this->last_frame_end_ms_;
    // bytes seen between the previous frame and this one: hex (max 32) and ms from the last of them to this frame
    std::string skip = hex_bytes(this->skipped_.data(), this->skipped_.size());
    uint32_t skip_dt = this->skipped_bytes_ ? this->frame_start_ms_ - this->last_skip_ms_ : 0;
    if (ok) {
      ESP_LOGD("f1f2_sniff", "RX t=%u gap=%u skip=%u [%s] dt=%u %s | %s", unsigned(this->frame_start_ms_),
               unsigned(gap), unsigned(this->skipped_bytes_), skip.c_str(), unsigned(skip_dt), p.to_string().c_str(),
               hex_bytes(buf, len).c_str());
    } else {
      ESP_LOGD("f1f2_sniff", "BAD t=%u gap=%u skip=%u [%s] dt=%u len=%u | %s", unsigned(this->frame_start_ms_),
               unsigned(gap), unsigned(this->skipped_bytes_), skip.c_str(), unsigned(skip_dt), unsigned(len),
               hex_bytes(buf, len).c_str());
    }
    this->skipped_.clear();
    this->skipped_bytes_ = 0;
    this->last_frame_end_ms_ = this->last_rx_byte_;
  }
  if (!ok) {
    this->crc_errors_++;
    ESP_LOGV(TAG, "Bad frame (%u B): %s", unsigned(len), hex_bytes(buf, len).c_str());
    return false;
  }
  this->rx_frames_++;
#ifdef USE_TEXT_SENSOR
  if (this->sniffer_ && this->last_frame_text_ != nullptr)
    this->last_frame_text_->publish_state(hex_bytes(buf, len));
#endif
  this->handle_packet_(p);
  return true;
}

void NasaHub::handle_packet_(const Packet &p) {
  if (p.src == this->address_)
    return;  // echo of our own transmission on a half-duplex bus

  this->note_device_(p.src);

  if (this->sniffer_ || this->discovery_)
    this->sniff_(p);

  // Reply to our pending request?
  if (this->in_flight_ && p.dst == this->address_ && p.number == this->current_.number) {
    if (p.data_type == DataType::NACK) {
      this->nacks_++;
      ESP_LOGW(TAG, "NACK for request #%u", p.number);
      this->in_flight_ = false;
    } else if (p.data_type == DataType::RESPONSE || p.data_type == DataType::ACK) {
      this->in_flight_ = false;
    }
  }

  // Only frames that carry the sender's own values update entities.
  if (p.data_type != DataType::NOTIFICATION && p.data_type != DataType::RESPONSE)
    return;
  uint32_t src = p.src.raw();
  for (const Message &m : p.messages) {
    this->last_value_[m.id] = m.value;  // remember every value, for control readback
    if (m.kind != MessageKind::STRUCTURE) {
      uint64_t key = (uint64_t(src) << 16) | m.id;
      auto bm = this->bus_map_.find(key);
      uint32_t v = uint32_t(m.value);
      if (bm == this->bus_map_.end()) {
        if (this->bus_map_.size() < 800) {
          bool known = this->listeners_.count(m.id) > 0 ||
                       std::find(this->known_ids_.begin(), this->known_ids_.end(), m.id) != this->known_ids_.end();
          this->bus_map_[key] = MapStat{v, v, v, 0, known};
          if (!this->map_src_.count(src))
            this->map_src_[src] = p.src.to_string();
        }
      } else {
        MapStat &s = bm->second;
        if (v != s.last)
          s.changes++;
        s.last = v;
        s.min = std::min(s.min, v);
        s.max = std::max(s.max, v);
      }
    }
    auto it = this->listeners_.find(m.id);
    if (it == this->listeners_.end())
      continue;
    for (NasaListener *l : it->second) {
      if (l->get_source() == src)
        l->on_message(p, m);
    }
  }
}

void NasaHub::sniff_(const Packet &p) {
  if (p.data_type != DataType::NOTIFICATION && p.data_type != DataType::RESPONSE)
    return;
  for (const Message &m : p.messages) {
    if (m.kind == MessageKind::STRUCTURE)
      continue;
    uint32_t key = (p.src.raw() << 8) ^ m.id;  // compact key; collisions are harmless for logging
    auto it = this->sniff_last_.find(key);
    if (it != this->sniff_last_.end() && it->second == m.value)
      continue;
    char b[96];
    if (it == this->sniff_last_.end()) {
      snprintf(b, sizeof(b), "%s %04X = %u (new)", p.src.to_string().c_str(), m.id, unsigned(m.value));
    } else {
      snprintf(b, sizeof(b), "%s %04X: %u -> %u", p.src.to_string().c_str(), m.id, unsigned(it->second),
               unsigned(m.value));
    }
    this->sniff_last_[key] = m.value;
    if (this->discovery_) {
      // append a snapshot of the reference signals so the change can be correlated at a glance
      // (parsed by tools/sniffer_correlate.py). -1 = that reference not seen yet.
      auto ref = [this](uint16_t id) -> long {
        auto it = this->last_value_.find(id);
        return it == this->last_value_.end() ? -1L : static_cast<long>(it->second);
      };
      ESP_LOGI("f1f2_sniff", "%s | comp=%ld drv=%ld mode=%ld defr=%ld night=%ld 3w=%ld tout=%ld", b,
               ref(0x8238), ref(0x8001), ref(0x4001), ref(0x402E), ref(0x428D), ref(0x4067), ref(0x8204));
    } else {
      ESP_LOGI("f1f2_sniff", "%s", b);
    }
#ifdef USE_TEXT_SENSOR
    if (this->last_change_text_ != nullptr)
      this->last_change_text_->publish_state(b);
#endif
  }
}

// ---------------------------------------------------------------- address discovery

std::string NasaHub::device_label_(const Address &a) const {
  std::string s = a.to_string();
  auto it = this->class_labels_.find(a.cls);
  if (it != this->class_labels_.end()) {
    s += " " + it->second;
  } else {
    char b[16];
    snprintf(b, sizeof(b), " (0x%02X)", a.cls);
    s += b;
  }
  return s;
}

void NasaHub::note_device_(const Address &a) {
  if (a.cls >= 0xB0)
    return;  // broadcast / layer addresses are never senders, ignore garbage
  auto it = this->devices_.find(a.raw());
  if (it != this->devices_.end()) {
    it->second++;
    return;
  }
  this->devices_[a.raw()] = 1;
  ESP_LOGI(TAG, "Found device on the bus: %s", this->device_label_(a).c_str());
#ifdef USE_TEXT_SENSOR
  if (this->devices_text_ != nullptr) {
    std::string list;
    for (auto &kv : this->devices_) {
      if (!list.empty())
        list += ", ";
      list += this->device_label_(Address::from_raw(kv.first));
    }
    this->devices_text_->publish_state(list);
  }
#endif
}

void NasaHub::check_addresses_() {
  if (this->devices_.empty()) {
    ESP_LOGW(TAG, "No NASA frames received in 60 s. Check wiring F1/F2 -> A/B (swap A/B), 9600 8E1, "
                  "and set the MIM-B19N rotary switch to 1 (at 0 the bus stays silent).");
    return;
  }
  const uint32_t configured[2] = {this->indoor_address_, this->outdoor_address_};
  const char *const option[2] = {"indoor_address", "outdoor_address"};
  for (int i = 0; i < 2; i++) {
    if (this->devices_.count(configured[i]))
      continue;
    uint8_t cls = uint8_t(configured[i] >> 16);
    for (auto &kv : this->devices_) {
      if (uint8_t(kv.first >> 16) == cls) {
        std::string seen = Address::from_raw(kv.first).to_string();
        ESP_LOGW(TAG, "%s is %s, but that device is not on the bus. Found %s instead - set '%s: %s'.", option[i],
                 Address::from_raw(configured[i]).to_string().c_str(), seen.c_str(), option[i], seen.c_str());
        break;
      }
    }
  }
}

// ---------------------------------------------------------------- transmit

uint8_t NasaHub::next_packet_number_() {
  this->packet_number_++;
  if (this->packet_number_ == 0)
    this->packet_number_ = 1;
  return this->packet_number_;
}

void NasaHub::request_read(const std::vector<uint16_t> &ids) { this->request_read(ids, this->read_address_); }

void NasaHub::request_read(const std::vector<uint16_t> &ids, const Address &dst) {
  if (!this->transmit_ || !this->bus_enabled_ || !this->panel_emulation_)
    return;  // active reads need NASA connection + Emulate EHS panel
  for (size_t i = 0; i < ids.size(); i += NASA_MAX_MESSAGES_PER_FRAME) {
    PendingRequest r;
    r.dst = dst;
    size_t end = std::min(ids.size(), i + NASA_MAX_MESSAGES_PER_FRAME);
    for (size_t k = i; k < end; k++) {
      // A structure message must be alone in its frame.
      if (Message::kind_of(ids[k]) == MessageKind::STRUCTURE) {
        PendingRequest s;
        s.dst = dst;
        s.ids.push_back(ids[k]);
        this->queue_.push_back(s);
      } else {
        r.ids.push_back(ids[k]);
      }
    }
    if (!r.ids.empty())
      this->queue_.push_back(r);
  }
}

void NasaHub::poll_now() {
  this->first_poll_done_ = true;
  this->last_poll_ = millis();
  if (this->poll_ids_.empty())
    return;
  ESP_LOGD(TAG, "Polling %u messages", unsigned(this->poll_ids_.size()));
  // a message whose entity listens to the outdoor unit is read from the outdoor unit (e.g. its long counters)
  std::vector<uint16_t> indoor, outdoor;
  for (uint16_t id : this->poll_ids_) {
    bool out = false;
    auto it = this->listeners_.find(id);
    if (it != this->listeners_.end())
      for (NasaListener *l : it->second)
        out = out || (l->get_poll() && l->get_source() == this->outdoor_address_);
    (out ? outdoor : indoor).push_back(id);
  }
  if (!indoor.empty())
    this->request_read(indoor);
  if (!outdoor.empty())
    this->request_read(outdoor, Address::from_raw(this->outdoor_address_));
}

void NasaHub::try_transmit_() {
  uint32_t now = millis();
  if (this->in_flight_) {
    if (now - this->current_.sent_at < this->response_timeout_)
      return;
    if (this->current_.attempts >= this->max_attempts_) {
      this->timeouts_++;
      ESP_LOGW(TAG, "No response to READ #%u (%u messages, first %04X) after %u attempts", this->current_.number,
               unsigned(this->current_.ids.size()), this->current_.ids.front(), this->current_.attempts);
      this->in_flight_ = false;
      return;
    }
    // retry below once the bus is quiet
  } else {
    if (this->queue_.empty() && this->write_queue_.empty())
      return;
  }
  // Talk only into silence and never in the middle of a frame being received.
  if (!this->rx_.empty() || now - this->last_rx_byte_ < this->quiet_time_)
    return;
  if (!this->in_flight_) {
    // Control writes go first (fire-and-forget; state is confirmed by the next NOTIFY/RESPONSE).
    if (!this->write_queue_.empty()) {
      WriteOp op = this->write_queue_.front();
      this->write_queue_.pop_front();
      this->send_write_(op);
      return;  // one frame per silence window
    }
    this->current_ = this->queue_.front();
    this->queue_.pop_front();
    this->current_.attempts = 0;
    this->current_.number = this->next_packet_number_();
    this->in_flight_ = true;
  }
  this->send_request_(this->current_);
}

void NasaHub::send_request_(PendingRequest &req) {
  Packet p;
  p.src = this->address_;
  p.dst = req.dst;
  p.packet_type = PacketType::NORMAL;
  p.data_type = DataType::READ;
  p.number = req.number;
  for (uint16_t id : req.ids) {
    Message m;
    m.id = id;  // READ carries zero payload of the size the id implies
    p.messages.push_back(m);
  }
  std::vector<uint8_t> frame = p.encode();
  if (this->flow_control_pin_ != nullptr)
    this->flow_control_pin_->digital_write(true);
  this->write_array(frame);
  this->flush();
  if (this->flow_control_pin_ != nullptr)
    this->flow_control_pin_->digital_write(false);
  req.attempts++;
  req.sent_at = millis();
  this->last_rx_byte_ = req.sent_at;  // our own frame occupies the bus as well
  this->tx_frames_++;
  if (this->sniffer_) {
    ESP_LOGD("f1f2_sniff", "TX t=%u %s | %s", unsigned(req.sent_at), p.to_string().c_str(),
             hex_bytes(frame.data(), frame.size()).c_str());
  }
}

// ---------------------------------------------------------------- control writes

// OFF-LIMITS, hard-coded: no `number:` entity, however declared, can ever make these writable, no matter
// what register_writable() is told. Mirrors FINDINGS.md "OFF-LIMITS - never write these" - keep both in
// sync if that list changes.
//   - compressor frequency 0x8236-0x8239, EEV position 0x8229 (outdoor) / 0x4217 (indoor): direct hardware risk.
//   - flow sensor 0x42E9 and its protection chain 0x42E8 / 0x4102 / 0x803B: a fake flow can fool the
//     Samsung flow-check into running the compressor dry.
//   - 4-way valve 0x801A, hot-gas valve 0x8017, defrost 0x402E / 0x8061, base heater 0x80AF, 2-/3-way
//     valve 0x408A / 0x4067: ODU/Immergas actuators, not Samsung-only control levers.
//   - unit on/off 0x4000 and operation mode 0x4001: Immergas owns these and would fight the write, and a
//     stray write could stop heating - not worth the risk (reads still work, writes never).
static bool is_hard_blocked_(uint16_t id) {
  switch (id) {
    case 0x8236:
    case 0x8237:
    case 0x8238:
    case 0x8239:
    case 0x8229:
    case 0x4217:
    case 0x42E9:
    case 0x42E8:
    case 0x4102:
    case 0x803B:
    case 0x801A:
    case 0x8017:
    case 0x402E:
    case 0x8061:
    case 0x80AF:
    case 0x408A:
    case 0x4067:
    case 0x4000:
    case 0x4001:
      return true;
    default:
      return false;
  }
}

bool NasaHub::is_write_whitelisted_(uint16_t id) const {
  // Hard block first: register_writable() cannot override this.
  if (is_hard_blocked_(id))
    return false;
  // The two fixed control levers, plus any id explicitly exposed as an editable `number`. Everything else
  // (water-law, setpoints...) is deliberately NOT writable.
  if (id == 0x406D || id == 0x40A7)  // outing activation, FR compressor-limit enable
    return true;
  return std::find(this->writable_.begin(), this->writable_.end(), id) != this->writable_.end();
}

void NasaHub::register_writable(uint16_t id) {
  if (is_hard_blocked_(id)) {
    ESP_LOGE(TAG, "0x%04X is on the OFF-LIMITS list (see FINDINGS.md) and will never be made writable, "
                  "even though a number: entity declared it",
             id);
    return;
  }
  this->writable_.push_back(id);
}

void NasaHub::write_message(uint16_t id, uint32_t value) {
  if (!this->transmit_) {
    ESP_LOGW(TAG, "WRITE 0x%04X ignored: transmit is disabled", id);
    return;
  }
  if (!this->bus_enabled_) {
    ESP_LOGW(TAG, "WRITE 0x%04X BLOCKED: NASA connection (bus access) is off", id);
    return;
  }
  if (!this->panel_emulation_) {
    ESP_LOGW(TAG, "WRITE 0x%04X BLOCKED: Emulate EHS panel is off", id);
    return;
  }
  if (!this->allow_write_) {
    ESP_LOGW(TAG, "WRITE 0x%04X BLOCKED: arm the write gate first", id);
    return;
  }
  if (!this->is_write_whitelisted_(id)) {
    ESP_LOGE(TAG, "WRITE 0x%04X REFUSED: not on the control whitelist", id);
    return;
  }
  this->write_queue_.push_back(WriteOp{id, value});
  ESP_LOGI(TAG, "WRITE 0x%04X = %u queued", id, unsigned(value));
}

void NasaHub::send_write_(const WriteOp &op) {
  Packet p;
  p.src = this->address_;
  p.dst = Address::from_raw(this->indoor_address_);
  p.packet_type = PacketType::NORMAL;
  p.data_type = DataType::WRITE;
  p.number = this->next_packet_number_();
  Message m;
  m.id = op.id;
  m.kind = Message::kind_of(op.id);
  m.value = op.value;
  p.messages.push_back(m);
  std::vector<uint8_t> frame = p.encode();
  if (this->flow_control_pin_ != nullptr)
    this->flow_control_pin_->digital_write(true);
  this->write_array(frame);
  this->flush();
  if (this->flow_control_pin_ != nullptr)
    this->flow_control_pin_->digital_write(false);
  this->last_rx_byte_ = millis();  // our own frame occupies the bus as well
  this->tx_frames_++;
  ESP_LOGI(TAG, "WRITE 0x%04X = %u -> %s", op.id, unsigned(op.value),
           Address::from_raw(this->indoor_address_).to_string().c_str());
  if (this->sniffer_) {
    ESP_LOGD("f1f2_sniff", "TX(write) %s | %s", p.to_string().c_str(),
             hex_bytes(frame.data(), frame.size()).c_str());
  }
}

float NasaHub::read_value(uint16_t id) const {
  auto it = this->last_value_.find(id);
  if (it == this->last_value_.end())
    return NAN;
  return float(it->second);
}

void NasaHub::notify_gates_() {
  // Tell every entity the current availability. A sensor is live while NASA connection is on; a control
  // entity (number / control switch) is live only while both NASA connection and EHS panel are on.
  for (auto &kv : this->listeners_)
    for (NasaListener *l : kv.second)
      l->on_gate_change(this->bus_enabled_, this->panel_emulation_);
}

void NasaHub::set_bus_enabled(bool on) {
  if (this->bus_enabled_ == on)
    return;
  this->bus_enabled_ = on;
  this->notify_gates_();  // off -> all entities unavailable (disconnected); on -> they repopulate from the bus
  if (on)
    this->poll_now();
}

void NasaHub::set_panel_emulation(bool on) {
  if (this->panel_emulation_ == on)
    return;
  this->panel_emulation_ = on;
  this->notify_gates_();  // off -> control/FSV entities unavailable; passive sensors stay
  if (on)
    this->poll_now();
}

// ---------------------------------------------------------------- stats

void NasaHub::publish_stats_() {
#ifdef USE_SENSOR
  if (this->rx_frames_sensor_ != nullptr)
    this->rx_frames_sensor_->publish_state(this->rx_frames_);
  if (this->crc_errors_sensor_ != nullptr)
    this->crc_errors_sensor_->publish_state(this->crc_errors_);
  if (this->tx_frames_sensor_ != nullptr)
    this->tx_frames_sensor_->publish_state(this->tx_frames_);
  if (this->timeouts_sensor_ != nullptr)
    this->timeouts_sensor_->publish_state(this->timeouts_);
#endif
}

// ---------------------------------------------------------------- bus map

size_t NasaHub::bus_map_unknown() const {
  size_t n = 0;
  for (auto &kv : this->bus_map_)
    n += kv.second.known ? 0 : 1;
  return n;
}

std::string NasaHub::bus_map_report(size_t limit) const {
  std::string moving, still, zeros;
  size_t n_moving = 0, n_still = 0, n_zero = 0;
  char b[96];
  for (auto &kv : this->bus_map_) {
    const MapStat &s = kv.second;
    if (s.known)
      continue;
    auto src = this->map_src_.find(uint32_t(kv.first >> 16));
    snprintf(b, sizeof(b), "%s %04X", src == this->map_src_.end() ? "?" : src->second.c_str(),
             unsigned(kv.first & 0xFFFF));
    std::string k = b;
    if (s.min == 0 && s.max == 0) {
      zeros += (zeros.empty() ? "" : ", ") + k;
      n_zero++;
    } else if (s.changes == 0) {
      snprintf(b, sizeof(b), "%s=%lu", k.c_str(), (unsigned long) s.last);
      still += (still.empty() ? "" : ", ") + std::string(b);
      n_still++;
    } else {
      snprintf(b, sizeof(b), "%s=%lu (%lu..%lu, %lux)", k.c_str(), (unsigned long) s.last, (unsigned long) s.min,
               (unsigned long) s.max, (unsigned long) s.changes);
      moving += (moving.empty() ? "" : ", ") + std::string(b);
      n_moving++;
    }
  }
  snprintf(b, sizeof(b), "seen: %u, described: %u, undescribed: %u", unsigned(this->bus_map_.size()),
           unsigned(this->bus_map_.size() - this->bus_map_unknown()), unsigned(this->bus_map_unknown()));
  std::string out = b;
  out += "\n\nchanging (" + std::to_string(n_moving) + "): " + (moving.empty() ? "-" : moving);
  out += "\n\nconstant, not 0 (" + std::to_string(n_still) + "): " + (still.empty() ? "-" : still);
  out += "\n\nalways 0 (" + std::to_string(n_zero) + "): " + (zeros.empty() ? "-" : zeros);
  if (out.size() > limit)
    out = out.substr(0, limit > 40 ? limit - 40 : limit) + "\n... (cut, too long for one report)";
  return out;
}

}  // namespace f1f2_nasa
}  // namespace esphome
