// Extracts the English UI texts of the cards: this.t(pl, en) calls and [pl, en] pairs.
// A template literal becomes a pattern: "cycles ~${f(x)} min" -> "cycles ~{0} min".
// usage: node tools/extract_strings.cjs <cards/src> <out.json>   (needs the typescript package: run from the build folder)
const ts = require("typescript");
const fs = require("fs"), path = require("path");
const [src, out] = process.argv.slice(2);

// language data, not UI texts: entity names, the state word lists, the generated dictionary
const SKIP = new Set(["names.ts", "i18n.ts", "i18n_data.ts", "timers.ts"]);
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") && !SKIP.has(f) && files.push(p); } })(src);

const texts = new Map(); // key -> {pl, files:set}
function text(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) {
    let s = node.head.text;
    node.templateSpans.forEach((sp, i) => { s += `{${i}}` + sp.literal.text; });
    return s;
  }
  return null;
}
function add(pl, en, file) {
  if (en === null || pl === null || !/[A-Za-z]/.test(en)) return;
  if (/^mdi:/.test(en) || /^[a-z0-9_]+$/.test(en) && en === pl) return;
  if (pl === en && !/\s/.test(en)) return; // identical single tokens (COP, ΔT, AUTO …) need no translation
  const k = en;
  if (!texts.has(k)) texts.set(k, { pl, files: new Set() });
  texts.get(k).files.add(path.basename(file));
}
for (const f of files) {
  const sf = ts.createSourceFile(f, fs.readFileSync(f, "utf8"), ts.ScriptTarget.ES2021, true);
  (function visit(n) {
    if (ts.isCallExpression(n) && n.arguments.length === 2) {
      const e = n.expression;
      const name = ts.isPropertyAccessExpression(e) ? e.name.text : ts.isIdentifier(e) ? e.text : "";
      if (name === "t") add(text(n.arguments[0]), text(n.arguments[1]), f);
    }
    if (ts.isArrayLiteralExpression(n) && n.elements.length === 2) {
      const a = text(n.elements[0]), b = text(n.elements[1]);
      if (a !== null && b !== null && a !== b) add(a, b, f);
    }
    // tuples like [key, icon, PL, EN, decimals]: every adjacent pair of texts that are not keys, icons or colours
    if (ts.isArrayLiteralExpression(n) && n.elements.length > 2) {
      const el = n.elements.map(text), plain = (s) => s !== null && !/^(mdi:|#)/.test(s) && !/^[a-z0-9_]+$/.test(s) && /[a-z]/.test(s) && s.length > 2;
      for (let i = 0; i + 1 < el.length; i++) if (plain(el[i]) && plain(el[i + 1]) && el[i] !== el[i + 1]) add(el[i], el[i + 1], f);
    }
    // DAYS table: [["nd", ...], "niedziela", "Sunday"]
    if (ts.isArrayLiteralExpression(n) && n.elements.length === 3 && ts.isArrayLiteralExpression(n.elements[0])) {
      add(text(n.elements[1]), text(n.elements[2]), f);
    }
    ts.forEachChild(n, visit);
  })(sf);
}
const list = [...texts.entries()].map(([en, v]) => ({ en, pl: v.pl, files: [...v.files] }));
fs.writeFileSync(out, JSON.stringify(list, null, 1));
console.log(list.length, "texts,", list.filter((x) => /\{\d\}/.test(x.en)).length, "patterns");
