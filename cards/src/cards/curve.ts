// "Krzywe / Curves": tabs Heating (R04/R05 + U03), Cooling (R13/R12) and Outing (FSV 5011-5019, heating / cooling),
// drawn in SVG with draggable points and -/+ steppers. Default tab follows the operating mode (cooling -> Cooling).
// Options: r02 / r03 (outdoor temp at R04 / R05, default -12 / 20), r11 / r10 (at R13 / R12, default 25 / 35) - these
// curve points are not on any bus; max_floor_entity (max floor flow temp, red band); dew_point_entity (zone dew point,
// red band in cooling); tab: heat | cool | outing (initial tab).
import { svg, SVGTemplateResult } from "lit";
import { HubCard, html, css, nothing, c, ca, box, register } from "../base";
import { isCoolMode } from "./timers";
import { Key } from "../names";

interface Axis { X0: number; X1: number; Y0: number; Y1: number; xs: number; ys: number }
const W = 340, H = 196, x0 = 30, x1 = 332, y0 = 10, y1 = 166;
const curve = (x: number, a: number, ya: number, b: number, yb: number) => x <= a ? ya : x >= b ? yb : ya + (yb - ya) * (x - a) / (b - a);

class ImmergasCurveCard extends HubCard {
  private tab = "";
  private out: boolean | null = null; // Outing toggle: Heating / Cooling then show the outing curves
  private drag: { k: Key; v: number; mn: number; mx: number } | null = null;
  private ax: Axis = { X0: -20, X1: 30, Y0: 15, Y1: 60, xs: 5, ys: 10 };

  private px(x: number) { const { X0, X1 } = this.ax; return x0 + (Math.min(X1, Math.max(X0, x)) - X0) / (X1 - X0) * (x1 - x0); }
  private py(y: number) { const { Y0, Y1 } = this.ax; return y1 - (Math.min(Y1, Math.max(Y0, y)) - Y0) / (Y1 - Y0) * (y1 - y0); }

