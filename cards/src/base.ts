// Shared base for all Immergas Hub cards: hub discovery, state helpers, palette, common styles.
import { LANGS, locale, translate } from "./i18n";
import { LitElement, html, css, nothing, unsafeCSS, TemplateResult, CSSResultGroup } from "lit";
import { hubIndex, HubIndex } from "./hub";
import { Key } from "./names";

export { html, css, nothing };
export type { TemplateResult };

// Catppuccin Mocha by default; a Catppuccin theme in HA overrides it automatically.
const PALETTE: Record<string, string> = {
  red: "243,139,168", peach: "250,179,135", yellow: "249,226,175", green: "166,227,161", teal: "148,226,213",
  sky: "137,220,235", sapphire: "116,199,236", blue: "137,180,250", lavender: "180,190,254", mauve: "203,166,247",
  overlay1: "127,132,156", overlay2: "147,153,178",
};
const paletteCss = Object.entries(PALETTE)
  .map(([n, rgb]) => `--ih-${n}: var(--catppuccin-${n}, rgb(${rgb})); --ih-${n}-rgb: var(--catppuccin-${n}-rgb, ${rgb});`)
  .join("\n");

/** messages one card leaves for another on the same dashboard (e.g. the top Calibration recommendation for the
 *  diagram); `rec.ok` = nothing to change */
export const hubNote: { rec?: { text: string; reason: string; ok: boolean; entity?: string; at: number } } = {};

/** color var */
export const c = (n: string) => `var(--ih-${n})`;
/** translucent color */
export const ca = (n: string, a: number) => `rgba(var(--ih-${n}-rgb), ${a})`;
/** chip/box style: tinted background + border, glowing when hot */
export const box = (col: string, hot = false, dashed = false) =>
  `background:${ca(col, hot ? 0.24 : 0.08)};border:1px ${dashed ? "dashed" : "solid"} ${ca(col, hot ? 0.6 : 0.22)};${hot ? `box-shadow:0 0 10px ${ca(col, 0.35)};` : ""}`;

// Boiler-side settings that are not on any bus (night window U12/U13, anti-legionella day/time/duration, floor flow
// limit) come from the hub's own config entities (package hub_boiler_params). A card option (entity or literal) set
// on any card of the dashboard overrides them and is shared by the other cards.
const SHARED_OPTS = ["night_start", "night_stop", "legionella_day", "legionella_time", "legionella_hours", "max_floor_entity"];
const HUB_OPTS: Record<string, Key> = {
  night_start: "u12", night_stop: "u13", legionella_time: "p16", legionella_day: "p17", legionella_hours: "p13", max_floor_entity: "floor_max",
};
const shared: Record<string, string> = {};
const DAYS: [string[], string, string][] = [
  [["nd", "niedz", "nie", "sun", "su"], "nd", "Sun"], [["pn", "pon", "mon", "mo"], "pn", "Mon"], [["wt", "wto", "tue", "tu"], "wt", "Tue"],
  [["śr", "sr", "wed", "we"], "śr", "Wed"], [["cz", "czw", "thu", "th"], "cz", "Thu"], [["pt", "pią", "pia", "fri", "fr"], "pt", "Fri"],
  [["so", "sob", "sat", "sa"], "so", "Sat"],
];

export abstract class HubCard extends LitElement {
  static properties = { hass: { attribute: false }, config: { attribute: false } };
  hass: any;
  config: any = {};
  protected idx: HubIndex | null = null;
  private armed: Record<string, number> = {};

