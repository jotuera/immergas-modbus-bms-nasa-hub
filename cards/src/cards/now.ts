// "Teraz / Now": fault and defrost banners, the unit hero (mode, Hz, flow/return, COP) and four tiles.
import { Key } from "../names";
import { HubCard, html, css, nothing, c, ca, box, register } from "../base";
import { Seg, Pt, BAD, segments, typical, median, isIdle, isDhw, isCool, isDefrost, phaseCol, phaseIcon, dur, clock, nextAt, points, dhwPeriods, dhwHeatingNow } from "./timers";

const H = 3600e3, WIN = 6 * H, LEG_T = 60;
const tempCol = (v: number) => isNaN(v) ? "overlay1" : v < 0 ? "sapphire" : v < 10 ? "sky" : v < 18 ? "teal" : v < 24 ? "green" : v < 28 ? "yellow" : v < 32 ? "peach" : "red";
const copCol = (v: number) => isNaN(v) || v <= 0 ? "overlay1" : v < 2.5 ? "red" : v < 3.5 ? "peach" : v < 4.5 ? "yellow" : "green";
const NO_ERR = ["Brak błędów", "No error", "No Error", "No faults", "OK", "unavailable", "unknown", ""];

class ImmergasNowCard extends HubCard {
  private hist: { at: number; st: Seg[]; nt: Seg[]; leg: number[] } | null = null;
  private hLoading = false;
  /** Dominus: heating-demand and DHW-request segments and cylinder temperatures (72 h) */
  private dHist: { at: number; ch: Seg[]; rq: Seg[]; tk: Pt[] } | null = null;
  /** COP of the current month from the statistics of heat and electricity totals (refreshed every 30 min) */
  private copMonth: { at: number; v: number } | null = null;
  private cmLoading = false;
  private async loadCopMonth() {
    const h = this.eid("heat_total"), e = this.eid("elec_total");
    if (this.cmLoading || !h || !e) return;
    this.cmLoading = true;
    try {
      const n = new Date(), start = new Date(n.getFullYear(), n.getMonth(), 1);
      const r = await this.hass.callWS({ type: "recorder/statistics_during_period", start_time: start.toISOString(), end_time: n.toISOString(),
        statistic_ids: [h, e], period: "day", types: ["change"], units: {} });
      const sum = (id: string) => (r[id] ?? []).reduce((a: number, x: any) => a + (x.change ?? 0), 0);
      const heat = sum(h), elec = sum(e);
      this.copMonth = { at: Date.now(), v: elec > 0.5 ? heat / elec : NaN };
    } catch { this.copMonth = { at: Date.now(), v: NaN }; }
    this.cmLoading = false;
    this.requestUpdate();
  }
  private tick?: number;

  connectedCallback() { super.connectedCallback(); this.tick = window.setInterval(() => this.requestUpdate(), 20000); }
  disconnectedCallback() { super.disconnectedCallback(); clearInterval(this.tick); }

  private async loadHist() {
    if (this.hLoading || !this.idx) return;
    this.hLoading = true;
    try {
      const end = Date.now(), ids = [this.eid("state"), this.eid("u11")].filter(Boolean) as string[];
      const r = await this.hass.callWS({ type: "history/history_during_period", start_time: new Date(end - 72 * H).toISOString(),
        end_time: new Date(end).toISOString(), entity_ids: ids, minimal_response: true, no_attributes: true, significant_changes_only: false });
      // anti-legionella disinfections = hours with the DHW cylinder at >= 60 °C (long-term statistics, 30 days);
      // hours closer than 12 h belong to the same cycle
      const leg: number[] = [];
      const tk = this.eid("tank");
      if (tk) {
        const s = await this.hass.callWS({ type: "recorder/statistics_during_period", start_time: new Date(end - 30 * 24 * H).toISOString(),
          end_time: new Date(end).toISOString(), statistic_ids: [tk], period: "hour", types: ["max"], units: {} }).catch(() => ({}));
        for (const x of (s as any)[tk] ?? []) {
          const t = typeof x.start === "number" ? x.start : Date.parse(x.start);
          if (x.max >= LEG_T && !(leg.length && t - leg[leg.length - 1] < 12 * H)) leg.push(t);
        }
      }
      this.hist = { at: end, st: segments(r[this.eid("state") ?? ""] ?? [], end), nt: segments(r[this.eid("u11") ?? ""] ?? [], end), leg };
    } catch {
      this.hist = { at: Date.now(), st: [], nt: [], leg: [] };
    }
    this.hLoading = false;
    this.requestUpdate();
  }

  /** one timer row: label + elapsed, a progress bar against the expected length, and a small status line */
  private bar(k: any, icon: string, col: string, label: string, elapsed: number, total: number, sub: string, right?: string) {
    const known = total > 0, p = known ? Math.min(100, elapsed / total * 100) : 100, over = known && elapsed > total;
    return html`<div class="tb" @click=${() => this.moreInfo(k)}>
      <div class="tbh"><ha-icon icon=${icon} style="color:${c(col)}"></ha-icon><span class="tbl">${label}</span>
        <span class="tbv" style="color:${c(col)}">${right ?? dur(elapsed)}${known && !right ? html`<span class="tbo"> / ~${dur(total)}</span>` : nothing}</span></div>
      <div class="tbt"><div class="tbf ${known ? "" : "ind"}" style="width:${Math.max(2, p)}%;background:${known ? c(col) : ca(col, 0.35)};${over ? `box-shadow:0 0 6px ${ca(col, 0.6)}` : ""}"></div></div>
      <div class="tbs">${sub}</div></div>`;
  }

