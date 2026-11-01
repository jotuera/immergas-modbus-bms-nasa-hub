# Samsung NASA PDU map - F1/F2 bus of an Immergas Magis Pro / Combo

Values as seen on a **Magis Combo 9 Plus V2 + Audax Pro 9 V2** (Samsung EHS split, MIM-B19N interface board, rotary switch = 1).
Bus participants: `10.00.00` = outdoor unit, `20.00.01` = indoor unit (the MIM board inside the Magis), `80.FF.00` = this ESP (only when `transmit: true`).

Columns: **key** = `key:` in the config, **dec** = decoding (`temp` = signed int16 x0.1, 65535/65036 = unknown).
Status: decoded unless marked *candidate* / *unknown*. **Help with the unknown ones is welcome** - open an issue with a sniffer log (switch `NASA Sniffer` on, logs tagged `sniff`).

## Sensors

| PDU | src | key | name (EN) | dec | unit | notes |
|---|---|---|---|---|---|---|
| `0x4238` | indoor | `flow_temp_out` | Flow Temp Out | temp | °C |  |
| `0x4236` | indoor | `flow_temp_return` | Flow Temp Return | temp | °C |  |
| `0x4247` | indoor | `water_outlet_target` | Water Outlet Target (active) | temp nan=50 | °C | Active LWT target. On a Magis it is computed by the **Immergas** controller (Termoregulation curve R02-R05 + U03 offset), not by the Samsung FSV water law. Idle placeholder 50 -> unknown. |
| `0x4237` | indoor | `dhw_temperature` | DHW Temperature | temp | °C | 0 on a Magis Combo - the DHW tank sensor is on the Immergas side (see D03 on D+/D- or T-/T+). |
| `0x4235` | indoor | `dhw_target` | DHW Target Temperature | temp | °C |  |
| `0x4203` | indoor | `zone1_room_temp` | Zone 1 Indoor Temp | temp | °C | On a Magis this is **not** a room temperature (Immergas handles rooms). |
| `0x4201` | indoor | `zone1_target` | Zone 1 Target Temp | temp | °C |  |
| `0x42D4` | indoor | `zone2_room_temp` | Zone 2 Indoor Temp | temp | °C |  |
| `0x42D6` | indoor | `zone2_target` | Zone 2 Target Temp | temp | °C |  |
| `0x4205` | indoor | `eva_in_temp` | Indoor EVA In Temperature | temp | °C | Refrigerant liquid side - equals Immergas D24. |
| `0x4204` | indoor | `water_out_tw2` | Indoor Water Out TW2 (4204) | temp | °C |  |
| `0x420C` | indoor | `outdoor_temp_copy` | NASA Indoor PDU 420C Outdoor Temp Copy | temp | °C | Same value as 0x8204, refreshed every ~40 s. Equals Immergas D06/D79. |
| `0x4239` | indoor | `heater_out_temp` | Heater Out Temperature | temp | °C | 0 on a Magis Combo (sensor not fitted). |
| `0x428C` | indoor | `mixing_valve_temp` | Mixing Valve Temperature | temp | °C | 0 on a Magis Combo (sensor not fitted). |
| `0x42E9` | indoor | `flow_rate` | Flow Rate Sensor | raw x0.1 | L/min |  |
| `0x4211` | indoor | `capacity_request` | Indoor Capacity Request | raw /8.6 | kW | raw / 8.6 = kW (77 -> 8.95 kW on a 9 kW unit). |
| `0x4212` | indoor | `capacity_absolute` | Indoor Capacity Absolute | raw /8.6 | kW | raw / 8.6 = kW. |
| `0x4426` | indoor | `power_produced` | Power Produced Last Minute | raw signed nan=4294967295 | W |  |
| `0x4427` | indoor | `energy_produced_total` | Total Produced Energy | raw x0.001 nan=4294967295 | kWh |  |
| `0x4217` | indoor | `indoor_eev` | Indoor EEV Value 1 | raw |  | 0 on a Magis Combo. |
| `0x408A` | indoor | `two_way_valve` | 2-Way Valve | raw |  |  |
| `0x4067` | indoor | `three_way_valve` | 3-Way Valve | raw |  |  |
| `0x4001` | indoor | `operation_mode` | Indoor Operation Mode (4=Heat) | raw |  | 0 Auto, 1 Cool, 2 Dry, 3 Fan, 4 Heat, 21 Cool storage, 24 Hot water. |
| `0x406F` | indoor | `control_reference` | EHS Control Reference (1=Water Out) | raw |  | 0 = room, 1 = water out (then the active setpoint is 0x4247). |
| `0x440E` | indoor | `status_bits_440e` | Indoor Status Bits (440E) | raw |  | *candidate* 0x400 idle, 0x403 while the heat pump has a heat demand (not set by a zone demand alone). |
| `0x0402` | indoor | `raw_0402` | NASA Indoor PDU 0402 LONG RAW | raw |  | *unknown* LVAR_AD_ADDRESS_RMC (address info). |
| `0x0411` | indoor | `raw_0411` | NASA Indoor PDU 0411 LONG RAW | raw |  | *unknown* High 16 bits x0.1 = install limit (cooling upper, 30.0). |
| `0x0412` | indoor | `raw_0412` | NASA Indoor PDU 0412 LONG RAW | raw |  | *unknown* High 16 bits x0.1 (cooling lower, 5.0). |
| `0x0413` | indoor | `raw_0413` | NASA Indoor PDU 0413 LONG RAW | raw |  | *unknown* High 16 bits x0.1 (heating upper, 55.0). |
| `0x0414` | indoor | `raw_0414` | NASA Indoor PDU 0414 LONG RAW | raw |  | *unknown* High 16 bits x0.1 (heating lower, 15.0). Not Immergas R04/R05. |
| `0x0415` | indoor | `raw_0415` | NASA Indoor PDU 0415 LONG RAW | raw |  | *unknown* LVAR_AD_INSTALL_LEVEL_CONTACT_CONTROL. |
| `0x4006` | indoor | `raw_4006` | NASA Indoor PDU 4006 RAW | raw |  | *unknown* Indoor fan mode - meaningless on EHS. |
| `0x440A` | indoor | `raw_440a` | NASA Indoor PDU 440A LONG RAW | raw |  | *unknown* Device status heat pump / boiler - stays 1, also while the gas boiler runs. |
| `0x428D` | indoor | `raw_428d` | NASA Indoor PDU 428D RAW | raw |  | *candidate* 0 -> 286 when the Immergas night function started (22:00:59, 48 s after the boiler wrote the 30 % limit to the MIM); did not return to 0 at the end of the window. Samsung's code list mentions it for "EHS Mono HT Quiet". |
| `0x8204` | outdoor | `outdoor_temperature` | Outdoor Temperature | temp | °C |  |
| `0x8238` | outdoor | `compressor_frequency` | Compressor Current Frequency | raw | Hz |  |
| `0x8236` | outdoor | `order_frequency` | Compressor 1 Order Frequency | raw | Hz |  |
| `0x8237` | outdoor | `target_frequency` | Compressor 1 Target Frequency | raw | Hz |  |
| `0x8239` | outdoor | `frequency_limit` | Compressor Frequency Limit | raw | Hz | Upper compressor frequency limit: 95 stopped / start, ~64 in Normal mode, **19 during the Immergas night function** (U11 - the boiler writes a 30 % capacity limit to the MIM; 30 % x 64 Hz = 19). Applied ~6 min after the compressor start, released ~40 s after the night window ends. |
| `0x823D` | outdoor | `fan_speed_target` | Outdoor Fan Speed (target) | raw | RPM | 0x823D = target, 0x82D9 = actual. |
| `0x82D9` | outdoor | `fan_speed_actual` | Outdoor Fan Speed (actual) | raw | RPM |  |
| `0x8413` | outdoor | `power_consumed` | Power Consumed last Minute | raw nan=4294967295 | W |  |
| `0x8411` | outdoor | `outdoor_power` | Outdoor Power (1 unit) | raw nan=4294967295 | W |  |
| `0x8414` | outdoor | `energy_consumed_total` | Total Consumed Energy | raw x0.001 nan=4294967295 | kWh |  |
| `0x8217` | outdoor | `outdoor_current` | Outdoor Current | raw x0.1 | A |  |
| `0x24FC` | outdoor | `heat_pump_voltage` | Heat Pump Voltage | raw nan=4294967295 | V |  |
| `0x82ED` | outdoor | `mains_voltage` | Mains AC Voltage | raw | V | Mains AC voltage at the outdoor unit. |
| `0x823B` | outdoor | `dc_link_voltage` | Outdoor DC-Link Voltage | raw x2 | V | Raw is in 2 V units. |
| `0x82E3` | outdoor | `unit_capacity` | Outdoor Unit Capacity | raw x0.1 | kW | Outdoor unit capacity class (9 = 9 kW). |
| `0x820A` | outdoor | `discharge_temp` | Outdoor Discharge 1 Temp (820A) | temp | °C |  |
| `0x8223` | outdoor | `target_discharge_temp` | Outdoor Target Discharge Temp | temp | °C | Equals Immergas 'HP target discharge temperature' on D+/D-. |
| `0x8280` | outdoor | `comp_top_temp` | Outdoor Comp Top Temp (8280) | temp | °C |  |
| `0x8218` | outdoor | `cond_out_temp` | Outdoor Cond-Out Temp (8218) | temp | °C |  |
| `0x8254` | outdoor | `ipm_temp` | Outdoor IPM1 Temperature (8254) | temp | °C |  |
| `0x8229` | outdoor | `main_eev` | Outdoor Main EEV Position | raw | step | 0..2000 steps (Immergas D77). |
| `0x8248` | outdoor | `start_sequence` | Compressor Start Sequence Stage | raw |  | 3 -> 0 -> 1 -> 2 -> 6 during a compressor start. |
| `0x8249` | outdoor | `restart_inhibit` | Compressor Restart Inhibit | raw |  | 5 = ready; 2 -> 3 -> 5 during ~2 min 53 s after a stop. |
| `0x8235` | outdoor | `error_code` | Error Code | raw |  | Samsung error code (E-number), 0 = none. |
| `0x0207` | outdoor | `linked_indoor_units` | Linked Indoor Units | raw |  | Number of indoor units linked to the outdoor unit. |
| `0x041B` | outdoor | `raw_041b` | NASA Outdoor PDU 041B LONG RAW | raw |  | *unknown*  |
| `0x8201` | outdoor | `raw_8201` | NASA Outdoor PDU 8201 RAW | raw |  | *unknown* Constant 181. |
| `0x8239` | outdoor | `raw_8239` | NASA Outdoor PDU 8239 RAW | raw |  | *deprecated* - same value as `frequency_limit`, kept so existing configs keep working. |
| `0x823F` | outdoor | `raw_823f` | NASA Outdoor PDU 823F RAW | raw |  | *unknown* Constant 200. |
| `0x8243` | outdoor | `raw_8243` | NASA Outdoor PDU 8243 RAW | raw |  | *unknown*  |
| `0x824B` | outdoor | `raw_824b` | NASA Outdoor PDU 824B RAW | raw |  | *unknown* Constant 2100. |
| `0x824C` | outdoor | `raw_824c` | NASA Outdoor PDU 824C RAW | raw |  | *unknown*  |
| `0x82E1` | outdoor | `raw_82e1` | NASA Outdoor PDU 82E1 RAW | raw |  | *unknown* Constant 0x5A5A. |
| `0x80B1` | outdoor | `raw_80b1` | NASA Outdoor PDU 80B1 RAW | raw |  | *candidate* 0 -> 1 together with the night frequency limit (0x8239 -> 19 Hz) while the compressor was running; back to 0 when the compressor stopped at the end of the window. Candidate: "capacity limit active". |
| `0x840F` | outdoor | `raw_840f` | NASA Outdoor PDU 840F LONG RAW | raw |  | *unknown*  |
| `0x8417` | outdoor | `raw_8417` | NASA Outdoor PDU 8417 LONG RAW | raw |  | *unknown*  |

