// "Harmonogram / Schedule": tabs CH (zone 1) / DHW and two layouts, switchable in the card:
//  - "calendars" (like the Dominus app): four calendars, each with its time ranges and the weekdays it runs on;
//  - "week": one row per day with its calendar 1-4, one calendar for all days, calendar editor below.
// Ranges: ±15 min, saved 1.2 s after the last tap. Options: target: co | cwu (initial tab), layout: calendars | week.
import { HubCard, html, css, nothing, c, ca, register } from "../base";
import { Key } from "../names";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
// Mon..Sun short weekday names in the UI locale (5 Jan 2026 is a Monday)
const dayNames = (loc: string) => [0, 1, 2, 3, 4, 5, 6].map((i) => new Date(2026, 0, 5 + i).toLocaleDateString(loc, { weekday: "short" }).replace(".", "").slice(0, 3));
const KC: Record<number, string> = { 1: "peach", 2: "mauve", 3: "sky", 4: "green" };

const mins = (s?: string) => { if (!s || !/^\d\d:\d\d/.test(s)) return null; const m = +s.slice(0, 2) * 60 + +s.slice(3, 5); return m >= 1439 ? 1440 : m; };
const hm = (m: number) => m >= 1440 ? "24:00" : String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");

class ImmergasScheduleCard extends HubCard {
  private tabT = "";
  private view = "";
  private open = 0; // calendars layout: calendar with the range editor open
  private edit = 0; // week layout: calendar in the editor (0 = today's)
  private pend: Record<string, number> = {};
  private timers: Record<string, number> = {};

  private get cwu() { return (this.tabT || this.config.target || "co") === "cwu"; }
  private sel(d: string) { return ((this.cwu ? "cwu_" : "co_") + d) as Key; }
  private tk(cal: number, z: number, x: "on" | "off") { return `k${cal}z${z}${x}` as Key; }
  private tmin(cal: number, z: number, x: "on" | "off") { const k = this.tk(cal, z, x); return k in this.pend ? this.pend[k] : mins(this.s(k)); }
  private ranges(cal: number) {
    const out: [number, number][] = [];
    for (let z = 1; z <= 4; z++) {
      const a = this.tmin(cal, z, "on"), b = this.tmin(cal, z, "off");
      if (a == null || b == null || a === b) continue;
      if (b > a) out.push([a, b]); else { out.push([a, 1440]); if (b > 0) out.push([0, b]); }
    }
    out.sort((x, y) => x[0] - y[0]);
    const m: [number, number][] = [];
    for (const [a, b] of out) { if (m.length && a <= m[m.length - 1][1]) m[m.length - 1][1] = Math.max(m[m.length - 1][1], b); else m.push([a, b]); }
    return m;
  }
  private kOf(d: string) {
    const opts: string[] = this.attr(this.sel(d), "options") ?? [], st = this.s(this.sel(d));
    const i = st ? opts.indexOf(st) : -1;
    return opts[0]?.startsWith("(") ? i : i + 1;
  }
  private pick(d: string, n: number) {
    const opts: string[] = this.attr(this.sel(d), "options") ?? [];
    const opt = opts[opts[0]?.startsWith("(") ? n : n - 1];
    if (opt) this.call("select", "select_option", this.sel(d), { option: opt });
  }
  private bump(cal: number, z: number, x: "on" | "off", d: number) {
    const k = this.tk(cal, z, x), cur = this.tmin(cal, z, x);
    if (cur == null) return;
    const m = Math.max(0, Math.min(1439, (cur >= 1440 ? 1439 : cur) + d));
    this.pend[k] = m;
    clearTimeout(this.timers[k]);
    this.timers[k] = window.setTimeout(() => {
      this.call("time", "set_value", k, { time: hm(m) + ":00" });
      setTimeout(() => { delete this.pend[k]; this.requestUpdate(); }, 3000);
    }, 1200);
    this.requestUpdate();
  }
  private bar(cal: number, h: number, nowM: number | null) {
    const col = KC[cal] ?? "overlay1";
    return html`<div class="bar" style="height:${h}px">
      ${[6, 12, 18].map((t) => html`<div class="tick" style="left:${t / 0.24}%"></div>`)}
      ${cal > 0 ? this.ranges(cal).map(([a, b]) => html`<div class="seg" style="left:${a / 14.4}%;width:${(b - a) / 14.4}%;background:${ca(col, 0.85)};box-shadow:0 0 8px ${ca(col, 0.5)}"></div>`) : nothing}
      ${nowM !== null ? html`<div class="now" style="left:calc(${nowM / 14.4}% - 1px)"></div>` : nothing}</div>`;
  }
  private rangeEditor(cal: number) {
    return html`<div class="zs">${[1, 2, 3, 4].map((z) => {
      const a = this.tmin(cal, z, "on"), b = this.tmin(cal, z, "off"), on = a != null && b != null && a !== b;
      const tg = (x: "on" | "off", v: number | null) => html`<div class="tg" style=${this.tk(cal, z, x) in this.pend ? `box-shadow:0 0 0 1px ${ca("yellow", 0.7)}` : ""}>
        <div class="btn sm" @click=${() => this.bump(cal, z, x, -15)}><ha-icon icon="mdi:minus"></ha-icon></div>
        <span class="tv">${v == null ? "–" : hm(v)}</span>
        <div class="btn sm" @click=${() => this.bump(cal, z, x, 15)}><ha-icon icon="mdi:plus"></ha-icon></div></div>`;
      return html`<div class="zr" style=${on ? "" : "opacity:.5"}><span class="zn">${z}</span>${tg("on", a)}<span style="opacity:.4">–</span>${tg("off", b)}</div>`;
    })}</div>`;
  }
  private pk(n: number, sel: boolean, onClick: () => void, extra = "", label?: string) {
    return html`<div class="pk ${extra}" style=${sel ? `background:${ca(KC[n], 0.25)};border:1px solid ${ca(KC[n], 0.7)};color:${c(KC[n])}` : ""} @click=${onClick}>${label ?? n}</div>`;
  }
  private axis() {
    return html`<div class="axis">${[0, 6, 12, 18, 24].map((t) => html`<span style="left:${t / 0.24}%;transform:translateX(${t === 0 ? 0 : t === 24 ? -100 : -50}%)">${t}:00</span>`)}</div>`;
  }

