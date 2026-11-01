# Collecting logs

**English** · [Polski](collecting-logs.pl.md) · back to the [README](../README.md)

The hub was built on one installation (Magis Combo 9 Plus V2 + Audax Pro 9 V2). Other models, more zones and
accessories (a dehumidifier, the photovoltaic input, a solar kit…) use registers that nobody has decoded yet. Good logs
from your installation are how the hub learns them. This page shows what to collect and how.

## 1. Describe the installation

- Indoor unit and outdoor unit models (rating plates), number of zones, which accessories are connected.
- From Home Assistant: *Immergas Hub - Project version*, *Immergas TT - D61 System model*,
  *Immergas TT - A11 Outdoor Unit model*, *Immergas DD - D91 Boiler firmware version*,
  *Immergas DD - HP D132-D135 Inverter firmware*.
- A screenshot of the **Connectivity** card.

## 2. Turn on detailed logs

In your hub YAML raise the log level for the bus tags, flash, and open the logs (ESPHome dashboard → *Logs*, or
`esphome logs immergas-hub.yaml`):

```yaml
logger:
  level: DEBUG
  logs:
    sniff: DEBUG          # D+/D- register changes
    f1f2_sniff: DEBUG     # F1/F2 (NASA) value changes
    modbus_controller: INFO
    sensor: WARN          # hides the routine "new value" lines
```

Go back to `level: INFO` when you are done – DEBUG logs are long.

## 3. Switch on the listeners

| Bus | How | What you get in the log |
|---|---|---|
| **D+/D-** | switch *Immergas DD - Bus sniffer* on; *Bus sniffer reset* starts a fresh map | `NEW` / `CHG` lines for every register that appears or changes, with the device address (0x1E heat pump, 0x29 zone panel, 0x33 Dominus…) |
| **F1/F2** | switches *NASA Sniffer* and *Discovery (context change log)* on | every NASA value that changes, with a snapshot of the key values around it |
| **T-/T+** | this bus cannot be listened to – the hub is its master. Add `packages/tt_scanner.yaml`, switch *PDU scanner - scanner mode* on (normal polling pauses), set *PDU scanner - from / to* and press *Scan range (from-to)* | `OK PDU <n> = <value>` for every register that answers |

The scanner only **reads**. Scan the same range before and after a change and compare the two lists.

## 4. Record one change at a time

1. Leave the system alone for **10 minutes** – this is the baseline.
2. Do **one** thing and **write down the exact time**: switch the accessory on, change one setting on the boiler or
   the panel, start DHW, open the PV contact…
3. Wait **5 minutes**, then undo it and wait another 5.
4. Repeat 2–3 times – a register that follows your action every time is the one we are looking for.

## 5. Send it

Open an issue with the **New model or unknown signal** template, attach the log as a file (not pasted) and list your
actions with their times. Logs contain no passwords; still check that no Wi-Fi name or address you want to keep private
is in them.
