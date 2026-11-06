// OpenTherm frame codec - pure C++ (no ESP dependencies) so it can be tested on a PC.
// Part of jotuera/immergas-modbus-bms-nasa-hub - PolyForm Noncommercial 1.0.0 (c) 2026 JoTu.
//
// Physical layer (OpenTherm 2.2): 1000 bit/s, Manchester (bi-phase-L): every bit has a transition in the middle; a
// "1" is the active level in the first half and the idle level in the second, a "0" the other way round. A frame is a
// start bit (1), 32 data bits (MSB first) and a stop bit (1) = 34 bits, 68 half bits.
// Frame: bit31 even parity, bits 30-28 message type, 27-24 spare, 23-16 Data-ID, 15-0 value.
#pragma once

#include <cstdint>
#include <cstddef>

namespace esphome {
namespace immergas_ot {

enum MsgType : uint8_t {
  READ_DATA = 0,
  WRITE_DATA = 1,
  INVALID_DATA = 2,
  RESERVED = 3,
  READ_ACK = 4,
  WRITE_ACK = 5,
  DATA_INVALID = 6,
  UNKNOWN_DATA_ID = 7,
};

inline bool even_parity_ok(uint32_t f) {
  f ^= f >> 16;
  f ^= f >> 8;
  f ^= f >> 4;
  f ^= f >> 2;
  f ^= f >> 1;
  return (f & 1) == 0;
}

inline uint32_t make_frame(uint8_t type, uint8_t data_id, uint16_t value) {
  uint32_t f = (uint32_t(type & 0x07) << 28) | (uint32_t(data_id) << 16) | value;
  if (!even_parity_ok(f)) f |= 0x80000000UL;
  return f;
}

inline uint8_t frame_type(uint32_t f) { return (f >> 28) & 0x07; }
inline uint8_t frame_id(uint32_t f) { return (f >> 16) & 0xFF; }
inline uint16_t frame_value(uint32_t f) { return f & 0xFFFF; }

// f8.8 (signed, 1/256) <-> float
inline float f88_to_float(uint16_t v) { return int16_t(v) / 256.0f; }
inline uint16_t float_to_f88(float x) {
  int32_t r = int32_t(x * 256.0f + (x >= 0 ? 0.5f : -0.5f));
  if (r > 32767) r = 32767;
  if (r < -32768) r = -32768;
  return uint16_t(int16_t(r));
}

// The 68 half-bit levels of a frame: out[i] = true -> line active. Returns the count (68).
inline size_t encode_half_bits(uint32_t frame, bool *out) {
  size_t n = 0;
  auto bit = [&](bool one) {
    out[n++] = one;    // "1": active first
    out[n++] = !one;
  };
  bit(true);  // start
  for (int i = 31; i >= 0; i--) bit((frame >> i) & 1);
  bit(true);  // stop
  return n;
}

// One edge seen on the input: time in µs and the line level AFTER the edge (true = active).
struct Edge {
  uint32_t t;
  bool active;
};

enum DecodeResult : uint8_t { DECODE_OK = 0, DECODE_INCOMPLETE, DECODE_TIMING, DECODE_STOP_BIT, DECODE_PARITY, DECODE_NO_START };

// Decodes one frame from the edges, starting at the first idle->active edge. The mid-bit edges are found by timing
// (750-1250 µs after the previous mid-bit edge, so a bit rate off by up to ~20 % still decodes); the edges between two
// equal bits (~500 µs) are skipped. The value of a bit is the level after its mid-bit edge (idle = 1).
inline DecodeResult decode_edges(const Edge *raw, size_t raw_n, uint32_t &frame, uint32_t min_gap_us = 100) {
  // filter: keep only real level changes and drop short spikes (two edges closer than min_gap_us)
  Edge e[128];
  size_t n = 0;
  bool level = false;
  for (size_t k = 0; k < raw_n && n < 128; k++) {
    if (raw[k].active == level) continue;
    if (n > 0 && raw[k].t - e[n - 1].t < min_gap_us) {
      n--;  // the previous edge was the start of a spike: remove both
      level = n > 0 ? e[n - 1].active : false;
      continue;
    }
    e[n++] = raw[k];
    level = raw[k].active;
  }
  size_t i = 0;
  while (i < n && !e[i].active) i++;
  if (i >= n) return DECODE_NO_START;
  uint32_t t0 = e[i].t;
  // the mid edge of the start bit: active -> idle, 250-750 µs after t0
  size_t j = i + 1;
  while (j < n && e[j].t - t0 < 250) j++;
  if (j >= n) return DECODE_INCOMPLETE;
  if (e[j].t - t0 > 750 || e[j].active) return DECODE_TIMING;
  uint32_t last_mid = e[j].t;
  uint64_t bits = 0;
  int count = 0;  // data bits + stop bit after the start bit
  for (size_t k = j + 1; k < n && count < 33; k++) {
    uint32_t dt = e[k].t - last_mid;
    if (dt < 750) continue;  // edge between two equal bits
    if (dt > 1250) return DECODE_TIMING;
    last_mid = e[k].t;
    bits = (bits << 1) | (e[k].active ? 0 : 1);
    count++;
  }
  if (count < 33) return DECODE_INCOMPLETE;
  if ((bits & 1) == 0) return DECODE_STOP_BIT;
  frame = uint32_t(bits >> 1);
  if (!even_parity_ok(frame)) return DECODE_PARITY;
  return DECODE_OK;
}

}  // namespace immergas_ot
}  // namespace esphome
