// "Nastawy / Setpoints": two tiles - space heating (zone 1) and DHW - with the measured temperature, what the unit
// is doing, a −/+ setpoint regulator and ready ECO / COMFORT profiles.
//  - CH profiles are the boiler's own Comfort / Eco presets of zone 1 (heat, or cool in the cooling mode); a profile
//    button writes that value as the zone 1 setpoint. The presets themselves are edited under the gear.
//  - DHW has no presets on the bus: card options dhw_eco / dhw_comfort - an input_number helper (edited under the gear)
//    or a literal value (default 45 / 55 °C).
// Options: humidity_entity / humidity_target (shown next to the room temperature), dhw_eco, dhw_comfort.
import { box, HubCard, html, css, nothing, c, ca, register } from "../base";
import { isDhw, isCool, parseState } from "./timers";
import { Key } from "../names";

const tempCol = (v: number) => isNaN(v) ? "overlay1" : v < 18 ? "sky" : v < 20 ? "teal" : v < 23 ? "green" : v < 25 ? "yellow" : "peach";

class ImmergasSetpointsCard extends HubCard {
  private pending: Partial<Record<Key, number>> = {};
  private timers: Partial<Record<Key, number>> = {};
  private gear = false;

  getCardSize() { return 4; }

  /** value shown for a number entity: the not yet written local value, else the entity state */
  private val(k: Key) { return this.pending[k] ?? this.n(k); }

  /** −/+ with a short debounce, so several taps add up before one write to the boiler */
  private bump(k: Key, dir: number) {
    if (this.otRO) return;
    const a = this.so(k)?.attributes ?? {}, step = a.step ?? 0.5, v = this.val(k);
    if (isNaN(v)) return;
    this.pending[k] = Math.round(Math.min(a.max ?? 99, Math.max(a.min ?? 0, v + dir * step)) * 100) / 100;
    clearTimeout(this.timers[k]);
    this.timers[k] = window.setTimeout(() => this.write(k, this.pending[k]!), 1200);
    this.requestUpdate();
  }
  private write(k: Key, v: number) {
    this.call("number", "set_value", k, { value: v });
    // keep the local value until the boiler reports it back (or 15 s pass)
    const t0 = Date.now();
    const done = () => { if (Math.abs(this.n(k) - v) < 0.01 || Date.now() - t0 > 15000) { delete this.pending[k]; this.requestUpdate(); } else setTimeout(done, 1000); };
    setTimeout(done, 1000);
  }
  private set(k: Key, v: number) {
    if (isNaN(v) || this.otRO) return;
    clearTimeout(this.timers[k]);
    this.pending[k] = v;
    this.write(k, v);
    this.requestUpdate();
  }

