# MAGIS M heat pumps (Midea M-Thermal) – mt_ packages

**English** · [Polski](magis-m-midea.pl.md)

Back to the [protocol overview](../README.md).

> **Experimental – not tested on a MAGIS M yet.** The packages implement the Midea M-Thermal Modbus protocol the
> MAGIS M is built on. If you have one, please report what you see (see [Collecting logs](collecting-logs.md)).

The Immergas **MAGIS M** (M4 – M30, R32) is a Midea M-Thermal heat pump: wired controller with the H1 / H2 Modbus
port, the T1S / T4 / T5 / IBH / TBH names in the menu. It has nothing to do with the Samsung-based MAGIS PRO / COMBO V2
that the rest of this hub serves. The **MAGIS M TOP** (R290, E-BOX TOP) is different again: its BMS port speaks the
Immergas generator BMS protocol – the `gb_mtop` package, see [Gas boilers over Modbus BMS](gas-boiler-bms.md).

## Hardware

| Part | |
|---|---|
| [M5Stack AtomS3 Lite](https://docs.m5stack.com/en/core/AtomS3%20Lite) + ATOMIC PortABC | ESP32-S3; Port C (RX GPIO6, TX GPIO5) |
| 1× M5Stack Isolated RS485 Unit | galvanic isolation, automatic direction (no DE pin) |

Any ESP32 with an RS485 transceiver works (`mt_uart_rx_pin` / `mt_uart_tx_pin`).

## Wiring

| Hub (RS485) | Wired controller | Notes |
|---|---|---|
| A / B | **H1 / H2** | sources disagree which is A+ – nothing answers: swap them; a 120 Ω resistor between H1 and H2 may be needed |
| GND | **E** | reference |
| – | ~~A / B~~ | **never**: 13.5 V AC supply of the controller |
| – | ~~X / Y~~ | **never**: internal controller ↔ hydro module bus |

The hub is the master, the controller the slave: **9600 baud, 8N1, address 1** (controller menu *FOR SERVICEMAN →
17 HMI ADDRESS*). Only one master on H1 / H2, and the controller has to stay connected – it serves the registers.

## Installation

> 📄 **Configuration file: [`examples/immergas-magis-m.yaml`](../examples/immergas-magis-m.yaml)**
> ([open on GitHub](https://github.com/jotuera/immergas-modbus-bms-nasa-opentherm-hub/blob/main/examples/immergas-magis-m.yaml) · [download (raw)](https://raw.githubusercontent.com/jotuera/immergas-modbus-bms-nasa-opentherm-hub/main/examples/immergas-magis-m.yaml))

1. **Copy the configuration.** Save [`immergas-magis-m.yaml`](../examples/immergas-magis-m.yaml) into your ESPHome folder (in Home Assistant:
   *ESPHome → New device → Continue → Skip*, then paste its content into the new file).
2. **Add the secrets** it uses to `secrets.yaml`: `wifi_ssid`, `wifi_password`, `immergas_magis_m_api_key`, `immergas_magis_m_ota_password`.
3. **Pick what you need** in the `packages:` block at the end of the file:

   ```yaml
   files:
     - packages/lang/mt_en.yaml        # or mt_pl.yaml
     - packages/mt_core.yaml
     - packages/mt_status.yaml
     - packages/mt_sensors.yaml
     - packages/mt_energy.yaml
     - packages/mt_control.yaml
     - packages/mt_params.yaml         # optional: installer parameters, read only
   ```

   - Start with all packages; leave out `mt_control` for a read-only first run.
   - `mt_energy_multiply` (substitution) if the energy counters come out 100× too small.
4. **Check the pins** (`substitutions:` at the top) if your board is not an AtomS3 + ATOMIC PortABC.
5. **Flash** the device (USB the first time, then over the air) and **add it in Home Assistant** (*Settings → Devices
   & services* – it is found automatically).
6. **Check the connection:** *Immergas M - Protocol version* and *Water outlet temperature* get values within a minute. Nothing = swap H1 / H2, check the 120 Ω resistor and the controller address (menu 17).

**Wait for the first readings before changing anything** – the on / off and function switches change single bits of
shared registers and use the last value read.

## Packages

| Package | What it gives |
|---|---|
| `mt_core` | UART / Modbus, *Modbus connection* switch, protocol version (187), the sensor resolution flag (189 bit8: 1 °C or 0.1 °C), the write helper |
| `mt_status` | running mode, current and last three faults, defrost / antifreeze / oil return / thermostat / SG / EVU, heaters IBH1 / IBH2 / TBH, pumps, 3-way valve, alarm, running, software versions |
| `mt_sensors` | compressor and target frequency, fan, expansion valve, water in / out / total, outdoor, room, DHW tank, refrigerant temperatures, pressures, outdoor unit current and voltage, buffer tank, compressor hours, curve flow targets, water flow, heat output |
| `mt_energy` | electric and heat energy counters, heating and electric power, the unit's COP and the hub's own COP now |
| `mt_stats` (optional) | today's heat and electric energy, COP today, compressor starts and runtime today – counted in the hub, reset at midnight (Home Assistant time) |
| `mt_control` | on / off zone 1 / zone 2 / DHW / room control, operating mode (auto / cooling / heating), water setpoints zone 1 / 2, room and DHW setpoints, weather curve on / number, silent, ECO, disinfection, forced DHW / tank heater / backup heater |
| `mt_params` (optional) | read only: setpoint limits, heating outdoor limits, the custom heating curve |
| `lang/mt_en`, `lang/mt_pl` | entity names (`mt_name_prefix`, default "Immergas M") |

The configuration file and the steps are in [Installation](#installation).

## Register map (holding, function 0x03 / 0x06)

| Register | Meaning | Notes |
|---|---|---|
| 0 | on / off: bit0 room control, bit1 zone 1, bit2 DHW, bit3 zone 2 | bit field – the hub changes only its own bit |
| 1 | mode: 1 auto, 2 cooling, 3 heating | |
| 2 | water setpoint: low byte zone 1, high byte zone 2 | in °C, or °C × 2 with the 0.1 °C resolution |
| 3 | room setpoint | °C × 2 |
| 4 | DHW setpoint | °C |
| 5 | functions: bit4 disinfection, bit6 silent, bit10 ECO, bit12 / bit13 weather curve zone 1 / 2 | bit field |
| 6 | curve number: low byte zone 1, high byte zone 2 | 1–9 (9 = custom) |
| 7 / 8 / 9 | forced DHW / tank heater TBH / backup heater IBH | 0 as programmed, 1 on, 2 off |
| 100 / 132 | compressor / target frequency | Hz |
| 101 / 199 | running mode | 199: 0 off, 2 cooling, 3 heating, 5 DHW |
| 102 / 103 | fan speed / expansion valve | rpm / steps |
| 104 / 105 / 110 / 111 | water in / out / total / zone 2 | resolution flag |
| 106 / 108 / 109 / 112 / 113 | T3 coil, discharge, suction, T2 liquid, T2B gas | resolution flag |
| 107 / 114 / 115 | outdoor (T4) / room / DHW tank (T5) | resolution flag |
| 116 / 117 | high / low pressure | kPa (older protocol × 10) |
| 118 / 119 | outdoor unit current / voltage | A / V |
| 120 / 121 | buffer tank top / bottom | |
| 122 / 123 | compressor hours / unit capacity | h / kW |
| 124–127 | current fault, last three faults | code |
| 128 | status bits: 1 defrost, 2 antifreeze, 3 oil return, 4 remote, 6 / 7 thermostat heat / cool, 10 SG, 11 EVU | |
| 129 | outputs: 0 IBH1, 1 IBH2, 2 TBH, 3 internal pump, 4 SV1, 6 outer pump, 12 alarm, 13 running | |
| 130 / 131 | software indoor unit / controller | |
| 135 | inverter module temperature | °C |
| 136 / 137 | flow target from the curve zone 1 / 2 | |
| 138 | water flow | 0.01 m³/h (shown in l/min) |
| 140 | heat output | 0.01 kW |
| 143–144 / 145–146 | electric / heat energy (high, low word) | 0.01 kWh by default (`mt_energy_multiply`) |
| 148 / 150 / 151 | heating power / electric power / COP | 0.01 (protocol V4.6+) |
| 187 / 189 | protocol version / status 2 (bit8 = 0.1 °C resolution) | |
| 201–208 | setpoint limits (cooling, heating, DHW) | read one by one |
| 231 / 232 | heating outdoor max. / min. | |
| 265–268 | custom heating curve: flow cold / warm, outdoor cold / warm | |

**Still to confirm on a MAGIS M:** the H1 / H2 polarity, the energy counter unit, the pressure scale of the protocol
version, whether the setpoints of register 2 follow the resolution flag, and the fault code numbering (shown as a
number). The installer parameters from 209 up are not written on purpose.

## Knowledge base

- The Midea M-Thermal Modbus protocol of the wired controller (KJR-120 family) – the register map above; the protocol
  version (187) and the resolution flag (189) tell which variant a unit has.
- MAGIS M installer manual ST006126a: controller terminals A B X Y E and H1 / H2 / E, menu *FOR SERVICEMAN → 17 HMI
  ADDRESS SET*, parameters T1S / T4 / T5 / IBH / TBH.
- Community projects for Midea M-Thermal clones (used only as a reference for addresses and scales):
  [Mosibi/Midea-heat-pump-ESPHome](https://github.com/Mosibi/Midea-heat-pump-ESPHome), the Home Assistant community
  threads on Immergas Midea clones.
