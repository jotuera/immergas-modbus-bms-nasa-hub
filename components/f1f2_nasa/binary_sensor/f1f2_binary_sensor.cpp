#include "f1f2_binary_sensor.h"
#include "esphome/core/hal.h"

namespace esphome {
namespace f1f2_nasa {

void NasaBinarySensor::on_message(const Packet &packet, const Message &message) {
  if (message.kind == MessageKind::STRUCTURE)
    return;
  bool v = (message.value & this->mask_) != 0;
  uint32_t now = millis();
  if (this->published_ && v == this->state && now - this->last_publish_ < this->republish_ms_)
    return;
  this->published_ = true;
  this->last_publish_ = now;
  this->publish_state(v);
}

void NasaBinarySensor::on_gate_change(bool bus_on, bool panel_on) {
  if (!bus_on) {
    this->invalidate_state();  // NASA connection off: disconnected -> unavailable (has_state = false)
    this->published_ = false;
  }
}

}  // namespace f1f2_nasa
}  // namespace esphome
