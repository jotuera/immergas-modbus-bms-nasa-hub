// OpenTherm for Immergas boilers: the hub as the OpenTherm master (instead of the CAR V2 / Dominus) or as a gateway
// between the room unit (CAR V2, Super Amico, a third-party thermostat) and the boiler.
// Part of jotuera/immergas-modbus-bms-nasa-opentherm-hub - PolyForm Noncommercial 1.0.0 (c) 2026 JoTu.
#pragma once

#include "esphome/core/component.h"
#include "esphome/core/hal.h"
#include "ot_line.h"

#include <map>
#include <vector>

namespace esphome {
namespace immergas_ot {

enum Mode : uint8_t { MODE_MASTER = 0, MODE_GATEWAY = 1 };

// master status flags (Data-ID 0, high byte of the request)
enum MasterFlag : uint8_t {
  FLAG_CH = 0x01,
  FLAG_DHW = 0x02,
  FLAG_COOLING = 0x04,
  FLAG_OTC = 0x08,
  FLAG_CH2 = 0x10,
};

struct IdState {
  bool seen{false};        // the boiler answered (ACK)
  bool unknown{false};     // the boiler answered UNKNOWN-DATAID / DATA-INVALID
  uint8_t type{0};         // last response type
  uint16_t value{0};       // last value from the boiler (READ-ACK / WRITE-ACK)
  uint32_t ms{0};
  bool room_seen{false};   // gateway: the room unit sent this ID
  uint8_t room_type{0};
  uint16_t room_value{0};  // gateway: value in the room unit's request (what it writes)
  uint32_t room_ms{0};
};

class OtListener {
 public:
  virtual void ot_update(uint8_t id, bool from_room) = 0;
};

class OtHub : public esphome::Component {
 public:
  void set_mode(Mode m) { this->mode_ = m; }
  void set_master_pins(esphome::InternalGPIOPin *in, esphome::InternalGPIOPin *out, bool in_low, bool out_low) {
    this->boiler_.configure(in, out, in_low, out_low);
  }
  void set_room_pins(esphome::InternalGPIOPin *in, esphome::InternalGPIOPin *out, bool in_low, bool out_low) {
    this->room_.configure(in, out, in_low, out_low);
  }
  void set_status_low_byte(uint8_t lb) { this->status_lb_ = lb; }
  void set_standalone_after(uint32_t ms) { this->standalone_after_ms_ = ms; }
  void set_cache_reads(uint32_t ms) { this->cache_ms_ = ms; }
  // the original Immergas room unit writes the max. CH setpoint (57) together with the CH setpoint (1), same value -
  // some Immergas boilers heat to Data-ID 57 and ignore Data-ID 1
  void set_max_ch_follows(bool on) { this->follow_ = on; }

  void setup() override;
  void loop() override;
  void dump_config() override;
  float get_setup_priority() const override { return esphome::setup_priority::HARDWARE; }

  // entities
  void add_listener(OtListener *l) { this->listeners_.push_back(l); }
  void add_poll(uint8_t id);
  const IdState &state(uint8_t id) const { return this->ids_[id]; }
  // a value the master writes: period_ms = 0 -> every cycle (Data-ID 1), else repeated (the boiler forgets / the remote
  // overwrites) - the master keeps sending it, as every OpenTherm master does
  void set_write(uint8_t id, uint16_t value, uint32_t period_ms);
  void clear_write(uint8_t id);
  // master flags (Data-ID 0 high byte)
  void set_flag(uint8_t flag, bool on);
  bool flag(uint8_t f) const { return (this->flags_ & f) != 0; }
  // gateway: replace the value of a write request of the room unit (Data-ID 1, 14, 16, 24, 56, 57 ...)
  void set_override(uint8_t id, uint16_t value);
  void clear_override(uint8_t id);
  // a number entity: the value is written by the hub (master / standalone / free slots) and, while its override is
  // enabled (gateway), replaces the room unit's write of that Data-ID
  void set_value(uint8_t id, uint16_t raw, uint32_t period_ms) {
    this->set_write(id, raw, period_ms);
    this->values_[id] = raw;
    if (this->override_enabled_.count(id)) this->overrides_[id] = raw;
  }
  void enable_override(uint8_t id, bool on) {
    if (id == 0) {
      this->flags_override_ = on;
      return;
    }
    if (on) {
      this->override_enabled_[id] = true;
      auto it = this->values_.find(id);
      if (it != this->values_.end()) this->overrides_[id] = it->second;
    } else {
      this->override_enabled_.erase(id);
      this->overrides_.erase(id);
    }
  }
  bool has_override(uint8_t id) const { return this->overrides_.count(id) != 0; }
  // gateway: the master flags of the hub replace those of the room unit
  void set_flags_override(bool on) { this->flags_override_ = on; }