  private tileView(o: {
    k: Key; meas: Key; icon: string; col: string; title: string; sub: string; temp: number; extra?: unknown; status: string; active: boolean;
    profiles: [string, string, number][]; hint?: string;
  }) {
    const sp = this.val(o.k), pend = this.pending[o.k] !== undefined;
    const bg = `linear-gradient(180deg, ${ca(o.col, 0.1)} 0%, ${ca(o.col, 0.1)} 48%, ${ca(o.col, o.active ? 0.34 : 0.22)} 48%, ${ca(o.col, o.active ? 0.34 : 0.22)} 100%)`;
    return html`<div class="sp" style="background:${bg};border-color:${ca(o.col, o.active ? 0.6 : 0.25)};${o.active ? `box-shadow:0 0 12px ${ca(o.col, 0.3)}` : ""}">
      <div class="top" @click=${() => this.moreInfo(o.meas)}>
        <div class="cx"><div class="t1">${o.title}</div><div class="t2">${o.sub}</div></div>
        <ha-icon icon=${o.icon} style="color:${c(o.col)};${o.active ? `filter:drop-shadow(0 0 5px ${c(o.col)})` : "opacity:.8"}"></ha-icon></div>
      <div class="big" @click=${() => this.moreInfo(o.meas)}><span style="color:${c(o.col)}">${this.f(o.temp, 1, 1)}</span><span class="u" style="color:${c(o.col)}">°C</span>${o.extra ?? nothing}</div>
      <div class="st">${o.status}</div>
      <div class="reg">
        <div class="rb" style=${this.otRO ? "opacity:.35;cursor:default" : ""} @click=${() => this.bump(o.k, -1)}><ha-icon icon=${this.otRO ? "mdi:lock-outline" : "mdi:minus"}></ha-icon></div>
        <div class="rv" @click=${() => this.moreInfo(o.k)}><span class="rn" style=${pend ? `color:${c(o.col)}` : ""}>${this.f(sp, 1, 1)}°</span><span class="rl">${this.t("NASTAWA", "SETPOINT")}</span></div>
        <div class="rb" style=${this.otRO ? "opacity:.35;cursor:default" : ""} @click=${() => this.bump(o.k, 1)}><ha-icon icon=${this.otRO ? "mdi:lock-outline" : "mdi:plus"}></ha-icon></div></div>
      ${o.profiles.length ? html`<div class="pf">${o.profiles.map(([id, lbl, v]) => {
        const on = !isNaN(v) && Math.abs(sp - v) < 0.01, pc = id === "eco" ? "teal" : "peach";
        return html`<div class="pb" style=${on ? `background:${ca(pc, 0.3)};border-color:${ca(pc, 0.75)};color:${c(pc)}` : ""} @click=${() => !on && this.set(o.k, v)}>
          <span class="pl"><ha-icon icon=${id === "eco" ? "mdi:leaf" : "mdi:sofa-outline"} style="color:${c(pc)}"></ha-icon>${lbl}</span><span class="pv">${this.f(v, 1, 1)}°</span></div>`;
      })}</div>` : nothing}
      ${o.hint ? html`<div class="hint">${o.hint}</div>` : nothing}</div>`;
  }

  /** OpenTherm: the result of the last write for 3 minutes (the boiler read the value back - taken or not) */
  private lastWrite() {
    const so = this.so("ot_lastw");
    if (!this.ot || !so || this.bad("ot_lastw")) return nothing;
    const at = Date.parse(String(so.attributes?.at ?? ""));
    if (isNaN(at) || Date.now() - at > 180000) return nothing;
    setTimeout(() => this.requestUpdate(), 180000 - (Date.now() - at) + 500);
    const ok = so.state === "ok", miss = so.state === "mismatch";
    const col = ok ? "green" : miss ? "red" : "overlay2";
    return html`<div class="note" style=${box(col, false)} @click=${() => this.moreInfo("ot_lastw")}>
      <ha-icon icon=${ok ? "mdi:check-circle-outline" : miss ? "mdi:alert-circle-outline" : "mdi:information-outline"} style="color:${c(col)}"></ha-icon>
      ${this.t("Ostatni zapis", "Last write")}: ${this.txt("ot_lastw")}${miss ? this.t(" – kocioł potwierdził, ale trzyma swoją wartość (pilot?)", " – the boiler acknowledged it but keeps its own value (remote?)") : ""}</div>`;
  }

  /** DHW profile value: input_number helper state, a literal, or the default */
  private prof(opt: string, def: number) {
    const o = this.config[opt];
    if (o === undefined || o === null || o === "") return def;
    const v = parseFloat(this.hass.states[o]?.state ?? o);
    return isNaN(v) ? def : v;
  }
  /** −/+ row for an input_number helper given by entity id */
  private helperRow(entity: string | undefined, icon: string, label: string) {
    const st = entity ? this.hass.states[entity] : undefined;
    if (!entity || !st || !entity.startsWith("input_number.")) return nothing;
    const a = st.attributes ?? {}, v = parseFloat(st.state), step = a.step ?? 0.5;
    const set = (d: number) => !isNaN(v) && this.hass.callService("input_number", "set_value",
      { entity_id: entity, value: Math.round(Math.min(a.max ?? 99, Math.max(a.min ?? 0, v + d * step)) * 100) / 100 });
    return html`<div class="nr"><ha-icon icon=${icon}></ha-icon>
      <span class="nl" @click=${() => this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: entity }, bubbles: true, composed: true }))}>${label}</span>
      <div class="btn xs" @click=${() => set(-1)}><ha-icon icon="mdi:minus"></ha-icon></div><span class="nv">${this.f(v, 1, 1)} °C</span>
      <div class="btn xs" @click=${() => set(1)}><ha-icon icon="mdi:plus"></ha-icon></div></div>`;
  }

