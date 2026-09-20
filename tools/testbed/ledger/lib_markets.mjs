// ⭐⭐ THE SHORTLIST, THE MAJORS AND THE PRICE-TRACKED MARKETS — ONE definition, because they were nine.
//
// User-ruled 2026-09-20: *"add NGF and United Netherlands (NET+BEL …) into both shortlist of reported countries,
// shortest list of high-tech majors, and the list of price-tracked markets."*
//
// ⭐ A STATE CHANGES TAG MID-CENTURY AND THE LISTS MUST NOT BREAK WHERE IT DOES. Two families:
//   · the German state  PRU → NGF → GER  (`NGF_ADJ` is "North German", `GER_ADJ` "German")
//   · the Low Countries NET + BEL → **UNL**, the United Netherlands, which vanilla's own formation rules let the
//     AI take whenever one power holds Holland, Flanders, Wallonia, Friesland and Gelre (`ai_will_do = always`).
//     It is NOT hypothetical: it stands in **2 of the 16 vanilla baseline seeds** from 1876 on, and in those seeds
//     NET and BEL simply cease to exist — so a pool that lists only NET and BEL silently loses BOTH members and
//     reports a smaller, poorer shortlist without anything failing. That is the bug this file closes.
//   ⚠ `UNL_ADJ` is **"Dutch"**, so the United Netherlands' market is still called "Dutch Market" — the market NAME
//     does not tell you which tag leads it, which is why prices are keyed by tag through MARKET_NAMES, not the reverse.
//
// ⚠ UNL is ONE country. It appears once in POOL (a pool is a set of tags present in the run, so no double count) and
//   gets its OWN row in MEMBER rather than being resolved into both NET and BEL, which would count it twice.

/** The shortlist pool, taken TOGETHER — the register's `pool` scope (BALANCE_FRAMEWORK §10.83). */
export const POOL = ['GBR', 'USA', 'FRA', 'NET', 'BEL', 'UNL', 'PRU', 'NGF', 'GER'];

/**
 * The "shortest list of high-tech majors" — one ROW per state, printed per country as the composition.
 * Each entry names the candidate tags in preference order; the first that exists in the run is the live one.
 */
export const MEMBER_FAMILY = {
  GBR: ['GBR'], USA: ['USA'], FRA: ['FRA'],
  GER: ['GER', 'NGF', 'PRU'],   // the German state, whichever form it is in
  NET: ['NET'], BEL: ['BEL'],
  UNL: ['UNL'],                 // its own row — present only in the seeds where it formed
};
export const MEMBER = Object.keys(MEMBER_FAMILY);

/** members present in a run's country set: { label -> tag } for the labels that exist. */
export function resolveMembers(countries) {
  const out = {};
  for (const [label, cands] of Object.entries(MEMBER_FAMILY)) {
    const t = cands.find(x => countries[x]);
    if (t) out[label] = t;
  }
  // where UNL stands, NET and BEL do not exist, and the reverse — nothing is double counted either way.
  return out;
}

/**
 * THE PRICE-TRACKED MARKETS: tag -> the market display name(s) `markets.tsv` can carry for it.
 * The name is `<ADJ> Market` off the market LEADER, read live by the telemetry's GetNameNoFormatting.
 * ⚠ A market only appears in markets.tsv if its leader was in that run's telemetry `tags` list — the
 *   ten-tag list of 2026-09-20 plus UNL. An older session carries the seven and the German/Belgian rows
 *   are simply absent, which is a property of the session, not a failure here.
 */
export const MARKET_NAMES = {
  GBR: ['British Market'], USA: ['American Market'], FRA: ['French Market'],
  NET: ['Dutch Market'], UNL: ['Dutch Market'], BEL: ['Belgian Market'],
  PRU: ['Prussian Market'], NGF: ['North German Market'], GER: ['German Market'],
  RUS: ['Russian Market'], JAP: ['Japanese Market'],
};

/** The tags whose markets the register reads prices in (PI / PP). The shortlist's own markets. */
export const PRICE_TAGS = ['GBR', 'USA', 'FRA', 'NET', 'UNL', 'BEL', 'PRU', 'NGF', 'GER'];

/** The telemetry `tags` a new schedule should carry (HANDOVER §0.4 + the 2026-09-20 ruling). */
export const TELEMETRY_TAGS = ['GBR', 'FRA', 'USA', 'PRU', 'NGF', 'GER', 'NET', 'BEL', 'UNL', 'RUS', 'JAP'];

/** market display name -> the tag that leads it, for every name above. Ambiguous names map to the FIRST tag. */
export const TAG_OF_MARKET = (() => {
  const m = {};
  for (const [tag, names] of Object.entries(MARKET_NAMES)) for (const n of names) if (!(n in m)) m[n] = tag;
  return m;
})();