## Binary sensors

| PDU | src | key | name (EN) |
|---|---|---|---|
| `0x4089` | indoor | `water_pump` | Primary Water Pump |
| `0x406C` | indoor | `backup_heater` | Backup Heater |
| `0x4087` | indoor | `booster_heater` | EHS Booster Heater |
| `0x402E` | indoor | `defrost` | Defrost Mode |
| `0x4065` | indoor | `dhw_power` | DHW Power |
| `0x4000` | indoor | `zone1_power` | Zone 1 Power |
| `0x411E` | indoor | `zone2_power` | Zone 2 Power |
| `0x4123` | indoor | `pv_control` | PV Control |
| `0x4124` | indoor | `smart_grid` | Smart Grid |
| `0x8010` | outdoor | `compressor` | Compressor Status |
| `0x801A` | outdoor | `four_way_valve` | 4-Way Valve |
| `0x8017` | outdoor | `hot_gas_valve` | Hot Gas Valve |
| `0x80AF` | outdoor | `base_heater` | Base Heater |

## Text sensors

| PDU | src | key | name (EN) | mode |
|---|---|---|---|---|
| `0x8001` | outdoor | `outdoor_driving_mode` | Outdoor Driving Mode | map (driving_mode) |
| `0x8003` | outdoor | `outdoor_operation_state` | Outdoor Operation State | map (heat_cool) |
| `0x800D` | outdoor | `outdoor_fan_state` | Outdoor Fan Operation State | map (fan_state) |
| `0x8061` | outdoor | `defrost_stage` | Defrost Stage | map (defrost_stage) |
| `0x8235` | outdoor | `system_error` | System Error Status | error |
| `0x4066` | indoor | `dhw_mode` | Hot Water Mode | map (dhw_mode) |
| `0x4001` | indoor | `operation_mode_text` | Indoor Operation Mode | map (operation_mode) |
| `0x4067` | indoor | `three_way_valve_text` | 3-Way Valve Position | map (three_way_valve) |
| `0x0608` | outdoor | `firmware_outdoor` | Outdoor Unit Firmware | firmware |
| `0x060C` | outdoor | `firmware_outdoor_eeprom` | Outdoor Unit EEPROM | firmware |
| `0x8601` | outdoor | `firmware_inverter` | Inverter Firmware | firmware |
| `0x0608` | indoor | `firmware_indoor` | Indoor Unit (MIM) Firmware | firmware |
| `0x4604` | indoor | `raw_4604` | NASA Indoor PDU 4604 RAW | hex |