  private grid(): SVGTemplateResult[] {
    const { X0, X1, Y0, Y1, xs, ys } = this.ax, g: SVGTemplateResult[] = [];
    for (let x = X0; x <= X1; x += xs) g.push(svg`<line x1=${this.px(x)} y1=${y0} x2=${this.px(x)} y2=${y1} stroke="currentColor" stroke-opacity=${x === 0 ? 0.18 : 0.07}/>
      <text x=${this.px(x)} y=${y1 + 13} font-size="9" text-anchor="middle" fill="currentColor" fill-opacity=".5">${x}°</text>`);
    for (let y = Y0; y <= Y1; y += ys) g.push(svg`<line x1=${x0} y1=${this.py(y)} x2=${x1} y2=${this.py(y)} stroke="currentColor" stroke-opacity=".07"/>
      <text x=${x0 - 5} y=${this.py(y) + 3} font-size="9" text-anchor="end" fill="currentColor" fill-opacity=".5">${y}°</text>`);
    return g;
  }
  private hline(v: number, col: string, label: string, band?: "above" | "below", dash = "2 3", w = 1.4, right = true) {
    if (isNaN(v)) return nothing;
    const y = this.py(v), b = band === "above" ? svg`<rect x=${x0} y=${y0} width=${x1 - x0} height=${Math.max(0, y - y0)} fill=${ca(col, 0.1)}/>`
      : band === "below" ? svg`<rect x=${x0} y=${y} width=${x1 - x0} height=${Math.max(0, y1 - y)} fill=${ca(col, 0.1)}/>` : nothing;
    return svg`${b}<line x1=${x0} y1=${y} x2=${x1} y2=${y} stroke=${c(col)} stroke-width=${w} stroke-dasharray=${dash}/>
      <text x=${right ? x1 - 2 : x0 + 4} y=${y - 4} font-size="9" font-weight="700" text-anchor=${right ? "end" : "start"} fill=${c(col)}>${label}</text>`;
  }
  private onMove(e: PointerEvent) {
    if (!this.drag) return;
    const r = (e.currentTarget as SVGElement).closest("svg")!.getBoundingClientRect(), { Y0, Y1 } = this.ax;
    const yy = (e.clientY - r.top) / r.height * H;
    this.drag.v = Math.max(this.drag.mn, Math.min(this.drag.mx, Math.round(Y0 + (y1 - yy) / (y1 - y0) * (Y1 - Y0))));
    this.requestUpdate();
  }
  private handle(k: Key, x: number, v: number, mn: number, mx: number, lbl: string, col: string) {
    const cur = this.drag?.k === k ? this.drag.v : v;
    return svg`<circle cx=${this.px(x)} cy=${this.py(cur)} r="8" fill=${c(col)} stroke="var(--ha-card-background, #1e1e2e)" stroke-width="3" style="filter:drop-shadow(0 0 6px ${c(col)})"/>
      <circle cx=${this.px(x)} cy=${this.py(cur)} r="20" fill="transparent" style="cursor:ns-resize;touch-action:none"
        @pointerdown=${(e: PointerEvent) => { e.preventDefault(); (e.target as Element).setPointerCapture(e.pointerId); this.drag = { k, v, mn, mx }; }}
        @pointermove=${(e: PointerEvent) => this.onMove(e)}
        @pointerup=${() => { const d = this.drag; this.drag = null; if (d && d.v !== v) this.call("number", "set_value", k, { value: d.v }); this.requestUpdate(); }}
        @pointercancel=${() => { this.drag = null; this.requestUpdate(); }}/>
      <text x=${this.px(x)} y=${this.py(cur) - 14} font-size="11" font-weight="800" text-anchor="middle" fill=${c(col)}>${lbl} ${cur}°</text>`;
  }
  /** Immergas curve: flat hi until xa, linear to lo at xb, flat after; with draggable ends */
  private curveSvg(kHi: Key, kLo: Key, hi: number, lo: number, xa: number, xb: number, col: string, off: number,
                   lim: [number, number, number, number], lbl: [string, string, string, string]) {
    const g: unknown[] = [];
    const h = this.drag?.k === kHi ? this.drag.v : hi, l = this.drag?.k === kLo ? this.drag.v : lo, { X0, X1 } = this.ax;
    if (isNaN(h) || isNaN(l)) return g;
    const d = `M ${this.px(X0)} ${this.py(h)} L ${this.px(xa)} ${this.py(h)} L ${this.px(xb)} ${this.py(l)} L ${this.px(X1)} ${this.py(l)}`;
    g.push(svg`<path d="${d} L ${this.px(X1)} ${y1} L ${this.px(X0)} ${y1} Z" fill=${ca(col, 0.1)}/>
      <path d=${d} fill="none" stroke=${c(col)} stroke-width="3" stroke-linejoin="round" style="filter:drop-shadow(0 0 4px ${ca(col, 0.7)})"/>`);
    if (off) {
      const pts: string[] = [];
      for (let x = X0; x <= X1; x += 0.5) pts.push(`${this.px(x).toFixed(1)},${this.py(Math.max(l, Math.min(h, curve(x, xa, h, xb, l) + off))).toFixed(1)}`);
      g.push(svg`<polyline points=${pts.join(" ")} fill="none" stroke=${c("yellow")} stroke-width="1.8" stroke-dasharray="6 3" stroke-linejoin="round"/>`);
    }
    g.push(this.handle(kHi, xa, hi, lim[0], lim[1], lbl[0], col), this.handle(kLo, xb, lo, lim[2], lim[3], lbl[1], col));
    g.push(svg`<text x=${this.px(xa)} y=${y1 - 4} font-size="8.5" font-weight="700" text-anchor="middle" fill="currentColor" fill-opacity=".45">${lbl[2]}</text>
      <text x=${this.px(xb)} y=${y1 - 4} font-size="8.5" font-weight="700" text-anchor="middle" fill="currentColor" fill-opacity=".45">${lbl[3]}</text>`);
    return g;
  }
  private nowMarks(out: number, tgt: number, d04: number, flow: number, col: string) {
    if (isNaN(out)) return nothing;
    const { X0, X1 } = this.ax;
    if (out < X0 || out > X1) return nothing;
    const x = this.px(out);
    return svg`<line x1=${x} y1=${y0} x2=${x} y2=${y1} stroke=${c(col)} stroke-dasharray="3 3" stroke-opacity=".8"/>
      ${!isNaN(tgt) && !isNaN(d04) && Math.abs(tgt - d04) >= 0.5 ? svg`<circle cx=${x} cy=${this.py(tgt)} r="4" fill="none" stroke=${c("yellow")} stroke-width="1.5" stroke-dasharray="2 2"/>` : nothing}
      ${!isNaN(d04) || !isNaN(tgt) ? svg`<circle cx=${x} cy=${this.py(isNaN(d04) ? tgt : d04)} r="4.5" fill=${c("yellow")}/>` : nothing}
      ${!isNaN(flow) ? svg`<circle cx=${x} cy=${this.py(flow)} r="5" fill="none" stroke=${c("red")} stroke-width="2"/>` : nothing}`;
  }
  private ctl(k: Key, v: number, mn: number, mx: number, name: string, sub: string, col: string, step = 1, locked = false) {
    const st = (d: number, icon: string) => {
      const nv = Math.round(Math.max(mn, Math.min(mx, v + d)) * 2) / 2, dis = locked || isNaN(v) || nv === v;
      return html`<div class="btn ${dis ? "off" : ""}" title=${locked ? this.t("Zapis F1/F2 zablokowany", "F1/F2 write locked") : ""}
        @click=${() => !dis && this.call("number", "set_value", k, { value: nv })}><ha-icon icon=${locked ? "mdi:lock" : icon}></ha-icon></div>`;
    };
    return html`<div class="ctl" style="background:${ca(col, 0.07)};border:1px solid ${ca(col, 0.25)}">
      <div class="cx" @click=${() => this.moreInfo(k)} style="cursor:pointer"><div class="cn">${name}</div><div class="cs">${sub}</div></div>
      ${st(-step, "mdi:minus")}<div class="cvv" style="color:${c(col)}">${isNaN(v) ? "–" : this.f(v) + "°"}</div>${st(step, "mdi:plus")}</div>`;
  }
  private chipTab(id: string, icon: string, lbl: string, col: string, cur: string, set: (v: string) => void) {
    const on = id === cur;
    return html`<div class="tab" style=${on ? `background:${ca(col, 0.24)};border-color:${ca(col, 0.6)}` : ""} @click=${() => { set(id); this.requestUpdate(); }}>
      <ha-icon icon=${icon} style="color:${c(col)}"></ha-icon>${lbl}</div>`;
  }

