// "Obieg wodny / Water circuit" and "Obieg chłodniczy / Refrigerant circuit": tile grids; "Stan urządzeń / Device states":
// the on/off flags of the outdoor unit (also under the refrigerant tiles unless `flags: false`).
import { HubCard, html, css, nothing, c, ca, register } from "../base";
import { Key } from "../names";

type Row = [Key, string, string, string, number?]; // key, icon, PL label, EN label, decimals

abstract class GridCard extends HubCard {
  protected abstract rows(): Row[];
  protected flags(): [Key, string, string][] { return []; }
  protected abstract heading(): [string, string, string];
  /** wider tiles: 12 water / 24 refrigerant tiles fill even rows (6 across two dashboard columns, 3 in one) */
  protected wide = false;

  protected val(k: Key, d = 1) {
    const so = this.so(k);
    if (!so || ["unavailable", "unknown"].includes(so.state)) return "–";
    const v = parseFloat(so.state), u = so.attributes?.unit_of_measurement ?? "";
    return isNaN(v) ? so.state : this.f(v, d) + (u ? " " + u : "");
  }
  protected colOf(k: Key): string {
    const v = this.n(k), u = this.attr(k, "unit_of_measurement");
    if (isNaN(v)) return "overlay2";
    if (u === "°C") return v < 10 ? "sky" : v < 25 ? "teal" : v < 40 ? "yellow" : v < 60 ? "peach" : "red";
    return "blue";
  }

  protected body() {
    const [icon, pl, en] = this.heading();
    const fl = this.config.flags === false ? [] : this.flags(), rows = this.rows();
    return html`
      ${this.head(icon, this.t(pl, en))}
      ${rows.length ? html`<div class="grid ${this.wide ? "wide" : ""}">${this.rows().filter(([k]) => this.eid(k)).map(([k, ic, lp, le, d]) => {
        const col = this.colOf(k);
        return html`<div class="tile" style="background:${ca(col, 0.08)};border:1px solid ${ca(col, 0.18)}" @click=${() => this.moreInfo(k)}>
          <ha-icon icon=${ic} style="color:${c(col)}"></ha-icon>
          <div class="cx"><div class="lbl">${this.t(lp, le)}</div><div class="tv">${this.val(k, d ?? 1)}</div></div></div>`;
      })}</div>` : nothing}
      ${fl.length ? html`<div class="flags ${rows.length ? "" : "cols"}">${fl.filter(([k]) => this.eid(k)).map(([k, lp, le]) => {
        const on = this.on(k), col = on ? "green" : "overlay2";
        return html`<div class="flag" style="background:${ca(col, on ? 0.2 : 0.06)};border:1px solid ${ca(col, on ? 0.5 : 0.15)};color:${on ? c(col) : "inherit"}"
          @click=${() => this.moreInfo(k)}><span class="dot" style="background:${c(col)};${on ? `box-shadow:0 0 6px ${c(col)}` : ""}"></span>${this.t(lp, le)}</div>`;
      })}</div>` : nothing}`;
  }

  static styles = [HubCard.styles, css`
    .grid.wide { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
    .flags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
    /* own card (Device states): two even rows of five, two columns on a phone */
    .flags.cols { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); }
    .flags.cols .flag { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    @media (max-width: 600px) { .flags.cols { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    .flag { cursor: pointer; display: flex; align-items: center; gap: 6px; padding: 4px 9px; border-radius: 10px; font-size: 11px; font-weight: 700; }
    .dot { width: 7px; height: 7px; border-radius: 50%; flex: none; }
  `];
}

class ImmergasWaterCard extends GridCard {
  protected heading(): [string, string, string] { return ["mdi:water-sync", "Obieg wodny", "Water circuit"]; }
  protected wide = true;
  protected rows(): Row[] {
    return [
      ["tw2", "mdi:thermometer-chevron-up", "Zasilanie PC (TW2)", "HP flow (TW2)"],
      ["tw1", "mdi:thermometer-chevron-down", "Powrót PC (TW1)", "HP return (TW1)"],
      ["hp_delta", "mdi:delta", "Delta T pompy", "HP Delta T"],
      ["flow_d20", "mdi:thermometer-lines", "Zasilanie (D20)", "Flow (D20)"],
      ["d01", "mdi:fire", "Zasilanie kotła (D01)", "Boiler flow (D01)"],
      ["boiler_ret", "mdi:fire-off", "Powrót kotła", "Boiler return"],
      ["avg_circ", "mdi:approximately-equal", "Średnia obiegu", "Circuit average"],
      ["d14", "mdi:pump", "Przepływ (D14)", "Flow rate (D14)", 0],
      ["lift", "mdi:arrow-expand-vertical", "Lift termiczny", "Thermal lift"],
      ["d22", "mdi:valve", "Zawór 3-dr. (1=CWU)", "3-way valve (1=DHW)", 0],
      ["heat_power", "mdi:radiator", "Moc cieplna", "Heat output", 0],
      ["d04", "mdi:target", "Zadane D04", "Setpoint D04"],
    ];
  }
}

