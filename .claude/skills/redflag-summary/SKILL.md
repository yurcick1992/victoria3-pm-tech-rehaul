---
name: redflag-summary
description: Write the 3–15-sentence summary of a batch's input-price red flags for the standardized report (the ledger), from redflag_metrics.mjs's digest. Use whenever a ledger fill has produced redflags_digest.md and the report still needs redflags_summary.html, and whenever someone asks what the red flags of a batch say. The report shows this summary and the metrics card only; the flag-by-flag listing stays in redflags_full.html beside it.
---

# Red-flag summary — the part of the red-flag card a script cannot write

The red flags (BALANCE_FRAMEWORK §10.94) are a list of every major market × industrially consumed good × stretch of years where the
price sat at ≥ 1.70× base for ≥ 2 years (HIGH) or swung ≥ 0.5× base within 3 years on under 10 units a week of supply (SWING). On a
sixteen-run four-rung batch that is ~1,600 flags. The user ruled on 2026-10-08 that the listing is far too large to read: the report
shows the **metrics card** (`redflag_metrics.mjs` → `redflags_card.html`) and **this summary**, nothing else. The listing is kept as
`redflags_full.html` beside the report and is shown only on request.

## Inputs and output

- Read **`<outDir>/redflags_digest.md`** (~15 KB). It holds the headline per basis, problem years by market, the top 20 HIGH market ·
  goods in full (runs flagged, span, problem years a run, price, supply, building demand, producers' staffed levels, the buyers present),
  the rest as one tally line, the top 10 SWING, and the reference arm (vanilla).
- If a question is not answered by the digest, read `<outDir>/redflags.json` (the full flags) — never `redflags_full.html` end to end.
- Write **`<outDir>/redflags_summary.html`**: 3–15 sentences in one to three `<p>` elements, nothing else (no heading — the card has one).
  `fill_assemble.mjs` splices it into the card as `__RF_SUMMARY__`; without it `fill_verify.mjs` refuses the report.
- Show the user the summary, not the listing, unless they ask for the listing.

## What the sentences must say, in this order (drop what does not apply; never pad to reach a count)

1. **The headline against its references.** Problem market-years (median of N runs, of 800) and chronic markets — and the base book's
   or the previous report's figures where the lede or the user names them. The vanilla line ONLY on a like-for-like basis: the pinned
   vanilla references are read on the save summaries alone (a good with no producer is unpriced there), so an order-book figure is never
   put beside a vanilla summary figure. If the vanilla column is "not read on this basis", the card already says so in a dim line under
   its table — do not repeat it; at most a clause that the comparison is open. Never invent it.
2. **What dominates.** The two to four market · good pairs carrying most of the problem years, with their share, and whether they recur
   across seeds ("in 16 of 16 runs") or are one seed's story.
3. **Why, from the supply side.** For each dominant pair: is it a SUPPLY FAILURE (producers at ~0 staffed levels, the market living on
   imports: nobody builds the producing rung there) or a CAPACITY LAG (producers staffed but behind demand)? Name the producing industry.
4. **Who is starved.** The buyers present (building · method) — but a buyer seen in a few of many flags is not the starved industry
   (FINDINGS F215). Say when the buyers are vanilla buildings (railways, urban centres, government administration) rather than our rungs.
5. **When.** The period split: early-century shortages of a good the market has not learned to make read differently from late ones.
6. **What is noise.** Phantom HIGHs (no buyer, demand under 10/wk — already outside the metric, mention only if they fill the listing)
   and SWING: vanilla throws ~21 SWING flags a run, so a SWING pattern is worth a sentence only where it departs from the reference
   (a good or market vanilla never flags) or names a chain that cannot start (the munition plant on lead and explosives).
7. **What changed** against the previous report of the same line, if anything did — or that nothing did.

## Rules

- Every number comes from the digest, the metrics JSON or redflags.json. No number from memory, no number rounded into a new claim.
- Name the basis once ("on the order books"). A HIGH is 1.70–1.75× base by construction; do not quote price ranges as findings.
- Plain declarative sentences, the project's GLOSSARY terms (era vs game era, "the shortlist", "major market"). Typographic apostrophes
  (’) are safe; `fill_assemble` converts word-internal straight ones.
- It is a reading, not a verdict on the book: no "the book fails", no proposed fix unless the user asks — the lede and "Next lever" own
  those. One clause pointing at a lever is acceptable where the digest makes the mechanism plain.
- After writing, re-run `node tools/testbed/ledger/fill_assemble.mjs <outDir>` and `node tools/testbed/ledger/fill_verify.mjs <outDir>`.
