// "Ustawienia / Settings": a discreet, collapsed card with the hub configuration: electricity and gas price, DHW cylinder
// capacity, gas-estimate calibration, DHW boost duration, fault description language and the night-function window
// (U12 / U13 are not on any bus: options night_start / night_stop point to input_datetime helpers, edited here ±15 min).
// Option: expanded: true (open by default).
import { HubCard, html, css, nothing, register } from "../base";
import { Key } from "../names";

class ImmergasSettingsCard extends HubCard {
  private open: boolean | null = null;

  private timeRow(entity: string | undefined, label: string, icon = "mdi:weather-night") {
    const st = entity ? this.hass.states[entity] : undefined;
    if (!st) return nothing;
    const v = /^\d\d:\d\d/.test(st.state) ? st.state.slice(0, 5) : "–";
    // an empty declared time (Dominus): show the suggested one faintly, the first tap writes it
    const sug = String(st.attributes?.suggested ?? ""), empty = v === "–" && /^\d\d:\d\d/.test(sug);
    const bump = (d: number) => {
      if (empty) return this.hass.callService("time", "set_value", { entity_id: entity, time: sug });
      if (v === "–") return;
      const m = ((+v.slice(0, 2) * 60 + +v.slice(3, 5) + d) % 1440 + 1440) % 1440;
      const t = String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0") + ":00";
      if (entity!.startsWith("time.")) this.hass.callService("time", "set_value", { entity_id: entity, time: t });
      else this.hass.callService("input_datetime", "set_datetime", { entity_id: entity, time: t });
    };
    return html`<div class="nr" style=${empty ? "opacity:.55" : ""}><ha-icon icon=${icon}></ha-icon>
      <span class="nl" @click=${() => this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: entity }, bubbles: true, composed: true }))}>${label}${this.unsetNote(empty)}</span>
      <div class="btn xs" @click=${() => bump(-15)}><ha-icon icon="mdi:minus"></ha-icon></div><span class="nv" style=${empty ? "opacity:.45;font-weight:600" : ""}>${empty ? sug.slice(0, 5) : v}</span>
      <div class="btn xs" @click=${() => bump(15)}><ha-icon icon="mdi:plus"></ha-icon></div></div>`;
  }

  /** input_select day helper (e.g. anti-legionella day): previous / next option */
  private selRow(entity: string | undefined, label: string, icon: string) {
    const st = entity ? this.hass.states[entity] : undefined;
    if (!entity || !st || !/^(input_)?select\./.test(entity)) return nothing;
    const dom = entity.startsWith("select.") ? "select" : "input_select";
    const sug = st.attributes?.suggested, empty = !(st.attributes?.options ?? []).includes(st.state) && sug !== undefined;
    const step = (d: number) => empty ? this.hass.callService(dom, "select_option", { entity_id: entity, option: sug })
      : this.hass.callService(dom, d < 0 ? "select_previous" : "select_next", { entity_id: entity, cycle: true });
    return html`<div class="nr" style=${empty ? "opacity:.55" : ""}><ha-icon icon=${icon}></ha-icon>
      <span class="nl" @click=${() => this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: entity }, bubbles: true, composed: true }))}>${label}${this.unsetNote(empty)}</span>
      <div class="btn xs" @click=${() => step(-1)}><ha-icon icon="mdi:minus"></ha-icon></div><span class="nv" style=${empty ? "opacity:.45;font-weight:600" : ""}>${empty
        ? this.hass.formatEntityState?.(st, sug) ?? sug : this.hass.formatEntityState?.(st) ?? st.state}</span>
      <div class="btn xs" @click=${() => step(1)}><ha-icon icon="mdi:plus"></ha-icon></div></div>`;
  }

  private unsetNote(empty: boolean) {
    return empty ? html`<span class="unset">${this.t("nie ustawione – wpisz z pieca", "not set – enter it from the boiler")}</span>` : nothing;
  }