Firmware structures decode as `DBxx-xxxxxx yy.mm.dd` (Samsung part number + build date); `0x8601` also carries a version, e.g. `DB91-02338A v10.00.02`.

## FSV installer settings (indoor unit, read with READ requests)

Never broadcast - the component reads them at boot (+30 s) and every `poll_interval`. Read-only: on F1/F2 writes are ignored by the Immergas controller.
65535 / 255 = not supported by this unit -> unknown.

| FSV | PDU | name (EN) | dec | unit | options |
|---|---|---|---|---|---|
| 1011 | `0x424A` | Water out max (cooling) | temp | °C |  |
| 1012 | `0x424B` | Water out min (cooling) | temp | °C |  |
| 1021 | `0x424C` | Room temp max (cooling) | temp | °C |  |
| 1022 | `0x424D` | Room temp min (cooling) | temp | °C |  |
| 1031 | `0x424E` | Water out max (heating) | temp | °C |  |
| 1032 | `0x424F` | Water out min (heating) | temp | °C |  |
| 1041 | `0x4250` | Room temp max (heating) | temp | °C |  |
| 1042 | `0x4251` | Room temp min (heating) | temp | °C |  |
| 1051 | `0x4252` | DHW tank max | temp | °C |  |
| 1052 | `0x4253` | DHW tank min | temp | °C |  |
| 2011 | `0x4254` | Heating water law - outdoor temp point 1 | temp | °C |  |
| 2012 | `0x4255` | Heating water law - outdoor temp point 2 | temp | °C |  |
| 2021 | `0x4256` | Heating WL1 - water out point 1 | temp | °C |  |
| 2022 | `0x4257` | Heating WL1 - water out point 2 | temp | °C |  |
| 2031 | `0x4258` | Heating WL2 - water out point 1 | temp | °C |  |
| 2032 | `0x4259` | Heating WL2 - water out point 2 | temp | °C |  |
| 2041 | `0x4093` | Heating water law type | enum |  | 1 WL1 (floor), 2 WL2 (FCU) |
| 2051 | `0x425A` | Cooling water law - outdoor temp point 1 | temp | °C |  |
| 2052 | `0x425B` | Cooling water law - outdoor temp point 2 | temp | °C |  |
| 2061 | `0x425C` | Cooling WL1 - water out point 1 | temp | °C |  |
| 2062 | `0x425D` | Cooling WL1 - water out point 2 | temp | °C |  |
| 2071 | `0x425E` | Cooling WL2 - water out point 1 | temp | °C |  |
| 2072 | `0x425F` | Cooling WL2 - water out point 2 | temp | °C |  |
| 2081 | `0x4094` | Cooling water law type | enum |  | 1 WL1, 2 WL2 |
| 2091 | `0x4095` | External room thermostat (UFH) | enum |  | 0 No, 1-4 thermostat modes |
| 2092 | `0x4096` | External room thermostat (FCU) | enum |  | 0 No, 1-4 thermostat modes |
| 2093 | `0x4127` | Remote controller room temp control | enum |  | 1-4 room temp control modes |
| 3011 | `0x4097` | DHW tank application | enum |  | 0 No DHW, 1 Yes (start at thermo-on temp), 2 Yes (start at thermo-off temp) |
| 3021 | `0x4260` | DHW max temp by heat pump | temp | °C |  |
| 3022 | `0x4261` | DHW heat pump stop difference | temp | °C |  |
| 3023 | `0x4262` | DHW heat pump start difference | temp | °C |  |
| 3024 | `0x4263` | Min space heating time | raw | min |  |
| 3025 | `0x4264` | Max DHW time | raw | min |  |
| 3026 | `0x4265` | Max space heating time | raw x0.0166667 | h |  |
| 3031 | `0x4098` | Booster heater | enum |  | 0 Off, 1 On |
| 3032 | `0x4266` | Booster heater delay | raw | min |  |
| 3033 | `0x4267` | Booster heater overshoot | temp | °C |  |
| 3041 | `0x4099` | Disinfection | enum |  | 0 Off, 1 On |
| 3042 | `0x409A` | Disinfection day | enum |  | 0 Sunday ... 6 Saturday, 7 Every day |
| 3043 | `0x4269` | Disinfection start hour | raw | h |  |
| 3044 | `0x426A` | Disinfection target temp | temp | °C |  |
| 3045 | `0x426B` | Disinfection duration | raw | min |  |
| 3046 | `0x42CE` | Disinfection max time | raw | h |  |
| 3051 | `0x409B` | Forced DHW timer | enum |  | 0 Off, 1 On |
| 3052 | `0x426C` | Forced DHW duration | raw x10 | min |  |
| 3061 | `0x409C` | Solar panel or DHW thermostat | enum |  | 0 No, 1 Solar panel, 2 DHW thermostat |
| 3071 | `0x409D` | 3-way valve direction | enum |  | 0 Room, 1 Tank |
| 3081 | `0x42ED` | Booster heater 1st step capacity | raw | kW |  |
| 3082 | `0x42EE` | Booster heater 2nd step capacity | raw | kW |  |
| 3083 | `0x42EF` | Booster heater (BSH) capacity | raw | kW |  |
| 4011 | `0x409E` | Heating or DHW priority | enum |  | 0 DHW, 1 Heating |
| 4012 | `0x426D` | Outdoor temp for priority | temp | °C |  |
| 4013 | `0x426E` | Heating off outdoor temp | temp | °C |  |
| 4021 | `0x409F` | Backup heater application | enum |  | 0 No, 1 2-step, 2 1-step |
| 4022 | `0x40A0` | Backup or booster heater priority | enum |  | 0 Both, 1 Backup heater, 2 Booster heater |
| 4023 | `0x40A1` | Cold weather compensation | enum |  | 0 Off, 1 On |
| 4024 | `0x4270` | Backup heater threshold temp | temp | °C |  |
| 4025 | `0x4271` | Defrost backup temp | temp | °C |  |
| 4031 | `0x40A2` | Backup boiler | enum |  | 0 No, 1 Yes |
| 4032 | `0x40A3` | Backup boiler priority | enum |  | 0 No, 1 Yes |
| 4033 | `0x4272` | Backup boiler threshold temp | temp | °C |  |
| 4041 | `0x40C0` | Mixing valve | enum |  | 0 No, 1 Delta T, 2 Water law |
| 4042 | `0x4286` | Mixing valve target delta T (heating) | temp | °C |  |
| 4043 | `0x4287` | Mixing valve target delta T (cooling) | temp | °C |  |
| 4044 | `0x40C1` | Mixing valve control factor | enum |  |  |
| 4045 | `0x4288` | Mixing valve control interval | raw | min |  |
| 4046 | `0x4289` | Mixing valve running time | raw x10 | s |  |
| 4051 | `0x40C2` | Inverter pump control | enum |  | 0 No, 1 100%, 2 70% |
| 4052 | `0x428A` | Inverter pump target delta T | temp | °C |  |
| 4053 | `0x40C3` | Inverter pump control factor | enum |  |  |
| 4061 | `0x411A` | Zone control | enum |  | 0 Off, 1 On |
| 5011 | `0x4273` | Outing mode - cooling water out | temp | °C |  |
| 5012 | `0x4274` | Outing mode - cooling room | temp | °C |  |
| 5013 | `0x4275` | Outing mode - heating water out | temp | °C |  |
| 5014 | `0x4276` | Outing mode - heating room | temp | °C |  |
| 5015 | `0x4277` | Outing mode - auto cooling WL1 water | temp | °C |  |
| 5016 | `0x4278` | Outing mode - auto cooling WL2 water | temp | °C |  |
| 5017 | `0x4279` | Outing mode - auto heating WL1 water | temp | °C |  |
| 5018 | `0x427A` | Outing mode - auto heating WL2 water | temp | °C |  |
| 5019 | `0x427B` | Outing mode - DHW tank target | temp | °C |  |
| 5021 | `0x427C` | DHW saving temp difference | temp | °C |  |
| 5022 | `0x4128` | DHW saving mode | enum |  | 0 Off, 1 On |
| 5023 | `0x42F0` | DHW saving thermo-off difference | raw |  |  |
| 5041 | `0x40A4` | Power peak control | enum |  | 0 Off, 1 On |
| 5042 | `0x40A5` | Power peak - forced off parts | enum |  | 0 All, 1-3 selection |
| 5043 | `0x40A6` | Power peak - input voltage | enum |  | 0 Low, 1 High |
| 5051 | `0x40A7` | Frequency ratio control | enum |  | 0 Off, 1 On |
| 5081 | `0x411B` | PV control | enum |  | 0 Off, 1 On |
| 5082 | `0x42DB` | PV control - cooling shift | raw |  |  |
| 5083 | `0x42DC` | PV control - heating shift | raw |  |  |
| 5091 | `0x411C` | Smart Grid control | enum |  | 0 Off, 1 On |
| 5092 | `0x42DD` | Smart Grid - heating shift | raw |  |  |
| 5093 | `0x42DE` | Smart Grid - DHW shift | raw |  |  |
| 5094 | `0x411D` | Smart Grid - DHW mode | enum |  | 0 Heat-pump limit (FSV 3021), 1 Booster to 70 C |

## Not present on a Magis Combo

Always 65535 or never sent on this install (kept out of the default config): pressures `0x8206/0x8208`, suction `0x821A`, saturation temps `0x829F/0x82A0`, EVI / double tube / DSH `0x821C/0x821E/0x8220/0x827A`, compressor 2 `0x8276`, ODU water sensors `0x82DE-0x82E0` (65036), `0x4206`, `0x423E`, FR control `0x42F1`.
`0x42D4`, `0x42D6`, `0x42E9`, `0x4426`, `0x4427` are in the catalog but not broadcast on a Magis Combo, and a READ returns "not available" (65535 / 0xFFFFFFFF) - the MIM board has no flow meter or heat metering (the Immergas board handles the pump and flow). They may work on other installs. On a Magis use the flow from the T-/T+ (BMS) bus (D14).
