**English** · [Polski](ff-what-immergas-controls.pl.md)

# F1/F2 registers — what Immergas controls and what the Samsung outdoor unit controls


Classification of all registers read from the F1/F2 bus (catalogue of the `f1f2_nasa` component)
based on our config and logs: cross-audit of the three buses (2026-10-01), test of the night
function U11 (2026-10-13), analysis of the water setpoint, write test of 0x428D (2026-10-22).

**"Controlled by Immergas"** = the command comes from the Immergas controller and is visible/settable
on the **D+/D-** or **T-/T+** bus. A write on F1/F2 would then fight the boiler (proven: writes to the
indoor unit "go into the void", a directed write of 0x428D to the ODU was ignored).

## A. Controlled / set by the Immergas controller (D+/D-, T-/T+)

| Entity | PDU | What Immergas controls / evidence |
|---|---|---|
| Water Outlet Target (active) | 0x4247 | Immergas curve R02–R05 + offset U03; = D04 on D+/D- and T-/T+ |
| DHW Target Temperature | 0x4235 | boiler DHW setpoint (D05 on D+/D-) |
| Zone 1 Target Temp | 0x4201 | zone setpoint in the Immergas |
| Zone 2 Target Temp | 0x42D6 | as above (not broadcast here) |
| Operation mode (4 = heat) | 0x4001 | Immergas system mode (Winter CH+DHW, register 2000 on D+/D-) |
| DHW mode | 0x4066 | Immergas DHW mode |
| DHW Power | 0x4065 | DHW request (Dominus / panel / thermostat) |
| Zone 1 / 2 Power | 0x4000 / 0x411E | zone heating request (Salus / panel → Immergas) |
| Status bits (0x403 = request) | 0x440E | heating request flag from Immergas |
| Control by water temperature | 0x406F | Immergas configuration |
| Circulation pump | 0x4089 | the pump is driven by the Immergas board (A03/A04, flow D14 on T-/T+) |
| **Night function:** limit = 19 Hz | 0x8239 (=19) | Immergas U11: the boiler writes 0x1E W2 = 30 % on D+/D- |
| **Night function:** limit flag | 0x80B1 | result of U11 (when the compressor runs under the limit) |
| **Night function:** carrier | 0x428D (=0x011E) | the MIM broadcasts the U11 value in its cycle |

## B. Samsung outdoor unit's own — NOT controlled by Immergas

Immergas sends only a **request** (heat / do not heat, setpoint), and the outdoor unit decides on its own
how to fulfil it. Immergas does not set these registers.

| Entity | PDU | Who decides |
|---|---|---|
| Compressor frequency (actual / order / target) | 0x8238 / 0x8236 / 0x8237 | the ODU picks the Hz to match the request |
| Frequency limit 64 / 95 (natural) | 0x8239 | ODU regulation in Normal mode (this is NOT U11) |
| Fan speed (target / actual) | 0x823D / 0x82D9 | ODU |
| EEV position (ODU / indoor) | 0x8229 / 0x4217 | ODU |
| 4-way / hot gas valve | 0x801A / 0x8017 | ODU |
| Base heater (drain pan heater) | 0x80AF | ODU (frost protection) |
| Defrost + stage | 0x402E / 0x8061 | the ODU decides |
| Start stage / restart inhibit | 0x8248 / 0x8249 | ODU protection logic |
| Compressor running | 0x8010 | ODU state |
| ODU mode / state, fan state | 0x8001 / 0x8003 / 0x800D | ODU status |
| Error code / system error | 0x8235 | ODU |
| ODU temperatures: discharge, condenser, compressor top, IPM, discharge target | 0x820A / 0x8218 / 0x8280 / 0x8254 / 0x8223 | ODU telemetry |
| Voltages, current, power, energy, rated capacity | 0x82ED / 0x823B / 0x24FC / 0x8217 / 0x8411 / 0x8413 / 0x8414 / 0x82E3 | ODU telemetry |
| Indoor unit capacity request / rated capacity | 0x4211 / 0x4212 | ODU / MIM |
| 2- / 3-way valve | 0x408A / 0x4067 | MIM actuator; the position follows the DHW request, but the MIM drives it |
| **94 FSV parameters** | 0x424A… | Samsung installer settings (MIM-E03 remote / defaults); not via the Immergas Modbus, and the FSV water law is overridden by the Immergas curve anyway |
| ODU / EEPROM / inverter / MIM firmware | 0x0608 / 0x060C / 0x8601 | static information |

## C. Shared measurement (neither side "controls")

| Entity | PDU | Note |
|---|---|---|
| Outdoor temperature (+ copy) | 0x8204 / 0x420C | the same physical sensor as D06 / D79 — a measurement, not control |
| Refrigerant inlet temperature | 0x4205 | = D24 on D+/D- and T-/T+ (reading) |
| Indoor Water Out TW2 | 0x4204 | reading |

## D. Not broadcast here / no data

Zone 2 (0x42D4 / 0x42D6), water flow (0x42E9), produced power and energy (0x4426 / 0x4427)
— the MIM returns 65535 when queried. Booster / tank electric heaters (0x406C / 0x4087)
— the Magis uses a gas boiler, not heaters. Plus a dozen or so raw PDUs not yet decoded (RAW,
in diagnostics): 0x0402, 0x0411–0x0415, 0x4006, 0x440A, 0x041B, 0x8201, 0x823F, 0x8243, 0x824B,
0x824C, 0x82E1, 0x840F, 0x8417, 0x4604.

---

**Bottom line:** Immergas controls **what and when** the heat pump should do — setpoints, modes, heating request,
and even quiet mode (U11). The outdoor unit decides on its own **how** to do it —
frequency, fan, EEV valve, defrost — and Immergas does not touch that. That is why
the boiler is controlled via D+/D- and T-/T+, not by writing on F1/F2.
