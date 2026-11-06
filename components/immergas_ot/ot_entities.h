// Entities of the Immergas OpenTherm hub: sensors, binary sensors, numbers, switches.
// Part of jotuera/immergas-modbus-bms-nasa-opentherm-hub - PolyForm Noncommercial 1.0.0 (c) 2026 JoTu.
#pragma once

#include "ot_hub.h"
#include "esphome/core/component.h"
#include "esphome/core/preferences.h"
#ifdef USE_SENSOR
#include "esphome/components/sensor/sensor.h"
#endif
#ifdef USE_BINARY_SENSOR
#include "esphome/components/binary_sensor/binary_sensor.h"
#endif
#ifdef USE_NUMBER
#include "esphome/components/number/number.h"
#endif
#ifdef USE_SWITCH
#include "esphome/components/switch/switch.h"
#endif

#include <cmath>

namespace esphome {
namespace immergas_ot {

enum ValueType : uint8_t { VT_F88 = 0, VT_U16, VT_S16, VT_U8_HB, VT_U8_LB, VT_S8_HB, VT_S8_LB };

inline float decode_value(uint16_t v, uint8_t vt) {
  switch (vt) {
    case VT_F88: return f88_to_float(v);
    case VT_U16: return v;
    case VT_S16: return int16_t(v);
    case VT_U8_HB: return v >> 8;
    case VT_U8_LB: return v & 0xFF;
    case VT_S8_HB: return int8_t(v >> 8);
    case VT_S8_LB: return int8_t(v & 0xFF);
  }
  return NAN;
}

inline uint16_t encode_value(float x, uint8_t vt) {
  switch (vt) {
    case VT_F88: return float_to_f88(x);
    case VT_S16: return uint16_t(int16_t(lroundf(x)));
    case VT_U8_HB: return uint16_t(uint8_t(lroundf(x))) << 8;
    case VT_S8_HB: return uint16_t(uint8_t(int8_t(lroundf(x)))) << 8;
    case VT_U8_LB: return uint8_t(lroundf(x));
    case VT_S8_LB: return uint8_t(int8_t(lroundf(x)));
    default: return uint16_t(lroundf(x));
  }
}

#ifdef USE_SENSOR
// a Data-ID value: from the boiler's answer, or (gateway) from the room unit's request
class OtSensor : public sensor::Sensor, public esphome::Component, public OtListener {
 public:
  void set_hub(OtHub *hub) { this->hub_ = hub; }
  void set_data_id(uint8_t id) { this->id_ = id; }
  void set_value_type(uint8_t vt) { this->vt_ = vt; }
  void set_from_room(bool r) { this->from_room_ = r; }
  void set_poll(bool p) { this->poll_ = p; }
  void setup() override {
    this->hub_->add_listener(this);
    if (this->poll_ && !this->from_room_) this->hub_->add_poll(this->id_);
  }
  void ot_update(uint8_t id, bool from_room) override {
    if (id != this->id_ || from_room != this->from_room_) return;
    const IdState &s = this->hub_->state(id);
    if (from_room) {
      this->publish_state(decode_value(s.room_value, this->vt_));
    } else if (s.unknown) {
      if (!std::isnan(this->state)) this->publish_state(NAN);
    } else {
      float v = decode_value(s.value, this->vt_);
      if (this->vt_ == VT_F88 && (s.value == 0x7300 || s.value == 0x8000)) v = NAN;  // "no probe" markers
      this->publish_state(v);
    }
  }

 protected:
  OtHub *hub_{nullptr};
  uint8_t id_{0};
  uint8_t vt_{VT_F88};
  bool from_room_{false};
  bool poll_{true};
};

// counters of the hub: 0 good frames, 1 errors, 2 timeouts
class OtStatSensor : public sensor::Sensor, public esphome::PollingComponent {
 public:
  void set_hub(OtHub *hub) { this->hub_ = hub; }
  void set_stat(uint8_t s) { this->stat_ = s; }
  void update() override {
    this->publish_state(this->stat_ == 0 ? this->hub_->frames_ok() : this->stat_ == 1 ? this->hub_->errors() : this->hub_->timeouts());
  }

