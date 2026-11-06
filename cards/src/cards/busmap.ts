// "Mapa magistral / Bus map": what the hub has seen on D+/D-, T-/T+ and F1/F2 that no entity describes yet, and a
// report of it as a pre-filled GitHub issue. The hub sends the map as an `esphome.immergas_bus_map` event (no
// permission for Home Assistant actions needed); this card builds the link - nothing is sent until the user opens it
// and presses Create on GitHub.
import { HubCard, html, css, nothing, box, register } from "../base";
import { Key } from "../names";

const ISSUES = "https://github.com/jotuera/immergas-modbus-bms-nasa-opentherm-hub/issues/new";
const URL_BUDGET = 7000;
type Bus = "DD" | "TT" | "FF" | "GB" | "MT";
const BUSES: [Bus, Key, Key, string, [string, string]][] = [
  ["DD", "map_dd", "map_dd_rep", "D+/D-", ["rejestry odczytane i zapisane przez piec", "registers read and written by the boiler"]],
  ["TT", "map_tt", "map_tt_rep", "T-/T+", ["wyniki skanera PDU (Skanuj PDU …)", "results of the PDU scanner (Scan PDU …)"]],
  ["FF", "map_ff", "map_ff_rep", "F1/F2", ["wszystkie wiadomości NASA", "every NASA message"]],
  ["GB", "map_gb", "map_gb_rep", "Modbus BMS", ["rejestry, na które kocioł odpowiada, a żaden pakiet gb_ ich nie czyta (skan)", "registers the boiler answers that no gb_ package reads (scan)"]],
  ["MT", "map_mt", "map_mt_rep", "Modbus · Midea", ["rejestry, na które jednostka odpowiada, a żaden pakiet mt_ ich nie czyta (skan)", "registers the unit answers that no mt_ package reads (scan)"]],
];
// the buses with a register scanner in the hub: [scan button, scan status]
const SCAN: Partial<Record<Bus, [Key, Key]>> = { GB: ["map_gb_scan", "map_gb_st"], MT: ["map_mt_scan", "map_mt_st"] };

class ImmergasBusMapCard extends HubCard {
  private report: { bus: Bus; url: string; text: string } | null = null;
  private waiting: Bus | null = null;
  private unsub: (() => void) | null = null;

  disconnectedCallback() {
    super.disconnectedCallback();
    this.unsub?.();
    this.unsub = null;
  }

  private buildUrl(bus: Bus, model: string, version: string, map: string) {
    const title = `Bus map ${bus}: ${model || "boiler model?"}`;
    const base = { template: "bus-map.yml", title, model, hub_version: version, bus };
    let text = map;
    const enc = (t: string) => new URLSearchParams({ ...base, map: t }).toString();
    while (enc(text).length + ISSUES.length + 1 > URL_BUDGET && text.length > 200)
      text = text.slice(0, Math.floor(text.length * 0.85)) + "\n... (cut, too long for one link)";
    return { url: `${ISSUES}?${enc(text)}`, text };
  }

  private async prepare(bus: Bus, btn: Key) {
    if (!this.eid(btn)) return;
    this.report = null;
    this.waiting = bus;
    this.requestUpdate();
    this.unsub?.();
    const conn = this.hass.connection;
    let done = false;
    this.unsub = await conn.subscribeEvents((ev: any) => {
      const d = ev?.data ?? {};
      if (d.bus !== bus || done) return;
      done = true;
      const { url, text } = this.buildUrl(bus, String(d.model ?? ""), String(d.hub_version ?? ""), String(d.map ?? ""));
      this.report = { bus, url, text };
      this.waiting = null;
      this.unsub?.();
      this.unsub = null;
      this.requestUpdate();
    }, "esphome.immergas_bus_map");
    const bid = this.eid(btn)!;
    this.hass.callService(bid.split(".")[0], "press", { entity_id: bid });
    setTimeout(() => {
      if (done) return;
      this.waiting = null;
      this.unsub?.();
      this.unsub = null;
      this.report = { bus, url: "", text: "" };
      this.requestUpdate();
    }, 15000);
  }

