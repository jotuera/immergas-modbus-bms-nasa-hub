// OpenTherm (Immergas Dominus in the OpenTherm mode, VICTRIX ZEUS / AVIO …): two cards for what only OpenTherm has.
// "Kocioł OpenTherm / OpenTherm boiler": what the boiler reports about itself (capacity, limits, DHW type), the fault
// flags and the fault history, burner starts, the read-only switch and the boiler reset.
// "Mapa Data-ID / Data-ID map": the Data-ID scan with the boiler's own parameters (TSP) and the report to GitHub.
import { HubCard, html, css, nothing, c, ca, box, register } from "../base";
import { Key } from "../names";

const FLAGS: [Key, string, [string, string]][] = [
  ["ot_f_water", "mdi:gauge-low", ["Niskie ciśnienie wody", "Low water pressure"]],
  ["ot_f_flame", "mdi:fire-alert", ["Błąd gazu / płomienia", "Gas / flame fault"]],
  ["ot_f_air", "mdi:fan-alert", ["Błąd ciągu powietrza", "Air pressure fault"]],
  ["ot_f_hot", "mdi:thermometer-alert", ["Przegrzanie wody", "Water over-temperature"]],
  ["ot_f_service", "mdi:wrench-clock", ["Wymagany serwis", "Service request"]],
];

/** OpenTherm 2.2 Data-ID names (PL, EN) for the ESP hub map */
const ID_NAMES: Record<number, [string, string]> = {
  0: ["Status", "Status"], 1: ["Nastawa zasilania CO", "CH flow setpoint"], 2: ["Konfiguracja mastera", "Master configuration"],
  3: ["Konfiguracja kotła", "Slave configuration"], 4: ["Polecenie zdalne", "Remote command"], 5: ["Flagi i kod usterki", "Fault flags / code"],
  6: ["Parametry zdalne", "Remote parameters"], 7: ["Sygnał chłodzenia", "Cooling control"], 8: ["Nastawa CO2", "CH2 flow setpoint"],
  9: ["Nadpisanie nastawy pokoju", "Room setpoint override"], 10: ["Liczba TSP", "TSP count"], 11: ["Parametr TSP", "TSP entry"],
  12: ["Liczba wpisów historii błędów", "Fault buffer size"], 13: ["Historia błędów", "Fault buffer entry"], 14: ["Maks. modulacja", "Max. modulation"],
  15: ["Moc maks. / min. modulacja", "Max. capacity / min. modulation"], 16: ["Zadana pokoju", "Room setpoint"], 17: ["Modulacja", "Modulation"],
  18: ["Ciśnienie wody", "Water pressure"], 19: ["Przepływ CWU", "DHW flow"], 20: ["Dzień i godzina", "Day and time"], 21: ["Data", "Date"],
  22: ["Rok", "Year"], 23: ["Zadana pokoju CO2", "Room setpoint CH2"], 24: ["Temperatura pokoju", "Room temperature"], 25: ["Zasilanie", "Flow"],
  26: ["CWU", "DHW"], 27: ["Temp. zewnętrzna", "Outdoor"], 28: ["Powrót", "Return"], 29: ["Zasobnik solarny", "Solar storage"],
  30: ["Kolektor solarny", "Solar collector"], 31: ["Zasilanie CO2", "Flow CH2"], 32: ["CWU 2", "DHW 2"], 33: ["Spaliny", "Exhaust"],
  34: ["Wymiennik", "Heat exchanger"], 35: ["Wentylator", "Fan speed"], 36: ["Prąd płomienia", "Flame current"], 37: ["Pokój CO2", "Room CH2"],
  38: ["Wilgotność", "Humidity"], 48: ["Zakres CWU", "DHW bounds"], 49: ["Zakres CO", "CH bounds"], 50: ["Zakres krzywej OTC", "OTC bounds"],
  56: ["Nastawa CWU", "DHW setpoint"], 57: ["Maks. nastawa CO", "Max. CH setpoint"], 58: ["Krzywa OTC", "OTC ratio"],
  70: ["Status wentylacji", "Ventilation status"], 99: ["Tryb pracy", "Operating mode"], 100: ["Nadpisanie pilota", "Remote override"],
  113: ["Nieudane starty", "Unsuccessful starts"], 114: ["Zaniki płomienia", "Flame lost"], 115: ["Kod diagnostyczny OEM", "OEM diagnostic code"],
  116: ["Starty palnika", "Burner starts"], 117: ["Starty pompy CO", "CH pump starts"], 118: ["Starty pompy CWU", "DHW pump starts"],
  119: ["Starty palnika CWU", "DHW burner starts"], 120: ["Godziny palnika", "Burner hours"], 121: ["Godziny pompy CO", "CH pump hours"],
  122: ["Godziny pompy CWU", "DHW pump hours"], 123: ["Godziny palnika CWU", "DHW burner hours"], 124: ["Wersja OT mastera", "Master OT version"],
  125: ["Wersja OT kotła", "Slave OT version"], 126: ["Wersja mastera", "Master version"], 127: ["Wersja kotła", "Slave version"],
};
/** 64 hex characters -> the set Data-IDs (byte 0 = IDs 0-7, bit 0 = the lowest) */
const bits = (s: string | undefined): number[] => {
  if (!s || !/^[0-9A-F]{64}$/i.test(s)) return [];
  const out: number[] = [];
  for (let b = 0; b < 32; b++) { const v = parseInt(s.slice(b * 2, b * 2 + 2), 16); for (let i = 0; i < 8; i++) if (v & (1 << i)) out.push(b * 8 + i); }
  return out;
};

