# MAGIS PRO / COMBO V2 – D+/D- Modbus, T-/T+ BMS, F1/F2 Samsung NASA

**English** · [Polski](magis-pro-combo-v2.pl.md)

Back to the [protocol overview](../README.md). The MAGIS PRO V2 and MAGIS COMBO V2 heat pumps (Samsung EHS outdoor unit) have three buses; one hub device connects all three.

> Built and tested on an Immergas **Magis Combo 9 Plus V2** with the **Audax Pro 9 V2** outdoor unit (Samsung EHS).
> Other Immergas units with the same D+/D-, T-/T+ and F1/F2 buses (Magis Pro V2 and others) are likely to work —
> the hub logs what it sees, so a model that differs can be tuned from the logs.

| Confirmed model | Confirmed by | Buses |
|---|---|---|
| Magis Combo 9 Plus V2 + Audax Pro 9 V2 | author | D+/D-, T-/T+, F1/F2 |
| Magis Hercules Pro 9 | user | D+/D- (Dominus and zone 1 panel emulation, heating and cooling) |

![System diagram](images/en/card-diagram.png)

| Bus | What the hub does there | What you get in Home Assistant |
|---|---|---|
| **D+/D-** (boiler ↔ Dominus / zone panel) | emulates the zone 1 room panel (0x29) next to a real Dominus, or the Dominus itself | operating mode, zone 1–3 climates, room temperature and humidity sources, Comfort / Eco presets, CH and DHW time programs and calendars, DHW Comfort / Eco by schedule, heat-pump state, boiler fault code with its description in 11 languages |
| **T-/T+** (BMS Modbus) | Modbus master, the boiler is slave 11 | installer parameters (curve R04/R05, integration I01–I10, pump speeds A03/A04, anti-legionella P15, venting A12 / U50…), system state D97–D99, gas estimate (Combo), heat-source control |
| **F1/F2** (Samsung NASA, indoor ↔ outdoor unit) | listens to everything, writes only a short whitelist | compressor frequency and limits, discharge / evaporator / liquid line, EEV, fan, currents and voltages, defrost, flags, FSV values; outing mode, compressor frequency limit (FR) and outing targets FSV 5011–5019 |

On top of the three buses the hub computes what none of them shows alone: **COP** (now / today), heat output, the
**operating state**, compressor and burner starts and runtime today, gas used today, the last **DHW cycle** (energy,
heat, COP, cost) and the **cost of 1 kWh of heat** from the heat pump, the gas boiler and the electric heater.

## Hardware