  private timers() {
    const now = Date.now(), cur = this.s("state"), u11 = this.s("u11");
    const st = this.hist?.st ?? [], nt = this.hist?.nt ?? [], last = st[st.length - 1], nl = nt[nt.length - 1];
    const stale = !this.hist || now - this.hist.at > 10 * 60e3
      || (now - this.hist.at > 15e3 && ((!BAD(cur) && last?.s !== cur) || (!BAD(u11) && !!nl && nl.s !== u11)));
    if (stale) this.loadHist();
    if (!last) return this.hist ? nothing : html`<div class="tmr"><div class="tbs">${this.t("Wczytuję historię cykli…", "Loading cycle history…")}</div></div>`;
    const pl = this.loc, rows: unknown[] = [];

    // 1) current phase vs. the typical length of the same phase
    const ph = BAD(cur) ? last.s : cur!, start = last.s === ph ? last.t0 : now, el = now - start;
    const typ = typical(st, (s) => s === ph), col = phaseCol(ph), idle = isIdle(ph);
    const sub = !(typ > 0) ? this.t("za mało historii, by oszacować długość", "not enough history to estimate the length")
      : el <= typ ? (idle ? this.t("następny start ~", "next start ~") : this.t("koniec ~", "ends ~")) + clock(start + typ, pl) + this.t(" · zostało ~", " · ~") + dur(typ - el) + this.t("", " left")
      : this.t("dłużej niż zwykle o ", "longer than usual by ") + dur(el - typ);
    rows.push(this.bar("state", phaseIcon(ph), col, idle ? this.t("Przerwa (postój)", "Pause (idle)") : ph, el, typ,
      this.t("od ", "since ") + clock(start, pl) + " · " + sub));

    // 2) DHW rhythm: time since the last DHW cycle started vs. the typical interval between DHW starts
    if (!isDhw(ph)) {
      const starts: number[] = [];
      let lastEnd = -Infinity;
      for (const g of st) if (isDhw(g.s)) { if (g.t0 - lastEnd > 15 * 60e3) starts.push(g.t0); lastEnd = g.t1; }
      if (starts.length) {
        const gaps = starts.slice(1).map((t, i) => t - starts[i]), iv = gaps.length ? median(gaps.slice(-6)) : NaN, ls = starts[starts.length - 1];
        rows.push(this.bar("tank", "mdi:water-sync", "yellow", this.t("Rytm CWU", "DHW rhythm"), now - ls, iv,
          this.t("ostatnie ", "last at ") + clock(ls, pl) + (iv > 0 ? (now - ls <= iv ? this.t(" · następne ~", " · next ~") + clock(ls + iv, pl)
            : this.t(" · następne już po czasie", " · next is overdue")) + this.t(" (typowo co ", " (usually every ") + dur(iv) + ")" : ""),
          dur(now - ls) + this.t(" temu", " ago")));
      }
    }

    // 3) night function: elapsed / time left (window from card options night_start / night_stop, else learned from history)
    if (this.eid("u11")) {
      const onSegs = nt.filter((g) => g.s === "on" && g.t1 - g.t0 >= 5 * 60e3);
      const learned = onSegs.length ? onSegs[onSegs.length - 1] : null, ld = typical(nt, (s) => s === "on", 5 * 60e3, 4);
      const lm = learned ? new Date(learned.t0).getHours() * 60 + new Date(learned.t0).getMinutes() : null;
      const cfg0 = this.timeOpt("night_start"), a0 = cfg0 ?? lm, a1 = this.timeOpt("night_stop");
      const npct = this.n("night_pct"), lim = !isNaN(npct) && npct > 0 ? " · limit " + Math.round(npct) + " %" : "";
      if (u11 === "on") {
        const ns = nl?.s === "on" ? nl.t0 : now;
        const ne = a1 !== null ? nextAt(a1, ns) : ld > 0 ? ns + ld : learned && learned !== nl ? ns + learned.t1 - learned.t0 : NaN;
        rows.push(this.bar("u11", "mdi:weather-night", "lavender", this.t("Tryb nocny", "Night mode"), now - ns, ne - ns,
          this.t("od ", "since ") + clock(ns, pl) + (ne > now ? this.t(" · koniec ~", " · ends ~") + clock(ne, pl) + this.t(" · zostało ", " · ") + dur(ne - now) + this.t("", " left") : "") + lim));
      } else if (a0 !== null && !BAD(u11) && !(this.eid("u11_set") && !this.on("u11_set"))) {
        // countdown only while U11 is ON on the boiler (hub switch "U11 set on the boiler", when present)
        // progress from the end of the last night window (or the previous day's start + window length) to the next start
        const nx = nextAt(a0, now), prevStart = nx - 86400e3;
        const from = nl?.s === "off" && nl.t0 > prevStart ? nl.t0 : prevStart + (a1 !== null ? ((a1 - a0 + 1440) % 1440) * 60000 : ld > 0 ? ld : 0);
        rows.push(this.bar("u11", "mdi:moon-waning-crescent", "lavender", this.t("Do trybu nocnego", "Until night mode"), now - from, nx - from,
          this.t("start ~", "starts ~") + clock(nx, pl) + (cfg0 === null ? this.t(" (z historii)", " (from history)") : "") + lim,
          this.t("za ", "in ") + dur(nx - now)));
      }
    }

    // 4) anti-legionella (P15): no bus flag for a running cycle, so it is detected from the boiler raising the active
    //    DHW setpoint to >= 60 °C; otherwise: enabled since, last disinfection (cylinder >= 60 °C) and the learned interval
    if (this.on("p15")) {
      const act = this.n("dhw_active_set"), set = this.n("dhw_set"), tank = this.n("tank"), leg = this.hist?.leg ?? [];
      if (act >= LEG_T && !(act <= set)) {
        const t0 = new Date(this.so("dhw_active_set")?.last_changed ?? now).getTime(), base = Math.min(isNaN(set) ? 45 : set, tank);
        const pr = Math.max(0, Math.min(1, (tank - base) / (act - base)));
        rows.push(this.bar("p15", "mdi:bacteria-outline", "red", this.t("Anty-legionella · dezynfekcja trwa", "Anti-legionella · disinfection running"), pr, 1,
          this.t("od ", "since ") + clock(t0, pl) + this.t(" · najpóźniej do ", " · at the latest until ") + clock(t0 + this.legHours() * 3600e3, pl) + " (P13)" + this.t(" · zasobnik ", " · cylinder ") + this.f(tank, 1, 1) + " / " + this.f(act, 0) + " °C",
          dur(now - t0)));
      } else {
        const ls = leg[leg.length - 1], gaps = leg.slice(1).map((t, i) => t - leg[i]), iv = gaps.length ? median(gaps) : NaN;
        const since = new Date(this.so("p15")?.last_changed ?? now).getTime(), nx = this.nextLeg(now);
        const day = (t: number) => new Date(t).toLocaleDateString(pl, { weekday: "short", day: "numeric", month: "numeric" }) + " " + clock(t, pl);
        if (nx > 0) {
          // schedule from the card options (as set on the boiler): countdown from the previous slot to the next one
          const prev = Math.max(ls ?? 0, nx - ((this.dayOpt("legionella_day") ?? -1) < 0 ? 1 : 7) * 86400e3);
          rows.push(this.bar("p15", "mdi:bacteria-outline", "red", this.t("Do dezynfekcji (anty-legionella)", "Until disinfection (anti-legionella)"), now - prev, nx - prev,
            this.t("następna ", "next ") + day(nx) + (ls ? this.t(" · ostatnia ", " · last ") + day(ls) : ""), this.t("za ", "in ") + dur(nx - now)));
        } else
        rows.push(this.bar("p15", "mdi:bacteria-outline", "red", this.t("Anty-legionella", "Anti-legionella"), ls ? now - ls : 0, ls ? iv : NaN,
          ls ? this.t("ostatnia dezynfekcja ", "last disinfection ") + day(ls) + (iv > 0 ? this.t(" · następna ~", " · next ~") + day(ls + iv) : "")
            : this.t(`włączona od ${dur(now - since)} · cyklu (zasobnik ≥ ${LEG_T} °C) jeszcze nie było w historii`, `on for ${dur(now - since)} · no cycle (cylinder ≥ ${LEG_T} °C) in history yet`),
          ls ? dur(now - ls) + this.t(" temu", " ago") : this.t("czeka", "waiting")));
      }
    }

    // 5) last 6 h as a strip: shows the on/off rhythm of the compressor and the boiler
    const w0 = now - WIN, win = st.filter((g) => g.t1 > w0).map((g) => ({ ...g, t0: Math.max(g.t0, w0) }));
    const runs = win.filter((g) => !isIdle(g.s) && g.t0 > w0), pauses = win.filter((g, i) => isIdle(g.s) && g.t0 > w0 && i < win.length - 1);
    const mr = median(runs.filter((g) => g !== win[win.length - 1]).map((g) => g.t1 - g.t0)), mp = median(pauses.map((g) => g.t1 - g.t0));
    const stats = [runs.length + this.t(" startów", " starts"), mr > 0 ? this.t("praca ~", "on ~") + dur(mr) : "", mp > 0 ? this.t("przerwa ~", "off ~") + dur(mp) : ""].filter(Boolean).join(" · ");
    const pct = (t: number) => (t - w0) / WIN * 100;
    const strip = html`<div class="sh"><span class="tbl">${this.t("Ostatnie 6 h", "Last 6 h")}</span><span class="tbs">${stats}</span></div>
      <div class="strip">${win.map((g) => html`<div class="sg" style="left:${pct(g.t0)}%;width:${Math.max(0.3, pct(g.t1) - pct(g.t0))}%;background:${isIdle(g.s) ? ca("overlay1", 0.18) : c(phaseCol(g.s))}"
        title="${g.s} · ${clock(g.t0, pl)}–${clock(g.t1, pl)} (${dur(g.t1 - g.t0)})"></div>`)}</div>
      <div class="sx">${[0, 1, 2].map((i) => html`<span>${clock(w0 + i * 2 * H, pl)}</span>`)}<span>${this.t("teraz", "now")}</span></div>`;
    return html`<div class="tmr">${rows}${strip}</div>`;
  }

