// "Ustawienia / Settings": a discreet, collapsed card with the hub configuration: electricity and gas price, DHW cylinder
// capacity, gas-estimate calibration, DHW boost duration, fault description language and the night-function window
// (U12 / U13 are not on any bus: options night_start / night_stop point to input_datetime helpers, edited here ±15 min).
// Option: expanded: true (open by default).
import { HubCard, html, css, nothing, c, register, Prof, PROFS } from "../base";
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
        ${this.numRow("dom_p07", "mdi:thermometer-plus", this.t("P07 · korekta sondy zewnętrznej", "P07 · outdoor probe correction"), 0)}`)}`;
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

  /** OpenTherm: the room thermostat - what is connected (the boiler does not report it) and, for the emulated one,
   *  the HA entity whose temperature goes to Data-ID 24 */
  private otThermoRows() {
    const tid = this.eid("ot_thermo");
    if (!tid) return nothing;
    const srcId = String(this.s("ot_room_src") ?? ""), sid = this.eid("ot_room_src");
    const temps = Object.values(this.hass.states as Record<string, any>)
      .filter((s) => s.entity_id.startsWith("sensor.") && s.attributes?.device_class === "temperature" && !isNaN(parseFloat(s.state)))
      .sort((x, y) => String(x.attributes.friendly_name ?? x.entity_id).localeCompare(String(y.attributes.friendly_name ?? y.entity_id)));
    return html`<div class="grp">${this.t("Termostat pokojowy", "Room thermostat")}</div>
      ${this.selRow(tid, this.t("Termostat", "Thermostat"), "mdi:thermostat")}
      ${this.s("ot_thermo") === "emulated" && sid ? html`<div class="nr"><ha-icon icon="mdi:home-thermometer-outline"></ha-icon>
        <span class="nl">${this.t("Źródło temperatury", "Temperature source")}</span>
        <select class="langs" @change=${(e: Event) => this.hass.callService(sid.split(".")[0], "set_value", { entity_id: sid, value: (e.target as HTMLSelectElement).value })}>
          <option value="" ?selected=${!srcId}>—</option>
          ${temps.map((s) => html`<option value=${s.entity_id} ?selected=${s.entity_id === srcId}>${s.attributes.friendly_name ?? s.entity_id} · ${this.f(parseFloat(s.state), 1, 1)} °C</option>`)}
        </select></div>
        <div class="note">${this.t("Eksperymentalne: temperatura idzie jako Data-ID 24. Po minucie integracja czyta Data-ID 24 – kafel Termostat w karcie Łączność pokaże, czy kocioł ją przyjął.",
          "Experimental: the temperature goes as Data-ID 24. A minute later the integration reads Data-ID 24 back – the Thermostat tile of the Connectivity card shows whether the boiler took it.")}</div>` : nothing}`;
  }

  /** OpenTherm: the boiler menu copied once from the boiler, in the codes of its menu family (from the Immergas
   *  manuals: ZEUS 25 / EXA 28 / OMNIA, TERA, EXA 24 X / NIKE, ZEUS Superior 26/32, HERCULES) */
  private otOffline() {
    const prof = this.otProfile, gen = prof === "generic";
    // the code of a parameter in each menu family; no entry = the family does not have it, gen = also shown
    // (without a code) in the generic profile
    type Codes = Partial<Record<Prof, string>> & { gen?: boolean };
    const has = (cd: Codes) => (gen ? !!cd.gen : cd[prof] !== undefined);
    const lbl = (cd: Codes, txt: string) => (gen || !cd[prof] ? "" : cd[prof] + " · ") + txt;
    const r = (k: Key, icon: string, cd: Codes, txt: string) => has(cd) ? this.numRow(k, icon, lbl(cd, txt), 0, undefined, true) : nothing;
    const sel = (k: Key, icon: string, cd: Codes, txt: string) => has(cd) ? this.selRow(this.eid(k), lbl(cd, txt), icon) : nothing;
    const sh = this.n("ot_burn_h"), t5 = this.n("ot_t5");
    const ch = this.so("ot_ch_set")?.attributes, mm = this.n("ot_minmod");
    const tsp = (this.attr("ot_ids", "boiler_parameters") ?? {}) as Record<string, unknown>, tsp12 = tsp["12"];
    const hint = (txt: string, col = "overlay2") => html`<div class="note" style="color:${c(col)}">${txt}</div>`;
    const guessed = !(PROFS as string[]).includes(this.s("ot_menu_profile") ?? "");
    const m = prof === "superior" || prof === "hercules", cl = prof === "classic";
    const TIMER: Codes = { zeus25: "t5", tera: "t4", classic: "t0", superior: "P69", hercules: "P69", gen: true };
    const timerMax = m ? 255 : 600, tmr = TIMER[prof] ?? "";
    const exa = cl ? " (EXA 24 X)" : "", nike = cl ? " (NIKE)" : "";
    return html`
      ${this.otThermoRows()}
      <div class="grp">${this.t("Profil menu kotła", "Boiler menu profile")}</div>
      ${this.selRow(this.eid("ot_menu_profile"), this.t("Model / menu", "Model / menu"), "mdi:book-cog-outline")}
      ${guessed ? hint(this.t("profil dobrany z modelu kotła – ustaw go, jeśli się nie zgadza", "profile guessed from the boiler model – set it if it does not match")) : nothing}
      <div class="grp">${m ? this.t("Zasilanie i krzywa (M5 · P66)", "Flow and curve (M5 · P66)") : this.t("Zasilanie CO", "CH flow")}</div>
      ${r("ot_t0", "mdi:thermometer-low", { zeus25: "t0", tera: "t0", classic: "S5", superior: "P66/A", hercules: "P66/A", gen: true }, this.t("min. temperatura zasilania CO", "CH min. flow temperature") + exa)}
      ${r("ot_t1", "mdi:thermometer-high", { zeus25: "t1", tera: "t1", classic: "S6", superior: "P66/B", hercules: "P66/B", gen: true }, this.t("maks. temperatura zasilania CO", "CH max. flow temperature") + exa)}
      ${r("ot_sup_out_min", "mdi:snowflake-thermometer", { superior: "P66/C", hercules: "P66/C" }, this.t("temp. zewnętrzna przy maks. zasilaniu", "outdoor temp. at max. flow"))}
      ${r("ot_sup_out_max", "mdi:sun-thermometer", { superior: "P66/D", hercules: "P66/D" }, this.t("temp. zewnętrzna przy min. zasilaniu", "outdoor temp. at min. flow"))}
      ${ch?.min !== undefined && ch?.max !== undefined ? hint(this.t(`kocioł podaje zakres CO ${this.f(ch.min, 0)}–${this.f(ch.max, 0)} °C (Data-ID 49)`,
        `the boiler reports the CH range ${this.f(ch.min, 0)}–${this.f(ch.max, 0)} °C (Data-ID 49)`)) : nothing}
      <div class="grp">${this.t("Zapłon i CWU", "Ignition and DHW")}</div>
      ${r("ot_t5", "mdi:timer-lock-outline", TIMER, this.t("blokada ponownego zapłonu CO", "CH ignitions timer") + ` (0–${timerMax} s)`)}
      ${sh > 6 ? hint(this.t(`taktowanie: ${this.f(sh, 0)} startów w ostatniej godzinie`, `short cycling: ${this.f(sh, 0)} starts in the last hour`)
        + (isNaN(t5) || t5 < (m ? 200 : 300) ? (gen ? this.t(" – wydłuż na kotle blokadę ponownego zapłonu", " – lengthen the ignitions timer on the boiler")
          : this.t(` – wydłuż ${tmr} na kotle (np. ${m ? "200–255" : "300–600"} s)`, ` – lengthen ${tmr} on the boiler (e.g. ${m ? "200–255" : "300–600"} s)`)) : ""), "peach") : nothing}
      ${r("ot_t6", "mdi:chart-line-variant", { zeus25: "t6", tera: "t5", classic: "t1", superior: "P70", hercules: "P70", gen: true }, this.t("rampa mocy CO", "CH ramp timer"))}
      ${r("ot_t7", "mdi:timer-play-outline", { zeus25: "t7", tera: "t6", classic: "t2", superior: "P68", hercules: "P68", gen: true }, this.t("opóźnienie zapłonu CO", "CH ignition delay"))}
      ${r("ot_t4", "mdi:timer-sand", { zeus25: "t4", tera: "t3" }, this.t("czekanie po CWU przed CO", "wait after DHW before CH"))}
      ${sel("ot_t2", "mdi:water-thermometer", { zeus25: "t2" }, this.t("zasilanie przy grzaniu zasobnika", "flow while heating the cylinder"))}
      ${sel("ot_sup_dhw_restart", "mdi:water-thermometer", { superior: "P71", hercules: "P71" }, this.t("start CWU poniżej nastawy", "DHW restart below the setpoint"))}
      ${prof === "hercules" ? hint(this.t("HERCULES: P71.1 = 3 °C, P71.2 = 5 °C (solar)", "HERCULES: P71.1 = 3 °C, P71.2 = 5 °C (solar)")) : nothing}
      <div class="grp">${m || cl ? this.t("Moc (obroty wentylatora / %)", "Output (fan speed / %)") : this.t("Moc (menu P)", "Output (menu P)")}</div>
      ${r("ot_p2", "mdi:fire", { zeus25: "P2", tera: "P2", classic: "S1", gen: true }, this.t("maks. moc CO", "CH max. output") + nike)}
      ${tsp12 !== undefined && prof === "zeus25" ? hint(this.t(`parametr kotła 12 ze skanu = ${tsp12} (najpewniej P2)`, `boiler parameter 12 from the scan = ${tsp12} (probably P2)`)) : nothing}
      ${r("ot_p1", "mdi:fire-circle", { zeus25: "P1", tera: "P1", classic: "S0", gen: true }, this.t("min. moc", "min. output") + nike)}
      ${!isNaN(mm) ? hint(this.t(`kocioł podaje min. modulację ${this.f(mm, 0)} % (Data-ID 15)`, `the boiler reports ${this.f(mm, 0)} % min. modulation (Data-ID 15)`)) : nothing}
      ${r("ot_p0", "mdi:water-boiler", { zeus25: "P0", tera: "P0", gen: true }, this.t("maks. moc CWU", "DHW max. output"))}
      ${r("ot_sup_ch_max_rpm", "mdi:fan-plus", { superior: "P64", hercules: "P64", classic: "S3" }, this.t("maks. moc CO", "CH max. output") + exa)}
      ${r("ot_sup_ch_min_rpm", "mdi:fan-minus", { superior: "P65", hercules: "P65", classic: "S2" }, this.t("min. moc CO", "CH min. output") + exa)}
      ${r("ot_sup_dhw_max_rpm", "mdi:fan-chevron-up", { superior: "P57", hercules: "P62", classic: "S1" }, this.t("maks. moc CWU", "DHW max. output") + exa)}
      ${r("ot_sup_dhw_min_rpm", "mdi:fan-chevron-down", { superior: "P62", hercules: "P63", classic: "S0" }, this.t("min. moc CWU", "DHW min. output") + exa)}
      ${cl ? hint(this.t("Menu S zależy od modelu: EXA 24 X – obroty wentylatora (S0–S3), S5 / S6 zasilanie, S7 sonda; NIKE 24 ECO – moc w % (S0 min., S1 maks.).",
        "The S menu depends on the model: EXA 24 X – fan speeds (S0–S3), S5 / S6 flow, S7 probe; NIKE 24 ECO – output in % (S0 min., S1 max.).")) : nothing}
      <div class="grp">${this.t("Pompa i sonda", "Pump and probe")}</div>
      ${sel("ot_p6", "mdi:pump", { zeus25: "P6", tera: "P4", classic: "P2", superior: "P67", hercules: "P67", gen: true }, this.t("praca pompy", "pump operation"))}
      ${sel("ot_sup_pump_speed", "mdi:pump", { superior: "P55" }, this.t("prędkość pompy", "pump speed"))}
      ${sel("ot_her_pump", "mdi:pump", { hercules: "P57" }, this.t("sterowanie pompą", "pump control"))}
      ${r("ot_a3", "mdi:pump", { zeus25: "A3", tera: "A1", gen: true }, this.t("maks. prędkość pompy", "pump max. speed"))}
      ${r("ot_a4", "mdi:pump-off", { zeus25: "A4", tera: "A2", gen: true }, this.t("min. prędkość pompy", "pump min. speed"))}
      ${r("ot_a5", "mdi:delta", { zeus25: "A5", tera: "A3", superior: "P55", hercules: "P57", gen: true }, this.t("ΔT pompy (0 = proporcjonalny, 5–25 K)", "pump ΔT (0 = proportional head, 5–25 K)"))}
      ${r("ot_p7", "mdi:thermometer-plus", { zeus25: "P7", tera: "P5", classic: "S7", superior: "P76", hercules: "P76", gen: true }, this.t("korekta sondy zewnętrznej", "outdoor probe correction") + exa)}
      ${prof === "tera" || prof === "hercules" ? html`<div class="grp">${this.t("Zdalne sterowanie", "Remote control")}</div>` : nothing}
      ${sel("ot_remote_protocol", "mdi:remote", { tera: "P7" }, this.t("protokół zdalnego sterowania", "remote protocol"))}
      ${prof === "tera" ? hint(this.t("Instrukcja TERA: P7 = 0 IMG BUS (CAR V2), 2 = pilot innej firmy na 44 / 41 (nastawa CWU i maks. zasilanie zostają wtedy na panelu kotła); 1 = niedostępne. Na forum podawano P7 = 1 – sprawdź na kotle.",
        "TERA manual: P7 = 0 IMG BUS (CAR V2), 2 = third-party remote on 44 / 41 (the DHW setpoint and max. flow then stay on the boiler panel); 1 = not available. The forum said P7 = 1 – check on the boiler.")) : nothing}
      ${sel("ot_ch_no_remote", "mdi:remote-off", { hercules: "M3 · P33" }, this.t("CO bez działającego pilota", "CH without a working remote"))}
      ${prof === "hercules" ? hint(this.t("P33 = ON: kocioł grzeje CO także przy E31 (brak pilota) – zabezpieczenie przy zdjęciu CAR V2.",
        "P33 = ON: the boiler heats also with E31 (no remote) – a safety net when the CAR V2 is removed.")) : nothing}
      ${m ? html`<div class="grp">${this.t("Informacje (menu M1)", "Information (menu M1)")}</div>
        ${r("ot_sup_hours", "mdi:timer-outline", { superior: "", hercules: "P12" }, this.t("godziny pracy kotła", "boiler operating hours"))}
        ${r("ot_sup_ignitions", "mdi:fire-circle", { superior: "", hercules: "P13" }, this.t("zapłony palnika", "burner ignitions"))}` : nothing}
      ${prof === "superior" ? hint(this.t("Numery P68–P76 odczytane z instrukcji VICTRIX ZEUS Superior 26 / 32 – sprawdź je na swoim kotle. Nowy ZEUS Superior 25 / 30 / 35 ma Modbus i menu tekstowe – Dominus łączy się z nim po Modbusie.",
        "Codes P68–P76 read from the VICTRIX ZEUS Superior 26 / 32 manual – check them on your boiler. The new ZEUS Superior 25 / 30 / 35 has Modbus and a text menu – the Dominus connects to it over Modbus.")) : nothing}`;
  }

  /** Dominus in the OpenTherm mode: the programs kept in Home Assistant and the regulator of the module (Data-ID 89) */
  private otRows() {
    if (!this.ot) return nothing;
    return html`
      ${this.carReady()}
      ${this.toggles([["ot_ro", "mdi:lock-outline", "sky", this.t("Tylko odczyt (steruje pilot)", "Read only (remote in charge)"),
        this.t("HA nic nie zapisuje do kotła – dla CAR V2 / Super Amico. Po włączeniu raz zrestartuj moduł Dominus.",
          "HA writes nothing to the boiler – for a CAR V2 / Super Amico. After switching it on, power-cycle the Dominus once."), true]])}
      ${this.eid("comfort_heat") ? html`<div class="grp">${this.t("Program CO i CWU (Home Assistant)", "CH and DHW program (Home Assistant)")}</div>
        ${this.progLock()}<div class=${this.otRO ? "locked" : ""}>
        ${this.numRow("comfort_heat", "mdi:sofa-outline", this.t("Pokój · Komfort", "Room · Comfort"), 1)}
        ${this.numRow("eco_heat", "mdi:leaf", this.t("Pokój · Eko", "Room · Eco"), 1)}
        ${this.selRow(this.eid("ot_eco_action"), this.t("W fazie Eko", "In the Eco phase"), "mdi:leaf")}
        ${this.s("ot_eco_action") === "reduce_flow" ? this.numRow("ot_eco_red", "mdi:thermometer-minus", this.t("Obniżenie zasilania w Eko (RIDOTT)", "Eco flow reduction (RIDOTT)"), 0) : nothing}
        ${this.eid("ot_self_learn") ? this.switchRow("ot_self_learn", "mdi:school-outline", "mauve", this.t("Samouczenie (AUTO A)", "Self-learning (AUTO A)"),
          this.t("raz na dobę koryguje offset CO o 1 °C, gdy w fazie Komfort pokój był za zimny / za ciepły", "once a day moves the CH offset by 1 °C when the room was too cold / warm in the Comfort phase")) : nothing}
        ${this.numRow("dhw_comfort_dd", "mdi:sofa-outline", this.t("CWU · Komfort", "DHW · Comfort"), 0)}
        ${this.numRow("dhw_eco_dd", "mdi:leaf", this.t("CWU · Eko", "DHW · Eco"), 0)}
        ${this.selRow(this.eid("ot_leg"), this.t("Anty-legionella", "Anti-legionella"), "mdi:bacteria-outline")}
        ${this.numRow("ot_leg_t", "mdi:thermometer-high", this.t("Temperatura anty-legionella", "Anti-legionella temperature"), 0)}
        ${this.so("ot_leg_t")?.attributes?.max !== undefined ? html`<div class="note">${this.t("Maks. ", "Max. ")}${this.f(+this.attr("ot_leg_t", "max"), 0)} °C – ${this.t("tyle przyjmuje kocioł (Data-ID 48)", "what the boiler accepts (Data-ID 48)")}</div>` : nothing}</div>` : nothing}
      ${this.eid("ot_curve") ? html`<div class="grp">${this.t("Regulator Dominusa (jak menu CAR V2)", "Dominus regulator (like the CAR V2 menu)")}</div>
        ${this.switchRow("ot_room_sensor", "mdi:home-thermometer-outline", "green", this.t("Czujnik pokojowy", "Room sensor"), this.t("AMB – regulacja wg temperatury pokoju", "AMB – control by the room temperature"))}
        ${this.selRow(this.eid("ot_ntc"), this.t("Sonda Dominusa mierzy", "Dominus probe measures"), "mdi:thermometer-probe")}
        ${this.switchRow("ot_out_sensor", "mdi:thermometer", "sky", this.t("Sonda zewnętrzna", "Outdoor sensor"), this.t("praca pogodowa wg krzywej", "weather compensation by the curve"))}
        ${this.numRow("ot_curve", "mdi:chart-bell-curve-cumulative", this.t("Krzywa grzewcza", "Heating curve"), 1)}
        ${this.numRow("ot_offset", "mdi:plus-minus-variant", this.t("Offset temperatury CO", "CH temperature offset"), 0)}
        ${this.numRow("ot_ch_min", "mdi:thermometer-low", this.t("Min. temperatura CO", "Min. CH temperature"), 0)}
        ${this.numRow("ot_inertia", "mdi:home-clock-outline", this.t("Bezwładność budynku (DIMENS)", "Building inertia (BUILD)"), 0)}
        ${this.numRow("ot_hyst", "mdi:arrow-expand-vertical", this.t("Histereza pokojowa", "Room hysteresis"), 1)}
        ${this.switchRow("ot_modul", "mdi:fire-circle", "peach", this.t("Modulacja", "Modulation"), this.t("MODUL – zasilanie wg różnicy pokój / zadana", "MODUL – flow by the room / setpoint difference"))}
        ${this.numRow("ot_frost_t", "mdi:snowflake-thermometer", this.t("Próg ochrony przed zamarzaniem", "Frost protection threshold"), 1)}` : nothing}`;
  }

  /** OpenTherm: CAR V2 "MANUTZ" - the service reminder (interval, last service, "service done") */
  private maintRows() {
    const due = this.on("ot_maint_due"), next = this.attr("ot_maint_due", "next_service") as string | null, left = this.attr("ot_maint_due", "days_left");
    const last = this.s("ot_last_srv"), fmt = (s: string | null | undefined) => s && !["unknown", "unavailable", ""].includes(s)
      ? new Date(s).toLocaleDateString(this.loc, { dateStyle: "medium" }) : "–";
    const tag = "srv_done", armed = this.isArmed(tag);
    return html`<div class="grp">${this.t("Przegląd kotła (MANUTZ)", "Boiler service (MANUTZ)")}</div>
      ${this.selRow(this.eid("ot_maint"), this.t("Przypomnienie", "Reminder"), "mdi:wrench-clock")}
      <div class="nr"><ha-icon icon="mdi:calendar-check"></ha-icon><span class="nl" @click=${() => this.moreInfo("ot_last_srv")}>${this.t("Ostatni przegląd", "Last service")}</span>
        <span class="nv" style="min-width:auto">${fmt(last)}</span></div>
      ${next ? html`<div class="nr"><ha-icon icon=${due ? "mdi:alert-circle-outline" : "mdi:calendar-clock"} style=${due ? `color:${c("red")}` : ""}></ha-icon>
        <span class="nl" @click=${() => this.moreInfo("ot_maint_due")}>${this.t("Następny przegląd", "Next service")}</span>
        <span class="nv" style="min-width:auto;${due ? `color:${c("red")}` : ""}">${fmt(next)}${typeof left === "number" ? ` · ${due ? this.t("po terminie", "overdue") : left + this.t(" dni", " days")}` : ""}</span></div>` : nothing}
      ${this.eid("ot_srv_done") ? html`<div class="nr"><ha-icon icon="mdi:wrench-check"></ha-icon><span class="nl">${this.t("Przegląd wykonany dziś", "Serviced today")}</span>
        <div class="btn xs" style=${armed ? `outline:2px solid ${c("green")}` : ""} @click=${() => this.confirm(tag, () => this.call("button", "press", "ot_srv_done"))}>
          <ha-icon icon=${armed ? "mdi:check-all" : "mdi:check"}></ha-icon></div></div>` : nothing}`;
  }

  /** Immergas Dominus 1.3.0, online part: vacation, automatic summer / winter, alerts (all writes off by default) */
  private domRows() {
    const until = this.so("dom_vac_until"), u = until && !["unknown", "unavailable", ""].includes(until.state)
      ? new Date(until.state).toLocaleString(this.loc, { dateStyle: "medium", timeStyle: "short" }) : this.t("do wyłączenia", "until switched off");
    const alert = (k: "dom_frost" | "dom_offline") => this.bad(k) ? "–" : this.on(k) ? this.t("ALARM", "ALERT") : this.t("ok", "ok");
    return html`
      ${this.eid("dom_flow_target") || this.eid("dom_hum_target") ? html`<div class="grp">${this.t("Nastawy Strefy 1", "Zone 1 settings")}</div>
        ${this.numRow("dom_flow_target", "mdi:thermometer-water", this.t("Zadana zasilania", "Flow setpoint"), 0)}
        ${this.numRow("dom_hum_target", "mdi:water-percent", this.t("Zadana wilgotności", "Humidity setpoint"), 0)}` : nothing}
      ${this.eid("floor_type") || this.eid("heated_area") ? html`<div class="grp">${this.t("Budynek", "Building")}</div>
        ${this.selRow(this.eid("floor_type"), this.t("Rodzaj posadzki", "Floor screed type"), "mdi:layers-triple-outline")}
        ${this.numRow("heated_area", "mdi:floor-plan", this.t("Powierzchnia ogrzewana", "Heated floor area"), 0)}` : nothing}
      ${this.eid("ot_maint") ? this.maintRows() : nothing}
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
    const sum = !this.dominus ? (part === "online" ? this.t("ceny, zasobnik, szacowanie gazu, posadzka, powierzchnia, język błędów", "prices, cylinder, gas estimate, screed, floor area, fault language")
        : part === "offline" ? this.t("U12/U13, P16/P17/P13, limit podłogi, tania taryfa, R02/R03, R10/R11, P07", "U12/U13, P16/P17/P13, floor limit, cheap tariff, R02/R03, R10/R11, P07")
        : this.t("ceny, zasobnik, tryb nocny, legionella…", "prices, cylinder, night mode, legionella…"))
      : part === "online" ? (this.ot ? this.t("praca bez CAR V2, programy CO / CWU, regulator Dominusa, przegląd, Lato/Zima, alarmy", "running without the CAR V2, CH / DHW programs, Dominus regulator, service, summer/winter, alerts")
        : this.t("zasilanie, wilgotność, posadzka, powierzchnia, Lato/Zima, alarmy, język błędów", "flow, humidity, screed, floor area, summer/winter, alerts, fault language"))
      : part === "offline" ? (this.ot ? this.t("termostat, menu kotła wg modelu: zasilanie, zapłon, moc, pompa, sonda", "thermostat, boiler menu by model: flow, ignition, output, pump, probe")
        : this.t("U11, P15, krzywe R, T02/T05, integracja I, A31, P07", "U11, P15, R curves, T02/T05, I integration, A31, P07"))
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
      ${open && this.dominus && off ? (this.ot ? this.otOffline() : this.domOffline()) : nothing}
      ${open && this.dominus && on ? html`${this.otRows()}${this.domRows()}` : nothing}
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