class ImmergasRefrigerantCard extends GridCard {
  protected heading(): [string, string, string] { return ["mdi:snowflake-thermometer", "Obieg chłodniczy", "Refrigerant circuit"]; }
  protected wide = true;
  protected rows(): Row[] {
    return [
      ["hz", "mdi:sine-wave", "Częstotliwość (D71)", "Frequency (D71)", 0],
      ["ff_hz_target", "mdi:target", "Częstotl. docelowa", "Target frequency", 0],
      ["ff_hz_order", "mdi:clipboard-arrow-right-outline", "Częstotl. zlecona", "Ordered frequency", 0],
      ["d73", "mdi:thermometer-high", "Tłoczenie (D73)", "Discharge (D73)"],
      ["d73_set", "mdi:target-variant", "Tłoczenie zadane", "Target discharge"],
      ["d72", "mdi:engine", "Korpus sprężarki (D72)", "Compressor shell (D72)"],
      ["d74", "mdi:coolant-temperature", "Wymiennik zewn. (D74)", "Outdoor coil (D74)"],
      ["d24", "mdi:water-thermometer", "Faza ciekła (D24)", "Liquid line (D24)"],
      ["d79", "mdi:thermometer", "Sonda jedn. zewn. (D79)", "ODU probe (D79)"],
      ["d75", "mdi:current-ac", "Prąd sprężarki (D75)", "Compressor current (D75)"],
      ["d77", "mdi:valve-open", "Zawór EEV (D77)", "EEV (D77)", 0],
      ["fan", "mdi:fan", "Wentylator zadany", "Fan target", 0],
      ["fan_real", "mdi:fan-chevron-up", "Wentylator faktyczny", "Fan actual", 0],
      ["odu_power", "mdi:flash", "Moc jedn. zewn.", "ODU power", 0],
      ["power_demand", "mdi:flash-outline", "Zapotrzeb. mocy", "Power demand"],
      ["ipm", "mdi:chip", "Moduł IPM", "IPM module"],
      ["dc_link", "mdi:current-dc", "DC-Link", "DC link", 0],
      ["mains", "mdi:power-plug", "Napięcie sieci", "Mains voltage", 0],
      ["odu_state", "mdi:state-machine", "Stan jedn. zewn.", "ODU state"],
      ["odu_mode", "mdi:cog-outline", "Tryb jedn. zewn.", "ODU mode"],
      ["start_stage", "mdi:stairs-up", "Etap rozruchu", "Start stage"],
      ["pc_stage", "mdi:progress-check", "Etap pracy", "Run stage"],
      ["restart_lock", "mdi:timer-lock-outline", "Blokada restartu", "Restart lock"],
      ["f_lim", "mdi:speedometer-medium", "Limit częstotliwości", "Frequency limit", 0],
    ];
  }
  protected colOf(k: Key): string {
    if (k === "hz" || k === "ff_hz_target" || k === "ff_hz_order") return this.n(k) > 0 ? "peach" : "overlay2";
    return super.colOf(k);
  }
  protected flags() { return FLAGS; }
}

const FLAGS: [Key, string, string][] = [
  ["f_comp", "Sprężarka", "Compressor"], ["f_fan", "Wentylator", "Fan"], ["f_order", "Zlecenie pracy", "Run request"],
  ["defrost", "Odszranianie", "Defrost"], ["f_4way", "Zawór 4-dr.", "4-way valve"], ["f_hotgas", "Gorący gaz", "Hot gas"],
  ["f_pump", "Pompa obieg.", "Circ. pump"], ["backup_heater", "Grzałka rez.", "Backup heater"], ["dhw_heater", "Grzałka CWU", "DHW heater"],
  ["f_tray", "Grzałka tacy", "Tray heater"],
];

class ImmergasStatesCard extends GridCard {
  protected heading(): [string, string, string] { return ["mdi:list-status", "Stan urządzeń", "Device states"]; }
  protected rows(): Row[] { return []; }
  protected flags() { return FLAGS; }
}

register("immergas-water-card", ImmergasWaterCard, "Immergas – Obieg wodny / Water circuit",
  "Temperatury zasilania i powrotu pompy i kotła, przepływ, delta T, zawór 3-drożny");
register("immergas-states-card", ImmergasStatesCard, "Immergas – Stan urządzeń / Device states",
  "Włączone / wyłączone: sprężarka, wentylator, odszranianie, zawór 4-drożny, grzałki, pompa obiegowa");
register("immergas-refrigerant-card", ImmergasRefrigerantCard, "Immergas – Obieg chłodniczy / Refrigerant circuit",
  "Sprężarka, tłoczenie, parownik, EEV, wentylator, napięcia i flagi jednostki zewnętrznej");
