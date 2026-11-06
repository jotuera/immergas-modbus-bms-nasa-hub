// "Krzywa pogodowa w hubie / Hub weather curve": the two-point weather curve the hub runs itself - gb_curve (gas boiler
// over Modbus BMS: CH flow setpoint 514 from the boiler's outdoor probe 772) or ot_regulator (OpenTherm master: Data-ID 1
// from the curve + a room correction). Drawn like the Immergas heating curve card: draggable points (up / down = flow,
// left / right = outdoor temperature), -/+ steppers, the boiler's CH min. / max. as bands, now / setpoint / flow marks.
// The entities are found by their names in the gb_ / ot_ packages (any name prefix, PL / EN), no hub device needed.
// Options: family: gb | ot (default: the first one found); entities: {key: entity_id} overrides (keys: on, oc, fc, ow,
// fw, out, set, flow, min, max, target, gain, hyst, room); room_entity (ot: the HA room temperature the regulator uses).
import { svg, SVGTemplateResult } from "lit";
import { HubCard, html, css, nothing, c, ca, box, register } from "../base";
import { findPkg } from "../hubpkg";

type K = "on" | "oc" | "fc" | "ow" | "fw" | "out" | "set" | "flow" | "min" | "max" | "target" | "gain" | "hyst" | "room";
type Fam = "gb" | "ot";
const W = 340, H = 196, x0 = 30, x1 = 332, y0 = 10, y1 = 166;

// entity names of the packages without the prefix, PL + EN (packages/lang/gb_*.yaml, ot_*.yaml)
const COMMON: Partial<Record<K, string[]>> = {
  oc: ["Krzywa: najniższa temp. zewnętrzna", "Curve: coldest outdoor temperature"],
  fc: ["Krzywa: zasilanie przy najniższej", "Curve: flow at the coldest"],
  ow: ["Krzywa: najwyższa temp. zewnętrzna", "Curve: warmest outdoor temperature"],
  fw: ["Krzywa: zasilanie przy najwyższej", "Curve: flow at the warmest"],
  out: ["Temperatura zewnętrzna", "Outdoor temperature"],
  set: ["Nastawa zasilania CO", "CH flow setpoint"],
  flow: ["Temperatura zasilania", "Flow temperature"],
};
const FAM: Record<Fam, Partial<Record<K, string[]>>> = {
  gb: { ...COMMON, on: ["Krzywa pogodowa w hubie", "Weather curve in the hub"],
    max: ["Maks. temperatura CO", "CH max. temperature"], min: ["Min. temperatura CO", "CH min. temperature"] },
  ot: { ...COMMON, on: ["Regulator w hubie", "Regulator in the hub"], max: ["CO maks.", "CH max."], min: ["CO min.", "CH min."],
    target: ["Zadana pokoju", "Room target"], gain: ["Korekta pokojowa (°C zasilania na °C)", "Room correction (°C flow per °C)"],
    hyst: ["Histereza pokoju", "Room hysteresis"] },
};

class ImmergasHubCurveCard extends HubCard {
  private m: Partial<Record<K, string>> = {};
  private fam: Fam = "gb";
  private drag: { k: "c" | "w"; x: number; y: number } | null = null;
  private Y1 = 70;

  /** finds the curve switch of a family, then the other entities with the same name prefix */
  private find(fam: Fam): Partial<Record<K, string>> | null {
    const { on, ...rest } = FAM[fam], r = findPkg<K>(this.hass.states, on!, /^(switch|input_boolean)\./, rest);
    return r ? { ...r.ids, on: r.anchorId } : null;
  }

  private v(k: K) { const id = this.m[k]; return id ? parseFloat(this.hass.states[id]?.state ?? "") : NaN; }
  private a(k: K, at: string, def: number) { const id = this.m[k], x = id ? this.hass.states[id]?.attributes?.[at] : undefined; return x === undefined ? def : +x; }
  private more(k: K) {
    const entityId = this.m[k];
    if (entityId) this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
  }
  private setNum(k: K, value: number) {
    const id = this.m[k];
    if (!id) return;
    const dom = id.split(".")[0];
    this.hass.callService(dom === "input_number" ? "input_number" : "number", "set_value", { entity_id: id, value });
  }
  private get isOn() { const id = this.m.on; return !!id && this.hass.states[id]?.state === "on"; }