  setConfig(config: any) {
    this.config = config || {};
    for (const k of SHARED_OPTS) if (this.config[k]) shared[k] = this.config[k];
  }
  /** card option, falling back to the same option set on another card of the dashboard, then to the hub entity */
  protected opt(k: string): string | undefined { return this.config[k] ?? shared[k] ?? (HUB_OPTS[k] ? this.eid(HUB_OPTS[k]) : undefined); }
  /** time option ("HH:MM" literal or entity state) -> minutes of the day */
  protected timeOpt(k: string): number | null {
    const o = this.opt(k), v = o ? String(this.hass.states[o]?.state ?? o) : "";
    return /^\d\d?:\d\d/.test(v) ? +v.split(":")[0] * 60 + +v.split(":")[1].slice(0, 2) : null;
  }
  /** day option (weekday name PL/EN, 1-7 = Mon-Sun, or daily) -> 0 Sun .. 6 Sat, -1 daily */
  protected dayOpt(k: string): number | null {
    const o = this.opt(k), st = o ? this.hass.states[o] : undefined, v = o ? String(st?.state ?? o).toLowerCase().trim() : "";
    if (!v) return null;
    // the hub select (any language): option 0 = daily, 1-7 = Monday-Sunday
    const opts = st?.attributes?.options;
    if (Array.isArray(opts) && opts.length === 8 && opts.includes(st.state)) { const i = opts.indexOf(st.state); return i === 0 ? -1 : i % 7; }
    if (/^(codzien|daily|every|0$)/.test(v)) return -1;
    if (/^[1-7]$/.test(v)) return +v % 7;
    const i = DAYS.findIndex(([p]) => p.some((x) => v.startsWith(x)));
    return i >= 0 ? i : null;
  }
  /** P13 - max duration of the anti-legionella cycle in hours (number literal or entity, e.g. input_number); default 3 */
  protected legHours(): number {
    const o = this.opt("legionella_hours"), v = o === undefined ? NaN : parseFloat(String(this.hass.states[o]?.state ?? o));
    return v >= 1 && v <= 24 ? v : 3;
  }
  protected dayName(d: number | null) { return d === null ? "–" : d < 0 ? this.t("codziennie", "daily") : this.t(DAYS[d][1], DAYS[d][2]); }
  /** next anti-legionella start after t (needs the time option; day defaults to daily) */
  protected nextLeg(t: number): number {
    const tm = this.timeOpt("legionella_time"), d = this.dayOpt("legionella_day") ?? -1;
    if (tm === null) return NaN;
    const x = new Date(t); x.setHours(0, 0, 0, 0);
    for (let i = 0; i < 8; i++) {
      const c = x.getTime() + i * 86400e3 + tm * 60000;
      if (c > t && (d < 0 || new Date(c).getDay() === d)) return c;
    }
    return NaN;
  }
  getCardSize() { return 4; }

  /** UI language = the Home Assistant language (one of LANGS, else English) */
  protected get uiLang() { const l = String(this.hass?.locale?.language ?? this.hass?.language ?? "en").slice(0, 2); return LANGS.includes(l) ? l : "en"; }
  protected get pl() { return this.uiLang === "pl"; }
  /** locale for dates and numbers */
  protected get loc() { return locale(this.uiLang); }
  protected t(pl: string, en: string) { return translate(this.uiLang, pl, en); }

  protected eid(k: Key) { return this.idx?.ids[k]; }
  protected so(k: Key) { const i = this.eid(k); return i ? this.hass.states[i] : undefined; }
  protected s(k: Key): string | undefined { return this.so(k)?.state; }
  protected n(k: Key): number { return parseFloat(this.s(k) ?? ""); }
  protected on(k: Key) { return this.s(k) === "on"; }
  protected bad(k: Key) { const v = this.s(k); return v === undefined || v === "unavailable" || v === "unknown"; }
  protected attr(k: Key, a: string) { return this.so(k)?.attributes?.[a]; }
  /** state as Home Assistant shows it (translated enum / select option), e.g. Dominus "economy" -> "Eko" */
  protected txt(k: Key): string | undefined {
    const so = this.so(k);
    return so ? this.hass.formatEntityState?.(so) ?? so.state : undefined;
  }
  /** entities come from the Immergas Dominus integration, not from the hub (reduced view, no heat-pump data) */
  protected get dominus() { return this.idx?.source === "dominus"; }
  /** Dominus in the OpenTherm mode: fewer values, no zone / schedules / statistics */
  protected get ot() { return !!this.idx?.ot; }
  /** F1/F2 write gate: locked only while the "Active ODU control" switch is exposed and off (hub v23+ keeps it armed and hidden) */
  protected get writeLocked() { return !!this.eid("f_arm") && !this.on("f_arm"); }
  /** Dominus OpenTherm "Read only (remote in charge)" is on: no control writes to the boiler */
  protected get otRO() { return this.ot && this.on("ot_ro"); }
  /** a Data-ID the last Data-ID scan found unanswered (no reply / unsupported) - its tile is left out */
  protected otMissing(id: number) {
    const a = this.so("ot_ids")?.attributes;
    return !!a && [...(a.no_reply ?? []), ...(a.unsupported ?? [])].includes(id);
  }

