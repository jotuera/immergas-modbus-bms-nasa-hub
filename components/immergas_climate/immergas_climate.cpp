#include "immergas_climate.h"

#include <cmath>
#include "esphome/core/log.h"

namespace esphome {
namespace immergas_climate {

static const char *const TAG = "immergas_climate";

// zone status (PDU 2010) bits
static const int ST_MANUAL = 0x04, ST_REQUEST = 0x08, ST_COMFORT = 0x40, ST_ECO = 0x80;
// operating mode -> index in the mode select (standby, summer, cooling, winter)
static const size_t SEL_SUMMER = 1, SEL_COOLING = 2, SEL_WINTER = 3;

climate::ClimateTraits ImmergasClimate::traits() {
  climate::ClimateTraits t;
  t.add_feature_flags(climate::CLIMATE_SUPPORTS_CURRENT_TEMPERATURE | climate::CLIMATE_SUPPORTS_ACTION);
  if (this->humidity_)
    t.add_feature_flags(climate::CLIMATE_SUPPORTS_CURRENT_HUMIDITY);
  t.add_supported_mode(climate::CLIMATE_MODE_OFF);
  t.add_supported_mode(climate::CLIMATE_MODE_HEAT);
  if (this->kind_ == Kind::ZONE) {
    t.add_supported_mode(climate::CLIMATE_MODE_COOL);
    if (this->comfort_heat_ != nullptr) {
      t.add_supported_preset(climate::CLIMATE_PRESET_NONE);
      t.add_supported_preset(climate::CLIMATE_PRESET_COMFORT);
      t.add_supported_preset(climate::CLIMATE_PRESET_ECO);
    }
  }
  return t;
}

void ImmergasClimate::refresh_(bool force) {
  bool dirty = force;
  auto put = [&dirty](float &field, float v) {
    // NAN != NAN, so compare the "is a number" state first
    if (std::isnan(field) != std::isnan(v) || (!std::isnan(v) && field != v)) {
      field = v;
      dirty = true;
    }
  };
  put(this->current_temperature, this->room_ ? this->room_() : NAN);
  if (this->humidity_)
    put(this->current_humidity, this->humidity_());
  if (this->target_ != nullptr && this->target_->has_state())
    put(this->target_temperature, this->target_->state);

  const int op = this->op_mode_ ? this->op_mode_() : -1;
  climate::ClimateMode mode;
  climate::ClimateAction action;
  if (this->kind_ == Kind::DHW) {
    // DHW runs in every mode but standby
    mode = op == 0 ? climate::CLIMATE_MODE_OFF : climate::CLIMATE_MODE_HEAT;
    action = op == 0 ? climate::CLIMATE_ACTION_OFF
             : (this->dhw_request_ && this->dhw_request_()) ? climate::CLIMATE_ACTION_HEATING
                                                              : climate::CLIMATE_ACTION_IDLE;
  } else {
    const int st = this->status_ ? (this->status_() & 0xFF) : 0;
    mode = op == 3 ? climate::CLIMATE_MODE_HEAT : op == 2 ? climate::CLIMATE_MODE_COOL : climate::CLIMATE_MODE_OFF;
    if (mode == climate::CLIMATE_MODE_OFF)
      action = climate::CLIMATE_ACTION_OFF;
    else if (!(st & ST_REQUEST))
      action = climate::CLIMATE_ACTION_IDLE;
    else
      action = mode == climate::CLIMATE_MODE_HEAT ? climate::CLIMATE_ACTION_HEATING : climate::CLIMATE_ACTION_COOLING;
    if (this->comfort_heat_ != nullptr) {
      optional<climate::ClimatePreset> preset;
      if (st & ST_COMFORT)
        preset = climate::CLIMATE_PRESET_COMFORT;
      else if (st & ST_ECO)
        preset = climate::CLIMATE_PRESET_ECO;
      else if (st & ST_MANUAL)
        preset = climate::CLIMATE_PRESET_NONE;
      if (preset.has_value() && this->preset != preset) {
        this->preset = preset;
        dirty = true;
      }
    }
  }
  if (mode != this->mode) {
    this->mode = mode;
    dirty = true;
  }
  if (action != this->action) {
    this->action = action;
    dirty = true;
  }
  if (dirty)
    this->publish_state();
}

void ImmergasClimate::write_target_(float value) {
  if (this->target_ == nullptr || std::isnan(value))
    return;
  auto call = this->target_->make_call();
  call.set_value(value);
  call.perform();
}

void ImmergasClimate::control(const climate::ClimateCall &call) {
  if (call.get_target_temperature().has_value())
    this->write_target_(*call.get_target_temperature());

  if (call.get_mode().has_value() && this->kind_ == Kind::ZONE && this->mode_select_ != nullptr) {
    // OFF = summer: space heating / cooling off, hot water kept (standby stays on the mode select)
    const climate::ClimateMode m = *call.get_mode();
    const size_t index = m == climate::CLIMATE_MODE_HEAT ? SEL_WINTER : m == climate::CLIMATE_MODE_COOL ? SEL_COOLING
                                                                                                          : SEL_SUMMER;
    auto sel = this->mode_select_->make_call();
    sel.set_index(index);
    sel.perform();
  }

  if (call.get_preset().has_value() && this->comfort_heat_ != nullptr) {
    // Comfort / Eco = put the zone setpoint to that level (heating or cooling one); Manual is only a state
    const bool cool = this->cooling_();
    number::Number *level = nullptr;
    if (*call.get_preset() == climate::CLIMATE_PRESET_COMFORT)
      level = cool ? this->comfort_cool_ : this->comfort_heat_;
    else if (*call.get_preset() == climate::CLIMATE_PRESET_ECO)
      level = cool ? this->eco_cool_ : this->eco_heat_;
    if (level != nullptr && level->has_state()) {
      ESP_LOGI(TAG, "'%s': preset -> setpoint %.1f", this->get_name().c_str(), level->state);
      this->write_target_(level->state);
    }
  }
  this->refresh_(true);
}

void ImmergasClimate::dump_config() {
  LOG_CLIMATE("", "Immergas climate", this);
  ESP_LOGCONFIG(TAG, "  Kind: %s", this->kind_ == Kind::DHW ? "DHW" : "zone");
}

}  // namespace immergas_climate
}  // namespace esphome
