**English** · [Polski](ff-samsung-error-codes.pl.md)

# Samsung EHS error codes (F1/F2 / NASA side)

Inside the outdoor unit (ODU), the Magis Pro / Combo V2 uses a Samsung EHS system, and the F1/F2 bus
is that unit's NASA bus. When a fault occurs in the Samsung part, the error code appears on the
dedicated Samsung wired remote controller (e.g. **MWR-WW10N**). Immergas reads the same side through the
MIM, so these codes are useful when diagnosing the F1/F2 bus.

The codes below were copied 1:1 from the official Polish-language **Samsung EHS** manual (indoor unit
AE090JNYDEH and related models), section "Troubleshooting tips". This is the set of codes
visible to the user (sensors, communication, pump/flow); the full service list for the outdoor
unit is longer.

> Source: *Samsung EHS — user manual (SPLIT), PL, EHS Indoor AE090JNYDEH_EU_IB_PL_05130A-00*,
> pages POLSKI-50…52.

## Temperature sensors

| Code | Explanation |
|-----|-------------|
| **E122** | Evaporator inlet sensor error — short or open circuit in the EVA inlet temperature sensor |
| **E123** | Evaporator outlet sensor error — short or open circuit in the EVA outlet temperature sensor |
| **E653** | Wired remote temperature sensor error — short or open circuit in the wired remote temperature sensor |
| **E654** | Wired remote EEPROM error — data error in the remote controller (memory read/write error) |
| **E901** | Water inlet temperature sensor error — short or open circuit in the water inlet temperature sensor |
| **E902** | Short or open circuit in the plate heat exchanger outlet temperature sensor |
| **E903** | Water outlet temperature sensor error — short or open circuit in the water outlet temperature sensor (backup heater) |
| **E904** | DHW tank temperature sensor error — short or open circuit in the water tank temperature sensor |
| **E916** | Mixing valve sensor error — short or open circuit in the mixing valve temperature sensor (when parameter FSV #4041 is set to "1") |

Sensor locations (from the manual's drawing): **E901** water inlet, **E902** plate heat exchanger
outlet (Tw1/Tw2), **E903** water outlet / backup heater (Tw3), **E904** water tank, **E122** EVA inlet
(reference input), **E123** EVA outlet (reference output), **E653/E654** wired remote controller.

## Communication

| Code | Explanation |
|-----|-------------|
| **E601** | Communication error between the remote controller and the Hydro unit |
| **E604** | Indoor - wired remote communication error — monitoring error between the remote controller and the Hydro unit |
| **E653** | Wired remote temperature sensor error — temperature sensor in the remote controller disconnected or faulty |
| **E654** | Wired remote EEPROM error — data error in the remote controller (memory read/write error) — problem with data transfer between the Micom module and IC07 (EEPROM) |

## Water pump and flow switch

| Code | Explanation |
|-----|-------------|
| **E911** | Flow switch error — flow switch OFF error. Triggered when the flow switch turns off within 30 s with the water pump signal on (start-up), or within 15 s after start-up. Indicates insufficient water flow: < 7 l/min (✴✴090✴✴ models) / < 12 l/min (✴✴160✴✴ models). |
| **E912** | Flow switch ON error. Triggered when the flow switch turns on within 10 min with the water pump signal off. Water flow > 7 l/min (✴✴090✴✴) / > 12 l/min (✴✴160✴✴). |

---

FSV mapping (e.g. #4041) — see the catalogue
`components/f1f2_nasa/f1f2_fsv_catalog.yaml` and [ff-fsv-map.md](ff-fsv-map.md).
