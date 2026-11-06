# IMMERGAS Modbus BMS NASA OpenTherm HUB

**English** · [Polski](README.pl.md)

[![Release](https://img.shields.io/github/v/release/jotuera/immergas-modbus-bms-nasa-opentherm-hub?label=release&color=0077b6)](https://github.com/jotuera/immergas-modbus-bms-nasa-opentherm-hub/releases/latest)
[![ESPHome](https://img.shields.io/badge/ESPHome-2026.9%2B-41BDF5?logo=esphome&logoColor=white)](https://esphome.io)
[![Platform](https://img.shields.io/badge/platform-ESP32--S3-41BDF5)](https://docs.m5stack.com/en/core/AtomS3%20Lite)
[![HACS](https://img.shields.io/badge/HACS-Custom-41BDF5)](https://hacs.xyz)
[![License](https://img.shields.io/badge/license-PolyForm%20Noncommercial-blue)](LICENSE)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-jotuera-FFDD00?logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/jotuera)

One ESPHome device that speaks the buses of Immergas heat pumps and boilers – Modbus, BMS, Samsung NASA and
OpenTherm – and brings them to Home Assistant, with a set of Lovelace cards that turn them into one readable dashboard.

## Supported protocols

| Protocol | Immergas units | What the hub does | Status | Page |
|---|---|---|---|---|
| **Modbus D+/D-** (boiler ↔ Dominus / zone panel) | MAGIS PRO V2, MAGIS COMBO V2 | emulates the zone 1 panel or the Dominus: mode, zones, setpoints, time programs, faults | stable | [MAGIS PRO / COMBO V2](docs/magis-pro-combo-v2.md#dd--port-a--boiler--dominus--zone-panel) |
| **BMS Modbus T-/T+** | MAGIS PRO V2, MAGIS COMBO V2 | Modbus master: installer parameters, system state, gas estimate, heat-source control | stable | [MAGIS PRO / COMBO V2](docs/magis-pro-combo-v2.md#t-t-port-c--bms-modbus) |
| **Samsung NASA F1/F2** (indoor ↔ outdoor unit) | MAGIS PRO V2, MAGIS COMBO V2 (Samsung EHS) | listens to everything, writes a short whitelist: compressor, refrigerant circuit, defrost, FSV, outing mode | stable | [MAGIS PRO / COMBO V2](docs/magis-pro-combo-v2.md#f1f2-port-b--samsung-nasa-indoor--outdoor-unit) |
| **OpenTherm** | VICTRIX ZEUS, EXA, TERA, OMNIA, HERCULES Condensing … | **master** instead of the CAR V2 / Dominus, or **gateway** between the room unit and the boiler | experimental | [OpenTherm boilers](docs/opentherm-hub.md) |
| **Generator BMS** (Modbus RTU) | gas boilers VICTRIX ZEUS Superior 25–35, EXTRA, PRO V2; MAGIS M TOP heat pump; IMG-BUS boilers (ZEUS, EXA, TERA, OMNIA, HERCULES …) through the Immergas IU23 interface (hypothesis) | Modbus master: heat request, flow and DHW setpoints, temperatures, faults | experimental | [Gas boilers over Modbus BMS](docs/gas-boiler-bms.md) |
| **Midea M-Thermal Modbus** (H1 / H2) | MAGIS M (R32) | Modbus master: on / off, mode, setpoints, curves, compressor, energy, COP | experimental | [MAGIS M heat pumps](docs/magis-m-midea.md) |

Each page has the hardware, the wiring and the knowledge base of its protocol. On top of the buses the hub computes
what none of them shows alone – COP now and today, heat output, the operating state, starts and runtime, the last DHW
cycle and the cost of 1 kWh of heat from each source.

**Which page is mine?**

- a **MAGIS PRO V2 / COMBO V2** heat pump (Samsung outdoor unit) → [MAGIS PRO / COMBO V2](docs/magis-pro-combo-v2.md)
  – one hub on all three buses, the tested and complete setup;
- a **boiler with a CAR V2 / Super Amico or an OpenTherm Dominus** → [OpenTherm boilers](docs/opentherm-hub.md);
- a **new-platform gas boiler** (ZEUS Superior 25–35, HERCULES 25 / 35, EXTRA) or a **MAGIS M TOP** without a
  Dominus → [Gas boilers over Modbus BMS](docs/gas-boiler-bms.md);
- a **MAGIS M** (Midea-based, wired controller with H1 / H2) → [MAGIS M heat pumps](docs/magis-m-midea.md);
- only an **Immergas Dominus** on the network, no hub hardware → the
  [Immergas Dominus integration](https://github.com/jotuera/immergas-dominus) uses the same cards.

> Built and tested on an Immergas **Magis Combo 9 Plus V2** with the **Audax Pro 9 V2** outdoor unit. The OpenTherm,
> generator BMS and Midea parts follow official specifications and community findings and wait for their first
> installations – reports are welcome ([Collecting logs](docs/collecting-logs.md)).

## Dashboard

The cards find the hub and all its entities by themselves — no entity ids, no YAML. A whole dashboard is one line:

```yaml
strategy:
  type: custom:immergas-hub
```

![System diagram](docs/images/en/card-diagram.png)

| | |
|---|---|
| ![Now](docs/images/en/card-now.png) | ![Operating mode](docs/images/en/card-mode.png) |
| **Now** — state, COP now / today, cycle timers with their typical length, the last 6 h, compressor and burner today | **Operating mode** — modes (tap twice), heat source for CH and DHW, night function, anti-legionella, outing mode, compressor limit, CH and DHW time programs, switches |
| ![Heating curve](docs/images/en/card-curve.png) | ![Schedule](docs/images/en/card-schedule.png) |
| **Heating curve** — draggable points, cooling and outing curves | **Schedule** — the boiler's 4 calendars for CH and DHW, like the Dominus app |
| ![Setpoints](docs/images/en/card-setpoints.png) | ![Heat cost](docs/images/en/card-heat-cost.png) |
| **Setpoints** — zone 1 and hot water with Eco / Comfort | **Heat pump, gas or heater?** — cost of 1 kWh of heat from each source |

![Charts](docs/images/en/card-charts.png)

**Connectivity** – every bus and device the hub talks to, at a glance: green = connected, blue = emulated by the hub.

![Connectivity](docs/images/en/card-links.png)

**Calibration** – a heat-pump engineer in a card: every parameter the hub sees, the model value, your value and a
recommendation from the last 24 h ([more](docs/magis-pro-combo-v2.md#calibration)).

![Calibration](docs/images/en/card-calibration.png)

Further cards: water and refrigerant circuit, device states, last DHW cycle, automations, bus map and the hub
settings. Details, options and the install (HACS or manual) are in [cards/README.md](cards/README.md). Labels follow
the Home Assistant language: Polish, English, Czech, German, Spanish, French, Hungarian, Italian, Dutch, Portuguese,
Slovak.

## Documentation

| | |
|---|---|
| [MAGIS PRO / COMBO V2](docs/magis-pro-combo-v2.md) | D+/D-, T-/T+, F1/F2: hardware, wiring, installation, first start, calibration, gas, register maps |
| [OpenTherm boilers](docs/opentherm-hub.md) | master and gateway, adapters, boiler terminals by family |
| [Gas boilers over Modbus BMS](docs/gas-boiler-bms.md) | SUPERIOR / EXTRA / PRO V2, MAGIS M TOP, register map |
| [MAGIS M heat pumps](docs/magis-m-midea.md) | Midea M-Thermal on H1 / H2, register map |
| [Knowledge base](docs/knowledge-base.md) | how the buses work, installation know-how, troubleshooting |
| [Collecting logs](docs/collecting-logs.md) | a different model or an unknown signal – what to record for an issue |
| [Cards](cards/README.md) | the Lovelace cards, options, install |

> ⚠️ The buses are inside the units and connect to mains-powered electronics. Disconnect the power before you open
> anything, and leave the wiring to someone qualified. Connecting third-party hardware may affect the warranty – check
> with your installer first. This is an independent project: not made, approved or supported by Immergas, Samsung or
> Midea. You use it at your own risk.

## Support

If you find this hub useful, please consider supporting me by buying me a coffee. Thank you!

<a href="https://buymeacoffee.com/jotuera"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-orange.png" alt="Buy Me a Coffee" width="260"></a>

## License

[PolyForm Noncommercial 1.0.0](LICENSE): free for personal and other noncommercial use – at home, for your own
installation, for learning and research. **Commercial use** (installers fitting it for customers, selling devices with
this firmware, building it into a paid product) needs a separate license – please get in touch through GitHub.
See also [NOTICE](NOTICE) and [CONTRIBUTING](CONTRIBUTING.md). Immergas, Samsung and Midea are trademarks of their
owners.