/** "0x091B" -> number (the Data-ID scan values) */
const hex = (v: unknown) => (typeof v === "string" && /^0x[0-9a-f]+$/i.test(v) ? parseInt(v, 16) : NaN);

class ImmergasOtBoilerCard extends HubCard {
  private range(k: Key) {
    // ESP hub: the boiler's bounds (Data-ID 48 / 49) are sensors, the numbers keep their own fixed range
    if (this.esp) {
      const [lo, hi] = k === "ot_ch_set" ? [this.n("ot_chb_min"), this.n("ot_chb_max")] : [this.n("ot_dhwb_min"), this.n("ot_dhwb_max")];
      return isNaN(lo) || isNaN(hi) ? this.t("kocioł nie podaje", "not reported") : `${this.f(lo, 0)}–${this.f(hi, 0)} °C`;
    }
    const a = this.so(k)?.attributes;
    return a && a.min !== undefined && a.max !== undefined ? `${this.f(a.min, 0)}–${this.f(a.max, 0)} °C` : "–";
  }

  protected body() {
    if (!this.ot) return html`${this.head("mdi:water-boiler", this.t("Kocioł OpenTherm", "OpenTherm boiler"))}
      <div class="hint">${this.t("Ta karta jest dla integracji Immergas Dominus w trybie OpenTherm.", "This card is for the Immergas Dominus integration in the OpenTherm mode.")}</div>`;
    const ro = this.on("ot_ro");
    // DHW type from the Data-ID scan (Data-ID 3 slave flags: bit 0 = DHW present, bit 3 = storage tank)
    const cfg = hex((this.attr("ot_ids", "values") ?? {})["3"]), flags = isNaN(cfg) ? NaN : cfg >> 8;
    const dhwType = isNaN(flags) ? "" : !(flags & 1) ? this.t("brak CWU", "no DHW") : flags & 8 ? this.t("zasobnik", "storage tank") : this.t("przepływowa", "instantaneous");
    const cap = this.n("ot_cap"), mm = this.n("ot_minmod");
    const active = FLAGS.filter(([k]) => this.on(k)), known = FLAGS.some(([k]) => this.eid(k) && !this.bad(k));
    // fault history: the attributes entry_1 … of the sensor (disabled by default - not every boiler answers it)
    const hist = Object.entries((this.so("ot_fhist")?.attributes ?? {}) as Record<string, unknown>)
      .filter(([k]) => /^entry_\d+$/.test(k)).sort((a, b) => parseInt(a[0].slice(6)) - parseInt(b[0].slice(6)));
    const st = this.n("ot_burn_today"), sh = this.n("ot_burn_h"), bh = this.n("ot_burn_hours");
    const shCol = isNaN(sh) ? "overlay1" : sh > 6 ? "red" : sh > 3 ? "peach" : "green";
    const resetTag = "ot_reset", armed = this.isArmed(resetTag);
    return html`
      ${this.head("mdi:water-boiler", this.gbx ? this.t("Kocioł · Modbus BMS", "Boiler · Modbus BMS") : this.t("Kocioł · OpenTherm", "Boiler · OpenTherm"), ro ? html`<span class="ro"><ha-icon icon="mdi:lock-outline"></ha-icon>${this.t("tylko odczyt", "read only")}</span>` : undefined)}
      <div class="grid">
        ${this.gbx ? nothing : this.chip("ot_cap", "mdi:lightning-bolt", "peach", this.t("Moc maks.", "Max. capacity"), cap > 0 ? this.f(cap, 0) + " kW" : this.t("kocioł nie podaje", "not reported"))}
        ${this.gbx ? nothing : this.chip("ot_minmod", "mdi:percent-outline", "peach", this.t("Min. modulacja", "Min. modulation"), isNaN(mm) ? "–" : this.f(mm, 0) + " %")}
        ${this.chip("ot_ch_set", "mdi:radiator", "red", this.t("Zakres CO (kocioł)", "CH range (boiler)"), this.range("ot_ch_set"))}
        ${this.chip("dhw_set", "mdi:water-boiler", "yellow", this.t("Zakres CWU (kocioł)", "DHW range (boiler)"), this.range("dhw_set") + (dhwType ? " · " + dhwType : ""))}
        ${this.eid("ot_exhaust") && !this.bad("ot_exhaust") ? this.chip("ot_exhaust", "mdi:smoke", "overlay2", this.t("Spaliny", "Exhaust"), this.f(this.n("ot_exhaust"), 1, 1) + " °C") : nothing}
        ${this.esp && this.eid("ot_press") && !this.bad("ot_press") ? (() => { const p = this.n("ot_press"); return this.chip("ot_press", "mdi:gauge", p < 1 || p > 2.5 ? "red" : "green", this.t("Ciśnienie instalacji", "System pressure"), this.f(p, 1, 1) + " bar", p < 1 || p > 2.5); })() : nothing}
        ${this.eid("ot_fan") && !this.bad("ot_fan") ? this.chip("ot_fan", "mdi:fan", "sky", this.t("Wentylator", "Fan"), this.f(this.n("ot_fan"), 0) + this.t(" obr/min", " rpm")) : nothing}
        ${this.eid("ot_flame_i") && !this.bad("ot_flame_i") ? this.chip("ot_flame_i", "mdi:fire-circle", "peach", this.t("Prąd płomienia", "Flame current"), this.f(this.n("ot_flame_i"), 1, 1) + " µA") : nothing}
      </div>
      ${this.eid("ot_burn_today") && !this.esp ? html`<div class="sec">${this.t("Palnik", "Burner")}</div>
        <div class="grid">
          ${this.chip("ot_burn_today", "mdi:fire-circle", "peach", this.t("Starty dziś", "Starts today"), this.f(st, 0) + (isNaN(bh) ? "" : ` · ${this.f(bh, 1, 1)} h`))}
          ${this.chip("ot_burn_h", "mdi:fire-alert", shCol, this.t("Starty / ostatnia godzina", "Starts / last hour"), this.f(sh, 0) + (sh > 6 ? this.t(" · taktowanie", " · short cycling") : ""), sh > 6)}
        </div>
        <div class="hint">${this.esp ? this.t("Liczone w hubie z bitu płomienia każdej ramki statusu (~1 s) – żaden zapłon nie umyka.", "Counted in the hub from the flame bit of every status frame (~1 s) – no burn is missed.") : this.t("Liczone z płomienia co cykl odczytu (~45 s) – bardzo krótkie zapłony mogą umknąć.", "Counted from the flame flag every polling cycle (~45 s) – very short burns may be missed.")}</div>` : nothing}
      ${this.gbx ? this.gbBlocks() : nothing}
      ${this.esp && this.eid("ot_frames") ? (() => {
        const fr = this.n("ot_frames"), er = this.n("ot_errors"), to = this.n("ot_timeouts"), all = (fr || 0) + (er || 0) + (to || 0);
        const bad = all > 0 ? ((er || 0) + (to || 0)) / all * 100 : NaN, col = isNaN(bad) ? "overlay2" : bad > 5 ? "red" : bad > 1 ? "peach" : "green";
        return html`<div class="sec">${this.t("Komunikacja OpenTherm", "OpenTherm link")}</div>
          <div class="grid">
            ${this.chip("ot_frames", "mdi:check-network-outline", "green", this.t("Ramki poprawne", "Frames OK"), this.f(fr, 0))}
            ${this.chip("ot_errors", "mdi:alert-outline", er > 0 ? "peach" : "overlay2", this.t("Błędy ramek", "Frame errors"), this.f(er, 0))}
            ${this.chip("ot_timeouts", "mdi:timer-alert-outline", to > 0 ? "peach" : "overlay2", this.t("Brak odpowiedzi", "No answer"), this.f(to, 0))}
            ${this.chip("ot_frames", "mdi:percent-outline", col, this.t("Udział błędów", "Error share"), isNaN(bad) ? "–" : this.f(bad, 2) + " %")}
          </div>`;
      })() : nothing}
      <div class="sec">${this.t("Błędy", "Faults")}</div>
      ${this.gbx ? this.gbFaults() : nothing}
      ${this.on("ot_maint_due") ? html`<div class="grid1">${this.chip("ot_maint_due", "mdi:wrench-clock", "peach", this.t("Przegląd kotła", "Boiler service"),
        this.t("termin minął – po przeglądzie naciśnij „Przegląd wykonany”", "due – after the service press “Service done”"), true)}</div>` : nothing}
      ${this.gbx ? nothing : active.length ? html`<div class="grid">${active.map(([k, icon, [pl, en]]) => this.chip(k, icon, "red", this.t("Flaga błędu", "Fault flag"), this.t(pl, en), true))}</div>`
        : known ? html`<div class="grid1">${this.chip(FLAGS[0][0], "mdi:check-circle-outline", "green", this.t("Flagi błędów (ID5)", "Fault flags (ID5)"), this.t("brak – ciśnienie, płomień, ciąg, temperatura OK", "none – pressure, flame, air, temperature OK"))}</div>` : nothing}
      ${this.eid("ot_fhist") && !this.bad("ot_fhist") ? html`<div class="hist">
          <div class="hh" @click=${() => this.moreInfo("ot_fhist")}><ha-icon icon="mdi:history"></ha-icon>${this.t("Historia błędów kotła", "Boiler fault history")} · ${this.f(this.n("ot_fhist"), 0)}</div>
          ${hist.length ? hist.map(([k, v]) => html`<div class="hr"><span class="hn">${k.slice(6)}.</span><span>${String(v)}</span></div>`)
            : html`<div class="hr"><span>${this.t("brak wpisów", "no entries")}</span></div>`}</div>`
        : this.eid("ot_fhist") || this.eid("ot_reset") ? html`<div class="hint">${this.t("Historia błędów: włącz encję „Historia błędów” w urządzeniu (domyślnie wyłączona – nie każdy kocioł ją podaje).",
          "Fault history: enable the “Fault history” entity of the device (disabled by default – not every boiler reports it).")}</div>` : nothing}
      <div class="row">
        ${this.eid("ot_reset") ? html`<button class="act" ?disabled=${ro} style=${armed ? box("red", true) : ""}
          @click=${() => !ro && this.confirm(resetTag, () => this.call("button", "press", "ot_reset"))}>
          <ha-icon icon="mdi:restart-alert"></ha-icon>${armed ? this.t("Potwierdź reset", "Confirm reset") : this.t("Reset kotła", "Boiler reset")}</button>` : nothing}
      </div>
`;
  }

