// One OpenTherm line (one adapter): receive by GPIO interrupt (edge times), send by a hardware timer (half bits).
// Part of jotuera/immergas-modbus-bms-nasa-hub - PolyForm Noncommercial 1.0.0 (c) 2026 JoTu.
#pragma once

#include "esphome/core/hal.h"
#include "esphome/core/helpers.h"
#include "ot_codec.h"

#include <driver/gptimer.h>
#include <freertos/FreeRTOS.h>

namespace esphome {
namespace immergas_ot {

class OtLine {
 public:
  // in_active_low / out_active_low: the GPIO level that means "line active" on the adapter. The common master and
  // slave adapters (OpenTherm Adapter, DIYLess shields) drive the line active with the output LOW and report the
  // active line with the input HIGH, hence the defaults.
  void configure(esphome::InternalGPIOPin *in, esphome::InternalGPIOPin *out, bool in_active_low, bool out_active_low) {
    this->in_ = in;
    this->out_ = out;
    this->in_active_low_ = in_active_low;
    this->out_active_low_ = out_active_low;
  }
  bool setup(const char *name);
  // starts sending a frame (non blocking, ~34 ms); false while the previous frame is still going out
  bool send(uint32_t frame);
  bool tx_busy() const { return this->tx_busy_; }
  // a received frame: true once the line has been quiet for 2 ms after a frame; result in `res`
  bool poll(uint32_t &frame, DecodeResult &res);
  uint32_t last_edge_us() const { return this->last_edge_; }

 protected:
  static void gpio_isr(OtLine *self);
  static bool timer_isr(gptimer_handle_t timer, const gptimer_alarm_event_data_t *edata, void *arg);
  void write_(bool active) { this->out_isr_.digital_write(this->out_active_low_ ? !active : active); }

  esphome::InternalGPIOPin *in_{nullptr};
  esphome::InternalGPIOPin *out_{nullptr};
  esphome::ISRInternalGPIOPin in_isr_;
  esphome::ISRInternalGPIOPin out_isr_;
  bool in_active_low_{false};
  bool out_active_low_{true};
  const char *name_{""};

  // receive
  static const size_t RX_MAX = 128;
  Edge rx_[RX_MAX];
  volatile size_t rx_n_{0};
  volatile bool rx_enabled_{true};
  volatile uint32_t last_edge_{0};
  portMUX_TYPE mux_ = portMUX_INITIALIZER_UNLOCKED;

  // send
  gptimer_handle_t timer_{nullptr};
  bool tx_[70];
  size_t tx_n_{0};
  volatile size_t tx_i_{0};
  volatile bool tx_busy_{false};
  volatile uint32_t tx_end_us_{0};
};

}  // namespace immergas_ot
}  // namespace esphome