  private async loadDomHist() {
    if (this.hLoading || !this.idx) return;
    this.hLoading = true;
    try {
      const end = Date.now(), ids = [this.eid("dom_ch_demand"), this.eid("dom_dhw_request"), this.eid("tank")].filter(Boolean) as string[];
      const r = await this.hass.callWS({ type: "history/history_during_period", start_time: new Date(end - 72 * H).toISOString(),
        end_time: new Date(end).toISOString(), entity_ids: ids, minimal_response: true, no_attributes: true, significant_changes_only: false });
      this.dHist = { at: end, ch: segments(r[this.eid("dom_ch_demand") ?? ""] ?? [], end), rq: segments(r[this.eid("dom_dhw_request") ?? ""] ?? [], end),
        tk: points(r[this.eid("tank") ?? ""] ?? []) };
    } catch {
      this.dHist = { at: Date.now(), ch: [], rq: [], tk: [] };
    }
    this.hLoading = false;
    this.requestUpdate();
  }

  /** Dominus timers: CH demand period vs. its typical length, DHW rhythm, disinfection countdown (card options) and
   *  the last 6 h strip - from the heating-demand and DHW-request flags and the cylinder temperature */
  /** declared T02: the DHW cycle starts when the cylinder drops to the setpoint minus T02 */
  private dhwThreshold(tank: number) {
    const t02 = this.n("dom_t02"), set = this.n("dhw_set");
    if (isNaN(t02) || isNaN(set)) return "";
    return " · " + this.t(`cykl CWU przy ≤ ${this.f(set - t02, 0)} °C, teraz ${this.f(tank, 1, 1)} °C`, `DHW cycle at ≤ ${this.f(set - t02, 0)} °C, now ${this.f(tank, 1, 1)} °C`);
  }

