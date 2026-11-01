#pragma once
#include "esphome/components/sensor/sensor.h"
#include "../f1f2_hub.h"

namespace esphome {
namespace f1f2_nasa {

class NasaSensor : public sensor::Sensor, public NasaListener {
 public:
  void set_signed(bool v) { this->decoder_.is_signed = v; }
  void set_high_word(bool v) { this->decoder_.high_word = v; }
  void set_multiply(float v) { this->decoder_.multiply = v; }
  void add_nan_value(uint32_t v) { this->decoder_.nan_values.push_back(v); }
  void set_republish_interval(uint32_t ms) { this->republish_ms_ = ms; }
  void on_message(const Packet &packet, const Message &message) override;
  void on_gate_change(bool bus_on, bool panel_on) override;  // unavailable while NASA connection is off

 protected:
  ValueDecoder decoder_;
  uint32_t republish_ms_{60000};
  uint32_t last_publish_{0};
  bool published_{false};
};

}  // namespace f1f2_nasa
}  // namespace esphome
