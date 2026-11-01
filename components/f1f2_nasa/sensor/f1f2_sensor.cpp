#include "f1f2_sensor.h"
#include "esphome/core/hal.h"
#include <cmath>

namespace esphome {
namespace f1f2_nasa {

void NasaSensor::on_message(const Packet &packet, const Message &message) {
  float v;
  if (!this->decoder_.decode(message, v))
    return;
  uint32_t now = millis();
  bool same = this->published_ && ((std::isnan(v) && std::isnan(this->state)) || v == this->state);
  if (same && now - this->last_publish_ < this->republish_ms_)
    return;
  this->published_ = true;
  this->last_publish_ = now;
  this->publish_state(v);
}

void NasaSensor::on_gate_change(bool bus_on, bool panel_on) {
  if (!bus_on)
    this->publish_state(NAN);  // NASA connection off: the device is disconnected, sensor is unavailable
}

}  // namespace f1f2_nasa
}  // namespace esphome
