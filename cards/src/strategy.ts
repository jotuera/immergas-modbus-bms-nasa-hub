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
            { type: "grid", cards: [card("immergas-mode-card", { grid_options: { columns: "full" }, ...(config.mode ?? {}) })] },
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
    // OpenTherm mode (VICTRIX ZEUS / AVIO, STAR …): the integration exposes only the OpenTherm Data-IDs, so the
    // hub cards (schedules, curve, statistics) have nothing to show - a reduced view from standard HA cards instead
    const ot = otEntities(hass);
    if (config.opentherm === true || (config.opentherm !== false && ot.ot_mode && !ot.fault_code)) return otDashboard(config, t, ot);
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
    if (e.platform === "immergas_dominus" && e.translation_key && !r[e.translation_key]) r[e.translation_key] = id;
  return r;
}

/** the reduced OpenTherm dashboard: now, control, history - only entities that exist are placed */
function otDashboard(config: any, t: (a: string, b: string) => string, ot: Record<string, string>) {
  const has = (k: string) => !!ot[k];
  const tile = (k: string, extra: Record<string, unknown> = {}) => ({ type: "tile", entity: ot[k], ...extra });
  const tiles = (keys: string[], extra: Record<string, unknown> = {}) => keys.filter(has).map((k) => tile(k, extra));
  const heading = (text: string, icon: string) => ({ type: "heading", heading: text, icon });
  const graph = (title: string, keys: string[], hours = 24) =>
    keys.some(has) ? [{ type: "history-graph", title, hours_to_show: hours, grid_options: { columns: "full" }, entities: keys.filter(has).map((k) => ({ entity: ot[k] })) }] : [];
  const control = [
    ...(has("ot_mode") ? [tile("ot_mode", { grid_options: { columns: "full" }, features: [{ type: "select-options" }], features_position: "bottom" })] : []),
    ...tiles("ot_ch_setpoint ot_dhw_setpoint".split(" "), { grid_options: { columns: "full" }, features: [{ type: "numeric-input", style: "buttons" }], features_position: "bottom" }),
  ];
  return {
    title: config.title ?? "Immergas Dominus",
    views: [{
      title: t("Kocioł", "Boiler"), path: "dominus", icon: "mdi:water-boiler", type: "sections", max_columns: 3,
      sections: [
        { type: "grid", cards: [heading(t("Teraz", "Now"), "mdi:gauge"),
          ...tiles(["ot_flow_temperature", "ot_return_temperature", "ot_dhw_temperature", "ot_outside_temperature",
            "ot_modulation_level", "ot_ch_water_pressure", "ot_dhw_flow_rate"]),
          ...tiles(["ot_flame", "ot_ch_active", "ot_dhw_active", "ot_fault"]),
          ...tiles(["ot_fault_code"], { grid_options: { columns: "full" } })] },
        { type: "grid", cards: [heading(t("Sterowanie", "Control"), "mdi:tune-variant"), ...control,
          ...tiles(["ot_max_ch_setpoint"], { grid_options: { columns: "full" } }),
          { type: "markdown", grid_options: { columns: "full" }, content: t(
            "OpenTherm: tryb, nastawa CO i CWU. Gdy do kotła jest podłączony pilot **CAR V2 (Amico V2)**, to on steruje – nastawy CWU nie da się zmienić, a harmonogram tygodniowy prowadzi pilot. Moduł Dominus przyjmuje **jedno połączenie naraz** – przed zmianą nastaw zamknij aplikację Dominus.",
            "OpenTherm: mode, CH and DHW setpoint. With a **CAR V2 (Amico V2)** remote wired to the boiler the remote is in charge – the DHW setpoint cannot be changed and the weekly schedule runs on the remote. The Dominus module accepts **one connection at a time** – close the Dominus app before changing setpoints.") }] },
        { type: "grid", cards: [heading(t("Historia", "History"), "mdi:chart-line"),
          ...graph(t("Temperatury", "Temperatures"), ["ot_flow_temperature", "ot_return_temperature", "ot_dhw_temperature", "ot_outside_temperature"]),
          ...graph(t("Praca palnika", "Burner"), ["ot_modulation_level", "ot_flame", "ot_ch_active", "ot_dhw_active"]),
          ...graph(t("Ciśnienie", "Pressure"), ["ot_ch_water_pressure"], 72)] },
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
