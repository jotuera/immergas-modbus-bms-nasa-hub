// Cycle timers for the "Teraz / Now" card: phase segments from recorder history (hub "Operating state" + U11),
// typical durations (median of the last complete segments) and small formatting helpers.
export type Seg = { s: string; t0: number; t1: number };

// Hub "Operating state" texts in all hub languages (lang/hub_xx.yaml t_hub_*): "<source>: <what>" or a bare word.
// Matched as whole words, so the cards work whatever language the hub is flashed with.
const W = (a: string[]) => new Set(a.map((x) => x.toLowerCase()));
const HP = W(["Pompa ciepła", "Heat pump", "Tepelné čerpadlo", "Wärmepumpe", "Bomba de calor", "Pompe à chaleur", "Hőszivattyú",
  "Pompa di calore", "Warmtepomp"]);
const HPB = W(["Pompa + kocioł", "Heat pump + boiler", "TČ + kotel", "TČ + kotol", "WP + Kessel", "WP + ketel", "BC + caldera",
  "BC + caldeira", "PAC + chaudière", "HSZ + kazán", "PdC + caldaia"]);
const BOIL = W(["Kocioł gazowy", "Gas boiler", "Plynový kotel", "Plynový kotol", "Gaskessel", "Gasketel", "Caldera de gas",
  "Caldeira a gás", "Chaudière gaz", "Gázkazán", "Caldaia a gas"]);
const DHW = W(["CWU", "DHW", "TUV", "TÚV", "WW", "ACS", "AQS", "ECS", "HMV", "SWW"]);
const COOL = W(["chłodzenie", "cooling", "chlazení", "chladenie", "Kühlen", "refrigeración", "arrefecimento", "refroidissement",
  "hűtés", "raffrescamento", "koelen"]);
const HEAT = W(["CO", "space heating", "topení", "kúrenie", "Heizen", "calefacción", "aquecimento", "chauffage", "fűtés",
  "riscaldamento", "verwarmen"]);
const IDLE = W(["Postój", "Idle", "Klid", "Pokoj", "Stillstand", "Stilstand", "Parada", "Parado", "Arrêt", "Áll", "Inattivo"]);
const DEFROST = W(["Odszranianie", "Defrost", "Odmrazování", "Odmrazovanie", "Abtauen", "Desescarche", "Descongelação",
  "Dégivrage", "Leolvasztás", "Sbrinamento", "Ontdooien"]);
const NODATA = W(["Brak danych", "No data", "Žádná data", "Žiadne dáta", "Keine Daten", "Sin datos", "Sem dados",
  "Pas de données", "Nincs adat", "Nessun dato", "Geen gegevens"]);
// DD mode select "cooling" option (lang/dd_xx.yaml t_dd_mode_cooling)
const MODE_COOL = W(["Chłodzenie", "Cooling", "Chlazení", "Chladenie", "Kühlen", "Refrigeración", "Arrefecimento",
  "Rafraîchissement", "Hűtés", "Raffrescamento", "Koelen"]);

export type Src = "hp" | "hpb" | "boiler" | "idle" | "defrost" | "";
export type What = "dhw" | "cool" | "heat" | "";
/** hub operating state -> source (heat pump / heat pump + boiler / boiler / idle / defrost) and what it serves */
export const parseState = (s?: string | null): { src: Src; what: What } => {
  const t = (s ?? "").trim().toLowerCase(), i = t.indexOf(": "), a = i >= 0 ? t.slice(0, i) : t, b = i >= 0 ? t.slice(i + 2) : "";
  const src: Src = HP.has(a) ? "hp" : HPB.has(a) ? "hpb" : BOIL.has(a) ? "boiler" : IDLE.has(a) ? "idle" : DEFROST.has(a) ? "defrost" : "";
  const what: What = DHW.has(b) ? "dhw" : COOL.has(b) ? "cool" : HEAT.has(b) ? "heat" : "";
  return { src, what };
};
export const isIdle = (s?: string | null) => parseState(s).src === "idle";
export const isDhw = (s?: string | null) => parseState(s).what === "dhw";
export const isCool = (s?: string | null) => parseState(s).what === "cool";
export const isDefrost = (s?: string | null) => parseState(s).src === "defrost";
/** gas boiler involved (alone or together with the heat pump) */
export const hasBoiler = (s?: string | null) => { const p = parseState(s).src; return p === "boiler" || p === "hpb"; };
/** heat pump space heating (alone or together with the boiler) */
export const hpHeating = (s?: string | null) => { const p = parseState(s); return (p.src === "hp" || p.src === "hpb") && p.what === "heat"; };
/** "Last DHW cycle: source" (a bare t_hub_hp / t_hub_boiler / t_hub_hp_boiler) */
export const srcKind = (s?: string | null): Src => parseState(s).src;
/** DD mode select is the cooling mode */
export const isCoolMode = (s?: string | null) => MODE_COOL.has((s ?? "").trim().toLowerCase());

