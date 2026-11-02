// "Ustawienia / Settings": a discreet, collapsed card with the hub configuration: electricity and gas price, DHW cylinder
// capacity, gas-estimate calibration, DHW boost duration, fault description language and the night-function window
// (U12 / U13 are not on any bus: options night_start / night_stop point to input_datetime helpers, edited here ±15 min).
// Option: expanded: true (open by default).
import { HubCard, html, css, nothing, register } from "../base";

class ImmergasSettingsCard extends HubCard {
  private open: boolean | null = null;

  private timeRow(entity: string | undefined, label: string, icon = "mdi:weather-night") {
    const st = entity ? this.hass.states[entity] : undefined;
    if (!st) return nothing;
    const v = /^\d\d:\d\d/.test(st.state) ? st.state.slice(0, 5) : "–";
    const bump = (d: number) => {
      if (v === "–") return;
      const m = ((+v.slice(0, 2) * 60 + +v.slice(3, 5) + d) % 1440 + 1440) % 1440;
      const t = String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0") + ":00";
      this.hass.callService("input_datetime", "set_datetime", { entity_id: entity, time: t });
    };
    return html`<div class="nr"><ha-icon icon=${icon}></ha-icon>
      <span class="nl" @click=${() => this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: entity }, bubbles: true, composed: true }))}>${label}</span>
      <div class="btn xs" @click=${() => bump(-15)}><ha-icon icon="mdi:minus"></ha-icon></div><span class="nv">${v}</span>
      <div class="btn xs" @click=${() => bump(15)}><ha-icon icon="mdi:plus"></ha-icon></div></div>`;
  }

  /** input_select day helper (e.g. anti-legionella day): previous / next option */
  private selRow(entity: string | undefined, label: string, icon: string) {
    const st = entity ? this.hass.states[entity] : undefined;
    if (!entity || !st || !entity.startsWith("input_select.")) return nothing;
    const step = (d: number) => this.hass.callService("input_select", d < 0 ? "select_previous" : "select_next", { entity_id: entity, cycle: true });
    return html`<div class="nr"><ha-icon icon=${icon}></ha-icon>
      <span class="nl" @click=${() => this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: entity }, bubbles: true, composed: true }))}>${label}</span>
      <div class="btn xs" @click=${() => step(-1)}><ha-icon icon="mdi:minus"></ha-icon></div><span class="nv">${st.state}</span>
      <div class="btn xs" @click=${() => step(1)}><ha-icon icon="mdi:plus"></ha-icon></div></div>`;
  }

  protected body() {
    const open = this.open ?? !!this.config.expanded;
    const lang = this.so("err_lang"), opts: string[] = lang?.attributes?.options ?? [];
    const night = this.opt("night_start") || this.opt("night_stop"), leg = this.opt("legionella_day") || this.opt("legionella_time");
    return html`
      <div class="sh" @click=${() => { this.open = !open; this.requestUpdate(); }}>
        <ha-icon icon="mdi:cog-outline"></ha-icon><span class="ttl">${this.dominus ? this.t("Ustawienia", "Settings") : this.t("Ustawienia huba", "Hub settings")}</span>
        <span class="sum">${open ? "" : this.dominus ? this.t("język opisów błędów", "fault description language") : this.t("ceny, zasobnik, tryb nocny, legionella…", "prices, cylinder, night mode, legionella…")}</span>
        <ha-icon class="chev" icon=${open ? "mdi:chevron-up" : "mdi:chevron-down"}></ha-icon></div>
      ${open && !this.dominus ? html`
        <div class="grp">${this.t("Ceny energii", "Energy prices")}</div>
        ${this.numRow("price_elec", "mdi:flash", this.t("Cena prądu", "Electricity price"), 3)}
        ${this.numRow("price_gas", "mdi:fire", this.t("Cena gazu", "Gas price"), 2)}
        <div class="grp">${this.t("Ciepła woda", "Hot water")}</div>
        ${this.numRow("tank_vol", "mdi:water-boiler", this.t("Pojemność zasobnika CWU", "DHW cylinder capacity"), 0)}
        ${this.numRow("boost_min", "mdi:timer-play-outline", this.t("Czas wymuszenia CWU", "DHW boost duration"), 0)}
        <div class="grp">${this.t("Szacowanie gazu", "Gas estimate")}</div>
        ${this.numRow("gas_cal_co", "mdi:radiator", this.t("Zużycie gazu CO", "Gas use CH"), 2)}
        ${this.numRow("gas_cal_dhw", "mdi:water-thermometer", this.t("Zużycie gazu CWU", "Gas use DHW"), 2)}
        ${night ? html`<div class="grp">${this.t("Tryb nocny U11 (przypomnienie – ustawia się na piecu)", "Night mode U11 (reminder – set on the boiler)")}</div>
          ${this.timeRow(this.opt("night_start"), "START · U12")}
          ${this.timeRow(this.opt("night_stop"), "STOP · U13")}` : nothing}
        ${leg ? html`<div class="grp">${this.t("Anty-legionella P15 (przypomnienie – ustawia się na piecu)", "Anti-legionella P15 (reminder – set on the boiler)")}</div>
          ${this.selRow(this.opt("legionella_day"), this.t("Dzień", "Day"), "mdi:calendar-week")}
          ${this.timeRow(this.opt("legionella_time"), this.t("Godzina", "Time"), "mdi:bacteria-outline")}` : nothing}
      ` : nothing}
      ${open && lang ? html`<div class="grp">${this.t("Opisy błędów", "Fault descriptions")}</div>
          <div class="nr"><ha-icon icon="mdi:translate"></ha-icon><span class="nl">${this.t("Język", "Language")}</span>
            <select class="langs" .value=${lang.state} @change=${(e: Event) => { const o = (e.target as HTMLSelectElement).value; if (o !== lang.state) this.call("select", "select_option", "err_lang", { option: o }); }}>
              ${opts.map((o) => html`<option value=${o} ?selected=${o === lang.state}>${this.hass.formatEntityState?.(lang, o) ?? o}</option>`)}</select></div>` : nothing}`;
  }

  static styles = [HubCard.styles, css`
    ha-card { padding: 8px 12px; }
    .sh { cursor: pointer; display: flex; align-items: center; gap: 8px; }
    .sh > ha-icon { --mdc-icon-size: 17px; opacity: .55; }
    .ttl { font-size: 10.5px; font-weight: 800; opacity: .55; letter-spacing: .08em; text-transform: uppercase; }
    .sum { flex: 1; font-size: 10.5px; opacity: .4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .chev { margin-left: auto; }
    .grp { font-size: 9.5px; font-weight: 800; opacity: .45; letter-spacing: .06em; text-transform: uppercase; margin: 10px 0 2px; }
    .langs { cursor: pointer; margin-left: auto; padding: 4px 8px; border-radius: 8px; font: inherit; font-size: 12px; font-weight: 700; color: inherit;
      border: 1px solid rgba(var(--ih-teal-rgb), .45); background: rgba(var(--ih-teal-rgb), .1); }
    .langs option { color: #1e1e2e; }
  `];
}

register("immergas-settings-card", ImmergasSettingsCard, "Immergas – Ustawienia / Settings",
  "Dyskretna, zwinięta karta ustawień huba: ceny prądu i gazu, zasobnik CWU, kalibracja gazu, okno trybu nocnego, język błędów");
