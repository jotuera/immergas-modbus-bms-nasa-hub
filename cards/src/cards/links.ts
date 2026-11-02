// "Łączność / Connectivity": every bus and device the hub talks to - D+/D- Modbus, T-/T+ BMS, F1/F2 NASA, zone 1 panel,
// EHS panel, Dominus, the system controller (BMS master) and the hub itself - with its state and the counters behind it.
import { HubCard, html, css, nothing, c, ca, box, register } from "../base";
import { Key } from "../names";

type State = "ok" | "emu" | "off" | "bad" | "na";
type Link = { k: Key; icon: string; name: [string, string]; bus: string; st: State; detail: string; label?: string };

class ImmergasLinksCard extends HubCard {
  /** seconds since the entity last changed (a counter that keeps changing = the bus is alive) */
  private age(k: Key) {
    const so = this.so(k);
    return so ? (Date.now() - Date.parse(so.last_changed)) / 1000 : Infinity;
  }

  private links(): Link[] {
    const out: Link[] = [];
    const ddOn = this.on("dd_link"), crc = this.n("dd_crc");
    if (this.eid("dd_link")) out.push({ k: "dd_link", icon: "mdi:transit-connection-variant", name: ["Modbus", "Modbus"], bus: "D+/D-",
      st: this.bad("dd_link") ? "na" : ddOn ? "ok" : "bad",
      detail: isNaN(crc) ? "" : this.t("błędy CRC: ", "CRC errors: ") + Math.round(crc) });

    const bmsOn = !this.eid("tt_bms") || this.on("tt_bms"), ttOk = !this.bad("d99_raw");
    if (this.eid("tt_bms") || this.eid("d99_raw")) out.push({ k: this.eid("tt_bms") ? "tt_bms" : "d99_raw", icon: "mdi:lan-connect", name: ["BMS", "BMS"], bus: "T-/T+",
      st: !bmsOn ? "off" : ttOk ? "ok" : "bad",
      detail: !bmsOn ? this.t("odpytywanie wyłączone", "polling off") : ttOk ? this.t("piec odpowiada (slave 11)", "the boiler answers (slave 11)")
        + (this.s("dd_fw") && !this.bad("dd_fw") ? this.t(" · oprogramowanie ", " · firmware ") + this.s("dd_fw") : "") : this.t("piec nie odpowiada", "the boiler does not answer") });

    const nasaOn = !this.eid("f_nasa") || this.on("f_nasa"), rx = this.n("nasa_rx"), alive = this.age("nasa_rx") < 180;
    if (this.eid("nasa_rx") || this.eid("f_nasa")) out.push({ k: this.eid("nasa_rx") ? "nasa_rx" : "f_nasa", icon: "mdi:swap-horizontal-bold", name: ["NASA", "NASA"], bus: "F1/F2",
      st: !nasaOn ? "off" : isNaN(rx) ? "na" : alive ? "ok" : "bad",
      detail: isNaN(rx) ? "" : this.t("ramki ", "frames ") + Math.round(rx) + this.t(" · błędne ", " · bad ") + Math.round(this.n("nasa_bad") || 0)
        + this.t(" · bez odp. ", " · no reply ") + Math.round(this.n("nasa_timeouts") || 0) });

    const pEmu = this.on("dd_emu_panel"), pOn = this.on("dd_panel_link");
    if (this.eid("dd_panel_link")) out.push({ k: "dd_panel_link", icon: "mdi:tablet-dashboard", name: ["Panel strefy 1", "Zone 1 panel"], bus: "D+/D- 0x29",
      st: this.bad("dd_panel_link") ? "na" : pEmu ? (pOn ? "emu" : "bad") : pOn ? "ok" : "bad",
      detail: pEmu ? this.t("emulowany przez hub", "emulated by the hub") : this.t("panel fizyczny", "physical panel") });

    if (this.eid("ehs_emu")) out.push({ k: "ehs_emu", icon: "mdi:remote", name: ["Panel EHS", "EHS panel"], bus: "F1/F2",
      st: this.on("ehs_emu") ? (nasaOn && alive ? "emu" : "bad") : "off",
      detail: this.on("ehs_emu") ? this.t("emulowany przez hub", "emulated by the hub") : this.t("emulacja wyłączona", "emulation off") });

    const dEmu = this.on("dd_emu_dominus"), dOn = this.on("dd_dominus_link"), tx = this.n("dd_dominus_tx");
    if (this.eid("dd_dominus_link")) out.push({ k: "dd_dominus_link", icon: "mdi:router-wireless", name: ["Dominus", "Dominus"], bus: "D+/D- 0x33",
      st: this.bad("dd_dominus_link") ? "na" : dEmu ? (dOn ? "emu" : "bad") : dOn ? "ok" : "off",
      detail: dEmu ? this.t("emulowany przez hub", "emulated by the hub") + (isNaN(tx) ? "" : this.t(" · ramki TX ", " · TX frames ") + Math.round(tx))
        : dOn ? this.t("fizyczny moduł Dominus", "physical Dominus module") : this.t("nie ma na magistrali", "not on the bus") });

    // system controller (e.g. a System Manager kit) = the BMS master on T-/T+; with the hub polling the bus, the hub
    // takes that role - a second master on the same bus would collide with it
    if (this.eid("tt_bms") || this.eid("d99_raw")) out.push({ k: this.eid("tt_bms") ? "tt_bms" : "d99_raw", icon: "mdi:server-network", name: ["Centralka systemu", "System controller"],
      bus: this.t("T-/T+ master", "T-/T+ master"), st: !bmsOn ? "off" : ttOk ? "emu" : "bad",
      detail: bmsOn ? this.t("hub pełni rolę centralki (master BMS)", "the hub acts as the controller (BMS master)")
        : this.t("hub nie odpytuje – miejsce dla centralki", "the hub does not poll – room for a controller") });

    // Immergas Dominus integration: the Wi-Fi module answers local TCP polls (last good poll, failed polls since HA start)
    if (this.eid("dom_last_read")) {
      const last = Date.parse(this.s("dom_last_read") ?? ""), fails = this.n("dom_failed");
      const fresh = !isNaN(last) && Date.now() - last < 5 * 60e3;
      out.push({ k: "dom_last_read", icon: "mdi:router-wireless", name: ["Dominus", "Dominus"], bus: this.t("Wi-Fi · TCP", "Wi-Fi · TCP"),
        st: isNaN(last) ? "bad" : fresh ? "ok" : "bad",
        detail: (isNaN(last) ? this.t("jeszcze bez odczytu", "no reading yet") : this.t("ostatni odczyt ", "last read ")
          + new Date(last).toLocaleTimeString(this.loc, { hour: "2-digit", minute: "2-digit" }))
          + (isNaN(fails) ? "" : this.t(" · nieudane odpytania ", " · failed polls ") + Math.round(fails)) });
      // the boiler behind the module: its registers come back through Dominus
      out.push({ k: "mode", icon: "mdi:water-boiler", name: ["Kocioł", "Boiler"], bus: "Dominus · Modbus",
        st: this.bad("mode") && this.bad("zone1") ? "bad" : "ok",
        detail: this.bad("mode") ? "" : this.t("tryb ", "mode ") + this.txt("mode") });
      // zone 1 room temperature: Dominus does not measure it - it comes from a zone panel on D+/D- (physical, or
      // emulated by the hub); TCP has no panel firmware register, so physical and emulated look the same here
      const room = this.n("zone1");
      // A31 (declared): who gives the room temperature and who gives the heating demand
      const a31 = this.isSet("dom_a31") ? this.s("dom_a31") : "";
      const how = a31 === "rp" ? this.t("A31 RP: panel daje temperaturę i żądanie", "A31 RP: the panel gives the temperature and the demand")
        : a31 === "rpt" ? this.t("A31 RPT: panel daje temperaturę i nastawę, termostat pokojowy włącza/wyłącza grzanie", "A31 RPT: the panel gives the temperature and setpoint, the room thermostat switches heating on/off")
        : a31 === "rt" ? this.t("A31 RT: tylko termostat pokojowy – bez temperatury pokoju po TCP", "A31 RT: room thermostat only – no room temperature over TCP") : "";
      out.push({ k: "zone1", icon: "mdi:tablet-dashboard", name: ["Panel Strefy 1", "Zone 1 panel"], bus: "D+/D- 0x29",
        st: isNaN(room) ? "off" : "ok",
        label: isNaN(room) ? this.t("brak czujnika pokojowego", "no room sensor") : this.t("Jest temperatura", "Temperature present"),
        detail: isNaN(room)
          ? (a31 === "rt" ? how : this.t("Dominus nie mierzy temperatury – potrzebny panel strefy (fizyczny albo emulowany przez hub)",
            "Dominus does not measure it – a zone panel is needed (physical or emulated by the hub)"))
          : `${this.f(room, 1, 1)} °C · ` + this.t("fizyczny lub emulowany", "physical or emulated") + (how ? " · " + how : "") });
    }

    const wifi = this.n("hub_wifi");
    if (this.eid("hub_status")) out.push({ k: "hub_status", icon: "mdi:chip", name: ["Hub", "Hub"], bus: "Wi-Fi",
      st: this.on("hub_status") ? "ok" : "bad",
      detail: isNaN(wifi) ? "" : this.t("sygnał ", "signal ") + Math.round(wifi) + " dBm" + (wifi < -80 ? this.t(" · słaby", " · weak") : "") });
    // pairs, one under the other: hub / Dominus, Modbus / zone 1 panel, BMS / system controller, NASA / EHS panel,
    // photovoltaics / dehumidifier
    const ORDER = ["Hub", "Dominus", "Modbus", "Zone 1 panel", "BMS", "System controller", "NASA", "EHS panel", "Photovoltaics", "Dehumidifier"];
    return out.sort((a, b) => ORDER.indexOf(a.name[1]) - ORDER.indexOf(b.name[1]));
  }

