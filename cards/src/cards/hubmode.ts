// "Tryb pracy (hub) / Operating mode (hub)": the boiler mode of the gb_ / ot_ packages as four buttons (Standby /
// Summer / Winter / CH only, two-tap confirm) like the Immergas mode card, the boiler state chips and the limits.
//   gb_: the "Operating mode" select (standby / DHW only / heating / heating + DHW), heat request, upper power limit.
//   ot_: no mode select - the mode is the pair CH enable + DHW enable (Data-ID 0 master flags); max. CH setpoint (57),
//        max. modulation (14); gateway: who sets the flags (room unit or the hub with "Override CH and DHW enable").
// The entities are found by their names in the packages (any name prefix, PL / EN), no hub device needed.
// Options: family: gb | ot (default: the first one found); entities: {key: entity_id} overrides.
import { HubCard, html, css, nothing, c, ca, box, register } from "../base";
import { findPkg, setNumber, setSwitch } from "../hubpkg";

type K = "mode" | "ch_en" | "dhw_en" | "ch" | "dhw" | "flame" | "req" | "power" | "max_ch" | "max_mod" | "room" | "ov_flags" | "standalone" | "fault";
type Fam = "gb" | "ot";
type Mode = "standby" | "summer" | "winter" | "ch";

const FAM: Record<Fam, { anchor: string[]; dom: RegExp; names: Partial<Record<K, string[]>> }> = {
  gb: { anchor: ["Tryb pracy", "Operating mode"], dom: /^(select|input_select)\./, names: {
    ch: ["CO dozwolone", "CH allowed"], dhw: ["CWU dozwolona", "DHW allowed"], flame: ["Płomień", "Flame"],
    req: ["Żądanie grzania (CO)", "Heat request (CH)"], power: ["Górny limit mocy", "Upper power limit"], fault: ["Usterka", "Fault"] } },
  ot: { anchor: ["Zezwolenie CO", "CH enable"], dom: /^(switch|input_boolean)\./, names: {
    dhw_en: ["Zezwolenie CWU", "DHW enable"], ch: ["CO aktywne", "CH active"], dhw: ["CWU aktywna", "DHW active"], flame: ["Płomień", "Flame"],
    max_ch: ["Maks. nastawa CO", "Max. CH setpoint"], max_mod: ["Maks. modulacja", "Max. modulation"],
    room: ["Połączenie z pilotem", "Room unit connection"], ov_flags: ["Nadpisz zezwolenia CO i CWU", "Override CH and DHW enable"],
    standalone: ["Hub prowadzi kocioł", "Hub runs the boiler"] } },
};
// gb select options by name (stand-in helpers) or by position in the package (standby, DHW only, heating, heating + DHW)
const BY_NAME: Record<string, Mode> = { off: "standby", standby: "standby", water: "summer", dhw: "summer", heating_water: "winter", heating: "ch" };
const BY_POS: Mode[] = ["standby", "summer", "ch", "winter"];

class ImmergasHubModeCard extends HubCard {
  private m: Partial<Record<K, string>> = {};
  private fam: Fam = "gb";

  private st(k: K) { const id = this.m[k]; return id ? this.hass.states[id]?.state : undefined; }
  private is(k: K) { return this.st(k) === "on"; }
  private v(k: K) { return parseFloat(this.st(k) ?? ""); }
  private more(k: K) {
    const entityId = this.m[k];
    if (entityId) this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
  }

  /** gb: mode -> select option */
  private gbOption(md: Mode): string | undefined {
    const opts: string[] = this.hass.states[this.m.mode!]?.attributes?.options ?? [];
    const byName = opts.find((o) => BY_NAME[o] === md);
    return byName ?? (opts.length === 4 ? opts[BY_POS.indexOf(md)] : undefined);
  }
  private get current(): Mode | null {
    if (this.fam === "gb") {
      const s = this.st("mode"), opts: string[] = this.hass.states[this.m.mode!]?.attributes?.options ?? [];
      if (!s) return null;
      return BY_NAME[s] ?? (opts.length === 4 && opts.includes(s) ? BY_POS[opts.indexOf(s)] : null);
    }
    const ch = this.st("ch_en"), dhw = this.st("dhw_en");
    if (!ch || !dhw || ch === "unavailable" || dhw === "unavailable") return null;
    return ch === "on" ? (dhw === "on" ? "winter" : "ch") : dhw === "on" ? "summer" : "standby";
  }
  private apply(md: Mode) {
    if (this.fam === "gb") {
      const o = this.gbOption(md), id = this.m.mode!;
      if (o) this.hass.callService(id.split(".")[0], "select_option", { entity_id: id, option: o });
      return;
    }
    setSwitch(this.hass, this.m.ch_en, md === "winter" || md === "ch");
    setSwitch(this.hass, this.m.dhw_en, md === "winter" || md === "summer");
  }

