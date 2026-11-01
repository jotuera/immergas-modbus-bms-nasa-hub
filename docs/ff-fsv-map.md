**English** · [Polski](ff-fsv-map.pl.md)

# FSV installer map — Immergas Magis Combo V2 + Samsung NASA


Full map of **all 94 FSV installer settings** from the Samsung NASA bus (F1/F2) and their status **on this particular installation** (Magis Combo V2 Plus + Audax Pro, the loop is run by the Immergas controller). The project has been slimmed down: **only what actually works is exposed by default**; the rest is **commented out** in the packages (not deleted — kept with a description for reference/restoring). See also [ff-control-results.md](ff-control-results.md).

> **Why so much is disabled?** On the Magis it is **Immergas** that calculates the setpoint (`0x4247`) and runs the circuit, the pump and DHW; Samsung is blind to the DHW cylinder (`0x4237`=0) and to the pump (`0x4089`=OFF despite flow). Most FSVs are either **overridden**, or **inactive** (the component the function needs is missing), or concern **hardware not present** on this installation.

## Summary

- ✅ **Exposed and working: 9** — outing mode setpoints 5011–5019 (Configuration). Plus levers **outside FSV** in Control: outing mode `0x406D` and FR control `0x40A7`.

- → **Moved to Control: 1** (FR 5051).

- 🔇 **Disabled — no hardware: 17** (heaters, mixing valve, zones, thermostats).

- 🔇 **Disabled — inactive/overridden: 67** (curve, limits, DHW, modes requiring contacts).


**Total 94 FSV. Active entities: 9.**

## Full map (all 94)

