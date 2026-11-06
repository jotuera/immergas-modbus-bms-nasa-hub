// "Schemat / Diagram": live schematic of the Magis system - outdoor unit (fan, compressor, evaporator, EEV),
// refrigerant loop to the plate heat exchanger, water loop with circulator, gas boiler (Combo), 3-way valve,
// buffer + house (space heating) and the DHW cylinder. Active paths glow and flow; idle ones are dimmed.
// Entities are found automatically. Options: buffer: false (hide the buffer), boiler: false (Magis Pro, no gas boiler).
import { svg, SVGTemplateResult } from "lit";
import { HubCard, html, css, nothing, c, ca, register } from "../base";
import { hubNote } from "../base";
import { isDhw, hasBoiler as stBoiler, Pt, points, dhwHeatingNow } from "./timers";
import { Key } from "../names";

const HOT = "red", COLD = "blue", GAS = "mauve", LIQ = "lavender";

class ImmergasDiagramCard extends HubCard {
  private narrow = false;
  /** Dominus: recent cylinder temperatures (15 min) to see DHW heating, which no register reports */
  private tk: Pt[] = [];
  private tkLoaded = false;
  private ro?: ResizeObserver;
  getCardSize() { return 8; }
  connectedCallback() {
    super.connectedCallback();
    // on a phone the SVG is scaled to ~40 %, so the stat strip is drawn as HTML tiles above the schematic instead
    this.ro = new ResizeObserver((e) => { const n = e[0].contentRect.width < 600; if (n !== this.narrow) { this.narrow = n; this.requestUpdate(); } });
    this.ro.observe(this);
  }
  disconnectedCallback() { super.disconnectedCallback(); this.ro?.disconnect(); }

  /** pipe: dim base + glowing line + moving dashes when active */
  private pipe(d: string, col: string, active: boolean, speed = 1.2): SVGTemplateResult {
    return svg`<path d=${d} class="pb"/>
      <path d=${d} class="pl" style="stroke:${c(col)};opacity:${active ? 0.9 : 0.25};${active ? `filter:drop-shadow(0 0 4px ${ca(col, 0.8)})` : ""}"/>
      ${active ? svg`<path d=${d} class="pf" style="stroke:${c(col)};animation-duration:${speed}s"/>` : nothing}`;
  }
  private label(x: number, y: number, txt: string, col = "", size = 12, anchor = "middle", weight = 800): SVGTemplateResult {
    return svg`<text x=${x} y=${y} font-size=${Math.round(size * 1.45)} font-weight=${weight} text-anchor=${anchor} fill=${col ? c(col) : "currentColor"}>${txt}</text>`;
  }
  private tap(k: Key) { return () => this.moreInfo(k); }

