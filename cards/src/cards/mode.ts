// "Tryb pracy / Operating mode": mode buttons (two-tap confirm), night function U11, compressor cycling, boiler integration.
import { HubCard, html, css, nothing, c, ca, box, register } from "../base";

class ImmergasModeCard extends HubCard {
  /** boiler OFF (its own button): it stops polling D+/D- (DD link off for 30 s+) while T-/T+ still answers with
   *  D99 = 0 - a broken D+/D- cable or a hub restart leaves T-/T+ silent or unavailable, so it does not count */
  private get boilerOff(): boolean {
    const link = this.so("dd_link");
    if (!link || link.state !== "off" || Date.now() - Date.parse(link.last_changed) < 30000) return false;
    return !this.bad("d99_raw") && this.n("d99_raw") === 0;
  }

  private modes() {
    // options of the DD mode select, in the order of the boiler register (standby, summer, cooling, winter)
    const opts: string[] = this.attr("mode", "options") ?? [];
    const ui: Record<string, [string, string, string, string]> = {
      0: ["Standby", "Standby", "mdi:power-standby", "overlay2"],
      1: [this.t("Lato", "Summer"), "", "mdi:white-balance-sunny", "yellow"],
      3: [this.t("Zima", "Winter"), "", "mdi:snowflake-thermometer", "sky"],
      2: [this.t("Chłodz.", "Cooling"), "", "mdi:snowflake", "teal"],
    };
    const order = [0, 1, 3, 2].filter((i) => i < opts.length);
    // boiler switched OFF with its own button: the mode select keeps its last (stale) value, so OFF shows on the first
    // button and the modes are locked - the boiler cannot be switched on remotely
    const off = this.boilerOff, cur = off ? opts[0] : this.s("mode");
    return order.map((i) => {
      const opt = opts[i], [lbl0, , icon0, col0] = ui[i], sel = cur === opt, tag = "mode" + i, armed = this.isArmed(tag);
      const lbl = i === 0 && off ? "OFF" : lbl0, icon = i === 0 && off ? "mdi:power" : off ? "mdi:lock-outline" : icon0, lock = off && !sel;
      const col = i === 0 && off ? "red" : col0;
      return html`<div class="mb ${lock ? "lock" : ""}" style=${sel ? box(col, true) : "background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06)"}
        title=${off ? this.t("Piec wyłączony przyciskiem (OFF) – włącz go na piecu", "Boiler switched off with its button (OFF) – switch it on at the boiler") : ""}
        @click=${() => !off && !sel && this.confirm(tag, () => this.call("select", "select_option", "mode", { option: opt }))}>
        <ha-icon icon=${icon} style="color:${sel ? c(col) : "var(--secondary-text-color)"}"></ha-icon>
        <span style=${sel ? `color:${c(col)}` : "opacity:.7"}>${armed ? this.t("Potwierdź", "Confirm") : lbl}</span></div>`;
    });
  }

