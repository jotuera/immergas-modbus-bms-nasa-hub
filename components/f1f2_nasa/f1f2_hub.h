// Samsung NASA bus hub for ESPHome - PolyForm Noncommercial 1.0.0 (c) 2026 JoTu.
// Receives and validates frames, dispatches message values to registered entities and
// (optionally) polls values that are never broadcast (e.g. FSV installer settings) with READ requests.
#pragma once

#include <deque>
#include <map>
#include <string>
#include <vector>

#include "esphome/core/component.h"
#include "esphome/core/defines.h"
#include "esphome/core/hal.h"
#include "esphome/core/helpers.h"
#include "esphome/components/uart/uart.h"
#ifdef USE_SENSOR
#include "esphome/components/sensor/sensor.h"
#endif
#ifdef USE_TEXT_SENSOR
#include "esphome/components/text_sensor/text_sensor.h"
#endif

#include "f1f2_frame.h"

namespace esphome {
namespace f1f2_nasa {

class NasaHub;

// Something that wants the value of one message id from one source address.
class NasaListener {
 public:
  void set_message_id(uint16_t id) { this->message_id_ = id; }
  void set_source(uint32_t source) { this->source_ = source; }
  void set_poll(bool poll) { this->poll_ = poll; }
  uint16_t get_message_id() const { return this->message_id_; }
  uint32_t get_source() const { return this->source_; }
  bool get_poll() const { return this->poll_; }
  virtual void on_message(const Packet &packet, const Message &message) = 0;
  // Called when a bus-access gate changes. A sensor is unavailable while bus_on is false (NASA connection
  // off = disconnected); a control entity (number / control switch) is unavailable unless both are true.
  // Default: ignore (passive entities that only react to frames do not need this).
  virtual void on_gate_change(bool bus_on, bool panel_on) {}

 protected:
  uint16_t message_id_{0};
  uint32_t source_{0};
  bool poll_{false};
};

// Numeric decoding shared by sensors: sentinel -> NaN, optional high word, sign, scale.
struct ValueDecoder {
  bool is_signed{false};
  bool high_word{false};
  float multiply{1.0f};
  std::vector<uint32_t> nan_values;

  bool decode(const Message &m, float &out) const;
};

class NasaHub : public Component, public uart::UARTDevice {
 public:
  void setup() override;
  void loop() override;
  void dump_config() override;
  float get_setup_priority() const override { return setup_priority::DATA; }

  // --- configuration (from codegen) ---
  void set_address(uint32_t a) { this->address_ = Address::from_raw(a); }
  void set_read_address(uint32_t a) { this->read_address_ = Address::from_raw(a); }
  void set_transmit(bool t) { this->transmit_ = t; }
  void set_quiet_time(uint32_t ms) { this->quiet_time_ = ms; }
  void set_response_timeout(uint32_t ms) { this->response_timeout_ = ms; }
  void set_max_attempts(uint8_t n) { this->max_attempts_ = n; }
  void set_poll_interval(uint32_t ms) { this->poll_interval_ = ms; }
  void set_republish_interval(uint32_t ms) { this->republish_interval_ = ms; }
  void set_flow_control_pin(GPIOPin *pin) { this->flow_control_pin_ = pin; }
  void set_sniffer(bool on) { this->sniffer_ = on; }
  void set_indoor_address(uint32_t a) { this->indoor_address_ = a; }
  void set_outdoor_address(uint32_t a) { this->outdoor_address_ = a; }
  // Label shown in the device list for an address class (translated in codegen).
  void add_class_label(uint8_t cls, const std::string &label) { this->class_labels_[cls] = label; }

