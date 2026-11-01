// Samsung NASA frame codec - PolyForm Noncommercial 1.0.0 (c) 2026 JoTu. See f1f2_frame.h for the frame layout.
#include "f1f2_frame.h"

#include <cstdio>

namespace esphome {
namespace f1f2_nasa {

uint16_t crc16_xmodem(const uint8_t *data, size_t len) {
  uint16_t crc = 0;
  for (size_t i = 0; i < len; i++) {
    crc ^= uint16_t(data[i]) << 8;
    for (int b = 0; b < 8; b++)
      crc = (crc & 0x8000) ? uint16_t((crc << 1) ^ 0x1021) : uint16_t(crc << 1);
  }
  return crc;
}

const char *data_type_str(DataType t) {
  switch (t) {
    case DataType::READ:
      return "READ";
    case DataType::WRITE:
      return "WRITE";
    case DataType::REQUEST:
      return "REQUEST";
    case DataType::NOTIFICATION:
      return "NOTIFY";
    case DataType::RESPONSE:
      return "RESPONSE";
    case DataType::ACK:
      return "ACK";
    case DataType::NACK:
      return "NACK";
    default:
      return "UNDEF";
  }
}

std::string hex_bytes(const uint8_t *data, size_t len) {
  std::string s;
  s.reserve(len * 2);
  char b[3];
  for (size_t i = 0; i < len; i++) {
    snprintf(b, sizeof(b), "%02X", data[i]);
    s += b;
  }
  return s;
}

std::string Address::to_string() const {
  char b[12];
  snprintf(b, sizeof(b), "%02X.%02X.%02X", cls, channel, addr);
  return b;
}

static Address read_addr(const uint8_t *p) { return Address{p[0], p[1], p[2]}; }

bool Packet::decode(const uint8_t *buf, size_t len) {
  if (len < NASA_MIN_FRAME || len > NASA_MAX_FRAME)
    return false;
  if (buf[0] != NASA_START || buf[len - 1] != NASA_END)
    return false;
  size_t size = (size_t(buf[1]) << 8) | buf[2];
  if (size + 2 != len)
    return false;
  uint16_t crc_rx = (uint16_t(buf[len - 3]) << 8) | buf[len - 2];
  if (crc16_xmodem(buf + 3, len - 6) != crc_rx)
    return false;

  this->src = read_addr(buf + 3);
  this->dst = read_addr(buf + 6);
  this->info = buf[9];
  this->packet_type = PacketType(buf[10] >> 4);
  this->data_type = DataType(buf[10] & 0x0F);
  this->number = buf[11];
  uint8_t count = buf[12];
  this->messages.clear();
  this->messages.reserve(count);

  size_t pos = 13;
  const size_t end = len - 3;  // first CRC byte
  for (uint8_t i = 0; i < count; i++) {
    if (pos + 2 > end)
      return false;
    Message m;
    m.id = (uint16_t(buf[pos]) << 8) | buf[pos + 1];
    m.kind = Message::kind_of(m.id);
    pos += 2;
    if (m.kind == MessageKind::STRUCTURE) {
      m.data.assign(buf + pos, buf + end);
      pos = end;
    } else {
      size_t n = Message::payload_size(m.kind);
      if (pos + n > end)
        return false;
      uint32_t v = 0;
      for (size_t k = 0; k < n; k++)
        v = (v << 8) | buf[pos + k];
      m.value = v;
      pos += n;
    }
    this->messages.push_back(std::move(m));
  }
  return pos == end;
}

std::vector<uint8_t> Packet::encode() const {
  std::vector<uint8_t> out;
  out.reserve(32);
  out.push_back(NASA_START);
  out.push_back(0);  // size placeholder
  out.push_back(0);
  for (const Address &a : {this->src, this->dst}) {
    out.push_back(a.cls);
    out.push_back(a.channel);
    out.push_back(a.addr);
  }
  out.push_back(this->info);
  out.push_back(uint8_t((uint8_t(this->packet_type) << 4) | (uint8_t(this->data_type) & 0x0F)));
  out.push_back(this->number);
  out.push_back(uint8_t(this->messages.size()));
  for (const Message &m : this->messages) {
    out.push_back(uint8_t(m.id >> 8));
    out.push_back(uint8_t(m.id));
    MessageKind k = Message::kind_of(m.id);
    if (k == MessageKind::STRUCTURE) {
      out.insert(out.end(), m.data.begin(), m.data.end());
    } else {
      size_t n = Message::payload_size(k);
      for (size_t i = n; i-- > 0;)
        out.push_back(uint8_t(m.value >> (8 * i)));
    }
  }
  size_t total = out.size() + 3;  // + crc(2) + end(1)
  size_t size = total - 2;
  out[1] = uint8_t(size >> 8);
  out[2] = uint8_t(size);
  uint16_t crc = crc16_xmodem(out.data() + 3, out.size() - 3);
  out.push_back(uint8_t(crc >> 8));
  out.push_back(uint8_t(crc));
  out.push_back(NASA_END);
  return out;
}

std::string Packet::to_string() const {
  std::string s = this->src.to_string() + " > " + this->dst.to_string() + " " + data_type_str(this->data_type);
  char b[48];
  snprintf(b, sizeof(b), " #%u", this->number);
  s += b;
  for (const Message &m : this->messages) {
    if (m.kind == MessageKind::STRUCTURE) {
      snprintf(b, sizeof(b), " %04X=[%u B]", m.id, unsigned(m.data.size()));
    } else {
      snprintf(b, sizeof(b), " %04X=%u", m.id, unsigned(m.value));
    }
    s += b;
  }
  return s;
}

}  // namespace f1f2_nasa
}  // namespace esphome
