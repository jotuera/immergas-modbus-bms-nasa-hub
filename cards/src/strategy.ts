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
            { type: "grid", column_span: 3, cards: [card("immergas-settings-card", { grid_options: { columns: "full" }, ...(config.settings ?? {}) })] },
          ],
        },
      ],
    };
  }
}

if (!customElements.get("ll-strategy-dashboard-immergas-hub")) {
  customElements.define("ll-strategy-dashboard-immergas-hub", class extends HTMLElement {
    static generate = ImmergasHubStrategy.generate;
  } as any);
}
