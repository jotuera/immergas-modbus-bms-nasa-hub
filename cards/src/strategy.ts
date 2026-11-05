import { LANGS, translate } from "./i18n";
// Dashboard strategy: `strategy: { type: custom:immergas-hub }` builds a whole dashboard from the hub cards.
class ImmergasHubStrategy {
  static async generate(config: any, hass: any) {
    const l = String(hass?.locale?.language ?? hass?.language ?? "en").slice(0, 2), lang = LANGS.includes(l) ? l : "en";
    const t = (a: string, b: string) => translate(lang, a, b);
    const card = (type: string, extra: Record<string, unknown> = {}) => ({ type: "custom:" + type, ...extra });
    // the Automations card only when the HA automation switches exist (or an own list is given in `automations.items`)
    const autos = !!config.automations?.items || Object.keys(hass?.states ?? {}).some((e) => e.startsWith("input_boolean.auto_pompa_"));
    return {
      title: config.title ?? t("Pompa ciepła", "Heat pump"),
      views: [
        {
          title: t("Pompa ciepła", "Heat pump"), path: "pompa", icon: "mdi:heat-pump", type: "sections", max_columns: 3,
          sections: [
            { type: "grid", column_span: 2, cards: [card("immergas-diagram-card", { grid_options: { columns: "full" }, stats: false, ...(config.diagram ?? {}) }), card("immergas-charts-card", { grid_options: { columns: "full" } }),
              card("immergas-states-card", { grid_options: { columns: "full" } }),
              card("immergas-links-card", { grid_options: { columns: "full" } })] },
            { type: "grid", cards: [card("immergas-now-card", { grid_options: { columns: "full" }, ...(config.now ?? {}) }), card("immergas-setpoints-card", { grid_options: { columns: "full" }, ...(config.setpoints ?? {}) })] },
            { type: "grid", cards: [card("immergas-mode-card", { grid_options: { columns: "full" }, ...(config.mode ?? {}) }),
              card("immergas-busmap-card", { grid_options: { columns: "full" } })] },
            { type: "grid", cards: [card("immergas-curve-card", { grid_options: { columns: "full" }, ...(config.curve ?? {}) }),
              card("immergas-gas-card", { grid_options: { columns: "full" } })] },
            { type: "grid", cards: [card("immergas-schedule-card", { grid_options: { columns: "full" }, ...(config.schedule ?? {}) }), card("immergas-dhw-card", { grid_options: { columns: "full" } })] },
            { type: "grid", column_span: 2, cards: [card("immergas-water-card", { grid_options: { columns: "full" } })] },
            { type: "grid", column_span: 2, cards: [card("immergas-refrigerant-card", { grid_options: { columns: "full" }, flags: false })] },
            { type: "grid", column_span: 3, cards: [card("immergas-calibration-card", { grid_options: { columns: "full" }, ...(config.curve?.max_floor_entity ? { max_floor_entity: config.curve.max_floor_entity } : {}), ...(config.calibration ?? {}) })] },
            ...(autos ? [{ type: "grid", column_span: 3, cards: [card("immergas-automations-card", { grid_options: { columns: "full" }, ...(config.automations ?? {}) })] }] : []),
            { type: "grid", column_span: 3, cards: [
              card("immergas-settings-card", { grid_options: { columns: 18 }, part: "online", ...(config.settings ?? {}) }),
              card("immergas-settings-card", { grid_options: { columns: 18 }, part: "offline", ...(config.settings ?? {}) })] },
          ],
        },
      ],
    };
  }
}