  /** gas boiler over Modbus BMS: what the model reports, its functions (BOOST, ECO, power limit, MAGIS M TOP), hours */
  private gbBlocks() {
    const v = (k: Key, d = 1, u = " °C") => this.f(this.n(k), d, d ? 1 : 0) + u, has = (k: Key) => !!this.eid(k) && !this.bad(k);
    const temps: [Key, string, string, string, string][] = [
      ["gb_calc", "mdi:calculator-variant-outline", "red", this.t("Obliczone zasilanie", "Calculated flow"), v("gb_calc")],
      ["gb_hvdt", "mdi:pipe", "peach", this.t("Za sprzęgłem (HVDT)", "After the separator (HVDT)"), v("gb_hvdt")],
      ["gb_dhw_in", "mdi:water-thermometer-outline", "sky", this.t("Woda zimna CWU", "DHW inlet"), v("gb_dhw_in")],
      ["gb_dhw_flow", "mdi:water-pump", "sky", this.t("Przepływ CWU", "DHW flow"), v("gb_dhw_flow", 1, " l/min")],
      ["gb_pump_flow", "mdi:pump", "teal", this.t("Przepływ pompy", "Pump flow"), v("gb_pump_flow", 0, " l/h")],
      ["gb_sflow", "mdi:water-pump", "teal", this.t("Przepływ instalacji", "System flow"), v("gb_sflow", 0, " l/h")],
    ];
    const t2 = temps.filter(([k]) => has(k));
    const hp: [Key, string, string, string][] = [["gb_hp", "mdi:heat-pump", "green", this.t("Pompa ciepła", "Heat pump")], ["gb_defrost", "mdi:snowflake-melt", "sky", this.t("Odszranianie", "Defrost")],
      ["gb_antifreeze", "mdi:snowflake-alert", "sky", this.t("Ochrona przed zamarzaniem", "Antifreeze")], ["gb_cool_ok", "mdi:snowflake", "sky", this.t("Chłodzenie dozwolone", "Cooling allowed")]];
    const hp2 = hp.filter(([k]) => this.eid(k));
    const hours: [Key, string, string][] = [["ot_hours_total", "mdi:timer-outline", this.t("Godziny palnika", "Burner hours")], ["gb_hours_ch", "mdi:radiator", this.t("Godziny palnika CO", "CH burner hours")],
      ["gb_hours_dhw", "mdi:water-boiler", this.t("Godziny palnika CWU", "DHW burner hours")]];
    const h2 = hours.filter(([k]) => has(k));
    const funcs = this.toggles([
      ["gb_boost", "mdi:water-plus", "yellow", this.t("CWU BOOST", "DHW BOOST"), this.t("jednorazowe szybkie grzanie CWU", "a one-off quick DHW heat-up")],
      ["gb_eco", "mdi:leaf", "green", this.t("CWU ECO", "DHW ECO"), this.t("niższa temperatura utrzymania CWU", "lower DHW keep-warm")],
      ["gb_nodhwprio", "mdi:priority-low", "peach", this.t("Grzanie bez priorytetu CWU", "Heat request without DHW priority")],
      ["gb_ch_prio", "mdi:priority-high", "peach", this.t("CO przed CWU", "CH before DHW")],
      ["gb_silent", "mdi:volume-low", "lavender", this.t("Tryb cichy", "Silent mode")],
      ["gb_cool_en", "mdi:snowflake", "sky", this.t("Zezwól na chłodzenie", "Allow cooling")],
      ["gb_reqtype", "mdi:sun-snowflake-variant", "sky", this.t("Żądanie: grzanie / chłodzenie", "Request: heating / cooling")],
    ]);
    return html`
      ${t2.length ? html`<div class="grid" style="margin-top:8px">${t2.map(([k, ic, col, l, val]) => this.chip(k, ic, col, l, val))}</div>` : nothing}
      ${hp2.length ? html`<div class="sec">MAGIS M TOP</div><div class="grid">${hp2.map(([k, ic, col, l]) => this.chip(k, ic, this.on(k) ? col : "overlay1", l, this.on(k) ? this.t("tak", "yes") : this.t("nie", "no"), this.on(k)))}</div>
        ${this.eid("gb_cool_max") ? html`<div class="hint">${this.t("Zakres chłodzenia ", "Cooling range ")}${this.f(this.n("gb_cool_min"), 0)}–${this.f(this.n("gb_cool_max"), 0)} °C</div>` : nothing}` : nothing}
      ${funcs === nothing && !this.eid("gb_power") ? nothing : html`<div class="sec">${this.t("Funkcje modelu", "Model functions")}</div>${funcs}
        ${this.eid("gb_power") ? this.numRow("gb_power", "mdi:speedometer-medium", this.t("Górny limit mocy (BMS 513)", "Upper power limit (BMS 513)"), 0) : nothing}`}
      ${h2.length ? html`<div class="sec">${this.t("Palnik", "Burner")}</div><div class="grid">${h2.map(([k, ic, l]) => this.chip(k, ic, "overlay2", l, this.f(this.n(k), 0) + " h"))}</div>` : nothing}`;
  }