  private px(x: number) { return x0 + (Math.min(30, Math.max(-25, x)) + 25) / 55 * (x1 - x0); }
  private py(y: number) { return y1 - (Math.min(this.Y1, Math.max(15, y)) - 15) / (this.Y1 - 15) * (y1 - y0); }

  private grid(): SVGTemplateResult[] {
    const g: SVGTemplateResult[] = [];
    for (let x = -25; x <= 30; x += 5) g.push(svg`<line x1=${this.px(x)} y1=${y0} x2=${this.px(x)} y2=${y1} stroke="currentColor" stroke-opacity=${x === 0 ? 0.18 : 0.07}/>
      <text x=${this.px(x)} y=${y1 + 13} font-size="9" text-anchor="middle" fill="currentColor" fill-opacity=".5">${x}°</text>`);
    for (let y = 15; y <= this.Y1; y += 10) g.push(svg`<line x1=${x0} y1=${this.py(y)} x2=${x1} y2=${this.py(y)} stroke="currentColor" stroke-opacity=".07"/>
      <text x=${x0 - 5} y=${this.py(y) + 3} font-size="9" text-anchor="end" fill="currentColor" fill-opacity=".5">${y}°</text>`);
    return g;
  }
  private hline(v: number, col: string, label: string, band: "above" | "below", right = true) {
    if (isNaN(v) || v < 15 || v > this.Y1) return nothing;
    const y = this.py(v);
    const b = band === "above" ? svg`<rect x=${x0} y=${y0} width=${x1 - x0} height=${Math.max(0, y - y0)} fill=${ca(col, 0.1)}/>`
      : svg`<rect x=${x0} y=${y} width=${x1 - x0} height=${Math.max(0, y1 - y)} fill=${ca(col, 0.08)}/>`;
    return svg`${b}<line x1=${x0} y1=${y} x2=${x1} y2=${y} stroke=${c(col)} stroke-width="1.4" stroke-dasharray="2 3"/>
      <text x=${right ? x1 - 2 : x0 + 4} y=${y - 4} font-size="9" font-weight="700" text-anchor=${right ? "end" : "start"} fill=${c(col)}>${label}</text>`;
  }

  /** pointer -> (outdoor, flow) in the chart, rounded to 1 °C and kept in the entities' ranges */
  private onMove(e: PointerEvent) {
    if (!this.drag) return;
    const r = (e.currentTarget as SVGElement).closest("svg")!.getBoundingClientRect();
    const xx = (e.clientX - r.left) / r.width * W, yy = (e.clientY - r.top) / r.height * H;
    const [kx, ky]: [K, K] = this.drag.k === "c" ? ["oc", "fc"] : ["ow", "fw"];
    const ox = Math.round(-25 + (xx - x0) / (x1 - x0) * 55), fy = Math.round(15 + (y1 - yy) / (y1 - y0) * (this.Y1 - 15));
    this.drag.x = Math.max(this.a(kx, "min", -25), Math.min(this.a(kx, "max", 30), ox));
    this.drag.y = Math.max(this.a(ky, "min", 15), Math.min(this.a(ky, "max", 90), fy));
    this.requestUpdate();
  }
  private handle(k: "c" | "w", x: number, y: number, lbl: string, col: string) {
    const d = this.drag?.k === k ? this.drag : null, cx = d ? d.x : x, cy = d ? d.y : y;
    const [kx, ky]: [K, K] = k === "c" ? ["oc", "fc"] : ["ow", "fw"];
    return svg`<circle cx=${this.px(cx)} cy=${this.py(cy)} r="8" fill=${c(col)} stroke="var(--ha-card-background, #1e1e2e)" stroke-width="3" style="filter:drop-shadow(0 0 6px ${c(col)})"/>
      <circle cx=${this.px(cx)} cy=${this.py(cy)} r="20" fill="transparent" style="cursor:move;touch-action:none"
        @pointerdown=${(e: PointerEvent) => { e.preventDefault(); (e.target as Element).setPointerCapture(e.pointerId); this.drag = { k, x, y }; }}
        @pointermove=${(e: PointerEvent) => this.onMove(e)}
        @pointerup=${() => { const dd = this.drag; this.drag = null;
          if (dd) { if (dd.x !== x) this.setNum(kx, dd.x); if (dd.y !== y) this.setNum(ky, dd.y); } this.requestUpdate(); }}
        @pointercancel=${() => { this.drag = null; this.requestUpdate(); }}/>
      <text x=${this.px(cx)} y=${this.py(cy) - 14} font-size="11" font-weight="800" text-anchor="middle" fill=${c(col)}>${lbl} ${cy}°</text>
      ${d ? svg`<text x=${this.px(cx)} y=${y1 - 4} font-size="9" font-weight="800" text-anchor="middle" fill=${c(col)}>${cx}°</text>` : nothing}`;
  }
  private ctl(k: K, name: string, sub: string, col: string) {
    const v = this.v(k), mn = this.a(k, "min", -100), mx = this.a(k, "max", 100), step = this.a(k, "step", 1);
    if (!this.m[k]) return nothing;
    const st = (d: number, icon: string) => {
      const nv = Math.round(Math.max(mn, Math.min(mx, v + d)) * 100) / 100, dis = isNaN(v) || nv === v;
      return html`<div class="btn ${dis ? "off" : ""}" @click=${() => !dis && this.setNum(k, nv)}><ha-icon icon=${icon}></ha-icon></div>`;
    };
    const u = String(this.hass.states[this.m[k]!]?.attributes?.unit_of_measurement ?? "");
    return html`<div class="ctl" style="background:${ca(col, 0.07)};border:1px solid ${ca(col, 0.25)}">
      <div class="cx" @click=${() => this.more(k)} style="cursor:pointer"><div class="cn">${name}</div><div class="cs">${sub}</div></div>
      ${st(-step, "mdi:minus")}<div class="cvv" style="color:${c(col)}">${isNaN(v) ? "–" : this.f(v) + (u === "°C" ? "°" : "")}</div>${st(step, "mdi:plus")}</div>`;
  }