  // --- layout "calendars" (Dominus) ---
  private calendars(ks: number[], today: number, nowM: number) {
    const names = dayNames(this.loc), activeCal = ks[today];
    return html`<div class="cals">${[1, 2, 3, 4].map((cal) => {
      const col = KC[cal], days = DAYS.map((_, i) => ks[i] === cal), used = days.some((x) => x), isOpen = this.open === cal;
      const rs = this.ranges(cal);
      const txt = rs.length ? rs.map(([a, b]) => `${hm(a)}–${hm(b)}`).join(", ") : this.t("brak zakresów", "no ranges");
      return html`<div class="cal" style="background:${ca(col, used ? 0.08 : 0.03)};border:1px solid ${ca(col, used ? 0.3 : 0.12)}">
        <div class="ch" @click=${() => { this.open = isOpen ? 0 : cal; this.requestUpdate(); }}>
          <span class="cn" style="color:${c(col)}">${this.t("Kalendarz", "Calendar")} ${cal}</span>
          <span class="ct">${txt}</span>
          <ha-icon icon=${isOpen ? "mdi:chevron-up" : "mdi:pencil-outline"}></ha-icon></div>
        ${this.bar(cal, 10, cal === activeCal ? nowM : null)}
        <div class="days">${DAYS.map((d, i) => html`<div class="day" style=${days[i] ? `background:${ca(col, 0.28)};border-color:${ca(col, 0.7)};color:${c(col)}` : ""}
          @click=${() => !days[i] && this.pick(d, cal)}
          title=${days[i] ? "" : this.t(`przenieś ${names[i]} do kalendarza ${cal}`, `move ${names[i]} to calendar ${cal}`)}>
          ${names[i]}${i === today ? html`<span class="td"></span>` : nothing}</div>`)}</div>
        ${isOpen ? this.rangeEditor(cal) : nothing}</div>`;
    })}</div>${this.axis()}`;
  }