  /** Immergas Dominus 1.5.0: boiler menu values declared by the user (empty until copied from the boiler); a group whose
   *  values are missing says so - the feature it drives stays off until they are entered */
  private domParams() {
    if (!this.eid("dom_r02")) return nothing;
    const g = (title: string, need: string[], rows: unknown) => html`<div class="grp">${title}${need.length
      ? html` <span class="need">· ${this.t("nieaktywne – uzupełnij", "inactive – fill in")} ${need.join(", ")}</span>` : nothing}</div>${rows}`;
    const miss = (ks: [string, Key][]) => ks.filter(([, k]) => this.eid(k) && !this.isSet(k)).map(([n]) => n);
    return html`
      ${g(this.t("Krzywa grzewcza (menu R)", "Heating curve (menu R)"), miss([["R02", "dom_r02"], ["R03", "dom_r03"], ["R04", "r04"], ["R05", "r05"]]), html`
        ${this.numRow("dom_r02", "mdi:thermometer-low", this.t("R02 · temp. zewn. przy maks. zasilaniu", "R02 · outdoor at max. flow"), 0)}
        ${this.numRow("dom_r03", "mdi:thermometer-high", this.t("R03 · temp. zewn. przy min. zasilaniu", "R03 · outdoor at min. flow"), 0)}
        ${this.numRow("r04", "mdi:thermometer-chevron-up", this.t("R04 · maks. zasilanie CO", "R04 · max. CH flow"), 0)}
        ${this.numRow("r05", "mdi:thermometer-chevron-down", this.t("R05 · min. zasilanie CO", "R05 · min. CH flow"), 0)}`)}
      ${g(this.t("Krzywa chłodzenia (menu R)", "Cooling curve (menu R)"), miss([["R10", "dom_r10"], ["R11", "dom_r11"], ["R12", "r12"], ["R13", "r13"]]), html`
        ${this.numRow("dom_r10", "mdi:thermometer-high", this.t("R10 · temp. zewn. przy min. zasilaniu", "R10 · outdoor at min. flow"), 0)}
        ${this.numRow("dom_r11", "mdi:thermometer-low", this.t("R11 · temp. zewn. przy maks. zasilaniu", "R11 · outdoor at max. flow"), 0)}
        ${this.numRow("r12", "mdi:snowflake-thermometer", this.t("R12 · min. zasilanie chłodzenia", "R12 · min. cooling flow"), 0)}
        ${this.numRow("r13", "mdi:snowflake", this.t("R13 · maks. zasilanie chłodzenia", "R13 · max. cooling flow"), 0)}`)}
      ${g(this.t("Ciepła woda i ogrzewanie (menu T)", "Hot water and heating (menu T)"), [], html`
        ${this.numRow("dom_t02", "mdi:water-thermometer", this.t("T02 · termostat CWU (start przy nastawa − T02)", "T02 · DHW thermostat (starts at setpoint − T02)"), 0)}
        ${this.numRow("dom_t05", "mdi:timer-lock-outline", this.t("T05 · minutnik startów CO", "T05 · CH start timer"), 0)}`)}
      ${g(this.t("Integracja kotła (menu I, Magis Combo)", "Boiler integration (menu I, Magis Combo)"),
        this.on("dom_int_ch") ? miss([["I04", "dom_i04"], ["I10", "dom_i10"]]) : [], html`
        ${this.switchRow("dom_int_ch", "mdi:fire", "peach", this.t("Integracja kotła CO · I02", "CH boiler integration · I02"),
          this.t("ustawiona na piecu – kocioł dołącza do pompy", "set on the boiler – the boiler joins the heat pump"))}
        ${this.switchRow("dom_int_dhw", "mdi:water-boiler", "peach", this.t("Integracja kotła CWU · I01", "DHW boiler integration · I01"),
          this.t("ustawiona na piecu", "set on the boiler"))}
        ${this.numRow("dom_i04", "mdi:timer-play-outline", this.t("I04 · maks. czas oczekiwania na kocioł (CO)", "I04 · max. wait for the boiler (CH)"), 0)}
        ${this.numRow("dom_i10", "mdi:snowflake-thermometer", this.t("I10 · temp. zewn. aktywacji kotła", "I10 · boiler activation outdoor temp."), 0)}`)}
      ${g(this.t("Instalacja", "Installation"), [], html`
        ${this.selRow(this.eid("dom_a31"), this.t("A31 · sterowanie pokojowe", "A31 · room control"), "mdi:home-thermometer-outline")}
        ${this.numRow("dom_p07", "mdi:thermometer-plus", this.t("P07 · korekta sondy zewnętrznej", "P07 · outdoor probe correction"), 0)}
        ${this.selRow(this.eid("floor_type"), this.t("Rodzaj posadzki", "Floor screed type"), "mdi:layers-triple-outline")}
        ${this.numRow("heated_area", "mdi:floor-plan", this.t("Powierzchnia ogrzewana", "Heated floor area"), 0)}`)}`;
  }

