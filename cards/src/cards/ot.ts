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

/** "0x091B" -> number (the Data-ID scan values) */
const hex = (v: unknown) => (typeof v === "string" && /^0x[0-9a-f]+$/i.test(v) ? parseInt(v, 16) : NaN);

class ImmergasOtBoilerCard extends HubCard {
  private range(k: Key) {
    const a = this.so(k)?.attributes;
    return a && a.min !== undefined && a.max !== undefined ? `${this.f(a.min, 0)}–${this.f(a.max, 0)} °C` : "–";
  }

  /** what is needed to run the boiler without the CAR V2: the Dominus regulator + the programs in Home Assistant */
  private carReady() {
    const code = String(this.s("err_code") ?? "").replace(/\D/g, "");
    const room = !this.bad("zone1") && !isNaN(this.n("zone1"));
    type Row = [boolean | null, string, string];
    const rows: Row[] = [
      [code !== "31", this.t("Kocioł nie czeka na pilota (brak E31)", "The boiler does not wait for the remote (no E31)"),
        this.t("po zdjęciu CAR V2: odłącz i włącz zasilanie kotła", "after removing the CAR V2: power-cycle the boiler")],
      [null, this.t("Mostek X40 na zaciskach 40-41 kotła", "Jumper X40 on boiler terminals 40-41"),
        this.t("CAR V2 wymaga jego zdjęcia – bez CAR V2 załóż go z powrotem (albo termostat), inaczej kocioł nie włączy CO", "the CAR V2 needs it removed – without the CAR V2 put it back (or a thermostat), else the boiler will not heat")],
      [room && this.s("ot_ntc") === "room", this.t("Sonda Dominusa mierzy pokój", "The Dominus probe measures the room"),
        room ? `${this.f(this.n("zone1"), 1, 1)} °C` : this.t("podłącz sondę do zacisków 1-2 i ustaw „Sonda Dominusa mierzy” = pokój", "connect the probe to terminals 1-2 and set “Dominus probe use” = room")],
      [this.eid("ot_room_sensor") ? this.on("ot_room_sensor") : null, this.t("Regulacja wg pokoju (AMB)", "Room control (AMB)"), this.t("Czujnik pokojowy włączony", "Room sensor on")],
      [this.eid("ot_frost") ? this.on("ot_frost") : null, this.t("Ochrona przed zamarzaniem (ANTIGL)", "Frost protection (ANTIGL)"), ""],
      [this.eid("prog_mode") ? (this.attr("prog_mode", "options") ?? []).length > 0 && this.s("prog_mode") === "auto" : null,
        this.t("Program CO AUTO (PR RIS)", "CH program AUTO (PR RIS)"), this.t("kalendarze Komfort / Eko w karcie Harmonogram", "Comfort / Eco calendars in the Schedule card")],
      [this.eid("dhw_sched") ? this.on("dhw_sched") : null, this.t("Program CWU (PR SAN)", "DHW program (PR SAN)"), this.t("tylko z zasobnikiem", "storage tank only")],
      [!this.on("ot_ro"), this.t("Blokada zapisu wyłączona", "Write block off"), this.t("HA steruje, nie pilot", "HA in charge, not the remote")],
    ];
    const ok = rows.filter(([v]) => v === true).length, need = rows.filter(([v]) => v !== null).length;
    const icon = (v: boolean | null) => v === null ? { ic: "mdi:information-outline", col: "overlay2" } : v ? { ic: "mdi:check-circle", col: "green" } : { ic: "mdi:close-circle-outline", col: "peach" };
    return html`<div class="sec">${this.t("Praca bez CAR V2", "Running without the CAR V2")} · ${ok} / ${need}</div>
      <div class="ready">${rows.map(([v, lbl, sub]) => { const { ic, col } = icon(v); return html`<div class="rr">
        <ha-icon icon=${ic} style="color:var(--ih-${col})"></ha-icon><div><div class="rl">${lbl}</div>${sub ? html`<div class="rs">${sub}</div>` : nothing}</div></div>`; })}</div>`;
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
      ${this.head("mdi:water-boiler", this.t("Kocioł · OpenTherm", "Boiler · OpenTherm"), ro ? html`<span class="ro"><ha-icon icon="mdi:lock-outline"></ha-icon>${this.t("tylko odczyt", "read only")}</span>` : undefined)}
      <div class="grid">
        ${this.chip("ot_cap", "mdi:lightning-bolt", "peach", this.t("Moc maks.", "Max. capacity"), cap > 0 ? this.f(cap, 0) + " kW" : this.t("kocioł nie podaje", "not reported"))}
        ${this.chip("ot_minmod", "mdi:percent-outline", "peach", this.t("Min. modulacja", "Min. modulation"), isNaN(mm) ? "–" : this.f(mm, 0) + " %")}
        ${this.chip("ot_ch_set", "mdi:radiator", "red", this.t("Zakres CO (kocioł)", "CH range (boiler)"), this.range("ot_ch_set"))}
        ${this.chip("dhw_set", "mdi:water-boiler", "yellow", this.t("Zakres CWU (kocioł)", "DHW range (boiler)"), this.range("dhw_set") + (dhwType ? " · " + dhwType : ""))}
        ${this.eid("ot_exhaust") && !this.bad("ot_exhaust") ? this.chip("ot_exhaust", "mdi:smoke", "overlay2", this.t("Spaliny", "Exhaust"), this.f(this.n("ot_exhaust"), 1, 1) + " °C") : nothing}
        ${this.eid("ot_fan") && !this.bad("ot_fan") ? this.chip("ot_fan", "mdi:fan", "sky", this.t("Wentylator", "Fan"), this.f(this.n("ot_fan"), 0) + this.t(" obr/min", " rpm")) : nothing}
      </div>
      ${this.eid("ot_burn_today") ? html`<div class="sec">${this.t("Palnik", "Burner")}</div>
        <div class="grid">
          ${this.chip("ot_burn_today", "mdi:fire-circle", "peach", this.t("Starty dziś", "Starts today"), this.f(st, 0) + (isNaN(bh) ? "" : ` · ${this.f(bh, 1, 1)} h`))}
          ${this.chip("ot_burn_h", "mdi:fire-alert", shCol, this.t("Starty / ostatnia godzina", "Starts / last hour"), this.f(sh, 0) + (sh > 6 ? this.t(" · taktowanie", " · short cycling") : ""), sh > 6)}
        </div>
        <div class="hint">${this.t("Liczone z płomienia co cykl odczytu (~45 s) – bardzo krótkie zapłony mogą umknąć.", "Counted from the flame flag every polling cycle (~45 s) – very short burns may be missed.")}</div>` : nothing}
      <div class="sec">${this.t("Błędy", "Faults")}</div>
      ${this.on("ot_maint_due") ? html`<div class="grid1">${this.chip("ot_maint_due", "mdi:wrench-clock", "peach", this.t("Przegląd kotła", "Boiler service"),
        this.t("termin minął – po przeglądzie naciśnij „Przegląd wykonany”", "due – after the service press “Service done”"), true)}</div>` : nothing}
      ${active.length ? html`<div class="grid">${active.map(([k, icon, [pl, en]]) => this.chip(k, icon, "red", this.t("Flaga błędu", "Fault flag"), this.t(pl, en), true))}</div>`
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
      ${this.carReady()}
      ${this.toggles([["ot_ro", "mdi:lock-outline", "sky", this.t("Tylko odczyt (steruje pilot)", "Read only (remote in charge)"),
        this.t("HA nic nie zapisuje do kotła – dla CAR V2 / Super Amico. Po włączeniu raz zrestartuj moduł Dominus.",
          "HA writes nothing to the boiler – for a CAR V2 / Super Amico. After switching it on, power-cycle the Dominus once."), true]])}`;
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
    .ready { display: grid; gap: 4px; margin-bottom: 8px; }
    .rr { display: flex; gap: 8px; align-items: flex-start; }
    .rr ha-icon { --mdc-icon-size: 17px; flex: none; margin-top: 1px; }
    .rl { font-size: 11.5px; font-weight: 800; }
    .rs { font-size: 10px; opacity: .6; line-height: 1.3; }
    .act { display: inline-flex; align-items: center; gap: 6px; font: inherit; font-size: 12px; font-weight: 800; cursor: pointer;
      padding: 7px 12px; border-radius: 10px; border: 1px solid rgba(var(--ih-red-rgb), 0.4); background: rgba(var(--ih-red-rgb), 0.08); color: inherit; }
    .act[disabled] { opacity: .4; cursor: default; }
    .act ha-icon { --mdc-icon-size: 16px; color: var(--ih-red); }
  `];
}

class ImmergasOtMapCard extends HubCard {
  protected body() {
    if (!this.ot || !this.eid("ot_ids")) return html`${this.head("mdi:radar", this.t("Mapa Data-ID", "Data-ID map"))}
      <div class="hint">${this.t("Ta karta jest dla integracji Immergas Dominus w trybie OpenTherm (1.6.1+).", "This card is for the Immergas Dominus integration in the OpenTherm mode (1.6.1+).")}</div>`;
    const running = !!this.attr("ot_ids", "running"), sup = this.n("ot_ids");
    const tsp = (this.attr("ot_ids", "boiler_parameters") ?? null) as Record<string, unknown> | null;
    const fh = (this.attr("ot_ids", "fault_history") ?? null) as Record<string, unknown> | null;
    const ok = (t: Record<string, unknown> | null) => (t ? Object.values(t).filter((v) => typeof v === "number").length : 0);
    const fin = this.attr("ot_ids", "finished") as string | undefined;
    const model = this.s("dom_model") ?? "";
    const scanTag = "ot_scan", armed = this.isArmed(scanTag);
    return html`
      ${this.head("mdi:radar", this.t("Mapa Data-ID", "Data-ID map"), this.t("co kocioł podaje", "what the boiler answers"))}
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
        "The scan reads every standard Data-ID once and the boiler parameters (polling pauses meanwhile). Report: a link in the HA notifications opens GitHub with the map and the model filled in – nothing is sent until you press Create.")}</div>`;
  }

  static styles = [HubCard.styles, css`
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
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