  /** gas boiler present (Magis Combo): option `variant` ("combo" / "pro"), else from the system model (D61); unknown = yes */
  protected get hasGas(): boolean {
    const v = this.config.variant;
    if (v) return v === "combo";
    const m = (this.s("d61") ?? "").toLowerCase();
    return m ? /combo|\(mc/.test(m) : true;
  }

  /** currency symbol: from the unit of the hub's electricity price ("zł/kWh" -> "zł"), else the HA currency */
  protected get currency(): string {
    const u = String(this.attr("price_elec", "unit_of_measurement") ?? "");
    return u.includes("/") ? u.split("/")[0] : this.hass?.config?.currency ?? "";
  }

  protected f(v: number, d = 1, min = 0) {
    return isNaN(v) ? "–" : v.toLocaleString(this.loc, { minimumFractionDigits: min, maximumFractionDigits: d });
  }

  protected moreInfo(k: Key) {
    const entityId = this.eid(k);
    if (!entityId) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
  }
  protected call(domain: string, service: string, k: Key, data: Record<string, unknown> = {}) {
    const entity_id = this.eid(k);
    if (entity_id) this.hass.callService(domain, service, { entity_id, ...data });
  }
  /** two-tap confirm: first tap arms for 4 s, second tap runs */
  protected confirm(tag: string, run: () => void) {
    if (this.armed[tag] && Date.now() - this.armed[tag] < 4000) { delete this.armed[tag]; run(); }
    else { this.armed[tag] = Date.now(); setTimeout(() => this.requestUpdate(), 4100); }
    this.requestUpdate();
  }
  protected isArmed(tag: string) { return !!this.armed[tag] && Date.now() - this.armed[tag] < 4000; }

  protected abstract body(): TemplateResult;

  render() {
    if (!this.hass) return nothing;
    this.idx = hubIndex(this.hass, () => this.requestUpdate(), this.config.source);
    // ot_preview: {card key: entity_id} - shows the OpenTherm variant with stand-in entities (a preview without a VICTRIX)
    if (this.idx && this.config.ot_preview && typeof this.config.ot_preview === "object")
      this.idx = { ...this.idx, ot: true, ids: { ...this.idx.ids, ...this.config.ot_preview } };
    if (!this.idx) {
      return html`<ha-card><div class="empty">${this.t("Szukam huba Immergas… (urządzenie z encją „Immergas Hub - Stan pracy”) albo integracji Immergas Dominus",
        "Looking for the Immergas hub… (device with the “Immergas Hub - Operating state” entity) or the Immergas Dominus integration")}</div></ha-card>`;
    }
    return html`<ha-card>${this.body()}</ha-card>`;
  }

  /** compact setting row: label, −/+ stepper using the entity's step/min/max, value with unit */
  /** a declared boiler parameter (Dominus) has a value - they start empty until copied from the boiler menu */
  protected isSet(k: Key) { return !!this.eid(k) && !this.bad(k); }
  /** all given parameters are set */
  protected allSet(...ks: Key[]) { return ks.every((k) => this.isSet(k)); }
  /** typical value offered as the starting point of an empty declared parameter */
  protected suggested(k: Key): unknown { return this.attr(k, "suggested"); }

  protected numRow(k: Key, icon: string, label: string, d = 1, unit?: string) {
    const so = this.so(k);
    if (!so) return nothing;
    const a = so.attributes ?? {}, v = parseFloat(so.state), step = a.step ?? 1, u = unit ?? a.unit_of_measurement ?? "";
    const sug = parseFloat(String(a.suggested ?? "")), empty = isNaN(v) && !isNaN(sug), ro = this.otRO;
    const set = (dir: number) => {
      if (ro) return;
      // an empty declared parameter: the first tap writes the suggested value as the starting point
      if (empty) return this.call("number", "set_value", k, { value: sug });
      if (isNaN(v)) return;
      const nv = Math.round(Math.min(a.max ?? 1e9, Math.max(a.min ?? -1e9, v + dir * step)) * 1e4) / 1e4;
      this.call("number", "set_value", k, { value: nv });
    };
    return html`<div class="nr" style=${empty ? "opacity:.55" : ""}><ha-icon icon=${icon}></ha-icon><span class="nl" @click=${() => this.moreInfo(k)}>${label}${empty
        ? html`<span class="unset">${this.t("nie ustawione – wpisz z pieca", "not set – enter it from the boiler")}</span>` : nothing}</span>
      <div class="btn xs" style=${ro ? "opacity:.35;cursor:default" : ""} @click=${() => set(-1)}><ha-icon icon=${ro ? "mdi:lock-outline" : "mdi:minus"}></ha-icon></div>
      <span class="nv" style=${empty ? "opacity:.45;font-weight:600" : ""}>${this.f(empty ? sug : v, d, d)}${u ? " " + u : ""}</span>
      <div class="btn xs" style=${ro ? "opacity:.35;cursor:default" : ""} @click=${() => set(1)}><ha-icon icon=${ro ? "mdi:lock-outline" : "mdi:plus"}></ha-icon></div></div>`;
  }

  protected ago(k: Key) {
    const lc = this.so(k)?.last_changed;
    if (!lc) return "";
    const m = Math.max(0, (Date.now() - new Date(lc).getTime()) / 60000);
    return m < 60 ? Math.round(m) + " min" : Math.floor(m / 60) + " h " + Math.round(m % 60) + " min";
  }

  protected switchRow(k: Key, icon: string, col: string, name: string, sub: string | TemplateResult) {
    const act = this.on(k), dis = this.writeLocked || this.bad(k) || this.otRO, tag = "sw_" + k, conf = this.isArmed(tag);
    return html`<div class="sr" style=${box(col, act)}>
      <ha-icon icon=${icon} style="color:${c(act ? col : "overlay2")}"></ha-icon>
      <div class="cx" @click=${() => this.moreInfo(k)} style="cursor:pointer">
        <div class="sn">${name} <span style="font-weight:700;color:${c(act ? col : "overlay2")}">· ${this.bad(k) ? this.t("brak odczytu", "no reading")
          : act ? this.t("WŁĄCZONY od ", "ON for ") + this.ago(k) : this.t("wyłączony", "off")}</span></div>
        ${conf || sub ? html`<div class="ss">${conf ? this.t("dotknij ponownie, aby potwierdzić", "tap again to confirm") : sub}</div>` : nothing}</div>
      <div class="tgl ${dis ? "dis" : ""}"
        style="background:${act ? ca(col, 0.35) : "rgba(255,255,255,.08)"};${act ? `box-shadow:0 0 8px ${ca(col, 0.55)}` : ""}${conf ? `;outline:2px solid ${c(col)}` : ""}"
        @click=${() => !dis && this.confirm(tag, () => this.call("switch", act ? "turn_off" : "turn_on", k))}>
        <div class="kn" style="left:${act ? 23 : 3}px;background:${act ? c(col) : c("overlay1")}">${dis ? html`<ha-icon icon="mdi:lock"></ha-icon>` : nothing}</div></div></div>`;
  }

  /** F1/F2 controls: outing mode + FR (two-tap), with an Arm button only on older hubs that expose the write gate */
  protected f1f2Rows() {
    const lim = this.n("f_lim"), hz = this.n("hz"), locked = this.writeLocked, aBad = this.s("f_nasa") === "off";
    // compressor capacity limit from the boiler (D+/D-): 100 % = not limited
    const cap = this.n("cap_limit"), capCol = cap >= 100 ? "green" : cap >= 70 ? "yellow" : "peach";
    const capTxt = isNaN(cap) ? nothing : html`<span class="capl" style="color:${c(capCol)}" @click=${(e: Event) => { e.stopPropagation(); this.moreInfo("cap_limit"); }}>${this.t("wydajność", "capacity")} ${Math.round(cap)} %</span> · `;
    if (!this.eid("f_outing") && !this.eid("f_fr")) return nothing;
    return html`
      ${aBad ? html`<div class="warn">${this.t("Połączenie NASA wyłączone – sterowanie niedostępne", "NASA connection off – control unavailable")}</div>`
        : locked ? html`<div class="arm" style="${box("overlay2", false, true)}">
          <ha-icon icon="mdi:lock" style="color:${c("overlay2")}"></ha-icon>
          <div class="cx"><div class="at">${this.t("Zapis zablokowany", "Write locked")}</div>
            <div class="as">${this.t("starszy hub: uzbrój „Aktywne sterowanie ODU” (hub v23+ trzyma zapis stale włączony)", "older hub: arm “Active ODU control” (hub v23+ keeps writing enabled)")}</div></div>
          <div class="ab" style="background:${ca("peach", 0.08)};border:1px solid ${ca("peach", 0.22)}" @click=${() => this.confirm("arm", () => this.call("switch", "turn_on", "f_arm"))}>
            <ha-icon icon="mdi:lock-open-variant" style="color:${c("peach")}"></ha-icon>${this.isArmed("arm") ? this.t("Potwierdź", "Confirm") : this.t("Uzbrój", "Arm")}</div></div>` : nothing}
      ${this.switchRow("f_outing", "mdi:bag-suitcase-outline", "teal", this.t("Tryb wyjazdowy", "Outing mode"), "")}
      ${this.switchRow("f_fr", "mdi:speedometer-slow", "mauve", this.t("Ograniczenie sprężarki", "Compressor limit"),
        html`${capTxt}${this.t(`limit ${this.f(lim)} Hz · teraz ${this.f(hz)} Hz – cichsza praca, mniejsza moc`, `limit ${this.f(lim)} Hz · now ${this.f(hz)} Hz – quieter, less power`)}`)}`;
  }

  /** CH heat source: AUTO (integration allowed) / boiler (force boiler heating, TT 4449) / heat pump (I02 integration OFF) */
  /** CH heat source state and setter: auto | boiler | hp (shared by the source row and the Calibration card) */
  protected coSource() {
    const fb = this.on("force_boiler"), i02 = this.s("i02"), bad = this.bad("force_boiler") && this.bad("i02");
    const cur = fb ? "boiler" : i02 === "off" ? "hp" : "auto";
    const set = (m: string) => {
      if (m === "boiler") { this.call("switch", "turn_on", "force_boiler"); return; }
      if (fb) this.call("switch", "turn_off", "force_boiler");
      if (m === "hp" && i02 !== "off") this.call("switch", "turn_off", "i02");
      if (m === "auto" && i02 === "off") this.call("switch", "turn_on", "i02");
    };
    return { cur, set, bad, has: !!(this.eid("force_boiler") || this.eid("i02")) };
  }
  /** DHW heat source state and setter: auto | boiler | hp */
  protected dhwSource() {
    const i01 = this.s("i01"), i03 = this.n("i03"), bad = this.bad("i01"), wait = this.config.dhw_auto_wait ?? 15;
    const cur = i01 !== "on" ? "hp" : !isNaN(i03) && i03 <= 5 ? "boiler" : "auto";
    const set = (m: string) => {
      if (m === "hp") { this.call("switch", "turn_off", "i01"); return; }
      const w = m === "boiler" ? 1 : wait;
      if (this.n("i03") !== w) this.call("number", "set_value", "i03", { value: w });
      if (i01 !== "on") this.call("switch", "turn_on", "i01");
    };
    return { cur, set, bad, has: !!this.eid("i01"), i03 };
  }

  protected sourceRow() {
    if (!this.eid("force_boiler") && !this.eid("i02")) return nothing;
    const { cur, set, bad } = this.coSource();
    const opts: [string, string, string, string][] = [["auto", "mdi:autorenew", "green", "AUTO"],
      ["boiler", "mdi:fire", "peach", this.t("Grzanie kotłem", "Boiler heating")], ["hp", "mdi:heat-pump", "teal", this.t("Grzanie pompą", "Heat pump heating")]];
    const sub = cur === "boiler" ? this.t("wymuszone przez BMS (4449) – pompa stoi, grzeje kocioł", "forced via BMS (4449) – the heat pump stops, the boiler heats")
      : cur === "hp" ? this.t("bez dogrzewania kotłem (I02 OFF) – uwaga przy mrozie", "no boiler assistance (I02 OFF) – mind frosty days")
      : this.t("kocioł dołącza wg integracji (I02 AL, I04, I10)", "the boiler joins by the integration rules (I02 AL, I04, I10)");
    return this.srcBlock("co", this.t("Źródło ciepła CO", "CH heat source"), bad ? this.t("brak odczytu", "no reading") : sub, opts, cur, set, bad);
  }

  /** DHW heat source: AUTO (I01 AL, the boiler joins after I03 = dhw_auto_wait min, default 15 = Immergas default) /
   *  boiler (I01 AL, I03 = 1 min - the boiler takes over at once) / heat pump only (I01 OFF) */
  protected dhwSourceRow() {
    if (!this.eid("i01")) return nothing;
    const { cur, set, bad, i03 } = this.dhwSource();
    const opts: [string, string, string, string][] = [["auto", "mdi:autorenew", "green", "AUTO"],
      ["boiler", "mdi:fire", "peach", this.t("Grzanie kotłem", "Boiler heating")], ["hp", "mdi:heat-pump", "teal", this.t("Grzanie pompą", "Heat pump heating")]];
    const sub = cur === "hp" ? this.t("tylko pompa ciepła (I01 OFF)", "heat pump only (I01 OFF)")
      : cur === "boiler" ? this.t(`kocioł przejmuje od razu (I01 AL, I03 = ${this.f(i03, 0)} min)`, `the boiler takes over at once (I01 AL, I03 = ${this.f(i03, 0)} min)`)
      : this.t(`pompa, kocioł dołącza po ${this.f(i03, 0)} min (I01 AL, I03)`, `heat pump, the boiler joins after ${this.f(i03, 0)} min (I01 AL, I03)`);
    return this.srcBlock("dhw", this.t("Źródło ciepła CWU", "DHW heat source"), bad ? this.t("brak odczytu", "no reading") : sub, opts, cur, set, bad);
  }

  protected srcBlock(tagp: string, title: string, sub: string, opts: [string, string, string, string][], cur: string, set: (m: string) => void, bad: boolean) {
    const curCol = opts.find((o) => o[0] === cur)?.[2] ?? "overlay2";
    return html`<div class="src" style=${box(curCol, cur !== "auto")}>
      <div class="sh2"><span class="sn">${title}</span><span class="ss">${sub}</span></div>
      <div class="sbs" style="grid-template-columns:repeat(${opts.length}, minmax(0, 1fr))">${opts.map(([id, icon, col, lbl]) => {
        const on = id === cur, tag = tagp + "_" + id, conf = this.isArmed(tag);
        return html`<div class="sb" style=${on ? `background:${ca(col, 0.28)};border-color:${ca(col, 0.7)};color:${c(col)}` : conf ? `outline:2px solid ${c(col)}` : ""}
          @click=${() => !on && !bad && this.confirm(tag, () => set(id))}><ha-icon icon=${icon} style="color:${c(col)}"></ha-icon>${conf ? this.t("Potwierdź", "Confirm") : lbl}</div>`;
      })}</div></div>`;
  }

  /** compact two-column toggles (two-tap confirm); items whose entity is missing are skipped */
  /** two-column grid of switches (two-tap confirm); optional sub line, `wide` spans both columns.
   *  A two-option select works as a switch too: the second option (TAK / Auto) is "on". */
  protected toggles(items: [Key, string, string, string, (string | TemplateResult)?, boolean?][]) {
    const its = items.filter(([k]) => this.eid(k));
    if (!its.length) return nothing;
    return html`<div class="tgs">${its.map(([k, icon, col, label, sub, wide]) => {
      const sel = this.eid(k)!.startsWith("select."), opts: string[] = sel ? this.attr(k, "options") ?? [] : [];
      // the read-only switch itself stays usable; everything else is locked while it is on
      const on = sel ? this.s(k) === opts[1] : this.on(k), bad = this.bad(k) || (sel && opts.length !== 2) || (this.otRO && k !== "ot_ro"), tag = "tg_" + k, conf = this.isArmed(tag);
      const flip = () => sel ? this.call("select", "select_option", k, { option: opts[on ? 0 : 1] }) : this.call("switch", on ? "turn_off" : "turn_on", k);
      return html`<div class="tgi ${wide ? "wide" : ""}" style=${on ? `background:${ca(col, 0.2)};border-color:${ca(col, 0.55)}` : ""}>
        <ha-icon icon=${icon} style="color:${c(on ? col : "overlay2")}" @click=${() => this.moreInfo(k)}></ha-icon>
        <div class="tgx" @click=${() => this.moreInfo(k)}><div class="tgl2">${conf ? this.t("Potwierdź – dotknij ponownie", "Confirm – tap again") : label}</div>
          ${sub ? html`<div class="tgs2">${sub}</div>` : nothing}</div>
        <div class="tgl ${bad ? "dis" : ""}" style="background:${on ? ca(col, 0.35) : "rgba(255,255,255,.08)"}${conf ? `;outline:2px solid ${c(col)}` : ""}"
          @click=${() => !bad && this.confirm(tag, flip)}>
          <div class="kn" style="left:${on ? 23 : 3}px;background:${on ? c(col) : c("overlay1")}"></div></div></div>`;
    })}</div>`;
  }

  /** inline drop-down for a hub select ("label: [option]"), e.g. a source shown under a switch; nothing when missing */
  protected selPick(k: Key, label: string) {
    const st = this.so(k), opts: string[] = this.attr(k, "options") ?? [];
    if (!st || !opts.length) return nothing;
    return html`<span class="pick" @click=${(e: Event) => e.stopPropagation()}>${label}:
      <select .value=${st.state} ?disabled=${this.bad(k)}
        @change=${(e: Event) => { const o = (e.target as HTMLSelectElement).value; if (o !== st.state) this.call("select", "select_option", k, { option: o }); }}>
        ${opts.map((o) => html`<option .value=${o} ?selected=${o === st.state}>${o}</option>`)}</select></span>`;
  }

  /** small uppercase section header */
  protected head(icon: string, title: string, right?: TemplateResult | string) {
    return html`<div class="head"><ha-icon icon=${icon}></ha-icon><span class="ttl">${title}</span>${right ? html`<span class="right">${right}</span>` : nothing}</div>`;
  }
  /** info chip: icon + small label + value, tinted by color */
  protected chip(k: Key | undefined, icon: string, col: string, label: string, value: string, hot = false) {
    return html`<div class="chip" style=${box(col, hot)} @click=${() => k && this.moreInfo(k)}>
      <ha-icon icon=${icon} style="color:${c(col)}"></ha-icon>
      <div class="cx"><div class="lbl">${label}</div><div class="val" style="color:${c(col)}">${value}</div></div></div>`;
  }
  /** tile with fill bar (value position between lo..hi) */
  protected tile(k: Key, icon: string, label: string, value: string, col: string, fill?: number) {
    const p = fill === undefined || isNaN(fill) ? 0 : Math.max(3, Math.min(100, fill));
    const bg = fill === undefined ? `background:${ca(col, 0.08)}` :
      `background:linear-gradient(90deg, ${ca(col, 0.3)} 0%, ${ca(col, 0.3)} ${p}%, ${ca("overlay1", 0.06)} ${p}%)`;
    // tinted outline like the chips below, so the fill-bar tiles match the newer card style
    return html`<div class="tile" style=${bg + `;border:1px solid ${ca(col, 0.35)}`} @click=${() => this.moreInfo(k)}>
      <ha-icon icon=${icon} style="color:${c(col)}"></ha-icon>
      <div class="cx"><div class="lbl">${label}</div><div class="tv">${value}</div></div></div>`;
  }

  static styles: CSSResultGroup = css`
    :host { ${unsafeCSS(paletteCss)} }
    *, *::before, *::after { box-sizing: border-box; }
    ha-card { padding: 12px 14px; }
    .empty { padding: 8px; opacity: .6; font-size: 12px; }
    .head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .head ha-icon { --mdc-icon-size: 18px; opacity: .55; }
    .head .ttl { font-size: 10.5px; font-weight: 800; opacity: .55; letter-spacing: .08em; text-transform: uppercase; }
    .head .right { margin-left: auto; font-size: 10.5px; opacity: .55; }
    .row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
    .capl { cursor: pointer; font-weight: 800; }
    .chip { cursor: pointer; flex: 1 1 calc(50% - 4px); min-width: 0; display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 12px; }
    .chip ha-icon, .tile ha-icon { --mdc-icon-size: 18px; flex: none; }
    .cx { min-width: 0; flex: 1; }
    .lbl { font-size: 9.5px; font-weight: 800; opacity: .55; letter-spacing: .05em; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .val { font-size: 12.5px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .grid { display: grid; gap: 8px; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); }
    .tile { cursor: pointer; display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 12px; min-width: 0; }
    .tv { font-size: 14px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .note { font-size: 10.5px; opacity: .55; margin-top: 6px; }
    .btn { cursor: pointer; flex: none; width: 30px; height: 30px; border-radius: 10px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.08); }
    .btn ha-icon { --mdc-icon-size: 18px; }
    .btn.off { opacity: .35; cursor: default; }
    .nr { display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: 12px; }
    .nr > ha-icon { --mdc-icon-size: 16px; opacity: .55; flex: none; }
    .nl { cursor: pointer; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .unset { display: block; font-size: 10px; font-weight: 600; color: var(--ih-yellow); white-space: normal; }
    .nv { min-width: 78px; text-align: center; font-weight: 800; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .btn.xs { width: 24px; height: 24px; border-radius: 8px; }
    .btn.xs ha-icon { --mdc-icon-size: 14px; }
    .gear { cursor: pointer; flex: none; width: 26px; height: 26px; border-radius: 8px; display: flex; align-items: center; justify-content: center; opacity: .5; }
    .gear:hover, .gear.on { opacity: 1; background: rgba(255,255,255,.06); }
    .gear ha-icon { --mdc-icon-size: 16px; }
    .setp { margin-top: 8px; padding: 6px 10px; border-radius: 12px; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.07); }
    .warn { font-size: 11px; color: var(--ih-yellow); margin-bottom: 4px; }
    .arm { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 14px; }
    .arm > ha-icon { --mdc-icon-size: 24px; flex: none; }
    .at { font-size: 13px; font-weight: 800; }
    .as, .ss { font-size: 10.5px; opacity: .6; }
    .ab { cursor: pointer; flex: none; display: flex; align-items: center; gap: 5px; padding: 6px 11px; border-radius: 11px; font-size: 11px; font-weight: 800; }
    .ab ha-icon { --mdc-icon-size: 15px; }
    .sr { display: flex; align-items: center; gap: 10px; padding: 9px 11px; border-radius: 13px; margin-top: 8px; }
    .sr > ha-icon { --mdc-icon-size: 22px; flex: none; }
    .sn { font-size: 12.5px; font-weight: 800; }
    .tgl { cursor: pointer; flex: none; width: 44px; height: 24px; border-radius: 12px; position: relative; }
    .tgl.dis { cursor: not-allowed; opacity: .4; }
    .kn { position: absolute; top: 3px; width: 18px; height: 18px; border-radius: 50%; transition: left .2s; display: flex; align-items: center; justify-content: center; }
    .kn ha-icon { --mdc-icon-size: 11px; color: var(--ha-card-background, #1e1e2e); }
    .src { margin-top: 8px; padding: 9px 11px; border-radius: 13px; }
    .sh2 { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
    .sbs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 7px; }
    .sb { cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; padding: 7px 4px; border-radius: 10px; font-size: 11px; font-weight: 800;
      background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); min-width: 0; text-align: center; line-height: 1.15; }
    .sb ha-icon { --mdc-icon-size: 15px; flex: none; }
    .tgs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; margin-top: 8px; }
    .tgi { display: flex; align-items: center; gap: 7px; padding: 6px 8px; border-radius: 11px; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.07); min-width: 0; }
    .tgi > ha-icon { --mdc-icon-size: 17px; flex: none; cursor: pointer; }
    .tgi.wide { grid-column: 1 / -1; }
    .tgx { flex: 1; min-width: 0; cursor: pointer; }
    .tgl2 { font-size: 11.5px; font-weight: 700; line-height: 1.2; }
    .tgs2 { font-size: 9.5px; opacity: .6; line-height: 1.2; margin-top: 1px; }
    .pick { display: inline-flex; align-items: center; gap: 4px; flex-wrap: wrap; opacity: 1; }
    .pick select { cursor: pointer; padding: 1px 4px; border-radius: 6px; font: inherit; font-size: 10.5px; font-weight: 800; color: inherit;
      background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.18); max-width: 100%; }
    .pick option { color: #1e1e2e; }
    @keyframes ih-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes ih-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
  `;
}

/** registers a card element + card picker entry */
export function register(tag: string, cls: CustomElementConstructor, name: string, description: string) {
  if (!customElements.get(tag)) customElements.define(tag, cls);
  (window as any).customCards = (window as any).customCards || [];
  // the bundle can be loaded twice (hub cards resource + the copy shipped with the Dominus integration)
  if (!(window as any).customCards.some((x: any) => x.type === tag)) (window as any).customCards.push({ type: tag, name, description, preview: true });
}