  /** gas boiler over Modbus BMS: the fault text and code, resettable / locked, the two-tap reset (257 = 0xAA55) */
  private gbFaults() {
    const code = this.n("err_code"), desc = this.s("err_desc") ?? "", any = code > 0, res = this.on("gb_fault_res"), lock = this.on("gb_fault_lock");
    const tag = "gb_reset", armed = this.isArmed(tag);
    return html`<div class="grid1">${this.chip("err_desc", any ? "mdi:alert-octagon" : "mdi:check-circle-outline", any ? "red" : "green",
        any ? this.t(`Usterka E${this.f(code, 0)}`, `Fault E${this.f(code, 0)}`) : this.t("Usterka", "Fault"), desc || "–", any)}</div>
      ${any ? html`<div class="hint">${lock ? this.t("niekasowalna – wymaga serwisu albo usunięcia przyczyny", "not resettable – needs service or the cause removed")
        : res ? this.t("kasowalna – możesz ją zresetować", "resettable – you can reset it") : ""}</div>` : nothing}
      ${this.eid("gb_reset") ? html`<div class="row"><button class="act" ?disabled=${!res} style=${armed ? box("red", true) : ""}
        @click=${() => res && this.confirm(tag, () => this.call("button", "press", "gb_reset"))}>
        <ha-icon icon="mdi:restart-alert"></ha-icon>${armed ? this.t("Potwierdź reset", "Confirm reset") : this.t("Reset usterki", "Fault reset")}</button></div>` : nothing}`;
  }

