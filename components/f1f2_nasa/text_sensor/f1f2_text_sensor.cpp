#include "f1f2_text_sensor.h"
#include "esphome/core/hal.h"
#include <cstdio>

namespace esphome {
namespace f1f2_nasa {

std::string NasaTextSensor::format_(const Message &message) const {
  char b[64];
  switch (this->mode_) {
    case TextMode::FIRMWARE: {
      // Samsung part number "DBxx-xxxxxx" (4 bytes), build date yy.mm.dd (3 bytes),
      // optional version at bytes 8..10 (inverter board structure 0x8601).
      const std::vector<uint8_t> &d = message.data;
      if (d.size() < 4)
        return hex_bytes(d.data(), d.size());
      snprintf(b, sizeof(b), "DB%02X-%02X%02X%02X", d[0], d[1], d[2], d[3]);
      std::string s = b;
      if (d.size() >= 7 && (d[4] | d[5] | d[6]) != 0) {
        snprintf(b, sizeof(b), " %02X.%02X.%02X", d[4], d[5], d[6]);
        s += b;
      }
      if (d.size() >= 11 && (d[8] | d[9] | d[10]) != 0) {
        snprintf(b, sizeof(b), " v%02X.%02X.%02X", d[8], d[9], d[10]);
        s += b;
      }
      return s;
    }
    case TextMode::HEX:
      if (message.kind == MessageKind::STRUCTURE)
        return hex_bytes(message.data.data(), message.data.size());
      snprintf(b, sizeof(b), "0x%X", unsigned(message.value));
      return b;
    case TextMode::MAP:
    default: {
      if (message.kind == MessageKind::STRUCTURE)
        return hex_bytes(message.data.data(), message.data.size());
      auto it = this->options_.find(message.value);
      if (it != this->options_.end())
        return it->second;
      snprintf(b, sizeof(b), this->unknown_format_.c_str(), unsigned(message.value));
      return b;
    }
  }
}

void NasaTextSensor::on_message(const Packet &packet, const Message &message) {
  std::string s = this->format_(message);
  uint32_t now = millis();
  if (this->published_ && s == this->state && now - this->last_publish_ < this->republish_ms_)
    return;
  this->published_ = true;
  this->last_publish_ = now;
  this->publish_state(s);
}

void NasaTextSensor::on_gate_change(bool bus_on, bool panel_on) {
  if (!bus_on) {
    // NASA connection off: disconnected. A text sensor has no real "unavailable" that Home Assistant
    // honours (tried has_state=false + a state callback: HA keeps showing the last string). So publish a
    // clear no-data marker instead of leaving the stale value; a real value returns on the next frame.
    this->publish_state("—");
    this->published_ = false;
  }
}

}  // namespace f1f2_nasa
}  // namespace esphome
