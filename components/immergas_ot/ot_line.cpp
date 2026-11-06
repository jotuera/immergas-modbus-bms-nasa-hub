// Part of jotuera/immergas-modbus-bms-nasa-hub - PolyForm Noncommercial 1.0.0 (c) 2026 JoTu.
#include "ot_line.h"
#include "esphome/core/log.h"

namespace esphome {
namespace immergas_ot {

static const char *const TAG = "immergas_ot.line";

bool OtLine::setup(const char *name) {
  this->name_ = name;
  this->in_->setup();
  this->out_->setup();
  this->in_isr_ = this->in_->to_isr();
  this->out_isr_ = this->out_->to_isr();
  this->write_(false);  // idle
  this->in_->attach_interrupt(&OtLine::gpio_isr, this, esphome::gpio::INTERRUPT_ANY_EDGE);

  gptimer_config_t cfg = {};
  cfg.clk_src = GPTIMER_CLK_SRC_DEFAULT;
  cfg.direction = GPTIMER_COUNT_UP;
  cfg.resolution_hz = 1000000;  // 1 µs
  if (gptimer_new_timer(&cfg, &this->timer_) != ESP_OK) {
    ESP_LOGE(TAG, "%s: no free hardware timer", name);
    return false;
  }
  gptimer_event_callbacks_t cbs = {};
  cbs.on_alarm = &OtLine::timer_isr;
  gptimer_register_event_callbacks(this->timer_, &cbs, this);
  gptimer_alarm_config_t alarm = {};
  alarm.alarm_count = 500;  // half bit
  alarm.reload_count = 0;
  alarm.flags.auto_reload_on_alarm = true;
  gptimer_set_alarm_action(this->timer_, &alarm);
  gptimer_enable(this->timer_);
  return true;
}

void IRAM_ATTR OtLine::gpio_isr(OtLine *self) {
  uint32_t now = esphome::micros();
  bool level = self->in_isr_.digital_read();
  bool active = self->in_active_low_ ? !level : level;
  portENTER_CRITICAL_ISR(&self->mux_);
  self->last_edge_ = now;
  if (self->rx_enabled_ && self->rx_n_ < RX_MAX) {
    self->rx_[self->rx_n_].t = now;
    self->rx_[self->rx_n_].active = active;
    self->rx_n_ = self->rx_n_ + 1;
  }
  portEXIT_CRITICAL_ISR(&self->mux_);
}

bool IRAM_ATTR OtLine::timer_isr(gptimer_handle_t timer, const gptimer_alarm_event_data_t *edata, void *arg) {
  auto *self = static_cast<OtLine *>(arg);
  if (self->tx_i_ < self->tx_n_) {
    self->write_(self->tx_[self->tx_i_]);
    self->tx_i_ = self->tx_i_ + 1;
  } else {
    self->write_(false);
    gptimer_stop(timer);
    self->tx_end_us_ = esphome::micros();
    self->tx_busy_ = false;
  }
  return false;
}

bool OtLine::send(uint32_t frame) {
  if (this->tx_busy_ || this->timer_ == nullptr) return false;
  this->tx_n_ = encode_half_bits(frame, this->tx_);
  portENTER_CRITICAL(&this->mux_);
  this->rx_enabled_ = false;  // an adapter may echo our own frame on its input
  this->rx_n_ = 0;
  portEXIT_CRITICAL(&this->mux_);
  this->tx_busy_ = true;
  this->tx_i_ = 1;
  gptimer_set_raw_count(this->timer_, 0);
  this->write_(this->tx_[0]);
  gptimer_start(this->timer_);
  return true;
}

bool OtLine::poll(uint32_t &frame, DecodeResult &res) {
  uint32_t now = esphome::micros();
  if (!this->rx_enabled_) {
    // receive again 2 ms after our own frame went out
    if (!this->tx_busy_ && now - this->tx_end_us_ > 2000) {
      portENTER_CRITICAL(&this->mux_);
      this->rx_n_ = 0;
      this->rx_enabled_ = true;
      portEXIT_CRITICAL(&this->mux_);
    }
    return false;
  }
  if (this->rx_n_ == 0 || now - this->last_edge_ < 2000) return false;
  Edge copy[RX_MAX];
  size_t n;
  portENTER_CRITICAL(&this->mux_);
  n = this->rx_n_;
  for (size_t i = 0; i < n; i++) copy[i] = this->rx_[i];
  this->rx_n_ = 0;
  portEXIT_CRITICAL(&this->mux_);
  if (n < 2) return false;  // a lone edge (the line settling) is not a frame
  res = decode_edges(copy, n, frame);
  if (res != DECODE_OK) {
    ESP_LOGV(TAG, "%s: frame not decoded (%u edges, error %u)", this->name_, (unsigned) n, (unsigned) res);
  }
  return true;
}

}  // namespace immergas_ot
}  // namespace esphome
