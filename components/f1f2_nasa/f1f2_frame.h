// Samsung NASA frame codec (encode / decode / CRC).
// Part of jotuera/immergas-modbus-bms-nasa-opentherm-hub - PolyForm Noncommercial 1.0.0 (c) 2026 JoTu.
// Written from scratch from protocol facts; see NOTICE for the MIT references consulted.
//
// Frame layout (all multi-byte fields big-endian):
//   0x32 | size(2) | src(3) | dst(3) | info(1) | type(1) | number(1) | count(1) | messages... | crc(2) | 0x34
//   size  = total frame length - 2
//   info  = 0xC0 (packetInformation=1, protocolVersion=2, retryCount=0)
//   type  = packetType << 4 | dataType
//   crc   = CRC-16/XMODEM over bytes [3 .. total-3)
//   message = id(2) + payload; payload size from (id >> 9) & 3: 0=1B enum, 1=2B variable,
//             2=4B long, 3=structure (only message in the frame, runs up to the CRC).
#pragma once

#include <cstddef>
#include <cstdint>
#include <string>
#include <vector>

namespace esphome {
namespace f1f2_nasa {

static const uint8_t NASA_START = 0x32;
static const uint8_t NASA_END = 0x34;
static const size_t NASA_MIN_FRAME = 16;
static const size_t NASA_MAX_FRAME = 1500;
static const uint8_t NASA_MAX_MESSAGES_PER_FRAME = 10;

enum class PacketType : uint8_t { STANDBY = 0, NORMAL = 1, GATHERING = 2, INSTALL = 3, DOWNLOAD = 4 };

enum class DataType : uint8_t {
  UNDEFINED = 0,
  READ = 1,
  WRITE = 2,
  REQUEST = 3,
  NOTIFICATION = 4,
  RESPONSE = 5,
  ACK = 6,
  NACK = 7,
};

enum class MessageKind : uint8_t { ENUM = 0, VARIABLE = 1, LONG = 2, STRUCTURE = 3 };

// Address classes used on EHS installs (subset).
static const uint8_t ADDR_CLASS_OUTDOOR = 0x10;
static const uint8_t ADDR_CLASS_INDOOR = 0x20;
static const uint8_t ADDR_CLASS_WIRED_REMOTE = 0x50;
static const uint8_t ADDR_CLASS_JIG_TESTER = 0x80;
static const uint8_t ADDR_CLASS_BROADCAST_SELF = 0xB0;

struct Address {
  uint8_t cls{0};
  uint8_t channel{0};
  uint8_t addr{0};

  uint32_t raw() const { return (uint32_t(cls) << 16) | (uint32_t(channel) << 8) | addr; }
  static Address from_raw(uint32_t v) { return Address{uint8_t(v >> 16), uint8_t(v >> 8), uint8_t(v)}; }
  bool operator==(const Address &o) const { return raw() == o.raw(); }
  bool operator!=(const Address &o) const { return raw() != o.raw(); }
  std::string to_string() const;
};

struct Message {
  uint16_t id{0};
  MessageKind kind{MessageKind::ENUM};
  uint32_t value{0};                 // enum / variable / long (big-endian decoded, unsigned)
  std::vector<uint8_t> data;         // structure payload (raw bytes)

  static MessageKind kind_of(uint16_t id) { return MessageKind((id >> 9) & 0x03); }
  static size_t payload_size(MessageKind k) {
    switch (k) {
      case MessageKind::ENUM:
        return 1;
      case MessageKind::VARIABLE:
        return 2;
      case MessageKind::LONG:
        return 4;
      default:
        return 0;
    }
  }
};

struct Packet {
  Address src;
  Address dst;
  uint8_t info{0xC0};
  PacketType packet_type{PacketType::NORMAL};
  DataType data_type{DataType::UNDEFINED};
  uint8_t number{0};
  std::vector<Message> messages;

  // Decode one complete frame (start .. end byte). Returns false on any structural / CRC error.
  bool decode(const uint8_t *buf, size_t len);
  // Encode into a complete frame (start .. end byte).
  std::vector<uint8_t> encode() const;
  std::string to_string() const;
};

uint16_t crc16_xmodem(const uint8_t *data, size_t len);
const char *data_type_str(DataType t);
std::string hex_bytes(const uint8_t *data, size_t len);

}  // namespace f1f2_nasa
}  // namespace esphome
