#pragma once
// Bus map of the hub: every register / PDU seen on a bus with its first, min, max and last value and how often it
// changed - the base of the "Report bus map" buttons (a pre-filled GitHub issue, made in the browser by the cards).
// D+/D- (DD): key = addr << 24 | kind << 16 | reg   (kind 'R' func03 reply, 'I' func04 reply, 'W' boiler write)
// T-/T+ (TT): key = PDU, filled by the PDU scanner.
// Only the undescribed entries go into the report: the described ones are in the knowledge base already.
#include <cstdint>
#include <cstdio>
#include <map>
#include <string>

namespace immergas {
namespace busmap {

struct Stat {
  int32_t first, min, max, last;
  uint32_t count, changes;
  bool known;
};

class BusMap {
 public:
  static constexpr size_t MAX_ENTRIES = 800;

  void record(uint32_t key, int32_t value, bool known) {
    auto it = this->map_.find(key);
    if (it == this->map_.end()) {
      if (this->map_.size() >= MAX_ENTRIES) {
        this->dropped_++;
        return;
      }
      this->map_[key] = Stat{value, value, value, value, 1, 0, known};
      return;
    }
    Stat &s = it->second;
    s.count++;
    if (value != s.last) s.changes++;
    s.last = value;
    if (value < s.min) s.min = value;
    if (value > s.max) s.max = value;
  }

  size_t size() const { return this->map_.size(); }
  size_t unknown() const {
    size_t n = 0;
    for (auto &kv : this->map_) n += kv.second.known ? 0 : 1;
    return n;
  }
  uint32_t dropped() const { return this->dropped_; }
  void clear() {
    this->map_.clear();
    this->dropped_ = 0;
  }

  // the undescribed entries: changing ones "key=last (min..max, Nx)", constant ones "key=value", always-0 ones as a
  // key list. name(key) formats the key, e.g. "29R2001". limit = max. characters (a GitHub link holds a few thousand).
  template<typename F> std::string report(F name, size_t limit) const {
    std::string moving, still, zeros;
    size_t n_moving = 0, n_still = 0, n_zero = 0;
    char b[96];
    for (auto &kv : this->map_) {
      const Stat &s = kv.second;
      if (s.known) continue;
      std::string k = name(kv.first);
      if (s.min == 0 && s.max == 0) {
        zeros += (zeros.empty() ? "" : ", ") + k;
        n_zero++;
      } else if (s.changes == 0) {
        snprintf(b, sizeof(b), "%s=%ld", k.c_str(), (long) s.last);
        still += (still.empty() ? "" : ", ") + std::string(b);
        n_still++;
      } else {
        snprintf(b, sizeof(b), "%s=%ld (%ld..%ld, %lux)", k.c_str(), (long) s.last, (long) s.min, (long) s.max,
                 (unsigned long) s.changes);
        moving += (moving.empty() ? "" : ", ") + std::string(b);
        n_moving++;
      }
    }
    snprintf(b, sizeof(b), "seen: %u, described: %u, undescribed: %u", (unsigned) this->map_.size(),
             (unsigned) (this->map_.size() - this->unknown()), (unsigned) this->unknown());
    std::string out = b;
    if (this->dropped_) {
      snprintf(b, sizeof(b), " (+%lu not kept, memory limit)", (unsigned long) this->dropped_);
      out += b;
    }
    out += "\n\nchanging (" + std::to_string(n_moving) + "): " + (moving.empty() ? "-" : moving);
    out += "\n\nconstant, not 0 (" + std::to_string(n_still) + "): " + (still.empty() ? "-" : still);
    out += "\n\nalways 0 (" + std::to_string(n_zero) + "): " + (zeros.empty() ? "-" : zeros);
    if (out.size() > limit) out = out.substr(0, limit > 40 ? limit - 40 : limit) + "\n... (cut, too long for one report)";
    return out;
  }

 private:
  std::map<uint32_t, Stat> map_;
  uint32_t dropped_{0};
};

inline BusMap &dd() {
  static BusMap m;
  return m;
}
inline BusMap &tt() {
  static BusMap m;
  return m;
}

inline std::string dd_key(uint32_t key) {
  char b[16];
  snprintf(b, sizeof(b), "%02X%c%u", (unsigned) (key >> 24), (char) ((key >> 16) & 0xFF), (unsigned) (key & 0xFFFF));
  return b;
}
inline std::string tt_key(uint32_t key) { return std::to_string(key); }

}  // namespace busmap
}  // namespace immergas