  private domTimers() {
    const now = Date.now(), chS = this.s("dom_ch_demand"), rqS = this.s("dom_dhw_request");
    const h = this.dHist, ch = h?.ch ?? [], rq = h?.rq ?? [], lc = ch[ch.length - 1], lr = rq[rq.length - 1];
    const stale = !h || now - h.at > 10 * 60e3 || (now - h.at > 15e3 && ((!BAD(chS) && !!lc && lc.s !== chS) || (!BAD(rqS) && !!lr && lr.s !== rqS)));
    if (stale) this.loadDomHist();
    if (!lc) return h ? nothing : html`<div class="tmr"><div class="tbs">${this.t("Wczytuję historię cykli…", "Loading cycle history…")}</div></div>`;
    const pl = this.loc, rows: unknown[] = [];
    const tk: Pt[] = [...(h?.tk ?? [])], tv = this.n("tank");
    if (!isNaN(tv)) tk.push({ t: now, v: tv });
    // Magis: the DHW request (2001) comes ~9 min before the cycle, which starts when it clears; OpenTherm: "DHW active"
    // (status bit 2) is the cycle itself - each "on" period is one DHW heating
    const dp = this.ot ? rq.filter((g) => g.s === "on").map((g) => ({ t0: g.t0, t1: g.t1 })) : dhwPeriods(rq, tk, now);
    const reqOff = lr && lr.s === "off" ? lr.t0 : -Infinity;
    const dhwNow = this.ot ? !!lr && lr.s === "on" : dhwHeatingNow(reqOff, tk, now), cur = dp[dp.length - 1];

    // 1) CH demand on / pause vs. the typical length of the same state
    const on = (BAD(chS) ? lc.s : chS) === "on", start = lc.s === (on ? "on" : "off") ? lc.t0 : now, el = now - start;
    const typ = typical(ch, (x) => x === (on ? "on" : "off"), 60e3), col = on ? "peach" : "overlay1";
    const sub = !(typ > 0) ? this.t("za mało historii, by oszacować długość", "not enough history to estimate the length")
      : el <= typ ? (on ? this.t("koniec ~", "ends ~") : this.t("następne grzanie ~", "next heating ~")) + clock(start + typ, pl) + this.t(" · zostało ~", " · ~") + dur(typ - el) + this.t("", " left")
      : this.t("dłużej niż zwykle o ", "longer than usual by ") + dur(el - typ);
    rows.push(this.bar("dom_ch_demand", on ? "mdi:radiator" : "mdi:pause-circle-outline", col,
      on ? this.t("Grzanie CO", "CH heating") : this.t("Przerwa CO", "CH pause"), el, typ, this.t("od ", "since ") + clock(start, pl) + " · " + sub));
    // T05 (declared): after a heating demand ends the boiler blocks the next CH start for T05 minutes
    const t05 = this.n("dom_t05") * 60e3;
    if (!on && t05 > 0 && el < t05)
      rows.push(this.bar("dom_t05", "mdi:timer-lock-outline", "overlay2", this.t("Blokada startu CO (T05)", "CH start lock (T05)"), el, t05,
        this.t("start możliwy ~", "start possible ~") + clock(start + t05, pl), this.t("jeszcze ", "") + dur(t05 - el) + this.t("", " left")));
    // gas boiler integration (declared I02 + I04): the boiler may join after I04 minutes of one heating demand
    const i04 = this.n("dom_i04") * 60e3, i10 = this.n("dom_i10"), outT = this.n("outdoor");
    if (on && this.on("dom_int_ch") && i04 > 0) {
      const cold = !isNaN(i10) && outT < i10;
      rows.push(this.bar("dom_i04", "mdi:fire", "yellow", this.t("Dołączenie kotła (I04)", "Boiler joining (I04)"), el, i04,
        (cold ? this.t(`poniżej ${this.f(i10, 0)} °C (I10) grzeje kocioł · `, `below ${this.f(i10, 0)} °C (I10) the boiler heats · `) : "")
          + (el < i04 ? this.t("kocioł może dołączyć ~", "the boiler may join ~") + clock(start + i04, pl) : this.t("czas I04 minął – kocioł może grzać razem z pompą", "I04 has passed – the boiler may heat with the pump")),
        el < i04 ? this.t("za ", "in ") + dur(i04 - el) : this.t("teraz", "now")));
    }

    // 2) DHW: a running cycle vs. the typical cycle, else the rhythm between cycle starts
    if (dhwNow && cur && now - cur.t1 < 5 * 60e3) {
      const ty = median(dp.slice(0, -1).map((g) => g.t1 - g.t0).slice(-6));
      rows.push(this.bar("tank", "mdi:water-boiler", "yellow", this.t("Grzanie CWU", "DHW heating"), now - cur.t0, ty,
        this.t("od ", "since ") + clock(cur.t0, pl) + this.t(" · zasobnik ", " · cylinder ") + this.f(tv, 1, 1) + " / " + this.f(this.n("dhw_set"), 0) + " °C"));
    } else if (dp.length) {
      const starts = dp.map((g) => g.t0), gaps = starts.slice(1).map((t, i) => t - starts[i]), iv = gaps.length ? median(gaps.slice(-6)) : NaN;
      const ls = starts[starts.length - 1];
      rows.push(this.bar("tank", "mdi:water-sync", "yellow", this.t("Rytm CWU", "DHW rhythm"), now - ls, iv,
        this.t("ostatnie ", "last at ") + clock(ls, pl) + (iv > 0 ? (now - ls <= iv ? this.t(" · następne ~", " · next ~") + clock(ls + iv, pl)
          : this.t(" · następne już po czasie", " · next is overdue")) + this.t(" (typowo co ", " (usually every ") + dur(iv) + ")" : "") + this.dhwThreshold(tv),
        dur(now - ls) + this.t(" temu", " ago")));
    } else if (this.dhwThreshold(tv)) {
      rows.push(this.bar("dom_t02", "mdi:water-sync", "yellow", this.t("Próg CWU (T02)", "DHW threshold (T02)"), 0, 0, this.dhwThreshold(tv).slice(3), "–"));
    }

    // 3) night function declared on the boiler (switch on): elapsed inside the U12-U13 window, else time to the start
    const a0 = this.timeOpt("night_start"), a1 = this.timeOpt("night_stop");
    if (this.on("u11") && this.allSet("u12", "u13") && a0 !== null && a1 !== null) {
      const len = ((a1 - a0 + 1440) % 1440 || 1440) * 60000, nxs = nextAt(a0, now), ws = nxs - 86400e3;
      if (now < ws + len) rows.push(this.bar("u11", "mdi:weather-night", "lavender", this.t("Tryb nocny", "Night mode"), now - ws, len,
        this.t("od ", "since ") + clock(ws, pl) + this.t(" · koniec ~", " · ends ~") + clock(ws + len, pl) + this.t(" · zostało ", " · ") + dur(ws + len - now) + this.t("", " left")));
      else rows.push(this.bar("u11", "mdi:moon-waning-crescent", "lavender", this.t("Do trybu nocnego", "Until night mode"), now - (ws + len), nxs - (ws + len),
        this.t("start ~", "starts ~") + clock(nxs, pl), this.t("za ", "in ") + dur(nxs - now)));
    }

    // 4) disinfection countdown while anti-legionella is declared on the boiler (switch on; not readable over TCP)
    const nx = this.on("p15") && this.allSet("p16", "p17") ? this.nextLeg(now) : NaN;
    if (nx > 0) {
      const prev = nx - ((this.dayOpt("legionella_day") ?? -1) < 0 ? 1 : 7) * 86400e3;
      const day = (t: number) => new Date(t).toLocaleDateString(pl, { weekday: "short", day: "numeric", month: "numeric" }) + " " + clock(t, pl);
      rows.push(this.bar("p15", "mdi:bacteria-outline", "red", this.t("Do dezynfekcji (anty-legionella)", "Until disinfection (anti-legionella)"), now - prev, nx - prev,
        this.t("następna ", "next ") + day(nx), this.t("za ", "in ") + dur(nx - now)));
    }

    // 4b) OpenTherm: anti-legionella of the HA programs (02:00 daily / on Monday; paused while the remote is in charge)
    const lg = this.s("ot_leg");
    if (this.ot && (lg === "daily" || lg === "weekly") && !this.otRO) {
      const run = !!this.attr("zone1_phase", "anti_legionella_running");
      const at2 = (d: Date) => { const x = new Date(d); x.setHours(2, 0, 0, 0); return x.getTime(); };
      let nx = at2(new Date(now));
      if (lg === "daily") { if (nx <= now) nx += 86400e3; }
      else { const d = new Date(nx); const add = (8 - d.getDay()) % 7; nx += add * 86400e3; if (nx <= now) nx += 7 * 86400e3; }
      const prev = nx - (lg === "daily" ? 1 : 7) * 86400e3;
      const day = (t: number) => new Date(t).toLocaleDateString(pl, { weekday: "short", day: "numeric", month: "numeric" }) + " " + clock(t, pl);
      rows.push(run ? this.bar("ot_leg", "mdi:bacteria-outline", "red", this.t("Dezynfekcja trwa (anty-legionella)", "Disinfection running (anti-legionella)"), 1, 1,
          this.t("zasobnik do maks. kotła, potem 20 min", "the cylinder to the boiler maximum, then 20 min"), this.t("teraz", "now"))
        : this.bar("ot_leg", "mdi:bacteria-outline", "red", this.t("Do dezynfekcji (anty-legionella)", "Until disinfection (anti-legionella)"), now - prev, nx - prev,
          this.t("następna ", "next ") + day(nx), this.t("za ", "in ") + dur(nx - now)));
    }

    // 4c) vacation (both modes): time left until the end date, or since it started when it has none
    if (this.on("dom_vacation")) {
      const since = Date.parse(this.so("dom_vacation")?.last_changed ?? ""), us = this.s("dom_vac_until") ?? "", until = Date.parse(us);
      const what = this.ot ? (this.s("ot_vac_action") === "summer" ? this.t("Lato – CO wył.", "Summer – CH off") : this.t("Stand-by – CO i CWU wył.", "Standby – CH and DHW off"))
        : this.t("obniżona zadana Strefy 1", "zone 1 target lowered");
      const day = (t: number) => new Date(t).toLocaleDateString(pl, { weekday: "short", day: "numeric", month: "numeric" }) + " " + clock(t, pl);
      rows.push(!isNaN(until) && until > now && !isNaN(since)
        ? this.bar("dom_vacation", "mdi:bag-suitcase-outline", "sky", this.t("Tryb wyjazdowy", "Vacation"), now - since, until - since,
          what + this.t(" · do ", " · until ") + day(until), this.t(`jeszcze ${dur(until - now)}`, `${dur(until - now)} left`))
        : this.bar("dom_vacation", "mdi:bag-suitcase-outline", "sky", this.t("Tryb wyjazdowy", "Vacation"), isNaN(since) ? 0 : now - since, 0,
          what + this.t(" · do wyłączenia", " · until switched off")));
    }

    // 5) last 6 h: CH demand (peach) and DHW heating (yellow) over the idle background
    const w0 = now - WIN, pct = (t: number) => (Math.max(t, w0) - w0) / WIN * 100;
    const chOn = ch.filter((g) => g.s === "on" && g.t1 > w0), dw = dp.filter((g) => g.t1 > w0);
    const starts = chOn.filter((g) => g.t0 > w0).length;
    const stats = [starts + this.t(" startów CO", " CH starts"), dw.length ? dw.length + this.t(" × CWU", " × DHW") : ""].filter(Boolean).join(" · ");
    const seg = (t0: number, t1: number, col: string, ttl: string) => html`<div class="sg" style="left:${pct(t0)}%;width:${Math.max(0.3, pct(t1) - pct(t0))}%;background:${c(col)}"
      title="${ttl} · ${clock(t0, pl)}–${clock(t1, pl)} (${dur(t1 - t0)})"></div>`;
    const strip = html`<div class="sh"><span class="tbl">${this.t("Ostatnie 6 h", "Last 6 h")}</span><span class="tbs">${stats}</span></div>
      <div class="strip"><div class="sg" style="left:0;width:100%;background:${ca("overlay1", 0.18)}"></div>
        ${chOn.map((g) => seg(g.t0, g.t1, "peach", this.t("grzanie CO", "CH heating")))}${dw.map((g) => seg(g.t0, g.t1, "yellow", this.t("grzanie CWU", "DHW heating")))}</div>
      <div class="sx">${[0, 1, 2].map((i) => html`<span>${clock(w0 + i * 2 * H, pl)}</span>`)}<span>${this.t("teraz", "now")}</span></div>`;
    return html`<div class="tmr">${rows}${strip}</div>`;
  }