  void register_listener(NasaListener *l);

#ifdef USE_SENSOR
  void set_rx_frames_sensor(sensor::Sensor *s) { this->rx_frames_sensor_ = s; }
  void set_crc_errors_sensor(sensor::Sensor *s) { this->crc_errors_sensor_ = s; }
  void set_tx_frames_sensor(sensor::Sensor *s) { this->tx_frames_sensor_ = s; }
  void set_timeouts_sensor(sensor::Sensor *s) { this->timeouts_sensor_ = s; }
#endif
#ifdef USE_TEXT_SENSOR
  void set_last_frame_text_sensor(text_sensor::TextSensor *s) { this->last_frame_text_ = s; }
  void set_last_change_text_sensor(text_sensor::TextSensor *s) { this->last_change_text_ = s; }
  void set_devices_text_sensor(text_sensor::TextSensor *s) { this->devices_text_ = s; }
#endif

  // --- runtime API ---
  // Queue READ requests (split into frames of <= 10 messages) to the read address.
  void request_read(const std::vector<uint16_t> &ids);
  // Re-read everything registered with poll: true (FSV etc.).
  void poll_now();
  void set_sniffer_enabled(bool on) {
    this->sniffer_ = on;
    // fast main loop while sniffing, so frame times in the log are accurate to ~1 ms
    if (on)
      this->high_freq_.start();
    else
      this->high_freq_.stop();
  }
  bool is_sniffer_enabled() const { return this->sniffer_; }
  // Discovery: like the sniffer value-change log, but every change line also carries a snapshot of the key
  // reference signals (compressor Hz, modes, defrost, night, 3-way valve, outdoor temp) so an unknown PDU's
  // change can be correlated at a glance. Pair with the tools/sniffer_correlate.py analyser.
  void set_discovery_enabled(bool on) { this->discovery_ = on; }
  bool is_discovery_enabled() const { return this->discovery_; }
  uint32_t get_republish_interval() const { return this->republish_interval_; }

  // --- bus access gates (layered safety) ---
  // NASA connection (master fuse): when false the hub ignores the bus entirely - RX is drained but not
  // dispatched, no polls, no writes. ALL entities go unavailable (the device is disconnected). Default on.
  void set_bus_enabled(bool on);
  bool get_bus_enabled() const { return this->bus_enabled_; }
  // Emulate EHS panel: when false the hub does not actively poll (no READ requests); the control / FSV
  // entities go unavailable (only the passively broadcast sensors stay live). Writes also need this on.
  // Default on. (Both setters are in the .cpp: they notify entities and refresh the readback on enable.)
  void set_panel_emulation(bool on);
  bool get_panel_emulation() const { return this->panel_emulation_; }

  // --- control writes (optional; off until armed) ---
  // Master write gate. A control WRITE needs this AND bus_enabled AND panel_emulation to be true.
  void set_allow_write(bool on) { this->allow_write_ = on; }
  bool get_allow_write() const { return this->allow_write_; }
  // Queue a whitelisted control WRITE to the indoor unit. Gated by allow_write AND a short whitelist;
  // a non-whitelisted id is refused in code, so the compressor/EEV/protection/flow can never be written.
  void write_message(uint16_t id, uint32_t value);
  // Convenience levers (both ENUM, 1 byte): away/outing activation and FR compressor-limit enable.
  void outing_set(bool on) { this->write_message(0x406D, on ? 1 : 0); }
  void fr_set_enable(bool on) { this->write_message(0x40A7, on ? 1 : 0); }
  // Mark a message id writable. Only ids registered this way (e.g. by an editable `number` entity you
  // declared) plus the two fixed levers can be written; everything else is refused in write_message.
  // A hard-blocked id (see is_write_whitelisted_) is logged and NOT added - it can never be made writable
  // this way, however it is declared.
  void register_writable(uint16_t id);
  // Last raw value seen on the bus for a message id (NaN if never seen). Used by the control switches
  // to show the real state (so a revert by the Immergas controller is visible).
  float read_value(uint16_t id) const;

  // Feed raw bytes as if received from the bus (tests / replay).
  void feed(const uint8_t *data, size_t len);