  /** anti-legionella P15: state, the boiler-side day/time (card options legionella_day / legionella_time) and a two-tap switch */
  private legRow(tchip: (o: string | undefined, l: string, v: string | null, col?: string) => unknown, hm: (m: number | null) => string | null) {
    if (!this.eid("p15")) return nothing;
    const on = this.on("p15"), bad = this.bad("p15"), conf = this.isArmed("tg_p15"), col = bad ? "overlay1" : on ? "red" : "overlay2";
    const run = on && this.n("dhw_active_set") >= 60 && !(this.n("dhw_active_set") <= this.n("dhw_set"));
    const tm = this.timeOpt("legionella_time"), d = this.dayOpt("legionella_day"), nx = this.nextLeg(Date.now());
    // full weekday name in the UI language (4 Jan 2026 is a Sunday = day 0)
    const longDay = (wd: number) => {
      if (wd < 0) return this.dayName(wd);
      const n = new Date(2026, 0, 4 + wd).toLocaleDateString(this.loc, { weekday: "long" });
      return n.charAt(0).toUpperCase() + n.slice(1);
    };
    const when = (t: number) => this.dayName(new Date(t).getDay()) + " " + new Date(t).toLocaleTimeString(this.loc, { hour: "2-digit", minute: "2-digit" });
    const st = bad ? this.t("brak odczytu", "no reading") : conf ? this.t("dotknij ponownie, aby potwierdzić", "tap again to confirm")
      : run ? this.t("dezynfekcja trwa · ", "disinfection running · ") + this.ago("dhw_active_set")
      : on ? (this.dominus ? this.t("ustawiona na piecu", "set on the boiler") : this.t("włączona", "on")) + (nx > 0 ? this.t(" · następna ", " · next ") + when(nx) : "")
      : this.dominus ? this.t("nieustawiona na piecu", "not set on the boiler") : this.t("wyłączona", "off");
    return html`<div class="night" style=${box(col, run)}>
      <ha-icon icon="mdi:bacteria-outline" style="color:${c(col)}" @click=${() => this.moreInfo("p15")}></ha-icon>
      <div class="cx" @click=${() => this.moreInfo("p15")}><div class="nt">${this.t("Anty-legionella", "Anti-legionella")} <span style="font-size:9.5px;opacity:.5">P15</span></div>
        <div class="ns" style="color:${c(col)}">${st}</div></div>
      <div class="tgl ${bad ? "dis" : ""}" style="flex:none;align-self:flex-start;background:${on ? ca("red", 0.35) : "rgba(255,255,255,.08)"}${conf ? `;outline:2px solid ${c("red")}` : ""}"
        @click=${() => !bad && this.confirm("tg_p15", () => this.call("switch", on ? "turn_off" : "turn_on", "p15"))}>
        <div class="kn" style="left:${on ? 23 : 3}px;background:${on ? c("red") : c("overlay1")}"></div></div>
      ${tm !== null || d !== null ? html`<div class="tcs full">${tchip(this.opt("legionella_day"), this.t("DZIEŃ · P17", "DAY · P17"), d === null ? null : longDay(d), "red")}
        ${tchip(this.opt("legionella_time"), "START · P16", hm(tm), "red")}<span style="opacity:.4">–</span>
        ${tchip(this.opt("legionella_hours"), "STOP · P13", tm === null ? null : hm((tm + Math.round(this.legHours() * 60)) % 1440), "red")}</div>` : nothing}
</div>`;
  }

  /** Dominus: night function U11 is not readable over TCP - the switch declares it set on the boiler (two-tap), the
   *  window U12 / U13 comes from the integration's time entities; status = inside / outside the window */
  private declaredNight(tchip: (o: string | undefined, l: string, v: string | null, col?: string) => unknown, ns: string | null, ne: string | null, inWin: boolean | null) {
    const on = this.on("u11"), conf = this.isArmed("tg_u11"), act = on && inWin === true, col = act ? "lavender" : on ? "lavender" : "overlay2";
    const st = conf ? this.t("dotknij ponownie, aby potwierdzić", "tap again to confirm")
      : !on ? this.t("nieustawiona na piecu", "not set on the boiler")
      : this.t("ustawiona na piecu · ", "set on the boiler · ") + (act ? this.t("aktywna teraz", "active now") : this.t("poza oknem", "outside the window"));
    return html`<div class="night" style=${box(col, act)}>
      <ha-icon icon=${act ? "mdi:weather-night" : "mdi:moon-waning-crescent"} style="color:${c(on ? "lavender" : "overlay2")}" @click=${() => this.moreInfo("u11")}></ha-icon>
      <div class="cx" @click=${() => this.moreInfo("u11")}><div class="nt">${this.t("Tryb nocny", "Night mode")} <span style="font-size:9.5px;opacity:.5">U11</span></div>
        <div class="ns" style="color:${c(on ? "lavender" : "overlay2")}">${st}</div></div>
      ${ns || ne ? html`<div class="tcs">${tchip(this.opt("night_start"), "START · U12", ns)}<span style="opacity:.4">–</span>${tchip(this.opt("night_stop"), "STOP · U13", ne)}</div>` : nothing}
      <div class="tgl" style="flex:none;align-self:center;background:${on ? ca("lavender", 0.35) : "rgba(255,255,255,.08)"}${conf ? `;outline:2px solid ${c("lavender")}` : ""}"
        @click=${() => this.confirm("tg_u11", () => this.call("switch", on ? "turn_off" : "turn_on", "u11"))}>
        <div class="kn" style="left:${on ? 23 : 3}px;background:${on ? c("lavender") : c("overlay1")}"></div></div></div>`;
  }

