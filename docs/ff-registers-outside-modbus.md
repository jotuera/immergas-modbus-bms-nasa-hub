**English** · [Polski](ff-registers-outside-modbus.pl.md)

# F1/F2 registers NOT controlled by the Immergas Modbus buses


List of F1/F2 bus registers (catalogue `f1f2_nasa`) that the **Immergas Modbus buses
(D+/D- and T-/T+) do NOT control** — this is the domain of the Samsung outdoor unit and the MIM board. Immergas
sends only a request (heat / do not heat, setpoint), and the values below are set by the ODU / MIM
firmware on its own. Complementary to `ff-what-immergas-controls.md`.

Basis: cross-audit of the three buses (2026-10-01), U11 test (2026-10-13), write test (2026-10-22).

Columns:
- **source** — where the value appears on F1/F2 from: `ODU` = broadcast 10.00.00→B0.00.FF; `MIM` =
  broadcast 20.00.01→B3.00.FF; `request` = only in response to our READ (FSV).
- **nature** — `telemetry` (measurement, R/O), `actuator/state` (the ODU drives a component), `parameter`
  (setting), `info` (static).

## 1. Outdoor unit (ODU, 0x8xxx) — telemetry, read-only

| Entity | PDU | source | nature |
|---|---|---|---|
| Discharge temperature | 0x820A | ODU | telemetry |
| Condenser temperature (outdoor coil) | 0x8218 | ODU | telemetry |
| Compressor top temperature | 0x8280 | ODU | telemetry |
| IPM module temperature | 0x8254 | ODU | telemetry |
| Target discharge temperature | 0x8223 | ODU | telemetry (target calculated by the ODU) |
| Outdoor Current | 0x8217 | ODU | telemetry |
| Heat Pump Voltage | 0x24FC | ODU | telemetry |
| Mains AC Voltage | 0x82ED | ODU | telemetry |
| Outdoor DC-Link Voltage | 0x823B | ODU | telemetry |
| Power consumed / outdoor unit power | 0x8413 / 0x8411 | ODU | telemetry |
| Total Consumed Energy | 0x8414 | ODU | telemetry |
| Outdoor Unit Capacity (rated) | 0x82E3 | ODU | info |
| Linked Indoor Units | 0x0207 | ODU | info |

## 2. Outdoor unit — components and states controlled by the ODU (not Modbus)

| Entity | PDU | source | nature |
|---|---|---|---|
| Compressor frequency (actual) | 0x8238 | ODU | actuator (the ODU picks the Hz) |
| Order / target frequency | 0x8236 / 0x8237 | ODU | actuator |
| Frequency limit 64/95 (natural) | 0x8239 | ODU | ODU control (NOT U11; 19 = U11, see ff-what-immergas-controls.md) |
| Fan speed (target / actual) | 0x823D / 0x82D9 | ODU | actuator |
| Main EEV position | 0x8229 | ODU | actuator |
| 4-way valve | 0x801A | ODU | actuator |
| Hot gas valve | 0x8017 | ODU | actuator |
| Base heater (drain pan heater) | 0x80AF | ODU | actuator (frost protection) |
| Defrost | 0x402E | ODU | state (the ODU decides) |
| Defrost stage | 0x8061 | ODU | state |
| Compressor start stage | 0x8248 | ODU | state (start-up logic) |
| Restart inhibit | 0x8249 | ODU | state (protection) |
| Compressor running | 0x8010 | ODU | state |
| Outdoor unit operating mode | 0x8001 | ODU | state |
| Outdoor unit state (heat/cool) | 0x8003 | ODU | state |
| Fan state | 0x800D | ODU | state |
| Error code / system error | 0x8235 | ODU | state |
| "Running under night limit" flag | 0x80B1 | ODU | state (result of U11 — triggered by Immergas, but set by the ODU) |

## 3. Indoor unit / MIM (0x40xx / 0x42xx) not controlled by Modbus

| Entity | PDU | source | nature |
|---|---|---|---|
| Indoor unit EEV position | 0x4217 | MIM | actuator (ODU/MIM) |
| 2-way valve | 0x408A | MIM | actuator |
| 3-way valve + position | 0x4067 | MIM | actuator (follows the DHW request, but the MIM drives it) |
| Indoor unit capacity request | 0x4211 | MIM | telemetry |
| Indoor unit rated capacity | 0x4212 | MIM | info |
| 0x428D (U11 carrier) | 0x428D | MIM | parameter (the value comes from Immergas U11, but the MIM broadcasts it) |

## 4. FSV installer parameters (94 in total)

**Samsung** settings, read only on our READ (`request`). Immergas does not set them via
Modbus; moreover, the FSV water law (2011–2022) is inactive on the Magis, because the water setpoint is calculated by
the Immergas curve. Full list in `components/f1f2_nasa/f1f2_fsv_catalog.yaml` and `PDU_MAP.md`.

| Range | PDU | meaning |
|---|---|---|
| Temperature limits 1011–1052 | 0x424A–0x4253 | min/max water and room (cooling/heating/DHW) |
| Water law 2011–2093 | 0x4254…/0x4093… | heating/cooling curve (overridden by Immergas here) |
| DHW 3011–3083 | 0x4097…/0x4260… | DHW mode, hysteresis, heater, disinfection, solar |
| Heaters / boiler 4011–4061 | 0x409E…/0x426D… | booster heater, backup boiler, mixing valve, pump |
| Modes 5011–5094 | 0x4273…/0x411B… | outing mode, saving, power peak, PV, Smart Grid |

## 5. Firmware / static information

| Entity | PDU | source |
|---|---|---|
| Outdoor Unit Firmware | 0x0608 (ODU) | ODU |
| Outdoor Unit EEPROM | 0x060C | ODU |
| Inverter Firmware | 0x8601 | ODU |
| Indoor Unit (MIM) Firmware | 0x0608 (indoor) | MIM |

## 6. RAW — not decoded, nature unknown

0x0402, 0x0411–0x0415, 0x4006, 0x440A, 0x4604 (indoor); 0x041B, 0x8201, 0x823F, 0x8243, 0x824B,
0x824C, 0x82E1, 0x840F, 0x8417 (outdoor). They do not come from Immergas (no counterparts on D+/D- or
T-/T+); to be decoded with the sniffer. Details: `NASA_PDU_crossref.md`, `PDU_MAP.md`.

---

**Note on writing:** telemetry registers (nature "telemetry/info") are read-only —
writing achieves nothing. The ODU-side "actuator/state" registers are operating parameters of the inverter compressor
(frequency, EEV, valves, protections) — writing a wrong value risks damage or unsafe
operation. That is why none of them is indicated here as a "safe write target".