  // --- layout "week" ---
  private week(ks: number[], today: number, nowM: number) {
    const names = dayNames(this.loc), kAll = ks.every((x) => x === ks[0]) ? ks[0] : 0, cal = this.edit || ks[today] || 1;
    return html`
      ${DAYS.map((d, i) => html`<div class="wr">
        <div class="dl" style=${i === today ? `color:${c("mauve")}` : "opacity:.75"}>${names[i]}</div>
        ${this.bar(ks[i], i === today ? 14 : 10, i === today ? nowM : null)}
        <div class="picks">${[1, 2, 3, 4].map((n) => this.pk(n, n === ks[i], () => n !== ks[i] && this.pick(d, n)))}</div></div>`)}
      <div class="wax">${this.axis()}</div>
      <div class="allr"><span class="al">${this.t("Wszystkie dni", "All days")} <span style="opacity:.5">(${this.t("2× dotknij", "tap twice")})</span></span>
        <div class="picks">${[1, 2, 3, 4].map((n) => {
          const tag = "all" + n, armed = this.isArmed(tag);
          return html`<div class="pk big" style=${n === kAll ? `background:${ca(KC[n], 0.3)};border:1px solid ${ca(KC[n], 0.8)};color:${c(KC[n])}` : armed ? `outline:2px solid ${c(KC[n])}` : ""}
            @click=${() => n !== kAll && this.confirm(tag, () => this.pick("all", n))}>${armed ? "✓?" : n}</div>`;
        })}</div></div>
      <div class="ed" style="background:${ca(KC[cal], 0.06)};border:1px solid ${ca(KC[cal], 0.22)}">
        <div class="eh"><span>${this.t("Edycja kalendarza", "Edit calendar")}</span>
          <div class="picks">${[1, 2, 3, 4].map((n) => this.pk(n, n === cal, () => { this.edit = n; this.requestUpdate(); }))}</div></div>
        ${this.bar(cal, 12, null)}
        ${this.rangeEditor(cal)}</div>`;
  }

