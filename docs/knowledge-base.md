# IMMERGAS Modbus BMS NASA Hub — knowledge base

**English** · [Polski](knowledge-base.pl.md) · back to the [README](../README.md)

### Three heat-pump buses on one ESP32-S3 (ESPHome + Home Assistant)

<p align="center">
  <img src="https://img.shields.io/badge/ESPHome-2026.9%2B-41BDF5.svg" alt="ESPHome 2026.9+">
  <img src="https://img.shields.io/badge/platform-ESP32--S3-41BDF5.svg" alt="ESP32-S3">
</p>

The hub brings into Home Assistant **everything the Immergas Magis Pro / Combo V2 hybrid heat pump says on its three
buses**. All it takes is one **M5Stack AtomS3 Lite** and three isolated RS485 units. No cloud, no original Dominus
controller, no templates in HA.

| Bus | Hub role | What you get |
|---|---|---|
| **D+/D-** (Modbus RTU, master = boiler) | **slave**: emulated zone panel (and optionally Dominus) | boiler control: mode, zone setpoints, DHW, schedules, room temperature from HA; boiler faults with descriptions; heat-pump data from the MIM board |
| **F1/F2** (Samsung NASA) | **listener** + READ requests | Samsung outdoor unit: compressor, fan, EEV, defrost, power and energy consumed, voltages, fault codes, firmware, FSV parameters |
| **T-/T+** (Modbus BMS) | **master** (slave 11 = boiler) | flow D14, states D97/D98/D99, 3-way valve, gas/heat-pump integration (menu I), R limits, estimated gas use |
| *(hub)* | computes from all three buses at once | **COP**, heat energy, system operating state, compressor runtime and starts, heat cost heat pump vs gas, last DHW cycle |

This document is both the **hub manual** and a **knowledge base** about the Magis buses. Everything here was decoded
on a live installation: by sniffing, register scanning, cross-checking the three buses against each other and against
the Immergas and Samsung manuals. Immergas does not publish register maps for these buses.

> **Test installation:** Immergas **Magis Combo 9 Plus V2** (board fw 6.0) + outdoor unit **Audax Pro 9 V2**
> (Samsung EHS, MIM-B19N board), one zone, physical Dominus. Parts of T-/T+ and D+/D- were also confirmed by users on
> **Magis Pro V2**. Magis Pro has no gas boiler, so the gas-generator entities have no values there.

---

## Contents

