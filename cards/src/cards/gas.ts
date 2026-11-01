// "Koszt ciepła / Heat cost": cost of 1 kWh of heat from the heat pump, the electric heater and (Combo only) the gas
// boiler, with a verdict and price steppers. Views Combo (pump / gas / heater) and Pro (pump / heater, no gas),
// switchable in the card; the default follows the system model (TT D61) or the option variant: combo | pro.
// Heater: electricity price / heater_efficiency (default 1.0 - resistive heater).
import { HubCard, html, css, nothing, c, ca, box, register } from "../base";
import { Key } from "../names";

class ImmergasGasCard extends HubCard {
  private variant = "";
  private showSet = false;

  private get combo() {
    const v = this.variant || this.config.variant;
    if (v) return v === "combo";
    const m = (this.s("d61") ?? "").toLowerCase();
    return m ? /combo|\(mc/.test(m) : true;
  }

  private bar(k: Key, icon: string, col: string, label: string, v: number, mx: number, best: boolean, note?: string) {
    return html`<div class="bar" @click=${() => this.moreInfo(k)}>
      <div class="bh"><ha-icon icon=${icon} style="color:${c(col)}"></ha-icon>${label}
        ${best ? html`<span class="best" style="color:${c("green")};border-color:${ca("green", 0.5)}">${this.t("najtaniej", "cheapest")}</span>` : nothing}
        ${note ? html`<span class="bn">${note}</span>` : nothing}
        <span class="bv" style="color:${c(col)}">${this.f(v, 2, 2)} ${this.currency}/kWh</span></div>
      <div class="bt" style="background:${ca(col, 0.12)}"><div style="width:${isNaN(v) ? 0 : Math.max(3, v / mx * 100)}%;background:${c(col)};box-shadow:0 0 6px ${ca(col, 0.6)}"></div></div></div>`;
  }

  protected body() {
    const combo = this.combo, run = this.n("hz") > 0;
    const pe = this.n("price_elec"), eff = this.config.heater_efficiency ?? 1;
    const kp = this.n("hp_cost"), kg = combo ? this.n("gas_cost") : NaN, kh = isNaN(pe) ? NaN : pe / eff;
    const cop = this.n("cop"), copEff = !isNaN(kp) && kp > 0 && !isNaN(pe) ? pe / kp : NaN; // COP the shown pump cost is based on
    const opts: [string, number, string, string][] = [["hp", kp, "teal", this.t("Pompa ciepła", "Heat pump")], ["heater", kh, "yellow", this.t("Grzałka", "Heater")]];
    if (combo) opts.splice(1, 0, ["gas", kg, "peach", this.t("Kocioł gazowy", "Gas boiler")]);
    const valid = opts.filter(([, v]) => !isNaN(v));
    const best = valid.length ? valid.reduce((a, b) => (b[1] < a[1] ? b : a)) : null;
    const second = best ? valid.filter((o) => o !== best).reduce<[string, number, string, string] | null>((a, b) => (!a || b[1] < a[1] ? b : a), null) : null;
    const vc = best ? best[2] : "overlay1";
    const sav = best && second && second[1] > 0 ? Math.round((second[1] - best[1]) / second[1] * 100) : null;
    const mx = Math.max(...valid.map(([, v]) => v), 0.01);
    const kpNote = run && !isNaN(kp) ? this.t("teraz", "now") : !isNaN(kp) ? this.t("ostatnio z pracy", "last while running") : this.t("czeka na pracę sprężarki", "waiting for the compressor");
    const icon = (id: string) => id === "hp" ? "mdi:heat-pump" : id === "gas" ? "mdi:fire" : "mdi:heating-coil";
    const tab = (id: string, lbl: string) => html`<div class="tab" style=${(id === "combo") === combo ? `background:${ca("teal", 0.24)};border-color:${ca("teal", 0.6)}` : ""}
      @click=${() => { this.variant = id; this.requestUpdate(); }}>${lbl}</div>`;
    return html`
      <div class="top">
        <div class="tl"><ha-icon icon="mdi:scale-balance"></ha-icon><span class="ttl">${combo ? this.t("Pompa, gaz czy grzałka?", "Heat pump, gas or heater?") : this.t("Pompa czy grzałka?", "Heat pump or heater?")}</span></div>
        <div class="tabs">${tab("combo", "Combo")}${tab("pro", "Pro")}
          <div class="gear ${this.showSet ? "on" : ""}" title=${this.t("Ceny", "Prices")} @click=${() => { this.showSet = !this.showSet; this.requestUpdate(); }}><ha-icon icon="mdi:cog-outline"></ha-icon></div></div></div>
      <div class="verdict" style=${box(vc, !!best)} @click=${() => this.moreInfo(combo ? "hp_cheaper" : "hp_cost")}>
        <ha-icon icon=${best ? icon(best[0]) : "mdi:help-circle-outline"} style="color:${c(vc)}"></ha-icon>
        <div class="cx"><div class="vt" style="color:${c(vc)}">${best ? this.t("Najtaniej: ", "Cheapest: ") + best[3].toLowerCase() : this.t("Brak danych", "No data")}</div>
          <div class="vs">${sav !== null && second ? this.t(`${sav}% taniej niż ${second[3].toLowerCase()}`, `${sav}% cheaper than ${second[3].toLowerCase()}`) : this.t("porównanie kosztu 1 kWh ciepła", "cost of 1 kWh of heat compared")}${!isNaN(copEff) ? ` · COP ${this.f(run && !isNaN(cop) ? cop : copEff, 2, 2)}${run ? "" : this.t(" (ostatni)", " (last)")}` : ""}</div></div></div>
      ${this.bar("hp_cost", "mdi:heat-pump-outline", "teal", this.t("Ciepło z pompy", "Heat from heat pump"), kp, mx, best?.[0] === "hp", kpNote)}
      ${combo ? this.bar("gas_cost", "mdi:fire", "peach", this.t("Ciepło z gazu", "Heat from gas"), kg, mx, best?.[0] === "gas") : nothing}
      ${this.bar("price_elec", "mdi:heating-coil", "yellow", this.t("Ciepło z grzałki", "Heat from heater"), kh, mx, best?.[0] === "heater",
        eff === 1 ? this.t("prąd 1:1", "electricity 1:1") : this.t(`sprawność ${eff}`, `efficiency ${eff}`))}
      ${!isNaN(copEff) && !isNaN(kh) ? html`<div class="ratio">${this.t("Pompa daje", "The heat pump gives")} <b style="color:${c("teal")}">${this.f(copEff, 1, 1)}×</b> ${this.t("więcej ciepła z 1 kWh prądu niż grzałka", "more heat from 1 kWh of electricity than the heater")}</div>` : nothing}
      ${this.showSet ? html`<div class="setp">
        ${this.numRow("price_elec", "mdi:flash", this.t("Cena prądu", "Electricity price"), 3)}
        ${combo ? this.numRow("price_gas", "mdi:fire", this.t("Cena gazu", "Gas price"), 2) : nothing}</div>` : nothing}
      <div class="note">ℹ️ ${combo
        ? this.t("Pompa = cena prądu ÷ COP, gaz = cena gazu w przeliczeniu na kWh ciepła z kotła, grzałka = cena prądu (1 kWh prądu = 1 kWh ciepła).",
          "Heat pump = electricity price ÷ COP, gas = gas price per kWh of heat from the boiler, heater = electricity price (1 kWh of electricity = 1 kWh of heat).")
        : this.t("Magis Pro nie ma kotła gazowego: rezerwą jest grzałka elektryczna. Pompa = cena prądu ÷ COP, grzałka = cena prądu.",
          "Magis Pro has no gas boiler: the backup is the electric heater. Heat pump = electricity price ÷ COP, heater = electricity price.")}</div>`;
  }

  static styles = [HubCard.styles, css`
    .top { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
    .tl { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .tl ha-icon { --mdc-icon-size: 18px; opacity: .55; }
    .ttl { font-size: 10.5px; font-weight: 800; opacity: .55; letter-spacing: .08em; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tabs { display: flex; gap: 4px; flex: none; align-items: center; }
    .tab { cursor: pointer; padding: 3px 9px; border-radius: 9px; font-size: 10.5px; font-weight: 800; border: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.04); }
    .verdict { cursor: pointer; display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 14px; }
    .verdict ha-icon { --mdc-icon-size: 26px; flex: none; }
    .vt { font-size: 14px; font-weight: 800; }
    .vs { font-size: 10.5px; opacity: .6; }
    .bar { cursor: pointer; margin-top: 8px; }
    .bh { display: flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 800; }
    .bh ha-icon { --mdc-icon-size: 16px; flex: none; }
    .best { font-size: 9px; font-weight: 800; padding: 0 5px; border: 1px solid; border-radius: 6px; }
    .bn { font-size: 9.5px; font-weight: 700; opacity: .5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bv { margin-left: auto; flex: none; }
    .bt { height: 7px; border-radius: 5px; margin-top: 4px; overflow: hidden; }
    .bt > div { height: 100%; border-radius: 5px; }
    .ratio { font-size: 11px; opacity: .8; margin-top: 8px; }
  `];
}

register("immergas-gas-card", ImmergasGasCard, "Immergas – Koszt ciepła / Heat cost",
  "Koszt 1 kWh ciepła z pompy, grzałki i (Combo) kotła gazowego; widoki Combo / Pro, werdykt, ceny");