  /** one key message in the free top-left corner: active fault > compressor capacity limit > top Calibration
   *  recommendation (from the Calibration card on the same dashboard) > all fine */
  private note(): SVGTemplateResult {
    const cut = (t: string, n: number) => t.length > n ? t.slice(0, n - 1) + "…" : t;
    let col = "green", icon = "✓", title = "", sub = "", open: () => void = () => undefined;
    const faultOn = this.on("fault_any") || this.on("err_active");
    const cap = this.n("cap_limit"), rec = hubNote.rec && Date.now() - hubNote.rec.at < 3600e3 ? hubNote.rec : undefined;
    if (faultOn) {
      col = "red"; icon = "⚠"; title = this.t("Aktywny błąd", "Active fault");
      sub = (this.eid("fault_text") ? this.s("fault_text") : this.s("err_desc")) ?? "";
      open = this.tap(this.eid("fault_text") ? "fault_text" : "err_desc");
    } else if (cap < 100) {
      col = cap >= 70 ? "yellow" : "peach"; icon = "◔";
      title = this.t("Wydajność sprężarki ", "Compressor capacity ") + Math.round(cap) + " %";
      sub = this.on("u11") ? this.t("funkcja nocna U11 – cichsza praca, niższa moc", "night function U11 – quieter, less power")
        : this.on("f_fr") ? this.t("ograniczenie sprężarki (FR) włączone", "compressor limit (FR) on") : this.t("ograniczona przez piec", "limited by the boiler");
      open = this.tap("cap_limit");
    } else if (rec) {
      col = rec.ok ? "green" : "peach"; icon = rec.ok ? "✓" : "➜"; title = rec.text; sub = rec.reason;
      const e = rec.entity;
      if (e) open = () => this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: e }, bubbles: true, composed: true }));
    } else {
      title = this.t("Wszystko działa", "All running"); const cop = this.n("cop_today");
      sub = cop > 0 ? this.t("COP dziś ", "COP today ") + this.f(cop, 1, 1) : "";
      open = this.tap("cop_today");
    }
    return svg`<g @click=${open} class="hit">
      <rect x="16" y="40" width="600" height="92" rx="14" fill=${ca(col, 0.1)} stroke=${ca(col, 0.55)} stroke-width="1.5"/>
      ${this.label(40, 96, icon, col, 26, "middle", 800)}
      ${this.label(64, 80, cut(title, 58), col, 16, "start", 800)}
      ${sub ? this.label(64, 108, cut(sub, 86), "", 11.5, "start", 600) : nothing}</g>`;
  }
  private val(k: Key, d = 1, unit = "") { const v = this.n(k); return isNaN(v) ? "–" : this.f(v, d) + unit; }

  /** Dominus: cylinder samples from the last 10 min of history, then from every state update */
  private tankTrack(now: number) {
    const v = this.n("tank"), last = this.tk[this.tk.length - 1];
    if (!this.tkLoaded && this.eid("tank")) {
      this.tkLoaded = true;
      this.hass.callWS({ type: "history/history_during_period", start_time: new Date(now - 10 * 60e3).toISOString(), end_time: new Date(now).toISOString(),
        entity_ids: [this.eid("tank")], minimal_response: true, no_attributes: true, significant_changes_only: false })
        .then((r: any) => { this.tk = [...points(r[this.eid("tank") ?? ""] ?? []), ...this.tk].sort((a, b) => a.t - b.t); this.requestUpdate(); })
        .catch(() => undefined);
    }
    if (!isNaN(v) && (!last || last.v !== v || now - last.t > 60e3)) this.tk.push({ t: now, v });
    this.tk = this.tk.filter((p) => p.t > now - 15 * 60e3);
  }

  /** Immergas Dominus: outdoor, one boiler block (heat pump or gas is not visible over TCP), the CH loop to the house
   *  (while zone 1 asks for heat) and the DHW loop to the cylinder (while it warms up), Calibration note on top */
  private domBody() {
    const now = Date.now();
    this.tankTrack(now);
    const ot = this.ot, ch = this.on("dom_ch_demand"), rq = this.so("dom_dhw_request");
    const reqOff = rq?.state === "off" ? new Date(rq.last_changed).getTime() : -Infinity;
    // OpenTherm: the boiler reports DHW active itself (no cylinder tracking needed)
    const dw = ot ? this.on("dom_dhw_request") : dhwHeatingNow(reqOff, this.tk, now), heat = ch && !dw;
    const err = this.on("err_active"), act = dw || ch;
    const out = this.n("outdoor"), mean = parseFloat(this.attr("dom_auto_season", "outdoor_mean_24h") ?? "");
    const z1 = this.n("zone1"), zs = this.n("zone1_set"), tank = this.n("tank"), ds = this.n("dhw_set");
    const tankFill = isNaN(tank) ? 0 : Math.max(0, Math.min(1, (tank - 20) / 45)), tankCol = tank >= 45 ? "peach" : tank >= 35 ? "yellow" : "sky";
    const flame = err ? "red" : dw ? "yellow" : heat ? "peach" : "overlay1";
    const g: unknown[] = [this.note()];
    // declared boiler values (Dominus 1.5.0) - each hint only when its values are set
    const p07 = this.isSet("dom_p07") ? this.n("dom_p07") : 0, t02 = this.n("dom_t02"), i10 = this.n("dom_i10");
    const intOn = this.on("dom_int_ch") && !isNaN(i10);
    // outdoor
    g.push(svg`<g @click=${this.tap("outdoor")} class="hit"><rect x="16" y="150" width="230" height="170" rx="18" class="panel"/>
      ${this.label(34, 178, this.t("NA ZEWNĄTRZ", "OUTDOOR"), "", 9, "start")}
      ${this.label(34, 236, isNaN(out) ? "–" : this.f(out, 1, 1) + "°", "sky", 28, "start")}
      ${isNaN(mean) ? nothing : this.label(34, 280, this.t("średnia 24 h ", "24 h mean ") + this.f(mean, 1, 1) + "°", "", 10.5, "start", 600)}
      ${p07 ? this.label(34, 302, this.t(`korekta sondy P07 ${p07 > 0 ? "+" : ""}${this.f(p07, 0)} °C – już wliczona`, `probe correction P07 ${p07 > 0 ? "+" : ""}${this.f(p07, 0)} °C – already applied`), "yellow", 9, "start", 600) : nothing}</g>`);
    // operating mode, curve offset, vacation and alerts
    const vac = this.on("dom_vacation"), auto = this.on("dom_auto_season"), alarm = this.on("dom_frost") || this.on("dom_offline");
    const mod = this.n("ot_mod"), press = this.n("ot_press"), flameOn = this.on("ot_flame");
    g.push(svg`<g @click=${this.tap("mode")} class="hit"><rect x="16" y="334" width="230" height="150" rx="18" class="panel"/>
      ${this.label(34, 362, this.t("TRYB PRACY", "OPERATING MODE"), "", 9, "start")}
      ${this.label(34, 396, (this.bad("mode") ? "–" : this.txt("mode") ?? "–") + (auto ? " (auto)" : ""), "", 15, "start")}
      ${ot ? svg`${this.label(34, 424, this.t("modulacja ", "modulation ") + (flameOn && !isNaN(mod) ? Math.round(mod) + " %" : "–"), flameOn ? "peach" : "", 10.5, "start", 600)}
        ${isNaN(press) ? nothing : this.label(34, 446, this.t("ciśnienie ", "pressure ") + this.f(press, 1, 1) + " bar", press < 1 || press > 2.5 ? "red" : "", 10.5, "start", 600)}
        ${this.label(34, 468, this.gbx ? "Modbus BMS" : "OpenTherm", "", 10.5, "start", 600)}`
      : svg`${this.label(34, 424, "offset U03 " + this.val("u03", 1, ""), "", 10.5, "start", 600)}
      ${this.label(34, 446, vac ? this.t("wyjazd: włączony", "vacation: on") : this.t("wyjazd: wył.", "vacation: off"), vac ? "teal" : "", 10.5, "start", 600)}
      ${this.label(34, 468, alarm ? this.t("alarm!", "alert!") : this.t("alarmy: brak", "alerts: none"), alarm ? "red" : "", 10.5, "start", 600)}`}</g>`);
    // one boiler block: Dominus does not tell whether the heat pump or the gas burner works
    g.push(svg`<g @click=${this.tap("mode")} class="hit">
        <rect x="300" y="196" width="180" height="170" rx="16" class="dev" style="stroke:${c(act || err ? flame : "overlay1")};${act ? `fill:${ca(flame, 0.1)}` : ""}"/>
        <path d="M 390 236 C 372 258, 378 282, 390 292 C 402 282, 408 258, 390 236 Z M 390 258 C 383 268, 386 280, 390 284 C 394 280, 397 268, 390 258 Z"
          fill=${c(flame)} fill-rule="evenodd" style=${act ? `filter:drop-shadow(0 0 6px ${c(flame)});animation:ih-pulse 1.2s ease-in-out infinite` : ""}/></g>
      ${this.label(390, 186, ot ? this.t("Kocioł", "Boiler") : this.gas ? this.t("Kocioł gazowy", "Gas boiler") : this.t("Kocioł Magis", "Magis boiler"), "", 11, "middle", 800)}
      ${this.label(390, 322, err ? this.t("AWARIA", "FAULT") : dw ? this.t("grzeje CWU", "heats DHW") : heat ? this.t("grzeje CO", "heats CH") : this.t("czuwanie", "standby"), flame, 12)}
      ${ot ? this.label(390, 346, flameOn ? this.t("płomień", "flame") + (isNaN(mod) ? "" : ` ${Math.round(mod)} %`) : this.t("płomień zgaszony", "no flame"), flameOn ? "peach" : "", 9, "middle", 600)
        : this.label(390, 346, intOn ? this.t(`poniżej ${this.f(i10, 0)} °C (I10): kocioł`, `below ${this.f(i10, 0)} °C (I10): boiler`)
        : this.gas ? this.t("palnik – nie widać po TCP", "burner – not visible over TCP")
        : this.t("pompa / gaz – nie widać po TCP", "heat pump / gas – not visible over TCP"), intOn && out < i10 ? "yellow" : "", 8, "middle", 600)}`);
    // CH loop to the house
    g.push(this.pipe("M 480 236 L 600 236 L 600 120 L 680 120", HOT, heat, 1.4));
    g.push(this.pipe("M 680 200 L 630 200 L 630 270 L 480 270", COLD, heat, 1.4));
    g.push(this.label(540, 226, this.t("CO", "CH"), heat ? "peach" : "overlay1", 10, "middle", 800));
    const ph = this.bad("zone1_phase") ? "" : this.txt("zone1_phase") ?? "";
    const chT = this.n("dom_ch_time_today"), st = this.n("dom_starts_today");
    g.push(svg`<g @click=${this.tap(ot ? "ot_flow" : "zone1")} class="hit">
        <path d="M 680 92 L 790 30 L 900 92 L 900 230 L 680 230 Z" class="house" style="stroke:${c(heat ? "peach" : "overlay2")}"/>
        <path d="M 696 214 h 188 M 696 214 q 0 -8 10 -8 h 168 q 10 0 10 -8 q 0 -8 -10 -8 h -168" fill="none"
          stroke=${c(heat ? "peach" : "overlay2")} stroke-width="2.5" stroke-linecap="round" style=${heat ? `filter:drop-shadow(0 0 4px ${ca("peach", 0.7)})` : "opacity:.5"}/>
        ${ot ? svg`${this.label(790, 92, this.t("Ogrzewanie", "Heating"), "", 10, "middle", 700)}
          ${this.label(790, 134, isNaN(this.n("ot_flow")) ? "–" : this.f(this.n("ot_flow"), 1, 1) + "°", "", 24)}
          ${this.label(790, 156, this.t("powrót ", "return ") + this.f(this.n("ot_ret"), 1, 1) + "° · " + this.t("nastawa ", "set ") + this.f(this.n("ot_ch_set"), 0) + "°", "", 10, "middle", 600)}`
        : svg`${this.label(790, 92, this.t("Strefa 1", "Zone 1"), "", 10, "middle", 700)}
        ${this.label(790, 134, isNaN(z1) ? "–" : this.f(z1, 1, 1) + "°", "", 24)}
        ${this.label(790, 156, this.t("zadana ", "set ") + this.f(zs, 1, 1) + "°" + (ph ? " · " + ph : ""), "", 10, "middle", 600)}`}
        ${isNaN(chT) ? nothing : this.label(790, 178, this.t("dziś ", "today ") + this.f(chT, 1, 1) + " h · " + this.f(st, 0) + this.t(" startów", " starts"), "", 9.5, "middle", 600)}</g>`);
    // DHW loop to the cylinder
    g.push(this.pipe("M 420 366 L 420 400 L 692 400", HOT, dw, 1.4));
    g.push(this.pipe("M 692 452 L 360 452 L 360 366", COLD, dw, 1.4));
    g.push(this.label(560, 390, this.t("CWU", "DHW"), dw ? "yellow" : "overlay1", 10, "middle", 800));
    const dph = this.bad("dhw_phase") ? "" : this.txt("dhw_phase") ?? "", cyc = this.n("dom_dhw_cycles"), ld = this.n("dom_dhw_last_dur");
    const cx = 692;
    g.push(svg`<g @click=${this.tap("tank")} class="hit">
        <rect x=${cx} y="296" width="150" height="190" rx="20" class="tank" style="stroke:${c(dw ? "yellow" : "overlay1")}"/>
        <rect x=${cx + 3} y=${296 + 187 * (1 - tankFill) + 3} width="144" height=${Math.max(0, 187 * tankFill - 3)} rx="17" fill=${ca(tankCol, 0.22)}/>
        <path d="M ${cx + 30} 404 q 45 0 45 10 q 0 10 -45 10 q -45 0 -45 10 q 0 10 45 10" fill="none" transform="translate(45 -6)"
          stroke=${c(dw ? "yellow" : "overlay1")} stroke-width="2.5" style=${dw ? `filter:drop-shadow(0 0 4px ${ca("yellow", 0.7)})` : "opacity:.5"}/>
        ${isNaN(t02) || isNaN(ds) ? nothing : svg`<line x1=${cx - 6} x2=${cx + 16} y1=${296 + 187 * (1 - Math.max(0, Math.min(1, (ds - t02 - 20) / 45))) + 3}
          y2=${296 + 187 * (1 - Math.max(0, Math.min(1, (ds - t02 - 20) / 45))) + 3} stroke=${c("yellow")} stroke-width="2.5"/>
          ${this.label(cx - 10, 296 + 187 * (1 - Math.max(0, Math.min(1, (ds - t02 - 20) / 45))) + 7, this.t("start ", "start ") + this.f(ds - t02, 0) + "°", "yellow", 9, "end", 700)}`}
        ${this.label(cx + 75, 340, isNaN(tank) ? "–" : this.f(tank, 1, 1) + "°", tankCol, 22)}
        ${this.label(cx + 75, 362, this.t("nastawa ", "set ") + this.f(ds, 0) + "°" + (dph ? " · " + dph : ""), "", 9.5, "middle", 600)}
        ${isNaN(cyc) ? nothing : this.label(cx + 75, 474, this.t("dziś ", "today ") + this.f(cyc, 0) + "×" + (isNaN(ld) ? "" : this.t(" · ost. ", " · last ") + this.f(ld, 0) + " min"), "", 9.5, "middle", 600)}</g>
      ${this.label(cx + 75, 288, this.t("Ciepła woda", "Hot water"), "", 10, "middle", 700)}`);
    return html`<svg viewBox="0 30 920 470" class="dia">${g}</svg>`;
  }

  protected body() {
    if (this.dominus) return this.domBody();
    const hz = this.n("hz"), run = hz > 0, flow = this.n("d14"), flowing = flow > 50;
    const defrost = this.on("defrost"), night = this.on("u11");
    const st = this.s("state") ?? "";
    const dhw = this.s("d22") === "1" || isDhw(st) || this.on("tt_dhw");
    const boiler = this.config.boiler !== false && (this.on("boiler_running") || stBoiler(st));
    const hasBoiler = this.config.boiler !== false && (!!this.eid("boiler_running") || !!this.eid("d01"));
    const hasBuffer = this.config.buffer !== false;
    const ch = flowing && !dhw, dw = flowing && dhw;
    const speed = flowing ? Math.max(0.5, Math.min(2.5, 1500 / flow)) : 1;
    const fan = this.n("fan_real"), fanOn = fan > 0 && !defrost;
    const fanDur = fanOn ? Math.max(0.35, Math.min(3, 400 / fan)) : 0;
    const out = this.n("outdoor"), z1 = this.n("zone1"), zs = this.n("zone1_set"), tank = this.n("tank"), tankSet = this.n("dhw_active_set");
    const heat = this.n("heat_power"), elec = this.n("elec_power"), cop = this.n("cop");
    const copCol = isNaN(cop) || cop <= 0 ? "overlay1" : cop < 2.5 ? "red" : cop < 3.5 ? "peach" : cop < 4.5 ? "yellow" : "green";
    const tankFill = isNaN(tank) ? 0 : Math.max(0, Math.min(1, (tank - 20) / 45));
    const tankCol = tank >= 45 ? "peach" : tank >= 35 ? "yellow" : "sky";

    // ---------------- geometry (viewBox 920 x 500) ----------------
    const g: unknown[] = [];
    // outdoor unit panel
    g.push(svg`<rect x="16" y="150" width="300" height="334" rx="18" class="panel"/>
      ${this.label(30, 176, this.t("JEDNOSTKA ZEWNĘTRZNA", "OUTDOOR UNIT"), "", 9, "start")}`);
    // fan
    const blades = [0, 120, 240].map((a) => svg`<path d="M0 0 C 18 -30, 52 -24, 60 -6 C 42 -2, 20 2, 0 0 Z" transform="rotate(${a})" class="blade"/>`);
    g.push(svg`<g transform="translate(96 330)" @click=${this.tap("fan_real")} class="hit">
        <circle r="74" class="fanring"/>
        <g class="fan" style=${fanOn ? `animation:ih-spin ${fanDur}s linear infinite` : ""}>${blades}<circle r="9" class="hub"/></g></g>
      ${this.label(96, 425, fanOn ? this.f(fan, 0) + this.t(" obr/min", " rpm") : defrost ? this.t("odszranianie", "defrost") : this.t("wentylator stoi", "fan stopped"), defrost ? "sky" : "", 11, "middle", 700)}`);
    // refrigerant loop: compressor -> HX (hot gas) ; HX -> EEV -> evaporator -> compressor
    g.push(this.pipe("M 262 214 L 352 214 L 352 268", defrost ? LIQ : GAS, run, 1.4));
    g.push(this.pipe("M 352 392 L 352 448 L 262 448", LIQ, run, 1.4));
    g.push(this.pipe("M 236 448 L 190 448 L 190 245 L 238 222", LIQ, run, 1.4));
    // evaporator coil next to the fan
    g.push(svg`<path d="M 176 262 q 12 8 0 16 q -12 8 0 16 q 12 8 0 16 q -12 8 0 16 q 12 8 0 16 q -12 8 0 16" class="coil" style="stroke:${c(LIQ)};opacity:${run ? 0.9 : 0.35}"/>
      <g @click=${this.tap("d74")} class="hit">${this.label(214, 300, this.t("Parownik", "Evaporator"), "", 10, "start", 700)}${this.label(214, 315, this.val("d74", 1, " °C"), "sky", 12, "start")}</g>`);
    // compressor
    g.push(svg`<g @click=${this.tap("hz")} class="hit">
        <circle cx="250" cy="214" r="22" class="dev" style="stroke:${c(run ? "peach" : "overlay1")};${run ? `filter:drop-shadow(0 0 6px ${ca("peach", 0.7)})` : ""}"/>
        <path d="M 240 222 L 250 204 L 260 222" fill="none" stroke=${c(run ? "peach" : "overlay1")} stroke-width="2.4" stroke-linejoin="round"/></g>
      ${this.label(250, 186, this.t("Sprężarka", "Compressor"), "", 10, "middle", 700)}
      ${this.label(250, 255, run ? this.f(hz, 0) + " Hz" : "0 Hz", run ? "green" : "overlay1", 13)}
      <g @click=${this.tap("d73")} class="hit">${this.label(290, 245, this.val("d73", 0, "°"), "peach", 10)}</g>`);
    // EEV
    g.push(svg`<g @click=${this.tap("d77")} class="hit"><path d="M 238 438 L 262 458 L 262 438 L 238 458 Z" class="dev" style="stroke:${c(run ? LIQ : "overlay1")}"/></g>
      ${this.label(250, 478, "EEV " + this.val("d77", 0), "", 10, "middle", 700)}`);

    // plate heat exchanger (condenser)
    g.push(svg`<g @click=${this.tap("tw2")} class="hit"><rect x="340" y="268" width="56" height="124" rx="10" class="dev" style="stroke:${c(run ? "peach" : "overlay1")}"/>
      ${[0, 1, 2, 3, 4, 5].map((i) => svg`<line x1="350" y1=${284 + i * 18} x2="386" y2=${284 + i * 18} stroke=${c(run ? "peach" : "overlay1")} stroke-opacity=".5" stroke-width="2"/>`)}</g>
      ${this.label(368, 410, this.t("Skraplacz", "Condenser"), "", 10, "middle", 700)}
      <g @click=${this.tap("d24")} class="hit">${this.label(368, 426, this.val("d24", 1, " °C"), run ? "peach" : "overlay1", 12)}</g>`);

    // water supply: HX -> pump -> (boiler) -> 3-way valve
    const pumpX = 450, valveX = 660, supY = 290;
    g.push(this.pipe(`M 396 ${supY} L ${pumpX - 20} ${supY}`, HOT, flowing, speed));
    g.push(this.pipe(`M ${pumpX + 20} ${supY} L ${valveX - 16} ${supY}`, HOT, flowing, speed));
    g.push(svg`<g @click=${this.tap("tw2")} class="hit">${this.label(400, 256, this.val("tw2", 1, " °C"), HOT, 12, "start")}</g>`);
    // circulator
    g.push(svg`<g transform="translate(${pumpX} ${supY})" @click=${this.tap("d14")} class="hit">
        <circle r="20" class="dev" style="stroke:${c(flowing ? "sky" : "overlay1")}"/>
        <g style=${flowing ? `animation:ih-spin ${speed * 1.5}s linear infinite` : ""} class="fan"><path d="M -9 -8 L 11 0 L -9 8 Z" fill=${c(flowing ? "sky" : "overlay1")}/></g></g>
      ${this.label(pumpX, supY + 36, flowing ? this.f(flow, 0) + " l/h" : this.t("pompa stoi", "pump stopped"), flowing ? "sky" : "overlay1", 11)}`);
    // gas boiler (Combo)
    if (hasBoiler) {
      g.push(svg`<g @click=${this.tap("boiler_running")} class="hit">
          <rect x="510" y="248" width="86" height="84" rx="12" class="dev" style="stroke:${c(boiler ? "peach" : "overlay1")};${boiler ? `fill:${ca("peach", 0.12)}` : ""}"/>
          <path d="M 553 268 C 540 284, 544 300, 553 308 C 562 300, 566 284, 553 268 Z M 553 284 C 548 292, 550 300, 553 303 C 556 300, 558 292, 553 284 Z"
            fill=${c(boiler ? "peach" : "overlay1")} fill-rule="evenodd" style=${boiler ? `filter:drop-shadow(0 0 6px ${c("peach")});animation:ih-pulse 1.2s ease-in-out infinite` : ""}/></g>
        ${this.label(553, 242, this.t("Kocioł gazowy", "Gas boiler"), "", 10, "middle", 700)}
        <g @click=${this.tap("d01")} class="hit">${this.label(553, 324, this.val("d01", 1, " °C"), boiler ? "peach" : "overlay1", 11)}</g>`);
    }
    // 3-way valve
    g.push(svg`<g transform="translate(${valveX} ${supY})" @click=${this.tap("d22")} class="hit">
        <path d="M -16 -10 L 0 0 L -16 10 Z M 16 -10 L 0 0 L 16 10 Z M -10 -16 L 0 0 L 10 -16 Z" class="valve"
          style="fill:${ca(dhw ? "yellow" : "peach", 0.25)};stroke:${c(dhw ? "yellow" : "peach")}"/></g>
      ${this.label(valveX + 10, supY - 22, dhw ? this.t("CWU", "DHW") : this.t("CO", "CH"), dhw ? "yellow" : "peach", 10, "start", 800)}`);

    // space heating: valve -> buffer -> house
    const bufX = 702;
    g.push(this.pipe(`M ${valveX} ${supY - 16} L ${valveX} 104 L ${hasBuffer ? bufX : 800} 104`, HOT, ch, speed));
    if (hasBuffer) {
      g.push(svg`<rect x=${bufX} y="58" width="58" height="150" rx="14" class="tank" style="stroke:${c(ch ? "peach" : "overlay1")}"/>
        ${this.label(bufX + 29, 50, this.t("Bufor", "Buffer"), "", 10, "middle", 700)}`);
      g.push(this.pipe(`M ${bufX + 58} 84 L 800 84`, HOT, ch, speed));
      g.push(this.pipe(`M 800 176 L ${bufX + 58} 176`, COLD, ch, speed));
    }
    // house with floor heating
    g.push(svg`<g @click=${this.tap("zone1")} class="hit">
        <path d="M 800 92 L 856 40 L 912 92 L 912 214 L 800 214 Z" class="house" style="stroke:${c(ch ? "peach" : "overlay2")}"/>
        <path d="M 812 196 h 88 M 812 196 q 0 -10 10 -10 h 68 q 10 0 10 -10 q 0 -10 -10 -10 h -68 q -10 0 -10 -10 q 0 -10 10 -10 h 68" fill="none"
          stroke=${c(ch ? "peach" : "overlay2")} stroke-width="2.5" stroke-linecap="round" style=${ch ? `filter:drop-shadow(0 0 4px ${ca("peach", 0.7)})` : "opacity:.5"}/>
        ${this.label(856, 116, this.f(z1, 1, 1) + "°", "", 22)}
        ${this.label(856, 134, this.t("zadana ", "set ") + this.f(zs, 1, 1) + "°", "", 10, "middle", 600)}</g>`);
    // CH return to the return bus
    g.push(this.pipe(`M ${hasBuffer ? bufX + 29 : 856} ${hasBuffer ? 208 : 214} L ${hasBuffer ? bufX + 29 : 856} 246 L 912 246 L 912 492 L 424 492`, COLD, ch, speed));

    // DHW: valve -> cylinder coil -> return bus
    const cylX = 720;
    g.push(this.pipe(`M ${valveX + 16} ${supY} L 690 ${supY} L 690 360 L ${cylX + 14} 360`, HOT, dw, speed));
    g.push(svg`<g @click=${this.tap("tank")} class="hit">
        <rect x=${cylX} y="306" width="104" height="170" rx="18" class="tank" style="stroke:${c(dw ? "yellow" : "overlay1")}"/>
        <rect x=${cylX + 3} y=${306 + 167 * (1 - tankFill) + 3} width="98" height=${Math.max(0, 167 * tankFill - 3)} rx="15" fill=${ca(tankCol, 0.22)}/>
        <path d="M ${cylX + 14} 360 q 38 0 38 10 q 0 10 -38 10 q -38 0 -38 10 q 0 10 38 10 q 38 0 38 10 q 0 10 -38 10" fill="none"
          transform="translate(38 0)" stroke=${c(dw ? "yellow" : "overlay1")} stroke-width="2.5" style=${dw ? `filter:drop-shadow(0 0 4px ${ca("yellow", 0.7)})` : "opacity:.5"}/>
        ${this.label(cylX + 52, 346, this.f(tank, 1, 1) + "°", tankCol, 20)}
        ${this.label(cylX + 52, 462, this.t("nastawa ", "set ") + this.f(tankSet, 0) + "°", "", 10, "middle", 600)}</g>
      ${this.label(cylX + 52, 298, this.t("Ciepła woda", "Hot water"), "", 10, "middle", 700)}`);
    g.push(this.pipe(`M ${cylX + 14} 420 L 700 420 L 700 492`, COLD, dw, speed));
    // return bus -> HX
    g.push(this.pipe("M 424 492 L 424 372 L 396 372", COLD, flowing, speed));
    g.push(svg`<g @click=${this.tap("tw1")} class="hit">${this.label(430, 388, this.val("tw1", 1, " °C"), COLD, 12, "start")}</g>`);

    // top strip: stat blocks (HTML tiles on narrow cards); option `stats: false` drops them (the Now card shows the same)
    if (this.config.stats === false) {
      g.push(this.note());
      return html`<svg viewBox="0 30 920 470" class="dia">${g}</svg>`;
    }
    const stCol = defrost ? "sky" : run ? "peach" : boiler ? "yellow" : "overlay2";
    const stLbl = night ? this.t("Stan · ☾ U11", "State · ☾ U11") : this.t("Stan pracy", "Operating state");
    if (this.narrow) {
      const tile = (k: Key, lbl: string, v: string, col: string, wide = false) => html`<div class="st ${wide ? "wide" : ""}" @click=${this.tap(k)}>
          <div class="sl">${lbl}</div><div class="sv" style=${col ? `color:${c(col)}` : ""}>${v}</div></div>`;
      return html`<div class="tiles">
          ${tile("state", stLbl, st || "–", stCol, true)}
          ${tile("outdoor", this.t("Na zewnątrz", "Outdoor"), this.f(out, 1, 1) + "°", "sky")}
          ${tile("heat_power", this.t("Moc cieplna", "Heat output"), isNaN(heat) ? "–" : this.f(heat / 1000, 1, 1) + " kW", "peach")}
          ${tile("elec_power", this.t("Pobór", "Input"), isNaN(elec) ? "–" : this.f(Math.max(0, elec), 0) + " W", "yellow")}
          ${tile("cop", "COP", run && cop > 0 ? this.f(cop, 2, 2) : "–", copCol)}
          ${tile("d04", this.t("Zadana D04", "Setpoint D04"), this.val("d04", 1, "°"), "yellow")}
          ${tile("hp_delta", "ΔT", this.val("hp_delta", 1, " K"), "")}
          ${defrost ? html`<div class="st wide defrost">${this.t("❄ ODSZRANIANIE", "❄ DEFROST")}</div>` : nothing}
        </div>
        <svg viewBox="0 30 920 470" class="dia">${g}</svg>`;
    }
    const stat = (x: number, w: number, k: Key, lbl: string, v: string, col: string) => svg`<g @click=${this.tap(k)} class="hit">
        <rect x=${x} y="14" width=${w} height="58" rx="12" class="stat"/>
        ${this.label(x + 10, 34, lbl, "", 9, "start", 700)}${this.label(x + 10, 62, v, col, 15, "start")}</g>`;
    g.push(stat(16, 120, "outdoor", this.t("Na zewnątrz", "Outdoor"), this.f(out, 1, 1) + "°", "sky"));
    g.push(stat(144, 230, "state", stLbl, st || "–", stCol));
    g.push(stat(382, 116, "heat_power", this.t("Moc cieplna", "Heat output"), isNaN(heat) ? "–" : this.f(heat / 1000, 1, 1) + " kW", "peach"));
    g.push(stat(506, 100, "elec_power", this.t("Pobór", "Input"), isNaN(elec) ? "–" : this.f(Math.max(0, elec), 0) + " W", "yellow"));
    g.push(svg`<g @click=${this.tap("cop")} class="hit"><rect x="16" y="80" width="120" height="58" rx="12" class="stat"/>
        ${this.label(26, 100, "COP", "", 9, "start", 700)}${this.label(26, 128, run && cop > 0 ? this.f(cop, 2, 2) : "–", copCol, 15, "start")}</g>
      <g @click=${this.tap("d04")} class="hit"><rect x="144" y="80" width="112" height="58" rx="12" class="stat"/>
        ${this.label(154, 100, this.t("Zadana D04", "Setpoint D04"), "", 9, "start", 700)}${this.label(154, 128, this.val("d04", 1, "°"), "yellow", 15, "start")}</g>
      <g @click=${this.tap("hp_delta")} class="hit"><rect x="264" y="80" width="110" height="58" rx="12" class="stat"/>
        ${this.label(274, 100, "ΔT", "", 9, "start", 700)}${this.label(274, 128, this.val("hp_delta", 1, " K"), "", 15, "start")}</g>`);
    if (defrost) g.push(svg`<g><rect x="382" y="80" width="224" height="58" rx="12" fill=${ca("sky", 0.2)} stroke=${c("sky")}/>${this.label(494, 116, this.t("❄ ODSZRANIANIE", "❄ DEFROST"), "sky", 13)}</g>`);

    return html`<svg viewBox="0 0 920 500" class="dia">${g}</svg>`;
  }

  static styles = [HubCard.styles, css`
    ha-card { padding: 8px; }
    .dia { width: 100%; height: auto; display: block; }
    .dia text { font-family: var(--paper-font-body1_-_font-family, inherit); }
    .stat { fill: rgba(255,255,255,.035); stroke: rgba(255,255,255,.08); stroke-width: 1; }
    .panel { fill: rgba(255,255,255,.025); stroke: rgba(255,255,255,.09); stroke-width: 1.2; }
    .pb { fill: none; stroke: rgba(255,255,255,.06); stroke-width: 9; stroke-linecap: round; stroke-linejoin: round; }
    .pl { fill: none; stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; }
    .pf { fill: none; stroke-width: 4; stroke-linecap: round; stroke-dasharray: 2 16; animation: ih-dash linear infinite; filter: brightness(1.8); }
    .coil { fill: none; stroke-width: 3; stroke-linecap: round; }
    .dev { fill: rgba(255,255,255,.04); stroke-width: 2.5; }
    .tank, .house { fill: rgba(255,255,255,.035); stroke-width: 2.2; }
    .valve { stroke-width: 2; stroke-linejoin: round; }
    .fanring { fill: rgba(255,255,255,.03); stroke: rgba(255,255,255,.1); stroke-width: 2; }
    .blade { fill: rgba(255,255,255,.16); }
    .hub { fill: rgba(255,255,255,.35); }
    /* rotate around the local origin (the hub), not the centre of the blades bounding box */
    .fan { transform-box: view-box; transform-origin: 0 0; }
    .hit { cursor: pointer; }
    .tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin-bottom: 6px; }
    .st { cursor: pointer; padding: 7px 10px; border-radius: 12px; min-width: 0; background: rgba(255,255,255,.035); border: 1px solid rgba(255,255,255,.08); }
    .st.wide { grid-column: span 2; }
    .sl { font-size: 12px; font-weight: 700; opacity: .75; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sv { font-size: 19px; font-weight: 800; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .st.defrost { cursor: default; text-align: center; font-weight: 800; font-size: 15px; color: var(--ih-sky, #89dceb); background: rgba(137,220,235,.15); border-color: rgba(137,220,235,.6); }
    @keyframes ih-dash { to { stroke-dashoffset: -36; } }
  `];
}

register("immergas-diagram-card", ImmergasDiagramCard, "Immergas – Schemat / Diagram",
  "Animowany schemat instalacji: jednostka zewnętrzna, sprężarka, wymiennik, pompa, kocioł, zawór 3-drożny, bufor, dom i zasobnik CWU");