  protected body() {
    const L = this.links();
    // pairs: a bus and the device behind it, one column each (Hub / Dominus, Modbus / zone 1 panel, BMS / system
    // controller, NASA / EHS panel); a pair wraps as a whole on a narrow card
    const by = (n: string) => L.find((l) => l.name[1] === n);
    // Dominus integration: the module and the boiler side by side
    const pairs = this.dominus ? L.map((l) => [l])
      : [["Hub", "Dominus"], ["Modbus", "Zone 1 panel"], ["BMS", "System controller"], ["NASA", "EHS panel"]]
        .map((p) => p.map(by).filter((l): l is Link => !!l)).filter((p) => p.length);
    const meta: Record<State, [string, string, string]> = {
      ok: ["green", this.t("Połączono", "Connected"), "mdi:check-circle"],
      emu: ["sky", this.t("Emulacja", "Emulated"), "mdi:robot-outline"],
      off: ["overlay2", this.t("Wyłączone", "Off"), "mdi:minus-circle-outline"],
      bad: ["red", this.t("Brak łączności", "No link"), "mdi:close-circle"],
      na: ["overlay1", this.t("Brak danych", "No data"), "mdi:help-circle-outline"],
    };
    const nBad = L.filter((l) => l.st === "bad").length;
    return html`
      ${this.head("mdi:lan", this.t("Łączność", "Connectivity"), nBad ? html`<span style="color:${c("red")}">${this.t("problemy: ", "problems: ")}${nBad}</span>`
        : this.t("wszystko połączone", "all connected"))}
      <div class="links" style=${this.dominus ? "grid-template-columns:repeat(2, minmax(0, 1fr));grid-auto-rows:auto" : ""}>${pairs.map((pair) => html`<div class=${pair.length > 1 ? "pair" : "pair one"}>${pair.map((l) => {
        const [col, txt0, icon] = meta[l.st], txt = l.label ?? txt0;
        return html`<div class="lk" style=${box(col, l.st === "bad")} @click=${() => this.moreInfo(l.k)}>
          <ha-icon icon=${l.icon} style="color:${c(col)}"></ha-icon>
          <div class="cx">
            <div class="ln">${this.t(l.name[0], l.name[1])}<span class="bus">${l.bus}</span></div>
            <div class="ls" style="color:${c(col)}"><ha-icon icon=${icon}></ha-icon>${txt}</div>
            ${l.detail ? html`<div class="ld">${l.detail}</div>` : nothing}
          </div></div>`;
      })}</div>`)}</div>`;
  }

