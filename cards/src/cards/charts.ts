// "Wykresy / Charts": history of the heat pump in three tabs, drawn natively in SVG (no chart library).
//  - Day   (24 h, recorder history): water temperatures (flow, return, outdoor, DHW cylinder) + a separate compressor
//           Hz chart on the same time axis with DHW periods shaded (one y-axis per chart, never dual-axis).
//  - Week  (7 days, hourly statistics mean): heat output and electrical input (both W, one axis).
//  - Month (30 days, daily statistics change): heat and electricity per day (kWh) + daily COP below.
// Immergas Dominus (no heat-pump data): Day = zone 1 room / target / outdoor with the program phase as background and
// the heating demand as a strip, DHW cylinder / target with the DHW requests shaded; Week / Month = hours per day the
// boiler was asked for heating and for DHW (bars) + the daily mean outdoor temperature (own chart).
// Crosshair tooltip on lines, per-bar tooltip on bars, legend with direct values. Palette: the validated dataviz
// reference steps (light / dark), not the pastel theme colours, so series stay distinguishable for colour-blind readers.
import { svg } from "lit";
import { HubCard, html, css, nothing, register } from "../base";
import { isDhw } from "./timers";
import { Key } from "../names";

type Pt = [number, number]; // [ms, value]
interface Series { key: Key; slot: number; label: string; pts: Pt[]; step?: boolean; unit: string; d?: number; dash?: boolean }
type Band = [number, number];

const SLOTS_DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#9085e9"];
const SLOTS_LIGHT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#6250d6"];
const H = 3600e3, DAY = 24 * H;

class ImmergasChartsCard extends HubCard {
  private tab = "";
  private data: Record<string, any> = {};
  private loading: Record<string, boolean> = {};
  private width = 600;
  private hover: { chart: string; x: number } | null = null;
  private ro?: ResizeObserver;

  getCardSize() { return 7; }
  connectedCallback() {
    super.connectedCallback();
    // measure the card's inner width (ha-card padding 12+14 px) so the SVG uses the whole card
    this.ro = new ResizeObserver((e) => { const w = Math.round(e[0].contentRect.width) - 28; if (w > 100 && Math.abs(w - this.width) > 2) { this.width = w; this.requestUpdate(); } });
    this.ro.observe(this);
  }
  disconnectedCallback() { super.disconnectedCallback(); this.ro?.disconnect(); }

  private get dark() { return !!this.hass?.themes?.darkMode; }
  private col(slot: number) { return (this.dark ? SLOTS_DARK : SLOTS_LIGHT)[slot]; }

  // ---------------- data ----------------
  private async load(tab: string) {
    const fresh = this.data[tab] && Date.now() - this.data[tab].at < 5 * 60e3;
    if (fresh || this.loading[tab] || !this.idx) return;
    this.loading[tab] = true;
    try {
      if (this.dominus) await this.loadDominus(tab);
      else {
      const end = new Date();
      if (tab === "day") {
        const keys: Key[] = ["tw2", "tw1", "outdoor", "tank", "hz", "state"];
        const ids = keys.map((k) => this.eid(k)).filter(Boolean) as string[];
        const r = await this.hass.callWS({ type: "history/history_during_period", start_time: new Date(end.getTime() - DAY).toISOString(),
          end_time: end.toISOString(), entity_ids: ids, minimal_response: true, no_attributes: true, significant_changes_only: false });
        const get = (k: Key): any[] => r[this.eid(k) ?? ""] ?? [];
        const num = (k: Key): Pt[] => get(k).map((x) => [Math.round((x.lu ?? x.last_updated_ts ?? 0) * 1000), parseFloat(x.s ?? x.state)] as Pt).filter((p) => !isNaN(p[1]));
        const bands: [number, number][] = [];
        let open: number | null = null;
        for (const x of get("state")) {
          const t = Math.round((x.lu ?? 0) * 1000), on = isDhw(x.s);
          if (on && open === null) open = t; else if (!on && open !== null) { bands.push([open, t]); open = null; }
        }
        if (open !== null) bands.push([open, end.getTime()]);
        this.data.day = { at: Date.now(), t0: end.getTime() - DAY, t1: end.getTime(), tw2: num("tw2"), tw1: num("tw1"), out: num("outdoor"), tank: num("tank"), hz: num("hz"), bands };
      } else {
        const week = tab === "week";
        const keys: Key[] = week ? ["heat_power", "elec_power"] : ["heat_total", "elec_total"];
        const ids = keys.map((k) => this.eid(k)).filter(Boolean) as string[];
        const t0 = week ? end.getTime() - 7 * DAY : new Date(end.getFullYear(), end.getMonth(), end.getDate() - 29).getTime();
        const r = await this.hass.callWS({ type: "recorder/statistics_during_period", start_time: new Date(t0).toISOString(), end_time: end.toISOString(),
          statistic_ids: ids, period: week ? "hour" : "day", types: week ? ["mean"] : ["change"], units: {} });
        const get = (k: Key): Pt[] => (r[this.eid(k) ?? ""] ?? []).map((x: any) => [typeof x.start === "number" ? x.start : Date.parse(x.start), week ? x.mean : x.change] as Pt)
          .filter((p: Pt) => p[1] !== null && !isNaN(p[1]));
        this.data[tab] = week ? { at: Date.now(), t0, t1: end.getTime(), heat: get("heat_power"), elec: get("elec_power") }
          : { at: Date.now(), t0, t1: end.getTime(), heat: get("heat_total"), elec: get("elec_total") };
      }
      }
    } catch (e) {
      this.data[tab] = { at: Date.now(), error: String((e as any)?.message ?? e) };
    }
    this.loading[tab] = false;
    this.requestUpdate();
  }

