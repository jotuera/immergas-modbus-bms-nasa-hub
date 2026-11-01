#pragma once
// ServedValue - one register the hub serves to the boiler (as the Dominus or a zone panel) that can also change on
// the bus. It decides whether a value seen on the bus should replace the one the hub serves.
//
// What happens on D+/D-: one value travels in several frames (the boiler writes it to 0x33, reads it from the
// panel 0x29, writes it to 0x29), and while it changes those frames briefly disagree. The hub must neither
// bounce between them nor hand an old value back to the boiler (the boiler treats a value that differs from its
// last write as a new command). So a ServedValue:
//   - rejects values outside its range (placeholders such as 0xFFFF = -1, or 0 °C from a panel that just started),
//   - after a Home Assistant command waits for the bus to echo that value; other values are rejected meanwhile,
//     but only for kCommandWaitMs, after that the bus decides again,
//   - right after a change, rejects panel read replies that still carry the previous value (kCopyLagMs);
//     values the boiler itself writes are always taken,
//   - otherwise takes a different value from the bus (a change made on the panel or by the boiler).
// A zone panel that comes back (reconnect, power cut, our own boot) answers with placeholders until the boiler has
// filled it in; PanelWatch tells when its replies can be trusted again.

#include <cstdint>
#include "esphome/core/hal.h"
#include "esphome/core/log.h"

namespace immergas {

static const uint32_t kCommandWaitMs = 15000;
static const uint32_t kCopyLagMs = 6000;
static const uint32_t kPanelStartupMs = 60000;
static const uint32_t kPanelSilentMs = 10000;

// Replies of the physical zone panel 0x29: trusted only kPanelStartupMs after it starts answering again.
class PanelWatch {
 public:
  void heard() {
    uint32_t now = esphome::millis();
    if (this->never_ || now - this->last_ms_ > kPanelSilentMs) {
      this->since_ms_ = now;
      ESP_LOGW("hub_served", "zone panel 0x29 answers again - its values are trusted in %u s",
               (unsigned) (kPanelStartupMs / 1000));
    }
    this->never_ = false;
    this->last_ms_ = now;
  }
  bool trusted() const { return this->never_ || esphome::millis() - this->since_ms_ >= kPanelStartupMs; }

 protected:
  bool never_{true};
  uint32_t last_ms_{0};
  uint32_t since_ms_{0};
};

inline PanelWatch panel_0x29;

class ServedValue {
 public:
  ServedValue(const char *label, int min_raw, int max_raw) : label_(label), min_(min_raw), max_(max_raw) {}

  // Home Assistant sets a new value (raw, as served).
  void set_from_ha(int raw) {
    this->awaiting_ = true;
    this->awaited_ = raw;
    this->stamp_ms_ = esphome::millis();
  }

  // A value seen on the bus. `served` = what the hub serves now, `source` = "READ" (a device replied) or
  // "WRITE06" / "WRITE10" (the boiler wrote it), `addr` = the device of that frame.
  // True = store `raw` and publish it.
  bool take_from_bus(int served, int raw, const char *source, uint8_t addr) {
    const bool boiler_write = source != nullptr && source[0] == 'W';
    const bool panel_reply = !boiler_write && addr == 0x29;
    const uint32_t now = esphome::millis();
    if (raw < this->min_ || raw > this->max_) {
      ESP_LOGW("hub_served", "%s: %d from %s 0x%02X rejected (out of range)", this->label_, raw, source, addr);
      return false;
    }
    if (panel_reply && !panel_0x29.trusted()) {
      if (raw != served)
        ESP_LOGW("hub_served", "%s: %d from the panel rejected (panel starting up)", this->label_, raw);
      return false;
    }
    if (this->awaiting_) {
      if (raw == this->awaited_) {
        this->awaiting_ = false;
        this->stamp_ms_ = now;
        ESP_LOGI("hub_served", "%s: %d confirmed by %s 0x%02X", this->label_, raw, source, addr);
        return raw != served;
      }
      if (now - this->stamp_ms_ < kCommandWaitMs) {
        ESP_LOGW("hub_served", "%s: %d from %s 0x%02X rejected (waiting for %d from HA)", this->label_, raw,
                 source, addr, this->awaited_);
        return false;
      }
      this->awaiting_ = false;  // never confirmed: the bus decides again
    }
    if (raw == served) return false;
    if (panel_reply && this->stamp_ms_ != 0 && now - this->stamp_ms_ < kCopyLagMs) {
      ESP_LOGW("hub_served", "%s: %d from the panel rejected (old copy, serving %d)", this->label_, raw, served);
      return false;
    }
    this->stamp_ms_ = now;
    ESP_LOGW("hub_served", "%s: %d -> %d taken from %s 0x%02X", this->label_, served, raw, source, addr);
    return true;
  }

 protected:
  const char *label_;
  int min_, max_;
  bool awaiting_{false};
  int awaited_{0};
  uint32_t stamp_ms_{0};  // last command or last accepted change
};

// The served registers (raw values: temperatures x10). Ranges leave out only placeholders and garbage.
namespace served {
inline ServedValue zone1_setpoint{"zone 1 setpoint", 50, 350};
inline ServedValue zone1_offset{"zone 1 offset", -150, 150};
inline ServedValue dhw_setpoint{"DHW setpoint", 100, 650};
inline ServedValue comfort_heat{"comfort heat", 50, 350};
inline ServedValue eco_heat{"eco heat", 50, 350};
inline ServedValue comfort_cool{"comfort cool", 50, 350};
inline ServedValue eco_cool{"eco cool", 50, 350};
inline ServedValue humidity{"humidity", 0, 100};
inline ServedValue set_flow{"set flow", 100, 900};
inline ServedValue operating_mode{"operating mode", 0, 3};
}  // namespace served

}  // namespace immergas