 protected:
  struct PendingRequest {
    Address dst;
    std::vector<uint16_t> ids;
    uint8_t number{0};
    uint8_t attempts{0};
    uint32_t sent_at{0};
  };

  struct WriteOp {
    uint16_t id{0};
    uint32_t value{0};
  };

  void process_byte_(uint8_t b);
  bool process_frame_(const uint8_t *buf, size_t len);
  void handle_packet_(const Packet &p);
  void try_transmit_();
  void send_request_(PendingRequest &req);
  void send_write_(const WriteOp &op);
  bool is_write_whitelisted_(uint16_t id) const;
  void notify_gates_();  // tell every entity the current (bus_enabled_, panel_emulation_) availability
  uint8_t next_packet_number_();
  void publish_stats_();
  void sniff_(const Packet &p);
  void note_device_(const Address &a);
  std::string device_label_(const Address &a) const;
  void check_addresses_();

  Address address_{ADDR_CLASS_JIG_TESTER, 0xFF, 0x00};
  Address read_address_{0xB2, 0x00, 0x20};
  bool transmit_{true};
  uint32_t quiet_time_{100};
  uint32_t response_timeout_{1000};
  uint8_t max_attempts_{3};
  uint32_t poll_interval_{30 * 60 * 1000};
  uint32_t republish_interval_{60 * 1000};
  GPIOPin *flow_control_pin_{nullptr};
  bool sniffer_{false};
  bool discovery_{false};

  std::map<uint16_t, std::vector<NasaListener *>> listeners_;
  std::vector<uint16_t> poll_ids_;

  std::vector<uint8_t> rx_;
  uint32_t last_rx_byte_{0};
  // sniffer timing: start of the frame being received, end of the previous frame, bytes skipped between frames
  uint32_t frame_start_ms_{0};
  uint32_t last_frame_end_ms_{0};
  uint32_t skipped_bytes_{0};
  std::vector<uint8_t> skipped_;   // first bytes skipped between frames (sniffer only)
  uint32_t last_skip_ms_{0};
  HighFrequencyLoopRequester high_freq_;

  std::deque<PendingRequest> queue_;
  bool in_flight_{false};
  PendingRequest current_;
  uint8_t packet_number_{0};
  uint32_t last_poll_{0};
  bool first_poll_done_{false};

  // bus access gates (layered safety)
  bool bus_enabled_{true};       // NASA connection: master TX fuse
  bool panel_emulation_{true};   // Emulate EHS panel: active readback / polling

  // control writes
  std::deque<WriteOp> write_queue_;
  bool allow_write_{false};
  std::vector<uint16_t> writable_;           // ids made writable by declared number entities
  std::map<uint16_t, uint32_t> last_value_;  // last raw value per message id (for write readback)

  std::map<uint32_t, uint32_t> sniff_last_;  // (source<<16 | id) -> last value

  // devices seen on the bus (address -> frames) for address discovery
  std::map<uint32_t, uint32_t> devices_;
  std::map<uint8_t, std::string> class_labels_;
  uint32_t indoor_address_{0x200001};
  uint32_t outdoor_address_{0x100000};
  bool addresses_checked_{false};

  uint32_t rx_frames_{0}, crc_errors_{0}, tx_frames_{0}, timeouts_{0}, nacks_{0};
  uint32_t last_stats_{0};
#ifdef USE_SENSOR
  sensor::Sensor *rx_frames_sensor_{nullptr};
  sensor::Sensor *crc_errors_sensor_{nullptr};
  sensor::Sensor *tx_frames_sensor_{nullptr};
  sensor::Sensor *timeouts_sensor_{nullptr};
#endif
#ifdef USE_TEXT_SENSOR
  text_sensor::TextSensor *last_frame_text_{nullptr};
  text_sensor::TextSensor *last_change_text_{nullptr};
  text_sensor::TextSensor *devices_text_{nullptr};
#endif
};

}  // namespace f1f2_nasa
}  // namespace esphome
