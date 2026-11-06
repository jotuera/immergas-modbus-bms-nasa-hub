# OpenTherm boilers in the hub (immergas_ot)

**English** · [Polski](opentherm-hub.pl.md)

Back to the [protocol overview](../README.md).

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

## Wiring

OpenTherm has no polarity. The master adapter goes on the boiler's OpenTherm terminals (where the CAR V2 / Dominus
was), the slave adapter (gateway) on the room unit's two wires.

| Boiler family | OpenTherm terminals | Without the room unit |
|---|---|---|
| VICTRIX ZEUS 25, EXA, TERA, OMNIA | 41 / 44 | jumper X40 back on 40-41, power-cycle (E31); TERA: P7 = 2 for a third-party master |
| VICTRIX ZEUS Superior 26 / 32, HERCULES Condensing / Solar 26 | 42 / 43 | X40 back; M3 P33 = ON keeps CH working after E31 |

## Installation

> 📄 **Configuration file: [`examples/immergas-opentherm.yaml`](../examples/immergas-opentherm.yaml)**
> ([open on GitHub](https://github.com/jotuera/immergas-modbus-bms-nasa-opentherm-hub/blob/main/examples/immergas-opentherm.yaml) · [download (raw)](https://raw.githubusercontent.com/jotuera/immergas-modbus-bms-nasa-opentherm-hub/main/examples/immergas-opentherm.yaml))

**Before switching to master** remove the room unit (CAR V2 / Super Amico) or disconnect the Dominus from the OpenTherm
terminals, put jumper X40 back on 40-41 and power-cycle the boiler (E31). On the HERCULES / ZEUS Superior 26 / 32
family set M3 P33 = ON first – the boiler then keeps heating even if OpenTherm is lost.

1. **Copy the configuration.** Save [`immergas-opentherm.yaml`](../examples/immergas-opentherm.yaml) into your ESPHome folder (in Home Assistant:
   *ESPHome → New device → Continue → Skip*, then paste its content into the new file).
2. **Add the secrets** it uses to `secrets.yaml`: `wifi_ssid`, `wifi_password`, `immergas_ot_api_key`, `immergas_ot_ota_password`.
3. **Pick what you need** in the `packages:` block at the end of the file:

   ```yaml
   files:
     - packages/lang/ot_en.yaml        # or ot_pl.yaml
     - packages/ot_core.yaml
     - packages/ot_sensors.yaml
     - packages/ot_control.yaml
     - packages/ot_regulator.yaml      # master: weather curve + room correction
     # - packages/ot_gateway.yaml      # gateway: the room unit stays
   ```

   - **Master** (the hub replaces the room unit): keep `ot_regulator` and set `ot_room_entity` to a room temperature
     sensor of Home Assistant (or leave it – the regulator then runs on the curve only).
   - **Gateway** (the room unit stays): uncomment `ot_gateway` and the `ot_room_in_pin` / `ot_room_out_pin`
     substitutions; `ot_regulator` is optional (it sets the values the hub uses while the room unit is silent).
4. **Check the pins** (`substitutions:` at the top) if your board is not an AtomS3 + ATOMIC PortABC.
5. **Flash** the device (USB the first time, then over the air) and **add it in Home Assistant** (*Settings → Devices
   & services* – it is found automatically).
6. **Check the connection:** *Immergas OT - Boiler connection* turns on within a few seconds and *Flow temperature* / *Flame* follow the boiler. *No answer* growing without *Frames OK* = check the adapter wiring and the `in_active_low` / `out_active_low` levels; in the gateway, *Room unit connection* shows the room unit.

## Packages

| Package | What it gives |
|---|---|
| `ot_core` | the component (master), boiler connection, frame / error / timeout counters, `ot_status_low_byte` (default **0xCA**, the "Immergas fix") |
| `ot_sensors` | status (fault, CH, DHW, flame, diagnostic), fault flags and code (5), OEM code (115), flow, return, DHW, outdoor, exhaust, modulation, pressure, DHW flow, the setpoints the boiler uses (56 / 57), bounds (48 / 49), burner starts / hours |
| `ot_control` | CH / DHW enable, CH flow setpoint, DHW setpoint, max. CH setpoint, max. modulation |
| `ot_regulator` (master) | weather curve (two points) + a slow room correction from a Home Assistant room temperature, CH on / off with a hysteresis – the regulator the room unit / Dominus would be |
| `ot_gateway` | gateway mode: room unit connection, standalone, what the room unit writes (CH setpoint, room setpoint and temperature, DHW setpoint, its CH / DHW enable), the override switches |
| `lang/ot_en`, `lang/ot_pl` | entity names (`ot_name_prefix`, default "Immergas OT") |

The configuration file and the steps are in [Installation](#installation).

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

## Knowledge base

- [Immergas Dominus – OpenTherm](https://github.com/jotuera/immergas-dominus/blob/main/docs/opentherm.md): the
  Data-ID map read from Immergas boilers, the Immergas specifics (0xCA, E31, the cyclic DHW write, TSP and fault
  history), replacing the CAR V2, boilers and terminals, the menu profiles of the five boiler families.
- The OpenTherm 2.2 specification (physical layer, frame, Data-IDs).
- Installer manuals of the boilers on immergas.pl (terminals, menu P / t / A / M, E31, P33, TERA P7).