  /** Dominus: recorder history of its entities (state changes, no long-term statistics needed) */
  private async loadDominus(tab: string) {
    const end = new Date(), t1 = end.getTime();
    const start = new Date(t1); start.setHours(0, 0, 0, 0);
    const t0 = tab === "day" ? t1 - DAY : start.getTime() - (tab === "week" ? 6 : 29) * DAY;
    const ot = this.ot;
    // OpenTherm: no zone - the boiler flow / return and the CH (flow) setpoint take the zone line
    const keys: Key[] = tab === "day" ? (ot ? ["ot_flow", "ot_ret", "ot_ch_set", "outdoor", "tank", "dhw_set", "dom_ch_demand", "dom_dhw_request", "ot_flame", "ot_mod", "ot_exhaust"]
      : ["zone1", "zone1_set", "outdoor", "tank", "dhw_set", "zone1_phase", "dom_ch_demand", "dom_dhw_request"])
      : ot ? ["outdoor", "dom_ch_demand", "dom_dhw_request", "ot_flame"] : ["outdoor", "dom_ch_demand", "dom_dhw_request"];
    const ids = keys.map((k) => this.eid(k)).filter(Boolean) as string[];
    const r = await this.hass.callWS({ type: "history/history_during_period", start_time: new Date(t0).toISOString(), end_time: end.toISOString(),
      entity_ids: ids, minimal_response: true, no_attributes: true, significant_changes_only: false });
    const get = (k: Key): any[] => r[this.eid(k) ?? ""] ?? [];
    const ts = (x: any) => Math.round((x.lu ?? x.last_updated_ts ?? 0) * 1000);
    const num = (k: Key): Pt[] => get(k).map((x) => [ts(x), parseFloat(x.s ?? x.state)] as Pt).filter((p) => !isNaN(p[1]));
    const bands = (k: Key, on: (v: string) => boolean): Band[] => {
      const out: Band[] = [];
      let open: number | null = null;
      for (const x of get(k)) {
        const t = ts(x), v = on(String(x.s ?? x.state));
        if (v && open === null) open = t; else if (!v && open !== null) { out.push([open, t]); open = null; }
      }
      if (open !== null) out.push([open, t1]);
      return out;
    };
    const isOn = (v: string) => v === "on";
    if (tab === "day") {
      this.data.day = { at: Date.now(), t0, t1, room: num(ot ? "ot_flow" : "zone1"), set: num(ot ? "ot_ch_set" : "zone1_set"), ret: ot ? num("ot_ret") : [],
        out: num("outdoor"), tank: num("tank"), dset: num("dhw_set"),
        comfort: bands("zone1_phase", (v) => v === "comfort"), eco: bands("zone1_phase", (v) => v === "economy"),
        ch: bands(ot ? "ot_flame" : "dom_ch_demand", isOn), dhw: bands("dom_dhw_request", isOn),
        mod: ot ? num("ot_mod") : [], exh: ot ? num("ot_exhaust") : [] };
      return;
    }
    const days: number[] = [];
    for (let t = t0; t < t1; t += DAY) { const x = new Date(t + H); x.setHours(0, 0, 0, 0); days.push(x.getTime()); }
    // hours "on" per calendar day (a band crossing midnight is split)
    const perDay = (bs: Band[]) => days.map((d) => {
      const e = d + DAY;
      return bs.reduce((acc, [a, b]) => acc + Math.max(0, Math.min(b, e) - Math.max(a, d)), 0) / H;
    });
    // time-weighted daily mean of the outdoor temperature
    const out = num("outdoor"), outMean: Pt[] = [];
    for (const d of days) {
      const e = Math.min(d + DAY, t1);
      let sum = 0, dur = 0;
      out.forEach((p, i) => {
        const a = Math.max(p[0], d), b = Math.min(out[i + 1]?.[0] ?? t1, e);
        if (b > a) { sum += p[1] * (b - a); dur += b - a; }
      });
      if (dur > H) outMean.push([d + DAY / 2, sum / dur]);
    }
    this.data[tab] = { at: Date.now(), t0, t1, days, ch: perDay(bands("dom_ch_demand", isOn)), dhw: perDay(bands("dom_dhw_request", isOn)), out: outMean,
      flame: ot ? perDay(bands("ot_flame", isOn)) : null };
  }