  protected body() {
    const on = this.isOn, col = on ? "peach" : "overlay2", ot = this.fam === "ot";
    const oc = this.v("oc"), fc = this.v("fc"), ow = this.v("ow"), fw = this.v("fw");
    const out = this.v("out"), set = this.v("set"), flow = this.v("flow"), lo = this.v("min"), hi = this.v("max");
    const roomE = this.m.room ?? this.config.room_entity, room = roomE ? parseFloat(this.hass.states[roomE]?.state ?? "") : NaN;
    const target = this.v("target"), gain = this.v("gain");
    const clamp = (f: number) => Math.max(isNaN(lo) ? 20 : lo, Math.min(isNaN(hi) ? 85 : hi, f));
    // drawn with the dragged values, so the line follows the finger
    const d = this.drag, pc = d?.k === "c" ? [d.x, d.y] : [oc, fc], pw = d?.k === "w" ? [d.x, d.y] : [ow, fw];
    const cur = (x: number) => { const t = pw[0] > pc[0] ? Math.max(0, Math.min(1, (x - pc[0]) / (pw[0] - pc[0]))) : 0; return pc[1] + (pw[1] - pc[1]) * t; };
    const corr = ot && !isNaN(room) && !isNaN(target) && !isNaN(gain) && gain > 0 ? gain * (target - room) : 0;
    const tgt = isNaN(out) || isNaN(fc) ? NaN : Math.round(clamp(cur(out) + corr) * 2) / 2;
    // the axis fits the curve and the marks; the boiler's max. only when it is close (an 85 °C limit would flatten the curve)
    const top = Math.max(pc[1] || 0, pw[1] || 0, isNaN(flow) ? 0 : flow, isNaN(set) ? 0 : set, isNaN(tgt) ? 0 : tgt);
    this.Y1 = Math.min(90, Math.max(50, Math.ceil((Math.max(top + 5, !isNaN(hi) && hi <= top + 10 ? hi + 3 : 0)) / 10) * 10));
    const g: unknown[] = [this.grid()];
    g.push(this.hline(hi, "red", this.t("maks. CO ", "CH max. ") + this.f(hi) + "°", "above"));
    g.push(this.hline(lo, "sky", this.t("min. CO ", "CH min. ") + this.f(lo) + "°", "below"));
    if (!isNaN(pc[1]) && !isNaN(pw[1])) {
      const dd = `M ${this.px(-25)} ${this.py(pc[1])} L ${this.px(pc[0])} ${this.py(pc[1])} L ${this.px(pw[0])} ${this.py(pw[1])} L ${this.px(30)} ${this.py(pw[1])}`;
      g.push(svg`<path d="${dd} L ${this.px(30)} ${y1} L ${this.px(-25)} ${y1} Z" fill=${ca(col, on ? 0.1 : 0.05)}/>
        <path d=${dd} fill="none" stroke=${c(col)} stroke-width="3" stroke-linejoin="round" stroke-opacity=${on ? 1 : 0.6}
          style=${on ? `filter:drop-shadow(0 0 4px ${ca(col, 0.7)})` : ""}/>`);
      if (corr) {
        const pts: string[] = [];
        for (let x = -25; x <= 30; x += 0.5) pts.push(`${this.px(x).toFixed(1)},${this.py(clamp(cur(x) + corr)).toFixed(1)}`);
        g.push(svg`<polyline points=${pts.join(" ")} fill="none" stroke=${c("yellow")} stroke-width="1.8" stroke-dasharray="6 3" stroke-linejoin="round"/>`);
      }
      g.push(this.handle("c", oc, fc, this.t("mróz", "cold"), col), this.handle("w", ow, fw, this.t("ciepło", "warm"), col));
    }
    if (!isNaN(out) && out >= -25 && out <= 30) {
      const x = this.px(out);
      g.push(svg`<line x1=${x} y1=${y0} x2=${x} y2=${y1} stroke=${c("sky")} stroke-dasharray="3 3" stroke-opacity=".8"/>`);
      if (!isNaN(tgt) && !isNaN(set) && Math.abs(tgt - set) >= 0.5) g.push(svg`<circle cx=${x} cy=${this.py(tgt)} r="4" fill="none" stroke=${c("yellow")} stroke-width="1.5" stroke-dasharray="2 2"/>`);
      if (!isNaN(set) || !isNaN(tgt)) g.push(svg`<circle cx=${x} cy=${this.py(isNaN(set) ? tgt : set)} r="4.5" fill=${c("yellow")}/>`);
      if (!isNaN(flow)) g.push(svg`<circle cx=${x} cy=${this.py(flow)} r="5" fill="none" stroke=${c("red")} stroke-width="2"/>`);
    }
    let roomTxt: unknown = nothing;
    if (ot && !isNaN(room) && !isNaN(target)) {
      const dr = room - target, hy = isNaN(this.v("hyst")) ? 0.3 : this.v("hyst");
      const [txt, cc] = Math.abs(dr) <= hy ? [this.t("komfort ✓", "comfort ✓"), "green"] : dr > 0 ? [this.t("za ciepło", "too warm"), "peach"] : [this.t("za zimno", "too cold"), "sky"];
      roomTxt = html`<span @click=${() => this.more("target")} style="cursor:pointer">${this.t("pokój", "room")} <b>${this.f(room)}°</b>/${this.f(target)}° <b style="color:${c(cc)}">${txt}</b></span>`;
    }
    const sub = ot ? this.t("Regulator OpenTherm w hubie · nastawa CO (Data-ID 1) co minutę", "OpenTherm regulator in the hub · CH setpoint (Data-ID 1) every minute")
      : this.t("Hub · nastawa zasilania (514) z sondy kotła (772) co minutę", "Hub · CH flow setpoint (514) from the boiler probe (772) every minute");
    return html`
      <div class="top">
        <div class="tl"><ha-icon icon="mdi:chart-bell-curve-cumulative" style="color:${c(col)}"></ha-icon>
          <div><div class="ttl">${this.t("Krzywa pogodowa", "Weather curve")}</div><div class="tsub">${sub}</div></div></div>
        ${this.m.on ? html`<div class="state" style=${box(on ? "peach" : "overlay1", on)} @click=${() => this.hass.callService(this.m.on!.split(".")[0], "toggle", { entity_id: this.m.on })}>
          <ha-icon icon=${on ? "mdi:power" : "mdi:power-off"}></ha-icon>${on ? this.t("Włączona", "On") : this.t("Wyłączona", "Off")}</div>` : nothing}</div>
      <div class="tr" style="margin-top:8px">
        <span @click=${() => this.more("out")} style="cursor:pointer">${this.t("teraz", "now")} <b>${this.f(out)} °C</b></span>${roomTxt}
        <span>${this.t("z krzywej", "from the curve")} <b style="color:${c("yellow")}">${this.f(tgt)} °C</b></span>
        <span @click=${() => this.more("set")} style="cursor:pointer">${this.t("nastawa", "setpoint")} <b style="color:${c("yellow")}">${this.f(set)} °C</b></span>
        <span @click=${() => this.more("flow")} style="cursor:pointer">${this.t("zasilanie", "flow")} <b style="color:${c("red")}">${this.f(flow)} °C</b></span></div>
      <svg viewBox="0 0 ${W} ${H}">${g}</svg>
      <div class="row">
        ${this.ctl("fc", this.t("Zasilanie przy mrozie", "Flow when cold"), this.t(`przy ${this.f(oc)} °C i zimniej`, `at ${this.f(oc)} °C and colder`), col)}
        ${this.ctl("fw", this.t("Zasilanie przy cieple", "Flow when warm"), this.t(`przy ${this.f(ow)} °C i cieplej`, `at ${this.f(ow)} °C and warmer`), col)}
        ${this.ctl("oc", this.t("Punkt mrozu", "Cold point"), this.t("temp. zewn. maks. zasilania", "outdoor temp. of the max. flow"), "sky")}
        ${this.ctl("ow", this.t("Punkt ciepła", "Warm point"), this.t("temp. zewn. min. zasilania", "outdoor temp. of the min. flow"), "sky")}
        ${ot ? this.ctl("target", this.t("Zadana pokoju", "Room target"), this.t("korekta i CO wł. / wył.", "correction and CH on / off"), "green") : nothing}
        ${ot ? this.ctl("gain", this.t("Korekta pokojowa", "Room correction"), this.t("°C zasilania na 1 °C błędu", "°C flow per 1 °C error"), "yellow") : nothing}
      </div>
      <div class="legend"><span><i style="background:${c(col)}"></i>${this.t("krzywa hubu", "hub curve")}</span>
        ${corr ? html`<span><i style="border-top:2px dashed ${c("yellow")};height:0"></i>${this.t(`z korektą pokojową ${corr > 0 ? "+" : ""}${this.f(corr)} °C`, `with the room correction ${corr > 0 ? "+" : ""}${this.f(corr)} °C`)}</span>` : nothing}
        <span>${this.t("● nastawa · ○ faktyczne zasilanie", "● setpoint · ○ actual flow")}</span></div>
      <div class="note">${this.t("Przeciągnij punkt (góra / dół = zasilanie, lewo / prawo = temp. zewnętrzna) albo użyj −/+.", "Drag a point (up / down = flow, left / right = outdoor temperature) or use −/+.")}
        ${ot ? this.t(" Regulator dodaje korektę pokojową i włącza / wyłącza CO z histerezą; nastawa zostaje w granicach CO min. / maks. kotła (Data-ID 49).",
          " The regulator adds the room correction and switches CH on / off with a hysteresis; the setpoint stays within the boiler's CH min. / max. (Data-ID 49).")
        : this.t(" Nastawa zostaje w granicach CO min. / maks. kotła. Wyłączona = nastawa zasilania zostaje taka, jak ją ustawisz.",
          " The setpoint stays within the boiler's CH min. / max. Off = the flow setpoint stays as you set it.")}</div>`;
  }