  bool boiler_online() const { return this->last_ok_ms_ != 0 && esphome::millis() - this->last_ok_ms_ < 10000; }
  bool room_online() const { return this->last_room_ms_ != 0 && esphome::millis() - this->last_room_ms_ < 10000; }
  bool standalone() const { return this->mode_ == MODE_MASTER || this->standalone_; }
  Mode mode() const { return this->mode_; }
  uint32_t frames_ok() const { return this->frames_ok_; }
  uint32_t errors() const { return this->errors_; }
  uint32_t timeouts() const { return this->timeouts_; }

 protected:
  enum Origin : uint8_t { ORIGIN_OWN, ORIGIN_ROOM };
  uint32_t next_own_request_();
  void send_boiler_(uint32_t frame, Origin origin);
  void on_boiler_response_(uint32_t req, uint32_t resp);
  void on_room_request_(uint32_t req);
  void notify_(uint8_t id, bool from_room);
  uint16_t limit_ch_(uint16_t raw) const;   // CH setpoint capped by the hub's own max. CH setpoint (master)
  uint16_t follow_raw57_() const;           // the value 57 gets: the CH setpoint within the boiler's bounds (49)

  Mode mode_{MODE_MASTER};
  OtLine boiler_;  // hub = master, boiler = slave (master adapter)
  OtLine room_;    // gateway: room unit = master, hub = slave (slave adapter)
  uint8_t status_lb_{0xCA};
  uint8_t flags_{FLAG_CH | FLAG_DHW};
  uint32_t standalone_after_ms_{8000};
  uint32_t cache_ms_{0};

  IdState ids_[256];
  std::vector<OtListener *> listeners_;
  std::vector<uint8_t> polls_;
  size_t poll_i_{0};
  struct Write {
    uint16_t value;
    uint32_t period_ms;
    uint32_t last_ms;
  };
  std::map<uint8_t, Write> writes_;
  std::map<uint8_t, uint16_t> overrides_;
  std::map<uint8_t, uint16_t> values_;
  std::map<uint8_t, bool> override_enabled_;
  bool flags_override_{false};

  // boiler side state
  bool waiting_{false};
  uint32_t pending_req_{0};
  Origin pending_origin_{ORIGIN_OWN};
  uint32_t sent_ms_{0};
  uint32_t done_ms_{0};
  uint8_t cycle_step_{0};
  uint32_t last_ok_ms_{0};
  uint32_t frames_ok_{0};
  uint32_t errors_{0};
  uint32_t timeouts_{0};

  // gateway state
  bool room_pending_{false};   // a request of the room unit waits to go to the boiler
  uint32_t room_req_{0};
  uint32_t room_req_ms_{0};
  uint32_t room_reply_{0};     // the reply waiting for the slave line
  bool room_reply_pending_{false};
  bool free_slot_{false};      // the room unit's request was answered by the hub: the boiler slot is ours
  uint32_t last_room_ms_{0};
  bool standalone_{true};

  // max. CH setpoint follows the CH setpoint
  bool follow_{true};
  bool follow_known_{false};  // a CH setpoint has been sent (by the hub or the room unit)
  uint16_t follow_raw_{0};    // that CH setpoint
  uint16_t sent57_{0};        // last Data-ID 57 written to the boiler
  uint32_t sent57_ms_{0};
};

}  // namespace immergas_ot
}  // namespace esphome
