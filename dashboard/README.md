# Hub dashboard

**English** · [Polski](README.pl.md)

**Recommended:** the hub cards build the whole dashboard themselves. Create an empty dashboard, open the raw
configuration editor and enter:

```yaml
strategy:
  type: custom:immergas-hub
```

It needs only the hub entities and the cards ([cards/README.md](../cards/README.md)). The generator below is the
alternative without custom cards: built-in Home Assistant cards only.

`immergas-hub-dashboard.jinja` generates a ready-made dashboard (5 views: Overview, DHW, Costs, Settings,
Diagnostics). It uses only built-in Home Assistant cards, so nothing from HACS is needed.

## Why a generator instead of a ready YAML

An `entity_id` in HA depends on the device name, the area and the entity-id format setting (Settings → System). The
same entity can be `sensor.immergas_dft_hub_immergas_hub_cop` or `sensor.boiler_room_immergas_dft_hub_immergas_hub_cop`,
and both styles can even appear within one device (entities added after an area was assigned get the area name in
front). The generator looks entities up **by name** (e.g. "Immergas Hub - COP") within the device that has the
"Immergas Hub - Operating state" entity, and inserts the real `entity_id`s from your HA.

## How to use

1. Developer tools → **Template** → delete the example text and paste the whole `immergas-hub-dashboard.jinja` file.
2. Copy the result from the right-hand side (first line: `# Generated for device ...`).
3. Settings → Dashboards → **Add dashboard** → "New dashboard from scratch" → open it.
4. Pencil (edit) → three dots → **Raw configuration editor** → replace everything with the copied result → Save.

After a hub update, repeat steps 1–4 (the dashboard is generated from scratch).

## When something is missing

- An entity shown as `sensor.missing_...` means no entity with that name was found. Usually it was
  renamed manually in HA (its name, not its `entity_id`) or it is disabled. Restore the default name or fix the row
  manually in the dashboard.
- The generator works with both the English and the Polish entity names (`lang/*_en` / `lang/*_pl`) and the default
  prefixes (`Immergas DD/TT/FF/Hub - ...`). Titles and labels follow the hub language.
