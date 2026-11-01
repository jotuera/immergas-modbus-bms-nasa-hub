#pragma once
// Climate entity for an Immergas zone or the DHW cylinder, as the boiler reports them. It does not regulate:
// the boiler does. The entity is a view of existing hub entities plus the boiler's own codes:
//   - target       = a number entity (the zone / DHW setpoint); a new target goes through that number, so it takes
//                    the same path as the slider in Home Assistant,
//   - mode         = the Immergas operating mode 0 standby, 1 summer (DHW only), 2 cooling, 3 winter,
//                    changed through the mode select (options in that order),
//   - zone status  = PDU 2010 of the zone: bit 3 request, bit 6 Comfort phase, bit 7 Eco phase, bit 2 Manual,
//   - Comfort/Eco  = number entities with the zone's comfort and eco levels (heating and cooling).

#include <functional>

#include "esphome/core/component.h"
#include "esphome/components/climate/climate.h"
#include "esphome/components/number/number.h"
#include "esphome/components/select/select.h"

namespace esphome {
namespace immergas_climate {

enum class Kind : uint8_t { ZONE, DHW };

class ImmergasClimate : public climate::Climate, public PollingComponent {
 public:
  void set_kind(Kind kind) { this->kind_ = kind; }
  void set_target_number(number::Number *n) { this->target_ = n; }
  void set_mode_select(select::Select *s) { this->mode_select_ = s; }
  void set_room_temperature(std::function<float()> &&f) { this->room_ = std::move(f); }
  void set_room_humidity(std::function<float()> &&f) { this->humidity_ = std::move(f); }
  void set_operating_mode(std::function<int()> &&f) { this->op_mode_ = std::move(f); }
  void set_zone_status(std::function<int()> &&f) { this->status_ = std::move(f); }
  void set_dhw_request(std::function<bool()> &&f) { this->dhw_request_ = std::move(f); }
  void set_levels(number::Number *comfort_heat, number::Number *eco_heat, number::Number *comfort_cool,
                  number::Number *eco_cool) {
    this->comfort_heat_ = comfort_heat;
    this->eco_heat_ = eco_heat;
    this->comfort_cool_ = comfort_cool;
    this->eco_cool_ = eco_cool;
  }

  void setup() override { this->refresh_(true); }
  void update() override { this->refresh_(false); }
  void dump_config() override;
  float get_setup_priority() const override { return setup_priority::LATE; }

 protected:
  climate::ClimateTraits traits() override;
  void control(const climate::ClimateCall &call) override;
  void refresh_(bool force);
  void write_target_(float value);
  bool cooling_() const { return this->op_mode_ && this->op_mode_() == 2; }

  Kind kind_{Kind::ZONE};
  number::Number *target_{nullptr};
  select::Select *mode_select_{nullptr};
  number::Number *comfort_heat_{nullptr}, *eco_heat_{nullptr}, *comfort_cool_{nullptr}, *eco_cool_{nullptr};
  std::function<float()> room_, humidity_;
  std::function<int()> op_mode_, status_;
  std::function<bool()> dhw_request_;
};

}  // namespace immergas_climate
}  // namespace esphome
