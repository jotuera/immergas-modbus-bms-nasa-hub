# Immergas Hub cards

**English** · [Polski](README.pl.md)

Lovelace cards for the IMMERGAS Modbus BMS NASA OpenTherm HUB. One JavaScript bundle; the cards appear in
**Add card** like built-in ones and find the hub and its entities by themselves — no YAML, no entity ids.

| Card | Type | What it shows |
|---|---|---|
| Diagram | `custom:immergas-diagram-card` | animated system schematic: outdoor unit (fan, compressor Hz, evaporator, EEV), refrigerant loop, plate heat exchanger, circulator with flow, gas boiler (Combo), 3-way valve, buffer + house, DHW cylinder; active paths glow and flow; stat tiles on top (`stats: false` hides them – the strategy does, the Now card shows the same). Options: `boiler: false` (Magis Pro), `buffer: false` |
| Charts | `custom:immergas-charts-card` | native SVG charts in tabs: **Day** (water and cylinder temperatures + compressor Hz on its own chart with DHW periods shaded), **Week** (hourly mean heat output and input), **Month** (heat and electricity per day + daily COP); crosshair tooltips, legend with current values, colour-blind-safe palette (light/dark) |
| Now | `custom:immergas-now-card` | fault and defrost banners, operating mode, compressor Hz, flow/return, COP now/today, cycle timers (current phase vs. its typical length from history with an estimated end, DHW rhythm with the next expected cycle, night mode elapsed / time left or countdown to start, last-6-h strip of compressor and boiler cycles; hide with `show_timers: false`, night window from `night_start` / `night_stop` like the Operating mode card, otherwise learned from history), outdoor / zone 1 / DHW cylinder / power tiles |
| Setpoints | `custom:immergas-setpoints-card` | two tiles: zone 1 heating and hot water – temperature, state (heating / standby), −/+ setpoint regulator (several taps make one write) and **ECO / COMFORT** profiles: for CH the boiler's zone 1 Comfort / Eco presets (cooling presets in the cooling mode), edited under the gear; for DHW the DD entities `DHW Comfort setpoint` / `DHW Eco setpoint` and the switch `DHW Comfort-Eco by schedule` (DD ≥ 2.4.0, under the gear), on older DD the options `dhw_eco` / `dhw_comfort` – `input_number` helpers or numbers (default 45 / 55 °C); optional humidity `humidity_entity` / `humidity_target` |
| Operating mode | `custom:immergas-mode-card` | mode buttons (tap twice to change), night function U11 and night capacity limit, F1/F2 outing mode and FR compressor limit (hide with `show_f1f2: false`), zone 1 time program buttons **AUTO / MANUAL** (tap twice), toggles room probe modulation / DHW boost / anti-legionella P15 / dew point correction / auto venting A12 (setting, at power-up) / vent now (one-off AP99 cycle, wide row) (tap twice; hide with `show_toggles: false`), hub operating state, compressor starts and runtime, capacity limit (the boiler's program phase – Comfort / Eco – in the AUTO / MANUAL caption), boiler integration (heat pump excluded, I10) and the CH heat source row **AUTO / Boiler heating / Heat pump heating** (force boiler 4449 / I02 OFF; winter only) and the DHW heat source row **AUTO / Boiler / Heat pump** (I01 AL + I03 = `dhw_auto_wait` min, default 15 / I01 AL + I03 = 1 / I01 OFF; summer, cooling and winter), above the night mode, tap twice; hide both with `show_source: false` |
| Heat cost | `custom:immergas-gas-card` | cost of 1 kWh of heat from the heat pump, the electric heater and (Combo) the gas boiler, cheapest-source verdict, prices behind the ⚙ button; **Combo / Pro** views switched in the card (default from the system model D61). Options: `variant: combo / pro`, `heater_efficiency` (default 1.0) |
| Curves | `custom:immergas-curve-card` | tabs **Heating** (R04/R05 + U03 offset) and **Cooling** (R13/R12, dew point band); the **Outing** toggle switches both to the outing curves (FSV 5011–5019); draggable points, outdoor temperature, D04 setpoint and actual flow |
| Water circuit | `custom:immergas-water-card` | heat-pump and boiler flow/return, Delta T, flow rate, thermal lift, 3-way valve |
| Refrigerant circuit | `custom:immergas-refrigerant-card` | compressor, discharge, evaporator, EEV, fan, voltages, unit states and flags (`flags: false` hides the flags) |
| Device states | `custom:immergas-states-card` | on / off flags of the outdoor unit in two rows of five: compressor, fan, run request, defrost, 4-way valve, hot gas, circulation pump, backup heater, DHW heater, base heater |
| Schedule | `custom:immergas-schedule-card` | tabs **CH · Zone 1** / **DHW** and two layouts switched by the button in the card: **calendars** (like the Dominus app: 4 calendars with their time ranges and weekday chips, tap a day to move it, pencil opens the ranges) and **week** (calendar 1–4 per day, one calendar for all days, editor below); ranges ±15 min; comfort/eco or DHW setpoint. Options: `target: co / cwu` (initial tab), `layout: calendars / week` |
| F1/F2 control | `custom:immergas-f1f2-card` | the same outing / FR switches as a separate card (tap twice); with hub v23+ writing is always armed, on older hubs the card shows an Arm button |
| Calibration | `custom:immergas-calibration-card` | grouped table (cycling, how it runs, heating and curve, hot water, circulation pump, boiler integration, cooling, other) covering all Atom parameters plus diagnostics (heat spread between the HA floors, flow–return ΔT, today's COP against a 45 %-of-Carnot model, DHW COP, outing mode vs. vacation, night capacity limit): cycling (CH starts/h, cycle length, starts today, DHW cycles per day – model, measured, what to do) CH setpoint in the rooms (thermostats: model 21 °C, from 23 °C down to 22 °C when the rooms are close, Set changes the thermostats with that target), FR – frequency limit (on with power to spare, off when the rooms lag, CH runs > 70 % or it is cold), anti-legionella P15 (needed with DHW < 55 °C, slot in the cheap tariff), night mode U11 (last night: outdoor temperature, room temperature drop, compressor share – keep for a better COP or switch off on cold nights), CH schedule (MANUAL with room thermostats, else AUTO with Eco ≤ 1 K lower) and DHW schedule (calendar inside the cheaper tariff – option `cheap_hours`, e.g. `"13:00-15:00,22:00-06:00"` for G12), CH and DHW heat source (heat pump / boiler / AUTO from the COP and prices: break-even = electricity price ÷ gas heat cost) and the key parameters (R05, R04, U03, room probe modulation, zone 1 setpoint, T05, T07, D05, T02, I10, floor limit, dew point correction) in three columns: the **model value** for a heat pump with underfloor heating (with the reason), the **current** one and a **recommendation** from the last 24 h (CH starts and cycle length, DHW cycles) and the room thermostats (option `rooms`, otherwise detected), with a **Set** button (tap twice); at the end **optimisation effectiveness**: before / after / change % for cost per degree day, cost of 1 kWh of heat, electricity and gas per degree day, COP, starts/h and cycle length plus an overall score (option `optimized_since` = date of the change, else the last 7 days against the 7 before) |
| Automations | `custom:immergas-automations-card` | heat-pump automations grouped as Control / Warnings / Safety: switch (`input_boolean`), description, when it last fired, live state (e.g. vacation active, starts this hour) and a threshold with −/+; defaults to the `auto_pompa_*` automations, own list in the `items` option; in the strategy at the bottom when the `auto_pompa_*` switches exist or `automations.items` is set |
| Settings | `custom:immergas-settings-card` | discreet, collapsed card: electricity and gas price, DHW cylinder capacity, DHW boost duration, gas-estimate calibration, night-function window U12/U13 (options `night_start` / `night_stop` = input_datetime helpers), fault language; `expanded: true` opens it by default |
| Last DHW cycle | `custom:immergas-dhw-card` | source, duration, electricity, heat (cylinder / flow), COP and cost compared with gas |
| OpenTherm boiler | `custom:immergas-ot-boiler-card` | Immergas Dominus in the OpenTherm mode: what the boiler reports (max. capacity, min. modulation, CH / DHW range, DHW type from the scan, exhaust, fan), burner starts today / in the last hour and burner hours (short cycling in red), the fault flags (Data-ID 5) and the fault history with descriptions, a two-tap **Boiler reset** and the **Read only (remote in charge)** switch (Dominus ≥ 1.6.9) |
| Data-ID map | `custom:immergas-ot-map-card` | Dominus OpenTherm: boiler model, **Scan Data-IDs** (tap twice), supported Data-IDs, the boiler's own parameters (TSP) and the fault history from the scan, **Prepare report** – a link in the HA notifications opens a pre-filled GitHub issue |

Curve options: `r02` / `r03` (outdoor temperature at R04 / R05, default −12 / 20) and `r11` / `r10` (at R13 / R12, default
25 / 35) — these points are not on any bus; `max_floor_entity` (max. floor flow temperature, red band), `dew_point_entity`
(zone dew point, red band in cooling), `tab` (`heat` / `cool` / `outing`, initial tab).

Operating mode options: `night_start` / `night_stop` — an entity (e.g. `input_datetime`) or a literal `"21:00"` with the
night-function window U12 / U13 (not on any bus); the card shows it and warns when U11 does not match it. Likewise `legionella_day`
(`input_select` or a literal: `sun`, `mon`…, `1`–`7` = Mon–Sun, `daily`) and `legionella_time` (`input_datetime` or `"02:00"`)
with the P15 anti-legionella slot set on the boiler, and `legionella_hours` (P13 – max cycle duration in hours, number or
`input_number`, default 3): DAY / START (P16) / STOP boxes in the legionella row (STOP = START + P13), countdown in the Now card, editing in
the Settings card. Set these options on one card of the dashboard – the other cards pick them up. Without them the cards use the hub's own configuration entities (package `hub_boiler_params`: U12/U13, P16/P17/P13, floor flow limit, cheaper tariff hours, compare-from date).

**Whole dashboard in one step (strategy):** create an empty dashboard, open the raw configuration editor and enter

```yaml
strategy:
  type: custom:immergas-hub
```

**Without a hub – Immergas Dominus:** with only the [Immergas Dominus](https://github.com/jotuera/immergas-dominus)
integration (local TCP to the Dominus Wi-Fi module) use `type: custom:immergas-dominus` – a reduced dashboard with Now,
Setpoints, Operating mode, Schedule and Connectivity. The integration ships these cards itself; the cards find its
entities by their keys (no heat-pump data, COP or compressor – those need the hub).

## How entities are found

The cards look for the device that has the entity "Immergas Hub - Operating state" ("Immergas Hub - Stan pracy") and
match every entity by its **original ESPHome name** (in any of the 11 package languages, from the entity registry; matched by the part after the bus prefix, so a custom prefix works too). The device name, an
area prefix in the entity id (e.g. `boiler_room_…`) or a renamed entity in HA do not matter. Users without admin rights
fall back to friendly names. Labels follow the Home Assistant language: Polish, English, Czech, German, Spanish, French, Hungarian, Italian, Dutch, Portuguese or Slovak (others fall back to English). Texts are written as `this.t(polish, english)`; `tools/extract_strings.cjs` collects them, the translations live in `i18n/<lang>.json` and `tools/gen_i18n.py` builds `src/i18n_data.ts`.

Colours use the Catppuccin palette variables when a Catppuccin theme is active, otherwise built-in Catppuccin Mocha
values.

## Install with HACS (recommended)

1. HACS → ⋮ → **Custom repositories** → repository `https://github.com/jotuera/immergas-modbus-bms-nasa-opentherm-hub`,
   type **Dashboard** → Add.
2. Find **Immergas Hub cards** in HACS, open it and press **Download**. HACS adds the dashboard resource by itself
   and shows new releases as updates.
3. Refresh the browser. The cards are under **Add card → Custom: Immergas – …**.

## Install (manual)

1. Download `immergas-hub-cards.js` from the latest [release](https://github.com/jotuera/immergas-modbus-bms-nasa-opentherm-hub/releases/latest)
   (or take `dist/immergas-hub-cards.js` from this folder) and copy it to `/config/www/immergas-hub-cards/`.
2. Settings → Dashboards → ⋮ → Resources → Add resource: `/local/immergas-hub-cards/immergas-hub-cards.js?v=1.0.1`,
   type *JavaScript module*. Bump `?v=` after every update.
3. Refresh the browser. The cards are under **Add card → Custom: Immergas – …**.

## Build

```bash
npm install
npm run build
```

The source is TypeScript + Lit in `src/`; `src/names.ts` maps every entity key to its name in all 11 languages; it is generated by `tools/gen_names.py` from the language files of the packages.