  static styles = [HubCard.styles, css`
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .grid1 { display: grid; gap: 8px; }
    .sec { font-size: 10.5px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; opacity: .6; margin: 12px 0 6px; }
    .hint { font-size: 10.5px; opacity: .6; margin-top: 6px; line-height: 1.35; }
    .ro { display: inline-flex; align-items: center; gap: 3px; font-size: 10.5px; font-weight: 800; color: var(--ih-sky); }
    .ro ha-icon { --mdc-icon-size: 14px; }
    .hist { margin-top: 8px; padding: 8px 10px; border-radius: 12px; background: rgba(var(--ih-overlay1-rgb), 0.08); border: 1px solid rgba(var(--ih-overlay1-rgb), 0.2); }
    .hh { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 800; cursor: pointer; margin-bottom: 4px; }
    .hh ha-icon { --mdc-icon-size: 16px; opacity: .7; }
    .hr { font-size: 11px; line-height: 1.4; display: flex; gap: 6px; padding: 2px 0; }
    .hn { font-weight: 800; opacity: .55; min-width: 16px; }
    .row { display: flex; gap: 8px; margin: 10px 0 8px; flex-wrap: wrap; }
    .act { display: inline-flex; align-items: center; gap: 6px; font: inherit; font-size: 12px; font-weight: 800; cursor: pointer;
      padding: 7px 12px; border-radius: 10px; border: 1px solid rgba(var(--ih-red-rgb), 0.4); background: rgba(var(--ih-red-rgb), 0.08); color: inherit; }
    .act[disabled] { opacity: .4; cursor: default; }
    .act ha-icon { --mdc-icon-size: 16px; color: var(--ih-red); }
  `];
}

