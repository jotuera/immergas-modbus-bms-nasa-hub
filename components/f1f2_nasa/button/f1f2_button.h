#pragma once
#include "esphome/components/button/button.h"
#include "esphome/core/helpers.h"
#include "../f1f2_hub.h"

namespace esphome {
namespace f1f2_nasa {

// Re-reads every polled value (FSV etc.) now.
class NasaPollButton : public button::Button, public Parented<NasaHub> {
 protected:
  void press_action() override { this->parent_->poll_now(); }
};

}  // namespace f1f2_nasa
}  // namespace esphome