  /** active fault, always shown: the hub's fault from all three buses (D+/D-, T-/T+, F1/F2); older hubs: D+/D- and F1/F2 */
  private faultChip() {
    if (this.eid("fault_any") && this.eid("fault_text")) {
      const bad = this.bad("fault_any"), on = this.on("fault_any"), col = bad ? "overlay1" : on ? "red" : "green";
      return this.chip("fault_text", on ? "mdi:alert-octagon" : "mdi:check-circle-outline", col, this.t("Aktywny błąd", "Active fault"),
        bad ? "–" : on ? this.s("fault_text") ?? "–" : this.t("brak aktywnych błędów", "no active faults"), on);
    }
    const code = this.s("err_code") ?? "", desc = this.s("err_desc") ?? "", ff = this.s("ff_err") ?? "";
    const boiler = this.on("err_active") || (!!code && !NO_ERR.includes(code) && parseFloat(code) !== 0 && !/^(brak|none|no )/i.test(code));
    const odu = !NO_ERR.includes(ff);
    const bad = this.bad("err_desc") && this.bad("ff_err");
    const txt = bad ? "–" : !boiler && !odu ? this.t("brak aktywnych błędów", "no active faults")
      : [boiler ? [code, desc].filter((x) => x && !NO_ERR.includes(x)).join(" · ") : "", odu ? this.t("jedn. zewn.: ", "outdoor unit: ") + ff : ""].filter(Boolean).join(" | ");
    const col = bad ? "overlay1" : boiler || odu ? "red" : "green";
    return this.chip(boiler || !odu ? "err_desc" : "ff_err", boiler || odu ? "mdi:alert-octagon" : "mdi:check-circle-outline", col,
      this.t("Aktywny błąd", "Active fault"), txt, boiler || odu);
  }

  /** compressor and burner today, operating state, heat pump allowed / excluded (I10 is a setting: Operating mode card) */
  private stateChips() {
    const sp = this.s("state"), spB = this.bad("state");
    const spc = spB ? "overlay1" : isIdle(sp) ? "overlay2" : isDefrost(sp) ? "sky" : isDhw(sp) ? "yellow" : isCool(sp) ? "teal" : "peach";
    const sts = this.n("starts"), czh = this.n("runtime");
    const stc = isNaN(sts) ? "overlay1" : sts > 20 ? "peach" : sts > 10 ? "yellow" : "teal";
    // hours -> "H h MM min" from whole minutes (rounding the fraction alone could give "60 min")
    const hm = (h: number) => { const m = Math.round(h * 60); return Math.floor(m / 60) + " h " + String(m % 60).padStart(2, "0") + " min"; };
    const czt = isNaN(czh) ? "–" : hm(czh);
    const avg = sts > 0 && !isNaN(czh) ? this.t(" · śr. ", " · avg ") + Math.round(czh * 60 / sts) + " min" : "";
    const wkOn = this.on("hp_excluded"), wkBad = this.bad("hp_excluded");
    // compressor today in one wide row: starts · runtime · average cycle
    const today = (isNaN(sts) ? "–" : Math.round(sts) + " " + this.t("startów", "starts")) + " · " + czt + avg;
    const hasHp = !!this.eid("hp_excluded");
    // gas boiler today (Magis Combo): starts · runtime · gas used
    const bs = this.n("burner_starts"), bh = this.n("burner_runtime"), gd = this.n("gas_today");
    const bt = isNaN(bh) ? "–" : hm(bh);
    const burner = (isNaN(bs) ? "–" : Math.round(bs) + " " + this.t("startów", "starts")) + " · " + bt + (isNaN(gd) ? "" : this.t(" · gaz ", " · gas ") + this.f(gd, 2, 2) + " m³");
    const bcol = isNaN(bs) ? "overlay1" : bs > 0 ? "peach" : "overlay2";
    return html`<div class="chips2">
      <div class="span2">${this.chip("starts", "mdi:restart", stc, this.t("Sprężarka dziś", "Compressor today"), today, sts > 20)}</div>
      ${this.hasGas && this.eid("burner_starts") ? html`<div class="span2">${this.chip("burner_starts", "mdi:fire", bcol, this.t("Palnik dziś", "Burner today"), burner, this.on("boiler_running"))}</div>` : nothing}
      <div class=${hasHp ? "" : "span2"}>${this.chip("state", "mdi:heat-pump", spc, this.t("Stan pracy (hub)", "Operating state (hub)"), spB ? "–" : sp!, !spB && spc !== "overlay2")}</div>
      ${hasHp ? this.chip("hp_excluded", wkOn ? "mdi:heat-pump-outline" : "mdi:heat-pump", wkBad ? "overlay1" : wkOn ? "red" : "green",
        this.t("Pompa ciepła", "Heat pump"), wkBad ? "–" : wkOn ? this.t("wykluczona · grzeje kocioł", "excluded · boiler heats") : this.t("dopuszczona do pracy", "allowed to run"), wkOn) : nothing}
      <div class="span2">${this.faultChip()}</div>
    </div>`;
  }