  // ---------------- tabs ----------------
  private heat() {
    this.ax = { X0: -20, X1: 30, Y0: 15, Y1: 60, xs: 5, ys: 10 };
    if (this.dominus && !this.allSet("dom_r02", "dom_r03", "r04", "r05"))
      return this.domSetup([["dom_r02", "R02 · temp. zewn. przy maks. zasilaniu", "R02 · outdoor at max. flow"], ["dom_r03", "R03 · temp. zewn. przy min. zasilaniu", "R03 · outdoor at min. flow"],
        ["r04", "R04 · maks. zasilanie CO", "R04 · max. CH flow"], ["r05", "R05 · min. zasilanie CO", "R05 · min. CH flow"]], true);
    const xa = this.pt("r02", "dom_r02", -12), xb = this.pt("r03", "dom_r03", 20);
    const hi = this.n("r04"), lo = this.n("r05"), out = this.n("outdoor"), flow = this.n("flow_d20");
    const offRaw = this.n("u03"), off = isNaN(offRaw) ? 0 : offRaw, d04raw = this.n("d04"), d04 = d04raw > 5 && !this.cooling ? d04raw : NaN;
    const zad = this.n("zone1_set"), room = this.n("zone1");
    const floorE = this.opt("max_floor_entity"), maxF = floorE ? parseFloat(this.hass.states[floorE]?.state ?? floorE) : NaN;
    const tgt = isNaN(hi) || isNaN(lo) ? NaN : Math.max(lo, Math.min(hi, curve(out, xa, hi, xb, lo) + off));
    let comfort: unknown = nothing;
    if (!isNaN(room) && !isNaN(zad)) {
      const dd = room - zad, sign = (v: number) => (v > 0 ? "+" : "") + v;
      const [txt, col] = Math.abs(dd) <= 0.5 ? [this.t("komfort ✓", "comfort ✓"), "green"]
        : dd > 0 ? [this.t("za ciepło +", "too warm +") + this.f(dd) + this.t("° → obniż U03", "° → lower U03") + (isNaN(offRaw) ? "" : this.t(" do ", " to ") + sign(offRaw - 1)), "peach"]
        : [this.t("za zimno ", "too cold ") + this.f(dd) + this.t("° → podnieś U03", "° → raise U03") + (isNaN(offRaw) ? "" : this.t(" do ", " to ") + sign(offRaw + 1)), "sky"];
      comfort = html`<span @click=${() => this.moreInfo("zone1")} style="cursor:pointer">${this.t("pokój", "room")} <b>${this.f(room)}°</b>/${this.f(zad)}° <b style="color:${c(col)}">${txt}</b></span>`;
    }
    return html`
      ${this.info(out, comfort, d04, tgt, flow)}
      <svg viewBox="0 0 ${W} ${H}">${this.grid()}
        ${this.hline(maxF, "red", this.t("maks. podłoga ", "max. floor ") + this.f(maxF) + "°", "above")}
        ${this.hline(isNaN(zad) ? NaN : zad + 2, "sky", this.t(`poniżej nie grzeje (pokój ${this.f(zad)}° + 2)`, `below it does not heat (room ${this.f(zad)}° + 2)`), "below", "2 3", 1.4, false)}
        ${this.curveSvg("r04", "r05", hi, lo, xa, xb, "peach", off, [Math.max(25, lo + 1), 60, 20, Math.min(45, hi - 1)], ["R04", "R05", "R02", "R03"])}
        ${this.nowMarks(out, tgt, d04, flow, "sky")}</svg>
      <div class="row">
        ${this.ctl("r04", hi, Math.max(25, lo + 1), 60, this.t("R04 · maks. zasilanie", "R04 · max. flow"), this.t(`od R02 = ${xa} °C w dół`, `from R02 = ${xa} °C down`), "peach")}
        ${this.ctl("r05", lo, 20, Math.min(45, hi - 1), this.t("R05 · min. zasilanie", "R05 · min. flow"), this.t(`od R03 = ${xb} °C w górę`, `from R03 = ${xb} °C up`), "peach")}
        ${this.ctl("u03", offRaw, -10, 10, this.t("U03 · offset krzywej", "U03 · curve offset"), this.dominus
          ? this.t("przesuwa całą krzywą (zapis przez Dominusa)", "shifts the whole curve (written through Dominus)") : this.t("przesuwa całą krzywą (D+/D-)", "shifts the whole curve (D+/D-)"), "peach")}
      </div>
      <div class="legend">${this.leg("peach", this.t("krzywa Immergas", "Immergas curve"))}
        ${off ? html`<span><i style="border-top:2px dashed ${c("yellow")};height:0"></i>${this.t(`z offsetem ${off > 0 ? "+" : ""}${off} °C (działająca)`, `with offset ${off > 0 ? "+" : ""}${off} °C (in effect)`)}</span>` : nothing}
        <span>${this.dominus ? this.t("● zasilanie wyliczone z krzywej (Dominus nie czyta zasilania)", "● flow computed from the curve (Dominus does not read the flow)")
          : this.t("● zadane D04 (piec) · ○ faktyczne zasilanie", "● D04 setpoint (boiler) · ○ actual flow")}</span></div>
      <div class="note">${this.dominus
        ? this.t(`R02–R05 to kopia menu R pieca (zmiana tutaj nie trafia do kotła – zmień też na piecu). U03 zapisuje się do kotła. +1 U03 = +1 °C wody przy każdej temperaturze zewnętrznej.`,
          `R02–R05 are a copy of the boiler's menu R (a change here does not reach the boiler – change it there too). U03 is written to the boiler. +1 U03 = +1 °C of water at every outdoor temperature.`)
        : this.t(`Przeciągnij punkt albo użyj −/+ (krok 1 °C). R02 ${xa} °C / R03 ${xb} °C to opcje karty (nie ma ich na magistrali). R04/R05 → T-/T+, U03 → D+/D-.`,
        `Drag a point or use −/+ (1 °C step). R02 ${xa} °C / R03 ${xb} °C are card options (not on any bus). R04/R05 → T-/T+, U03 → D+/D-.`)}</div>`;
  }

  private get cooling() { return isCoolMode(this.s("mode")); }

  private cool() {
    this.ax = { X0: 18, X1: 42, Y0: 5, Y1: 25, xs: 3, ys: 5 };
    if (this.dominus && !this.allSet("dom_r10", "dom_r11", "r12", "r13"))
      return this.domSetup([["dom_r10", "R10 · temp. zewn. przy min. zasilaniu", "R10 · outdoor at min. flow"], ["dom_r11", "R11 · temp. zewn. przy maks. zasilaniu", "R11 · outdoor at max. flow"],
        ["r12", "R12 · min. zasilanie chłodzenia", "R12 · min. cooling flow"], ["r13", "R13 · maks. zasilanie chłodzenia", "R13 · max. cooling flow"]], false);
    const xa = this.pt("r11", "dom_r11", 25), xb = this.pt("r10", "dom_r10", 35);
    const hi = this.n("r13"), lo = this.n("r12"), out = this.n("outdoor"), flow = this.n("flow_d20");
    const d04 = this.cooling ? this.n("d04") : NaN;
    const dew = this.config.dew_point_entity ? parseFloat(this.hass.states[this.config.dew_point_entity]?.state) : NaN;
    const tgt = isNaN(hi) || isNaN(lo) ? NaN : Math.max(lo, Math.min(hi, curve(out, xa, hi, xb, lo)));
    const dewSpan = this.config.dew_point_entity ? html`<span @click=${() => this.moreDew()} style="cursor:pointer">${this.t("rosa", "dew point")} <b style="color:${c("red")}">${this.f(dew)} °C</b></span>` : nothing;
    return html`
      ${this.info(out, dewSpan, d04, tgt, flow)}
      <svg viewBox="0 0 ${W} ${H}">${this.grid()}
        ${isNaN(dew) ? nothing : svg`<rect x=${x0} y=${this.py(dew + 2)} width=${x1 - x0} height=${Math.max(0, this.py(this.ax.Y0) - this.py(dew + 2))} fill=${ca("red", 0.18)}/>`}
        ${this.hline(dew, "red", this.t("punkt rosy ", "dew point ") + this.f(dew) + "°", undefined, "3 3", 1.8)}
        ${this.curveSvg("r13", "r12", hi, lo, xa, xb, "sky", 0, [Math.max(7, lo + 1), 25, 5, Math.min(20, hi - 1)], ["R13", "R12", "R11", "R10"])}
        ${this.nowMarks(out, tgt, d04, flow, "mauve")}</svg>
      <div class="row">
        ${this.ctl("r13", hi, Math.max(7, lo + 1), 25, this.t("R13 · maks. zasilanie", "R13 · max. flow"), this.t(`od R11 = ${xa} °C w dół`, `from R11 = ${xa} °C down`), "sky")}
        ${this.ctl("r12", lo, 5, Math.min(20, hi - 1), this.t("R12 · min. zasilanie", "R12 · min. flow"), this.t(`od R10 = ${xb} °C w górę`, `from R10 = ${xb} °C up`), "sky")}
      </div>
      <div class="legend">${this.leg("sky", this.t("krzywa chłodzenia Immergas", "Immergas cooling curve"))}
        ${this.config.dew_point_entity ? html`<span><i style="border-top:2px dotted ${c("red")};height:0"></i>${this.t("punkt rosy (czerwone tło = rosa + 2 °C)", "dew point (red band = dew point + 2 °C)")}</span>` : nothing}
        <span>${this.dominus ? this.t("● zasilanie wyliczone z krzywej", "● flow computed from the curve")
          : this.t("● zadane D04 (tylko w trybie Chłodzenie) · ○ faktyczne zasilanie", "● D04 setpoint (cooling mode only) · ○ actual flow")}</span></div>
      <div class="note">${this.t(`R11 ${xa} °C / R10 ${xb} °C to opcje karty (nie ma ich na magistrali). R13/R12 → T-/T+. Przy chłodzeniu podłogowym pilnuj punktu rosy.`,
        `R11 ${xa} °C / R10 ${xb} °C are card options (not on any bus). R13/R12 → T-/T+. With floor cooling watch the dew point.`)}</div>`;
  }
  private moreDew() {
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: this.config.dew_point_entity }, bubbles: true, composed: true }));
  }

  private outing() {
    const act = this.on("f_outing"), locked = this.writeLocked;
    const heat = this.base === "heat";
    const out = this.n("outdoor"), cg = act ? "teal" : "sky", cc = act ? "blue" : "sky", col = heat ? cg : cc;
    this.ax = heat ? { X0: -20, X1: 30, Y0: 10, Y1: 50, xs: 5, ys: 10 } : { X0: 18, X1: 42, Y0: 5, Y1: 30, xs: 4, ys: 5 };
    let norm: ((x: number) => number) | null = null;
    if (heat) {
      const hi = this.n("r04"), lo = this.n("r05"), off = this.n("u03") || 0, xa = this.pt("r02", "dom_r02", -12), xb = this.pt("r03", "dom_r03", 20);
      if (!isNaN(hi) && !isNaN(lo)) norm = (x) => Math.max(lo, Math.min(hi, curve(x, xa, hi, xb, lo) + off));
    } else {
      const hi = this.n("r13"), lo = this.n("r12"), xa = this.pt("r11", "dom_r11", 25), xb = this.pt("r10", "dom_r10", 35);
      if (!isNaN(hi) && !isNaN(lo)) norm = (x) => Math.max(lo, Math.min(hi, curve(x, xa, hi, xb, lo)));
    }
    const wyK: Key = heat ? "fsv5013" : "fsv5011", wy = this.n(wyK);
    const extra: [Key, string, string][] = heat ? [["fsv5017", "lavender", "auto WL1 (5017)"], ["fsv5018", "mauve", "auto WL2 (5018)"]]
      : [["fsv5015", "lavender", "auto WL1 (5015)"], ["fsv5016", "mauve", "auto WL2 (5016)"]];
    const nNow = norm && !isNaN(out) ? norm(out) : NaN;
    const g: unknown[] = [this.grid()];
    if (norm) {
      const pts: string[] = [];
      for (let x = this.ax.X0; x <= this.ax.X1; x += 0.5) pts.push(`${this.px(x).toFixed(1)},${this.py(norm(x)).toFixed(1)}`);
      g.push(svg`<polyline points=${pts.join(" ")} fill="none" stroke=${c("peach")} stroke-width="1.8" stroke-dasharray="5 4" stroke-opacity=".6" stroke-linejoin="round"/>`);
    }
    if (!isNaN(wy)) g.push(svg`<line x1=${x0} y1=${this.py(wy)} x2=${x1} y2=${this.py(wy)} stroke=${c(col)} stroke-width="3" stroke-opacity=${act ? 1 : 0.75}
        style=${act ? `filter:drop-shadow(0 0 4px ${ca(col, 0.7)})` : ""}/>
      <text x=${x1 - 2} y=${this.py(wy) - 5} font-size="10" font-weight="800" text-anchor="end" fill=${c(col)}>${this.t("woda wyjazdowa", "outing water")} (${heat ? 5013 : 5011}) ${this.f(wy)}°</text>`);
    for (const [k, cl, l] of extra) { const v = this.n(k); if (!isNaN(v) && Math.abs(v - wy) >= 0.5) g.push(this.hline(v, cl, `${l} ${this.f(v)}°`, undefined, "2 3", 1.6, false)); }
    if (!isNaN(out) && out >= this.ax.X0 && out <= this.ax.X1) {
      const x = this.px(out);
      g.push(svg`<line x1=${x} y1=${y0} x2=${x} y2=${y1} stroke=${c("sky")} stroke-dasharray="3 3" stroke-opacity=".8"/>`);
      if (!isNaN(nNow)) g.push(svg`<circle cx=${x} cy=${this.py(nNow)} r="4.5" fill=${c("peach")}/>`);
      if (!isNaN(wy)) g.push(svg`<circle cx=${x} cy=${this.py(wy)} r="5" fill=${c(col)} stroke="var(--ha-card-background, #1e1e2e)" stroke-width="2"/>`);
      if (!isNaN(nNow) && !isNaN(wy) && Math.abs(nNow - wy) >= 1) {
        const up = wy > nNow;
        g.push(svg`<line x1=${x + 7} y1=${this.py(nNow) + (up ? -4 : 4)} x2=${x + 7} y2=${this.py(wy) + (up ? 6 : -6)} stroke=${c(col)} stroke-width="1.4"/>
          <text x=${x + 11} y=${(this.py(nNow) + this.py(wy)) / 2 + 3} font-size="10" font-weight="800" fill=${c(col)}>${up ? "+" : "−"}${this.f(Math.abs(wy - nNow))}°</text>`);
      }
    }
    const ctls = heat
      ? [this.ctl("fsv5013", wy, 15, 55, this.t("Woda – grzanie", "Water – heating"), "FSV 5013", cg, 0.5, locked),
        this.ctl("fsv5014", this.n("fsv5014"), 16, 30, this.t("Pokój – grzanie", "Room – heating"), "FSV 5014", cg, 0.5, locked),
        this.ctl("fsv5019", this.n("fsv5019"), 30, 70, this.t("Zasobnik CWU", "DHW cylinder"), "FSV 5019", "peach", 0.5, locked),
        this.ctl("fsv5017", this.n("fsv5017"), 15, 55, this.t("Auto grzanie WL1", "Auto heating WL1"), "FSV 5017", "lavender", 0.5, locked),
        this.ctl("fsv5018", this.n("fsv5018"), 15, 55, this.t("Auto grzanie WL2", "Auto heating WL2"), "FSV 5018", "mauve", 0.5, locked)]
      : [this.ctl("fsv5011", wy, 5, 25, this.t("Woda – chłodzenie", "Water – cooling"), "FSV 5011", cc, 0.5, locked),
        this.ctl("fsv5012", this.n("fsv5012"), 18, 30, this.t("Pokój – chłodzenie", "Room – cooling"), "FSV 5012", cc, 0.5, locked),
        this.ctl("fsv5015", this.n("fsv5015"), 5, 25, this.t("Auto chłodzenie WL1", "Auto cooling WL1"), "FSV 5015", "lavender", 0.5, locked),
        this.ctl("fsv5016", this.n("fsv5016"), 5, 25, this.t("Auto chłodzenie WL2", "Auto cooling WL2"), "FSV 5016", "mauve", 0.5, locked)];
    return html`
      <div class="tr" style="margin-top:8px">
        <span>${this.t("teraz", "now")} <b>${this.f(out)} °C</b></span>
        <span>${this.t("normalnie", "normally")} <b style="color:${c("peach")}">${this.f(nNow)} °C</b></span>
        <span>${this.t("na wyjeździe", "outing")} <b style="color:${c(col)}">${this.f(wy)} °C</b></span>
        <span>${this.t("pokój", "room")} <b>${this.f(this.n(heat ? "fsv5014" : "fsv5012"))}°</b> · ${this.t("CWU", "DHW")} <b>${this.f(this.n("fsv5019"))}°</b></span></div>
      <svg viewBox="0 0 ${W} ${H}">${g}</svg>
      <div class="row">${ctls}</div>
      <div class="legend">${this.leg(col, heat ? this.t("zasilanie na wyjeździe", "outing flow") : this.t("zasilanie chłodzenia na wyjeździe", "outing cooling flow"))}
        <span><i style="border-top:2px dashed ${c("peach")};height:0"></i>${this.t("normalna krzywa Immergas", "normal Immergas curve")}</span></div>
      <div class="note">${!locked ? this.t("Zmiany idą od razu do jednostki (krok 0,5 °C).", "Changes go straight to the unit (0.5 °C step).")
        : this.t("🔒 Starszy hub: nastawy zmienisz po uzbrojeniu zapisu w karcie Sterowanie F1/F2.", "🔒 Older hub: arm the write in the F1/F2 control card to change the setpoints.")}
        ${this.t(" Na wyjeździe jednostka trzyma stałą nastawę wody zamiast krzywej Immergas.", " In outing mode the unit holds a fixed water setpoint instead of the Immergas curve.")}</div>`;
  }

  private info(out: number, mid: unknown, d04: number, tgt: number, flow: number) {
    if (this.dominus) return html`<div class="tr" style="margin-top:8px">
      <span>${this.t("teraz", "now")} <b>${this.f(out)} °C</b></span>${mid}
      <span>${this.t("z krzywej", "from the curve")} <b style="color:${c("yellow")}">${this.f(tgt)} °C</b></span></div>`;
    return html`<div class="tr" style="margin-top:8px">
      <span>${this.t("teraz", "now")} <b>${this.f(out)} °C</b></span>${mid}
      <span @click=${() => this.moreInfo("d04")} style="cursor:pointer">${this.t("zadane D04", "setpoint D04")} <b style="color:${c("yellow")}">${this.f(isNaN(d04) ? tgt : d04)} °C</b>${!isNaN(d04) && !isNaN(tgt) && Math.abs(tgt - d04) >= 0.5 ? html` <span style="opacity:.55">(${this.t("krzywa", "curve")} ${this.f(tgt)})</span>` : nothing}</span>
      <span @click=${() => this.moreInfo("flow_d20")} style="cursor:pointer">${this.t("zasilanie", "flow")} <b style="color:${c("red")}">${this.f(flow)} °C</b></span></div>`;
  }
  /** curve point: the card option, else the value declared in Immergas Dominus, else the default */
  private pt(opt: string, k: Key, def: number) {
    const o = this.config[opt];
    if (o !== undefined) return +o;
    // Dominus: the declared copies; hub: its config numbers hub_r02 / hub_r03 / hub_r10 / hub_r11 (package hub_boiler_params)
    const v = this.n(this.dominus ? k : (`hub_${opt}` as Key));
    return isNaN(v) ? def : v;
  }
  /** Dominus: the curve values are not readable over TCP - until all are copied from the boiler, ask for them */
  private domSetup(rows: [Key, string, string][], heat: boolean) {
    return html`<div class="setup">
      <div class="st">${heat ? this.t("Krzywa grzewcza nie jest jeszcze ustawiona", "The heating curve is not set yet")
        : this.t("Krzywa chłodzenia nie jest jeszcze ustawiona", "The cooling curve is not set yet")}</div>
      <div class="sd">${this.t("Dominus nie czyta menu R pieca. Przepisz te wartości z pieca raz – karta narysuje krzywą, gdy będą komplet.",
        "Dominus cannot read the boiler's menu R. Copy these values from the boiler once – the card draws the curve when all are set.")}</div>
      ${rows.map(([k, pl, en]) => this.numRow(k, heat ? "mdi:fire" : "mdi:snowflake", this.t(pl, en), 0))}
      ${heat ? this.numRow("u03", "mdi:chart-bell-curve-cumulative", this.t("U03 · offset krzywej (zapis do kotła)", "U03 · curve offset (written to the boiler)"), 0) : nothing}</div>`;
  }
  private leg(col: string, l: string) { return html`<span><i style="background:${c(col)}"></i>${l}</span>`; }

  private get base() { return this.tab || (this.config.tab === "cool" ? "cool" : this.config.tab === "heat" ? "heat" : this.cooling ? "cool" : "heat"); }

  protected body() {
    const base = this.base, out = this.out ?? this.config.tab === "outing", act = this.on("f_outing");
    const head = out ? ["mdi:bag-suitcase-outline", act ? "teal" : base === "heat" ? "peach" : "sky",
        base === "heat" ? this.t("Krzywa · wyjazd · grzanie", "Curve · outing · heating") : this.t("Krzywa · wyjazd · chłodzenie", "Curve · outing · cooling"),
        this.t("nastawy wyjazdowe F1/F2 (FSV 5011–5019)", "F1/F2 outing setpoints (FSV 5011–5019)") + (act ? this.t(" · tryb wyjazdowy AKTYWNY", " · outing mode ACTIVE") : "")]
      : base === "heat" ? ["mdi:chart-bell-curve-cumulative", "peach", this.t("Krzywa grzewcza", "Heating curve"), this.dominus
          ? this.t("Strefa 1 · R02–R05 (kopia z pieca) · U03", "Zone 1 · R02–R05 (copy from the boiler) · U03") : this.t("Strefa 1 · R04 / R05 (T-/T+) · U03 (D+/D-)", "Zone 1 · R04 / R05 (T-/T+) · U03 (D+/D-)")]
      : ["mdi:snowflake-thermometer", "sky", this.t("Krzywa chłodzenia", "Cooling curve"), this.dominus
          ? this.t("Strefa 1 · R10–R13 (kopia z pieca)", "Zone 1 · R10–R13 (copy from the boiler)") : this.t("Strefa 1 · R13 / R12 (T-/T+)", "Zone 1 · R13 / R12 (T-/T+)")];
    return html`
      <div class="top">
        <div class="tl"><ha-icon icon=${head[0]} style="color:${c(head[1])}"></ha-icon><div><div class="ttl">${head[2]}</div><div class="tsub" style=${act && out ? `color:${c("teal")};opacity:.9` : ""}>${head[3]}</div></div></div>
        <div class="tabs">
          ${this.chipTab("heat", "mdi:fire", this.t("Grzanie", "Heating"), "peach", base, (v) => (this.tab = v))}
          ${this.chipTab("cool", "mdi:snowflake", this.t("Chłodzenie", "Cooling"), "sky", base, (v) => (this.tab = v))}
          ${this.dominus ? nothing : this.chipTab("outing", "mdi:bag-suitcase-outline", this.t("Wyjazd", "Outing"), "teal", out ? "outing" : "", () => (this.out = !out))}</div></div>
      ${out && !this.dominus ? this.outing() : base === "heat" ? this.heat() : this.cool()}`;
  }

  static styles = [HubCard.styles, css`
    .top { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
    .setup { margin-top: 10px; padding: 10px 12px; border-radius: 12px; border: 1px dashed rgba(var(--ih-yellow-rgb), .4); background: rgba(var(--ih-yellow-rgb), .05); }
    .setup .st { font-size: 12.5px; font-weight: 800; color: var(--ih-yellow); }
    .setup .sd { font-size: 11px; opacity: .65; margin: 3px 0 6px; line-height: 1.35; }
    .tl { display: flex; align-items: center; gap: 8px; }
    .tl ha-icon { --mdc-icon-size: 22px; }
    .ttl { font-size: 10.5px; font-weight: 800; opacity: .55; letter-spacing: .08em; text-transform: uppercase; }
    .tsub { font-size: 10.5px; opacity: .55; }
    .tabs, .sub { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
    .sub { margin-top: 8px; }
    .tab { cursor: pointer; display: flex; align-items: center; gap: 5px; padding: 5px 11px; border-radius: 10px; font-size: 11px; font-weight: 800;
      border: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.04); }
    .tab ha-icon { --mdc-icon-size: 15px; }
    .state { cursor: pointer; margin-left: auto; padding: 4px 10px; border-radius: 10px; font-size: 11px; font-weight: 800; }
    .tr { display: flex; gap: 10px; flex-wrap: wrap; font-size: 11.5px; }
    svg { width: 100%; height: auto; display: block; margin-top: 6px; touch-action: pan-y; }
    .ctl { flex: 1 1 210px; display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 14px; }
    .cn { font-size: 12px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .cs { font-size: 10px; opacity: .55; }
    .cvv { width: 44px; text-align: center; font-size: 16px; font-weight: 800; }
    .legend { display: flex; gap: 12px; flex-wrap: wrap; font-size: 10.5px; opacity: .65; margin-top: 8px; }
    .legend i { display: inline-block; width: 14px; height: 3px; vertical-align: middle; margin-right: 4px; }
  `];
}

register("immergas-curve-card", ImmergasCurveCard, "Immergas – Krzywe / Curves",
  "Krzywa grzewcza (R04/R05 + U03), chłodzenia (R13/R12) i trybu wyjazdowego (FSV 5011–5019) w zakładkach, przeciągane punkty");
