// "Łączność / Connectivity": every bus and device the hub talks to - D+/D- Modbus, T-/T+ BMS, F1/F2 NASA, zone 1 panel,
// EHS panel, Dominus, the system controller (BMS master) and the hub itself - with its state and the counters behind it.
import { HubCard, html, css, nothing, c, ca, box, register } from "../base";
import { Key } from "../names";

type State = "ok" | "emu" | "off" | "bad" | "na";
type Link = { k: Key; icon: string; name: [string, string]; bus: string; st: State; detail: string; label?: string; extra?: unknown };

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

    // Dominus in the OpenTherm mode: the module, the boiler behind it and the remote (CAR V2 / Super Amico) instead of
    // the zone 1 panel - with the switch that blocks writes from Home Assistant
    if (this.esp) this.espLinks(out);
    else if (this.dominus && this.ot) this.otLinks(out);

    // Immergas Dominus integration: the Wi-Fi module answers local TCP polls (last good poll, failed polls since HA start)
    if (this.eid("dom_last_read") && !this.ot) {
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
          : `${this.f(room, 1, 1)} °C · ` + this.t("fizyczny lub emulowany", "physical or emulated") });
      // the room thermostat: the Dominus does not report it - the declared A31 room control (offline settings) says it
      if (this.eid("dom_a31")) out.push(this.a31Link());
    }

    const wifi = this.n("hub_wifi");
    if (this.eid("hub_status")) out.push({ k: "hub_status", icon: "mdi:chip", name: ["Hub", "Hub"], bus: "Wi-Fi",
      st: this.on("hub_status") ? "ok" : "bad",
      detail: isNaN(wifi) ? "" : this.t("sygnał ", "signal ") + Math.round(wifi) + " dBm" + (wifi < -80 ? this.t(" · słaby", " · weak") : "") });
    // pairs, one under the other: hub / Dominus, Modbus / zone 1 panel, BMS / system controller, NASA / EHS panel,
    // photovoltaics / dehumidifier
    // Dominus (two columns): boiler + thermostat on the left, Dominus + zone 1 panel / CAR V2 on the right
    if (this.dominus) {
      const DOM = ["Boiler", "Dominus", "OpenTherm hub", "Thermostat", "Room unit", "Regulator", "Zone 1 panel", "CAR V2 remote"];
      return out.sort((a, b) => DOM.indexOf(a.name[1]) - DOM.indexOf(b.name[1]));
    }
    const ORDER = ["Hub", "Dominus", "Modbus", "Zone 1 panel", "BMS", "System controller", "NASA", "EHS panel", "Photovoltaics", "Dehumidifier"];
    return out.sort((a, b) => ORDER.indexOf(a.name[1]) - ORDER.indexOf(b.name[1]));
  }

  /** OpenTherm: Dominus, the boiler and the remote. A CAR V2 is not reported over OpenTherm as such - it is inferred:
   *  E31 = the boiler lost its remote; a room temperature (Data-ID 24) comes from a CAR V2 or the Dominus probe;
   *  "Read only (remote in charge)" on = the user says a remote runs the boiler. */
  private otLinks(out: Link[]) {
    const live = !this.bad("ot_flow") || !this.bad("ot_flame");
    out.push({ k: this.eid("ot_flow") ? "ot_flow" : "ot_flame", icon: "mdi:router-wireless", name: ["Dominus", "Dominus"], bus: this.t("Wi-Fi · TCP", "Wi-Fi · TCP"),
      st: live ? "ok" : "bad",
      detail: live ? this.t("OpenTherm · sesja zwalniana po każdym cyklu dla apki", "OpenTherm · session released after every cycle for the app")
        : this.t("brak odczytów OpenTherm", "no OpenTherm readings") });
    out.unshift({ k: "mode", icon: "mdi:water-boiler", name: ["Kocioł", "Boiler"], bus: "Dominus · OpenTherm",
      st: live ? "ok" : "bad", detail: this.bad("mode") ? "" : this.t("tryb ", "mode ") + this.txt("mode") });
    if (this.eid("ot_thermo")) out.push(this.thermoLink());
    const code = String(this.s("err_code") ?? "").replace(/\D/g, ""), e31 = code === "31";
    const room = this.n("zone1"), ro = this.on("ot_ro"), probeRoom = this.s("ot_ntc") === "room";
    // CAR V2 emulated: no write block and the CH program AUTO - the Dominus regulator + the HA programs do its job (blue,
    // like the zone panel emulated by the hub)
    const domCtl = !ro && !e31 && this.s("prog_mode") === "auto";
    const st: State = e31 ? "bad" : domCtl ? "emu" : ro || !isNaN(room) ? "ok" : "off";
    const label = e31 ? this.t("Brak łączności z pilotem (E31)", "Remote lost (E31)")
      : ro ? this.t("Steruje pilot", "Remote in charge")
      : domCtl ? this.t("Emulacja CAR V2 – Dominus + HA", "CAR V2 emulated – Dominus + HA")
      : !isNaN(room) ? this.t("Jest temperatura pokoju", "Room temperature present")
      : this.t("Nie wykryto", "Not detected");
    const detail = domCtl ? this.t("regulator Dominusa i programy HA zamiast pilota", "the Dominus regulator and the HA programs instead of the remote")
        + (!isNaN(room) ? ` · ${this.f(room, 1, 1)} °C` : "")
      : e31 ? this.t("kocioł czeka na sparowany pilot i ignoruje polecenia CO / CWU / trybu",
        "the boiler waits for its paired remote and ignores CH / DHW / mode commands")
      : !isNaN(room) ? `${this.f(room, 1, 1)} °C · ` + (probeRoom ? this.t("z CAR V2 albo z sondy Dominusa", "from a CAR V2 or the Dominus probe")
        : this.t("z CAR V2", "from the CAR V2"))
      : this.t("bez pilota kotłem steruje Dominus (programy w HA); Super Amico na kotle nie jest widoczny po OpenTherm",
        "without a remote the Dominus runs the boiler (programs in HA); a Super Amico on the boiler is not visible over OpenTherm");
    const tag = "lk_ro", armed = this.isArmed(tag);
    out.push({ k: this.eid("ot_ro") ? "ot_ro" : "zone1", icon: "mdi:remote", name: ["Pilot CAR V2", "CAR V2 remote"], bus: this.t("OpenTherm · pilot", "OpenTherm · remote"),
      st, label, detail,
      extra: this.eid("ot_ro") ? html`<div class="ro" @click=${(e: Event) => e.stopPropagation()}>
        <span>${armed ? this.t("Potwierdź – dotknij ponownie", "Confirm – tap again") : this.t("Blokada zapisu z HA", "Block writes from HA")}</span>
        <div class="tgl ${this.bad("ot_ro") ? "dis" : ""}" style="background:${ro ? ca("sky", 0.35) : "rgba(255,255,255,.08)"}${armed ? `;outline:2px solid ${c("sky")}` : ""}"
          @click=${() => !this.bad("ot_ro") && this.confirm(tag, () => this.call("switch", ro ? "turn_off" : "turn_on", "ot_ro"))}>
          <div class="kn" style="left:${ro ? 23 : 3}px;background:${ro ? c("sky") : c("overlay1")}"></div></div></div>
        ${ro ? html`<div class="ld">${this.t("HA tylko czyta. Po włączeniu raz odłącz zasilanie modułu Dominus – zapomni ostatnią nastawę z HA.",
          "HA only reads. After switching it on, power-cycle the Dominus once – it forgets the last setpoint from HA.")}</div>` : nothing}` : undefined });
  }

  /** ESP OpenTherm hub: the boiler on the OpenTherm line, the hub itself (frame counters), the room unit (gateway:
   *  connected, relayed, who sets the CH / DHW enable flags) and the hub regulator */
  private espLinks(out: Link[]) {
    const on = this.on("ot_link"), frames = this.n("ot_frames"), errs = this.n("ot_errors"), tos = this.n("ot_timeouts");
    const flame = this.on("ot_flame"), mod = this.n("ot_mod");
    out.push({ k: "ot_link", icon: "mdi:water-boiler", name: ["Kocioł", "Boiler"], bus: "OpenTherm",
      st: this.bad("ot_link") ? "na" : on ? "ok" : "bad",
      detail: on ? [this.bad("mode") ? "" : this.t("tryb ", "mode ") + this.txt("mode"), flame ? this.t("płomień", "flame") + (isNaN(mod) ? "" : ` ${Math.round(mod)} %`) : ""].filter(Boolean).join(" · ")
        : this.t("kocioł nie odpowiada – sprawdź adapter master i zaciski pilota", "the boiler does not answer – check the master adapter and the remote terminals") });
    const all = (frames || 0) + (errs || 0) + (tos || 0), bad = all > 0 ? ((errs || 0) + (tos || 0)) / all * 100 : NaN;
    out.push({ k: "ot_frames", icon: "mdi:chip", name: ["Hub OpenTherm", "OpenTherm hub"], bus: "ESP · Wi-Fi",
      st: isNaN(frames) ? "na" : this.age("ot_frames") < 120 ? (bad > 5 ? "bad" : "ok") : "bad",
      detail: isNaN(frames) ? "" : this.t("ramki ", "frames ") + Math.round(frames) + this.t(" · błędne ", " · bad ") + Math.round(errs || 0)
        + this.t(" · bez odp. ", " · no answer ") + Math.round(tos || 0) + (isNaN(bad) ? "" : ` · ${this.f(bad, 1)} %`) });
    // the room unit: only with the gateway package (slave adapter); without it the hub is the master
    if (this.eid("ot_room_link")) {
      const rOn = this.on("ot_room_link"), alone = !this.espRelay;
      const ov = this.on("ot_ov_flags"), room = this.n("zone1"), tag = "lk_ovf", armed = this.isArmed(tag);
      out.push({ k: "ot_room_link", icon: "mdi:remote", name: ["Pilot", "Room unit"], bus: this.t("OpenTherm · bramka", "OpenTherm · gateway"),
        st: rOn && !alone ? "ok" : "emu",
        label: rOn && !alone ? this.t("Pilot połączony – hub przekazuje", "Room unit connected – the hub relays") : this.t("Pilot milczy – hub prowadzi kocioł", "Room unit silent – the hub runs the boiler"),
        detail: (rOn && !alone ? (ov ? this.t("zezwolenia CO / CWU nadpisuje hub", "the hub overrides CH / DHW enable") : this.t("zezwolenia CO / CWU ustawia pilot", "the room unit sets CH / DHW enable"))
          : this.t("brak ramek pilota – hub wysyła swoje wartości", "no frames from the room unit – the hub sends its own values"))
          + (isNaN(room) ? "" : ` · ${this.f(room, 1, 1)} °C`),
        extra: this.eid("ot_ov_flags") ? html`<div class="ro" @click=${(e: Event) => e.stopPropagation()}>
          <span>${armed ? this.t("Potwierdź – dotknij ponownie", "Confirm – tap again") : this.t("Zezwolenia z huba", "Enable flags from the hub")}</span>
          <div class="tgl" style="background:${ov ? ca("green", 0.35) : "rgba(255,255,255,.08)"}${armed ? `;outline:2px solid ${c("green")}` : ""}"
            @click=${() => { const id = this.eid("ot_ov_flags")!; this.confirm(tag, () => this.hass.callService(id.split(".")[0], ov ? "turn_off" : "turn_on", { entity_id: id })); }}>
            <div class="kn" style="left:${ov ? 23 : 3}px;background:${ov ? c("green") : c("overlay1")}"></div></div></div>` : undefined });
    } else {
      out.push({ k: "ot_link", icon: "mdi:remote-off", name: ["Pilot", "Room unit"], bus: this.t("OpenTherm · master", "OpenTherm · master"), st: "emu",
        label: this.t("Hub zamiast pilota", "The hub instead of the remote"),
        detail: this.t("tryb master – pilot odłączony, zworka X40 na 40-41; pakiet ot_gateway zostawia pilota", "master mode – the remote removed, jumper X40 on 40-41; the ot_gateway package keeps the remote") });
    }
    if (this.eid("ot_regulator")) {
      const r = this.on("ot_regulator");
      out.push({ k: "ot_regulator", icon: "mdi:chart-bell-curve-cumulative", name: ["Regulator", "Regulator"], bus: this.t("hub", "hub"), st: r ? "ok" : "off",
        label: r ? this.t("Regulator hubu działa", "Hub regulator running") : this.t("Regulator wyłączony", "Regulator off"),
        detail: r ? this.t("krzywa pogodowa + korekta pokojowa, CO wł. / wył. z histerezą", "weather curve + room correction, CH on / off with a hysteresis")
          : this.t("nastawę zasilania ustawiasz ręcznie albo automatyzacją", "set the flow setpoint by hand or by an automation") });
    }
  }

  /** Modbus Dominus: the Thermostat tile from the declared A31 room control (Boiler parameters, offline) - RP: the zone
   *  panel only, RPT: panel + room thermostat (on / off), RT: the room thermostat only. A room temperature written over
   *  TCP is not taken by the module (tested), so there is no emulated thermostat here - the hub's zone panel does it. */
  private a31Link(): Link {
    const a31 = this.isSet("dom_a31") ? this.s("dom_a31") ?? "" : "";
    // PDU 2011 = 32767 (the sensor reads "unknown"): the Dominus reports no room sensor - no panel / thermostat on the
    // bus; normal only with RT (an on/off thermostat has no temperature)
    const missing = this.s("zone1") === "unknown" && a31 !== "rt";
    const st: State = missing ? "bad" : a31 === "rpt" || a31 === "rt" ? "ok" : a31 === "rp" ? "off" : "na";
    const label = missing ? this.t("Brak termostatu / panelu", "No thermostat / panel")
      : a31 === "rt" ? this.t("Termostat fizyczny (RT)", "Physical thermostat (RT)")
      : a31 === "rpt" ? this.t("Termostat fizyczny (RPT)", "Physical thermostat (RPT)")
      : a31 === "rp" ? this.t("Bez termostatu (RP)", "No thermostat (RP)")
      : this.t("Nie ustawiono A31", "A31 not set");
    const detail = missing ? this.t("Dominus zgłasza brak czujnika pokojowego (PDU 2011 = 32767)", "the Dominus reports no room sensor (PDU 2011 = 32767)")
        + (a31 ? ` · A31 ${a31.toUpperCase()}` : "")
      : a31 === "rt" ? this.t("sam termostat włącza/wyłącza grzanie – bez temperatury pokoju po TCP", "the thermostat alone switches heating – no room temperature over TCP")
      : a31 === "rpt" ? this.t("panel daje temperaturę i nastawę, termostat włącza/wyłącza grzanie", "the panel gives the temperature and setpoint, the thermostat switches heating")
      : a31 === "rp" ? this.t("panel strefy daje temperaturę i żądanie grzania", "the zone panel gives the temperature and the heating demand")
      : this.t("Dominus nie czyta termostatu – ustaw A31 w Parametrach pieca (offline)", "the Dominus does not read the thermostat – set A31 in the Boiler parameters (offline)");
    return { k: "dom_a31", icon: "mdi:thermostat", name: ["Termostat", "Thermostat"], bus: "A31", st, label, detail };
  }

  /** OpenTherm: the room thermostat - the boiler does not report it, so the user says what is connected: none, a
   *  physical one (contacts 40-41) or an emulated one (Home Assistant sends an HA entity's temperature to the module) */
  /** OpenTherm Thermostat tile: only the state - the choice (none / physical / emulated + the source entity) is in the
   *  Boiler parameters (offline). Emulated: Data-ID 24 is judged by reading it back (the ACK is no proof). */
  private thermoLink(): Link {
    const mode = this.s("ot_thermo") ?? "none", a = this.so("ot_thermo")?.attributes ?? {};
    const srcId = String(this.s("ot_room_src") ?? ""), src = srcId ? this.hass.states[srcId] : undefined;
    const v = parseFloat(src?.state ?? ""), sent = a.room_sent_at ? Date.parse(a.room_sent_at) : NaN, res = a.write_result as string | undefined;
    // no room temperature (Data-ID 24 unanswered / unsupported) while something needs it: emulated, or room control (AMB) on
    const noRoom = (this.bad("zone1") || this.otMissing(24)) && (mode === "emulated" || this.on("ot_room_sensor"));
    // failsafe (Dominus 1.6.12): no fresh source reading for 60 min - Data-ID 24 is no longer sent
    const lost = mode === "emulated" && (a.source_lost === true || res === "source_lost");
    const st: State = noRoom || lost ? "bad" : mode === "physical" ? "ok" : mode === "emulated" ? (!src || isNaN(v) || res === "not_taken" ? "bad" : "emu") : "na";
    const label = lost ? this.t("Brak źródła temperatury", "No room temperature source")
      : noRoom ? this.t("Brak temperatury pokoju", "No room temperature")
      : mode === "physical" ? this.t("Termostat fizyczny", "Physical thermostat")
      : mode === "emulated" ? (res === "not_taken" ? this.t("Emulacja nie działa", "Emulation does not work") : this.t("Termostat emulowany", "Emulated thermostat"))
      : this.t("Nie ustawiono", "Not set");
    const age = typeof a.source_age_min === "number" ? a.source_age_min : NaN;
    const detail = lost ? this.t(`${src?.attributes?.friendly_name ?? (srcId || "encja")} nie podaje świeżej temperatury`, `${src?.attributes?.friendly_name ?? (srcId || "the entity")} reports no fresh temperature`)
        + (!isNaN(age) ? this.t(` od ${this.f(age, 0)} min`, ` for ${this.f(age, 0)} min`) : "")
        + this.t(" – Data-ID 24 wstrzymany, wróci sam po odczycie", " – Data-ID 24 paused, resumes on the next reading")
      : noRoom ? this.t("kocioł nie podaje Data-ID 24 – sprawdź sondę Dominusa (zaciski 1-2, „Sonda Dominusa mierzy” = pokój)",
        "the boiler does not report Data-ID 24 – check the Dominus probe (terminals 1-2, “Dominus probe use” = room)")
        + (this.on("ot_room_sensor") ? this.t(" · regulacja wg pokoju (AMB) włączona", " · room control (AMB) on") : "")
      : mode === "physical" ? this.t("zaciski 40-41 kotła – OpenTherm nie podaje jego stanu; grzanie widać po żądaniu CO",
        "boiler contacts 40-41 – OpenTherm does not report it; heating shows as the CH demand")
      : mode === "emulated" ? (src && !isNaN(v) ? `${src.attributes?.friendly_name ?? srcId} ${this.f(v, 1, 1)} °C → Data-ID 24`
          + (!isNaN(sent) ? this.t(" · wysłano ", " · sent ") + new Date(sent).toLocaleTimeString(this.loc, { hour: "2-digit", minute: "2-digit" }) : "")
          + (res === "taken" ? this.t(" · kocioł podaje tę temperaturę – działa", " · the boiler reports this temperature – it works")
            : res === "not_taken" ? this.t(" · Data-ID 24 nie zmienia się – moduł nie przyjmuje temperatury; ustaw Fizyczny", " · Data-ID 24 does not change – the module does not take it; set Physical")
            : res === "pending" ? this.t(" · sprawdzam odczyt…", " · checking the read-back…") : "")
        : this.t("wybierz encję temperatury w Parametrach pieca (offline)", "choose a temperature entity in the Boiler parameters (offline)"))
      : this.t("kocioł nie zgłasza termostatu – ustaw go w Parametrach pieca (offline)", "the boiler does not report a thermostat – set it in the Boiler parameters (offline)");
    return { k: "ot_thermo", icon: "mdi:thermostat", name: ["Termostat", "Thermostat"], bus: this.t("pokój", "room"), st, label, detail };
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
            ${l.extra ?? nothing}
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
    .ro { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 7px; font-size: 11px; font-weight: 800; }
    .segs { display: flex; gap: 4px; margin-top: 7px; flex-wrap: wrap; }
    .seg { cursor: pointer; font-size: 10.5px; font-weight: 800; padding: 4px 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,.12); opacity: .7; }
    .seg.on { opacity: 1; background: rgba(var(--ih-sky-rgb), .25); border-color: rgba(var(--ih-sky-rgb), .6); }
    .src { margin-top: 6px; width: 100%; font: inherit; font-size: 11px; padding: 5px 6px; border-radius: 8px; background: transparent; color: inherit;
      border: 1px solid rgba(255,255,255,.18); }
  `];
}

register("immergas-links-card", ImmergasLinksCard, "Immergas – Łączność / Connectivity",
  "Stan magistral D+/D-, T-/T+, F1/F2, panelu strefy 1, panelu EHS, Dominusa, centralki pieca i huba");