 protected:
  OtHub *hub_{nullptr};
  uint8_t stat_{0};
};
#endif

#ifdef USE_BINARY_SENSOR
class OtBinarySensor : public binary_sensor::BinarySensor, public esphome::Component, public OtListener {
 public:
  void set_hub(OtHub *hub) { this->hub_ = hub; }
  void set_data_id(uint8_t id) { this->id_ = id; }
  void set_bit(uint8_t b) { this->bit_ = b; }
  void set_from_room(bool r) { this->from_room_ = r; }
  void set_poll(bool p) { this->poll_ = p; }
  void setup() override {
    this->hub_->add_listener(this);
    if (this->poll_ && !this->from_room_) this->hub_->add_poll(this->id_);
  }
  void ot_update(uint8_t id, bool from_room) override {
    if (id != this->id_ || from_room != this->from_room_) return;
    const IdState &s = this->hub_->state(id);
    if (!from_room && s.unknown) return;
    uint16_t v = from_room ? s.room_value : s.value;
    this->publish_state((v >> this->bit_) & 1);
  }

 protected:
  OtHub *hub_{nullptr};
  uint8_t id_{0};
  uint8_t bit_{0};
  bool from_room_{false};
  bool poll_{true};
};

// 0 boiler online, 1 room unit online, 2 hub runs the boiler itself (standalone)
class OtStateBinarySensor : public binary_sensor::BinarySensor, public esphome::PollingComponent {
 public:
  void set_hub(OtHub *hub) { this->hub_ = hub; }
  void set_kind(uint8_t k) { this->kind_ = k; }
  void update() override {
    this->publish_state(this->kind_ == 0 ? this->hub_->boiler_online() : this->kind_ == 1 ? this->hub_->room_online() : this->hub_->standalone());
  }

 protected:
  OtHub *hub_{nullptr};
  uint8_t kind_{0};
};
#endif

#ifdef USE_NUMBER
// a value the hub writes (master / standalone / free gateway slots) and the override value of the gateway
class OtNumber : public number::Number, public esphome::Component {
 public:
  void set_hub(OtHub *hub) { this->hub_ = hub; }
  void set_data_id(uint8_t id) { this->id_ = id; }
  void set_value_type(uint8_t vt) { this->vt_ = vt; }
  void set_period(uint32_t ms) { this->period_ = ms; }
  void set_initial(float v) { this->initial_ = v; }
  void set_restore(bool r) { this->restore_ = r; }
  void setup() override {
    float v = this->initial_;
    if (this->restore_) {
      this->pref_ = this->make_entity_preference<float>();
      float r;
      if (this->pref_.load(&r) && !std::isnan(r)) v = r;
    }
    if (!std::isnan(v)) this->apply_(v);
  }
  float get_setup_priority() const override { return esphome::setup_priority::DATA; }

 protected:
  void control(float value) override {
    this->apply_(value);
    if (this->restore_) this->pref_.save(&value);
  }
  void apply_(float value) {
    this->hub_->set_value(this->id_, encode_value(value, this->vt_), this->period_);
    this->publish_state(value);
  }
  OtHub *hub_{nullptr};
  uint8_t id_{0};
  uint8_t vt_{VT_F88};
  uint32_t period_{10000};
  float initial_{NAN};
  bool restore_{true};
  esphome::ESPPreferenceObject pref_;
};
#endif

#ifdef USE_SWITCH
// kinds: 0-4 master flags (CH, DHW, cooling, OTC, CH2), 5 override of a Data-ID (gateway; Data-ID 0 = the flags)
class OtSwitch : public switch_::Switch, public esphome::Component {
 public:
  void set_hub(OtHub *hub) { this->hub_ = hub; }
  void set_kind(uint8_t k) { this->kind_ = k; }
  void set_data_id(uint8_t id) { this->id_ = id; }
  void setup() override {
    auto initial = this->get_initial_state_with_restore_mode();
    this->write_state(initial.has_value() ? *initial : (this->kind_ <= 1));
  }

 protected:
  void write_state(bool on) override {
    if (this->kind_ < 5)
      this->hub_->set_flag(uint8_t(1u << this->kind_), on);
    else
      this->hub_->enable_override(this->id_, on);
    this->publish_state(on);
  }
  OtHub *hub_{nullptr};
  uint8_t kind_{0};
  uint8_t id_{0};
};
#endif

}  // namespace immergas_ot
}  // namespace esphome