  private modes() {
    const ui: [Mode, string, string, string][] = [["standby", "Standby", "mdi:power-standby", "overlay2"], ["summer", this.t("Lato", "Summer"), "mdi:white-balance-sunny", "yellow"],
      ["winter", this.t("Zima", "Winter"), "mdi:snowflake-thermometer", "sky"], ["ch", this.t("Tylko CO", "CH only"), "mdi:radiator", "peach"]];
    const cur = this.current;
    return ui.filter(([md]) => this.fam === "ot" || !!this.gbOption(md)).map(([md, lbl, icon, col]) => {
      const sel = cur === md, tag = "hm_" + md, armed = this.isArmed(tag);
      return html`<div class="mb" style=${sel ? box(col, true) : "background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06)"}
        @click=${() => !sel && this.confirm(tag, () => this.apply(md))}>
        <ha-icon icon=${icon} style="color:${sel ? c(col) : "var(--secondary-text-color)"}"></ha-icon>
        <span style=${sel ? `color:${c(col)}` : "opacity:.7"}>${armed ? this.t("Potwierdź", "Confirm") : lbl}</span></div>`;
    });
  }

  /** state chip: on = lit in its color */
  private schip(k: K, icon: string, lbl: string, col: string, onTxt: string, offTxt: string, toggle = false) {
    if (!this.m[k]) return nothing;
    const s = this.st(k), on = s === "on", bad = !s || s === "unavailable" || s === "unknown";
    return html`<div class="chip" style=${box(on ? col : "overlay1", on)} @click=${() => toggle && !bad ? setSwitch(this.hass, this.m[k], !on) : this.more(k)}>
      <ha-icon icon=${icon} style="color:${on ? c(col) : "var(--secondary-text-color)"}"></ha-icon>
      <div class="cx"><div class="lbl">${lbl}</div><div class="val" style=${on ? `color:${c(col)}` : "opacity:.7"}>${bad ? "–" : on ? onTxt : offTxt}</div></div>
      ${toggle ? html`<ha-icon icon=${on ? "mdi:toggle-switch" : "mdi:toggle-switch-off-outline"} style="margin-left:auto;color:${on ? c(col) : "var(--secondary-text-color)"}"></ha-icon>` : nothing}</div>`;
  }
  private ctl(k: K, name: string, sub: string, col: string) {
    const id = this.m[k];
    if (!id) return nothing;
    const a = this.hass.states[id]?.attributes ?? {}, v = this.v(k), mn = +(a.min ?? 0), mx = +(a.max ?? 100), step = +(a.step ?? 1), u = a.unit_of_measurement ?? "";
    const b = (d: number, icon: string) => {
      const nv = Math.round(Math.max(mn, Math.min(mx, v + d)) * 100) / 100, dis = isNaN(v) || nv === v;
      return html`<div class="btn ${dis ? "off" : ""}" @click=${() => !dis && setNumber(this.hass, id, nv)}><ha-icon icon=${icon}></ha-icon></div>`;
    };
    return html`<div class="ctl" style="background:${ca(col, 0.07)};border:1px solid ${ca(col, 0.25)}">
      <div class="cx" @click=${() => this.more(k)} style="cursor:pointer"><div class="cn">${name}</div><div class="cs">${sub}</div></div>
      ${b(-step, "mdi:minus")}<div class="cvv" style="color:${c(col)}">${isNaN(v) ? "–" : this.f(v) + (u === "°C" ? "°" : " " + u)}</div>${b(step, "mdi:plus")}</div>`;
  }

