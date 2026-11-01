**English** · [Polski](ff-control-results.pl.md)

# Results — what the bridge proved on the Magis


The goal of the project was to control **Samsung outdoor-unit functions that Immergas does not expose
through its Modbus** (quiet mode, ODU-side heating curve, ODU-side maximum heating temperature)
by injecting NASA write frames on the F1/F2 bus, **without touching the traffic that Immergas
controls**. The honest result, on a **Magis Combo 9 Plus V2 + Audax Pro 9 V2**, is **negative, but exhaustive**.
This file documents it so that nobody repeats the dead ends.

## The write path works (for "soft" registers)

FSV / enum writes to the indoor unit (`20.00.01`) **arrive and persist**. Rigorously proven:
a WRITE (`type 0x12`) gets a MIM response (`src 20.00.01`, `type 0x15`) carrying the written value, and an independent READ
confirms the new value. Verified on:

- **FSV 1012** `0x424B` (min. cooling temperature, inert) — the write persists.
- **FSV 1031** `0x424E` (max. heating flow temperature) — the write persists.
- **FR control enable** `0x40A7` — enum `0 → 1` written and read back as `1`.

The parser trusts only frames from devices (`20.00.01` / `10.00.00`), never its own echo (`80.FF.00`), so these
confirmations are real, not a reflection of what was sent.

## …but every functional lever is overridden or rejected

| Lever | Register | Result |
|---|---|---|
| **Max.** heating flow temperature (FSV 1031) | `0x424E` | The write persists, but **the Immergas setpoint `0x4247` overrides it**: with a 31.7 °C demand, the flow `0x4238` exceeded the 22 °C max. towards the demand. Temperature limits achieve nothing. |
| **FR ratio** (FSV 5051) | `0x42F1` | Write **rejected** — stays `0xFFFF`. Enable (`0x40A7`) flips to 1, but the ratio value does not take, and the compressor `0x8238` does not change. Consistent with the manual: *"Only tank-integrated hydro units"*. |
| **Quiet mode** | `0x428D` | Controlled by the **Immergas night function U11** (D+/D- → MIM broadcasts `0x428D` → ODU drops `0x8239` 64→19). This is not a Samsung-only lever; it is available through Immergas. |
| **Power peak** (5041) | `0x40A4` | Enable only; works only with an external peak signal (not connected). The write holds, does nothing. |
| **Outing mode** | `0x406D` | Requires an away-mode activator; none present. The write holds, does nothing. |
| **Smart Grid** (5091) | `0x411C` | Requires an SG signal; not connected. The write holds, does nothing. |

**Conclusion:** on F1/F2 **the Immergas controller holds the loop**. It calculates the water setpoint from its own curve and
controls the Samsung side through the MIM. Anything it does not control either requires an external trigger that
is not present, or is rejected by the unit. There is no safe *and* effective Samsung-only write lever on
this installation. The quiet mode that *can* be obtained is the Immergas night function U11.

## OFF-LIMITS — never write these

The component's whitelist allows only FR control (`0x40A7` / `0x42F1`) and one configured FSV. It deliberately
rejects everything below, and so should you:

- **Compressor frequency** `0x8236`–`0x8239`, **EEV position** `0x8229` — a write drives the compressor / expansion
  valve directly. Risk of hardware damage.
- **Flow sensor** `0x42E9` (`VAR_IN_FLOW_SENSOR_CALC`) — **feeds the flow protection** (related `0x42E8`,
  `0x4102`, ODU `0x803B`, errors E911/E912/E913). A fake flow could wake Samsung's dormant flow check
  (it currently ignores the `65535` "no sensor" sentinel) → protection decisions based on a made-up number → compressor running
  dry → destroyed heat exchanger. Irreversible, cosmetic gain. Immergas does not broadcast `0x42E9`.
- 4-way / hot gas valves, defrost, base heater and any other ODU actuator / protection register.

## A useful path instead: COP, read-only

The constructive goal (knowing the heat pump's efficiency) is better met **without any write**, by calculating COP in Home
Assistant from values already present on the buses:

```
heat_output_W = (flow_l_per_h / 3600) * 4186 * (0x4238 - 0x4236)
COP           = heat_output_W / 0x8413
```

(Flow from the T-/T+ bus, ΔT and electrical power from the F1/F2 reader.) More accurate than the outdoor
unit's internal meter. The read-only reader is
[f1f2-nasa](https://github.com/jotuera/immergas-modbus-bms-nasa-hub).