  /** OpenTherm extras: only what the boiler really reports - pressure / DHW flow are left out when the Data-ID scan
   *  found them unanswered or they have no value (a DHW flow that stays 0 outside DHW, e.g. a storage-tank boiler) */
  /** ESP hub: the burner counted in the hub (ot_stats) and the boiler's own counters (Data-ID 116 / 120) */
  private burnerTiles() {
    const st = this.n("ot_burn_today"), bh = this.n("ot_burn_hours"), sh = this.n("ot_burn_h"), tot = this.n("ot_starts_total"), hrs = this.n("ot_hours_total");
    const shCol = isNaN(sh) ? "overlay1" : sh > 6 ? "red" : sh > 3 ? "peach" : "green";
    return html`
      ${this.eid("ot_burn_today") ? this.tile("ot_burn_today", "mdi:fire-circle", this.t("Starty dziś", "Starts today"), this.f(st, 0) + (isNaN(bh) ? "" : ` · ${this.f(bh, 1, 1)} h`), "peach", Math.min(100, (st || 0) / 48 * 100)) : nothing}
      ${this.eid("ot_burn_h") ? this.tile("ot_burn_h", "mdi:fire-alert", this.t("Starty / godzina", "Starts / hour"), this.f(sh, 0) + (sh > 6 ? this.t(" · taktowanie", " · cycling") : ""), shCol, Math.min(100, (sh || 0) / 8 * 100)) : nothing}
      ${this.eid("ot_starts_total") ? this.tile("ot_starts_total", "mdi:counter", this.t("Starty (od początku)", "Starts (total)"), this.f(tot, 0), "overlay2") : nothing}
      ${this.eid("ot_hours_total") ? this.tile("ot_hours_total", "mdi:timer-outline", this.t("Godziny palnika", "Burner hours"), this.f(hrs, 0) + " h", "overlay2") : nothing}`;
  }

  private otChips(dhw: boolean) {
    const press = this.n("ot_press"), fl = this.n("ot_dhw_flow"), chips: unknown[] = [];
    const flag = (["ot_f_water", "ot_f_flame", "ot_f_air", "ot_f_hot", "ot_f_service"] as Key[]).find((k) => this.on(k));
    if (flag) chips.push(html`<div class="span2">${this.chip(flag, "mdi:alert-octagon", "red", this.t("Flaga błędu kotła", "Boiler fault flag"), this.so(flag)?.attributes?.friendly_name ?? "", true)}</div>`);
    if (!this.esp && this.eid("ot_press") && !this.bad("ot_press") && !this.otMissing(18))  // ESP hub: in the boiler card
      chips.push(this.chip("ot_press", "mdi:gauge", press < 1 || press > 2.5 ? "red" : "green", this.t("Ciśnienie instalacji", "System pressure"), this.f(press, 1, 1) + " bar", false));
    if (this.eid("ot_dhw_flow") && !this.bad("ot_dhw_flow") && !this.otMissing(19) && (fl > 0 || dhw))
      chips.push(this.chip("ot_dhw_flow", "mdi:water-pump", "sky", this.t("Przepływ CWU", "DHW flow rate"), this.f(fl, 1, 1) + " l/min", false));
    return chips.length ? html`<div class="chips2">${chips}</div>` : nothing;
  }

  /** Immergas Dominus (no heat-pump data): mode and what the boiler is asked for, setpoints, three temperatures, fault */
  private domBody() {
    const err = this.on("err_active"), ch = this.on("dom_ch_demand"), dhw = this.on("dom_dhw_request");
    const col = err ? "red" : dhw ? "yellow" : ch ? "peach" : "overlay1";
    const state = err ? this.t("AWARIA", "FAULT") : dhw ? this.t("Ciepła woda", "Hot water") : ch ? this.t("Ogrzewanie", "Heating") : this.t("Czuwanie", "Standby");
    const ot = this.ot, flame = this.on("ot_flame"), mod = this.n("ot_mod"), press = this.n("ot_press");
    const sub = [this.bad("mode") ? "" : this.t("tryb ", "mode ") + this.txt("mode"),
      this.bad("zone1_phase") ? "" : this.t("program ", "program ") + this.txt("zone1_phase"),
      ot && flame ? this.t("płomień", "flame") + (isNaN(mod) ? "" : ` ${Math.round(mod)} %`) : "",
      ch && dhw ? this.t("CO też czeka", "CH also waiting") : ""].filter(Boolean).join(" · ");
    const out = this.n("outdoor"), z1 = this.n("zone1"), tank = this.n("tank"), ds = this.n("dhw_set");
    // OpenTherm: no zone - the CH setpoint is the boiler flow setpoint
    const zs = ot ? this.n("ot_ch_set") : this.n("zone1_set"), zsKey: Key = ot ? "ot_ch_set" : "zone1_set";
    const fl = this.n("ot_flow"), rt = this.n("ot_ret");
    return html`
      ${this.head("mdi:water-boiler", this.t("Teraz", "Now"))}
      ${err ? html`<div class="banner" style=${box("red", true)} @click=${() => this.moreInfo("err_desc")}>
        <ha-icon icon="mdi:alert-octagon" style="color:${c("red")}"></ha-icon>
        <div class="cx"><div class="bt" style="color:${c("red")}">${this.t("BŁĄD KOTŁA", "BOILER FAULT")}</div><div class="bs">${this.s("err_desc") ?? ""}</div></div></div>` : nothing}
      <div class="hero" style="background:${ch || dhw || err ? `color-mix(in srgb, ${c(col)} 16%, var(--ha-card-background, var(--card-background-color)))` : ca("overlay1", 0.06)}"
        @click=${() => this.moreInfo("mode")}>
        <ha-icon class="hi" icon=${ot && flame ? "mdi:fire" : dhw ? "mdi:water-boiler" : ch ? "mdi:radiator" : "mdi:water-boiler-off"} style="color:${c(col)}"></ha-icon>
        <div class="hm">
          <div class="hn">${this.config.title ?? (ot ? (this.esp ? "Immergas · hub · OpenTherm" : "Immergas · Dominus · OpenTherm") : "Immergas · Dominus")}</div>
          <div class="mode" style="color:${c(col)}">${state}</div>
          <div class="sub">${sub}</div></div>
        <div class="flow">
          ${ot && !isNaN(fl) ? html`<span style="color:${c("red")}" title=${this.t("zasilanie kotła", "boiler flow")}
            @click=${(e: Event) => { e.stopPropagation(); this.moreInfo("ot_flow"); }}>▲ ${this.f(fl)}°</span>` : nothing}
          ${ot && !isNaN(rt) ? html`<span style="color:${c("blue")}" title=${this.t("powrót do kotła", "boiler return")}
            @click=${(e: Event) => { e.stopPropagation(); this.moreInfo("ot_ret"); }}>▼ ${this.f(rt)}°</span>` : nothing}
          <span style="color:${c("peach")}" title=${ot ? this.t("nastawa CO (zasilanie)", "CH setpoint (flow)") : this.t("nastawa CO strefy 1", "zone 1 CH setpoint")}
            @click=${(e: Event) => { e.stopPropagation(); this.moreInfo(zsKey); }}>CO ${this.f(zs, ot ? 0 : 1)}°</span>
          <span style="color:${c("yellow")}" title=${this.t("nastawa CWU", "DHW setpoint")}
            @click=${(e: Event) => { e.stopPropagation(); this.moreInfo("dhw_set"); }}>${this.t("CWU", "DHW")} ${this.f(ds, 0)}°</span></div>
      </div>
      <div class="grid4">
        ${this.tile("outdoor", "mdi:thermometer", this.t("Na zewnątrz", "Outdoor"), this.f(out, 1, 1) + " °C", tempCol(out), (out + 15) / 50 * 100)}
        ${ot && this.eid("zone1") && !this.bad("zone1") ? this.tile("zone1", "mdi:home-thermometer", this.t("Pokój", "Room"), this.f(z1, 1, 1) + " °C", tempCol(z1), (z1 - 15) / 13 * 100)
          : ot ? this.tile("ot_flow", "mdi:thermometer-chevron-up", this.t("Zasilanie", "Flow"), this.f(fl, 1, 1) + " °C", tempCol(fl / 2), (fl - 20) / 60 * 100)
          : this.tile("zone1", "mdi:home-thermometer", this.t("Strefa 1", "Zone 1"), this.f(z1, 1, 1) + " °C", tempCol(z1), (z1 - 15) / 13 * 100)}
        ${this.tile("tank", "mdi:water-boiler", ot ? this.t("Ciepła woda", "Hot water") : this.t("Zasobnik CWU", "DHW cylinder"), this.f(tank, 1, 1) + " °C", tank >= 45 ? "peach" : tank >= 35 ? "yellow" : "sky", (tank - 20) / 45 * 100)}
        ${ot ? this.tile("ot_mod", flame ? "mdi:fire" : "mdi:fire-off", this.t("Modulacja", "Modulation"), flame ? this.f(mod, 0) + " %" : this.t("płomień zgaszony", "no flame"), flame ? "peach" : "overlay1", flame ? mod : 0)
          : this.tile("dom_ch_demand", ch ? "mdi:fire" : "mdi:fire-off", this.t("Żądanie CO", "CH demand"), ch ? this.t("tak", "yes") : this.t("nie", "no"), ch ? "peach" : "overlay1")}
        ${this.esp ? this.burnerTiles() : nothing}
      </div>
      ${ot ? this.otChips(dhw) : nothing}
      ${this.config.show_timers === false || !this.eid("dom_ch_demand") ? nothing : this.domTimers()}
      ${this.eid("dom_ch_time_today") ? html`<div class="chips2">
        ${this.chip("dom_ch_time_today", "mdi:radiator", "peach", this.t("Grzanie CO dziś", "CH heating today"),
          `${this.f(this.n("dom_ch_time_today"), 1, 1)} h · ${this.f(this.n("dom_starts_today"), 0)} ${this.t("startów", "starts")}`, false)}
        ${this.chip("dom_dhw_cycles", "mdi:water-boiler", "yellow", this.t("Cykle CWU dziś", "DHW cycles today"), this.f(this.n("dom_dhw_cycles"), 0), false)}</div>` : nothing}
      <div class="chips2">
        ${this.on("dom_frost") ? html`<div class="span2">${this.chip("dom_frost", "mdi:snowflake-alert", "red", this.t("Ryzyko zamarznięcia", "Frost risk"),
          this.t("pokój poniżej progu", "room below the threshold"), true)}</div>` : nothing}
        ${this.on("dom_offline") ? html`<div class="span2">${this.chip("dom_offline", "mdi:lan-disconnect", "red", this.t("Moduł Dominus offline", "Dominus module offline"),
          this.t("brak odczytu", "no reading"), true)}</div>` : nothing}
        <div class="span2">${this.faultChip()}</div></div>`;
  }