| FSV | Code | Name | Group | Unit | Range | Status | Reason |
|---|---|---|---|---|---|---|---|
| 1011 | 0x424A | Water out max (cooling) | 1xxx Temperature limits | °C | 18…25 (step 1) | 🔇 Disabled — inactive | temperature limit: ignored by Immergas (own setpoint; tests 1031/1032) |
| 1012 | 0x424B | Water out min (cooling) | 1xxx Temperature limits | °C | 5…18 (step 1) | 🔇 Disabled — inactive | temperature limit: ignored by Immergas (own setpoint; tests 1031/1032) |
| 1021 | 0x424C | Room temp max (cooling) | 1xxx Temperature limits | °C | 28…30 (step 1) | 🔇 Disabled — inactive | temperature limit: ignored by Immergas (own setpoint) |
| 1022 | 0x424D | Room temp min (cooling) | 1xxx Temperature limits | °C | 18…28 (step 1) | 🔇 Disabled — inactive | temperature limit: ignored by Immergas (own setpoint) |
| 1031 | 0x424E | Water out max (heating) | 1xxx Temperature limits | °C | 37…55 (step 1) | 🔇 Disabled — inactive | max flow temp. overridden by Immergas (the setpoint wins) |
| 1032 | 0x424F | Water out min (heating) | 1xxx Temperature limits | °C | 15…37 (step 1) | 🔇 Disabled — inactive | min water out heating: ignored - 1032=37 did not raise the setpoint (stayed 24, below the Samsung min) |
| 1041 | 0x4250 | Room temp max (heating) | 1xxx Temperature limits | °C | 18…30 (step 1) | 🔇 Disabled — inactive | temperature limit: ignored by Immergas (own setpoint) |
| 1042 | 0x4251 | Room temp min (heating) | 1xxx Temperature limits | °C | 16…18 (step 1) | 🔇 Disabled — inactive | temperature limit: ignored by Immergas (own setpoint) |
| 1051 | 0x4252 | DHW tank max | 1xxx Temperature limits | °C | 50…70 (step 1) | 🔇 Disabled — inactive | DHW cylinder limit: ignored (Immergas calculates; Samsung does not see the cylinder) |
| 1052 | 0x4253 | DHW tank min | 1xxx Temperature limits | °C | 30…40 (step 1) | 🔇 Disabled — inactive | DHW cylinder limit: ignored (Immergas calculates; Samsung does not see the cylinder) |
| 2011 | 0x4254 | Heating water law - outdoor temp point 1 | 2xxx Heating / cooling curve (water law) | °C | -20…5 (step 1) | 🔇 Disabled — inactive | heating curve: the whole curve is ignored by Immergas (WL2 test confirmed) |
| 2012 | 0x4255 | Heating water law - outdoor temp point 2 | 2xxx Heating / cooling curve (water law) | °C | 10…20 (step 1) | 🔇 Disabled — inactive | heating curve: the whole curve is ignored by Immergas (WL2 test confirmed) |
| 2021 | 0x4256 | Heating WL1 - water out point 1 | 2xxx Heating / cooling curve (water law) | °C | 17…55 (step 1) | 🔇 Disabled — inactive | heating curve WL1 ignored by Immergas (own setpoint) |
| 2022 | 0x4257 | Heating WL1 - water out point 2 | 2xxx Heating / cooling curve (water law) | °C | 17…55 (step 1) | 🔇 Disabled — inactive | heating curve WL1 ignored by Immergas (own setpoint) |
| 2031 | 0x4258 | Heating WL2 - water out point 1 | 2xxx Heating / cooling curve (water law) | °C | 17…55 (step 1) | 🔇 Disabled — inactive | heating curve WL2: ignored by Immergas |
| 2032 | 0x4259 | Heating WL2 - water out point 2 | 2xxx Heating / cooling curve (water law) | °C | 17…55 (step 1) | 🔇 Disabled — inactive | heating curve WL2: ignored by Immergas |
| 2041 | 0x4093 | Heating water law type | 2xxx Heating / cooling curve (water law) | — | WL1 / WL2 | 🔇 Disabled — inactive | curve type selection: ignored - WL1->WL2 had no effect on the setpoint |
| 2051 | 0x425A | Cooling water law - outdoor temp point 1 | 2xxx Heating / cooling curve (water law) | °C | 25…35 (step 1) | 🔇 Disabled — inactive | cooling curve: ignored (Immergas calculates the setpoint, same mechanism) |
| 2052 | 0x425B | Cooling water law - outdoor temp point 2 | 2xxx Heating / cooling curve (water law) | °C | 35…45 (step 1) | 🔇 Disabled — inactive | cooling curve: ignored (Immergas calculates the setpoint, same mechanism) |
| 2061 | 0x425C | Cooling WL1 - water out point 1 | 2xxx Heating / cooling curve (water law) | °C | 5…25 (step 1) | 🔇 Disabled — inactive | cooling curve WL1: ignored (same mechanism) |
| 2062 | 0x425D | Cooling WL1 - water out point 2 | 2xxx Heating / cooling curve (water law) | °C | 5…25 (step 1) | 🔇 Disabled — inactive | cooling curve WL1: ignored (same mechanism) |
| 2071 | 0x425E | Cooling WL2 - water out point 1 | 2xxx Heating / cooling curve (water law) | °C | 5…25 (step 1) | 🔇 Disabled — inactive | cooling curve WL2: ignored (same mechanism) |
| 2072 | 0x425F | Cooling WL2 - water out point 2 | 2xxx Heating / cooling curve (water law) | °C | 5…25 (step 1) | 🔇 Disabled — inactive | cooling curve WL2: ignored (same mechanism) |
| 2081 | 0x4094 | Cooling water law type | 2xxx Heating / cooling curve (water law) | — | WL1 / WL2 | 🔇 Disabled — inactive | cooling curve type selection: ignored (same mechanism) |
| 2091 | 0x4095 | External room thermostat (UFH) | 2xxx Heating / cooling curve (water law) | — | 0 / 1 | 🔇 Disabled — no hardware | external thermostat #1 (underfloor): no thermostat wired to Samsung (the room is handled by Immergas/Salus) - idle |
| 2092 | 0x4096 | External room thermostat (FCU) | 2xxx Heating / cooling curve (water law) | — | 0 / 1 | 🔇 Disabled — no hardware | external thermostat #2 (fan coil): no thermostat wired to Samsung (the room is handled by Immergas/Salus) - idle |
| 2093 | 0x4127 | Remote controller room temp control | 2xxx Heating / cooling curve (water law) | — | Ambient only / Curve + thermo-off -> pump off / Curve + thermo-off -> pump on / Curve + thermo-off -> pump 30% | 🔇 Disabled — no hardware | room temp. control from the Samsung remote: no Samsung remote (panel emulated, the room is handled by Immergas) - idle |
| 3011 | 0x4097 | DHW tank application | 3xxx DHW and disinfection | — | 0 / 1 | 🔇 Disabled — inactive | DHW: idle - DHW is the Immergas domain (Samsung does not see the cylinder) |
| 3021 | 0x4260 | DHW max temp by heat pump | 3xxx DHW and disinfection | °C | 45…50 (step 1) | 🔇 Disabled — inactive | DHW heat pump max. temp.: the write holds but idle - Samsung does not see the cylinder |
| 3022 | 0x4261 | DHW heat pump stop difference | 3xxx DHW and disinfection | °C | 2…10 (step 1) | 🔇 Disabled — inactive | DHW: idle - DHW is the Immergas domain (Samsung does not see the cylinder) |
| 3023 | 0x4262 | DHW heat pump start difference | 3xxx DHW and disinfection | °C | 5…20 (step 1) | 🔇 Disabled — inactive | DHW: idle - DHW is the Immergas domain (Samsung does not see the cylinder) |
| 3024 | 0x4263 | Min space heating time | 3xxx DHW and disinfection | min | 1…20 (step 1) | 🔇 Disabled — inactive | DHW/heating timer: idle - DHW is the Immergas domain |
| 3025 | 0x4264 | Max DHW time | 3xxx DHW and disinfection | min | 5…95 (step 5) | 🔇 Disabled — inactive | DHW: idle - DHW is the Immergas domain (Samsung does not see the cylinder) |
| 3026 | 0x4265 | Max space heating time | 3xxx DHW and disinfection | h | 0.5…10 (step 0.5) | 🔇 Disabled — inactive | DHW/heating timer: idle - DHW is the Immergas domain |
| 3031 | 0x4098 | Booster heater | 3xxx DHW and disinfection | — | 0 / 1 | 🔇 Disabled — inactive | booster heater: idle - heaters are planned for the Immergas indoor unit, not Samsung (test only if they go to the Samsung/MIM side) |
| 3032 | 0x4266 | Booster heater delay | 3xxx DHW and disinfection | min | 20…95 (step 5) | 🔇 Disabled — inactive | booster heater: idle - heaters are planned for the Immergas indoor unit, not Samsung (test only if they go to the Samsung/MIM side) |
| 3033 | 0x4267 | Booster heater overshoot | 3xxx DHW and disinfection | °C | 0…4 (step 1) | 🔇 Disabled — inactive | booster heater: idle - heaters are planned for the Immergas indoor unit, not Samsung (test only if they go to the Samsung/MIM side) |
| 3041 | 0x4099 | Disinfection | 3xxx DHW and disinfection | — | 0 / 1 | 🔇 Disabled — inactive | disinfection: idle - Samsung does not see the cylinder; Immergas P15 does it |
| 3042 | 0x409A | Disinfection day | 3xxx DHW and disinfection | — | Sunday / Monday / Tuesday / Wednesday / Thursday / Friday / Saturday / Every day | 🔇 Disabled — inactive | disinfection group (idle, see 3041) |
| 3043 | 0x4269 | Disinfection start hour | 3xxx DHW and disinfection | h | 0…23 (step 1) | 🔇 Disabled — inactive | disinfection group (idle, see 3041) |
| 3044 | 0x426A | Disinfection target temp | 3xxx DHW and disinfection | °C | 40…70 (step 5) | 🔇 Disabled — inactive | disinfection group (idle, see 3041) |
| 3045 | 0x426B | Disinfection duration | 3xxx DHW and disinfection | min | 5…60 (step 5) | 🔇 Disabled — inactive | disinfection group (idle, see 3041) |
| 3046 | 0x42CE | Disinfection max time | 3xxx DHW and disinfection | h | 0…24 (step 1) | 🔇 Disabled — inactive | disinfection group (idle, see 3041) |
| 3051 | 0x409B | Forced DHW timer | 3xxx DHW and disinfection | — | 0 / 1 | 🔇 Disabled — inactive | forced DHW: idle - DHW is the Immergas domain |
| 3052 | 0x426C | Forced DHW duration | 3xxx DHW and disinfection | min | 30…300 (step 10) | 🔇 Disabled — inactive | forced DHW: idle - DHW is the Immergas domain |
| 3061 | 0x409C | Solar panel or DHW thermostat | 3xxx DHW and disinfection | — | none / solar panel / DHW thermostat | 🔇 Disabled — inactive | solar panel/DHW thermostat: idle - DHW is the Immergas domain |
| 3071 | 0x409D | 3-way valve direction | 3xxx DHW and disinfection | — | room / tank | 🔇 Disabled — inactive | DHW valve direction: idle - the valve is on the Immergas side |
| 3081 | 0x42ED | Booster heater 1st step capacity | 3xxx DHW and disinfection | kW | 1…6 (step 1) | 🔇 Disabled — inactive | heater capacity: idle - heaters are on the Immergas side (test only if Samsung/MIM) |
| 3082 | 0x42EE | Booster heater 2nd step capacity | 3xxx DHW and disinfection | kW | 1…6 (step 1) | 🔇 Disabled — inactive | heater capacity: idle - heaters are on the Immergas side (test only if Samsung/MIM) |
| 3083 | 0x42EF | Booster heater (BSH) capacity | 3xxx DHW and disinfection | kW | 1…6 (step 1) | 🔇 Disabled — inactive | tank heater (BSH) capacity: idle - heaters are on the Immergas side (test only if Samsung/MIM) |
| 4011 | 0x409E | Heating or DHW priority | 4xxx Heating and zones | — | domestic hot water / heating | 🔇 Disabled — inactive | heating/DHW priority: idle - Immergas runs the loop and DHW is 100% its domain (Samsung blind to the cylinder); same mechanism as the tested pump/curve/limits (not tested separately) |
| 4012 | 0x426D | Outdoor temp for priority | 4xxx Heating and zones | °C | -15…20 (step 1) | 🔇 Disabled — inactive | outdoor temp. for priority: idle - Immergas decides the priority (see 4011) |
| 4013 | 0x426E | Heating off outdoor temp | 4xxx Heating and zones | °C | 14…35 (step 1) | 🔇 Disabled — inactive | heating off outdoor temp.: idle - Immergas calculates the setpoint and decides when to heat; cannot be tested here (outdoor 8.5 °C below the 14 °C minimum threshold) |
| 4021 | 0x409F | Backup heater application | 4xxx Heating and zones | — | 0 / 1 | 🔇 Disabled — no hardware | backup heater application: none on the Samsung side (heaters go to the Immergas unit) - FSV holds but idle |
| 4022 | 0x40A0 | Backup or booster heater priority | 4xxx Heating and zones | — | both / backup heater / booster heater | 🔇 Disabled — no hardware | backup/booster heater priority: heaters on the Immergas side - FSV holds but idle |
| 4023 | 0x40A1 | Cold weather compensation | 4xxx Heating and zones | — | 0 / 1 | 🔇 Disabled — inactive | cold weather compensation (heater): idle - heaters on the Immergas side |
| 4024 | 0x4270 | Backup heater threshold temp | 4xxx Heating and zones | °C | -15…35 (step 1) | 🔇 Disabled — no hardware | backup heater threshold temp.: heaters on the Immergas side - FSV holds but idle |
| 4025 | 0x4271 | Defrost backup temp | 4xxx Heating and zones | °C | 10…55 (step 5) | 🔇 Disabled — no hardware | defrost backup temp.: tied to the backup heater (Immergas side) - FSV holds but idle |
| 4031 | 0x40A2 | Backup boiler | 4xxx Heating and zones | — | 0 / 1 | 🔇 Disabled — no hardware | backup boiler application: not present on this installation - FSV holds but idle |
| 4032 | 0x40A3 | Backup boiler priority | 4xxx Heating and zones | — | 0 / 1 | 🔇 Disabled — no hardware | backup boiler priority: not present on this installation - FSV holds but idle |
| 4033 | 0x4272 | Backup boiler threshold temp | 4xxx Heating and zones | °C | -20…5 (step 1) | 🔇 Disabled — no hardware | backup boiler threshold temp.: not present on this installation - FSV holds but idle |
| 4041 | 0x40C0 | Mixing valve | 4xxx Heating and zones | — | 0 / 1 | 🔇 Disabled — no hardware | mixing valve application: not present on this installation - FSV holds but idle |
| 4042 | 0x4286 | Mixing valve target delta T (heating) | 4xxx Heating and zones | °C | 5…15 (step 1) | 🔇 Disabled — no hardware | mixing valve target dT (heating): no valve on this installation - FSV holds but idle |
| 4043 | 0x4287 | Mixing valve target delta T (cooling) | 4xxx Heating and zones | °C | 5…15 (step 1) | 🔇 Disabled — no hardware | mixing valve target dT (cooling): no valve on this installation - FSV holds but idle |
| 4044 | 0x40C1 | Mixing valve control factor | 4xxx Heating and zones | — | 1…5 (step 1) | 🔇 Disabled — no hardware | mixing valve control factor: no valve on this installation - FSV holds but idle |
| 4045 | 0x4288 | Mixing valve control interval | 4xxx Heating and zones | min | 1…30 (step 1) | 🔇 Disabled — no hardware | mixing valve control interval: no valve on this installation - FSV holds but idle |
| 4046 | 0x4289 | Mixing valve running time | 4xxx Heating and zones | s | 60…240 (step 30) | 🔇 Disabled — no hardware | mixing valve running time: no valve on this installation - FSV holds but idle |
| 4051 | 0x40C2 | Inverter pump control | 4xxx Heating and zones | — | 0 / 1 | 🔇 Disabled — inactive | inverter pump application: idle - the pump is run by Immergas (confirmed by test 4052) |
| 4052 | 0x428A | Inverter pump target delta T | 4xxx Heating and zones | °C | 2…8 (step 1) | 🔇 Disabled — inactive | inverter pump target dT: TESTED idle - 4052 from 5 to 8 did not change the flow (stayed 1550 l/h) or dT (~1.3 °C); the pump runs at a constant speed, Immergas runs the circuit, Samsung is blind (0x4089 = OFF despite 1550 l/h) |
| 4053 | 0x40C3 | Inverter pump control factor | 4xxx Heating and zones | — | 1…3 (step 1) | 🔇 Disabled — inactive | inverter pump control factor: idle - the pump is run by Immergas (confirmed by test 4052) |
| 4061 | 0x411A | Zone control | 4xxx Heating and zones | — | 0 / 1 | 🔇 Disabled — no hardware | zone control: the write holds (test 2026-10-28, ON persisted, reverted to OFF) but zones are handled by the Immergas hydraulics (KLF08/Salus), not the Samsung side - idle |
| 5011 | 0x4273 | Outing mode - cooling water out | 5xxx Special modes (outing, derating, PV, Smart Grid) | °C | 5…25 (step 1) | ✅ Exposed — works | outing mode takes over the setpoint (confirmed) |
| 5012 | 0x4274 | Outing mode - cooling room | 5xxx Special modes (outing, derating, PV, Smart Grid) | °C | 18…30 (step 1) | ✅ Exposed — works | outing mode takes over the setpoint (confirmed) |
| 5013 | 0x4275 | Outing mode - heating water out | 5xxx Special modes (outing, derating, PV, Smart Grid) | °C | 15…55 (step 1) | ✅ Exposed — works | outing mode takes over the setpoint (confirmed) |
| 5014 | 0x4276 | Outing mode - heating room | 5xxx Special modes (outing, derating, PV, Smart Grid) | °C | 16…30 (step 1) | ✅ Exposed — works | outing mode takes over the setpoint (confirmed) |
| 5015 | 0x4277 | Outing mode - auto cooling WL1 water | 5xxx Special modes (outing, derating, PV, Smart Grid) | °C | 5…25 (step 1) | ✅ Exposed — works | outing mode takes over the setpoint (confirmed) |
| 5016 | 0x4278 | Outing mode - auto cooling WL2 water | 5xxx Special modes (outing, derating, PV, Smart Grid) | °C | 5…25 (step 1) | ✅ Exposed — works | outing mode takes over the setpoint (confirmed) |
| 5017 | 0x4279 | Outing mode - auto heating WL1 water | 5xxx Special modes (outing, derating, PV, Smart Grid) | °C | 15…55 (step 1) | ✅ Exposed — works | outing mode takes over the setpoint (confirmed) |
| 5018 | 0x427A | Outing mode - auto heating WL2 water | 5xxx Special modes (outing, derating, PV, Smart Grid) | °C | 15…55 (step 1) | ✅ Exposed — works | outing mode takes over the setpoint (confirmed) |
| 5019 | 0x427B | Outing mode - DHW tank target | 5xxx Special modes (outing, derating, PV, Smart Grid) | °C | 30…70 (step 1) | ✅ Exposed — works | outing mode takes over the setpoint (confirmed) |
| 5021 | 0x427C | DHW saving temp difference | 5xxx Special modes (outing, derating, PV, Smart Grid) | °C | 0…40 (step 1) | 🔇 Disabled — inactive | DHW saving temp. difference: idle - DHW is the Immergas domain (parent 5022 idle, Samsung does not see the cylinder) |
| 5022 | 0x4128 | DHW saving mode | 5xxx Special modes (outing, derating, PV, Smart Grid) | — | 0 / 1 | 🔇 Disabled — inactive | DHW saving: idle - Samsung does not see the cylinder, DHW is the Immergas domain |
| 5023 | 0x42F0 | DHW saving thermo-off difference | 5xxx Special modes (outing, derating, PV, Smart Grid) | °C | 0…20 (step 1) | 🔇 Disabled — inactive | DHW saving thermo-off difference: idle - DHW is the Immergas domain (parent 5022 idle) |
| 5041 | 0x40A4 | Power peak control | 5xxx Special modes (outing, derating, PV, Smart Grid) | — | 0 / 1 | 🔇 Disabled — inactive | power peak control: the write holds but idle (no peak contact) |
| 5042 | 0x40A5 | Power peak - forced off parts | 5xxx Special modes (outing, derating, PV, Smart Grid) | — | All off / Booster heater only / Backup heater only | 🔇 Disabled — inactive | power peak forced off parts: idle - requires an external peak contact (parent 5041 idle) |
| 5043 | 0x40A6 | Power peak - input voltage | 5xxx Special modes (outing, derating, PV, Smart Grid) | — | low / high | 🔇 Disabled — inactive | power peak input voltage: idle - requires an external peak contact (parent 5041 idle) |
| 5051 | 0x40A7 | Frequency ratio control | 5xxx Special modes (outing, derating, PV, Smart Grid) | — | 0 / 1 | → Control (works) | FR control enable - WORKS (caps the compressor at ~50%), FR switch in f1f2_control |
| 5081 | 0x411B | PV control | 5xxx Special modes (outing, derating, PV, Smart Grid) | — | 0 / 1 | 🔇 Disabled — inactive | PV control: the write holds but idle (no PV contact) |
| 5082 | 0x42DB | PV control - cooling shift | 5xxx Special modes (outing, derating, PV, Smart Grid) | °C | 0…20 (step 1) | 🔇 Disabled — inactive | PV cooling shift: idle - requires an external PV contact (parent 5081 idle) |
| 5083 | 0x42DC | PV control - heating shift | 5xxx Special modes (outing, derating, PV, Smart Grid) | °C | 0…20 (step 1) | 🔇 Disabled — inactive | PV heating shift: idle - requires an external PV contact (parent 5081 idle) |
| 5091 | 0x411C | Smart Grid control | 5xxx Special modes (outing, derating, PV, Smart Grid) | — | 0 / 1 | 🔇 Disabled — inactive | Smart Grid: the write holds but idle (no SG contact) |
| 5092 | 0x42DD | Smart Grid - heating shift | 5xxx Special modes (outing, derating, PV, Smart Grid) | °C | 0…20 (step 1) | 🔇 Disabled — inactive | Smart Grid heating shift: idle - requires an external SG contact (parent 5091 idle) |
| 5093 | 0x42DE | Smart Grid - DHW shift | 5xxx Special modes (outing, derating, PV, Smart Grid) | °C | 0…20 (step 1) | 🔇 Disabled — inactive | Smart Grid DHW shift: idle - requires an external SG contact (parent 5091 idle) |
| 5094 | 0x411D | Smart Grid - DHW mode | 5xxx Special modes (outing, derating, PV, Smart Grid) | — | 0 / 1 | 🔇 Disabled — inactive | Smart Grid DHW mode: idle - requires an external SG contact (parent 5091 idle) |

---

*Generated from the project's FSV catalogue (`components/f1f2_nasa/f1f2_fsv_catalog.yaml`). The working levers (outing, FR) live in `f1f2_control`, outside the FSV family; editable FSVs use the `number` platform (see `f1f2_outing_targets`).*
