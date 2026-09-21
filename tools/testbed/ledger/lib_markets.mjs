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

// ⭐⭐ MARKET CONTINUITY — A STATE'S MARKET IS ONE SERIES ACROSS ITS TAG CHANGES (user-ruled 2026-09-21):
//   *"assume continuity: GER is not a different market than NGF or PRU, and UNL is the same as NET. We don't need
//   separate references, just a priority set: 'if GER exists in 1935, it is assumed to be the continuation of PRU'."*
//
// So the price basis intersects SERIES, not market NAMES. Without this an arm carrying the Prussian Market and a
// vanilla run carrying the German Market share a German price series and intersect to NOTHING, purely because the
// state renamed itself — which is what made F153's basis read four markets.
//
// ⚠ The ruling is an ASSUMPTION and says so ("while this is not guaranteed"). It treats a successor state's market
//   as the same economy, which is right for PRU → NGF → GER and for NET → UNL, and is NOT claimed for anything else.
// ⚠ **BELGIUM IS ITS OWN SERIES AND IS NOT FOLDED INTO THE DUTCH ONE.** UNL forms out of NET *and* BEL, but the
//   ruling names only "UNL is the same as NET", so where UNL stands the Belgian series simply ENDS. That is the
//   honest reading: the country stopped existing. It does mean Belgian prices are unevenly covered across seeds.
// ⚠ Priority is first-match, so a run holding two members at one date (it should not) takes the LATER form.
export const MARKET_FAMILY = {
  'British Market':  ['GBR'],
  'American Market': ['USA'],
  'French Market':   ['FRA'],
  'Dutch Market':    ['UNL', 'NET'],
  'Belgian Market':  ['BEL'],
  'German Market':   ['GER', 'NGF', 'PRU'],
};

/** market display name -> the SERIES label it belongs to (its family key), or the name itself if unfamilied. */
export const SERIES_OF_MARKET = (() => {
  const out = {};
  for (const [series, tags] of Object.entries(MARKET_FAMILY)) {
    for (const t of tags) for (const n of (MARKET_NAMES[t] || [])) out[n] = series;
  }
  return out;
})();

/** the series a market name belongs to; unknown names stand alone so nothing is silently merged. */
export const seriesOf = name => SERIES_OF_MARKET[name] || name;

/** { series -> [names present] } for a set/iterable of market names seen in one run at one date. */
export function groupBySeries(names) {
  const out = {};
  for (const n of names) (out[seriesOf(n)] = out[seriesOf(n)] || []).push(n);
  return out;
}

// ⭐⭐ THE PRIORITY SET ASSUMES A CLEAN SUCCESSION, AND THE GAME DOES NOT GUARANTEE ONE (user, 2026-09-21):
//   *"in theory, other countries can form NGF, GER or UNL. Only AUS forming GER is somewhat likely (with or without
//   consuming PRU in the process), but other stuff could happen. Or after forming, a sub-country could be released
//   (say, PRU from existing GER). These are all rare events and correctly calculating everything in case of them is
//   not worth it. However, this all shouldn't just drop dead on these events."*
//
// ⇒ THE CONTRACT IS GRACEFUL DEGRADATION, NOT CORRECTNESS. Nothing here throws, nothing drops a run, and the
//   priority pick still decides — but where the assumption is VIOLATED the run says so, because a silent wrong
//   pick is the exact failure this file was written to close (a pool listing NET and BEL silently lost both the
//   day UNL formed). Handling the event properly is deliberately NOT attempted.
//
// WHAT IT CATCHES: two members of one family alive at once — AUS forming GER while Prussia survives, PRU released
//   from an existing GER, UNL beside a surviving NET.
// ⚠⚠ WHAT IT CANNOT CATCH, and this is a real blind spot rather than an oversight: a family with exactly ONE
//   member present that is not the state we mean — AUS forms GER *after* consuming Prussia, and the German series
//   silently continues into a country that never was Prussia. Distinguishing that needs the formation history,
//   which markets.tsv does not carry. Ruled not worth chasing; recorded so nobody reads a clean run as proof.
function collisions(families, present) {
  const have = new Set(present), out = [];
  for (const [key, members] of Object.entries(families)) {
    const live = members.filter(m => have.has(m));
    if (live.length > 1) out.push({ key, live });
  }
  return out;
}

// ⚠ The continuity check needs its OWN table, not MEMBER_FAMILY's. MEMBER deliberately keeps NET, BEL and UNL as
//   SEPARATE rows so that UNL is never counted twice — so a surviving NET beside a formed UNL is invisible there,
//   while the 2026-09-21 ruling ("UNL is the same as NET") makes it exactly the anomaly worth flagging. This table
//   mirrors the RULING; MEMBER_FAMILY mirrors the reporting rows. Keeping them apart is the point.
//   ⚠ BEL is absent by the same ruling: Belgium is its own series, so UNL beside BEL is not flagged here.
const CONTINUITY = {
  'the German state': ['GER', 'NGF', 'PRU'],
  'the Low Countries': ['UNL', 'NET'],
};

/** tags of one continuity family alive together, e.g. [{ key:'the German state', live:['GER','PRU'] }]. */
export const memberCollisions = tags => collisions(CONTINUITY, tags);

/**
 * market NAMES of one series alive together, e.g. [{ key:'German Market', live:['German Market','Prussian Market'] }].
 * ⚠⚠ THE MEMBER LIST MUST BE DE-DUPLICATED, and forgetting it cried wolf on every run: **NET and UNL share the one
 *    display name "Dutch Market"**, so the raw family list is `['Dutch Market','Dutch Market']` and matched ITSELF
 *    against a single present market — every arm reported a Dutch succession anomaly at five dates.
 * ⚠ The consequence of that collapse is real and unfixable here: **a surviving NET beside a formed UNL is invisible
 *   on the MARKET side**, because markets.tsv carries only the name and both are "Dutch Market". `memberCollisions`
 *   catches it on the TAG side, where they differ. Use that one when the question is which state is which.
 */
export const marketCollisions = names => collisions(
  Object.fromEntries(Object.entries(MARKET_FAMILY)
    .map(([s, tags]) => [s, [...new Set(tags.flatMap(t => MARKET_NAMES[t] || []))]])),
  names);

/** The telemetry `tags` a new schedule should carry (HANDOVER §0.4 + the 2026-09-20 ruling). */
export const TELEMETRY_TAGS = ['GBR', 'FRA', 'USA', 'PRU', 'NGF', 'GER', 'NET', 'BEL', 'UNL', 'RUS', 'JAP'];

/** market display name -> the tag that leads it, for every name above. Ambiguous names map to the FIRST tag. */
export const TAG_OF_MARKET = (() => {
  const m = {};
  for (const [tag, names] of Object.entries(MARKET_NAMES)) for (const n of names) if (!(n in m)) m[n] = tag;
  return m;
})();