  protected body() {
    if (this.dominus) return this.domBody();
    if (this.idx && (!this.copMonth || Date.now() - this.copMonth.at > 30 * 60e3)) this.loadCopMonth();
    const hz = this.n("hz"), run = hz > 0;
    const defrost = this.on("defrost");
    const ffErr = this.s("ff_err") ?? "";
    const err = this.on("err_active") || !NO_ERR.includes(ffErr) || this.on("fault_any");
    const dhw = this.on("tt_dhw") || isDhw(this.s("state"));
    const cool = this.on("tt_cool");
    const gas = this.on("boiler_running");
    const mode = err ? this.t("AWARIA", "FAULT") : defrost ? this.t("Odszranianie", "Defrost")
      : run && dhw ? this.t("Grzanie CWU", "DHW heating") : run && cool ? this.t("Chłodzenie", "Cooling")
      : run ? this.t("Ogrzewanie CO", "Space heating") : gas ? this.t("Kocioł gazowy", "Gas boiler") : this.t("Czuwanie", "Standby");
    const col = err ? "red" : defrost ? "sky" : run ? "peach" : gas ? "yellow" : "overlay1";

    // unit name: the system model the boiler reports (TT D61, without the "(MCP)" code) and the outdoor-unit size
    const model = (this.s("d61") ?? "").replace(/\s*\([^)]*\)\s*$/, "").trim();
    const kw = [this.n("a11"), this.n("odu_cap")].find((v) => v > 0);
    const unit = this.config.title ?? ((model && !this.bad("d61") ? model : "Immergas") + (kw ? ` · ${this.f(kw, 0)} kW` : ""));

    const sub: string[] = [run ? this.t("sprężarka ", "compressor ") + Math.round(hz) + " Hz" : this.t("sprężarka stoi", "compressor stopped")];
    // electricity in -> heat out while running, so the COP below is readable at a glance
    const pw = this.n("elec_power"), hp = this.n("heat_power");
    if (!isNaN(pw)) sub.push(run && hp > 0 ? `${Math.round(Math.max(0, pw))} W → ${this.f(hp / 1000, 1, 1)} kW ${this.t("ciepła", "heat")}` : Math.round(Math.max(0, pw)) + " W");
    const fan = this.n("fan_real");
    if (fan > 0) sub.push(this.t("wentylator ", "fan ") + Math.round(fan) + this.t(" obr/min", " rpm"));
    if (this.on("backup_heater") || this.on("dhw_heater")) sub.push(this.t("⚡ grzałka", "⚡ heater"));
    if (gas && !run) sub.push(this.t("🔥 kocioł gazowy", "🔥 gas boiler"));

    const o = this.n("tw2"), r = this.n("tw1");
    const ci = this.n("cop"), cd = this.n("cop_today");
    const now = run && ci > 0, cn = now ? ci : NaN;

    const errText = (this.on("fault_any") ? this.s("fault_text") : "") || [this.s("err_desc"), ffErr].filter((x) => x && !NO_ERR.includes(x)).join(" · ") || this.t("sprawdź diagnostykę", "check diagnostics");
    const banner = (icon: string, colr: string, title: string, text: string, k: any) => html`
      <div class="banner" style=${box(colr, true)} @click=${() => this.moreInfo(k)}>
        <ha-icon icon=${icon} style="color:${c(colr)}"></ha-icon>
        <div class="cx"><div class="bt" style="color:${c(colr)}">${title}</div><div class="bs">${text}</div></div></div>`;