  /** Immergas Dominus, offline part: copies of the boiler menu (U11, P15, curves, T, I, A31, P07) - nothing is read
   *  from or written to the boiler, they drive the timer bars, the curve and the hints */
  private domOffline() {
    return html`
      ${this.eid("u11") ? html`<div class="grp">${this.t("Tryb nocny U11", "Night mode U11")}</div>
        ${this.timeRow(this.eid("u12"), this.t("U12 · start funkcji nocnej", "U12 · night function start"))}
        ${this.timeRow(this.eid("u13"), this.t("U13 · koniec funkcji nocnej", "U13 · night function end"))}` : nothing}
      ${this.eid("p15") ? html`<div class="grp">${this.t("Anty-legionella P15", "Anti-legionella P15")}</div>
        ${this.selRow(this.eid("p17"), this.t("P17 · dzień cyklu", "P17 · cycle day"), "mdi:calendar-week")}
        ${this.timeRow(this.eid("p16"), this.t("P16 · godzina startu", "P16 · start time"), "mdi:bacteria-outline")}
        ${this.numRow("p13", "mdi:timer-sand", this.t("P13 · maks. czas cyklu", "P13 · max. cycle duration"), 0)}` : nothing}
      ${this.domParams()}`;
  }

  /** Immergas Dominus 1.3.0, online part: vacation, automatic summer / winter, alerts (all writes off by default) */
  private domRows() {
    const until = this.so("dom_vac_until"), u = until && !["unknown", "unavailable", ""].includes(until.state)
      ? new Date(until.state).toLocaleString(this.loc, { dateStyle: "medium", timeStyle: "short" }) : this.t("do wyłączenia", "until switched off");
    const season = this.so("dom_auto_season")?.attributes ?? {}, mean = parseFloat(season.outdoor_mean_24h), hrs = parseFloat(season.hours_of_data);
    const alert = (k: "dom_frost" | "dom_offline") => this.bad(k) ? "–" : this.on(k) ? this.t("ALARM", "ALERT") : this.t("ok", "ok");
    return html`
      ${this.eid("dom_flow_target") || this.eid("dom_hum_target") ? html`<div class="grp">${this.t("Nastawy Strefy 1", "Zone 1 settings")}</div>
        ${this.numRow("dom_flow_target", "mdi:thermometer-water", this.t("Zadana zasilania", "Flow setpoint"), 0)}
        ${this.numRow("dom_hum_target", "mdi:water-percent", this.t("Zadana wilgotności", "Humidity setpoint"), 0)}` : nothing}
      ${this.eid("dom_vacation") ? html`<div class="grp">${this.t("Tryb wyjazdowy", "Vacation")}</div>
        ${this.switchRow("dom_vacation", "mdi:bag-suitcase-outline", "sky", this.t("Tryb wyjazdowy", "Vacation mode"),
          this.t("obniża zadaną Strefy 1, po powrocie przywraca", "lowers the zone 1 target, restores it on return"))}
        ${this.numRow("dom_vac_temp", "mdi:thermometer-low", this.t("Temperatura na wyjazd", "Vacation temperature"), 1)}
        <div class="nr"><ha-icon icon="mdi:calendar-end"></ha-icon><span class="nl" @click=${() => this.moreInfo("dom_vac_until")}>${this.t("Wyjazd do", "Away until")}</span>
          <span class="nv" style="min-width:auto">${u}</span></div>` : nothing}
      ${this.eid("dom_auto_season") ? html`<div class="grp">${this.t("Automatyczne Lato / Zima", "Automatic summer / winter")}</div>
        ${this.switchRow("dom_auto_season", "mdi:sun-snowflake-variant", "teal", this.t("Automatyczne Lato / Zima", "Automatic summer / winter"),
          isNaN(mean) ? this.t("średnia zewnętrzna z 24 h – zbieram dane", "24 h outdoor mean – collecting data")
            : this.t(`średnia 24 h ${this.f(mean, 1, 1)} °C z ${this.f(hrs, 0)} h danych`, `24 h mean ${this.f(mean, 1, 1)} °C from ${this.f(hrs, 0)} h of data`))}
        ${this.numRow("dom_win_below", "mdi:snowflake", this.t("Zima poniżej (średnia 24 h)", "Winter below (24 h mean)"), 1)}
        ${this.numRow("dom_sum_above", "mdi:weather-sunny", this.t("Lato powyżej (średnia 24 h)", "Summer above (24 h mean)"), 1)}` : nothing}
      ${this.eid("dom_frost") || this.eid("dom_offline") ? html`<div class="grp">${this.t("Alarmy", "Alerts")}</div>
        ${this.numRow("dom_frost_thr", "mdi:snowflake-alert", this.t("Ryzyko zamarznięcia poniżej", "Frost risk below") + ` · ${alert("dom_frost")}`, 1)}
        ${this.numRow("dom_off_min", "mdi:lan-disconnect", this.t("Moduł offline po", "Module offline after") + ` · ${alert("dom_offline")}`, 0)}` : nothing}`;
  }