// `strategy: { type: custom:immergas-dominus }`: the reduced dashboard for the Immergas Dominus integration (no hub) -
// what the Dominus module reads over local TCP: now, setpoints, operating mode, schedules and the connection
class ImmergasDominusStrategy {
  static async generate(config: any, hass: any) {
    const l = String(hass?.locale?.language ?? hass?.language ?? "en").slice(0, 2), lang = LANGS.includes(l) ? l : "en";
    const t = (a: string, b: string) => translate(lang, a, b);
    const card = (type: string, extra: Record<string, unknown> = {}) => ({ type: "custom:" + type, grid_options: { columns: "full" }, source: "dominus", ...extra });
    // OpenTherm mode (VICTRIX ZEUS / AVIO, STAR …): the integration exposes only the OpenTherm Data-IDs - the same cards
    // without the ones that have nothing to show there (schedules, curve, statistics, settings)
    const ot = otEntities(hass);
    if (config.opentherm === true || (config.opentherm !== false && ot.ot_mode && !ot.fault_code)) return otDashboard(config, t);
    return {
      title: config.title ?? "Immergas Dominus",
      views: [
        {
          title: t("Kocioł", "Boiler"), path: "dominus", icon: "mdi:water-boiler", type: "sections", max_columns: 3,
          sections: [
            { type: "grid", column_span: 3, cards: [card("immergas-diagram-card", { stats: false, ...(config.diagram ?? {}) })] },
            { type: "grid", cards: [card("immergas-now-card", config.now ?? {}), card("immergas-setpoints-card", config.setpoints ?? {})] },
            { type: "grid", cards: [card("immergas-mode-card", config.mode ?? {}), card("immergas-links-card"),
              card("immergas-settings-card", { part: "online", ...(config.settings ?? {}) }),
              card("immergas-settings-card", { part: "offline", ...(config.settings ?? {}) })] },
            { type: "grid", cards: [card("immergas-schedule-card", config.schedule ?? {}), card("immergas-curve-card", config.curve ?? {})] },
            { type: "grid", column_span: 3, cards: [card("immergas-calibration-card", config.calibration ?? {})] },
            { type: "grid", column_span: 3, cards: [card("immergas-automations-card", config.automations ?? {})] },
            { type: "grid", column_span: 3, cards: [card("immergas-charts-card", config.charts ?? {})] },
          ],
        },
      ],
    };
  }
}

/** entity ids of the Immergas Dominus integration by translation key (first config entry wins) */
function otEntities(hass: any): Record<string, string> {
  const r: Record<string, string> = {};
  for (const [id, e] of Object.entries<any>(hass?.entities ?? {}))
    // 0.52.4: skip orphans (registry entries left by an earlier Modbus setup: no state, or a "restored" one) - they made
    // an OpenTherm installation look like Modbus (#2)
    if (e.platform === "immergas_dominus" && e.translation_key && !r[e.translation_key] && liveEntity(hass, id)) r[e.translation_key] = id;
  return r;
}

/** the entity is provided by the integration now (not just a leftover registry entry restored as unavailable) */
function liveEntity(hass: any, id: string): boolean {
  const s = hass?.states?.[id];
  return !!s && !s.attributes?.restored;
}

/** OpenTherm: the same Dominus cards in the same style; only what OpenTherm has no data for is left out (heating curve
 *  of the Magis, calibration / statistics, offline settings, automations, connectivity). The schedules are the programs
 *  the integration keeps in Home Assistant (Dominus 1.6). */
function otDashboard(config: any, t: (a: string, b: string) => string) {
  const card = (type: string, extra: Record<string, unknown> = {}) => ({ type: "custom:" + type, grid_options: { columns: "full" }, source: "dominus", ...extra });
  return {
    title: config.title ?? "Immergas Dominus",
    views: [{
      title: t("Kocioł", "Boiler"), path: "dominus", icon: "mdi:water-boiler", type: "sections", max_columns: 3,
      sections: [
        { type: "grid", column_span: 3, cards: [card("immergas-diagram-card", { stats: false, ...(config.diagram ?? {}) })] },
        { type: "grid", cards: [card("immergas-now-card", config.now ?? {})] },
        { type: "grid", cards: [card("immergas-setpoints-card", config.setpoints ?? {})] },
        { type: "grid", cards: [card("immergas-mode-card", config.mode ?? {}), card("immergas-settings-card", { part: "online", ...(config.settings ?? {}) })] },
        { type: "grid", cards: [card("immergas-schedule-card", config.schedule ?? {})] },
        { type: "grid", cards: [card("immergas-ot-boiler-card", config.ot_boiler ?? {})] },
        { type: "grid", cards: [card("immergas-ot-map-card", config.ot_map ?? {})] },
        { type: "grid", column_span: 3, cards: [card("immergas-charts-card", config.charts ?? {})] },
      ],
    }],
  };
}

if (!customElements.get("ll-strategy-dashboard-immergas-dominus")) {
  customElements.define("ll-strategy-dashboard-immergas-dominus", class extends HTMLElement {
    static generate = ImmergasDominusStrategy.generate;
  } as any);
}

if (!customElements.get("ll-strategy-dashboard-immergas-hub")) {
  customElements.define("ll-strategy-dashboard-immergas-hub", class extends HTMLElement {
    static generate = ImmergasHubStrategy.generate;
  } as any);
}