    const out = this.n("outdoor"), z1 = this.n("zone1"), tank = this.n("tank");
    return html`
      ${this.head("mdi:heat-pump-outline", this.t("Teraz", "Now"))}
      ${err ? banner("mdi:alert-octagon", "red", this.t("BŁĄD POMPY CIEPŁA", "HEAT PUMP FAULT"), errText, "err_desc") : nothing}
      ${defrost ? banner("mdi:snowflake-melt", "sky", this.t("ODSZRANIANIE", "DEFROST"), this.s("defrost_stage") ?? this.t("jednostka zewnętrzna się odszrania", "outdoor unit is defrosting"), "defrost") : nothing}
      <div class="hero" style="background:${run || err ? `color-mix(in srgb, ${c(col)} 16%, var(--ha-card-background, var(--card-background-color)))` : ca("overlay1", 0.06)}"
        @click=${() => this.moreInfo("hz")}>
        <ha-icon class="hi" icon="mdi:heat-pump" style="color:${c(col)};${run ? "animation:ih-spin 2.5s linear infinite" : ""}"></ha-icon>
        <div class="hm">
          <div class="hn" title=${this.t("model systemu (D61) i moc jednostki zewnętrznej", "system model (D61) and outdoor-unit size")}>${unit}</div>
          <div class="mode" style="color:${c(col)}">${mode}</div>
          <div class="sub">${sub.join(" · ")}</div>
          <div class="copr">${(([["cop", this.t("COP TERAZ", "COP NOW"), cn, now], ["cop_today", this.t("COP DZIŚ", "COP TODAY"), cd > 0 ? cd : NaN, false]] as [Key, string, number, boolean][])
            .concat(this.eid("heat_total") ? [["heat_total", this.t("COP MIESIĄC", "COP MONTH"), this.copMonth?.v ?? NaN, false]] : []))
            .map(([k, lbl, v, hot]) => { const col = copCol(v); return html`<div class="cop" style=${box(col, hot)}
              @click=${(e: Event) => { e.stopPropagation(); this.moreInfo(k); }}>
              <span class="cl">${lbl}</span>
              <span class="cv" style="color:${c(col)};${hot ? `text-shadow:0 0 10px ${ca(col, 0.45)}` : ""}">${isNaN(v) ? "–" : this.f(v, 1, 1)}</span></div>`; })}
          </div>
        </div>
        <div class="flow">
          <span style="color:${c("red")}" title=${this.t("zasilanie z pompy (TW2)", "heat-pump flow (TW2)")}
            @click=${(e: Event) => { e.stopPropagation(); this.moreInfo("tw2"); }}>▲ ${this.f(o)}°</span>
          <span style="color:${c("blue")}" title=${this.t("powrót do pompy (TW1)", "heat-pump return (TW1)")}
            @click=${(e: Event) => { e.stopPropagation(); this.moreInfo("tw1"); }}>▼ ${this.f(r)}°</span>
          <span style="opacity:.6" title=${this.t("różnica zasilanie – powrót", "flow – return difference")}>Δ ${this.f(o - r)} K</span>
          ${run && this.n("d04") > 0 ? html`<span style="opacity:.6;font-size:.8em" title=${this.t("zadana temperatura zasilania (D04)", "flow setpoint (D04)")}
            @click=${(e: Event) => { e.stopPropagation(); this.moreInfo("d04"); }}>→ ${this.f(this.n("d04"))}°</span>` : nothing}</div>
      </div>
      ${this.config.show_timers === false ? nothing : this.timers()}
      <div class="grid4">
        ${this.tile("outdoor", "mdi:thermometer", this.t("Na zewnątrz", "Outdoor"), this.f(out, 1, 1) + " °C", tempCol(out), (out + 15) / 50 * 100)}
        ${this.tile("zone1", "mdi:home-thermometer", this.t("Strefa 1", "Zone 1"), this.f(z1, 1, 1) + " °C", tempCol(z1), (z1 - 15) / 13 * 100)}
        ${this.tile("tank", "mdi:water-boiler", this.t("Zasobnik CWU", "DHW cylinder"), this.f(tank, 1, 1) + " °C", tank >= 45 ? "peach" : tank >= 35 ? "yellow" : "sky", (tank - 20) / 45 * 100)}
        ${this.tile("elec_power", "mdi:flash", this.t("Moc elektr.", "Electrical"), isNaN(pw) ? "–" : Math.round(Math.max(0, pw)) + " W", pw > 50 ? "yellow" : "overlay1", pw / 3500 * 100)}
      </div>
      ${this.stateChips()}`;
  }

  static styles = [HubCard.styles, css`
  .banner { cursor: pointer; display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 13px; margin-bottom: 8px; }
  .banner ha-icon { --mdc-icon-size: 24px; flex: none; }
  .bt { font-size: 13px; font-weight: 800; letter-spacing: .04em; }
  .bs { font-size: 11px; opacity: .75; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .hero { cursor: pointer; display: grid; grid-template-columns: 56px minmax(0, 1fr) auto; gap: 4px 10px; padding: 12px 14px; border-radius: 12px; min-height: 96px; }
  .hi { --mdc-icon-size: 40px; align-self: center; justify-self: center; }
  .hm { min-width: 0; }
  .hn { font-size: 12px; font-weight: 700; opacity: .65; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mode { font-size: 22px; font-weight: 800; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sub { font-size: 11.5px; opacity: .75; }
  .flow { font-size: 15px; font-weight: 800; white-space: nowrap; display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
  .copr { display: grid; grid-template-columns: repeat(auto-fit, minmax(0, 1fr)); grid-auto-flow: column; gap: 6px; margin-top: 8px; }
  .cop { cursor: pointer; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 4px 6px; border-radius: 11px; }
  /* three buttons in a narrow hero: a smaller label that wraps ("COP" over "NOW") instead of spilling over */
  .cop .cl { font-size: 8.5px; letter-spacing: .02em; text-align: center; line-height: 1.15; }
  .cl { font-size: 9.5px; font-weight: 800; opacity: .6; letter-spacing: .06em; }
  .cv { font-size: 22px; font-weight: 800; line-height: 1.1; }
  .tmr { display: flex; flex-direction: column; gap: 9px; margin-top: 8px; padding: 10px 12px; border-radius: 12px; background: rgba(var(--ih-overlay1-rgb), .06); }
  .tb { cursor: pointer; min-width: 0; }
  .tbh { display: flex; align-items: center; gap: 7px; }
  .tbh ha-icon { --mdc-icon-size: 16px; flex: none; }
  .tbl { font-size: 11.5px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .tbv { margin-left: auto; font-size: 12.5px; font-weight: 800; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .tbo { opacity: .5; font-weight: 700; }
  .tbt { height: 6px; border-radius: 3px; margin: 4px 0 3px; background: rgba(var(--ih-overlay1-rgb), .16); overflow: hidden; }
  .tbf { height: 100%; border-radius: 3px; transition: width .6s; }
  .tbf.ind { animation: ih-pulse 2s ease-in-out infinite; }
  @keyframes ih-pulse { 50% { opacity: .35; } }
  .tbs { font-size: 10.5px; opacity: .65; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sh { display: flex; align-items: baseline; gap: 8px; margin-top: 2px; min-width: 0; }
  .sh .tbs { margin-left: auto; }
  .strip { position: relative; height: 14px; border-radius: 4px; overflow: hidden; background: rgba(var(--ih-overlay1-rgb), .08); }
  .sg { position: absolute; top: 0; bottom: 0; }
  .sx { display: flex; justify-content: space-between; font-size: 9.5px; opacity: .5; font-variant-numeric: tabular-nums; margin-top: -5px; }
  .chips2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 8px; }
  .chips2 > * { min-width: 0; display: flex; }
  .chips2 > * > .chip { flex: 1; }
  .chips2 .span2 { grid-column: span 2; display: flex; }
  .chips2 .span2 > * { flex: 1; }
  .grid4 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 8px; }
`];
}

register("immergas-now-card", ImmergasNowCard, "Immergas – Teraz / Now",
  "Stan pompy ciepła: tryb, sprężarka, COP, zasilanie/powrót, banery błędu i odszraniania");