| Part | |
|---|---|
| [M5Stack AtomS3 Lite](https://docs.m5stack.com/en/core/AtomS3%20Lite) | ESP32-S3 |
| M5Stack ATOMIC PortABC base | three Grove ports: A, B, C |
| 3× M5Stack Isolated RS485 Unit | galvanic isolation, automatic direction (no DE pin) |

Also reported working by users: a **Waveshare ESP32-S3-RS485-CAN** (DIN rail) with its own pin settings.

| Port | Bus | GPIO RX / TX | Serial | 120 Ω termination |
|---|---|---|---|---|
| A | D+/D- | 39 / 38 | 9600 8E1 | **ON** |
| B | F1/F2 | 8 / 7 | 9600 8E1 | OFF |
| C | T-/T+ | 6 / 5 | 9600 (the boiler sends 8N2, the hub receives with 1 stop bit) | OFF |

<img src="images/en/wiring.svg" alt="Wiring of the hub to the three buses" width="100%">

## Wiring

### D+/D- (Port A) – boiler ↔ Dominus / zone panel

- **Polarity:** D+ → A, D- → B.
- **120 Ω terminator needed.** The boiler biases this bus but does not terminate it. Put a 120 Ω resistor into the A
  and B screw terminals of the Port A RS485 unit, together with the D+ and D- wires. Without it the hub "disappears"
  from the bus every now and then and the boiler shows **E121**.
- 9600 8E1; the hub emulates the zone 1 panel (0x29) or the Dominus (0x33).

### F1/F2 (Port B) – Samsung NASA, indoor ↔ outdoor unit

- **Polarity:** F1 → A, F2 → B.
- **Termination OFF.** The hub joins the line in the middle, its ends are already terminated.
- 9600 8E1; the hub listens to everything and writes only the outing mode, the compressor limit (FR) and FSV 5011–5019.

### T-/T+ (Port C) – BMS Modbus

- **Polarity:** T- → A, T+ → B; the **BMS icon** on the boiler display confirms the right polarity.
- **Termination OFF.**
- The boiler is slave 11 and sends 8N2; the hub receives with 1 stop bit (the ESP32-S3 UART corrupts 8N2 replies).

### All buses

- A silent bus or CRC errors usually mean swapped wires.
- **White Grove wire = ESP RX.** With RX and TX swapped the hub receives nothing or only garbage.
- **Separate power supply.** Power the AtomS3 from its own USB charger plugged into a mains socket, not from the
  indoor unit's electronics. A supply shared with the unit can disturb the ground of the buses and cause communication
  errors.

More in the [knowledge base, chapter 2](knowledge-base.md#2-hardware-and-wiring).

Other ESP32 boards work too: set the `*_uart_rx_pin` / `*_uart_tx_pin` (and `*_uart_de_pin` for a transceiver with a
direction pin) substitutions and leave out `hw_atoms3_portabc.yaml`.

> ⚠️ The buses are inside the unit and connect to mains-powered electronics. Disconnect the power before you open
> anything, and leave the wiring to someone qualified. Connecting third-party hardware to the unit may affect its
> warranty – check with your installer first. This is an independent project: not made, approved or supported by
> Immergas or Samsung. You use it at your own risk.

## Installation

> 📄 **Configuration file: [`examples/immergas-hub.yaml`](../examples/immergas-hub.yaml)**
> ([open on GitHub](https://github.com/jotuera/immergas-modbus-bms-nasa-opentherm-hub/blob/main/examples/immergas-hub.yaml) · [download (raw)](https://raw.githubusercontent.com/jotuera/immergas-modbus-bms-nasa-opentherm-hub/main/examples/immergas-hub.yaml))

1. Copy [examples/immergas-hub.yaml](../examples/immergas-hub.yaml) to your ESPHome folder and add the secrets it uses
   (`wifi_ssid`, `wifi_password`, `immergas_hub_api_key`, `immergas_hub_ota_password`,
   `immergas_hub_web_username`, `immergas_hub_web_password`).
2. Pick the language of the entity names: `packages/lang/hub_xx`, `dd_xx`, `tt_xx` (cs, de, en, es, fr, hu, it, nl,
   pl, pt, sk) and `f1f2_xx` (en, pl).
3. Leave the example's safe defaults for the first start: the hub only listens on D+/D- and does not write on F1/F2
   (see [First start](#first-start)).
4. Magis Pro (no gas boiler): keep all packages. The cards read the system model (D61) and switch to the Pro view —
   no gas costs, no burner row, no boiler integration in Calibration.
5. Flash, add the device in Home Assistant, install the cards with HACS ([cards/README.md](../cards/README.md)) and create the
   dashboard with the strategy `custom:immergas-hub` (see the [overview](../README.md#dashboard)).

After the first start set once, in the hub's configuration entities, the values that are not on any bus — the same
as in the boiler menu: night function window **U12 / U13**, anti-legionella **P16 / P17 / P13**, floor flow limit,
electricity and gas price, DHW cylinder size and — for the Calibration card — your cheaper tariff hours. The currency
of the prices is the `hub_currency` substitution.

## First start

Go step by step and check the **Connectivity** card after each one:

1. **Listen only.** After flashing, the hub reads all three buses but emulates nothing on D+/D- and does not write on
   F1/F2. In Connectivity, *Modbus*, *BMS* and *NASA* should turn green within a minute or two; *Hub* shows the Wi-Fi
   signal. If a bus stays red, check its wiring (white wire = RX) before going on.
2. **D+/D- emulation.** Switch on the device your bus is missing – *Emulate Panel Zone 1* when a real Dominus is
   connected (as on the test installation), or *Emulate Dominus* when there is none. The tile turns blue
   (*Emulated*) and the boiler starts taking setpoints from Home Assistant. A device that already answers on that
   address blocks the emulation, so the hub never talks over a real panel.
3. **F1/F2 writes.** Only when the readings look right, switch on *Active ODU control* to use the outing mode and the
   compressor limit (FR). It goes off again after a restart; set `f1f2_write_arm_restore: ALWAYS_ON` to keep it on.
4. **Boiler menu values.** Set once the values that no bus carries (night window U12 / U13, anti-legionella
   P16 / P17 / P13, floor limit, prices, cylinder size, tariff hours) – see [Installation](#installation).

## Gas in the Energy dashboard

On a Magis Combo the hub provides **Immergas TT - Gas estimated consumption** (m³, `device_class: gas`,
`state_class: total_increasing`), ready for the Home Assistant Energy dashboard: *Settings → Dashboards → Energy →
Gas consumption → Add gas source* and pick this entity. Home Assistant then shows the boiler's gas use per hour, day
and month next to the heat pump's electricity, and with a gas price also its cost.

The boiler has no gas meter of its own, so the value is an **estimate**: burner run time × consumption per hour, kept
separately for heating and hot water and stored in the hub's flash. Calibrate it once: note your gas meter and the
entity at the start and end of a period (a few days with the boiler running), divide the meter increase by the entity
increase and multiply both *Gas consumption CH / DHW (calibration)* values by that factor. *Gas: reset counter*
starts from zero. On a Magis Pro (no gas boiler) the entity stays at 0 and is not needed.

## How it stays safe

- **F1/F2:** only the outing mode, the compressor frequency limit and the outing targets FSV 5011–5019 are ever
  written. Everything else on the NASA bus is read-only.
- **D+/D-:** a value set in Home Assistant and a change made on the panel or in the Dominus app are arbitrated, so the
  boiler gets one consistent value; the emulation keeps serving the boiler when Home Assistant or Wi-Fi is down.
- Every switch on the cards that changes the boiler needs **two taps**.

## Help map more registers

The `hub_busmap.yaml` package collects everything the hub sees that no entity describes yet: D+/D- (every register
the boiler reads or writes), T-/T+ (the results of the PDU scanner, `tt_scanner.yaml`) and F1/F2 (every NASA message),
with the last, min and max value and how often it changed. The **Bus map** card shows the counts; type the **boiler and
heat pump model**, press **Prepare report** and the card builds a link to a **pre-filled GitHub issue**. Nothing is
sent automatically: you check it on GitHub and press *Create* – no addresses or passwords are in it. Registers that
stay 0 now may come alive in winter, during a defrost or on another model, so reports from other installations help
the most.

## Calibration

The Calibration card is a heat-pump engineer in a card. It goes through every parameter the hub can see on the three
buses and puts three values side by side:

- **Model** – what a heat pump with underfloor heating should have, with the reason in one line;
- **Now** – what your installation has right now;
- **Recommendation** – what to change, worked out from the last 24 h of history: compressor starts per hour and cycle
  length, DHW cycles per day, COP against a 45 %-of-Carnot model, the room thermostats, the outdoor temperature and
  your electricity and gas prices. A **Set** button (tap twice) applies it.

![Calibration](images/en/card-calibration.png)

Groups: cycling, how it runs (CH and DHW heat source from the break-even COP, CH and DHW schedule in your cheaper
tariff, night function U11, compressor limit FR, anti-legionella P15), heating and curve (R04 / R05 / U03, room probe
modulation, floor limit), hot water, circulation pump (A03 / A04 and the flow–return ΔT), boiler integration
(I01–I10, Magis Combo only), cooling and other. Below the table: **hidden findings** the boiler display never shows
(defrosts, evaporator icing, standby draw, night cylinder losses, the boiler joining in mild weather, high discharge
temperature) and **optimisation effectiveness**: cost per degree day, cost of 1 kWh of heat, electricity and gas per
degree day, COP, starts per hour and cycle length before and after your change, with an overall score. Press
*Compare from now* in the hub after you change something, and the card measures the effect.

## Knowledge base

| Bus | Pages |
|---|---|
| all three | [Knowledge base](knowledge-base.md) – how each bus works, one quantity seen on three buses, installation know-how, troubleshooting, what is not decoded yet; [Collecting logs](collecting-logs.md) |
| D+/D- | [Register map](dd-register-map.md), [full register map](dd-register-map-full.md) |
| T-/T+ | [Knowledge base – BMS](knowledge-base.md), the PDU scanner `tt_scanner.yaml` |
| F1/F2 | [NASA PDU map](ff-nasa-pdu-map.md), [FSV map](ff-fsv-map.md), [Samsung error codes](ff-samsung-error-codes.md), [what Immergas controls](ff-what-immergas-controls.md), [control test results](ff-control-results.md), [registers outside Modbus](ff-registers-outside-modbus.md) |