export const BAD = (s?: string) => !s || s === "unavailable" || s === "unknown" || NODATA.has(s.toLowerCase());

/** history points -> merged segments; unavailable/unknown gaps (reboots, flashing) are bridged by the previous state */
export function segments(list: any[], end: number): Seg[] {
  const out: Seg[] = [];
  for (const x of list) {
    const s = x.s ?? x.state, t = Math.round((x.lc ?? x.lu ?? 0) * 1000);
    if (BAD(s)) continue;
    const last = out[out.length - 1];
    if (last && last.s === s) continue;
    if (last) last.t1 = t;
    out.push({ s, t0: t, t1: end });
  }
  return out;
}

export const median = (v: number[]) => {
  const a = [...v].sort((x, y) => x - y), m = a.length >> 1;
  return a.length ? (a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2) : NaN;
};

/** median duration of the last n complete segments matching test (first segment is cut by the window, last one is open) */
export const typical = (segs: Seg[], test: (s: string) => boolean, minMs = 20e3, n = 8) => {
  const d = segs.slice(1, -1).filter((g) => test(g.s) && g.t1 - g.t0 >= minMs).slice(-n).map((g) => g.t1 - g.t0);
  return d.length >= 2 ? median(d) : NaN;
};

export const phaseCol = (s: string) => {
  const p = parseState(s);
  return p.src === "defrost" ? "sky" : p.what === "dhw" ? "yellow" : p.what === "cool" ? "teal"
    : p.src === "boiler" ? "red" : p.src === "idle" ? "overlay1" : "peach";
};
export const phaseIcon = (s: string) => {
  const p = parseState(s);
  return p.src === "defrost" ? "mdi:snowflake-melt" : p.what === "dhw" ? "mdi:water-boiler" : p.what === "cool" ? "mdi:snowflake"
    : p.src === "boiler" ? "mdi:fire" : p.src === "idle" ? "mdi:pause-circle-outline" : "mdi:radiator";
};

/** duration in ms -> "<1 min", "12 min", "1 h 05 min" */
export const dur = (ms: number) => {
  const m = Math.round(Math.max(0, ms) / 60000);
  return ms < 60000 ? "<1 min" : m < 60 ? m + " min" : Math.floor(m / 60) + " h " + String(m % 60).padStart(2, "0") + " min";
};
export const clock = (ms: number, loc: string) => new Date(ms).toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" });

/** next occurrence (after `after`) of a time of day given in minutes */
export const nextAt = (minOfDay: number, after: number) => {
  const d = new Date(after); d.setHours(0, 0, 0, 0);
  let t = d.getTime() + minOfDay * 60000;
  while (t <= after) t += 86400e3;
  return t;
};

// ---- Immergas Dominus: no operating state, so the phases come from the heating-demand and DHW-request flags ----
export type Pt = { t: number; v: number };
/** numeric history points (minimal_response) -> [{t, v}] */
export const points = (list: any[]): Pt[] => list.map((x) => ({ t: Math.round((x.lc ?? x.lu ?? 0) * 1000), v: parseFloat(x.s ?? x.state) }))
  .filter((p) => !isNaN(p.v));
/** DHW heating periods. The DHW request (PDU 2001 bit 0) lights ~9 min before a cycle and clears when the 3-way valve
 *  switches to DHW, so a cycle starts when the request clears and lasts while the cylinder keeps warming (end = its
 *  peak within 90 min; with no rise the period is dropped) */
export function dhwPeriods(req: Seg[], tank: Pt[], now: number): { t0: number; t1: number }[] {
  const out: { t0: number; t1: number }[] = [];
  for (let i = 0; i < req.length; i++) {
    const g = req[i];
    if (g.s !== "on" || i === req.length - 1) continue;
    const t0 = g.t1, pts = tank.filter((p) => p.t >= t0 - 60e3 && p.t <= t0 + 90 * 60e3);
    const base = tank.filter((p) => p.t <= t0).pop()?.v ?? pts[0]?.v;
    if (base === undefined || !pts.length) { if (now - t0 < 10 * 60e3) out.push({ t0, t1: now }); continue; }
    const top = pts.reduce((a, b) => (b.v > a.v ? b : a));
    if (top.v - base >= 0.5) out.push({ t0, t1: top.t > t0 ? top.t : t0 + 60e3 });
    else if (now - t0 < 10 * 60e3) out.push({ t0, t1: now });
  }
  return out;
}
/** DHW heating right now: the request cleared within the last 5 min, or the cylinder rose >= 0.3 K over ~5 min */
export const dhwHeatingNow = (reqOff: number, tank: Pt[], now: number) => {
  if (now - reqOff < 5 * 60e3) return true;
  const recent = tank.filter((p) => p.t >= now - 6 * 60e3), last = tank[tank.length - 1];
  return !!last && recent.length > 0 && last.v - Math.min(...recent.map((p) => p.v)) >= 0.3 && now - last.t < 3 * 60e3;
};