  render() {
    if (!this.hass) return nothing;
    const want = this.config.family as Fam | undefined;
    let m: Partial<Record<K, string>> | null = null;
    for (const f of (want ? [want] : ["gb", "ot"]) as Fam[]) { m = this.find(f); if (m) { this.fam = f; break; } }
    if (!m && want) this.fam = want;
    this.m = { ...(m ?? {}), ...(this.config.entities ?? {}) };
    if (!this.m.fc && !this.m.fw) return html`<ha-card><div class="empty">${this.t("Szukam krzywej pogodowej huba… (pakiet gb_curve albo ot_regulator)",
      "Looking for the hub weather curve… (package gb_curve or ot_regulator)")}</div></ha-card>`;
    return html`<ha-card>${this.body()}</ha-card>`;
  }

  static styles = [HubCard.styles, css`
    .top { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
    .tl { display: flex; align-items: center; gap: 8px; }
    .tl ha-icon { --mdc-icon-size: 22px; }
    .ttl { font-size: 10.5px; font-weight: 800; opacity: .55; letter-spacing: .08em; text-transform: uppercase; }
    .tsub { font-size: 10.5px; opacity: .55; }
    .state { cursor: pointer; display: flex; align-items: center; gap: 5px; padding: 5px 11px; border-radius: 10px; font-size: 11px; font-weight: 800; }
    .state ha-icon { --mdc-icon-size: 15px; }
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

register("immergas-hub-curve-card", ImmergasHubCurveCard, "Immergas – Krzywa pogodowa w hubie / Hub weather curve",
  "Krzywa pogodowa huba (gb_curve – kocioł po Modbus BMS, ot_regulator – OpenTherm): przeciągane punkty, granice CO, nastawa i zasilanie");