  protected body() {
    const model = this.s("hub_model") ?? "";
    if (!BUSES.some(([, k]) => this.eid(k)))
      return html`${this.head("mdi:map-search-outline", this.t("Mapa magistral", "Bus map"))}
        <div class="hint">${this.t("Wgraj pakiet hub_busmap.yaml, żeby zbierać mapę magistral.", "Add the hub_busmap.yaml package to collect the bus map.")}</div>`;
    return html`
      ${this.head("mdi:map-search-outline", this.t("Mapa magistral", "Bus map"), this.t("nieopisane PDU", "undescribed PDUs"))}
      ${this.eid("hub_model") ? html`<div class="model">
        <ha-icon icon="mdi:water-boiler"></ha-icon>
        <input .value=${model} placeholder=${this.t("Model kotła i pompy (z tabliczki)", "Boiler and heat pump model (rating plate)")}
          @change=${(e: Event) => this.call("text", "set_value", "hub_model", { value: (e.target as HTMLInputElement).value.trim() })}>
      </div>` : nothing}
      <div class="rows">${BUSES.filter(([, k]) => this.eid(k)).map(([bus, k, btn, label, sub]) => {
        const n = this.n(k), sc = SCAN[bus], st = sc ? this.s(sc[1]) ?? "" : "", running = /%$/.test(st), tag = "scan_" + bus, armed = this.isArmed(tag);
        return html`<div class="row" style=${box(running ? "yellow" : "sky", running)}>
          <div class="cx"><div class="ln">${bus}<span class="bus">${label}</span></div>
            <div class="ld">${this.t(sub[0], sub[1])}${sc ? html` · <b>${running ? this.t("skanuję ", "scanning ") + st : st === "done" ? this.t("skan zakończony", "scan done") : this.t("jeszcze nie skanowano", "not scanned yet")}</b>` : nothing}</div></div>
          ${sc && this.eid(sc[0]) ? html`<button class="go" ?disabled=${running} style=${armed ? box("yellow", true) : ""}
            @click=${() => this.confirm(tag, () => this.call("button", "press", sc[0]))}><ha-icon icon="mdi:radar"></ha-icon>${armed ? this.t("Potwierdź – kilka minut", "Confirm – a few minutes") : this.t("Skanuj", "Scan")}</button>` : nothing}
          <div class="cnt" @click=${() => this.moreInfo(k)}>${isNaN(n) ? "–" : Math.round(n)}</div>
          <button class="go" ?disabled=${!!this.waiting || !this.eid(btn)} @click=${() => this.prepare(bus, btn)}>
            <ha-icon icon=${this.waiting === bus ? "mdi:timer-sand" : "mdi:github"}></ha-icon>${this.t("Przygotuj zgłoszenie", "Prepare report")}</button>
        </div>`;
      })}</div>
      ${this.report ? (this.report.url ? html`<div class="rep" style=${box("green", false)}>
          <a href=${this.report.url} target="_blank" rel="noopener"><ha-icon icon="mdi:open-in-new"></ha-icon>${this.t("Otwórz gotowe zgłoszenie ", "Open the pre-filled issue ")}${this.report.bus}</a>
          <div class="ld">${this.t("Nic nie zostało wysłane: link otwiera GitHub z wypełnionym zgłoszeniem (model, wersja huba, mapa – bez adresów i haseł). Sprawdź je i naciśnij Create albo zamknij stronę.",
            "Nothing has been sent: the link opens GitHub with the issue filled in (model, hub version, the map – no addresses or passwords). Check it and press Create, or close the page.")}</div>
          <pre>${this.report.text}</pre></div>`
        : html`<div class="rep" style=${box("red", true)}><div class="ld">${this.t("Hub nie odpowiedział w 15 s – czy jest online?", "The hub did not answer within 15 s – is it online?")}</div></div>`) : nothing}
      <div class="hint">${this.gbx || this.mtx ? this.t("Skan czyta po kolei każdy rejestr z typowych zakresów (kilka minut, zwykłe odpytywanie działa dalej) i zostawia te, które odpowiadają, a żaden pakiet ich nie opisuje. Potem Przygotuj zgłoszenie – nic nie jest wysyłane, dopóki nie naciśniesz Create na GitHubie.",
        "The scan reads every register of the usual ranges one by one (a few minutes, the normal polling keeps running) and keeps the ones that answer and that no package describes. Then Prepare report – nothing is sent until you press Create on GitHub.")
        : this.t("Mapa zbiera się od startu huba. TT wypełnia skaner PDU (przyciski Skanuj PDU …). Stałe zera zimą też mogą ożyć – zgłoszenie z innego modelu pomaga najbardziej.",
        "The map builds up from the hub start. TT is filled by the PDU scanner (Scan PDU … buttons). Constant zeros may come alive in winter – a report from another model helps the most.")}</div>`;
  }

  static styles = [HubCard.styles, css`
    .model { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .model ha-icon { --mdc-icon-size: 20px; opacity: .7; }
    .model input { flex: 1; min-width: 0; font: inherit; font-size: 12.5px; padding: 7px 9px; border-radius: 10px;
      border: 1px solid var(--ih-overlay1); background: transparent; color: inherit; }
    .rows { display: grid; gap: 8px; }
    .row { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 12px; }
    .cx { flex: 1; min-width: 0; }
    .ln { font-size: 12.5px; font-weight: 800; display: flex; align-items: baseline; gap: 6px; }
    .bus { font-size: 9.5px; font-weight: 800; opacity: .5; letter-spacing: .04em; }
    .ld { font-size: 10.5px; opacity: .65; margin-top: 2px; line-height: 1.35; overflow-wrap: anywhere; }
    .cnt { font-size: 18px; font-weight: 800; cursor: pointer; min-width: 36px; text-align: right; }
    .go { display: flex; align-items: center; gap: 5px; font: inherit; font-size: 11.5px; font-weight: 800; cursor: pointer;
      padding: 6px 10px; border-radius: 10px; border: 1px solid var(--ih-overlay1); background: transparent; color: inherit; }
    .go[disabled] { opacity: .4; cursor: default; }
    .go ha-icon { --mdc-icon-size: 16px; }
    .rep { margin-top: 8px; padding: 9px 10px; border-radius: 12px; }
    .rep a { display: inline-flex; align-items: center; gap: 5px; font-weight: 800; font-size: 12.5px; color: var(--ih-green); }
    .rep a ha-icon { --mdc-icon-size: 16px; }
    .rep pre { font-size: 10px; max-height: 180px; overflow: auto; white-space: pre-wrap; margin: 6px 0 0; opacity: .75; }
    .hint { font-size: 10px; opacity: .55; margin-top: 8px; line-height: 1.35; }
  `];
}

register("immergas-busmap-card", ImmergasBusMapCard, "Immergas – Mapa magistral / Bus map",
  "Nieopisane PDU z D+/D-, T-/T+ i F1/F2 oraz zgłoszenie mapy jako gotowe zgłoszenie na GitHubie");