  protected body() {
    const now = new Date(), nowM = now.getHours() * 60 + now.getMinutes(), today = (now.getDay() + 6) % 7;
    const ks = DAYS.map((d) => this.kOf(d)), activeCal = ks[today];
    const active = activeCal > 0 && this.ranges(activeCal).some(([a, b]) => nowM >= a && nowM < b);
    const view = this.view || this.config.layout || "calendars", cwu = this.cwu;
    const tab = (id: string, icon: string, lbl: string, col: string) => {
      const on = (id === "cwu") === cwu;
      return html`<div class="tab" style=${on ? `background:${ca(col, 0.24)};border-color:${ca(col, 0.6)}` : ""}
        @click=${() => { this.tabT = id; this.open = 0; this.edit = 0; this.requestUpdate(); }}><ha-icon icon=${icon} style="color:${c(col)}"></ha-icon>${lbl}</div>`;
    };
    const stateTxt = cwu ? (active ? this.t("teraz w harmonogramie", "now in schedule") : this.t("teraz poza harmonogramem (Eko)", "now outside schedule (Eco)"))
      : (this.s("zone1_phase") ?? "");
    // DHW: Comfort / Eco from the DD entities (DD >= 2.4.0), else the single D05 setpoint
    const ddDhw = !!this.eid("dhw_comfort_dd") && !!this.eid("dhw_eco_dd");
    const sets = cwu
      ? ddDhw ? [["dhw_eco_dd", "mdi:leaf", this.t("Eko", "Eco")], ["dhw_comfort_dd", "mdi:sun-thermometer", this.t("Komfort", "Comfort")]]
        : [["dhw_set", "mdi:water-thermometer", this.t("Nastawa CWU", "DHW setpoint")]]
      : [["eco_heat", "mdi:leaf", this.t("Eko", "Eco")], ["comfort_heat", "mdi:sun-thermometer", this.t("Komfort", "Comfort")]];
    return html`
      <div class="top">
        <div class="tl"><ha-icon icon="mdi:calendar-clock"></ha-icon><span class="ttl">${this.t("Harmonogram", "Schedule")}</span></div>
        <div class="tabs">
          ${tab("co", "mdi:radiator", this.t("CO · Strefa 1", "CH · Zone 1"), "peach")}
          ${tab("cwu", "mdi:water-boiler", this.t("CWU", "DHW"), "sky")}
          <div class="vt" title=${view === "week" ? this.t("widok kalendarzy", "calendar view") : this.t("widok tygodnia", "week view")}
            @click=${() => { this.view = view === "week" ? "calendars" : "week"; this.requestUpdate(); }}>
            <ha-icon icon=${view === "week" ? "mdi:view-agenda-outline" : "mdi:calendar-week"}></ha-icon></div></div></div>
      <div class="st" style="color:${c(active ? "green" : "overlay2")}">${stateTxt}</div>
      ${view === "week" ? this.week(ks, today, nowM) : this.calendars(ks, today, nowM)}
      <div class="row">${sets.map(([k, icon, lbl]) => {
        const v = this.n(k as Key), a = this.so(k as Key)?.attributes ?? {}, step = a.step ?? 0.5;
        const set = (d: number) => !isNaN(v) && this.call("number", "set_value", k as Key, { value: Math.max(a.min ?? 5, Math.min(a.max ?? 60, v + d * step)) });
        return html`<div class="price" style="background:${ca("peach", 0.07)};border:1px solid ${ca("peach", 0.22)}">
          <div class="btn" @click=${() => set(-1)}><ha-icon icon="mdi:minus"></ha-icon></div>
          <div class="pc" @click=${() => this.moreInfo(k as Key)}><div class="lbl"><ha-icon icon=${icon} style="--mdc-icon-size:13px"></ha-icon> ${lbl}</div><div class="pv">${this.f(v, 1, 1)} °C</div></div>
          <div class="btn" @click=${() => set(1)}><ha-icon icon="mdi:plus"></ha-icon></div></div>`;
      })}</div>
      ${cwu && ddDhw && this.eid("dhw_sched") ? this.toggles([["dhw_sched", "mdi:calendar-clock", "peach", this.t("Komfort / Eko wg harmonogramu CWU", "Comfort / Eco by the DHW schedule"),
        this.on("dhw_sched") ? this.t("teraz ", "now ") + (this.bad("dhw_phase") ? "–" : this.s("dhw_phase")) + " · " + this.t("nastawa", "setpoint") + " " + this.f(this.n("dhw_set"), 1, 1) + " °C"
          : this.t("wył. – piec trzyma jedną nastawę CWU", "off – the boiler keeps one DHW setpoint"), true]]) : nothing}
      <div class="note">${view === "week"
        ? this.t("Wybierz kalendarz dla każdego dnia; zakresy edytujesz w polu poniżej. Zakresy kalendarzy są wspólne dla CO i CWU, przypisanie dni — osobne.",
          "Pick a calendar for each day; edit the ranges below. Calendar ranges are shared by CH and DHW, the day assignment is separate.")
        : this.t("Dotknij dnia, aby przenieść go do kalendarza; ołówek otwiera zakresy godzin. Zakresy kalendarzy są wspólne dla CO i CWU, dni tygodnia — osobne.",
          "Tap a day to move it to the calendar; the pencil opens the time ranges. Calendar ranges are shared by CH and DHW, the weekdays are separate.")}</div>`;
  }