  protected body() {
    const open = this.open ?? !!this.config.expanded;
    const lang = this.so("err_lang"), opts: string[] = lang?.attributes?.options ?? [];
    const night = this.opt("night_start") || this.opt("night_stop"), leg = this.opt("legionella_day") || this.opt("legionella_time");
    // Dominus: option part = "online" (works live: vacation, summer / winter, alerts, fault language) or "offline"
    // (copies of the boiler menu typed in by hand); without it both parts in one card
    // hub: the same option - "online" (prices, cylinder, gas estimate, fault language), "offline" (boiler menu values the
    // buses do not carry: U12/U13, P16/P17/P13, floor limit, cheaper tariff, curve points R02/R03/R10/R11, P07)
    const part: string = this.config.part ?? "all", on = part !== "offline", off = part !== "online";
    const ttl = !this.dominus ? (part === "online" ? this.t("Ustawienia huba (online)", "Hub settings (online)")
        : part === "offline" ? this.t("Parametry pieca (offline)", "Boiler parameters (offline)") : this.t("Ustawienia huba", "Hub settings"))
      : part === "online" ? this.t("Ustawienia online", "Online settings")
      : part === "offline" ? this.t("Parametry pieca (offline)", "Boiler parameters (offline)") : this.t("Ustawienia", "Settings");
    const sum = !this.dominus ? (part === "online" ? this.t("ceny, zasobnik, szacowanie gazu, język błędów", "prices, cylinder, gas estimate, fault language")
        : part === "offline" ? this.t("U12/U13, P16/P17/P13, limit podłogi, tania taryfa, R02/R03, R10/R11, P07", "U12/U13, P16/P17/P13, floor limit, cheap tariff, R02/R03, R10/R11, P07")
        : this.t("ceny, zasobnik, tryb nocny, legionella…", "prices, cylinder, night mode, legionella…"))
      : part === "online" ? this.t("zasilanie, wilgotność, wyjazd, Lato/Zima, alarmy, język błędów", "flow, humidity, vacation, summer/winter, alerts, fault language")
      : part === "offline" ? this.t("U11, P15, krzywe R, T02/T05, integracja I, A31, P07", "U11, P15, R curves, T02/T05, I integration, A31, P07")
      : this.t("parametry pieca, tryb nocny, legionella, wyjazd, Lato/Zima, alarmy, język błędów", "boiler parameters, night mode, legionella, vacation, summer/winter, alerts, fault language");
    const note = !this.dominus ? (part === "offline" ? this.t("Hub nie czyta tych ustawień z magistral – przepisz je raz z menu pieca; służą paskom czasu, krzywej i kalibracji.",
        "The hub cannot read these from the buses – copy them once from the boiler menu; they drive the timer bars, the curve and the calibration.") : "")
      : part === "online" ? this.t("Działają od razu: nastawy strefy, wyjazd i Lato/Zima zapisują do kotła przez Dominusa, alarmy i język liczy Home Assistant.",
        "Work right away: zone setpoints, vacation and summer/winter write to the boiler through Dominus, alerts and language run in Home Assistant.")
      : part === "offline" ? this.t("Dominus nie czyta tych ustawień – przepisz je raz z menu pieca. Nic nie trafia do kotła; służą paskom czasu, krzywej i podpowiedziom.",
        "Dominus cannot read these – copy them once from the boiler menu. Nothing is sent to the boiler; they drive the timer bars, the curve and the hints.") : "";
    return html`
      <div class="sh" @click=${() => { this.open = !open; this.requestUpdate(); }}>
        <ha-icon icon=${part === "offline" ? "mdi:clipboard-text-outline" : part === "online" ? "mdi:cloud-sync-outline" : "mdi:cog-outline"}></ha-icon><span class="ttl">${ttl}</span>
        <span class="sum">${open ? "" : sum}</span>
        <ha-icon class="chev" icon=${open ? "mdi:chevron-up" : "mdi:chevron-down"}></ha-icon></div>
      ${open && note ? html`<div class="note">${note}</div>` : nothing}
      ${open && !this.dominus && on ? html`
        <div class="grp">${this.t("Ceny energii", "Energy prices")}</div>
        ${this.numRow("price_elec", "mdi:flash", this.t("Cena prądu", "Electricity price"), 3)}
        ${this.numRow("price_gas", "mdi:fire", this.t("Cena gazu", "Gas price"), 2)}
        <div class="grp">${this.t("Ciepła woda", "Hot water")}</div>
        ${this.numRow("tank_vol", "mdi:water-boiler", this.t("Pojemność zasobnika CWU", "DHW cylinder capacity"), 0)}
        ${this.numRow("boost_min", "mdi:timer-play-outline", this.t("Czas wymuszenia CWU", "DHW boost duration"), 0)}
        <div class="grp">${this.t("Szacowanie gazu", "Gas estimate")}</div>
        ${this.numRow("gas_cal_co", "mdi:radiator", this.t("Zużycie gazu CO", "Gas use CH"), 2)}
        ${this.numRow("gas_cal_dhw", "mdi:water-thermometer", this.t("Zużycie gazu CWU", "Gas use DHW"), 2)}
        <div class="grp">${this.t("Instalacja i taryfa", "Installation and tariff")}</div>
        ${this.numRow("floor_max", "mdi:heating-coil", this.t("Limit zasilania podłogi (ostrzeżenie huba)", "Floor flow limit (hub warning)"), 0)}
        ${this.selRow(this.eid("floor_type"), this.t("Rodzaj posadzki", "Floor screed type"), "mdi:layers-triple-outline")}
        ${this.numRow("heated_area", "mdi:floor-plan", this.t("Powierzchnia ogrzewana", "Heated floor area"), 0)}
        ${this.eid("cheap_hours") ? html`<div class="nr"><ha-icon icon="mdi:cash-clock"></ha-icon>
          <span class="nl" @click=${() => this.moreInfo("cheap_hours")}>${this.t("Tańsza taryfa – godziny", "Cheaper tariff hours")}</span>
          <span class="nv" style="min-width:auto;cursor:pointer" @click=${() => this.moreInfo("cheap_hours")}>${this.s("cheap_hours") || this.t("jedna taryfa", "single rate")}</span></div>` : nothing}
      ` : nothing}
      ${open && !this.dominus && off ? html`
        ${night || this.eid("u11_set") ? html`<div class="grp">${this.t("Tryb nocny U11 (przypomnienie – ustawia się na piecu)", "Night mode U11 (reminder – set on the boiler)")}</div>
          ${this.eid("u11_set") ? this.switchRow("u11_set", "mdi:weather-night", "lavender", this.t("U11 · funkcja nocna", "U11 · night function"),
            this.t("ON na piecu – pasek trybu nocnego w karcie Teraz", "ON on the boiler – night bar in the Now card")) : nothing}
          ${this.timeRow(this.opt("night_start"), this.t("U12 · start funkcji nocnej", "U12 · night function start"))}
          ${this.timeRow(this.opt("night_stop"), this.t("U13 · koniec funkcji nocnej", "U13 · night function end"))}` : nothing}
        ${leg ? html`<div class="grp">${this.t("Anty-legionella P15 (przypomnienie – ustawia się na piecu)", "Anti-legionella P15 (reminder – set on the boiler)")}</div>
          ${this.selRow(this.opt("legionella_day"), this.t("P17 · dzień cyklu", "P17 · cycle day"), "mdi:calendar-week")}
          ${this.timeRow(this.opt("legionella_time"), this.t("P16 · godzina startu", "P16 · start time"), "mdi:bacteria-outline")}
          ${this.numRow("p13", "mdi:timer-sand", this.t("P13 · maks. czas cyklu", "P13 · max. cycle duration"), 0)}` : nothing}
        ${this.eid("hub_r02") || this.eid("hub_r10") ? html`<div class="grp">${this.t("Krzywe (menu R)", "Curves (menu R)")}</div>
          ${this.numRow("hub_r02", "mdi:thermometer-low", this.t("R02 · temp. zewn. przy maks. zasilaniu CO", "R02 · outdoor at max. CH flow"), 0)}
          ${this.numRow("hub_r03", "mdi:thermometer-high", this.t("R03 · temp. zewn. przy min. zasilaniu CO", "R03 · outdoor at min. CH flow"), 0)}
          ${this.numRow("hub_r10", "mdi:thermometer-high", this.t("R10 · temp. zewn. przy min. zasilaniu chłodzenia", "R10 · outdoor at min. cooling flow"), 0)}
          ${this.numRow("hub_r11", "mdi:thermometer-low", this.t("R11 · temp. zewn. przy maks. zasilaniu chłodzenia", "R11 · outdoor at max. cooling flow"), 0)}` : nothing}
        ${this.eid("hub_p07") ? html`<div class="grp">${this.t("Instalacja", "Installation")}</div>
          ${this.numRow("hub_p07", "mdi:thermometer-plus", this.t("P07 · korekta sondy zewnętrznej", "P07 · outdoor probe correction"), 0)}` : nothing}
      ` : nothing}
      ${open && this.dominus && off ? this.domOffline() : nothing}
      ${open && this.dominus && on ? this.domRows() : nothing}
      ${open && lang && on ? html`<div class="grp">${this.t("Opisy błędów", "Fault descriptions")}</div>
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
    .note { font-size: 11px; opacity: .6; line-height: 1.35; margin: 6px 0 2px; }
    .grp { font-size: 9.5px; font-weight: 800; opacity: .45; letter-spacing: .06em; text-transform: uppercase; margin: 10px 0 2px; }
    .langs { cursor: pointer; margin-left: auto; padding: 4px 8px; border-radius: 8px; font: inherit; font-size: 12px; font-weight: 700; color: inherit;
      border: 1px solid rgba(var(--ih-teal-rgb), .45); background: rgba(var(--ih-teal-rgb), .1); }
    .langs option { color: #1e1e2e; }
    .need { text-transform: none; letter-spacing: 0; font-weight: 700; color: var(--ih-yellow); opacity: 1; }
  `];
}

register("immergas-settings-card", ImmergasSettingsCard, "Immergas – Ustawienia / Settings",
  "Dyskretna, zwinięta karta ustawień huba: ceny prądu i gazu, zasobnik CWU, kalibracja gazu, okno trybu nocnego, język błędów");