  protected body() {
    const modeIdx = ((this.attr("mode", "options") ?? []) as string[]).indexOf(this.s("mode") ?? ""), cool = !this.ot && modeIdx === 2;
    const st = this.s("state") ?? "";
    // Dominus has no operating state: the zone heating demand and the DHW request flags instead
    const dhwRun = this.dominus ? this.on("dom_dhw_request") : isDhw(st);
    const chRun = this.dominus ? !dhwRun && this.on("dom_ch_demand") : !dhwRun && (parseState(st).what === "heat" || isCool(st));

    // CH tile
    const z = this.n("zone1"), hum = this.config.humidity_entity ? parseFloat(this.hass.states[this.config.humidity_entity]?.state) : NaN;
    const ht = this.config.humidity_target ? parseFloat(this.hass.states[this.config.humidity_target]?.state ?? this.config.humidity_target) : NaN;
    const cKey: Key = cool ? "comfort_cool" : "comfort_heat", eKey: Key = cool ? "eco_cool" : "eco_heat";
    // AUTO program: the hub select, or (Dominus) a Comfort / Eco phase of the zone
    const auto = (() => { const o: string[] = this.attr("prog_mode", "options") ?? []; return o.length === 2 && this.s("prog_mode") === o[1]; })()
      || (this.dominus && ["comfort", "economy"].includes(this.s("zone1_phase") ?? ""));
    const phase = this.bad("zone1_phase") ? "" : this.txt("zone1_phase")!;
    const otRoom = this.ot && !!this.eid("ot_room_set"), zr = this.n("zone1");
    const ch = otRoom ? this.tileView({
      k: "ot_room_set", meas: this.eid("zone1") ? "zone1" : "ot_flow", icon: "mdi:radiator", col: tempCol(zr), title: this.t("Ogrzewanie", "Heating"),
      sub: this.t("CO · pokój", "CH · room"), temp: this.eid("zone1") ? zr : this.n("ot_flow"),
      status: chRun ? this.t("grzeje", "heating") : this.t("czuwa", "standby"), active: chRun,
      profiles: this.eid("comfort_heat") ? [["eco", this.t("EKO", "ECO"), this.n("eco_heat")], ["comfort", this.t("KOMFORT", "COMFORT"), this.n("comfort_heat")]] : [],
      hint: (auto ? this.t("program AUTO: nastawę zmienia harmonogram", "AUTO program: the schedule changes the setpoint") + (phase ? this.t(" · teraz ", " · now ") + phase : "") + " · " : "")
        + this.t("maks. zasilanie ", "max. flow ") + this.f(this.n("ot_ch_set"), 0) + " °C",
    }) : this.ot ? this.tileView({
      k: "ot_ch_set", meas: "ot_flow", icon: "mdi:radiator", col: "peach", title: this.t("Ogrzewanie", "Heating"), sub: this.t("CO · temperatura zasilania", "CH · flow temperature"),
      temp: this.n("ot_flow"), status: chRun ? this.t("grzeje", "heating") : this.t("czuwa", "standby"), active: chRun, profiles: [],
      hint: this.t("nastawa = maks. temperatura zasilania; z pilotem CAR V2 pilot prowadzi krzywą grzewczą", "setpoint = max flow temperature; with a CAR V2 remote the remote runs the heating curve"),
    }) : this.tileView({
      k: "zone1_set", meas: "zone1", icon: cool ? "mdi:snowflake" : "mdi:radiator", col: cool ? "sky" : tempCol(z),
      title: cool ? this.t("Chłodzenie", "Cooling") : this.t("Ogrzewanie", "Heating"), sub: this.t("CO · strefa 1", "CH · zone 1"), temp: z,
      extra: !isNaN(hum) ? html`<span class="hum"><ha-icon icon="mdi:water-percent"></ha-icon>${Math.round(hum)}%${!isNaN(ht) ? html`<span style="opacity:.55"> / ${Math.round(ht)}%</span>` : nothing}</span>` : nothing,
      status: chRun ? (cool ? this.t("chłodzi", "cooling") : this.t("grzeje", "heating")) : this.t("czuwa", "standby"), active: chRun,
      profiles: [["eco", this.t("EKO", "ECO"), this.n(eKey)], ["comfort", this.t("KOMFORT", "COMFORT"), this.n(cKey)]],
      hint: auto ? this.t("program AUTO: nastawę zmienia harmonogram", "AUTO program: the schedule changes the setpoint") + (phase ? this.t(" · teraz ", " · now ") + phase : "") : undefined,
    });

    // DHW tile
    const tank = this.n("tank"), act = this.n("dhw_active_set"), set = this.n("dhw_set");
    // DHW profiles: the DD entities (DD >= 2.4.0) or, on older DD, card options dhw_eco / dhw_comfort
    const dd = !!this.eid("dhw_comfort_dd") && !!this.eid("dhw_eco_dd");
    const dEco = dd ? this.n("dhw_eco_dd") : this.prof("dhw_eco", 45), dCom = dd ? this.n("dhw_comfort_dd") : this.prof("dhw_comfort", 55);
    const dhw = this.ot ? this.tileView({
      k: "dhw_set", meas: "tank", icon: "mdi:water-boiler", col: "peach", title: this.t("Ciepła woda", "Hot water"), sub: this.t("CWU", "DHW"), temp: tank,
      status: dhwRun ? this.t("grzeje", "heating") : this.t("czuwa", "standby"), active: dhwRun,
      profiles: this.eid("dhw_comfort_dd") ? [["eco", this.t("EKO", "ECO"), this.n("dhw_eco_dd")], ["comfort", this.t("KOMFORT", "COMFORT"), this.n("dhw_comfort_dd")]] : [],
      hint: this.on("dhw_sched") ? this.t("Komfort / Eko wg kalendarza CWU", "Comfort / Eco by the DHW calendar")
        : this.t("z pilotem CAR V2 nastawę CWU ustawia pokrętło pilota", "with a CAR V2 remote its dial sets the DHW setpoint"),
    }) : this.tileView({
      k: "dhw_set", meas: "tank", icon: "mdi:water-boiler", col: "peach", title: this.t("Ciepła woda", "Hot water"), sub: this.t("CWU · zasobnik", "DHW · cylinder"), temp: tank,
      status: dhwRun ? this.t("grzeje", "heating") : this.t("czuwa", "standby"), active: dhwRun,
      profiles: [["eco", this.t("EKO", "ECO"), dEco], ["comfort", this.t("KOMFORT", "COMFORT"), dCom]],
      hint: !isNaN(act) && !isNaN(set) && Math.abs(act - set) >= 1 ? this.t("piec grzeje teraz do ", "the boiler now heats to ") + this.f(act, 0) + " °C"
        : undefined,
    });

    return html`
      ${this.head("mdi:thermostat", this.t("Nastawy", "Setpoints"), this.ot ? undefined : html`<span class="gear2" @click=${() => { this.gear = !this.gear; this.requestUpdate(); }}>
        <ha-icon icon=${this.gear ? "mdi:close" : "mdi:cog-outline"}></ha-icon></span>`)}
      <div class="two">${ch}${dhw}</div>
      ${this.otRO ? html`<div class="note"><ha-icon icon="mdi:lock-outline"></ha-icon> ${this.t("Tylko odczyt – nastawy ustawia pilot (CAR V2 / Super Amico).", "Read only – the remote (CAR V2 / Super Amico) sets the setpoints.")}</div>` : this.lastWrite()}
      ${this.gear && !this.ot ? html`<div class="presets">
        <div class="grp">${cool ? this.t("Profile chłodzenia Strefy 1 (piec)", "Zone 1 cooling profiles (boiler)") : this.t("Profile ogrzewania Strefy 1 (piec)", "Zone 1 heating profiles (boiler)")}</div>
        ${this.numRow(cKey, "mdi:sofa-outline", this.t("Komfort", "Comfort"), 1)}
        ${this.numRow(eKey, "mdi:leaf", this.t("Eko", "Eco"), 1)}
        <div class="grp" style="margin-top:8px">${this.t("Profile ciepłej wody", "Hot water profiles")}</div>
        ${dd ? html`${this.numRow("dhw_comfort_dd", "mdi:sofa-outline", this.t("Komfort", "Comfort"), 1)}
          ${this.numRow("dhw_eco_dd", "mdi:leaf", this.t("Eko", "Eco"), 1)}
          ${this.eid("dhw_sched") ? this.toggles([["dhw_sched", "mdi:calendar-clock", "peach", this.t("Komfort / Eko wg harmonogramu CWU", "Comfort / Eco by the DHW schedule"),
            this.t("w przedziałach kalendarza CWU Komfort, poza nimi Eko", "Comfort inside the DHW calendar ranges, Eco outside"), true]]) : nothing}`
          : html`${this.helperRow(this.config.dhw_comfort, "mdi:sofa-outline", this.t("Komfort", "Comfort"))}
          ${this.helperRow(this.config.dhw_eco, "mdi:leaf", this.t("Eko", "Eco"))}`}
        ${dd || [this.config.dhw_comfort, this.config.dhw_eco].some((o: any) => typeof o === "string" && o.startsWith("input_number.") && this.hass.states[o]) ? nothing
          : html`<div class="note">${this.t("Wskaż w opcjach karty dhw_eco / dhw_comfort pomocników input_number, aby edytować je tutaj (teraz ",
            "Point the card options dhw_eco / dhw_comfort to input_number helpers to edit them here (now ")}${this.f(dEco, 1, 1)} / ${this.f(dCom, 1, 1)} °C).</div>`}</div>` : nothing}`;
  }

