#pragma once
#include "esphome/components/number/number.h"
#include "../f1f2_hub.h"

namespace esphome {
namespace f1f2_nasa {

// An editable FSV (or PDU): reads the value from the bus like a sensor, and on change writes it back
// through the hub (gated by the hub's allow_write + whitelist; the id is registered writable in codegen).
class NasaNumber : public number::Number, public NasaListener {
 public:
  void set_hub(NasaHub *hub) { this->hub_ = hub; }
  void set_signed(bool v) { this->decoder_.is_signed = v; }
  void set_high_word(bool v) { this->decoder_.high_word = v; }
  void set_multiply(float v) { this->decoder_.multiply = v; }
  void add_nan_value(uint32_t v) { this->decoder_.nan_values.push_back(v); }
  void on_message(const Packet &packet, const Message &message) override;
  void on_gate_change(bool bus_on, bool panel_on) override;  // unavailable unless NASA connection + EHS panel on

 protected:
  void control(float value) override;
  NasaHub *hub_{nullptr};
  ValueDecoder decoder_;
};

}  // namespace f1f2_nasa
}  // namespace esphome