  static styles = [HubCard.styles, css`
    :host { container-type: inline-size; }
    /* two rows filled column by column: each pair stands one under the other */
    /* four pairs in a row (a bus and the device under it); two pairs per row on a narrow card */
    .links { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-auto-rows: 1fr; gap: 8px; }
    @container (max-width: 760px) { .links { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    /* every tile the same height: each pair spans two rows of one shared grid (subgrid), all rows 1fr */
    .pair { display: grid; grid-row: span 2; grid-template-rows: subgrid; gap: 8px; min-width: 0; }
    .pair.one { grid-row: span 1; }
    .lk { box-sizing: border-box; height: 100%; }
    .lk { cursor: pointer; display: flex; gap: 9px; align-items: flex-start; padding: 9px 10px; border-radius: 12px; min-width: 0; }
    .lk > ha-icon { --mdc-icon-size: 22px; flex: none; margin-top: 2px; }
    .cx { min-width: 0; }
    .ln { font-size: 12.5px; font-weight: 800; display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
    .bus { font-size: 9.5px; font-weight: 800; opacity: .5; letter-spacing: .04em; }
    .ls { display: flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 800; margin-top: 2px; }
    .ls ha-icon { --mdc-icon-size: 14px; }
    .ld { font-size: 10px; opacity: .6; margin-top: 2px; line-height: 1.3; overflow-wrap: anywhere; }
  `];
}

register("immergas-links-card", ImmergasLinksCard, "Immergas – Łączność / Connectivity",
  "Stan magistral D+/D-, T-/T+, F1/F2, panelu strefy 1, panelu EHS, Dominusa, centralki pieca i huba");