  protected body() {
    const ot = this.fam === "ot";
    // gateway: the room unit sets the flags unless the hub overrides them (or runs the boiler alone)
    const roomOn = ot && this.is("room"), ovOn = this.is("ov_flags");
    const gw = ot && this.m.room && roomOn && !this.is("standalone");
    const hint = gw ? html`<div class="gwh" style=${box(ovOn ? "green" : "yellow", false)} @click=${() => this.confirm("ovf", () => setSwitch(this.hass, this.m.ov_flags, !ovOn))}>
        <ha-icon icon=${ovOn ? "mdi:swap-horizontal-bold" : "mdi:remote"} style="color:${c(ovOn ? "green" : "yellow")}"></ha-icon>
        <div>${ovOn ? this.t("Bramka: zezwolenia CO / CWU ustawia hub (nadpisuje pilota).", "Gateway: the hub sets CH / DHW enable (overrides the room unit).")
          : this.t("Bramka: zezwolenia CO / CWU ustawia pilot – tryb tutaj działa, gdy pilot milknie. ", "Gateway: the room unit sets CH / DHW enable – the mode here applies when it goes silent. ")}
          <b>${this.isArmed("ovf") ? this.t("Dotknij ponownie", "Tap again") : ovOn ? this.t("Oddaj pilotowi", "Give back to the room unit") : this.t("Nadpisuj z huba", "Override from the hub")}</b></div></div>` : nothing;
    const sub = ot ? this.t("OpenTherm · zezwolenia CO / CWU (Data-ID 0)", "OpenTherm · CH / DHW enable (Data-ID 0)")
      : this.t("Modbus BMS · tryb pracy kotła", "Modbus BMS · boiler operating mode");
    return html`
      <div class="head"><ha-icon icon="mdi:tune-variant"></ha-icon><div><div class="ttl">${this.t("Tryb pracy", "Operating mode")}</div>
        <div class="hs">${sub}</div></div><div class="right">${this.t("dotknij 2× aby zmienić", "tap 2× to change")}</div></div>
      <div class="modes">${this.modes()}</div>
      ${hint}
      <div class="row">
        ${this.schip("ch", "mdi:radiator", this.t("CO", "CH"), "peach", ot ? this.t("grzeje", "heating") : this.t("dozwolone", "allowed"), ot ? this.t("nie grzeje", "idle") : this.t("zablokowane", "blocked"))}
        ${this.schip("dhw", "mdi:water-boiler", this.t("CWU", "DHW"), "sky", ot ? this.t("grzeje", "heating") : this.t("dozwolona", "allowed"), ot ? this.t("nie grzeje", "idle") : this.t("zablokowana", "blocked"))}
        ${this.schip("flame", "mdi:fire", this.t("Płomień", "Flame"), "red", this.t("pali się", "on"), this.t("zgaszony", "off"))}
        ${this.schip("req", "mdi:fire-circle", this.t("Żądanie grzania", "Heat request"), "peach", this.t("wysyłane", "sent"), this.t("brak", "none"), true)}
      </div>
      ${this.m.max_ch || this.m.max_mod || this.m.power ? html`<div class="row">
        ${this.ctl("max_ch", this.t("Maks. nastawa CO", "Max. CH setpoint"), ot ? "Data-ID 57" : "", "red")}
        ${this.ctl("max_mod", this.t("Maks. modulacja", "Max. modulation"), "Data-ID 14", "mauve")}
        ${this.ctl("power", this.t("Górny limit mocy", "Upper power limit"), "BMS 513", "mauve")}</div>` : nothing}
      ${!ot && this.st("fault") && !/^(Brak|No fault)/i.test(this.st("fault") ?? "") ? html`<div class="hint" @click=${() => this.more("fault")}>${this.st("fault")}</div>` : nothing}`;
  }

  render() {
    if (!this.hass) return nothing;
    const want = this.config.family as Fam | undefined;
    let found: ReturnType<typeof findPkg<K>> = null;
    for (const f of (want ? [want] : ["gb", "ot"]) as Fam[]) {
      found = findPkg<K>(this.hass.states, FAM[f].anchor, FAM[f].dom, FAM[f].names);
      if (found) { this.fam = f; break; }
    }
    if (!found && want) this.fam = want;
    this.m = { ...(found?.ids ?? {}), ...(found ? { [this.fam === "gb" ? "mode" : "ch_en"]: found.anchorId } : {}), ...(this.config.entities ?? {}) };
    if (!this.m.mode && !this.m.ch_en) return html`<ha-card><div class="empty">${this.t("Szukam trybu pracy kotła huba… (pakiety gb_ albo ot_)",
      "Looking for the hub boiler mode… (gb_ or ot_ packages)")}</div></ha-card>`;
    return html`<ha-card>${this.body()}</ha-card>`;
  }

  static styles = [HubCard.styles, css`
    .head > div:nth-child(2) { min-width: 0; }
    .hs { font-size: 10px; opacity: .45; }
    .modes { display: flex; gap: 6px; }
    .mb { cursor: pointer; flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 9px 2px; border-radius: 13px; }
    .mb ha-icon { --mdc-icon-size: 20px; }
    .mb span { font-size: 11px; font-weight: 800; }
    .gwh { cursor: pointer; display: flex; gap: 8px; align-items: flex-start; margin-top: 8px; padding: 7px 10px; border-radius: 12px; font-size: 11px; line-height: 1.35; }
    .gwh ha-icon { --mdc-icon-size: 18px; flex: none; }
    .ctl { flex: 1 1 200px; display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 14px; }
    .cn { font-size: 12px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .cs { font-size: 10px; opacity: .55; }
    .cvv { min-width: 50px; text-align: center; font-size: 16px; font-weight: 800; white-space: nowrap; }
    .hint { cursor: pointer; font-size: 11px; margin-top: 8px; color: var(--ih-red); }
  `];
}

register("immergas-hub-mode-card", ImmergasHubModeCard, "Immergas – Tryb pracy kotła w hubie / Hub boiler mode",
  "Tryb pracy kotła z pakietów gb_ / ot_: Standby / Lato / Zima / Tylko CO (2× dotknięcie), stan CO / CWU / płomienia, limity");