  // ---------------- scales & helpers ----------------
  private niceMax(v: number, step: number) { return Math.max(step, Math.ceil(v / step) * step); }
  private ticks(lo: number, hi: number, n = 5) {
    const raw = (hi - lo) / n, mag = Math.pow(10, Math.floor(Math.log10(raw || 1))), step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
    const out: number[] = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
    return { out, lo: Math.floor(lo / step) * step, hi: Math.ceil(hi / step) * step };
  }
  private timeLabel(ms: number, withDay = false) {
    const d = new Date(ms);
    return withDay ? d.toLocaleDateString(this.loc, { weekday: "short", day: "numeric" })
      : d.toLocaleTimeString(this.loc, { hour: "2-digit", minute: "2-digit" });
  }
  private at(pts: Pt[], t: number) { // last value at or before t
    let lo = 0, hi = pts.length - 1, best = -1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (pts[m][0] <= t) { best = m; lo = m + 1; } else hi = m - 1; }
    return best >= 0 ? pts[best][1] : NaN;
  }

  /** line chart (one y-axis) with crosshair tooltip */
  private lineChart(id: string, series: Series[], t0: number, t1: number, h: number, opt: { zero?: boolean; area?: boolean; bands?: [number, number][]; bandLabel?: string; xDays?: boolean; minSpan?: number;
      bandSets?: { bands: Band[]; color: string }[]; strips?: { bands: Band[]; color: string }[] } = {}) {
    const W = this.width, L = 34, R = 4, T = 10, B = 22, iw = Math.max(50, W - L - R), ih = h - T - B;
    const all = series.flatMap((s) => s.pts.filter((p) => p[0] >= t0).map((p) => p[1]));
    if (!all.length) return html`<div class="empty2">${this.t("Brak danych w historii", "No history data")}</div>`;
    let lo = opt.zero ? 0 : Math.min(...all), hi = Math.max(...all);
    if (hi - lo < (opt.minSpan ?? 5)) { const m = (hi + lo) / 2; lo = opt.zero ? 0 : m - (opt.minSpan ?? 5) / 2; hi = lo + (opt.minSpan ?? 5); }
    const tk = this.ticks(lo, hi); lo = tk.lo; hi = tk.hi;
    const x = (t: number) => L + (t - t0) / (t1 - t0) * iw, y = (v: number) => T + ih - (v - lo) / (hi - lo || 1) * ih;
    const path = (s: Series) => {
      const pts = s.pts.filter((p) => p[0] >= t0 - H);
      if (!pts.length) return "";
      let d = "";
      pts.forEach((p, i) => {
        const px = Math.max(L, x(p[0])), py = y(p[1]);
        if (i === 0) d += `M ${px.toFixed(1)} ${py.toFixed(1)}`;
        else d += s.step ? ` H ${px.toFixed(1)} V ${py.toFixed(1)}` : ` L ${px.toFixed(1)} ${py.toFixed(1)}`;
      });
      const last = pts[pts.length - 1];
      d += s.step ? ` H ${x(t1).toFixed(1)}` : ` L ${x(Math.max(last[0], t1)).toFixed(1)} ${y(last[1]).toFixed(1)}`;
      return d;
    };
    const xt: number[] = [];
    if (opt.xDays) { const d0 = new Date(t0); d0.setHours(24, 0, 0, 0); for (let t = d0.getTime(); t < t1; t += DAY) xt.push(t); }
    else { const step = 4 * H, s0 = Math.ceil(t0 / step) * step; for (let t = s0; t < t1; t += step) xt.push(t); }
    const hv = this.hover?.chart === id ? this.hover.x : null, ht = hv === null ? null : t0 + (hv - L) / iw * (t1 - t0);
    const onMove = (e: PointerEvent) => {
      const r = (e.currentTarget as SVGElement).getBoundingClientRect(), px = (e.clientX - r.left) / r.width * W;
      this.hover = px >= L && px <= L + iw ? { chart: id, x: px } : null; this.requestUpdate();
    };
    return html`<div class="chart">
      <svg viewBox="0 0 ${W} ${h}" width=${W} height=${h} @pointermove=${onMove} @pointerleave=${() => { this.hover = null; this.requestUpdate(); }}>
        ${(opt.bands ?? []).map(([a, b]) => svg`<rect x=${x(Math.max(a, t0))} y=${T} width=${Math.max(1, x(Math.min(b, t1)) - x(Math.max(a, t0)))} height=${ih} fill=${this.col(3)} fill-opacity=".16"/>`)}
        ${(opt.bandSets ?? []).map((bs) => bs.bands.filter(([, b]) => b > t0).map(([a, b]) => svg`<rect x=${x(Math.max(a, t0))} y=${T} width=${Math.max(1, x(Math.min(b, t1)) - x(Math.max(a, t0)))} height=${ih} fill=${bs.color} fill-opacity=".13"/>`))}
        ${(opt.strips ?? []).map((st) => st.bands.filter(([, b]) => b > t0).map(([a, b]) => svg`<rect x=${x(Math.max(a, t0))} y=${T + ih - 5} width=${Math.max(1.5, x(Math.min(b, t1)) - x(Math.max(a, t0)))} height="5" rx="1.5" fill=${st.color}/>`))}
        ${tk.out.map((v) => svg`<line x1=${L} x2=${L + iw} y1=${y(v)} y2=${y(v)} class="grid"/><text x=${L - 6} y=${y(v) + 3} class="ax" text-anchor="end">${this.f(v, 1)}</text>`)}
        ${xt.map((t) => svg`<text x=${x(t)} y=${h - 6} class="ax" text-anchor="middle">${this.timeLabel(t, opt.xDays)}</text>`)}
        ${series.map((s) => opt.area ? svg`<path d="${path(s)} V ${y(lo)} H ${L} Z" fill=${this.col(s.slot)} fill-opacity=".14" stroke="none"/>` : nothing)}
        ${series.map((s) => svg`<path d=${path(s)} fill="none" stroke=${this.col(s.slot)} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray=${s.dash ? "5 4" : "none"}/>`)}
        ${ht !== null ? svg`<line x1=${hv} x2=${hv} y1=${T} y2=${T + ih} class="cross"/>
          ${series.map((s) => { const v = this.at(s.pts, ht); return isNaN(v) ? nothing : svg`<circle cx=${hv} cy=${y(v)} r="4.5" fill=${this.col(s.slot)} class="dot"/>`; })}` : nothing}
      </svg>
      ${ht !== null ? html`<div class="tip" style="left:${Math.min(Math.max(0, hv! / W * 100), 100)}%;transform:translateX(${hv! > W * 0.6 ? "-105%" : "8px"})">
        <div class="tt">${new Date(ht).toLocaleString(this.loc, { weekday: "short", hour: "2-digit", minute: "2-digit" })}</div>
        ${series.map((s) => html`<div class="tr2"><i style="background:${this.col(s.slot)}"></i>${s.label}<b>${this.f(this.at(s.pts, ht), s.d ?? 1)} ${s.unit}</b></div>`)}</div>` : nothing}
    </div>`;
  }

  /** grouped bar chart per day with per-group tooltip */
  private barChart(id: string, groups: { t: number; vals: number[] }[], series: { slot: number; label: string; unit: string; d: number }[], h: number, oneDp = false) {
    const W = this.width, L = 34, R = 4, T = 10, B = 22, iw = Math.max(50, W - L - R), ih = h - T - B;
    const all = groups.flatMap((g) => g.vals.filter((v) => !isNaN(v)));
    if (!all.length) return html`<div class="empty2">${this.t("Brak statystyk", "No statistics")}</div>`;
    const tk = this.ticks(0, Math.max(...all)), hi = tk.hi || 1;
    const gw = iw / groups.length, n = series.length, bw = Math.max(2, Math.min(16, (gw - 4) / n - 2));
    const y = (v: number) => T + ih - v / hi * ih;
    const hv = this.hover?.chart === id ? Math.floor((this.hover.x - L) / gw) : -1;
    const onMove = (e: PointerEvent) => {
      const r = (e.currentTarget as SVGElement).getBoundingClientRect(), px = (e.clientX - r.left) / r.width * W;
      this.hover = px >= L && px <= L + iw ? { chart: id, x: px } : null; this.requestUpdate();
    };
    const bar = (cx: number, v: number, colr: string) => {
      if (isNaN(v) || v <= 0) return nothing;
      const top = y(v), hh = T + ih - top, r = Math.min(4, bw / 2, hh);
      return svg`<path d="M ${cx} ${T + ih} V ${top + r} q 0 ${-r} ${r} ${-r} H ${cx + bw - r} q ${r} 0 ${r} ${r} V ${T + ih} Z" fill=${colr}/>`;
    };
    const g = groups[hv];
    return html`<div class="chart">
      <svg viewBox="0 0 ${W} ${h}" width=${W} height=${h} @pointermove=${onMove} @pointerleave=${() => { this.hover = null; this.requestUpdate(); }}>
        ${tk.out.map((v) => svg`<line x1=${L} x2=${L + iw} y1=${y(v)} y2=${y(v)} class="grid"/><text x=${L - 6} y=${y(v) + 3} class="ax" text-anchor="end">${this.f(v, oneDp ? 1 : 0)}</text>`)}
        ${hv >= 0 && g ? svg`<rect x=${L + hv * gw} y=${T} width=${gw} height=${ih} class="band"/>` : nothing}
        ${groups.map((gr, i) => {
          const x0 = L + i * gw + (gw - (n * (bw + 2) - 2)) / 2;
          return svg`${gr.vals.map((v, j) => bar(x0 + j * (bw + 2), v, this.col(series[j].slot)))}
            ${i % Math.max(1, Math.ceil(groups.length / 8)) === 0 ? svg`<text x=${L + i * gw + gw / 2} y=${h - 6} class="ax" text-anchor="middle">${new Date(gr.t).getDate()}.${new Date(gr.t).getMonth() + 1}</text>` : nothing}`;
        })}
      </svg>
      ${g ? html`<div class="tip" style="left:${(L + hv * gw + gw / 2) / W * 100}%;transform:translateX(${hv > groups.length * 0.6 ? "-105%" : "8px"})">
        <div class="tt">${new Date(g.t).toLocaleDateString(this.loc, { weekday: "short", day: "numeric", month: "short" })}</div>
        ${series.map((s, j) => html`<div class="tr2"><i style="background:${this.col(s.slot)}"></i>${s.label}<b>${this.f(g.vals[j], s.d, s.d)} ${s.unit}</b></div>`)}</div>` : nothing}
    </div>`;
  }

  private legend(items: { slot: number; label: string; value?: string }[], band?: string, swatches: { color: string; label: string; op?: number }[] = []) {
    return html`<div class="lg">${items.map((i) => html`<span><i style="background:${this.col(i.slot)}"></i>${i.label}${i.value ? html` <b>${i.value}</b>` : nothing}</span>`)}
      ${band ? html`<span><i class="bandsw" style="background:${this.col(3)};opacity:.4"></i>${band}</span>` : nothing}
      ${swatches.map((w) => html`<span><i class="bandsw" style="background:${w.color};opacity:${w.op ?? 0.4}"></i>${w.label}</span>`)}</div>`;
  }

  // ---------------- tabs ----------------
  private day() {
    const d = this.data.day;
    if (!d) return html`<div class="empty2">${this.t("Wczytuję historię…", "Loading history…")}</div>`;
    if (d.error) return html`<div class="empty2">${d.error}</div>`;
    const temps: Series[] = [
      { key: "tw1", slot: 0, label: this.t("Powrót TW1", "Return TW1"), pts: d.tw1, unit: "°C" },
      { key: "tw2", slot: 1, label: this.t("Zasilanie TW2", "Flow TW2"), pts: d.tw2, unit: "°C" },
      { key: "outdoor", slot: 2, label: this.t("Na zewnątrz", "Outdoor"), pts: d.out, unit: "°C" },
      { key: "tank", slot: 3, label: this.t("Zasobnik CWU", "DHW cylinder"), pts: d.tank, unit: "°C" }];
    const hz: Series[] = [{ key: "hz", slot: 4, label: this.t("Sprężarka", "Compressor"), pts: d.hz, step: true, unit: "Hz", d: 0 }];
    const now = (k: Key, dd = 1, u = "°C") => this.f(this.n(k), dd) + " " + u;
    const runH = d.hz.reduce((acc: number, p: Pt, i: number, arr: Pt[]) => acc + (p[1] > 0 ? ((arr[i + 1]?.[0] ?? d.t1) - p[0]) : 0), 0) / H;
    return html`
      <div class="sub">${this.t("Temperatury wody i zasobnika", "Water and cylinder temperatures")} · °C</div>
      ${this.lineChart("temps", temps, d.t0, d.t1, 190, {})}
      ${this.legend([{ slot: 1, label: this.t("Zasilanie TW2", "Flow TW2"), value: now("tw2") }, { slot: 0, label: this.t("Powrót TW1", "Return TW1"), value: now("tw1") },
        { slot: 3, label: this.t("Zasobnik CWU", "DHW cylinder"), value: now("tank") }, { slot: 2, label: this.t("Na zewnątrz", "Outdoor"), value: now("outdoor") }])}
      <div class="sub">${this.t("Częstotliwość sprężarki", "Compressor frequency")} · Hz · ${this.t("praca", "running")} ${this.f(runH, 1)} h · ${this.t("starty dziś", "starts today")} ${this.f(this.n("starts"), 0)}</div>
      ${this.lineChart("hz", hz, d.t0, d.t1, 110, { zero: true, area: true, bands: d.bands, minSpan: 30 })}
      ${this.legend([], this.t("grzanie CWU", "DHW heating"))}`;
  }

  private week() {
    const d = this.data.week;
    if (!d) return html`<div class="empty2">${this.t("Wczytuję statystyki…", "Loading statistics…")}</div>`;
    if (d.error) return html`<div class="empty2">${d.error}</div>`;
    const s: Series[] = [
      { key: "elec_power", slot: 0, label: this.t("Pobór prądu", "Electrical input"), pts: d.elec, unit: "W", d: 0 },
      { key: "heat_power", slot: 1, label: this.t("Moc cieplna", "Heat output"), pts: d.heat, unit: "W", d: 0 }];
    const avg = (p: Pt[]) => p.length ? p.reduce((a, b) => a + b[1], 0) / p.length : NaN;
    return html`
      <div class="sub">${this.t("Średnia godzinowa, 7 dni", "Hourly mean, 7 days")} · W</div>
      ${this.lineChart("week", s, d.t0, d.t1, 240, { zero: true, area: true, xDays: true, minSpan: 500 })}
      ${this.legend([{ slot: 1, label: this.t("Moc cieplna", "Heat output"), value: this.t("śr. ", "avg ") + this.f(avg(d.heat), 0) + " W" },
        { slot: 0, label: this.t("Pobór prądu", "Electrical input"), value: this.t("śr. ", "avg ") + this.f(avg(d.elec), 0) + " W" }])}`;
  }

  private month() {
    const d = this.data.month;
    if (!d) return html`<div class="empty2">${this.t("Wczytuję statystyki…", "Loading statistics…")}</div>`;
    if (d.error) return html`<div class="empty2">${d.error}</div>`;
    const days: number[] = [];
    for (let t = d.t0; t <= d.t1; t += DAY) { const x = new Date(t); x.setHours(0, 0, 0, 0); if (!days.includes(x.getTime())) days.push(x.getTime()); }
    const byDay = (p: Pt[]) => { const m = new Map<number, number>(); for (const [t, v] of p) { const x = new Date(t); x.setHours(0, 0, 0, 0); m.set(x.getTime(), (m.get(x.getTime()) ?? 0) + v); } return m; };
    const he = byDay(d.heat), el = byDay(d.elec);
    const groups = days.map((t) => ({ t, vals: [el.get(t) ?? NaN, he.get(t) ?? NaN] }));
    const cop = days.map((t) => { const e = el.get(t) ?? NaN, q = he.get(t) ?? NaN; return { t, vals: [e > 0.2 && q > 0 ? q / e : NaN] }; });
    const sum = (m: Map<number, number>) => [...m.values()].reduce((a, b) => a + b, 0);
    const se = sum(el), sh = sum(he);
    return html`
      <div class="sub">${this.t("Energia dziennie, 30 dni", "Energy per day, 30 days")} · kWh</div>
      ${this.barChart("month", groups, [{ slot: 0, label: this.t("Prąd", "Electricity"), unit: "kWh", d: 2 }, { slot: 1, label: this.t("Ciepło", "Heat"), unit: "kWh", d: 2 }], 210, true)}
      ${this.legend([{ slot: 0, label: this.t("Prąd", "Electricity"), value: this.f(se, 1, 1) + " kWh" }, { slot: 1, label: this.t("Ciepło", "Heat"), value: this.f(sh, 1, 1) + " kWh" }])}
      <div class="sub">${this.t("COP dzienny", "Daily COP")} · ${this.t("30 dni", "30 days")} ${se > 0 ? this.f(sh / se, 2, 2) : "–"}</div>
      ${this.barChart("cop", cop, [{ slot: 2, label: "COP", unit: "", d: 2 }], 110, true)}`;
  }

  // ---------------- Dominus ----------------
  private domDay() {
    const d = this.data.day;
    if (!d) return html`<div class="empty2">${this.t("Wczytuję historię…", "Loading history…")}</div>`;
    if (d.error) return html`<div class="empty2">${d.error}</div>`;
    const ot = this.ot;
    const zone: Series[] = ot ? [
      { key: "outdoor", slot: 2, label: this.t("Na zewnątrz", "Outdoor"), pts: d.out, unit: "°C" },
      { key: "ot_ch_set", slot: 0, label: this.t("Nastawa CO", "CH setpoint"), pts: d.set, step: true, unit: "°C", d: 0, dash: true },
      { key: "ot_ret", slot: 4, label: this.t("Powrót", "Return"), pts: d.ret ?? [], unit: "°C" },
      ...(d.exh?.length ? [{ key: "ot_exhaust" as Key, slot: 3, label: this.t("Spaliny", "Exhaust"), pts: d.exh, unit: "°C" }] : []),
      { key: "ot_flow", slot: 1, label: this.t("Zasilanie", "Flow"), pts: d.room, unit: "°C" }] : [
      { key: "outdoor", slot: 2, label: this.t("Na zewnątrz", "Outdoor"), pts: d.out, unit: "°C" },
      { key: "zone1_set", slot: 0, label: this.t("Zadana", "Target"), pts: d.set, step: true, unit: "°C", dash: true },
      { key: "zone1", slot: 1, label: this.t("Strefa 1", "Zone 1"), pts: d.room, unit: "°C" }];
    const dhw: Series[] = [
      { key: "dhw_set", slot: 4, label: this.t("Zadana CWU", "DHW target"), pts: d.dset, step: true, unit: "°C", d: 0, dash: true },
      { key: "tank", slot: 3, label: this.t("Zasobnik CWU", "DHW cylinder"), pts: d.tank, unit: "°C" }];
    const hrs = (bs: Band[]) => bs.reduce((a, [x, y]) => a + Math.max(0, y - Math.max(x, d.t0)), 0) / H;
    const now = (k: Key, dd = 1) => this.f(this.n(k), dd) + " °C";
    return html`
      ${ot ? html`<div class="sub">${this.t("Kocioł", "Boiler")} · °C · ${this.t("płomień", "flame")} ${this.f(hrs(d.ch), 1)} h</div>
      ${this.lineChart("zone", zone, d.t0, d.t1, 190, { minSpan: 10, strips: [{ bands: d.ch, color: this.col(1) }] })}
      ${this.legend([{ slot: 1, label: this.t("Zasilanie", "Flow"), value: now("ot_flow") }, { slot: 4, label: this.t("Powrót", "Return"), value: now("ot_ret") },
        { slot: 0, label: this.t("Nastawa CO", "CH setpoint"), value: now("ot_ch_set", 0) }, { slot: 2, label: this.t("Na zewnątrz", "Outdoor"), value: now("outdoor") },
        ...(d.exh?.length ? [{ slot: 3, label: this.t("Spaliny", "Exhaust"), value: now("ot_exhaust") }] : [])], undefined,
        [{ color: this.col(1), label: this.t("płomień", "flame"), op: 1 }])}
      ${d.mod?.length ? html`<div class="sub">${this.t("Modulacja palnika", "Burner modulation")} · % · ${d.ch.length} ${this.t("zapłonów", "ignitions")}</div>
      ${this.lineChart("mod", [{ key: "ot_mod", slot: 1, label: this.t("Modulacja", "Modulation"), pts: d.mod, step: true, unit: "%", d: 0 }], d.t0, d.t1, 110,
        { minSpan: 20, strips: [{ bands: d.ch, color: this.col(1) }] })}` : nothing}`
      : html`<div class="sub">${this.t("Strefa 1", "Zone 1")} · °C · ${this.t("żądanie grzania", "heating demand")} ${this.f(hrs(d.ch), 1)} h</div>
      ${this.lineChart("zone", zone, d.t0, d.t1, 190, { minSpan: 6,
        bandSets: [{ bands: d.comfort, color: this.col(3) }, { bands: d.eco, color: this.col(0) }], strips: [{ bands: d.ch, color: this.col(1) }] })}
      ${this.legend([{ slot: 1, label: this.t("Strefa 1", "Zone 1"), value: now("zone1") }, { slot: 0, label: this.t("Zadana", "Target"), value: now("zone1_set") },
        { slot: 2, label: this.t("Na zewnątrz", "Outdoor"), value: now("outdoor") }], undefined,
        [{ color: this.col(3), label: this.t("faza Komfort", "Comfort phase"), op: 0.3 }, { color: this.col(0), label: this.t("faza Eko", "Eco phase"), op: 0.3 },
          { color: this.col(1), label: this.t("żądanie grzania", "heating demand"), op: 1 }])}`}
      <div class="sub">${this.t("Ciepła woda", "Hot water")} · °C · ${this.t("żądanie CWU", "DHW request")} ${this.f(hrs(d.dhw), 1)} h · ${d.dhw.length} ${this.t("cykli", "cycles")}</div>
      ${this.lineChart("dhw", dhw, d.t0, d.t1, 140, { minSpan: 10, bands: d.dhw })}
      ${this.legend([{ slot: 3, label: this.t("Zasobnik CWU", "DHW cylinder"), value: now("tank") }, { slot: 4, label: this.t("Zadana CWU", "DHW target"), value: now("dhw_set", 0) }],
        this.t("żądanie CWU", "DHW request"))}`;
  }

  private domDays(tab: string) {
    const d = this.data[tab];
    if (!d) return html`<div class="empty2">${this.t("Wczytuję historię…", "Loading history…")}</div>`;
    if (d.error) return html`<div class="empty2">${d.error}</div>`;
    const fl: number[] | null = d.flame;
    const groups = d.days.map((t: number, i: number) => ({ t, vals: fl ? [d.ch[i], d.dhw[i], fl[i]] : [d.ch[i], d.dhw[i]] }));
    const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
    const outS: Series[] = [{ key: "outdoor", slot: 2, label: this.t("Na zewnątrz", "Outdoor"), pts: d.out, unit: "°C" }];
    return html`
      <div class="sub">${this.t("Godziny żądań na dobę", "Demand hours per day")} · h · ${tab === "week" ? this.t("7 dni", "7 days") : this.t("30 dni", "30 days")}</div>
      ${this.barChart(tab, groups, [{ slot: 1, label: this.t("Grzanie CO", "CH heating"), unit: "h", d: 1 }, { slot: 3, label: this.t("CWU", "DHW"), unit: "h", d: 1 },
        ...(fl ? [{ slot: 0, label: this.t("Palnik", "Burner"), unit: "h", d: 1 }] : [])], 200, true)}
      ${this.legend([{ slot: 1, label: this.t("Grzanie CO", "CH heating"), value: this.f(sum(d.ch), 1) + " h" }, { slot: 3, label: this.t("CWU", "DHW"), value: this.f(sum(d.dhw), 1) + " h" },
        ...(fl ? [{ slot: 0, label: this.t("Palnik", "Burner"), value: this.f(sum(fl), 1) + " h" }] : [])])}
      <div class="sub">${this.t("Średnia temperatura zewnętrzna na dobę", "Daily mean outdoor temperature")} · °C</div>
      ${this.lineChart(tab + "out", outS, d.t0, d.t1, 110, { xDays: true, minSpan: 6 })}`;
  }

  protected body() {
    const tab = this.tab || this.config.tab || "day";
    this.load(tab);
    const t = (id: string, lbl: string) => html`<div class="tab ${id === tab ? "on" : ""}" @click=${() => { this.tab = id; this.hover = null; this.requestUpdate(); }}>${lbl}</div>`;
    return html`
      <div class="top"><div class="tl"><ha-icon icon="mdi:chart-line"></ha-icon><span class="ttl">${this.t("Wykresy", "Charts")}</span></div>
        <div class="tabs">${t("day", this.t("Doba", "Day"))}${t("week", this.t("Tydzień", "Week"))}${t("month", this.t("Miesiąc", "Month"))}</div></div>
      ${this.dominus ? (tab === "day" ? this.domDay() : this.domDays(tab)) : tab === "day" ? this.day() : tab === "week" ? this.week() : this.month()}`;
  }

  static styles = [HubCard.styles, css`
    .top { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
    .tl { display: flex; align-items: center; gap: 8px; }
    .tl ha-icon { --mdc-icon-size: 18px; opacity: .55; }
    .ttl { font-size: 10.5px; font-weight: 800; opacity: .55; letter-spacing: .08em; text-transform: uppercase; }
    .tabs { display: flex; gap: 4px; }
    .tab { cursor: pointer; padding: 4px 11px; border-radius: 9px; font-size: 11px; font-weight: 800; border: 1px solid rgba(127,127,127,.2); background: rgba(127,127,127,.06); color: var(--secondary-text-color); }
    .tab.on { color: var(--primary-text-color); border-color: rgba(127,127,127,.45); background: rgba(127,127,127,.16); }
    .sub { font-size: 11px; color: var(--secondary-text-color); margin: 10px 0 2px; font-weight: 700; }
    .chart { position: relative; touch-action: pan-y; }
    :host { display: block; }
    .chart svg { display: block; overflow: visible; width: 100%; height: auto; }
    .grid { stroke: var(--divider-color, rgba(127,127,127,.25)); stroke-width: 1; opacity: .6; }
    .ax { fill: var(--secondary-text-color); font-size: 10px; font-variant-numeric: tabular-nums; }
    .band { fill: rgba(127,127,127,.12); }
    .cross { stroke: var(--secondary-text-color); stroke-width: 1; stroke-dasharray: 3 3; }
    .dot { stroke: var(--ha-card-background, var(--card-background-color, #1e1e2e)); stroke-width: 2; }
    .tip { position: absolute; top: 6px; pointer-events: none; min-width: 150px; padding: 7px 9px; border-radius: 10px; font-size: 11px;
      background: var(--ha-card-background, var(--card-background-color, #1e1e2e)); border: 1px solid rgba(127,127,127,.3); box-shadow: 0 4px 14px rgba(0,0,0,.3); z-index: 2; }
    .tt { font-weight: 800; margin-bottom: 4px; color: var(--primary-text-color); }
    .tr2 { display: flex; align-items: center; gap: 6px; color: var(--secondary-text-color); line-height: 1.6; }
    .tr2 b { margin-left: auto; padding-left: 10px; color: var(--primary-text-color); font-variant-numeric: tabular-nums; }
    .tr2 i, .lg i { width: 10px; height: 3px; border-radius: 2px; display: inline-block; flex: none; }
    .lg { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 11px; color: var(--secondary-text-color); margin-top: 4px; }
    .lg span { display: flex; align-items: center; gap: 6px; }
    .lg b { color: var(--primary-text-color); font-variant-numeric: tabular-nums; }
    .bandsw { width: 12px !important; height: 10px !important; background: rgba(127,127,127,.25); }
    .empty2 { padding: 26px 8px; text-align: center; font-size: 12px; color: var(--secondary-text-color); }
  `];
}

register("immergas-charts-card", ImmergasChartsCard, "Immergas – Wykresy / Charts",
  "Wykresy: doba (temperatury wody i zasobnika, Hz sprężarki z okresami CWU), tydzień (moc cieplna i pobór), miesiąc (energia dziennie i COP)");
