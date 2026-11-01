// "Ostatni cykl CWU / Last DHW cycle": source, duration, electricity, heat (cylinder / flow), COP and the cycle cost
// against the same heat from the gas boiler (Combo) or from the electric heater (Pro, no gas). The view follows the
// system model (TT D61) or the option variant: combo | pro, and can be switched in the card.
import { HubCard, html, css, nothing, c, ca, box, register } from "../base";
import { isDhw, srcKind } from "./timers";

const copCol = (v: number) => isNaN(v) || v <= 0 ? "overlay1" : v < 2 ? "red" : v < 2.7 ? "peach" : v < 3.5 ? "yellow" : "green";

class ImmergasDhwCard extends HubCard {
  private variant = "";

  private get combo() {
    const v = this.variant || this.config.variant;
    if (v) return v === "combo";
    const m = (this.s("d61") ?? "").toLowerCase();
    return m ? /combo|\(mc/.test(m) : true;
  }

  protected body() {
    const combo = this.combo;
    const src = this.s("dhw_src") ?? "";
    const sk = srcKind(src);
    const sc = this.bad("dhw_src") ? "overlay1" : sk === "hpb" ? "yellow" : sk === "boiler" ? "peach" : sk === "hp" ? "teal" : "overlay2";
    const si = sk === "hpb" ? "mdi:heat-pump-outline" : sk === "boiler" ? "mdi:fire" : "mdi:heat-pump";
    const ct = this.n("dhw_cop_tank"), cf = this.n("dhw_cop_flow"), cost = this.n("dhw_cost");
    // the same heat from the alternative: gas boiler (Combo) or the electric heater, 1 kWh of heat per kWh (Pro)
    const heatTank = this.n("dhw_heat_tank"), pe = this.n("price_elec");
    const cg = combo ? this.n("dhw_cost_gas") : heatTank > 0 && pe > 0 ? heatTank * pe : NaN;
    const running = isDhw(this.s("state"));
    const tank = this.n("tank"), set = this.n("dhw_active_set");
    const cheaper = !isNaN(cost) && !isNaN(cg) ? (cost <= cg) : null;
    const tab = (id: string, lbl: string) => html`<div class="tab" style=${(id === "combo") === combo ? `background:${ca("teal", 0.24)};border-color:${ca("teal", 0.6)}` : ""}
      @click=${(e: Event) => { e.stopPropagation(); this.variant = id; this.requestUpdate(); }}>${lbl}</div>`;
    const big = (k: any, lbl: string, v: number, col: string) => html`<div class="big" style=${box(col, false)} @click=${() => this.moreInfo(k)}>
      <div class="lbl">${lbl}</div><div class="bv" style="color:${c(col)};text-shadow:0 0 10px ${ca(col, 0.4)}">${this.f(v, 2, 2)}</div></div>`;
    return html`
      ${this.head("mdi:water-boiler", this.t("Ostatni cykl CWU", "Last DHW cycle"),
        html`<span class="tabs">${running ? html`<span style="color:${c("yellow")};font-weight:800">${this.t("● trwa grzanie", "● heating now")}</span>` : nothing}
          ${tab("combo", "Combo")}${tab("pro", "Pro")}</span>`)}
      <div class="top" style=${box(sc, true)} @click=${() => this.moreInfo("dhw_src")}>
        <ha-icon icon=${si} style="color:${c(sc)}"></ha-icon>
        <div class="cx"><div class="st" style="color:${c(sc)}">${this.bad("dhw_src") ? this.t("Brak cyklu", "No cycle yet") : src}</div>
          <div class="ss">${this.f(this.n("dhw_min"), 0)} min · ${this.f(this.n("dhw_elec"), 2, 2)} kWh ${this.t("prądu", "electricity")} ·
            ${this.t("zasobnik teraz", "cylinder now")} ${this.f(tank, 1, 1)} / ${this.f(set, 0)} °C</div></div></div>
      <div class="row">
        ${big("dhw_cop_tank", this.t("COP (zasobnik)", "COP (cylinder)"), ct, copCol(ct))}
        ${big("dhw_cop_flow", this.t("COP (przepływ)", "COP (flow)"), cf, copCol(cf))}
      </div>
      <div class="row">
        ${this.chip("dhw_heat_tank", "mdi:water-thermometer", "sky", this.t("Ciepło (zasobnik)", "Heat (cylinder)"), this.f(this.n("dhw_heat_tank"), 2, 2) + " kWh")}
        ${this.chip("dhw_heat_flow", "mdi:waves-arrow-right", "blue", this.t("Ciepło (przepływ)", "Heat (flow)"), this.f(this.n("dhw_heat_flow"), 2, 2) + " kWh")}
      </div>
      <div class="cost" style=${box(cheaper === null ? "overlay1" : cheaper ? "green" : "peach", false)} @click=${() => this.moreInfo("dhw_cost")}>
        <div class="cx"><div class="lbl">${this.t("Koszt cyklu", "Cycle cost")}</div><div class="val">${this.f(cost, 2, 2)} ${this.currency}</div></div>
        <div class="cx" @click=${(e: Event) => { e.stopPropagation(); this.moreInfo(combo ? "dhw_cost_gas" : "price_elec"); }}>
          <div class="lbl">${combo ? this.t("To samo z gazu", "Same heat from gas") : this.t("To samo z grzałki", "Same heat from the heater")}</div>
          <div class="val">${this.f(cg, 2, 2)} ${this.currency}</div></div>
        ${cheaper === null ? nothing : html`<div class="vd" style="color:${c(cheaper ? "green" : "peach")}">${cheaper ? this.t("pompa taniej", "heat pump cheaper") : (combo ? this.t("gaz taniej", "gas cheaper") : this.t("grzałka taniej", "heater cheaper"))}</div>`}
      </div>
      <div class="note">${this.t("Zasobnik: pojemność × przyrost temperatury (nie widzi poboru wody w trakcie). Przepływ: D14 × ΔT pompy. Prawda zwykle pomiędzy.",
        "Cylinder: capacity × temperature rise (misses hot water drawn during the cycle). Flow: D14 × heat-pump ΔT. The truth is usually in between.")}
        ${combo ? nothing : this.t(" Grzałka: ciepło z zasobnika × cena prądu (1 kWh prądu = 1 kWh ciepła).", " Heater: cylinder heat × electricity price (1 kWh of electricity = 1 kWh of heat).")}</div>`;
  }

  static styles = [HubCard.styles, css`
    .top { cursor: pointer; display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 14px; }
    .top ha-icon { --mdc-icon-size: 26px; flex: none; }
    .st { font-size: 14px; font-weight: 800; }
    .ss { font-size: 10.5px; opacity: .65; }
    .big { cursor: pointer; flex: 1 1 120px; padding: 8px 10px; border-radius: 12px; text-align: center; }
    .bv { font-size: 24px; font-weight: 800; line-height: 1.15; }
    .cost { cursor: pointer; display: flex; align-items: center; gap: 12px; margin-top: 8px; padding: 8px 12px; border-radius: 12px; }
    .vd { font-size: 12px; font-weight: 800; white-space: nowrap; }
    .tabs { display: inline-flex; gap: 4px; align-items: center; }
    .tab { cursor: pointer; padding: 3px 9px; border-radius: 9px; font-size: 10.5px; font-weight: 800; border: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.04); }
  `];
}

register("immergas-dhw-card", ImmergasDhwCard, "Immergas – Ostatni cykl CWU / Last DHW cycle",
  "Źródło, czas, prąd, ciepło (zasobnik i przepływ), COP i koszt ostatniego cyklu CWU w porównaniu z gazem (Combo) albo grzałką (Pro)");