1. [Quick start](#1-quick-start)
2. [Hardware and wiring](#2-hardware-and-wiring)
3. [Config architecture](#3-config-architecture)
4. [Hub entities (Immergas Hub)](#4-hub-entities-immergas-hub)
5. [D+/D- bus (panel and Dominus emulator)](#5-dd--bus-panel-and-dominus-emulator)
6. [T-/T+ bus (Modbus BMS)](#6-t-t-bus-modbus-bms)
7. [F1/F2 bus (Samsung NASA)](#7-f1f2-bus-samsung-nasa)
8. [One quantity on three buses](#8-one-quantity-on-three-buses)
9. [Installation knowledge: cross-cutting topics](#9-installation-knowledge-cross-cutting-topics)
10. [Duplicate entities: DD > TT > FF](#10-duplicate-entities-dd--tt--ff)
11. [Configuration (substitutions)](#11-configuration-substitutions)
12. [Updates and versions](#12-updates-and-versions)
13. [Troubleshooting](#13-troubleshooting)
14. [Not decoded yet — help welcome](#14-not-decoded-yet--help-welcome)
15. [Detailed documentation](#15-detailed-documentation)
17. [Dashboard](#17-dashboard)

---

## 1. Quick start

Installation step by step is in the main [README](../README.md#installation). After flashing, check in Home Assistant:

- *Immergas DD - Connection Modbus* = connected, *Immergas DD - Connection Panel Zone 1* = connected;
- *Immergas FF - NASA RX Frames* keeps growing, *NASA Read Timeouts* = 0;
- the *Immergas TT - …* entities have values and the BMS icon is lit on the boiler display.

Leave only the hub on each bus: disconnect old ESP controllers, sniffers and other masters. If you do **not** have a
physical Dominus on D+/D-, swap the emulation settings (chapter [5.3](#53-emulation-panel-or-dominus)).

Entity names in this document are the English names (language files `packages/lang/*_en.yaml`). Languages: `cs`, `de`,
`en`, `es`, `fr`, `hu`, `it`, `nl`, `pl`, `pt`, `sk` for the hub, DD and TT; F1/F2 has `en` / `pl` – use `f1f2_en.yaml`
with the other languages.

---

## 2. Hardware and wiring

### 2.1 Parts list

| Part | Model | Notes |
|---|---|---|
| Microcontroller | **M5Stack AtomS3 Lite** (ESP32-S3) | 3 hardware UARTs, native USB for logs |
| Port base | **M5Stack ATOMIC PortABC Extension Base** (A130) | 3 Grove sockets: A, B, C. Passive: only a TVS diode to ground on each line |
| RS485 ×3 | **M5Stack Isolated RS485 Unit** (U094, CA-IS3082W) | galvanic isolation, **automatic direction** (no DE pin); termination = a 120 Ω resistor in the A-B terminals |

### 2.2 Sockets and pins

| Socket | Bus | ESP RX (white) | ESP TX (yellow) | Frame | 120 Ω termination |
|---|---|---|---|---|---|
| PortABC **Port A** | D+/D- | G39 | G38 | 9600 8E1 | **ON** |
| PortABC **Port B** | F1/F2 | G8 | G7 | 9600 8E1 | OFF |
| PortABC **Port C** | T-/T+ | G6 | G5 | 9600, boiler 8N2, hub 8N1 | OFF |
| AtomS3 bottom Grove (next to USB-C) | **free** | G1 | G2 | — | — |

### 2.3 Rules without which nothing works

- **White Grove wire = ESP RX.** White is the data output of the RS485 unit (verified on all four sockets). On the
  PortABC sticker for ATOMS3, white is the **second** pin of the port: A 39, B 8, C 6. Yellow is the first: A 38, B 7,
  C 5. On the AtomS3 bottom Grove, white = G1, yellow = G2.
  - Symptom of a swapped map: **0 frames received** or **only garbage** (thousands of CRC errors) while the bus is
    working.
- **The I2C / GPIO / UART labels on the PortABC ports are only default roles.** The ESP32-S3 routes a UART to any pins.
- **Three UARTs, no conflict.** Each bus has its own hardware UART. The logger runs over native USB
  (`hardware_uart: USB_SERIAL_JTAG`), so it takes no UART.
- **No DE pin.** The isolated unit switches between transmit and receive by itself. The DD and TT packages contain a
  `flow_control_pin` and the hub removes it (`!remove`). So the hub works **only with isolated auto-direction units**.
  An RS485 unit with a DE pin needs `flow_control_pin` restored.
- **T-/T+: hub on 1 stop bit.** The boiler transmits 8N2. With the hub UART set to 8N2 the ESP32-S3 corrupted the reply
  from the second byte on, deterministically (always `0B 20 00 20 D1` instead of `0B 03 02 00 00 20 45`), regardless of
  termination and polarity. An 8N1 receiver reads 8N2 frames correctly because the second stop bit is just idle time
  for it, and the boiler accepts 8N1 frames.
- **120 Ω termination only at line ends.** On D+/D- the boiler provides biasing but no termination. Without it the
  emulator "disappears" from the bus (E121). On F1/F2 and T-/T+ the hub sits in the middle of the line, so termination
  OFF.
- **A/B polarity.** D+ → A, D- → B; F1 → A, F2 → B; T- → A, T+ → B. If a bus is silent or gives CRC errors, swap the
  wires. On T-/T+ the **BMS icon** on the boiler display confirms correct polarity. With the wrong polarity not a
  single byte arrives.
- **One device per bus and address.** Two masters on T-/T+, or two devices answering the same D+/D- address (e.g.
  Dominus emulation + a physical Dominus), collide: tens of thousands of CRC errors, E121 / E142.

### 2.4 Where to connect in the Magis

| Bus | Terminals | Notes |
|---|---|---|
| D+/D- | remote-control terminals (Dominus / zone panel) on the Immergas board | the same cable as the panel; the hub is one more slave |
| F1/F2 | F1/F2 terminals of the **MIM-B19N** board in the Magis box | **the MIM rotary switch must be at 1** (factory 0 = the board stays silent) |
| T+/T- | BMS terminals T+/T- | slave 11, the boiler is a slave, the hub is the master |

### 2.5 Free bottom Grove

The socket next to USB-C is deliberately left free for an extra sensor. Sensible ideas:

- **DS18B20 (1-Wire)** on pipes: gas boiler flow and return (no bus reports the flow on the boiler side), top and
  bottom of the DHW cylinder. 4.7 kΩ pull-up to 3.3 V.
- **Gas meter pulses** (Hall sensor / reed switch under the last drum) would give real gas measurement instead of an
  estimate. Needs a cable to the gas meter.
- A Hall sensor next to the gas pipe **measures nothing**: gas creates no magnetic field.

The ESP32-S3 signal lines are 3.3 V, while the socket provides 5 V power. M5 units are designed for that.

---

## 3. Config architecture

```
examples/immergas-hub.yaml
├── substitutions        pins, name prefixes, temperature sources, currency, heat from 1 m³ of gas
├── device               esp32-s3, logger (USB), api, ota, wifi, web_server
├── external_components  immergas_core, immergas_climate, f1f2_nasa   (components/ of this repo)
└── packages             (packages/ of this repo)
    ├── lang             hub_xx, dd_xx, tt_xx, f1f2_xx
    ├── D+/D-            dd_core, dd_engine, dd_zone1, dd_zones23, dd_dhw, dd_dominus, dd_schedules,
    │                    dd_heat_pump, dd_boiler_info, dd_diagnostics
    ├── T-/T+            tt_core, tt_status, tt_circuit, tt_heat_pump, tt_dhw, tt_heating, tt_integration,
    │                    tt_installer, tt_computed, tt_gas, tt_diagnostics        (tt_scanner optional)
    ├── F1/F2            f1f2_core, f1f2_indoor, f1f2_outdoor, f1f2_info, f1f2_computed, f1f2_diagnostics,
    │                    f1f2_control, f1f2_outing_targets                        (f1f2_fsv, f1f2_ehs_extra optional)
    └── hub              hub_diagnostics, hub_combined, hub_boiler_params, hw_atoms3_portabc
```

- Each bus has its own **prefix** in file names, ids and substitutions (`dd_`, `tt_`, `f1f2_`, `hub_`), so nothing
  clashes.
- **C++ components:** `immergas_core` (arbitration between Home Assistant and the bus, fault texts in 11 languages),
  `immergas_climate` (zone and DHW thermostats), `f1f2_nasa` (Samsung NASA).
- **Entity name prefixes:** `dd_name_prefix: "Immergas DD"`, `tt_name_prefix: "Immergas TT"`,
  `f1f2_name_prefix: "Immergas FF - "`; values computed from several buses use `hub_name_prefix: "Immergas Hub"`.
- `hub_combined` hides the entities that two buses report twice (chapter [10](#10-duplicate-entities-dd--tt--ff)),
  `hw_atoms3_portabc` removes the DE pins and sets 1 stop bit on T-/T+ for the AtomS3 + PortABC hardware.

---

## 4. Hub entities (Immergas Hub)

All are computed in the ESP. They work even when Home Assistant is down and need no templates in HA.

### 4.1 Heat-pump COP

| Entity | Unit | How it is computed |
|---|---|---|
| **Heat-pump heat output** | W | flow **D14** (T-/T+) × (**HP D20 TW2** − **HP D08 TW1**) (D+/D-) × 1.163 W/(l/h·K) |
| **Heat-pump electrical power (buses)** | W | outdoor-unit consumption NASA **0x8413** (F1/F2); fallback: current 0x8217 × voltage 0x82ED |
| **COP** | — | heat / electrical, 1-minute average (6 × 10 s) |
| **Heat energy today** | kWh | integral of heat output since midnight (survives restarts) |
| **COP today** | — | heat energy today / *Immergas FF - Daily Energy Consumed* |
| **Heat-pump Delta T** | K | TW2 − TW1 on the heat-pump exchanger, only while the compressor runs (negative = defrost) |
| **Heat energy total** | kWh | increasing counter for the HA Energy panel and long-term statistics |

- **Temperatures from the heat pump's own sensors** (TW1/TW2, which the boiler sends to the outdoor unit because it has
  no water probes of its own). The gas boiler does not add to them, so the COP measures only the heat pump, also in
  hybrid operation.
- **Flow only from T-/T+.** The Samsung on a Magis does not know the flow (NASA 0x42E9 = no sensor) and D+/D- does not
  carry it.
- **Gates:** COP has a value only while the compressor runs (HP D71 > 0) and readings are sane: flow ≥ 100 l/h,
  ΔT 0–25 K, input ≥ 150 W, COP 0.5–10. Otherwise the entity is empty. Heat output outside operation = 0 W, so energy
  does not grow from water merely circulating.
- Compute monthly and seasonal COP in HA from *Heat energy total* / *Immergas FF - Total Consumed Energy*.
- ⚠️ See [9.5](#95-nasa-electrical-power-scale-vs-an-external-meter): the scale of NASA electrical power is not
  confirmed by an independent meter.

### 4.2 System operating state

**Operating state:** `Defrost` · `Heat pump: space heating / DHW / cooling` · `Gas boiler: space heating / DHW` ·
`Heat pump + boiler: …` · `Idle`.

| Component | Source |
|---|---|
| compressor running | HP D71 > 0 Hz (D+/D-, `0x1E` I11) |
| gas boiler firing | gas-estimate logic from T-/T+ (D99 62, D98 215/236, D99 7, boiler vs heat-pump ΔT) |
| DHW / space heating | **D99** (T-/T+): 61 DHW by heat pump, 62 by gas, 64 by heater; fallback 3-way valve **D22** (3028). With DHW by heat pump D22 stays 0 |
| cooling | outdoor unit state (F1/F2) |
| defrost | F1/F2 (0x402E) |

### 4.3 Compressor

| Entity | Description |
|---|---|
| **Compressor runtime today** | hours of operation since midnight (`duty_time`, survives restarts) |
| **Compressor starts today** | number of starts since midnight, i.e. a measure of short cycling |

At low load (e.g. OAT ~17 °C) a 9 kW compressor **short-cycles in 1.3–3 min cycles** and stays at ~30 Hz, because its
minimum output exceeds the demand. The start count shows it. A hub restart during operation may add one start. Both
counters are reset at midnight by the HA clock.

### 4.4 Heat cost: heat pump or gas

| Entity | Description |
|---|---|
| **Electricity price** (PLN/kWh) | set in HA (configuration), persisted; default 0.984 |
| **Gas price** (PLN/m³) | as above; default 3.86 |
| **Heat cost from heat pump** | electricity price / COP; computed while the compressor runs, shows the last value from operation when idle (survives restarts) |
| **Heat cost from gas** | gas price / 10.6 kWh of heat per m³ (calorific value ~10.9 × efficiency ~0.97) |
| **Heat pump cheaper than gas** | on when heat-pump cost < gas cost |

With the default prices the break-even point is **COP ≈ 2.7**. These entities switch nothing. They help choose the
integration threshold **I10** in the boiler (chapter [9.2](#92-boiler--heat-pump-integration-menu-i)).

### 4.5 Last DHW cycle

A DHW cycle starts at D99 = 61 / 62 / 64 and continues through 44 / 45 (end of DHW, overrun). When it ends the hub
stores (survives restarts):

| Entity | How it is computed |
|---|---|
| **Last DHW cycle: source** | heat pump / gas boiler / heat pump + boiler |
| **…: electrical energy** | increase of *Immergas FF - Total Consumed Energy* |
| **…: heat (flow)** | increase of *Heat energy total* (D14 × heat-pump ΔT) |
| **…: heat (cylinder)** | capacity × 1.163 × (max D03 − D03 at start) / 1000 |
| **…: COP (flow / cylinder)** | heat / electricity |
| **…: duration, cost, cost from gas** | electricity cost of the cycle and the cost of the same heat from gas |
| **DHW cylinder capacity** | configuration in HA, default 286 L |

The cylinder method misses heat drawn off during the cycle (hot-water use); the flow method includes it. The truth is
usually in between.

### 4.6 Device diagnostics

`Status`, `Restart`, `Uptime`, `WiFi signal`, `Loop time`, `Free memory`, `Reset reason`, `Author`, `GitHub`,
`Project version` (hub config number). The *Immergas DD - Author / GitHub* entities from the DD package are removed
and replaced by the hub entities.

### Configuration entities for the cards (package `hub_boiler_params`)

Settings that none of the buses carries; set them once to the same values as in the boiler menu. They change nothing
in the boiler – the cards use them: *U12 Night function start* / *U13 Night function end*, *P16 Anti-legionella start
time*, *P17 Anti-legionella day*, *P13 Anti-legionella max duration*, *Floor flow limit*, *Cheap tariff hours*
(e.g. `13:00-15:00,22:00-06:00`), *Compare from* and the button *Compare from now* (Calibration card).

### Daily counters and faults

*Burner starts today*, *Burner runtime today*, *Gas today* (Magis Combo, reset at midnight), next to the compressor
counters; *Fault active (all buses)* and *Active fault (description)*: the boiler fault code from D+/D- or T-/T+ (both
read 2100) and the outdoor unit error from F1/F2 in one place.

---

## 5. D+/D- bus (panel and Dominus emulator)

### 5.1 Bus facts

- **Modbus RTU, 9600 8E1**, 2 wires, **120 Ω termination required**.
- **The boiler is the master.** It periodically reads (func 03/04) and writes (func 06/16) to the devices. The hub
  answers as a slave, so it **must answer fast**. Holding the transmitter too long after a reply froze the Dominus
  emulation; a short turnaround back to receive fixed it.

| Address | Device | Device missing |
|---|---|---|
| **0x1E** (30) | outdoor-unit interface board (**Samsung MIM**, "A22" on the diagram, status D62). **A real device: the hub only listens, never transmits to it** | — |
| **0x29** (41) | zone 1 panel (physical or emulated) | **E121** |
| **0x2A / 0x2B** (42/43) | zone 2 / 3 panels (only with A13 > 1) | — |
| **0x33** (51) | **Dominus** (Wi-Fi module) | **E142** |

### 5.2 What you get

- **Emulation** of zone panels 1–3 and/or Dominus: the boiler works without the original devices.
- **Room temperature and humidity from HA:** up to 5 switchable sources per zone (Panel / Basement / Ground floor /
  First floor / House). "Panel" is the live value from a physical panel, if present.
- **Control:** operating mode, zone CH setpoint, offset (U03/U04/U16), heating and cooling Comfort/Eco, set-flow,
  humidity (U07/U08/U18), DHW.
- **Schedules:** 4 shared profile calendars + day → calendar assignment for each zone and DHW. For 2 minutes after
  boot schedule registers are learned from the bus (see [16](#16-hub-config-history), v17).
- **Panel settings:** time programs Manual/Auto (2294), room-probe modulation (6105), dew-point correction (6107).
- **Monitoring:** fault code + **114 fault descriptions**, zone phases, device connections, firmware, boiler clock and
  date, clock drift.
- **Heat-pump data from the MIM board (0x1E):** Hz, current, compressor temperatures, fan, EEV, run flags, stage,
  firmware, **night function U11** and compressor capacity limit.
- **Boiler data:** D04 (calculated flow setpoint), heat-pump and gas-boiler flow/return, active DHW setpoint, DHW
  cylinder, number of zones A13.

### 5.3 Emulation: panel or Dominus

You emulate **either** the Dominus **or** the panels. **Never the same address as a physical device.**

- `Emulate Modbus`: master switch for all D+/D- RX/TX.
- `Emulate Dominus` (0x33) and `Emulate Panel Zone 1/2/3` (0x29/0x2A/0x2B) are mutually exclusive.
- **Safety interlock:** emulation of an address cannot be enabled if a physical device answered on it in the last 30 s.

| Installation | Setting |
|---|---|
| **Physical Dominus present** (this installation) | emulate **Panel Zone 1**, Dominus off |
| **No Dominus** | emulate **Dominus** (takes over mode and settings) |

In the hub: `Emulate Dominus` → `restore_mode: ALWAYS_OFF`, `Emulate Panel Zone 1` → `RESTORE_DEFAULT_ON`. The DD
package does the opposite by default. Its interlock only works after hearing the physical device, and right after boot
the hub has not heard anyone yet. The default would therefore put the emulation on top of the physical Dominus:
~109 k CRC errors in 13 minutes and E121.

> **"Connection Panel Zone 1 = online" does not mean the boiler accepted the replies.** It only says the hub
> answered. When E121 is shown, check *Connection Modbus* and the CRC error counter.

### 5.4 Key registers

Temperatures ×0.1 °C. Direction: **W** = boiler writes to the device, **R** = boiler reads from the device, **I** =
input register (func 04).

**Panel 0x29 and Dominus 0x33 (what the panel sees and sets):**

| Reg | Code | Description | Notes |
|---|---|---|---|
| 2000 | — | operating mode: 0 standby, 1 summer/DHW, 2 cooling, 3 winter CH+DHW | RW |
| 2001 | D09 | flags: bit0 DHW request pending (~9 min before the cycle), bit2 active fault, bit3 heat-pump module present | W |
| 2005 / 2006 | D41 | room temperature / humidity (the only panel values used for control) | R |
| 2010 | — | zone phase: bit2 manual, bit3 heating request, bit6 comfort, bit7 eco; 1 = venting U50 | W |
| 2015 / 2016 / 2017 | U03 | zone 1 setpoint / max / offset | RW |
| 2090 | — | time program state: 4 manual, 64 auto-comfort, 128 auto-eco | W |
| 2095 | D05 | DHW setpoint | RW |
| 2100 / 2101 | — | fault code (0 none, e.g. 121, 142, 193) / reset | W |
| 2210–2216 | U07 | heating and cooling Comfort/Eco, humidity | RW |
| 2217 | — | **set-flow — read only from the Dominus (0x33)**, the panel cannot change it | RW |
| 2294 / 6105 / 6107 | — | auto time programs / probe modulation / dew-point correction | R |
| 2300 | D140–D142 | boiler clock [day 3 b][hour 5 b][minute 8 b], set with U21–U26 | W |
| 2302 / 2303 | D143–D145 | date: day.month / year | W |
| 2310–2347 | — | 4 profile calendars (4 slots, high byte = hour, low = minute) | RW |
| 2410–2416 / 2490–2496 | — | day → calendar: zone 1 / DHW (zones 2, 3: 2420…, 2430…) | RW |
| 3002 | D06 | outdoor temperature **after the P07 correction** | W |
| 3003 | D04 | **calculated flow setpoint** (curve + U03; 0 without demand) | W |
| 3011 / 3012 | D20 / D08 | main generator (heat pump): flow / return | W |
| 3013 / 3014 | D01 / — | auxiliary generator (gas boiler): flow / return | W |
| 3015 | D05 | **active** DHW setpoint (e.g. 60 °C during anti-legionella) | W |
| 3016 | D03 | DHW cylinder temperature | W |
| 3031 / 3042 | D91 | boiler firmware (600 = 6.00) / panel (201 = 2.01) | W / R |
| 4199 (0x33) | A13 | number of zones | W |
| 6102 | A31 | zone 1 room thermostat: RPT = 0, RP = 2. **The boiler does not read it**, so it cannot be set from the bus | W |
| 6150 | A11 | heat-pump module present (A11 = OFF → 0, the boiler stops polling 0x1E) | W |

When the panel answers -1 (0xFFFF, "not set", like a fresh panel) for a schedule register, the boiler immediately
writes its stored schedule to the panel. The hub uses this after boot to learn the real schedule instead of pushing
its defaults.

**MIM board 0x1E (heat pump):**

| Reg | Code | Description |
|---|---|---|
| W0 | — | heat-pump run request (0/1) |
| R1 / I10 | — | water setpoint for the heat pump (= D04; 5.0 °C without demand; 65.0 for DHW by heat pump) |
| **W2** (+ I12, R2) | **U11** | **night function: 30 = compressor capacity limit 30 %**, 0 = none; only within the U12–U13 window |
| I3 / I4 / I5 / I6 | D73 / D74 / D79 / D72 | discharge / evaporator / outdoor-unit probe (raw, without P07) / compressor body |
| I11 | D71 | compressor frequency (Hz) |
| I13 / I14 / I16 | D75 / D76 / D77 | compressor current (×0.1 A) / target fan speed / EEV (0–2000) |
| I17 | — | target discharge temperature (61–70 for DHW; up to 80–90 for DHW by heat pump) |
| I19 | D80? | stage: 1 idle, 2 start, 3 running |
| I22–I29 | D120–D135 | firmware: ODU board, inverter, inverter EEPROM, MIM |
| I36 / I38 / I40 | — | flags: compressor running / fan running / request accepted |
| W20 / W21 / W22 | D08 / D20 / D24 | **TW1 return / TW2 flow / liquid refrigerant** — the boiler sends them to the heat pump (the outdoor unit has no water probes) |

0x1E has **no** actual fan speed, power or DC bus voltage. Those are only on F1/F2.

Full map with confidence and direction for every register: [docs/dd-register-map.md](dd-register-map.md).

### 5.5 Heating curve → D04 → heat-pump setpoint

Verified with a forced test (U03 changes):

```
D04 = R05 + (R03 − T_out) / (R03 − R02) × (R04 − R05) + U03,   clamped to [R05, R04]
T_out = 0x1E I5 (outdoor-unit probe)
```

Example: R02 = −12, R03 = 20, R05 = 24, R04 = 35, T_out = 15.5 °C → U03 = 0 gives **25.5 °C**, U03 = +4 gives **29.5**,
U03 = −2 gives 23.5 → clamped to **24.0** (R05). **U03 shifts the curve 1:1.** D04 goes as the water setpoint to the heat
pump (0x1E R1/I10) and to the Samsung (NASA 0x4247).

### 5.6 What D+/D- does not carry

- Integration parameters I01–I10, A05, A12, A18, P07–P24, T02–T23, U11 and the service menu M **do not change D+/D-
  registers**. Exceptions: E193 in menu M (2001 bit2 + 2100 = 193) and 3002 after a P07 change.
- **Anti-legionella P15** (P13 time, P16 hour, P17 day) is not transmitted. Only the effect is visible: the active DHW
  setpoint 3015 rises for the cycle. The emulator must not adopt it as the user setpoint, or it would lock DHW at
  60 °C.
- Local panel settings (frost protection temperature, panel antibacterial cycle, dehumidification off, minimum cooling
  setpoint, holiday program) do not reach the bus.

---

## 6. T-/T+ bus (Modbus BMS)

### 6.1 Bus facts

- **Modbus RTU, slave 11, 9600 8N2** (Immergas manual). 8N1 receivers also work, and the hub **must** receive 8N1
  (chapter [2.3](#23-rules-without-which-nothing-works)). The hub is the master.
- The boiler answers **only function 0x03**. 0x01, 0x02 and 0x04 → "illegal function" exception. Writes: 0x06.
- **Banks:** 2xxx configuration/control, 3xxx sensors, 4xxx heat pump and refrigerant, 6xxx parameters/states, 44xx
  menus I/T/P, 65xx menu D readings. Scanned 0–19999: **exactly 60 registers**, nothing above 6510.
- **No Victrix / Magis M TOP BMS interface:** 256 and input registers do not exist, 512 is read-only, 61440–61442 give
  an exception. **There is no BMS heat request and no BMS quiet mode.**
- The installer PIN **does not unlock** more registers. Curve points (R02/R03) are not on this bus.
- Entering menu **M** sets **E193** (test mode) in 2100.
- Probes that are not fitted read **−32768** (0x8000), e.g. 3029 on a Magis Pro without a boiler. Entities map this to
  *unknown*.
- The bus **cannot be sniffed**: the boiler is a slave and stays silent without requests, so the map was made with a
  scanner.

### 6.2 Register map (all known)

| Reg | Code | Description | Scale |
|---|---|---|---|
| 512 | — | read-only on Magis V2 (always 0) | — |
| 2000 | — | operating mode (0 standby, 1 summer/DHW, 2 cooling, 3 winter) | RW |
| 2010 | — | zone 1 thermostat / heating request (bit0), see [6.4](#64-t-t-pitfalls) | RW |
| 2095 | D05 | DHW setpoint | ×0.1 °C, RW |
| 2100 | — | fault code | R |
| 3000 | D20 | system flow | ×0.1 °C |
| 3001 | D08 | water return from the heat pump | ×0.1 °C |
| 3002 | D06 | outdoor temperature | ×0.1 °C |
| 3003 | D04 | calculated flow setpoint (0 = no demand) | ×0.1 °C |
| 3016 | D03 | DHW cylinder | ×0.1 °C |
| 3027 | — | heat pump excluded: 1 = only the boiler heats (outdoor temp. < I10, D99 7) | 0/1 |
| 3028 | D22 | 3-way valve (1 = DHW, 0 = CH) | 0/1 |
| 3029 | — | auxiliary generator (gas boiler) flow; −32768 without a boiler | ×0.1 °C |
| 3054 | D14 | **circulation pump flow** (0 when stopped) | l/h |
| 3056 | D24 | refrigerant in the cooling circuit | ×0.1 °C |
| 4011 | — | DHW temperature from BMS (write, DHW boost) | RW |
| 4201 | R01 | outdoor temperature probe: OFF (fixed setpoint) / OU (outdoor-unit probe) / IU | code, RW |
| 4202 | A11 | outdoor unit model (9 = 9 kW) | code |
| 4350 / 4351 | R05 / R04 | zone 1 min. / max. CH | °C, RW |
| 4356 / 4357 | R13 / R12 | zone 1 max. / min. cooling | °C, RW |
| 4402 | T02 | DHW thermostat (switch-on differential) | °C, RW |
| 4403 | P15 | anti-legionella | 0/1, RW |
| 4411 | T04 | not described in the manuals | RW |
| 4451 | I05 | integration activation mode (0 AU, 1 MA) | RW |
| 4452 | I10 | outdoor temperature activating CH integration (below it only the boiler heats) | °C, signed byte, RW |
| 4453 / 4454 | I02 / I01 | CH / DHW integration (1 = AL, 0 = OFF) | 0/1, RW |
| 4455 | I09 | DHW activation temperature | °C, signed byte (low byte), RW |
| 4468 / 4469 | I04 / I03 | max. waiting time CH / DHW | min, RW |
| 4479 | I07 | activation band | °C, RW |
| 4551 | D74 | evaporator (= NASA 0x8218) | ×0.1 °C signed |
| 4554 | D73 | discharge (= NASA 0x820A) | ×0.1 °C |
| 4557 | D77 | EEV (2000 = open at rest) | 0–2000 |
| 4558 | D71 | compressor frequency | Hz |
| 4585 | D72 | compressor temperature (= NASA 0x8280) | ×0.1 °C |
| 4586 | — | compressor power step 0–6 (25 Hz = 1 … 61 = 6; 7 seen with DHW by heat pump) | step |
| 4587 | D76 | fan speed (candidate) | rpm |
| 6000 | T05 | CH ignition timer (minimum pause between starts) | min, RW |
| 6002 | T07 | room thermostat (TA) request delay | 1 = 10 s, RW |
| 6010 / 6011 | A03 / A04 | circulation pump min. / max. speed | %, RW |
| 6013 | A12 | venting at power-on | 0/1, RW |
| 6500 / 6501 / 6502 | D97 / D98 / D99 | states: heat pump / generator / system — see below | code |
| 6505 | D91 | P.C.B. firmware (60 = 6.0) | ×0.1 |
| 6506 / 6507 | D140 / D141 | clock hour / minute (read-only) | — |
| 6510 | D61 | system model: 1 MP, 2 MCI, 3 MCP, 4 MPH, 5 MCH, 6 MCPH | code |

All RW registers in banks 44xx/60xx were verified both ways: a change on the boiler moves the register, a write from HA
changes the value on the boiler.

### 6.3 State codes D97 / D98 / D99

| Register | Codes |
|---|---|
| **D97** heat-pump request state | 300 standby · 332 / 390 heating · 352 heating (thermostat request) · 322 DHW by heat pump (fw 4.3) · 342 cooling request · 336 heat pump excluded by the I10 threshold (boiler heats) |
| **D98** boiler request state | 200 standby · 215 heating with boiler (cycle) · 232 heating · 252 heating (thermostat request, **boiler not firing** — the heat pump heats) · 236 heating with boiler only |
| **D99** system state | 0 / 82 standby · 1 cooling request · 6 heating request · 7 heating with boiler only (I10) · 8 heating cycle · 41 pump overrun after CH (~3 min) · 44 end of DHW by heat pump (~3 min) · 45 end of DHW (~1 min) · **61 DHW by heat pump** · **62 DHW by gas boiler** · 64 DHW by heater |

### 6.4 T-/T+ pitfalls

- **Operating mode: whoever keeps forcing it wins.** The emulated panel on D+/D- keeps forcing its mode and reverts a
  2000 write from T-/T+. That is why in the hub **mode and DHW are controlled only by DD**, and the TT entities are
  hidden. With a *real* Dominus (fw 6.0) it is the other way round: the boiler keeps the BMS mode and reverts keypad
  changes.
- **Thermostat contact 40-1/41 needs a zone 1 panel on D+/D-.** On fw 6.0 with an active BMS master, the thermostat
  contact starts heating only when a zone 1 panel is on D+/D- (physical with A31 = RPT, or emulated). Register 2010 does
  not help (fw 4.3 and 6.0). Reports that 2010 works come from fw 8.3+.
- **Settings not visible on T-/T+:** I08, P07 (but D06 is already corrected), P11, P13, P21, P23, P24, T09, T23,
  **U11**, A05, A18, A31, A41, menu M (M13, M15–M17).

### 6.5 Estimated gas use

The boiler does not report gas use, so the `tt_gas` package computes **boiler run time × average m³/h**, separately for
CH and DHW.

- **When it counts:** D99 62 (DHW by gas), D98 215 / 236 or D99 7 (CH by boiler). With D99 6/8 it also counts when the
  boiler flow is ≥ 8 K above the heat-pump return. Normal heat-pump heating (D98 252) is not counted.
- **Calibration:** read the gas meter at the start and end of a week, divide the real m³ by the increase of *Gas
  estimated consumption* and multiply both rates by that factor.
- *Gas estimated consumption* is a `total_increasing` m³ counter for the HA Energy panel.

---

## 7. F1/F2 bus (Samsung NASA)

### 7.1 Bus facts

- **9600 8E1**, **Samsung NASA** protocol: device broadcasts + requests/replies.
- **The rotary switch on the MIM-B19N must be at 1** (factory 0, the board stays silent).

| Address | Device |
|---|---|
| `10.00.00` | outdoor unit (Samsung EHS) |
| `20.00.01` | indoor unit = the MIM-B19N board in the Magis (last byte = switch position) |
| `80.FF.00` | hub (sends only READ requests) |

The component detects the devices on the bus by itself (entity *NASA Devices*) and after 60 s warns in
the log if the address in the config does not match.

### 7.2 What you get

Temperatures (flow, return, water setpoint, outdoor, discharge, head, exchanger, refrigerant, IPM) · compressor
(actual / ordered / target Hz, **frequency limit**, start stage, restart lock) · **current, power and energy
consumed**, mains, DC bus and pump voltages · fan (target and actual), EEV, 4-way and hot-gas valves, drip-tray heater,
**defrost and its stage** · unit modes and states · **night function U11** (0x428D, 0x80B1) and night capacity limit % ·
**Samsung fault codes with descriptions** · ODU / EEPROM / inverter / MIM firmware · optionally **94 FSV parameters** ·
unknown PDUs as `RAW` + sniffer.

Details: [docs/ff-nasa-pdu-map.md](ff-nasa-pdu-map.md) (all PDUs),
[docs/ff-fsv-map.md](ff-fsv-map.md) (FSV), [docs/ff-samsung-error-codes.md](ff-samsung-error-codes.md).

### 7.3 Who is in charge: Immergas, not Samsung

On F1/F2 **the Immergas controller runs the loop**. It computes the water setpoint from its own curve (R02–R05 + U03)
and drives the Samsung through the MIM. Immergas decides **what and when** the heat pump does (setpoints, modes,
heating request, even quiet mode U11). The outdoor unit decides **how** (Hz, fan, EEV, defrost).

- The Samsung on a Magis is "blind" to the DHW cylinder (0x4237 = 0) and the circulation pump (0x4089 = OFF despite
  flow). It does not know the flow either (0x42E9 = no sensor), and power and energy produced (0x4426/0x4427) are empty.
- Most FSVs are overridden or inactive. The FSV water curve loses to the Immergas curve.
- **The DHW ceiling with the heat pump (~50 °C) is set by Immergas.** FSV 3021 written to 45 did not stop heating, and
  FR does not limit Hz during DHW.

Register split: [docs/ff-what-immergas-controls.md](ff-what-immergas-controls.md) and
[docs/ff-registers-outside-modbus.md](ff-registers-outside-modbus.md).

### 7.4 Control (optional) and safety model

The hub has the `f1f2_control` and `f1f2_outing_targets` packages. Three gates, each requiring the previous one:

1. **NASA connection:** master safety switch. OFF = the hub ignores the bus, all FF entities
   unavailable.
2. **Emulate EHS panel:** active READ requests (FSV). OFF = passive reading only.
3. **Active ODU control:** arms writing, **always off after a restart**.

A write goes out only with all three gates ON **and** a register on the whitelist. A **hard block** in the code rejects
compressor, EEV, protection, flow, unit on/off and operating-mode registers, whatever the YAML says.

| Lever | Register | Result on a Magis |
|---|---|---|
| **FR – limit the compressor** | 0x40A7 | **works:** fixed factory ~50 % (35 → 30 Hz under load), only in CH above ~32 Hz |
| Custom FR ratio (FSV 5051) | 0x42F1 | rejected (stays 0xFFFF) |
| Outing mode + FSV 5011–5019 | 0x406D | the write sticks, but Immergas may override it; no activator |
| Max. flow temp. (FSV 1031) | 0x424E | the write sticks, but the Immergas setpoint 0x4247 overrides it |
| Quiet mode | 0x428D | driven by **Immergas U11**; writes to the ODU are ignored |
| Power peak / Smart Grid | 0x40A4 / 0x411C | need an external signal; do nothing |

**Never write:** compressor frequency (0x8236–0x8239), EEV (0x8229), **the flow sensor 0x42E9** (it feeds the flow
protection; a fake value could run the compressor dry), valves, defrost and ODU protection registers.

Test results: [docs/ff-control-results.md](ff-control-results.md).

---

## 8. One quantity on three buses

The same measurements appear on several buses. This table lets you check one bus against another and pick the best
source.

| Quantity | Code | D+/D- | T-/T+ | F1/F2 (NASA) |
|---|---|---|---|---|
| outdoor temperature | D06 / D79 | 3002 (after P07) / 0x1E I5 (raw) | 3002 | 0x8204, 0x420C |
| flow setpoint | D04 | 3003, 0x1E R1/I10 | 3003 | 0x4247 |
| heat-pump flow (TW2) | D20 | 3011, 0x1E W21 | 3000 (system) | 0x4204, 0x4238 |
| heat-pump return (TW1) | D08 | 3012, 0x1E W20 | 3001 | 0x4236 |
| liquid refrigerant | D24 | 0x1E W22 | 3056 | 0x4205 |
| compressor frequency | D71 | 0x1E I11 | 4558 | 0x8238 |
| compressor temperature | D72 | 0x1E I6 | 4585 | 0x8280 |
| discharge | D73 | 0x1E I3 | 4554 | 0x820A |
| evaporator / outdoor exchanger | D74 | 0x1E I4 | 4551 | 0x8218 |
| compressor current | D75 | 0x1E I13 | — | 0x8217 |
| fan speed | D76 | 0x1E I14 (target) | 4587 | 0x823D target / 0x82D9 actual |
| EEV | D77 | 0x1E I16 | 4557 | 0x8229 |
| DHW cylinder | D03 | 3016 | 3016 | 0x4237 = 0 (unknown to it) |
| 3-way valve | D22 | — | 3028 | 0x4067 |
| flow | D14 | — | **3054** | 0x42E9 = none |
| boiler fault code | — | 2100 | 2100 | — (separate Samsung codes 0x8235) |
| board firmware | D91 | 3031 | 6505 | — |
| boiler clock | D140–D142 | 2300 | 6506/6507 | — |
| compressor running | — | 0x1E I36 | 4586 > 0 | 0x8010 |
| night function | U11 | 0x1E W2 = 30 | **not visible** | 0x8239 = 19, 0x80B1, 0x428D |
| power / energy consumed | — | — | — | 0x8413 / 0x8414 |

---

## 9. Installation knowledge: cross-cutting topics

### 9.1 Night function U11 (quiet mode)

Captured on three buses at once:

- **D+/D-:** at the start of the U12 window the boiler writes **0x1E W2 = 30** (% capacity limit) to the MIM, the MIM
  confirms in I12 and R2. At the end of the window or with U11 OFF: 0.
- **F1/F2:** NASA **0x8239** (upper Hz limit) drops **64 → 19** (30 % × 64). Also 0x428D 0 → 286 (sent by the MIM) and
  **0x80B1 = 1**, i.e. "compressor running under the night limit". The limit kicks in ~50 s after W2 while running, and
  on a fresh start only ~6 min after the start. Removed ~40 s after W2 = 0.
- **T-/T+:** no register changes, only the effect is visible (D71 ~16–18 Hz).
- 0x8239 also has natural values: **95** (idle/start) and **64** (normal operation). Only **19** means U11.
- The native Samsung quiet mode (0x4046) never turns on. **Quiet mode is controlled through U11 in the boiler**; writes
  on F1/F2 are ignored.
- U12/U13 are full hours according to the boiler clock (U21/U22).
- At ~9–10 °C outside the compressor already runs at its minimum, so U11 changes nothing for space heating; it only
  slows DHW by heat pump and may limit capacity in frost.

### 9.2 Boiler / heat-pump integration (menu I)

The integration parameters are on T-/T+ (bank 44xx) and can be written from HA: **I01** (DHW integration), **I02** (CH
integration), **I03/I04** (max. waiting time DHW/CH), **I05** (AU/MA), **I07** (band), **I09** (DHW activation
temperature), **I10** (outdoor temperature threshold, register 4452, signed byte).

According to the Magis manual, with **I05 = MA**: below **I10** only the boiler heats; from I10 to I10+5 the heat pump
heats and gas joins after I04; above that the heat pump heats and gas joins after 2×I04. Example settings of this
installation: I02 = AL, I04 = 60 min, I05 = MA, I10 = −5 °C. Below −5 °C the heat pump really stood still (January,
−8…−10 °C).

**Choosing I10 from COP:** the entities *Heat cost from heat pump / from gas* and *Heat pump cheaper than gas* show at what COP the
heat pump stops paying off (at 0.984 PLN/kWh and 3.86 PLN/m³ it is **COP ≈ 2.7**). Plot COP against outdoor temperature
over one season and set I10 where the COP drops below the threshold.

- **The heat pump can heat DHW** (D99 61, 0x1E W1 = 650, compressor up to ~61 Hz, power step 7, discharge up to 90 °C).
  The DHW ceiling with the heat pump (~50 °C) is set by Immergas. DHW by gas = D99 62. On the test installation DHW by
  heat pump reached COP ~1.3–2 (cylinder 45 → 54 °C, water setpoint 65 °C), so at these prices DHW from gas was cheaper.
- **Emergency "gas only" mode:** A11 = OFF (outdoor unit model = none). CH and DHW then come from the boiler, the boiler
  stops polling 0x1E and 6150 drops to 0.

### 9.3 Boiler and Samsung faults

- **Boiler:** code in 2100 (D+/D- and T-/T+). The hub shows the code and a description (114 descriptions) on the DD
  entities. Common with buses: **E121** (no zone 1 panel), **E142** (no Dominus), **E193** (service menu M).
- **Samsung:** *Immergas FF - Error Code* / *System Error Status* (0x8235) with a description. List:
  [docs/ff-samsung-error-codes.md](ff-samsung-error-codes.md).

### 9.4 COP: which power and which temperatures

| Component | In the hub | Why |
|---|---|---|
| flow | D14 from T-/T+ | the only source (the Samsung does not know the flow) |
| ΔT | TW2 − TW1 (D+/D- 0x1E W21/W20) | sensors on the heat-pump exchanger; the gas boiler does not inflate it |
| electrical power | NASA 0x8413 | active power from the Samsung inverter; current × voltage is apparent power |

Do not compute heat from the *system* D20/D08 (3000/3001 on T-/T+), because with the gas boiler running they include
its heat too.

### 9.5 NASA electrical power scale vs an external meter

In winter 2025/26 NASA energy (0x8414) came out **1.91 × higher** than an external Shelly EM meter on the heat pump
(correlation r = 0.998, i.e. a constant factor). It was not settled which measurement is right. COP according to NASA
(~1.9 at −5 °C, ~2.85 at +5 °C) looks physical, according to the Shelly (3.6–10) hardly plausible, but the Shelly CT
was reversed. Until there is a comparison with the billing meter, treat absolute COP with caution. Relative comparisons
(COP vs temperature, day to day) are reliable.

October 2026 measurement (same Shelly, heat-pump channel): NASA energy = **2.0 ×** Shelly in every period, but the
Shelly shows **negative** power when idle and has 760 kWh of "returned" energy, and the COP from its power at 15 Hz
comes out at 13.6 (above the Carnot limit). So the Shelly measures wrongly (reversed CT or a different phase than its
voltage input). On the other hand, at 61 Hz NASA reports 3.1 kW while the Shelly measures 9.3 A × 224 V = 2.1 kVA, so
NASA may overstate by up to ~1.5 ×. A clamp-meter current reading on the outdoor-unit supply will settle it.

---

## 10. Duplicate entities: DD > TT > FF

When the same quantity comes from several buses, **one** entity stays in Home Assistant, according to the hierarchy
**DD > TT > FF**. The others get `internal: true`. They keep working in the ESP and feed the calculations (COP, gas,
operating state), but do not reach HA.

| Hidden from T-/T+ | Hidden from F1/F2 |
|---|---|
| D06, D03, fault code and description, active fault, D04, D20, D08, Delta T, boiler flow 3029, D71, D72, D73, D74, D24, D77, D91, clock, **operating mode (select)**, **DHW (water_heater)** | outdoor temperature (2×), DHW temperature and setpoint, water setpoint, TW2, flow, return, ΔT, compressor frequency, discharge, head, exchanger, refrigerant, EEV, target fan speed, current, target discharge, compressor running, fan, 3-way valve, firmware (4×), night function U11 (0x80B1, 0x428D) |

- The list is at the end of the YAML (`- id: !extend … internal: true`). To restore an entity, remove its entry.
- Quantities that only look similar stay visible, e.g. *TT - Estimated heat output* (from system temperatures) next to
  *Hub - Heat-pump heat output* (from the heat-pump sensors), or *FF - Night capacity limit* (%) next to *DD - HP U11
  Night function*.

---

## 11. Configuration (substitutions)

| Substitution | Hub default | Meaning |
|---|---|---|
| `hub_project_version` | `"1.0.1"` | hub version, shown as *Immergas Hub - Project version* |
| `hub_name_prefix` | `Immergas Hub` | hub entity name prefix |
| `device_name` / `friendly_name` | `immergas-hub` / `Immergas Hub` | device name (changing it = a new device in HA) |
| `dd_name_prefix`, `tt_name_prefix`, `f1f2_name_prefix` | `Immergas DD`, `Immergas TT`, `Immergas FF - ` | entity name prefixes |
| `dd_uart_rx_pin` / `dd_uart_tx_pin` | GPIO39 / GPIO38 | D+/D-, Port A |
| `f1f2_uart_rx_pin` / `f1f2_uart_tx_pin` | GPIO8 / GPIO7 | F1/F2, Port B |
| `tt_uart_rx_pin` / `tt_uart_tx_pin` | GPIO6 / GPIO5 | T-/T+, Port C |
| `dd_uart_de_pin`, `tt_uart_de_pin` | placeholder text | text only (DE removed) |
| `f1f2_transmit` | `"true"` | READ requests on F1/F2 (FSV); `"false"` = pure listening |
| `dd_temp_src_2…5`, `dd_hum_src_2…5` | your HA sensors | zone 1 temperature/humidity sources (slot 1 = panel) |
| `dd_temp_src_z2_*`, `dd_temp_src_z3_*`, `…hum…` | your HA sensors | zones 2 and 3 |
| `dd_setpoint_step` | `0.5` | zone setpoint step |
| `hub_gas_heat_kwh_per_m3` | `10.6` | usable heat from 1 m³ of gas |
| `hub_currency` | `zł` | currency in the price and cost units (the cards use the same one) |

Any substitution from the packages (e.g. a single entity name `n_dd_…`, `n_tt_…`) can be overridden in the main file.
Language files: `packages/lang/dd_xx`, `tt_xx`, `f1f2_xx`; DD, TT and the hub (`packages/lang/hub_xx.yaml`) have `_cs`, `_de`,
`_en`, `_es`, `_fr`, `_hu`, `_it`, `_nl`, `_pt`, `_sk`, F1/F2 only `_en`. **Changing the
language changes the names, so HA creates new entities.** The hub's own entities take their names and texts from
`packages/lang/hub_xx.yaml` (11 languages). The cards follow the Home Assistant language.

---

## 12. Updates and versions

- Pin the packages and components to a release tag of this repository (`ref:` and `@vX.Y.Z` in the example). A new
  release changes them together.
- **Entity ids in HA come from the name** (and, in HA 2026.6+, possibly from the area). A name change gives a new entity
  and the history stays with the old one. Names used in HA templates are deliberately stable.
- **Changing the language changes the names**, so HA creates new entities.

---

## 13. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| 0 frames or only garbage, CRC counter growing | TX/RX swapped | `*_rx_pin` = white wire (second pin of the port on the sticker) |
| D+/D-: thousands of CRC errors, E121 / E142 | two devices on one address | one emulation per address, old devices disconnected |
| D+/D-: *Connection Panel Zone 1* online, but E121 persists | the hub is not receiving valid frames | check *Connection Modbus* and the CRC counter, then the pins |
| D+/D-: the emulator disappears from the bus after another module is disconnected | no 120 Ω termination | 120 Ω resistor in the A-B terminals of the D+/D- unit |
| T-/T+: BMS icon on, replies cut after 5–6 bytes | hub UART at 8N2 | `stop_bits: 1` (already in the config) |
| T-/T+: zero bytes | reversed T+/T- polarity or wrong pin map | go back to the wiring with the BMS icon; check white = RX |
| T-/T+: corrupted replies | a second master on the bus | disconnect the old BMS device |
| F1/F2: 0 frames | wrong pin map, A/B, MIM switch not at 1 | check one by one; entity *NASA Devices* |
| OTA "successful" but the log shows an old build date | the install did not complete | check "compiled on" in the log, flash again |
| COP empty | compressor stopped or readings outside the gates | normal outside compressor operation |
| DHW heats at night although the DHW schedule is Cal. 3 | a fresh hub (≤ v16) served its default Cal. 1 to the boiler | use v17+ (DD v2.1.1), then set the DHW schedule again |

**Viewing raw bus bytes:** add a `debug:` block with `UARTDebug::log_hex` to the UART and set the logger to DEBUG. This
is how the stop-bit problem on T-/T+ was found:

```yaml
uart:
  - id: !extend tt_uart
    debug:
      direction: BOTH
      dummy_receiver: false
      after:
        timeout: 10ms
      sequence:
        - lambda: UARTDebug::log_hex(direction, bytes, ' ');
```

Sniffers built into the packages: *DD - Bus sniffer* (D+/D- register changes, tag `sniff`) and *FF - NASA Sniffer* (tag
`f1f2_sniff`), both off by default.

---

## 14. Not decoded yet — help welcome

| Bus | Registers |
|---|---|
| D+/D- 0x1E | I15, I20, I37, I44–46, W5 (always 0), R2–R6, R15–R18 (5/30/10/30, maybe screed drying T21–T24); flags I18/I21/I41/I42 as candidates for **D78** (4-way valve) — data from cooling or defrost needed |
| D+/D- 0x29 / 0x33 | 0x29 R 0/1 (233/60), 2103; 0x33 W 2012; 2090: CH or DHW |
| T-/T+ | writable 0/1: 2102, 4449, 4600; always 0: 512, 3061, 4011, 4588, 6014, 6503, 6504 |
| F1/F2 | 0x0402, 0x0411–0x0415, 0x4006, 0x440A, 0x041B, 0x8201, 0x823F, 0x8243, 0x824B, 0x824C, 0x82E1, 0x8417, 0x4604 (as `RAW` in diagnostics); **0x840F** 4096 → 4224 (bit 7) at the end of the first DHW cycle by heat pump and stays — candidate for a "DHW by heat pump" flag |

Most valuable recordings: cooling, defrost, frost, a multi-zone installation, a different board firmware.

---

## 15. Detailed documentation

| File | Contents |
|---|---|
| [docs/dd-register-map.md](dd-register-map.md) | D+/D-: full map of 0x1E / 0x29 / 0x33 / 0x2A–0x2B with confidence and direction |
| [docs/ff-nasa-pdu-map.md](ff-nasa-pdu-map.md) | F1/F2: all NASA PDUs with decoding |
| [docs/ff-fsv-map.md](ff-fsv-map.md) | F1/F2: 94 FSV parameters and their status on a Magis |
| [docs/ff-what-immergas-controls.md](ff-what-immergas-controls.md) | F1/F2: registers driven by Immergas |
| [docs/ff-registers-outside-modbus.md](ff-registers-outside-modbus.md) | F1/F2: registers outside the reach of Immergas Modbus |
| [docs/ff-control-results.md](ff-control-results.md) | F1/F2: write tests, what works, what not to touch |
| [docs/ff-samsung-error-codes.md](ff-samsung-error-codes.md) | Samsung EHS fault codes |

---

## 17. Dashboard

The hub cards build the whole dashboard (`strategy: type: custom:immergas-hub`): see
[cards/README.md](../cards/README.md). The [dashboard/](../dashboard/) folder also has a generator for a dashboard made
of built-in cards only: [dashboard/README.md](../dashboard/README.md).

---

## Disclaimer

A hobby project, not affiliated with or authorised by Immergas or Samsung. The register maps are reverse engineering
for interoperability and private use. Controller emulation and register writes change the behaviour of a heating
appliance — **use at your own risk**. Do not write registers outside the safe lists described here.

## License

See [LICENSE](../LICENSE) and [NOTICE](../NOTICE).
