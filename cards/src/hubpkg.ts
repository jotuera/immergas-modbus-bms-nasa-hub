// Entities of the gb_ / ot_ packages for the cards that work without the hub device (hub weather curve, hub mode):
// an anchor entity is found by its name (PL / EN, after any name prefix), then the other entities with the same prefix.
// ESPHome gives no language-independent entity id, so the names of packages/lang/gb_*.yaml and ot_*.yaml are used.

/** keys -> names without the prefix; `anchor` is looked for first, in the given domains */
export function findPkg<K extends string>(states: Record<string, any>, anchor: string[], domains: RegExp,
                                          names: Partial<Record<K, string[]>>): { prefix: string; anchorId: string; ids: Partial<Record<K, string>> } | null {
  const fn = (id: string) => String(states[id]?.attributes?.friendly_name ?? "");
  const byName = new Map<string, string>();
  for (const id of Object.keys(states)) byName.set(fn(id), id);
  // every anchor candidate "<prefix> - <name>" (the packages always name entities so - a bare "Tryb pracy" of another
  // integration does not count), scored by how many of the other entities share its prefix; at least one must
  let best: { prefix: string; anchorId: string; ids: Partial<Record<K, string>>; score: number } | null = null;
  for (const id of Object.keys(states)) {
    if (!domains.test(id)) continue;
    const n = fn(id), hit = anchor.find((x) => n.endsWith(" - " + x));
    if (!hit) continue;
    const prefix = n.slice(0, n.length - hit.length), ids: Partial<Record<K, string>> = {};
    let score = 0;
    for (const [k, list] of Object.entries(names) as [K, string[]][]) {
      for (const x of list) { const e = byName.get(prefix + x); if (e) { ids[k] = e; score++; break; } }
    }
    if (score > 0 && (!best || score > best.score)) best = { prefix, anchorId: id, ids, score };
  }
  if (!best) return null;
  const { prefix, anchorId, ids } = best;
  return { prefix, anchorId, ids };
}

/** set a number / input_number */
export function setNumber(hass: any, id: string | undefined, value: number) {
  if (!id) return;
  hass.callService(id.startsWith("input_number.") ? "input_number" : "number", "set_value", { entity_id: id, value });
}
/** switch / input_boolean on or off */
export function setSwitch(hass: any, id: string | undefined, on: boolean) {
  if (!id) return;
  hass.callService(id.split(".")[0], on ? "turn_on" : "turn_off", { entity_id: id });
}