  /** Zone 1 time program (DD select, options [manual, auto]) as two buttons AUTO / MANUAL, two-tap confirm */
  private progRow() {
    if (!this.eid("prog_mode")) return nothing;
    const opts: string[] = this.attr("prog_mode", "options") ?? [], bad = this.bad("prog_mode") || opts.length !== 2;
    const cur = this.s("prog_mode") === opts[1] ? "auto" : "manual";
    const set = (m: string) => this.call("select", "select_option", "prog_mode", { option: opts[m === "auto" ? 1 : 0] });
    // the boiler's own report (DD 2090: manual / comfort / eco) shows the phase the schedule is in right now
    const ph = this.bad("program") ? "" : this.s("program")!;
    const sub = bad ? this.t("brak odczytu", "no reading") : cur === "auto" ? this.t("wg harmonogramu", "by the schedule") + (ph ? this.t(" · teraz: ", " · now: ") + ph : "")
      : this.t("stała nastawa, bez harmonogramu", "fixed setpoint, no schedule");
    return this.srcBlock("prog", this.t("Program czasowy CO Strefy 1", "Zone 1 CH time program"), sub,
      [["auto", "mdi:calendar-clock", "blue", "AUTO"], ["manual", "mdi:hand-back-right-outline", "peach", "MANUAL"]], cur, set, bad);
  }

  /** DHW time program: AUTO = the hub switches the DHW setpoint between Comfort (inside the DHW calendar ranges) and
   *  Eco (outside them), MANUAL = one fixed DHW setpoint (DD switch "DHW Comfort-Eco by schedule") */
  private dhwProgRow() {
    if (!this.eid("dhw_sched")) return nothing;
    const bad = this.bad("dhw_sched"), cur = this.on("dhw_sched") ? "auto" : "manual";
    const set = (m: string) => this.call("switch", m === "auto" ? "turn_on" : "turn_off", "dhw_sched");
    const ph = this.bad("dhw_phase") ? "" : this.txt("dhw_phase")!, ds = this.n("dhw_set");
    const sub = bad ? this.t("brak odczytu", "no reading")
      : cur === "auto" ? this.t("Komfort / Eko wg kalendarza CWU", "Comfort / Eco by the DHW calendar") + (ph ? this.t(" · teraz: ", " · now: ") + ph : "")
      : this.t("stała nastawa", "fixed setpoint") + (isNaN(ds) ? "" : ` ${this.f(ds, 0)} °C`);
    return this.srcBlock("dprog", this.t("Program czasowy CWU", "DHW time program"), sub,
      [["auto", "mdi:calendar-clock", "blue", "AUTO"], ["manual", "mdi:hand-back-right-outline", "peach", "MANUAL"]], cur, set, bad);
  }

  /** Dominus: the zone 1 program phase (no AUTO / MANUAL select there) and the boiler-side zone settings */
  private domRows(cooling: boolean) {
    const ph = this.bad("zone1_phase") ? "" : this.txt("zone1_phase")!, raw = this.s("zone1_phase") ?? "";
    const col = raw === "comfort" ? "peach" : raw === "economy" ? "teal" : "overlay2";
    return html`${ph ? html`<div class="night" style=${box(col, raw === "comfort" || raw === "economy")} @click=${() => this.moreInfo("zone1_phase")}>
        <ha-icon icon="mdi:calendar-clock" style="color:${c(col)}"></ha-icon>
        <div class="cx"><div class="nt">${this.t("Program czasowy CO Strefy 1", "Zone 1 CH time program")}</div>
          <div class="ns" style="color:${c(col)}">${raw === "manual" ? this.t("ręczny – stała nastawa", "manual – fixed setpoint") : this.t("wg harmonogramu · teraz: ", "by the schedule · now: ") + ph}</div></div></div>` : nothing}
      ${this.domZone(cooling)}`;
  }

  /** Dominus: zone 1 settings the Setpoints card does not show (it shows the Comfort / Eco pair of the current mode) */
  private domZone(cooling: boolean) {
    const rows = [
      this.numRow("u03", "mdi:chart-bell-curve-cumulative", this.t("Offset krzywej (U03)", "Curve offset (U03)"), 1),
      ...(cooling
        ? [this.numRow("comfort_heat", "mdi:fire", this.t("Komfort grzanie", "Comfort heating"), 1),
          this.numRow("eco_heat", "mdi:leaf", this.t("Eko grzanie", "Eco heating"), 1)]
        : [this.numRow("comfort_cool", "mdi:snowflake", this.t("Komfort chłodzenie", "Comfort cooling"), 1),
          this.numRow("eco_cool", "mdi:snowflake-thermometer", this.t("Eko chłodzenie", "Eco cooling"), 1)]),
      this.numRow("dom_flow_target", "mdi:thermometer-water", this.t("Zadana zasilania", "Flow setpoint"), 0),
      this.numRow("dom_hum_target", "mdi:water-percent", this.t("Zadana wilgotności", "Humidity setpoint"), 0),
    ].filter((r) => r !== nothing);
    return rows.length ? html`<div class="setp"><div class="st">${this.t("Nastawy Strefy 1", "Zone 1 settings")}</div>${rows}</div>` : nothing;
  }