class ImmergasOtMapCard extends HubCard {
  private open: boolean | null = null;

  protected body() {
    if (this.esp) return this.espMap();
    if (!this.ot || !this.eid("ot_ids")) return html`${this.head("mdi:radar", this.t("Mapa Data-ID", "Data-ID map"))}
      <div class="hint">${this.t("Ta karta jest dla integracji Immergas Dominus w trybie OpenTherm (1.6.1+).", "This card is for the Immergas Dominus integration in the OpenTherm mode (1.6.1+).")}</div>`;
    const running = !!this.attr("ot_ids", "running"), sup = this.n("ot_ids");
    const tsp = (this.attr("ot_ids", "boiler_parameters") ?? null) as Record<string, unknown> | null;
    const fh = (this.attr("ot_ids", "fault_history") ?? null) as Record<string, unknown> | null;
    const ok = (t: Record<string, unknown> | null) => (t ? Object.values(t).filter((v) => typeof v === "number").length : 0);
    const fin = this.attr("ot_ids", "finished") as string | undefined;
    const model = this.s("dom_model") ?? "";
    const scanTag = "ot_scan", armed = this.isArmed(scanTag), open = this.open ?? !!this.config.expanded;
    return html`
      <div class="sh" @click=${() => { this.open = !open; this.requestUpdate(); }}>
        <ha-icon icon="mdi:radar"></ha-icon><span class="ttl">${this.t("Mapa Data-ID", "Data-ID map")}</span>
        <span class="sum">${open ? "" : running ? this.t("skanuję…", "scanning…") : isNaN(sup) ? this.t("co kocioł podaje – jeszcze nie skanowano", "what the boiler answers – not scanned yet")
          : `${this.f(sup, 0)} / 128 Data-ID` + (tsp ? ` · TSP ${ok(tsp)} / ${Object.keys(tsp).length}` : "")}</span>
        <ha-icon class="chev" icon=${open ? "mdi:chevron-up" : "mdi:chevron-down"}></ha-icon></div>
      ${!open ? nothing : html`
      ${this.eid("dom_model") ? html`<div class="model"><ha-icon icon="mdi:water-boiler"></ha-icon>
        <input .value=${model === "unknown" ? "" : model} placeholder=${this.t("Model kotła (z tabliczki)", "Boiler model (rating plate)")}
          @change=${(e: Event) => this.call("text", "set_value", "dom_model", { value: (e.target as HTMLInputElement).value.trim() })}></div>` : nothing}
      <div class="grid">
        ${this.chip("ot_ids", running ? "mdi:timer-sand" : "mdi:format-list-checks", running ? "yellow" : "sky", this.t("Obsługiwane Data-ID", "Supported Data-IDs"),
          running ? this.t("skanuję…", "scanning…") : isNaN(sup) ? this.t("jeszcze nie skanowano", "not scanned yet") : this.f(sup, 0) + " / 128")}
        ${this.chip("ot_ids", "mdi:tune-variant", "mauve", this.t("Parametry kotła (TSP)", "Boiler parameters (TSP)"),
          tsp ? `${ok(tsp)} / ${Object.keys(tsp).length}` : this.t("kocioł nie podaje", "not reported"))}
        ${fh ? this.chip("ot_ids", "mdi:history", "peach", this.t("Historia błędów (skan)", "Fault history (scan)"), String(ok(fh))) : nothing}
        ${fin ? this.chip("ot_ids", "mdi:clock-check-outline", "overlay2", this.t("Ostatni skan", "Last scan"),
          new Date(fin).toLocaleString(this.loc, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })) : nothing}
      </div>
      <div class="row">
        <button class="go" ?disabled=${running || !this.eid("ot_scan")} style=${armed ? box("sky", true) : ""}
          @click=${() => this.confirm(scanTag, () => this.call("button", "press", "ot_scan"))}>
          <ha-icon icon="mdi:radar"></ha-icon>${armed ? this.t("Potwierdź – ok. 1 min", "Confirm – about 1 min") : this.t("Skanuj Data-ID", "Scan Data-IDs")}</button>
        <button class="go" ?disabled=${running || isNaN(sup) || !this.eid("ot_report")} @click=${() => this.call("button", "press", "ot_report")}>
          <ha-icon icon="mdi:github"></ha-icon>${this.t("Przygotuj zgłoszenie", "Prepare report")}</button>
      </div>
      <div class="hint">${this.t("Skan czyta raz każdy standardowy Data-ID i parametry kotła (odczyt w tym czasie pauzuje). Zgłoszenie: link w powiadomieniach HA otwiera GitHub z gotową mapą i modelem – nic nie jest wysyłane, dopóki nie naciśniesz Create.",
        "The scan reads every standard Data-ID once and the boiler parameters (polling pauses meanwhile). Report: a link in the HA notifications opens GitHub with the map and the model filled in – nothing is sent until you press Create.")}</div>`}`;
  }

  /** ESP hub: the map comes from every frame - no scan; supported / unknown / asked by the room unit, a 128-cell grid */
  private espMap() {
    const sup = bits(this.s("ot_ids_sup")), unk = bits(this.s("ot_ids_unk")), room = bits(this.s("ot_ids_room"));
    const open = this.open ?? !!this.config.expanded, nm = (id: number) => (ID_NAMES[id] ? this.t(ID_NAMES[id][0], ID_NAMES[id][1]) : "");
    const has = !!this.eid("ot_ids_sup");
    const sum = !has ? this.t("dodaj pakiet ot_core ≥ 1.3", "add the ot_core package ≥ 1.3")
      : `${sup.length} / 128 Data-ID` + (unk.length ? this.t(` · ${unk.length} nieznanych`, ` · ${unk.length} unknown`) : "")
        + (room.length ? this.t(` · pilot ${room.length}`, ` · room unit ${room.length}`) : "");
    const cell = (id: number) => {
      const s = sup.includes(id), u = unk.includes(id), r = room.includes(id);
      const col = s ? "green" : u ? "red" : "overlay1";
      return html`<div class="cell" title=${`${id}${nm(id) ? " · " + nm(id) : ""}${s ? this.t(" · kocioł odpowiada", " · the boiler answers") : u ? this.t(" · kocioł nie zna", " · unknown to the boiler") : ""}${r ? this.t(" · pyta pilot", " · asked by the room unit") : ""}`}
        style="background:${s || u ? ca(col, s ? 0.45 : 0.3) : "rgba(255,255,255,.04)"};${r ? `outline:1.5px solid ${c("sky")};outline-offset:-1.5px` : ""}">${id}</div>`;
    };
    const list = (ids: number[], col: string) => html`<div class="ids">${ids.map((id) => html`<span class="idc" style=${box(col, false)}><b>${id}</b>${nm(id) ? " " + nm(id) : ""}</span>`)}</div>`;
    const report = () => {
      const body = [`Boiler model: `, ``, `Supported: ${sup.join(", ")}`, `Unknown to the boiler: ${unk.join(", ")}`, room.length ? `Asked by the room unit: ${room.join(", ")}` : "",
        ``, `(immergas_ot hub, Data-ID map)`].filter((x) => x !== null).join("\n");
      window.open("https://github.com/jotuera/immergas-modbus-bms-nasa-opentherm-hub/issues/new?title=" + encodeURIComponent("OpenTherm Data-ID map: <boiler model>")
        + "&body=" + encodeURIComponent(body), "_blank");
    };
    return html`
      <div class="sh" @click=${() => { this.open = !open; this.requestUpdate(); }}>
        <ha-icon icon="mdi:radar"></ha-icon><span class="ttl">${this.t("Mapa Data-ID", "Data-ID map")}</span>
        <span class="sum">${open ? "" : sum}</span>
        <ha-icon class="chev" icon=${open ? "mdi:chevron-up" : "mdi:chevron-down"}></ha-icon></div>
      ${!open ? nothing : !has ? html`<div class="hint">${sum}</div>` : html`
      <div class="grid">
        ${this.chip("ot_ids_sup", "mdi:format-list-checks", "green", this.t("Kocioł odpowiada", "The boiler answers"), `${sup.length} / 128`)}
        ${this.chip("ot_ids_unk", "mdi:help-rhombus-outline", unk.length ? "red" : "overlay2", this.t("Nieznane kotłowi", "Unknown to the boiler"), String(unk.length))}
        ${this.eid("ot_ids_room") ? this.chip("ot_ids_room", "mdi:remote", "sky", this.t("Pyta pilot", "Asked by the room unit"), String(room.length)) : nothing}
      </div>
      <div class="cells">${Array.from({ length: 128 }, (_, i) => cell(i))}</div>
      <div class="legend"><span><i style="background:${ca("green", 0.45)}"></i>${this.t("kocioł odpowiada", "answers")}</span>
        <span><i style="background:${ca("red", 0.3)}"></i>${this.t("kocioł nie zna", "unknown")}</span>
        <span><i style="background:rgba(255,255,255,.04)"></i>${this.t("nie pytano", "not asked")}</span>
        ${room.length ? html`<span><i style="outline:1.5px solid ${c("sky")};outline-offset:-1.5px"></i>${this.t("pyta pilot", "room unit")}</span>` : nothing}</div>
      <div class="sec2">${this.t("Kocioł odpowiada", "The boiler answers")}</div>${list(sup, "green")}
      ${unk.length ? html`<div class="sec2">${this.t("Kocioł nie zna (hub pyta raz na godzinę)", "Unknown to the boiler (asked again hourly)")}</div>${list(unk, "red")}` : nothing}
      <div class="row"><button class="go" ?disabled=${!sup.length} @click=${report}><ha-icon icon="mdi:github"></ha-icon>${this.t("Zgłoś mapę na GitHubie", "Report the map on GitHub")}</button></div>
      <div class="hint">${this.t("Hub buduje mapę z każdej ramki (bez osobnego skanu) – pokazuje Data-ID, o które pytają pakiety huba i pilot. Zgłoszenie otwiera GitHub z gotową mapą; nic nie jest wysyłane, dopóki nie naciśniesz Create.",
        "The hub builds the map from every frame (no separate scan) – the Data-IDs the hub packages and the room unit ask for. The report opens GitHub with the map filled in; nothing is sent until you press Create.")}</div>`}`;
  }

  static styles = [HubCard.styles, css`
    ha-card { padding: 8px 12px; }
    .cells { display: grid; grid-template-columns: repeat(16, 1fr); gap: 2px; margin-top: 10px; }
    .cell { font-size: 8.5px; font-weight: 700; text-align: center; padding: 3px 0; border-radius: 4px; opacity: .9; font-variant-numeric: tabular-nums; }
    .legend { display: flex; gap: 10px; flex-wrap: wrap; font-size: 10px; opacity: .65; margin-top: 6px; }
    .legend i { display: inline-block; width: 12px; height: 10px; border-radius: 3px; vertical-align: middle; margin-right: 4px; }
    .sec2 { font-size: 10px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; opacity: .55; margin: 10px 0 4px; }
    .ids { display: flex; flex-wrap: wrap; gap: 4px; }
    .idc { font-size: 10.5px; padding: 2px 7px; border-radius: 8px; }
    .sh { cursor: pointer; display: flex; align-items: center; gap: 8px; }
    .sh > ha-icon { --mdc-icon-size: 17px; opacity: .55; }
    .ttl { font-size: 10.5px; font-weight: 800; opacity: .55; letter-spacing: .08em; text-transform: uppercase; white-space: nowrap; }
    .sum { flex: 1; font-size: 10.5px; opacity: .4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .chev { margin-left: auto; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
    .model { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .model ha-icon { --mdc-icon-size: 20px; opacity: .7; }
    .model input { flex: 1; min-width: 0; font: inherit; font-size: 12.5px; padding: 7px 9px; border-radius: 10px;
      border: 1px solid var(--ih-overlay1); background: transparent; color: inherit; }
    .row { display: flex; gap: 8px; margin: 10px 0 4px; flex-wrap: wrap; }
    .go { display: inline-flex; align-items: center; gap: 5px; font: inherit; font-size: 12px; font-weight: 800; cursor: pointer;
      padding: 7px 12px; border-radius: 10px; border: 1px solid var(--ih-overlay1); background: transparent; color: inherit; }
    .go[disabled] { opacity: .4; cursor: default; }
    .go ha-icon { --mdc-icon-size: 16px; }
    .hint { font-size: 10.5px; opacity: .6; margin-top: 6px; line-height: 1.35; }
  `];
}

register("immergas-ot-boiler-card", ImmergasOtBoilerCard, "Immergas – Kocioł OpenTherm / OpenTherm boiler",
  "Dominus OpenTherm: moc, zakresy, flagi i historia błędów, starty palnika, tylko odczyt, reset kotła");
register("immergas-ot-map-card", ImmergasOtMapCard, "Immergas – Mapa Data-ID / Data-ID map",
  "Dominus OpenTherm: skan Data-ID, parametry kotła (TSP) i zgłoszenie mapy na GitHubie");
