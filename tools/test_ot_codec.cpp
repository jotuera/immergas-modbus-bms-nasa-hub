// Host test of the OpenTherm codec: encode -> line edges (with drift / jitter / glitches) -> decode.
#include "../components/immergas_ot/ot_codec.h"
#include <cstdio>
#include <cstdlib>
#include <vector>
using namespace esphome::immergas_ot;

static std::vector<Edge> to_edges(uint32_t frame, double bit_us, int jitter, uint32_t start = 10000, bool glitch = false) {
  bool hb[80];
  size_t n = encode_half_bits(frame, hb);
  std::vector<Edge> e;
  bool level = false;  // idle before
  double t = start;
  for (size_t i = 0; i < n; i++) {
    if (hb[i] != level) {
      int j = jitter ? (rand() % (2 * jitter + 1)) - jitter : 0;
      e.push_back({uint32_t(t + j), hb[i]});
      level = hb[i];
    }
    if (glitch && i == 20) {  // 30 µs spike inside a half bit
      e.push_back({uint32_t(t + 200), !level});
      e.push_back({uint32_t(t + 230), level});
    }
    t += bit_us / 2;
  }
  if (level) e.push_back({uint32_t(t), false});  // back to idle (never: stop bit ends idle)
  return e;
}

int main() {
  int fails = 0, total = 0;
  uint32_t frames[] = {make_frame(READ_DATA, 0, 0x03CA), make_frame(WRITE_DATA, 1, float_to_f88(45.5f)),
                       make_frame(READ_ACK, 25, float_to_f88(52.25f)), make_frame(UNKNOWN_DATA_ID, 115, 0),
                       make_frame(WRITE_ACK, 56, 0x3700), 0x00000000, make_frame(READ_ACK, 27, float_to_f88(-7.5f))};
  struct Case { double bit; int jit; bool gl; const char *name; } cases[] = {
    {1000, 0, false, "exact"}, {1000, 60, false, "jitter 60us"}, {900, 30, false, "10% fast"},
    {1100, 30, false, "10% slow"}, {1000, 20, true, "glitch"}};
  for (auto &c : cases) {
    for (uint32_t f : frames) {
      if (!even_parity_ok(f)) continue;
      total++;
      auto e = to_edges(f, c.bit, c.jit, 10000, c.gl);
      uint32_t out = 0;
      auto r = decode_edges(e.data(), e.size(), out);
      if (r != DECODE_OK || out != f) {
        fails++;
        printf("FAIL %-12s frame %08X -> result %d %08X\n", c.name, f, r, out);
      }
    }
  }
  // parity check
  uint32_t bad = make_frame(READ_ACK, 25, 0x1234) ^ 0x00000100;
  auto e = to_edges(bad, 1000, 0);
  uint32_t out;
  total++;
  if (decode_edges(e.data(), e.size(), out) != DECODE_PARITY) { fails++; printf("FAIL parity not detected\n"); }
  // f8.8
  total++;
  if (f88_to_float(float_to_f88(-7.5f)) != -7.5f || f88_to_float(0x2D80) != 45.5f) { fails++; printf("FAIL f88\n"); }
  // incomplete frame
  e = to_edges(make_frame(READ_ACK, 25, 0x1234), 1000, 0);
  e.resize(e.size() / 2);
  total++;
  if (decode_edges(e.data(), e.size(), out) != DECODE_INCOMPLETE) { fails++; printf("FAIL incomplete\n"); }
  printf("%d / %d passed\n", total - fails, total);
  return fails ? 1 : 0;
}