  protected body() {
    // 0 standby, 1 summer (DHW), 2 cooling (summer with cooling + DHW), 3 winter (CH + DHW) - index in the DD mode select options
    const modeIdx = ((this.attr("mode", "options") ?? []) as string[]).indexOf(this.s("mode") ?? "");
    const nBad = this.bad("u11"), nOn = this.on("u11"), npct = this.n("night_pct");
    const nc = nBad ? "overlay1" : nOn ? "lavender" : "overlay2";
    // U12/U13 (window of the night function) are not on any bus: card options night_start / night_stop take an entity
    // (e.g. input_datetime) or a literal "21:00" - shown as a reminder and checked against the actual U11 state.
    const hm = (m: number | null) => (m === null ? null : String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"));
    const a0 = this.timeOpt("night_start"), a1 = this.timeOpt("night_stop"), ns = hm(a0), ne = hm(a1);
    const now = new Date(), nm = now.getHours() * 60 + now.getMinutes();
    const inWin = a0 === null || a1 === null ? null : a0 <= a1 ? nm >= a0 && nm < a1 : nm >= a0 || nm < a1;
    const hint = this.dominus || nBad || inWin === null || inWin === nOn ? nothing : html`<div class="hint">${nOn
      ? this.t("aktywny poza wpisanymi godzinami – sprawdź U12/U13 na piecu", "active outside the entered hours – check U12/U13 on the boiler")
      : this.t("we wpisanych godzinach, ale nieaktywny – sprawdź U11 na piecu", "inside the entered hours but inactive – check U11 on the boiler")}</div>`;
    const tchip = (opt: string | undefined, lbl: string, v: string | null, col = "lavender") => html`<div class="tc" style="background:${ca(col, 0.08)};border:1px solid ${ca(col, 0.22)}"
      @click=${(e: Event) => { e.stopPropagation(); if (opt && this.hass.states[opt]) this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: opt }, bubbles: true, composed: true })); }}>
      <span class="tt">${v ?? "–"}</span><span class="tl">${lbl}</span></div>`;
    const night = this.dominus ? this.declaredNight(tchip, ns, ne, inWin) : html`<div class="night" style=${box(nc, nOn)} @click=${() => this.moreInfo("u11")}>
      <ha-icon icon=${nOn ? "mdi:weather-night" : "mdi:moon-waning-crescent"}
        style="color:${c(nOn ? "lavender" : "overlay2")};${nOn ? `filter:drop-shadow(0 0 5px ${c("lavender")})` : ""}"></ha-icon>
      <div class="cx"><div class="nt">${this.t("Tryb nocny", "Night mode")} <span style="font-size:9.5px;opacity:.5">U11</span></div>
        <div class="ns" style="color:${c(nc)}">${nBad ? this.t("brak odczytu", "no reading") : nOn ? this.t("aktywny · cichsza praca", "active · quieter operation") : this.t("nieaktywny", "inactive")}${!isNaN(npct) && npct > 0 ? ` · ${Math.round(npct)} %` : ""}</div></div>
      ${ns || ne ? html`<div class="tcs">${tchip(this.opt("night_start"), "START · U12", ns)}<span style="opacity:.4">–</span>${tchip(this.opt("night_stop"), "STOP · U13", ne)}</div>`
        : !isNaN(npct) ? html`<div class="np" style="color:${c(npct > 0 ? "lavender" : "overlay2")}">${npct > 0 ? Math.round(npct) + " %" : this.t("bez limitu", "no limit")}</div>` : nothing}
    </div>${hint}`;

    const wg = this.on("force_boiler"), wgBad = this.bad("force_boiler");
    const wgc = wgBad ? "overlay1" : wg ? "peach" : "overlay2", wgArmed = this.isArmed("fb");
    const wgTxt = wgBad ? this.t("brak odczytu", "no reading") : wgArmed ? this.t("Potwierdź – dotknij ponownie", "Confirm – tap again")
      : wg ? this.t("włączone · dotknij 2× aby wyłączyć", "on · tap twice to turn off") : this.t("wyłączone · dotknij 2× aby włączyć", "off · tap twice to turn on");

    return html`
      ${this.head("mdi:tune-variant", this.t("Tryb pracy", "Operating mode"), this.t("dotknij 2× aby zmienić", "tap twice to change"))}
      <div class="modes">${this.modes()}</div>
      ${this.config.show_source === false ? nothing : html`${modeIdx === 3 ? this.sourceRow() : nothing}${modeIdx >= 1 ? this.dhwSourceRow() : nothing}`}
      ${this.eid("u11") ? night : nothing}
      ${this.dominus ? this.domRows(modeIdx === 2) : nothing}
      ${this.legRow(tchip, hm)}
      ${this.config.show_f1f2 === false ? nothing : this.f1f2Rows()}
      ${this.progRow()}
      ${this.dhwProgRow()}
      ${this.config.show_toggles === false ? nothing : this.toggles([
        ["room_mod", "mdi:home-thermometer-outline", "green", this.t("Modulacja z sondą pokojową", "Room probe modulation"),
          html`${this.t("zasilanie korygowane wg temp. w pokoju", "flow corrected by the room temperature")}
            ${this.selPick("temp_src", this.t("temperatura", "temperature"))}`, true],
        ["dew_corr", "mdi:water-percent", "sky", this.t("Korekcja punktu rosy", "Dew point correction"),
          this.eid("hum_src") ? html`${this.selPick("hum_src", this.t("wilgotność", "humidity"))}` : undefined, true],
        ["boost", "mdi:water-boiler-alert", "yellow", this.t("Wymuszenie CWU", "DHW boost"), undefined, true],
        ["a12", "mdi:air-filter", "teal", this.t("Auto-odpowietrzanie (A12)", "Auto venting (A12)"), this.t("ustawienie: przy każdym włączeniu pieca", "setting: at every boiler power-up"), true],
        ["vent_start", "mdi:pipe-valve", "peach", this.on("vent_start") ? this.t("Odpowietrzanie trwa · ", "Venting running · ") + this.ago("vent_start") : this.t("Odpowietrz instalację teraz", "Vent the system now"),
          this.t("jednorazowy cykl AP99 – piec w tym czasie nie grzeje; wyłącz, aby przerwać", "one-off AP99 cycle – the boiler does not heat meanwhile; switch off to stop"), true],
      ])}`;
  }

  static styles = [HubCard.styles, css`
    .setp .st { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; opacity: .55; margin: 2px 0 2px; }
    .modes { display: flex; gap: 6px; }
    .mb.lock { opacity: .4; cursor: not-allowed; }
    .mb { cursor: pointer; flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 9px 2px; border-radius: 13px; }
    .mb ha-icon { --mdc-icon-size: 20px; }
    .mb span { font-size: 11px; font-weight: 800; }
    .night { cursor: pointer; display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 10px; padding: 8px 10px; border-radius: 13px; }
    .night ha-icon { --mdc-icon-size: 20px; flex: none; }
    .nt { font-size: 12px; font-weight: 800; }
    .ns { font-size: 10.5px; font-weight: 700; }
    .np { font-size: 14px; font-weight: 800; }
    /* time boxes wrap to their own line on a narrow card instead of squeezing the title */
    .night .cx { flex: 1 1 110px; min-width: 110px; }
    .tcs { display: flex; align-items: center; gap: 6px; flex: none; margin-left: auto; }
    /* legionella: time boxes on their own line under the title, the switch stays top right */
    .tcs.full { flex-basis: 100%; }
    .tcs.full .tc { flex: 1 1 0; min-width: 0; }
    .tc { cursor: pointer; display: flex; flex-direction: column; align-items: center; padding: 4px 10px; border-radius: 10px; }
    .tt { font-size: 14px; font-weight: 800; }
    .tl { font-size: 8.5px; opacity: .5; letter-spacing: .06em; white-space: nowrap; }
    .hint { font-size: 10px; margin-top: 5px; color: var(--ih-yellow); }
  `];
}

register("immergas-mode-card", ImmergasModeCard, "Immergas – Tryb pracy / Operating mode",
  "Tryb pracy (2× dotknięcie), funkcja nocna U11, taktowanie sprężarki, integracja z kotłem");