  static styles = [HubCard.styles, css`
    .gear2 { cursor: pointer; display: inline-flex; }
    .gear2 ha-icon { --mdc-icon-size: 17px; }
    .two { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
    /* side by side down to a narrow dashboard column; one under the other on a phone */
    @media (max-width: 600px) { .two { grid-template-columns: 1fr; } }
    .sp { border-radius: 16px; border: 1px solid; padding: 12px; display: flex; flex-direction: column; min-width: 0; }
    .top { cursor: pointer; display: flex; align-items: flex-start; gap: 8px; }
    .top ha-icon { --mdc-icon-size: 24px; flex: none; }
    .t1 { font-size: 14px; font-weight: 800; }
    .t2 { font-size: 10.5px; opacity: .6; }
    .big { cursor: pointer; display: flex; align-items: baseline; gap: 2px; margin: 4px 0 2px; flex-wrap: wrap; }
    .big > span:first-child { font-size: 34px; font-weight: 300; line-height: 1.1; }
    .u { font-size: 15px; font-weight: 600; }
    .hum { margin-left: auto; font-size: 11.5px; font-weight: 700; display: inline-flex; align-items: center; gap: 2px; opacity: .85; }
    .hum ha-icon { --mdc-icon-size: 14px; }
    .st { font-size: 11px; font-weight: 700; opacity: .65; margin: 6px 0 6px; }
    .reg { display: flex; align-items: center; gap: 8px; }
    .rb { cursor: pointer; flex: none; width: 38px; height: 38px; border-radius: 12px; display: flex; align-items: center; justify-content: center;
      background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.12); }
    .rb ha-icon { --mdc-icon-size: 20px; }
    .rv { cursor: pointer; flex: 1; display: flex; flex-direction: column; align-items: center; min-width: 0; }
    .rn { font-size: 16px; font-weight: 800; font-variant-numeric: tabular-nums; }
    .rl { font-size: 8.5px; font-weight: 800; letter-spacing: .08em; opacity: .5; }
    .pf { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 10px; }
    .pb { cursor: pointer; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 5px 4px; border-radius: 10px; font-size: 10px; font-weight: 800;
      background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); letter-spacing: .03em; }
    .pl { display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; }
    .pb ha-icon { --mdc-icon-size: 13px; }
    .pv { font-size: 12px; font-weight: 800; font-variant-numeric: tabular-nums; }
    .hint { font-size: 10px; opacity: .65; margin-top: 6px; }
    .presets { margin-top: 10px; padding: 8px 10px; border-radius: 12px; background: rgba(var(--ih-overlay1-rgb), .06); }
    .grp { font-size: 9.5px; font-weight: 800; opacity: .45; letter-spacing: .06em; text-transform: uppercase; margin-bottom: 2px; }
  `];
}

register("immergas-setpoints-card", ImmergasSetpointsCard, "Immergas – Nastawy / Setpoints",
  "Nastawy CO (strefa 1) i CWU: temperatura, regulator −/+ oraz profile EKO / KOMFORT");
