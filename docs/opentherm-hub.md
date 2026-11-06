# OpenTherm boilers in the hub (immergas_ot)

**English** · [Polski](opentherm-hub.pl.md)

> **Experimental – not tested on a boiler yet.** Written from the OpenTherm 2.2 specification and what the
> [Immergas Dominus integration](https://github.com/jotuera/immergas-dominus/blob/main/docs/opentherm.md) found on
> Immergas boilers. The frame codec is tested on a PC (exact timing, ±10 % bit rate, jitter, spikes, parity).

Immergas boilers without Modbus (VICTRIX ZEUS, EXA, TERA, OMNIA, HERCULES Condensing …) talk OpenTherm to their room
unit (CAR V2, Super Amico) or to the Dominus module. The `immergas_ot` component lets the hub take that place – or sit
in the middle.

## Two modes

| Mode | Wiring | What happens |
|---|---|---|
| **master** (default) | master adapter → boiler | the hub **replaces** the CAR V2 / Super Amico / Dominus: it sends the status (Data-ID 0) with CH / DHW enable, the CH flow setpoint (1) every cycle, the DHW setpoint (56), max. CH (57) and max. modulation (14) again and again, and reads the rest round robin |
| **gateway** | slave adapter ← room unit, master adapter → boiler | the room unit **stays**: every request is passed to the boiler and the answer back; the hub sees all of it, may **override** selected writes (CH setpoint, DHW setpoint, max. modulation, CH / DHW enable), answers the reads the boiler does not know itself and uses those slots for its own reads; when the room unit is silent for 8 s the hub runs the boiler itself (**standalone**) until it is back |

## Hardware

OpenTherm is a 2-wire current / voltage loop – **not** RS485. You need an OpenTherm **master adapter** (e.g. OpenTherm
Adapter, DIYLess Master OpenTherm Shield) and, for the gateway, a **slave adapter** (DIYLess Slave Shield / OpenTherm
Slave Adapter), each on two GPIOs (in / out). Defaults: master on Port C (in GPIO6, out GPIO5), slave on Port B (in GPIO8,
out GPIO7) of an AtomS3 + ATOMIC PortABC. The adapters' logic: output LOW = line active, input HIGH = line active
(`out_active_low: true`, `in_active_low: false`); change them for an adapter that works the other way.

| Boiler family | OpenTherm terminals | Without the room unit |
|---|---|---|
| VICTRIX ZEUS 25, EXA, TERA, OMNIA | 41 / 44 | jumper X40 back on 40-41, power-cycle (E31); TERA: P7 = 2 for a third-party master |
| VICTRIX ZEUS Superior 26 / 32, HERCULES Condensing / Solar 26 | 42 / 43 | X40 back; M3 P33 = ON keeps CH working after E31 |

## Packages

| Package | What it gives |
|---|---|
| `ot_core` | the component (master), boiler connection, frame / error / timeout counters, `ot_status_low_byte` (default **0xCA**, the "Immergas fix") |
| `ot_sensors` | status (fault, CH, DHW, flame, diagnostic), fault flags and code (5), OEM code (115), flow, return, DHW, outdoor, exhaust, modulation, pressure, DHW flow, the setpoints the boiler uses (56 / 57), bounds (48 / 49), burner starts / hours |
| `ot_control` | CH / DHW enable, CH flow setpoint, DHW setpoint, max. CH setpoint, max. modulation |
| `ot_regulator` (master) | weather curve (two points) + a slow room correction from a Home Assistant room temperature, CH on / off with a hysteresis – the regulator the room unit / Dominus would be |
| `ot_gateway` | gateway mode: room unit connection, standalone, what the room unit writes (CH setpoint, room setpoint and temperature, DHW setpoint, its CH / DHW enable), the override switches |
| `lang/ot_en`, `lang/ot_pl` | entity names (`ot_name_prefix`, default "Immergas OT") |

Example: [`examples/immergas-opentherm.yaml`](../examples/immergas-opentherm.yaml).

## How it works

- **Frames**: 1000 bit/s Manchester, 34 bits; sent by a hardware timer (half bits), received by a GPIO interrupt and
  decoded by the timing of the mid-bit edges (bit rate off by up to ~20 % still decodes, spikes under 100 µs ignored).
- **Master cycle** (about 3 frames a second, at least 100 ms apart): status → CH setpoint → a due write → a read.
  An ID the boiler answers UNKNOWN-DATAID / DATA-INVALID is skipped for an hour; its sensor shows unknown.
- **Writes repeat** – every OpenTherm master keeps sending its values (that is also why a value written past the CAR
  V2 does not stay); CH setpoint every cycle, DHW setpoint every 30 s, max. CH / modulation every minute.
- **Gateway timing**: the room unit expects the answer within 800 ms; the hub forwards a request at once and drops one
  older than 650 ms. Immergas boilers answer in a few tens of ms.

**Still to confirm on a boiler:** the adapters' levels with the hub, the 0xCA low byte with each family, how the CAR
V2 reacts to the gateway (it may use Immergas-specific IDs), and E31 when the hub takes over.