  static styles = [HubCard.styles, css`
    .top { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
    .tl { display: flex; align-items: center; gap: 8px; }
    .tl ha-icon { --mdc-icon-size: 18px; opacity: .55; }
    .ttl { font-size: 10.5px; font-weight: 800; opacity: .55; letter-spacing: .08em; text-transform: uppercase; }
    .tabs { display: flex; gap: 6px; align-items: center; }
    .tab { cursor: pointer; display: flex; align-items: center; gap: 5px; padding: 5px 11px; border-radius: 10px; font-size: 11px; font-weight: 800;
      border: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.04); }
    .tab ha-icon { --mdc-icon-size: 15px; }
    .vt { cursor: pointer; width: 30px; height: 28px; border-radius: 9px; display: flex; align-items: center; justify-content: center;
      border: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.04); }
    .vt ha-icon { --mdc-icon-size: 17px; opacity: .8; }
    .st { font-size: 10.5px; font-weight: 800; margin: 6px 0 8px; }
    .cals { display: grid; gap: 8px; }
    .cal { padding: 8px 10px; border-radius: 13px; }
    .ch { cursor: pointer; display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .cn { font-size: 12px; font-weight: 800; white-space: nowrap; }
    .ct { flex: 1; min-width: 0; font-size: 11px; opacity: .7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
    .ch ha-icon { --mdc-icon-size: 16px; opacity: .6; }
    .bar { position: relative; border-radius: 5px; background: rgba(255,255,255,.06); }
    .tick { position: absolute; top: 0; bottom: 0; width: 1px; background: rgba(255,255,255,.12); }
    .seg { position: absolute; top: 0; bottom: 0; border-radius: 4px; }
    .now { position: absolute; top: -3px; bottom: -3px; width: 2px; background: var(--primary-text-color); border-radius: 1px; box-shadow: 0 0 6px var(--primary-text-color); }
    .days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin-top: 7px; }
    .day { cursor: pointer; position: relative; text-align: center; padding: 4px 0; border-radius: 8px; font-size: 11px; font-weight: 800;
      background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.07); }
    .td { position: absolute; top: 2px; right: 3px; width: 5px; height: 5px; border-radius: 50%; background: var(--primary-text-color); }
    .axis { position: relative; height: 13px; font-size: 9.5px; opacity: .45; margin: 4px 10px 0; }
    .axis span { position: absolute; }
    .wax .axis { margin: 2px 116px 0 32px; }
    .wr { display: grid; grid-template-columns: 24px minmax(0, 1fr) auto; gap: 8px; align-items: center; padding: 3px 0; }
    .dl { font-size: 12px; font-weight: 800; }
    .picks { display: flex; gap: 3px; }
    .pk { cursor: pointer; width: 25px; height: 22px; border-radius: 7px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800;
      background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.06); }
    .pk.big { height: 24px; }
    .allr { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
    .al { flex: 1; font-size: 11.5px; font-weight: 800; }
    .ed { margin-top: 10px; padding: 9px 10px; border-radius: 13px; }
    .eh { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; font-size: 10.5px; font-weight: 800; opacity: .8; letter-spacing: .05em; text-transform: uppercase; }
    .zs { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 6px; margin-top: 8px; }
    .zr { display: flex; align-items: center; gap: 6px; }
    .zn { font-size: 11px; font-weight: 800; opacity: .5; width: 10px; }
    .tg { display: flex; align-items: center; gap: 4px; padding: 2px; border-radius: 9px; }
    .btn.sm { width: 24px; height: 24px; border-radius: 8px; }
    .btn.sm ha-icon { --mdc-icon-size: 14px; }
    .tv { font-size: 13px; font-weight: 800; width: 42px; text-align: center; font-variant-numeric: tabular-nums; }
    .price { flex: 1 1 150px; min-width: 0; display: flex; align-items: center; gap: 6px; padding: 7px 9px; border-radius: 12px; }
    .pc { cursor: pointer; flex: 1; min-width: 0; text-align: center; }
    .pv { font-size: 13px; font-weight: 800; }
  `];
}

register("immergas-schedule-card", ImmergasScheduleCard, "Immergas – Harmonogram / Schedule",
  "Harmonogram CO strefy 1 i CWU w zakładkach; widok kalendarzy (jak Dominus) albo tygodnia, przełączany w karcie");
