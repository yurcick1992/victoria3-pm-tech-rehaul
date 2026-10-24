# Findings — the archive

Entries of `FINDINGS.md` about retired lines — the six-rung ladder and its inverse solver, the first tier ladders, retired dam designs and
the performance of retired books — and the entries retracted or superseded wholesale, moved here verbatim on 2026-10-24 (user ruling for
the records: "index + archive"). A finding stays true about what it measured; it is here because nothing about the current line depends
on it. Each block is preceded by a comment giving its line range in `FINDINGS.md` at commit `5ab4fd1`, in that file's physical order.
The index at the top of `FINDINGS.md` lists every finding, archived or not, in number order.

---

<!-- FINDINGS.md lines 585–642 at 5ab4fd1 -->
## F62 — ⭐⭐ **THE COST CURVE'S FIFTH POINT: flat 1.0× vanilla anchors runs the century at ×0.54 vanilla GDP (n=2: 2,138/2,563M at 1935) — parity sits between 0.65× and 1.0×, near ~0.8× flat. The climb mechanism survives at full price (additions rotate t1→t4, payback falls 24y→5y with tier) and the labour reserve stays ABOVE vanilla (58.5% vs 35.7%). The subsidy mandate's removal holds at century scale: the residual is ≤£4k/wk against the mandated arm's £374–455k**

**Arm** `config` (vancost_nosub) · session `20260816_011552_vancost-nosub-n2`, n=2 centuries 1836→1936, both complete (wall 2h09/2h16, zero crashes), game 1.13.10 · 🟡 ARM-BOUND · comparators: vanilla n=4 + newbook n=2 (`20260813_083557`), flatcost 0.65× n=1 (`20260815_153825`), oldbook n=1 (`20260812_165702`)

### The response curve (world GDP at 1935/36, ratio to vanilla's 3.63–4.40B)

| cost book | GDP | ×van |
|---|--:|--:|
| ×1.5^tier × band ×2 (§10.57) | 1 181–1 317M | 0.28× |
| **flat 1.0× vanilla anchors** | **2 138 / 2 563M** | **0.49 / 0.58×** |
| vanilla | 3 632–4 396M | 1.0 |
| flat 0.65× anchors | 6 855M | 1.56–1.89× |
| old ~2y-payback book | 7 910M | ~1.9× |

Trajectory (run-mean ×van): 0.94 (1840) · 0.77 (1860) · 0.70 (1880) · 0.58 (1900) · 0.51 (1910) ·
0.53 (1930) · 0.54 (1935) — the ratio stabilises after 1910 instead of compounding away in either
direction. **A ×1.54 price step (0.65→1.0) moved century GDP ×3.2** — the curve is steep because
cost sets the reinvestment rate and the century integrates it. Log-interpolating the two flat arms
puts parity near **~0.8× flat vanilla anchors**; F59's alternative (mild tier slope ×1.1–1.2^tier on
~that base) remains the design candidate carrying both level and climb.

### The climb at full price — slower but intact

- Additions by decade (run 1, t0..t5): modal tier t1 through the 1870s → t2 by the 1890s → t3 by the
  1910s (502/532 of 1 677) → **t4 in the 1930s (745 of 2 510, 44%)**; t5 reaches only 2–10 levels by
  1936 (run 2: 161) — the century ends before t5's window at this pace.
- 1935 realized paybacks (world, £720/pt): t0 23.5y@0.61 staffing · t1 24.3y@0.61 · t2 15.8y@0.72 ·
  t3 8.5y@0.76 · t4 5.5y@0.91 · t5 4.8y@1.05 — **strictly falling with tier**, so the AI keeps a
  reason to climb, and the stale rungs (t0/t1 at 23–24y, 0.61 staffing) are dying correctly.
- 1935 tier stocks (run1/run2): t0 2 863/3 651 · t1 2 917/3 285 · t2 3 085/3 473 · t3 2 728/2 712 ·
  t4 1 076/1 665 · t5 12/161. GBR's stock mean-tier climbs 0.81 → 2.63 over the century.
- Investment pool at 1936: 0.22× GDP — inside vanilla's healthy ~0.28 band (0.65× ran 0.57×,
  oldbook 2.4–4.9×). Capital neither gluts nor starves at this price.

### Labour: the premise holds without draining

World pure unemployment 35–40% mid-century → 35.5% at 1935 (vanilla 16.0%); full reserve
(unemployed + peasants) 58.5% vs vanilla 35.7%; 11-major panel full reserve 56.6% vs 26.2%. The
0.65× arm drained the majors to 6.3% — at 1.0× the "more peasants than vanilla" premise holds with
a wide margin. The flip side is the same as the newbook's: a smaller economy hires fewer people,
and its measured profit-by-tier gradient partly rests on floored wages (F58's caveat).

### The subsidy-mandate removal at century scale (nosub-probe1's confirmation)

World infrastructure subsidies: £38.5k/wk (1840) → £7.8k (1850) → £3.0k (1880) → **£0.1k (1910)** →
£3.2k (1936), against flatcost's mandated £374–455k/wk. The six tracked majors pay £0 at nearly
every read. Bankruptcy counts stay at vanilla-like levels; infrastructure keeps being built.

### What it does NOT say

- n=2 with a ~10–20% between-run spread at 1935 (2 138 vs 2 563M) — wider than the newbook pair's
  3%; single-decade comparisons between these runs are inside that noise.
- The arm moved TWO variables vs flatcost (cost AND subsidies) by explicit instruction; the ~13%-of-
  gov-expense subsidy bleed removal is a small part of the GDP delta, not zero, and this batch
  cannot apportion it exactly.
- Payback figures stay on the flat-£720 basis (F53's ~27% late-tier bias, shared by all arms).
- "Parity ≈ 0.8×" is an interpolation on two flat points, not a measurement.

<!-- FINDINGS.md lines 813–871 at 5ab4fd1 -->
## F59 — ⭐⭐ **A FLAT COST BOOK RESTORES THE CLIMB COMPLETELY — the ladder rotates one tier per ~22 years, tier-5 reaches 2,826 levels where the ×1.5^tier book built ONE, and tier n−2 measurably dies. At 0.65× vanilla anchors the level is ~2× too cheap: GDP ends at 1.56–1.89× vanilla with the majors' labour reserve drained to nothing**

**Session `20260815_153825_flatcost-n1`**, n=1 (explicit user instruction), 1836→1936, self-quit,
one F56 sway-CTD survived by a clean resume, game 1.13.10, wall clock ~2h54. Arm: the shipped config
with ONE change — every tier's `building_cost` FLAT at 0.65 × its industry's vanilla anchor
(260/390/520 by vanilla's 400/600/800 classes). Rationale and regeneration map:
`schedules/flatcost_n1.json`. Comparators: F57's three points, same game version.

### The response curve now has four points

| cost book | world GDP 1935/36 | vs vanilla |
|---|--:|--:|
| ×1.5^tier × band ×2 (§10.57) | 1 181–1 317M | **0.28×** |
| vanilla itself | 3 632–4 396M | 1.0 |
| **flat 0.65× anchors** | **6 855M** | **1.56–1.89×** |
| old ~2y-payback book | 7 910M | ~1.9× |

GDP ratio by decade (flatcost): 0.98 (1850) · 0.98 (1860) · 1.06 (1870) · 1.13 (1880) · 1.08 (1890) ·
1.18 (1900) · 1.34 (1910) → 1.56–1.89 (1935) — tracks vanilla for three decades, then compounds away
as the climbed rungs' VA advantage feeds back into construction.

### The climb mechanism works — all three design behaviours appear at once

- **Rotation on the anchor cadence.** Share of tier-level ADDITIONS by tier: modal tier t1 in the
  1840s–50s → t2 in the 1870s → t3 in the 1900s–10s → t4 in the 1920s–30s, with t5 at 15% and rising
  in the 1930s. t0's share decays 39% → 5%. Endpoint stock t0..t5:
  5 745/9 803/10 918/13 269/11 544/**2 826** (the ×1.5^tier book: 3 936/2 429/1 131/501/103/**1**).
- **A falling payback ladder while climbing** (1880 realized: t0 14.7y · t1 12.3 · t2 10.6 ·
  **t3 6.1y**) — return per point rises with tier, so the AI climbs unprompted.
- **Obsolescence is real** (1935 realized: t0 24.9y · t1 **31.3y**, staffing sagged to 0.57–0.63,
  t0/t1 profit/level falling in absolute terms — while t4 reads 6.7y and t5 3.3y). Tier n−2 dies the
  way the ladder intends: economically dead, lingering at low staffing.

### The overshoot, and what it is made of

Frontier rungs far below the 10–15y vanilla window (t5 3.3y) flood with investment: construction
sectors end at 3 413 (vanilla ~2 000), pool at 3 924M = 0.57× GDP (vanilla 0.28×), pure unemployment
10.5% (below vanilla's 15–18.4%), and the 11-major panel's unemployed+peasants share drains to
**6.3%** against vanilla's 25.6% (GBR: 0.6%, pure unemployment 0.1%). The "more peasants than
vanilla" design premise inverts at this cost level — the boom eats the whole reserve, era6-n1's
overheating in milder form.

### What it says for the book

Parity is now an interpolation, not a search: a flat-ish book with a **mild tier slope — anchor ×
~1.1–1.2^tier, no ×2 band** — sized so a frontier rung's *transient* debut margin reads ~8–12y while
its steady-state margin reads 20y+ (F58: any per-level profit edge is a transient that wage catch-up
erases; the book must charge for the transient, not the steady state).

### What it does NOT say

- **n=1**, and the port/railway subsidy bleed (F57 §5) was deliberately left in — constant across
  every compared arm, so it cannot explain differences, but absolute levels carry it.
- Payback figures are on the flat-£720 basis (F53's known ~27% late-tier bias, shared by all arms).
- The overshoot conflates "frontier too cheap" with "labour became the binding ceiling" — both are
  present and n=1 cannot apportion them.
- Nothing here re-tests the ×2 band or the exceptions separately; the flat book removed band,
  exponent and the t0 discount together.

<!-- FINDINGS.md lines 928–1056 at 5ab4fd1 -->
## F57 — ⭐⭐ **THE GDP GAP IS A CONSTRUCTION GAP, AND THE TWO-BAND COST BOOK IS ITS DOMINANT CAUSE: the same ladder ran at 1.9× vanilla GDP under the old book and 0.28× under the new one. Value added per economic level is EQUAL across arms — the mod is smaller only because it builds a third of the levels**

**Analysed 2026-08-15**, entirely from existing save summaries — no game was launched. Sessions:
`20260813_083557_vanilla-vs-mod-n4` (vanilla n=4, mod n=2, all 1836→1936, new cost book, 1.13.10) and
`20260812_165702_era6-n1` (mod n=1, same 106-tier ladder, **old** cost book, 1.13.10) as the third arm.
Both mod runs of the 08-13 batch agree on every number below; vanilla figures are run001/run003 means
unless stated.

### 1. The decomposition: the gap is the LEVEL COUNT, not the value per level

World GDP ÷ world **economic** building levels (tier industries + untiered farms/mines/plantations;
construction sectors, ownership, subsistence, urban centres, government, military and trade centres
excluded) is nearly one constant across both arms and the whole century:

| | 1840 | 1935 |
|---|--:|--:|
| vanilla GDP / econ levels | 451.7M / 12k = **37.6k** | 4 390M / 114k = **38.5k** |
| mod GDP / econ levels | 442.1M / 11k = **40.2k** | 1 250M / 35k = **35.7k** |

⇒ **GDP ratio 0.28 ≈ econ-level ratio 0.31.** Composition and per-level productivity differences are
second-order (mod GDP also carries proportionally more subsistence, so its econ VA/level is if anything
slightly lower — the direction that strengthens this reading). The whole question reduces to: **why does
the mod build a third of the economic levels?**

### 2. The construction chain: capacity × utilization, and neither compounds

| ratio mod/vanilla | 1840 | 1860 | 1880 | 1900 | 1920 | 1935 |
|---|--:|--:|--:|--:|--:|--:|
| world GDP | 0.98 | 0.86 | 0.73 | 0.55 | 0.39 | **0.28** |
| construction points delivered/yr | 0.92 | 0.96 | 0.53 | 0.33 | 0.22 | **0.14** |
| construction-sector levels | 0.88 | 0.79 | 0.82 | 0.67 | 0.51 | **0.34** |
| gov construction-goods £/wk | 0.86 | 0.72 | 0.61 | 0.44 | 0.28 | **0.16** |
| investment pool | 1.19 | 1.06 | 0.93 | 0.53 | 0.32 | **0.23** |

The mod's absolute points/yr is **flat ~180–330k for a century** while vanilla's grows ~10×: the economy
does not shrink, it **never compounds**. Points/yr = capacity (0.34) × per-level output (mod ~390
pts/yr/level vs vanilla ~1 000 — idle or on cheaper construction PMs; sectors read fully staffed, so it
is the queue/PM side, not hiring). Leaders are the sharpest case: **GBR's investment pool is £0 from
1900 to 1936, its construction sector falls 21 → 6 levels, its construction-goods spend collapses
68k → 26k/wk while vanilla GBR's grows 64k → 400k**; GBR GDP 28M → 42M in a century vs vanilla's
28M → 426M. FRA/GER/USA pools ≤1.7M against vanilla's 66–280M. ⚠ This is the OPPOSITE regime from
era6-n1's capital glut — see §4.

### 3. Realised cost per level is ~vanilla — because the AI never buys the dear rungs

Average points per econ level added: vanilla 337→429 across the century, mod 346→475 (+5–11%). The cost
book does not act through the average price paid; it acts through **selection**. Tier-building levels
ADDED per decade by tier (both mod runs summed):

| decade | total | t0 | t1 | t2 | t3 | t4 | t5 |
|---|--:|--:|--:|--:|--:|--:|--:|
| 1840s | 1 165 | 50% | 41% | 9% | 0% | 0% | 0% |
| 1880s | 1 277 | 45% | 34% | 16% | 5% | 0% | 0% |
| 1900s | 1 519 | 38% | 33% | 21% | 7% | 1% | 0% |
| 1920s | 1 822 | **40%** | 27% | 17% | 14% | 2% | 0% |
| 1930s | 1 177 | 41% | 27% | 17% | 12% | 3% | **0%** (1 level) |

Tier 0 — the pre-industrial rung — is the single most-built band in every decade to the end. And the AI
is **rational** in this: GBR (holding all tech-era-5 technology) at 1920 earns, per £ of capital at £720/pt —
t1 **4.6%/yr**, t2 3.5%, t0 2.6%, t3 **2.1%** (t3 runs at 0.55 staffing; at 1900 it was 0.32 staffing
and 1.0%/yr). Per LEVEL the ladder is right-way-up by 1920 (world profit/lv t4 818–1 278 vs t0 ~350) —
per POINT it is upside-down, because the book prices t3 at 2.25–4.5× t1 while the debut rung starts
understaffed on thin manufactured-input chains. **The realised in-game payback of the healthy rungs is
~17–19 years and of debut rungs 25–100, against the 11.5 the census models from scenario margins** —
the scenario overstates in-game margins, so the book calibrated on it overprices in-game.

### 4. The three-way comparison: the cost book is the dominant cause, measured

Same 106-tier ladder, same 1.13.10, research events on in both mod arms. Config diff between the two
builds (`f90e1c2` → `ae6c30c`): **`building_cost` changed on 105 of 106 tiers, median ×6.67, max
×14.1**; recipes essentially unmoved (44 tiers' inputs re-solved, ONE output moved >5%); 14 tech gates
changed by the merges and the ladder-era alignment — both in the *easing* direction, so they cannot
produce a collapse.

| final state (1936) | era6-n1, OLD book | vs-mod runs, NEW book | vanilla (n=4) |
|---|--:|--:|--:|
| world GDP | **7.91B** | 1.16–1.32B | 3.63–4.40B |
| tier-building levels | **76 616** | 7 198–8 101 | — |
| tier levels t3/t4/t5 | 19 792 / 11 793 / 2 678 | 381–501 / 45–103 / 0–1 | — |
| unemployment share | 11.5% | 40.3–41.8% | 15.0–18.4% |
| binding constraint | workforce (F52) | **capital** | — |

⇒ The old ~2-year-payback book produced a hypergrowth artifact at **1.9× vanilla GDP** with labour
exhausted and the pool hoarded (F52); the new book **divides the same economy by ~6**, flips the
constraint from workforce to capital, and idles 40% of the workforce. Both violate the after-1836
GDP-fidelity premise, in opposite directions — **the dial between them has both endpoints measured
in-game**, and vanilla's own realised payback (10–15y, F53) names the target in between.
⚠ This largely discharges the 08-13 verdict's "cannot separate the ladder from the cost book" caveat,
with the stated n=1-vs-n=2 and intervening-commits limits.

### 5. The infrastructure split bleeds treasuries from day one and stands dead capital

- **First-rung port subsidy runs ~7× vanilla per level from the start**: 1850 world port subsidies
  407k/wk over 378 subsidised levels (£1 076/level) vs vanilla 55–68k over 394 (£140–170). World
  subsidy bill at 1850: mod 414k vs vanilla 62–75k — ~13% of ALL world government expense against
  ~2%. GBR opens 1837 paying 51k/wk of subsidies against vanilla's 6.4k — ⅔ of its construction
  budget.
- **The higher port tiers cannot be subsidised at all**: vanilla's admin strategies name
  `building_port`, our split tiers have keys the subsidies block never mentions. Measured result:
  port_steam **101 levels at 0.02 staffing** (1850); port_industrial/modern/steam 448 levels at
  0.01–0.03 staffing (1900), subsidised 0 — built, dead, providing ~no `state_infrastructure`.
  The same key narrowing hits railway tiers (railway_steam staff 0.55–0.71, unsubsidised).
- **Railways: mod 458 levels at 1900 vs vanilla 2 227** — states are plausibly infra-starved
  economy-wide (market-access penalties are NOT instrumented; see "does not say").
- Countries ever-bankrupt: mod **56–58 by 1850** vs vanilla 31–38; 125 vs 83–96 by 1935.

### 6. Ruled out as causes

- **Research/technology**: mean technologies held is inside the vanilla range (mod 91.9–100.0 vs
  vanilla 94.0–104.9). The research events fire (5 040–5 180 times) but 76% on tier-1 gates and never
  on a tier-4/5 gate — a symptom of the missing industrial base, not a cause of the gap.
- **The crashes**: engine bug in 1.13.10 sway evaluation (F56), hit the vanilla control too.
- **Value-added per level, prices, composition**: §1 — equal to second order.
- **Recipe drift between the two mod builds**: one output moved >5%.

### What it does NOT say

- The era6-n1 arm is **n=1**, and five commits sit between the builds (tech merges, ladder-era
  alignment, a research-bar fix); the attribution rests on the config diff's magnitudes and
  directions, not on a clean A/B. The pre-empted `costbook_ab_n2` remains the clean experiment if the
  ~6× needs a defended effect size.
- Whether mod states are actually infrastructure-starved is **inferred from dead port/railway levels,
  not measured** — market access / state infrastructure is not instrumented in either instrument.
- Why mod construction sectors deliver ~390 pts/yr/level against vanilla's ~1 000 (queue idle vs
  cheaper construction PMs) cannot be split from the summaries — construction PM choice is not
  persisted per country in ours.
- Nothing here says the old cost book was right: 1.9× vanilla GDP with a ~2-year payback is the
  opposite calibration failure.

<!-- FINDINGS.md lines 1431–1526 at 5ab4fd1 -->
## F52 — **THE LADDER IS NOT CLIMBED: only 38% of it is realised, capital piles up unspent, and the binding constraint is WORKFORCE, not capital or technology**

**Session:** `20260812_165702_era6-n1`, n=1, 1836→1936, self-quit, 13 674 s. Arm: `{kind: config,
config: config/mod_config.json}` = the shipped **106-tier re-banded ladder** with research events on,
game **1.13.10**, `moderate_consolidation`.
**Compared against:** `20260812_093402_research-events-fixed-n2/run002`, the same arm on the **100-tier**
ladder and game **1.13.9**. ⚠ Mod-versus-mod: ladder and game version moved together and this cannot
separate them. **No vanilla baseline exists for any of it** — every vanilla session predates the savegame
harvest (2026-08-11) and carries zero summaries.

### The headline: 38% of the ladder is realised

Mean output per built level **82.7**, against **220.5** if every level were tier 5. World levels at 1936,
with the technology leaders holding **all** of tech era 5:

| tier | 0 | 1 | 2 | 3 | 4 | 5 |
|---|--:|--:|--:|--:|--:|--:|
| world levels | 9 390 | 14 771 | 17 878 | 19 748 | 12 633 | **3 143** |
| share | 12.1% | 19.0% | 23.0% | 25.5% | 16.3% | **4.1%** |
| GBR | 4.2% | 19.3% | 21.7% | 26.0% | 22.3% | **6.5%** |
| GER | 7.1% | 15.6% | 19.6% | 27.8% | 22.4% | **7.5%** |

Britain researched every era-5 production technology and stands on tier-5 buildings for **6.5%** of its
levels. A third of world capacity is still tier 0–1 in 1936.

⭐ **THE OLD RUNG IS NEVER DISPLACED, and the time series shows it plainly.** GBR tooling by tier, share of
levels: t2 holds **~40% continuously from 1887 to 1936** while t3 arrives and settles beside it at ~40%;
t4 and t5 never exceed 6% and 1%. Steel reaches t5 only in **1927**, at ~10%, and sits in a t4/t5
near-tie **despite t5 being twice as profitable** (37% vs 13% for GBR alone; 42% vs 19% market-wide).
Obsolescence — the mechanism the whole profitability ladder exists to produce — is not happening.

### Capital piles up unspent

| | 100-tier | 106-tier |
|---|--:|--:|
| investment pool, world | 3.75bn | **8.46bn** (+126%) |
| top-10 share of it | 89.8% | 85.5% |
| pool ÷ own GDP, leaders | 0.96–1.81 | **2.37–4.94** (GER 3.37 · HUN 3.53 · BEL 4.18 · TIB 4.94) |
| owner (financial district + manor) profit per level | 546.9 | **469.2** |
| manufacturing profit per level | 601.3 | **478.7** |

⇒ **The pool is not being fed faster — it is not draining.** Total owner profit is nearly flat (+9%)
while the pool more than doubled, and profit per level FELL on both measures.

### The binding constraint is workforce

Peasants + unemployed as a share of workforce (dependents excluded) first falls below 5% at:

| GER | AUS | GBR | TUR | RUS | USA | JAP | FRA | CHI |
|---|---|---|---|---|---|---|---|---|
| **1889** | 1895 | **1898** | **1898** | **1910** | 1919 | 1920 | 1926 | never — 57.6% at 1936 |

It collapses abruptly once it turns: Germany 34.4% (1873) → 17.0% (1882) → **0.7% (1891)**; Britain 37.3%
→ 22.6% → 15.5% → **1.6% (1900)**. World peasants **208.8M → 101.2M** while salaried went 53.4M → 374.4M.
Nine of the ten pool hoarders end at ~0% slack (GER: 282 unemployed and 22k peasants against 27.0M
salaried). The in-game UI states the cause directly — private construction is blocked for lack of
workforce.

### Three explanations MEASURED AND REJECTED — do not re-run them

1. **1.13.10's railway fix removing a capital sink.** Railways grew **+39%** in this run, not fewer.
2. **Persistent margins feeding the pool.** Profit per level FELL, 601 → 479; owner profit per level
   547 → 469.
3. **A labour ceiling capping a high-productivity economy.** Our per-worker ceiling is ~2.4× vanilla's
   (our ladder ×5.9 bottom-to-top; vanilla's median ×2.50 across the same 19 industries, with vanilla
   also holding employment flat in 17 of 19). Exhausted labour therefore cannot explain *lower* output —
   the economy never becomes high-productivity in the first place.

### What it does NOT say

- **Nothing about vanilla.** Total supply at base prices came out British market 29.1M vs vanilla's
  46.9M and American 30.3M vs 34.2M — but market membership is unmatched between the two instruments,
  only one vanilla run reached 1936, and `goods_out` (savegame) has never been cross-validated against
  `production` (telemetry). Treat as unresolved.
- **It cannot separate ladder from game version**, n=1 against n=1.
- **It does not identify WHY the AI declines the upgrade** — build cost, `ai_value` (unauthored, per
  ROADMAP), or never demolishing the old building. `building_budget` is itemised per building in the
  annual summaries, so the construction queue's composition would separate them with no new game time.

### Two things that are not the economy but came out of the same run

- **Treasury is FLOORED AT 0 in the save** — zero negative `money` entries in a 544 MB melt, no debt or
  loan field, and `credit` is the GDP-scaled *limit* not the drawing. 105 of 244 countries sit at the
  floor and **107 have gone bankrupt**, so a sum of treasuries is not a fiscal position. The flow is:
  world net weekly **−80k → −226k**, countries in deficit 83 → 106.
- ⭐ **POP RECORDS +43% BY 1910, and the slowdown tracks it.** Pop objects ran 1.04× at 1840 rising to
  **1.43× at 1910**; the wall-clock speed ratio ran 0.92 falling to **0.61** over the same decades, and
  1/1.43 = 0.70 against a measured 0.61. Our ladder holds six rungs of one industry simultaneously and a
  pop's identity includes its workplace, so the workforce fragments across more records — and pop
  records, not people, are what the engine iterates. Population itself rose only 6%; live and empty pops
  grew in lockstep (empty share stable at ~17–18%), so these are real records rather than husks.
  ⚠ **This makes the mod, not the hotfix, the leading suspect for the 1.43× wall-clock cost** — reversing
  the reading taken earlier the same day from a count of tiers and journal entries (+6%, +13%), which
  missed the quantity that actually scales.


<!-- FINDINGS.md lines 1706–1850 at 5ab4fd1 -->
## F49 — **THREE ARMS, ONE RUN EACH: the mod costs no wall clock and is not more broken than vanilla; mandating trade-centre subsidies buys 2× the trade for 22pp of the budget; and the technology distribution has COMPRESSED against the mod's own goal**

⚠⚠ **n=1 PER ARM. READ THE NOISE FIGURE BEFORE ANY NUMBER BELOW.** The batch supplies its own warning:
`mod` and `mod_no_tc` differ by **six lines of AI subsidy policy** and came in **9% apart on wall
clock**. Any arm-to-arm difference smaller than that is not evidence. The batch was planned as n=2 and
stopped after three runs plus a partial by user decision; runs 4–6 are deferred.

**Arms, span, instrument.** `20260811_094048_three-arm-tc-subsidy`, 1836.1.1 → 1936.1.1, telemetry v12
(`country_state`, `population`, `tech_log`, `building_inventory`, `treasury`, `events`), yearly
autosaves, save summary v3.
- `vanilla` = `{kind: control}` — vanilla + telemetry, zero gameplay content.
- `mod` = `{kind: config, config/mod_config.json}` — the shipped mod, 217 technologies, 100 tier buildings.
- `mod_no_tc` = `{kind: config, config/mod_config.no_tc_subsidy.json}` — **verified by a full-tree build
  diff to differ from `mod` in exactly six lines**: `building_trade_center = must_have` removed from all
  six administrative AI strategies, plus the build timestamp. Vanilla's own `ai_strategy_default`
  subsidises power plant / railway / port and **not** trade centres, so this genuinely withdraws the
  mandate rather than deferring to a default that reinstates it.

**1. WALL CLOCK — the mod is free, and so is the telemetry.**

| arm | wall | vs vanilla |
|---|---|---|
| vanilla | 2.82 h | — |
| mod | 2.79 h | −0.9% |
| mod_no_tc | 2.55 h | −9.3% |

−0.9% is far inside the 9% noise, so: **no measurable cost**. ⭐ Separately, this session's vanilla ran
**2.82 h against 2.83 h** for the last full-length vanilla run (`20260806_110926`, 2026-08-06) despite a
completely different metric set (`market_goods_scoped` + breakdowns + the 50-market wide sweep, versus
this batch's six). **The telemetry tax is indistinguishable from zero across two very different loads.**
⚠ The economies of those earlier runs cannot be compared — they carried no `country_state`, so no GDP,
buildings or population were logged at all.

**2. THE TRADE-CENTRE SUBSIDY WORKS AND IT IS EXPENSIVE.** At 1935, summed over every country:

| | vanilla | mod | mod_no_tc |
|---|---|---|---|
| trade-centre subsidy £/wk | 0 | **4 964 343** | 0 |
| all subsidies £/wk | 970 473 | 9 155 091 | 3 532 161 |
| **all subsidies, % of government expense** | **4.7%** | **35.1%** | **12.7%** |
| market trade capacity | 55 343 | **135 788** | 66 258 |
| trade-centre levels | 6 790 | 11 404 | 8 166 |
| world GDP | 4 037M | 4 163M | **5 646M** |
| distinct bankruptcies over the century | 827 | **1 389** | 959 |
| countries ever bankrupt by 1935 | 102 | **131** | 100 |

The mandate buys **2.05× the market trade capacity** and 40% more trade-centre levels, paid for with
**22 percentage points of government budget share** and a ~45% higher bankruptcy count.
⚠ **The GDP column is the least safe number here.** Much of `mod_no_tc`'s 36% lead is one snowball —
BIC at 800M, larger than any country in either other arm — and at n=1 a single runaway moves the world
total. The direction matches the concern (capital spent on subsidy is not accumulating) but the
magnitude is not established.

**3. HOW BROKEN IS THE MOD? NOT MORE THAN VANILLA, AND LESS ON THE CLEANEST MEASURE.**

| at 1935 | vanilla | mod | mod_no_tc |
|---|---|---|---|
| loss-making building levels | 21 535 | 17 970 | 30 718 |
| — as a share of all levels | 10.0% | **7.6%** | 10.9% |
| subsidised levels | 6 472 | **19 225** | 6 836 |
| entries into default (events) | 1 507 | **3 544** | 2 587 |
| technologies held, top-10 mean | 134.1 | 146.6 | 163.6 |

All three arms played a century with **no crashes, no resumes, all 12 dumps complete, and zero
telemetry errors** (our own lines in `error.log`: 0 in every arm; the 42–75k lines present are
vanilla's own noise). The mod's real costs are 3× the subsidised levels and 2.3× the defaults, both
traceable to the subsidy mandate rather than to the tier ladder.

**4. THE MOD'S THREE GOALS, MEASURED.**

- **Capital demand (goal 3) — met, modestly.** Construction goods spend as a share of GDP runs
  10.8% → 10.5% → 12.3% in the mod against vanilla's 8.9% → 9.8% → 13.2% at 1870/1900/1935. The mod
  front-loads capital demand but does not end higher.
- **A tech edge should pay (goal 1) — weakly positive.** Regressing ln(GDP per head) on technologies
  held across countries over 1M people at 1935: slope **0.0117 (vanilla) → 0.0134 (mod) → 0.0155
  (mod_no_tc)**, R² 0.07 → 0.12 → 0.17. ⚠ A correlation across countries in one world, not a causal
  estimate — a rich country researches faster too. Comparable between arms and nothing more.
- **Drive out inefficient producers (goal 2) — NO EVIDENCE EITHER WAY.** Top-1 producer share of world
  output on 13 advanced goods: vanilla **26.1%**, mod **26.4%**, mod_no_tc 23.4%. Against 13 basic/raw
  goods: 18.7% / 17.6% / 23.0%. So advanced goods genuinely are ~8pp more concentrated than raw ones in
  both vanilla and the mod, and the mod preserves that structure without steepening it.
  ⚠⚠ **A first reading of this said "goal 2 is not happening" from a top-1 share averaged over all 49
  goods (22.9% mod vs 25.7% vanilla). That was wrong** — the all-goods mean blends the 22 goods the mod
  tiers with the 27 it does not, and the arms differ in composition (`mod_no_tc`: 20.0% tiered against
  27.8% untiered). The corrected comparison is a wash, and even that rests on one good, `small_arms` at
  62%; drop it and the mod falls ~3pp below vanilla. ⚠ Top-1 share is a weak instrument — it cannot
  distinguish a near-monopoly from a duopoly, which is the distinction the claim is about. Top-3 share
  and HHI, value-weighted, are the fix and are not yet implemented.

**5. ⚠⚠ RETRACTED WITHIN THE SESSION — "THE TECHNOLOGY DISTRIBUTION HAS COMPRESSED" WAS ONE COUNTRY,
NOT A DISTRIBUTION.** The claim was that vanilla's leader holds 160 technologies against a median of 122
while the mod's holds 130 against 130, so the mod flattens the technology race. **The full distribution
says otherwise.** Countries with ≥1M people, at 1935:

| arm | n | min | p10 | p25 | median | p75 | p90 | max | p90/p10 | Gini |
|---|---|---|---|---|---|---|---|---|---|---|
| vanilla | 125 | **86** | 93 | 104 | 122 | 141 | 154 | 166 | 1.66 | 0.103 |
| mod | 137 | 3 | 105 | 114 | 130 | 154 | 167 | 177 | 1.59 | 0.109 |
| mod_no_tc | 130 | 3 | 103 | 117 | 127 | 152 | 164 | 188 | 1.59 | 0.112 |

| | tech leader | median | **leader ÷ median** | biggest economy | its rank on tech |
|---|---|---|---|---|---|
| vanilla | WAL 166 | 122 | **1.36×** | USA 160 | 5 of 125 |
| mod | SAX 177 | 130 | **1.36×** | RUS 130 | **67 of 135** |
| mod_no_tc | NOR 188 | 128 | **1.47×** | BIC 127 | 65 of 128 |

**Leader ÷ median is identical in vanilla and the mod (1.36×) and wider in mod_no_tc.** The mod's top is
higher in absolute terms (177 / 188 against 166), its Gini is marginally *higher*, and its floor is far
lower — vanilla has no ≥1M country under **86** technologies while the mod has some at 3. Nothing here
is compressed.

⚠ **What the original figure actually measured** was the technology count of *the single highest-GDP
country*. In the mod that is Russia, 67th of 135 on technology; in vanilla it is the USA, 5th of 125.
But the mod's #2 and #3 economies are the USA at 173 and Britain at 174, right at the frontier — so the
statistic turns on which large-population state happened to top the GDP table in one campaign, which at
n=1 is close to a coin toss. **A one-country statistic was reported as a property of the world.**

⇒ **The design conclusion drawn from it is withdrawn too.** It was used to argue that the spread boost
and step 2's research events pull against each other and that spread should therefore stay small. That
argument may still be right, but **this measurement does not support it** and must not be cited for it.

**What DOES survive, and agrees with F48.** Countries reach a *smaller share of a bigger tree*: the tech
leader holds 95–98% of the technologies seen in play, on trees of 186 and 192 against vanilla's 171 —
and §4's slope of ln(GDP per head) on technologies is *steeper* in both mod arms (0.0134 / 0.0155 against
0.0117), i.e. a technology is worth slightly **more** in the mod, not less. Goal 1 is weakly served.

**A related reading, also weak, also n=1.** Professions per 1000 people at 1935: vanilla's #1 economy has
78.9 engineers/1k against 3.1 for #5, while the mod's #5 (FRA, 57.8) has more than its #1 (RUS, 44.1).
⚠ Same defect as above — ranking by TOTAL GDP and then comparing PER-CAPITA mixes two things, and a
populous leader looks thin per head by construction. Rank by GDP per head before reporting this again.

**What this does NOT say.** Nothing at n=2. Nothing about whether the trade-centre subsidy is *worth*
it, only what it costs and buys. Nothing about the earlier vanilla sessions' economies (not logged).
And no causal claim about technology and GDP.

**Evidence.** `tools/testbed/sessions/20260811_094048_three-arm-tc-subsidy/`, runs 1–3 complete plus a
partial run 4 (21 vanilla summaries to 1856). Regenerate every table with
`node tools/testbed/analyse_three_arm.mjs <session>`.
⚠ **The arms were renamed under this finding by a later ruling (2026-08-11).** The trade-centre subsidy
mandate was removed from `config/mod_config.json`, so the SHIPPED mod is now what this finding calls
`mod_no_tc`, and `config/mod_config.no_tc_subsidy.json` is deleted. Read the `mod` column here as "the
mod as it was, with the mandate" and the `mod_no_tc` column as "the mod as it ships now".

---

<!-- FINDINGS.md lines 1851–1921 at 5ab4fd1 -->
## F48 — **A FULL CENTURY ON THE TECH TREE: no GDP penalty, ~8% wall-clock cost, and 86–88% of a 217-technology tree reached. The top tech era is under-reached — but that is VANILLA's property, not ours**

**Arm, n, span.** `20260811_020843_techtree-full-n3`, `{kind: config, config/mod_config.json}` — the full
modded build, **n=2 completed** (a third run was stopped by the user before it produced data),
1836.1.1 → 1936.1.1, telemetry v11 (`country_state`, `population`, `tech_log`, `building_inventory`).
Vanilla reference is **cross-session**, not contemporaneous: `20260801_001026_vanilla-n3-v5`,
`{kind: control}`, n=3, same span, telemetry v5.

**1. GDP — no detectable penalty.** World GDP at 1935:

| arm | runs | world GDP | mean |
|---|---|---|---|
| **mod** | 3 776M · 4 513M | spread **19%** | **4 145M** |
| vanilla | 4 166M · 4 163M · 4 453M | spread 7% | **4 261M** |

The mod sits **~3% below vanilla and far inside its own run-to-run spread**, so the honest statement is
*no measurable difference*, not *slightly lower*. Both arms grow the world about **×11** over the
century (378M → ~4.2Bn). ⚠ n=2 with a 19% spread bounds nothing tighter than that.

**2. The technology picture by decade** — measured as **distinct technologies reached by anyone in the
world**, which is rename-proof (see the trap below). The two runs agree to within 3–5 technologies at
every decade:

| by | 1840 | 1860 | 1880 | 1900 | 1910 | 1920 | 1930 | 1936 |
|---|---|---|---|---|---|---|---|---|
| of 217 | 63 | 89–92 | 119 | 146–148 | 158–163 | 166–169 | 178–181 | **187–190** |
| % | 29% | 41% | 55% | 67% | 73–75% | 76–78% | 82–83% | **86–88%** |

By tech era at 1936: **tech era 1 45/45 · tech era 2 39/39 · tech era 3 45/45 · tech era 4 43–44/47 · tech era 5 15–17/41.**

**3. ⭐ THE TOP TECH ERA IS UNDER-REACHED, AND IT IS MOSTLY VANILLA'S DOING.** 20 of the 41 era-5
technologies are never acquired by anyone, in either run — but **only 6 of those 20 are ours**. The
other 14 are vanilla's own: antibiotics, chemical warfare, flamethrowers, stormtroopers, mobile armour,
super dreadnought, modern battlefleet tactics, paved roads, macroeconomics, mass propaganda, mass
surveillance, modern financial instruments, analytical philosophy, behaviorism. Nobody finishes era 5
in Victoria 3, and our deepening of it did not create that.
⇒ **32 of our 38 new technologies ARE reached.** The six that are not gate exactly six top rungs:
artillery t5 (*Autofrettage*), munitions t5 (*Automatic Cartridge Lines*), engines t5 (*High Speed
Diesel*), ports t5 (*Mechanised Cargo Handling*), steam shipyards t4 (*Oil-Fired Boilers*) and art
academies t5 (*Sound Film*). Those buildings are, in practice, never built.
⇒ Tech era 4 is nearly complete — only 2 of 47 unreached, both vanilla (*Film*, *Pre Dreadnought*).

**4. Stability.** Both completed runs reached 1936 and self-quit with complete dumps. **One CTD**, in
run 1 at 1854.3.20 (minidump `victoria3_01260711_022839`); the harness resumed from the last autosave
and the run finished normally. 1 crash in 2 century-long runs. ⚠ Not attributed — V3 crashes on its
own, and n=2 cannot separate that from a mod cause.

**5. Wall clock.** 163 min and 156 min for the century. Against the vanilla curve that is **~8% slower**
(see MODDING_NOTES for the per-decade curves). Affordable.

**⚠ THE TRAP THIS ANALYSIS FELL INTO FIRST — and TESTBED_METRICS §35 already warned about it.** The
first cut keyed GDP and technology columns on **country DISPLAY NAMES**, which is the hardcoded-tag time
bomb wearing a nicer face: Prussia becomes the German Empire, Britain becomes the British Republic, and
the column simply stops. It read "Great Britain plateaus at 99 technologies in 1899 and never learns
another thing" — which was a rename, not a finding. Every number above is instead a world-wide
aggregate or a top-N-at-this-dump, neither of which cares what anyone is called.
⚠ A second, duller bug: `debug.log` fields carry a trailing **CR**, so an untrimmed technology name
matches nothing and every era bucket reads zero.

**What it does NOT say.**
- **Nothing about workforce composition** — the step-4 criterion (runners-up holding drastically fewer
  engineers, machinists, capitalists) needs a per-profession metric that does not exist. `population`
  carries totals only.
- The vanilla comparison is **cross-session and cross-schema** (v5 against v11), same span and same
  game version but not the same night. Good enough for a 3% GDP difference inside a 19% spread; not
  good enough for anything finer.
- n=2. The world diverges hugely by RNG — at 1935 run 1 is led by Russia at 723M, run 2 by India at
  979M with a German Empire on 719M — so *per-country* readings from this batch mean very little.

---

<!-- FINDINGS.md lines 1922–1985 at 5ab4fd1 -->
## F47 — **THE INDUSTRY TECH TREE LOADS CLEAN. Against a vanilla control, the mod contributes exactly ONE class of error — the already-catalogued relocated-PM references — and the naval error storm is vanilla's own**

**Claim.** With 217 technologies (38 new) and 100 tier buildings emitted for the first time, the only
error shapes attributable to the mod are `is_production_method_active` PostValidate failures at four
vanilla script locations, all of which are already listed in `MISSING_PM_REFERENCES.md`. In particular
**the mod did not break naval combat**, which was the standing suspicion.

**Arms, n, span.** `20260811_014010_techtree-probe`, 4 runs **alternating** so machine drift cannot be
read as an arm effect: 2 × `{kind: config, config: config/mod_config.json}` (the full modded build) and
2 × `{kind: control}` (`build.ps1 -ControlOnly`, vanilla + telemetry, no gameplay content).
1836.1.1 → 1840.1.1, telemetry v11 (`tech_log`, `country_state`), tags GBR/FRA/USA.

**Numbers.** Distinct error shapes inside each run's own window:

| run | arm | lines | distinct shapes | shapes naming our content | NAVAL_BATTLE lines |
|---|---|---|---|---|---|
| run001 | mod | 413 | 13 | **0** | 412 |
| run002 | vanilla | 5 | 5 | **0** | 0 |
| run003 | mod | 400 | 9 | **0** | 2 |
| run004 | vanilla | 33 | 7 | **0** | 4 |

Shapes present in the mod arm and never in the vanilla arm: **6**, and every one is accounted for —
four are `PostValidate of trigger 'is_production_method_active' returned false` at
`common/scripted_effects/00_scripted_effects.txt`, `common/scripted_triggers/00_scripted_triggers.txt`,
`events/spanish_flu_events.txt` and `events/japan_events/ep2_japan_events_03.txt`; the other two are
`range directive used, but no randomization is available` at
**`common/naval_battle_conditions/00_naval_battle_conditions.txt`** and a wrong-type value at
**`common/script_values/command_values.txt:373`** — both **vanilla files the mod never touches**.

**Why the naval suspicion is refuted rather than merely unsupported.** The naval errors fire from a
vanilla file, and they appear in the **vanilla arm too** (run004: 4 lines). Their count tracks nothing
but how much naval combat a given playthrough happened to contain: 412 / 0 / 2 / 4 across the four runs,
in no arm-dependent order. A single mod run showing hundreds of them is a run that had a naval war.

**Two methodological results, both of which had to be fixed before the above could be read at all:**
1. ⚠⚠ **`error.log` is cross-contaminated between runs and cannot be counted raw.** It is the same
   rotating ring across launches and, unlike telemetry, carries no per-run token. Unfiltered, this
   batch's arms read 2 698 / 615 / 1 243 / 850 lines; filtered to each run's own window they are
   413 / 5 / 400 / 33. An earlier pair of hand runs read **15 294 against 7 516** where the true
   windows held **139 and 12**, and a *vanilla control* appeared to carry nine `Duplicated key` errors
   that in fact belonged to a modded run forty minutes earlier.
2. **Count distinct SHAPES, not lines.** One naval battle emits hundreds of identical
   `NAVAL_BATTLE` / `BATTLE_SHIPS_BREAKDOWN_*` lines and swamps everything else.
   ⇒ Both are now implemented in **`tools/testbed/analyse_errors.mjs`**, which refuses to report
   numbers when it cannot find a run's window rather than printing plausible unfiltered ones.

**Also established by the same batch (telemetry v11 `tech_log`):**
- **Our new technologies do reach telemetry.** 6 368 `TECH` lines, 64 distinct technology names in four
  in-game years; the four new era-1 production technologies appear by their **display names** — *Beet
  Sugar Refining*, *Calico Printing*, *Fourdrinier Machine*, *Leblanc Process*. `tech_log` logs the
  localized name, so a missing localization would surface as a blank or a raw key: **none did**.
- **A renamed vanilla technology reports its new name** — *Lead Crystal*, not *Crystal Glass* —
  confirming the `localization/<lang>/replace/` override beats vanilla's own string.

**What it does NOT say.**
- Nothing about balance, GDP or the tech *pace*: four in-game years, and only era-1 technologies are
  reached. The 34 remaining new technologies are unexercised.
- Nothing about long-run stability or wall clock; that needs the full-length batch.
- The relocated-PM errors are **not fixed**, only confirmed as the known class (user ruling: ignore
  vanilla script referencing moved PMs). They remain missed flavour, not breakage.
- n=2 per arm. Enough to show the naval errors are not arm-dependent, not enough to bound their rate.

---

<!-- FINDINGS.md lines 1986–2016 at 5ab4fd1 -->
## F46 — **THE 1836 STARTING TECHNOLOGY SETS STILL RESEMBLE VANILLA'S, measured as a share of each tree rather than a count**

**Claim.** Deepening the tree from 179 to 217 technologies did not distort the starting position. Every
starting tier gains only the new era-1 production technologies, and each country type still begins at
essentially the same **fraction** of the tree it has to climb.

**Method.** Static, off the two `00_starting_inventions.txt` files and the technology files the game
will actually read (ours where we own them), expanding `add_era_researched = era_1` against real era
membership. Not a run — this is deterministic and a run would only add noise.

| starting tier | vanilla (prod/mil/soc) | mod (prod/mil/soc) | Δ | share of own tree | who |
|---|---|---|---|---|---|
| 1 | 52 (13/16/23) | 57 (18/16/23) | +5 | 29% → **26%** | GBR USA FRA BEL |
| 2 | 44 (11/12/21) | 49 (16/12/21) | +5 | 25% → **23%** | AUT PRU SWE |
| 3 | 31 (7/10/14) | 35 (11/10/14) | +4 | 17% → **16%** | ESP SIC RUS |
| 4 | 20 (6/7/7) | 24 (10/7/7) | +4 | 11% → **11%** | unrecognised, OTT |
| 5 | 10 (3/3/4) | 14 (7/3/4) | +4 | 6% → **6%** | very backward |
| 6 | 3 (1/1/1) | 3 (1/1/1) | +0 | 2% → **1%** | decentralised |
| 7 | 0 | 0 | +0 | 0% → 0% | no technology |

**Reading.** The leader-to-laggard gradient is preserved and slightly *steepened* at the top (starting-tech tier 1
falls 29% → 26% because the tree grew faster than its grant did), which is the direction the mod wants.
Starting-tech tier 6 is unchanged in absolute terms by design — a decentralised country is meant to hold almost
nothing.

**What it does NOT say.** Nothing about what countries *reach*; only where they start. And a share of
the tree is not a share of its *cost* — the mod's added technologies are concentrated in production,
whose era costs differ from society's.

---

<!-- FINDINGS.md lines 2688–2855 at 5ab4fd1 -->
## F39 (superseded) — the inference-based version, kept for the record

**Arm** `overlay` — the ×10 build, read live in-game at **January 1925, GBR market** (user observation,
2026-08-06) · 🟢 **ARM-FREE for the mechanism.** `pop_need_weight_mult` is keyed by GOOD, not by need, so
automobiles is ×10 in **both** needs it appears in (`free_movement` 1.25 → 12.5, `leisure` 1 → 10).
`communication` holds transportation + telephones, neither reweighted — vanilla. The result below is
confirmed on both, which is itself a check: the ×10 need and the vanilla need agree.

**Why this source beats everything before it.** F35 established that no pop need has an observable budget
from the order book, because all 15 share a good with another need. **The pop panel reports the split per
need directly** — the exact quantity every previous argument had to infer.

### THE RESULT

Three states of one market, one instant, `popneed_communication` (transportation + telephones), each read
from one engineer pop:

| state | MAPI | local transp. supply | local transp. price | **money** share transp. | **unit** share transp. |
|---|---|--:|--:|--:|--:|
| Midlands | 95 % | 1 710 (vs 1 803 demand) | £31.22 | 56.8 % | **79.8 %** |
| Cornwall | 100 % | 930 (vs 526 demand) | £12.72 | 34.2 % | **79.4 %** |
| Lowlands | 95 % | 922 (vs 1 020 demand) | £32.39 | 57.5 % | **79.7 %** |

**Money shares span 34–58 %. Unit shares are constant at 79.4–79.8 %.** Cornwall's local surplus makes
its transportation cost £12.72 against £31–32 in the two deficit states, and that price difference is the
*entire* source of the money-share variation.

⇒ **TWO CORRECTIONS TO OUR MODEL, both load-bearing:**

1. **The purchase weight splits UNITS, not MONEY.** We compute `money_g = M · pw_g/Σpw`, then
   `units_g = money_g / base_price_g`. The game sets `units_g ∝ pw_g` and money follows —
   `money_share_g = pw_g·price_g / Σ(pw·price)`.
2. **The price is the CURRENT LOCAL price, not the base price.** Recomputing the unit shares at base
   price gives **75.4 / 54.8 / 76.0 %** — *not* constant, so base price is independently excluded by the
   same three readings.

### ⭐ THE SUPPLY SHARE IS MARKET-LEVEL, AND `local` DOES NOT CHANGE THAT

Two independent confirmations, one of which does not use the split at all:

1. **The unit share is constant across three states whose local supplies differ 1 710 / 930 / 922.** A
   state-dependent quantity cannot produce a state-independent share.
2. ⭐ **The telemetry reports transportation market-wide directly.** `market_goods_scoped` on the same
   run at the same date gives GBR transportation **sell 32 501 · buy 27 952**, even though the market
   *screen* shows nothing for a `local` good. The same dump matches the user's screen readings for the
   tradeable goods (telephones sell 1 479.7 vs 1 480; automobiles 5 351.8 vs 5 390), so it is the same
   market at the same instant.

⇒ **`transportation` IS aggregated to market level for the split** even though it is a `local` good.
BALANCE_FRAMEWORK §10.35.1a named the `local` goods abstraction as the leading suspect for our
under-prediction. **It is not the mechanism.** The units/money inversion above is.

### ❌ AND THE SAME TELEMETRY FALSIFIED THIS FINDING'S OWN FIRST SOLVE — two errors, corrected

The first version of F39 solved transportation's market supply four ways and got **8 627 – 8 875, ±1.4 %**,
which read as a powerful confirmation. Checking it against the order book the run itself logged broke it:

**(i) THE 0.75 CAP BINDS, and the solve assumed it did not.** Unclamped, the observed unit share needs
`s_T/s_P` = 7.90 ⇒ T = 8 847 — but that implies `s_T` = **0.888**, far above transportation's
`max_supply_share` of **0.75**. A solve whose answer violates its own premise is void. With the cap
binding, `pw_T` = 0.75 is *fixed* and the observed share instead pins `s_P` = 0.0949, i.e. **T/P = 9.53**.

**(ii) THE NON-POP DEDUCTION IS THE FULL NON-POP BUY, NOT HALF.** ⚠ First, a labelling error worth naming:
the solved quantity is **not supply** — it is `sell − k·non-pop buy`, and F39 originally called it "market
supply", which made it read as an absurd claim about how much transportation Britain produces. Supply is
**32 501** and is not in dispute (the user independently judged it right for the railway and urban-centre
count, and "certainly not under 20 000"). The quantity that enters the split is a **residual**.

The three read states give the non-pop share of transportation buy orders directly — **86.7 %** (Midlands
94.2 %, Lowlands 81.0 %, Cornwall 71.9 %) — so the residual can be computed from the order book and
compared with what the observed share requires under the binding cap:

| deduction | telephone metric | T metric **required** | T metric **from the order book** | agreement |
|---|--:|--:|--:|--:|
| **half** (F22's `sell − 0.5·non-pop`) | 1 120 | 10 676 | 20 386 | **1.91 ×** |
| **full** (`sell − 1.0·non-pop`) | 760 | 7 244 | **8 272** | **1.14 ×** |

Half is out by ~2 × *and* is independently impossible (it needs 43 650 of non-pop buy against a 27 952
total). Full agrees to 14 %, about what a three-state sample of an 86.7 % share should scatter by. It also
carries to the *other* need unfitted: it predicts a free_movement transportation unit share of **14.4 %**
against **13.8 %** observed, and correctly leaves that need's cap slack (`s_T` = 0.677 < 0.75).

⭐ **And it has a clean meaning:** `sell − non-pop buy` is **what is left for pops once industry has taken
its share** — 32 501 − 24 230 = **8 267 available**, against roughly **3 700** of market-wide pop
transportation demand. Supply comfortably exceeds pop demand, which is the sane regime and is why the
0.75 cap binds.

⚠ **This contradicts F22**, which fitted the 0.5 coefficient by improving Belgian pop-demand error from
30.3 % to 16.2 %. **But F22 was fitted under BOTH of the mis-specifications this finding corrects** —
money-split and base-price — so the 0.5 may simply have been absorbing them. **Neither coefficient is
settled; this is now an open question, not a correction.** Re-deriving it is a job for
`score_pop_split.mjs` *after* the units/current-price fix lands, so the coefficient is fitted against a
correctly specified model rather than compensating for a broken one.

⚠⚠ **THE METHOD POINT: the ±1.4 % agreement was real and still meant nothing.** All four solves shared
the same two errors, so they moved together and agreed with each other while jointly disagreeing with the
order book. **Internal consistency across variants of one calculation is not evidence** — the check that
mattered was against an independent measurement, and that measurement was already on disk.

### ⚠ WHAT THIS SUPERSEDES — three intermediate claims made and withdrawn the same day

Kept, because each was wrong in an instructive way:

1. **"The split is decisively market-level"** (from Midlands alone). Overclaimed: zero local supply only
   excludes α = 1, since a blend still scores through the market term. Right answer, wrong warrant.
2. **"α > 0, per-state, α_Midlands ≈ 0.64–0.75"** (from Midlands + Cornwall). The two states' *money*
   shares differ by 22.5 pp, which under a money-split model forces a large local weight. **The
   difference was a price artifact.** Two states could not tell the readings apart; the third could.
3. **"A state-independent coefficient `c_L/c_M` ≈ 3.43 fits to 1.5 %."** This rested on **assuming**
   Cornwall's unread transportation supply equalled its consumption, reasoning that a `local` good cannot
   be imported so supply must track demand. **A local good is not forced to match its demand — Cornwall
   overbuilt it by 77 % (930 against 526).** With the real figure the constants are 3.409 and 1.573, a
   factor of 2.17 apart.

⚠⚠ **THE METHOD LESSONS, which cost more than the arithmetic.** (i) **A wrong assumption did not add
noise, it manufactured a confirmation** — the spurious 1.5 % agreement looked like strong evidence
precisely because one parameter against two observations should leave a degree of freedom. **Ask for the
missing number; do not derive it from a plausible premise** (user, 2026-08-06). (ii) **Two data points
could not distinguish a real state-dependence from a price artifact.** The third state settled it
immediately and cost one panel read. When a model needs a per-case parameter, that is the signal to get
another case, not to fit the parameter.

### CONSEQUENCES FOR THE MOD

- `needSplit()` / `spendToGoods()` in `ui/econ.js` (and the duplicated copy in `builder.html`) implement
  **both** halves wrongly. Fixing them changes every scenario's pop demand.
- The error is **zero when all prices sit at base** and grows with price dispersion — which is exactly why
  F24's 18.5 % was measured in 1836 markets near base and why this never surfaced there. It matters most
  in the late-game, high-dispersion scenarios the tier ladder is solved against.
- Direction: for a good trading **above** base we currently **over**-state its unit demand, and under it,
  **under**-state. Automobiles in this market are at 156 % of base.
- ⚠ **Not yet implemented.** The change is well-supported but touches the core of the scenario model; it
  wants its own pass, with `econ_selftest.mjs` extended to these three states first.

**What it does NOT say.** (1) It does not establish how the game aggregates a `local` good to market
level, only that it does and that the total is ≈8 800 for GBR transportation. (2) All three states are one
market at one instant; the units/money result is structural and should hold generally, but the ≈8 800 is
specific. (3) It says nothing about `min_supply_share`/`max_supply_share` behaviour — no cap binds in any
of these readings, and that deserves a check of its own. (4) `leisure` was read once and is not used in
the solve.

### ⭐ VANILLA AUTOMOBILE DEMAND — the control run had it all along

Everything above about automobiles is ×10-arm. The **control** runs of the same session carry the
market-level order book for vanilla, which had been overlooked:

| date | arm | auto buy | auto sell | auto price | transp buy | transp sell | auto ÷ transp buy |
|---|---|--:|--:|--:|--:|--:|--:|
| 1925.1 | **vanilla** | 11 515 | 7 400 | 141.71 | 51 879 | 47 014 | **0.222** |
| 1925.1 | ×10 | 9 466 | 5 352 | 157.64 | 27 952 | 32 501 | **0.339** |
| 1936.1 | **vanilla** | 14 589 | 9 274 | 142.97 | 59 338 | 57 250 | **0.246** |

⚠ **Levels are NOT comparable across runs** — they are different campaigns and vanilla's Britain is
**1.85 × larger** on transportation. Normalising to transportation buy, the ×10 arm carries **1.53 ×** the
automobile demand of vanilla. ⚠ That is a ratio of *total* buy orders, most of which is pop demand for
automobiles (80 % in the read state) but is **not** the within-need share, and the two campaigns differ
in supply as well as weight. **Vanilla's within-need automobile share is still unmeasured** — it needs one
pop panel read on a vanilla save, which no longer exists (autosaves are overwritten per slot).

**Confidence: high** for the units-not-money and current-not-base-price results — they rest only on the
constancy of unit shares across three states, which involves no supply metric, no weight and no cap.
**Retracted** for the ±1.4 % four-way solve and its ≈8 800 (see above). **Open**: the non-pop deduction
coefficient, and vanilla's within-need automobile share.

Reproduce: `node tools/testbed/check_midlands_split.mjs` — observations embedded with their arms.

---

<!-- FINDINGS.md lines 3487–3778 at 5ab4fd1 -->
## F33 — ⚠⚠ DEMOTED THE SAME DAY: THE GAME SHIPS THE RULE IN A COMMENT, AND IT IS THE ONE WE ALREADY IMPLEMENT. This finding's arithmetic must therefore be wrong

> **READ THIS FIRST.** Everything below was written before anyone looked at the top of
> `game/common/pop_needs/00_pop_needs.txt`. It documents the mechanic outright:
>
> ```
> # weight            The base weight that is applied to this good based on market Sell Order share
> # max_supply_share  The maximum weight that can be applied to this good based on market Sell Order
> #                   share, relative supply above this amount will have no further impact on base weight
> # min_supply_share  If above 0, a minimum of this multiplier of the base weight will be applied to a
> #                   good regardless of its market Sell Order share
> ```
>
> That is **reading A** — clamp the sell-order share to `[min, max]`, multiply by the base weight — which
> is exactly what `needSplit()` implements and what **F31** independently measured as the better fit.
>
> ⚠ **A SHIPPED COMMENT IS EVIDENCE, NOT PROOF.** Developers publish confidently wrong statements, and
> comments that were true when written rot silently after the code moves — this one could describe a
> mechanic that changed patches ago. It does not by itself settle anything. What makes it weighty here is
> **corroboration**: the comment and F31's measurement are independent lines of evidence that agree, and
> F31 was scored against the game's own consumption telemetry across seven markets. Two independent
> agreeing sources against one contested inference is why the balance tips.
>
> **So the honest state is a three-way conflict, not a verdict.** The comment says reading A. F31's
> measurement says reading A. F33's arithmetic below says reading A is impossible. **At least one of the
> three is wrong**, the weight of evidence is against F33, and its conclusion is therefore **not safe to
> build on** — but "the argument must be broken because the devs wrote it down" would be the wrong reason
> to drop it.
>
> **Two candidate flaws in F33, both UNTESTED** — named so they can be checked, not asserted as the answer:
> 1. **`transportation` is a `local` good** (§10.35.1a). The whole argument rests on one bound — a good's
>    pop demand cannot exceed its market-wide buy orders — and every impossibility below is measured
>    against that single number. Since a local good does not move between states, it is not established
>    that market-level `GetMarketBuyOrders` means what the bound assumes.
> 2. **Automobiles sit in TWO needs**, so attributing all their pop demand to `free_movement` inflates the
>    implied budget. My earlier claim that this "shifts the arithmetic against reading A" was asserted, not
>    derived, and is wrong in the direction that matters: a smaller `free_movement` share implies a smaller
>    budget and less transportation demand. ⚠ Note this does **not** dispose of the telephone cases, which
>    are single-need and where the same impossibility appears — so flaw 2 alone cannot explain F33 away.
> 3. **The need is not single-good even when the good is single-need** (user, 2026-08-06). `communication`
>    is `telephones` + `transportation`, and `transportation` is the good flaw 1 is about *and* is itself
>    multi-need. So flaw 1 was never telephone-proof, and the telephone case is **not** the clean control
>    the section below claimed. **F35** shows this is not a quirk of `communication`: **no need in the
>    game has an observable budget**, so this style of inference has no clean case anywhere.
>
> ⚠ **The observations themselves stand** — 948 automobiles and 2 400 telephones of pop demand are measured
> facts, verified blocks, replicated across seeds. What collapses is the inference drawn from them. The
> real open question is no longer "which reading is right" but **"why does our implementation of the
> documented rule produce so much less demand than the game does"**, and locality is the leading suspect.
>
> ⚠ **Process lesson, and the expensive one of the day:** this was found by asking "is it certain there is
> no game code with answers?" — after a full day of inference. **Search the shipped files for
> documentation before measuring.** Paradox ships `readme.md` files in several `common/` subfolders and
> header comments in others; the answer here was four lines above data I had already read twice.
> ⚠⚠ **But read them as HYPOTHESIS SOURCES, not as answers.** The rule is *check the docs first because
> they are cheap*, not *believe the docs because they are official*. A shipped statement can be wrong, and
> a stale one is worse than wrong because it was once true and nobody corrected it. The correct use is:
> take the hypothesis from the docs, then confirm it against telemetry — which is what F31 happens to have
> already done here, and why this particular comment can be leaned on.

### The original argument, retained for the record (its conclusion is retracted)

### F33.1 (the original argument, conclusion RETRACTED) — "neither reading of `max_supply_share` can be the rule"

**Claim.** The shipped reading of `max_supply_share` — clamp the RAW supply share, weight it, renormalise
(F31's winner) — is **arithmetically impossible** in a two-good need whose incumbent is capped. The
alternative F31 rejected is possible there. Since F31's own evidence still stands, **neither reading is a
global rule**, and the question is now better posed than it was: what behaves like a cap in one
configuration and not the other?

**There is no authored minimum to appeal to.** `min_supply_share` is non-zero on exactly **7 entries in the
whole game** — `furniture` (household_items), `meat` and `fruit` (luxury_food), and `silk`,
`luxury_clothes`, `luxury_furniture`, `porcelain` (luxury_items), all at 0.1. It is **0 for `automobiles`,
`telephones`, `radios` and `steamers`**. So a debut good's demand spike is not a floor effect.

**The test needs no new telemetry**, only an upper bound the order book already carries: a good's pop
demand cannot exceed its **total** buy orders. British Market, 1903.3.1, session
`20260805_150128_debut-good-full-v11` run 1:

```
transportation   sell 15 394.04   TOTAL buy orders 19 459.14
automobiles      sell    295.62   POP demand 948.32 units = £94 832   (verified breakdown block)
free_movement    entries: transportation w1 max 0.75 · automobiles w1.25 max 1.0   (both min 0)
```

| reading | automobiles' share | implied need budget | implied transportation POP demand | verdict |
|---|--:|--:|--:|---|
| **A — shipped** (clamp the raw share) | 3.04 % | £3 114 686 | **100 662 units** | **IMPOSSIBLE — 5.2× the market's entire transportation buy orders** |
| **B — final-share cap** (F31 rejected) | 25.00 % | £379 328 | 9 483 units | possible — 49 % of all transportation bought |

⚠ Automobiles also sit in `popneed_leisure`, so some of the 948 units belong there rather than to
free_movement. That shifts the arithmetic **against** reading A, not for it: leisure has nine goods and is
dominated by `services`, so reading A allocates automobiles even less of it.

**Why this does not simply overturn F31.** F31's measurement was on **1836** markets, where
`free_movement` and `communication` each have exactly **one** supplied good — which is precisely why F24
reports **0.0 % error** for those needs. **F31 never tested a capped incumbent competing with a second
good.** Its evidence came from `heating`, `basic_food` and `intoxicants`, and there the final-share reading
fails hard: Russian heating is **79 % wood** and Qing **66 %** against wood's `max` of **0.5**, which
reading B forbids outright.

**So both readings are refuted, each by a case the other cannot explain:**
- 1836 heating ⇒ a good exceeds its cap ⇒ **not** a final-share cap.
- 1903 free_movement ⇒ a debut good gets demand the raw-share reading cannot generate ⇒ **not** a raw clamp.

### ✅ REPLICATED ON TELEPHONES, and that case is CLEANER than automobiles

`popneed_communication` = `transportation` (w1, **max 0.75**) + `telephones` (w2, max 1.0). ⚠ **Telephones
belong to exactly ONE need**, so unlike automobiles there is no ambiguity about which need their pop demand
came from.

> ⚠⚠ **"THE ARITHMETIC IS UNCONDITIONAL" — WITHDRAWN (user, 2026-08-06).** Telephones being single-need
> removes **one** ambiguity, not the others. **The need is not telephone-only**: its other member is
> `transportation`, which is *both* multi-need (`free_movement` too) *and* `local`. So every remaining
> objection survives into the telephone case —
> 1. going from measured telephone money to the **need's budget** requires telephones' share, which
>    depends on `transportation`'s supply share, which is not independently pinned;
> 2. the bound is `implied transportation pop demand` vs the market's **total** transportation buy
>    orders, and transportation is a `local` good, so it is not established that a market-wide total is
>    the right denominator (this is flaw 1, and it was never telephone-proof);
> 3. transportation's own measured demand **cannot be split** between its two needs, so there is no
>    cross-check available.
>
> **F35 makes this structural rather than incidental: NO need in the game has an observable budget** —
> all 15 contain at least one multi-need good. The telephone case is *less bad* than automobiles, not
> clean. Read the five rows below as an observation whose inference is still open.

British Market, five consecutive yearly dumps:

| date | telephone POP demand | reading A implies transportation pop | market's TOTAL transportation buy | A | B |
|---|--:|--:|--:|---|---|
| 1920.3 | 2 | 41 184 | 36 654 | **impossible 1.1×** | ok (0 %) |
| 1921.3 | 1 030 | 68 005 | 35 271 | **impossible 1.9×** | ok (20 %) |
| 1922.3 | 1 540 | 62 444 | 34 970 | **impossible 1.8×** | ok (31 %) |
| 1923.3 | 2 120 | 42 418 | 35 893 | **impossible 1.2×** | ok (41 %) |
| 1924.3 | 2 400 | 44 407 | 34 721 | **impossible 1.3×** | ok (48 %) |

**Reading A fails all five**, and it keeps failing as telephone supply grows and its A-share rises from
0.01 % to 11.2 % — the shortfall is structural, not a boundary case. ⚠ The margins are far tighter than
automobiles' 5.2× (1.1–1.9× here), so telephones would not on their own be decisive; taken with automobiles
in a different need they are.

**Both channels are real and large for telephones**, unlike either earlier good: 1917.3 is 100 % buildings
(**Government Administration** — the `pm_switch_boards` consumer, exactly as the game files predicted),
1920.3 is 100 % pops, and by 1923–24 it settles at ~62 % pops against ~38 % buildings (Government
Administration and Trade Center).

**⭐ Technology, and the sharpest example of the whole mechanism.** British buying starts **1910.6**, NINE
YEARS before the `telephone` technology exists anywhere. That was first flagged as an unexplained anomaly;
it is not one, and the obvious escape — "another country invented it and exported" — is **ruled out by
measurement**:

| check | result |
|---|---|
| countries ever acquiring `telephone` | **6**, and **Great Britain is world-first**, 1919.4.8 |
| first telephone production ANYWHERE (50-market sweep) | **1920.9**, British Market |

> ⚠⚠ **THE "ANYWHERE" IS WEAKER THAN IT READS (found 2026-08-06, TESTBED_LANDMINES L11).** Two of the
> sweep's fifty tags are wrong: **`QIN` is not a country at all** (the Qing is `CHI`) and **`COL` is
> British Columbia** (Colombia is `CLM`). So the sweep covered **48** countries, **China not among
> them** — and China is the largest economy in the game. "First anywhere" should be read as "first
> among the 48 tags that resolved". The Qing producing telephones before Britain is unlikely, which is
> why this weakens the claim rather than overturning it — but it was never actually tested.
| British order book at 1910.6 | buy **0.01**, sell 0, **imports 0**, production 0 |

The world genuinely held **zero** telephones in 1910. The cause is that **the consuming method and the
producing method hang off DIFFERENT technologies**: `pm_switch_boards` (government administration, 5
telephones per level) is gated on **`central_planning`, which Britain acquired 1901.1** — eighteen years
before the telephone. So the AI switched a building onto a method that demands a good **nobody on Earth
could make**, and that demand stood for nine years (0.01 units 1910 → 5 units by 1917, 100 % buildings,
top buyer Government Administration) until production finally arrived in 1920.3.

⚠ **This is VANILLA's own tech structure, not our era remapping.** It is the same shape as steamers — a
consuming method adopted before any production existed — but far more extreme, and it means "the consumer
can arrive before the producer" is a property of the base game, which §10.35 should not have attributed
solely to our hand-moved industries.

### ✅ REPLICATED ACROSS SEEDS — and reading B now fails inside the SAME campaign

Both runs are complete and are **different histories**: `combustion_engine` world-first 1899.9 (Free States
of America) in run 1 against **1897.12 (German Empire)** in run 2, and the automobile debut **1901.6**
against **1910.12** — nine years apart, so none of this is a date coincidence.

| | automobiles | telephones |
|---|---|---|
| **run 1** | **26 / 26** impossible under A | **5 / 5** impossible |
| **run 2** | **16 / 16** impossible under A | 1 / 3 impossible |
| | **48 of 50 observations impossible under reading A**, by 1.1×–3.7× | |

⚠⚠ **AND READING B IS IMPOSSIBLE IN 9 OF THE SAME 50** — run 1's British automobiles from 1919 on, where
pop demand exceeds even the 25 % a final-share cap would permit. **So both readings are refuted inside a
single campaign**, with no appeal to F31's 1836 data needed. That closes the escape route of blaming the
conflict on an era or dataset difference: the real rule is neither candidate, and it can exceed a hard
25 % ceiling.

The two `ok` telephone rows in run 2 (89 and 200 units) are small-demand cases where reading A happens to
fit. Recorded; they do not rescue it.

**A quantified bonus — the AI's adoption lag.** In run 1 the urban-centre method that consumes automobiles
(`pm_public_motor_carriages`) contributes **zero** until ~**1906**, then becomes the top building buyer —
roughly **seven years** after `combustion_engine` existed. Pops carry 100 % of the demand in the interim
(1902–03), and the split settles near 52–60 % pops by 1907–08. So "the consumer method unlocks with the
technology" is true on paper and badly false in practice.

**What it does NOT say.** It does not identify the real rule — only that neither candidate survives. It
does not revisit F31's numbers, which remain correct for the needs F31 measured. It assumes a good's pop
demand cannot exceed its total buy orders, true by construction since pops are one channel of that total.
⚠ **Run 2 ended at 1925.3, not 1936**, after two CTDs and a resume the guard correctly refused
(BUGS_AND_FIXES 2026-08-05), so the final decade is unobserved in both runs.

---

> # 🛑 F32 AND F33 ARE PROVISIONAL — THEY WERE MEASURED ON THE WRONG ARM AND MUST BE RE-RUN
>
> **User ruling, 2026-08-05:** running the old tiered config for this work is **indefensible**. It serves
> no approach — it is not the design we are moving towards (the "vanilla PMs in separate buildings" shape
> is being dropped), and it is not a clean reference either, because it differs from vanilla in **GDP and
> workforce composition at least**, and in an unbounded amount besides. A measurement of *the game's*
> consumer behaviour has to be taken on **vanilla + telemetry**.
>
> **Status of everything below: DO NOT BUILD ON IT.** Treat F32 and F33, and the debut-mechanism results
> inside them, as hypotheses awaiting re-measurement on `{kind: control}`. Some will hold — the mechanic is
> engine-level and the needs data was vanilla throughout — and some will not, particularly anything whose
> magnitude depends on the economy: supply shares, price levels, demand volumes, which buildings appear as
> buyers, and the AI's adoption timing.
>
> ⚠ The buyer identified in the steamers result is literally `Tier 2. Industrial Port` — one of OUR
> buildings. That alone shows the arm was wrong for the question as framed.
>
> **The re-run is specified in the handover for the next session.** The rule that should have prevented
> this is now in CLAUDE.md: *a run's configuration must be unambiguous before it launches — clarify until
> certain.*
>
> ## ⚠⚠ WHICH ARM EACH SESSION RAN — record this in every finding, it was recorded in none
>
> **⭐ THE AUDIT, 2026-08-05. Of 32 findings, 24 rest on the `config` (our-mod) arm.** Last true-vanilla
> session: **`20260803_220658_vanilla-percapita-n3`**. Everything measured after it is `config`.
>
> | arm | findings |
> |---|---|
> | **`config` — RECHECK** | F33, F32, F31, F27, F24, F23, F22, F21, F20, F19, F18, F17, F16, F15, F14, F13, F12, F11, F10, F8, F6, F5, F4, F3 |
> | `control` — vanilla, stands | F29, F28, F26, F25, F1 |
> | cites no run — simulation/solver only | F9, F7, F2 |
>
> ⚠ **User ruling: essentially all of the `config` column needs re-checking against a true-vanilla run**,
> excepting only findings about solver behaviour, which involve no game. That includes things that
> *should not* depend on the mod — the AI's willingness to run a method consuming a good with no supply,
> and goods substitution behaving contrary to its documentation. **If those turn out to differ under the
> mod, that is itself weird and worth documenting**, so re-measure rather than assume.
> ⚠ Several are load-bearing for the balance UI, not just curiosities: F13 (the urban-centre rule), F15
> (the fitted consumption distribution), F19/F22/F24 (the within-need split), F27 (the slave basket) are
> all wired into `ui/econ.js` and its presets.
>
> Raised by the user 2026-08-05 ("all the runs were supposed to be vanilla+telemetry"). The record is a
> **mix**, and no finding states its arm. From each session's `schedule.json`:
>
> | arm | sessions |
> |---|---|
> | **`control`** (vanilla + telemetry) | all of 1 Aug (mirror-fix, pop-probe, seed-flag, route, fat-logging, phased-dump, v7-cadence, origins ×5), the whole **3 Aug wages** series, `vanilla-percapita-n3` |
> | **`config`** (our full tiered mod) | 31 Jul + 2 Aug balance/scenario work **including `rescore-direct`**, and everything on 5 Aug |
>
> **⭐ F24 and F31 come from `20260802_233029_rescore-direct`, which is the `config` arm — our mod.** That
> is **not** an error, and probably the right choice: `extract_presets.ps1` builds the UI's presets by
> mapping vanilla 1836 history **onto our tier buildings**, and the game's own 1836 start is that same
> re-tiering (`convert_history`). Model and game therefore describe the SAME economy. Scoring our-tier
> presets against a *vanilla* arm would have introduced the mismatch, not removed it.
>
> ⚠ **The defect is that none of this was written down.** A finding that cites a session by name but not by
> arm cannot be interpreted years later, and "which arm" changes what the number means. **State the arm in
> every finding from now on.**
>
> ⚠⚠ **EVERY MEASUREMENT IN F32/F33 WAS TAKEN IN A WORLD RUNNING OUR MOD. THERE IS NO VANILLA CONTROL.**
> Raised by the user 2026-08-05 on seeing tiered buildings in the observer. Confirmed from each session's
> `schedule.json`: all of `20260805_115022`, `_132101`, `_150128` and the `weight-x10` run were built from
> `config/mod_config.json` (or a copy of it), i.e. the full tier split — 53 tier buildings, our production
> methods, our recipes. The harness supports a real control (`build.ps1 -ControlOnly`, `{kind: control}`)
> and it was **never used today**.
>
> **What this does and does not touch:**
> - ✅ The demand-split MECHANIC is engine-level, and the mod did not emit `common/pop_needs` at all until
>   the weight experiment — so needs, weights and caps were exactly vanilla in every earlier run.
> - ✅ F33's arithmetic uses supply and demand from the SAME run, so it is internally consistent whatever
>   buildings exist.
> - ✅ The ×10 result is a within-family before/after, and its baseline came from the same mod.
> - ⚠ **But the ECONOMY is not vanilla's.** Different buildings, different production, hence different
>   supply shares, price levels and demand magnitudes. So a sentence of the form *"in Victoria 3, a debut
>   good gets X"* is really *"in our modded 1.13, it gets X"*. Read every absolute number here that way.
>
> ⚠ Also found while checking: **`build_state.json` records `built_from_config: ""` and
> `config_sha256: null`** — the two fields CLAUDE.md requires to be machine-read. Provenance had to be
> reconstructed from `schedule.json`. Fix pending.

<!-- FINDINGS.md lines 5010–5063 at 5ab4fd1 -->
## F20 — ⚠ Partly superseded by F21 — the measured reference is noisy, but less than n=3 suggested

⚠ **Read F21 first.** The claim below is directionally right but the MAGNITUDE is overstated: it rests
on n=3, and at n=20 the median per-good buy CV is 5.6%, not 10-30%. The conclusion drawn here - that
single-digit accuracy was unreachable - was wrong, and F21 corrects it.

**Claim.** At the **same date, same config, same mod**, a market's per-good buy and sell orders differ
substantially from run to run. This is the same magnitude as the modelling error being chased, so
below a certain point the reference — not the model — is the limiting factor.

**Belgian market, 1836.2.1, three runs of one schedule** (`20260802_171235_belgium-check`):

| good | run 1 | run 2 | run 3 | spread |
|---|--:|--:|--:|--:|
| fabric buy | 349 | 459 | 441 | **26 %** |
| fabric sell | 170 | 220 | 219 | **29 %** |
| wood sell | 315 | 392 | 392 | **24 %** |
| iron buy | 311 | 319 | 277 | 14 % |
| grain sell | 518 | 517 | 457 | 13 % |
| grain buy | 528 | 535 | 492 | 8 % |
| **iron sell** | **254** | **254** | **254** | **0 %** |

**It is not uniform noise.** Iron sell is identical to the unit across runs while fabric moves by a
quarter — so the variance is specific to goods whose first-month supply depends on AI decisions
(which secondary a farm runs, what gets built), not a general measurement wobble.

**Consequences, and they are not small:**

1. **Single-digit per-good accuracy is unreachable at small n.** With a 25 % spread, n=5 leaves a
   standard error near 11 % — above the target regardless of how good the model is.
2. **Comparisons across sessions with different run counts are invalid.** This is what made a
   genuinely correct fix (throughput + secondary PMs) appear to change nothing: the "game" column had
   moved underneath it. Two sessions of the same schedule disagreed on Belgian iron sell by 254 vs
   334 simply because they averaged different runs.
3. **Accuracy should be judged per good, against that good's own variance** — "we model this
   correctly" and "this good is inherently unstable at the 1836 start" are different statements and
   are now separable.

**A real averaging bug this exposed.** `extract_measured.ps1` divided *every* accumulator by the total
run count. The moment two sessions with different metric sets were pooled, that was wrong: throughput,
present in only 2 of 5 runs, would have been reported at 40 % of its true value. Each key is now
divided by the number of runs **that key** appeared in — legitimate because lines are de-duplicated
within a run, so an occurrence count is a run count.

**What it does NOT say.** One market, one date, n=3 for the spread itself — the spread figures are
themselves noisy estimates of noise. It does not identify *which* AI decisions drive the variance, nor
whether larger markets are proportionally quieter (Belgium is small, and small markets should be
noisier; that is untested).

**Session.** `20260802_171235_belgium-check` (n=3) against `20260802_190643_throughput-secondaries`
(n=2).

---

<!-- FINDINGS.md lines 5122–5202 at 5ab4fd1 -->
## F18 — ⚠ RETRACTED AS A RECOMMENDATION. A per-class within-need split scores 28 % better held out, but the game has no such dimension — it is a proxy for supply share

**Status.** The measurement stands; the conclusion drawn from it does not. Recorded in full because
the *way* it was wrong is the useful part.

**What the game actually does** (verified against the files, 1.13.9):

| file | conditions on | does NOT condition on |
|---|---|---|
| `common/buy_packages` | wealth level only | pop type, culture, religion — no reference to any of them |
| `common/pop_needs` | nothing — only `entry` / `goods` / `weight` / `min_supply_share` / `max_supply_share` / `default` | pop type **and wealth** |
| `common/pop_types` | `consumption_mult` (peasants 0.05) | — a scalar on the whole package, not a different basket |

So **consumption is a function of wealth level alone**: a labourer who reaches SoL 25 buys exactly
what a capitalist at SoL 25 buys. And — the part that kills the proposal — **the within-need split has
no wealth dimension either**. `weight` and the supply-share bounds are per-(need, good) constants; the
only thing that varies the split is **supply share**, a market property identical for every pop in
that market.

So neither "per class" nor "per SoL" corresponds to anything in the engine.

**What the 28 % therefore was.** Class mix varies across markets, class mix correlates with market
development, and development correlates with the supply mix that genuinely drives the split. The
per-class parameterisation was a **back-door proxy for market supply share** — precisely the
market-dependence the design excludes on purpose.

⚠ **The methodological lesson: leave-one-out validation tests predictive TRANSFER, not MECHANISM.** A
proxy that correlates with market development transfers perfectly well to an unseen market of similar
composition and scores well. Held-out performance was presented here as though it established the
model was *right*; it established only that it *predicts*. For a model whose whole purpose is to be
mechanistically defensible, that is not the same thing, and no amount of validation substitutes for
checking the game files.

**The measurement, retained.** Splitting a pop need's money by a (class × need) distribution rather
than one shared per-need distribution cuts held-out weighted error by **28.2 %** (31.5 % in-sample).

**First, the model shape, because it is easy to state backwards.** The money each need receives
**already varies by standard of living** — that is `common/buy_packages`, a wealth level → {need → £}
table we take from the game verbatim. What is currently shared across all wealth levels is our
**fitted within-need split across goods**. So the missing dimension is not "per need" — it is the
goods split varying by class:

| | today | proposed |
|---|---|---|
| £ per need, per SoL | game's `buy_packages` | unchanged |
| goods split within a need | one fitted vector per need | one per **(class, need)** |

**Result**, weighted least squares over the eight 1836 markets, 232 market×good observations:

| model | parameters | in-sample SSE | leave-one-market-out SSE |
|---|--:|--:|--:|
| per need | 44 | 1 628.6 | 2 454.9 |
| per (class × need) | 220 | 1 114.9 | **1 761.6** |
| | | −31.5 % | **−28.2 %** |

220 parameters against 232 observations is close to one per data point, so the in-sample number alone
would be worthless — the held-out figure is what makes this real. That the two agree to ~3 pp says the
extra parameters are capturing class-specific consumption rather than memorising markets.

**Why it should work, mechanically.** A peasant and a capitalist facing the same food budget do not
buy the same basket, and the current model forces them to. The classes also differ enough *between*
markets — Belgium is a third peasant, the Qing nine tenths — for the fit to separate them.

**What it does NOT say.** It is not an implementation — the experiment computed predictions outside
`popDemand()`, so nothing in the live model changed, and nothing should be built on it as stated. It
inherits F17's caveat too: the fit target is a residual against a building model that is itself 12 %
out on supply.

**Where this leaves the design.** Three options, none of them the above:

1. **Keep the single market-independent per-need split.** Mechanically honest; its ceiling is now
   measured at roughly F17's 26 % demand / 12 % supply. The residual is structural, not tunable.
2. **Compute the split from supply share** — the actual mechanism. Narrower than the substitution
   modelling that was ruled out: in a *static* scenario, supply is fixed and known, so this is one
   pass over the panel's own sell orders. No time series, no feedback, no iteration.
3. **Adopt a proxy knowingly**, documented as a fitted correlate rather than a mechanism.

**Session.** No game time; computed against `20260802_171235_belgium-check` via the seven other presets.

---

<!-- FINDINGS.md lines 5730–5801 at 5ab4fd1 -->
## F9 — The curves: divergence is immediate and steady, and world GDP is the one reliable lens

**Claim.** Read as trajectories rather than endpoints, three things change the picture. The mod's
gap to vanilla **opens immediately and widens every decade** — it is not a late-game cliff. The
paper BE−20 change is **economically invisible at world level**. And **world GDP is stable enough
to trust at n=3 while country- and market-level series are not**, which decides what any future
batch can actually answer.

### World GDP, all 11 dumps

| | 1836 | 1846 | 1856 | 1866 | 1876 | 1886 | 1896 | 1906 | 1916 | 1926 | 1935 |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| vanilla (M) | 373 | 524 | 670 | 820 | 974 | 1197 | 1525 | 1968 | 2518 | 3448 | 4261 |
| mod base (M) | 362 | 489 | 619 | 717 | 832 | 964 | 1188 | 1450 | 1759 | 2185 | 2740 |
| **mod ÷ vanilla** | 97 % | 93 % | 92 % | 87 % | 85 % | 81 % | 78 % | 74 % | 70 % | 63 % | **64 %** |
| paper−20 ÷ mod | 102 % | 99 % | 98 % | 98 % | 97 % | 100 % | 95 % | 97 % | 99 % | 100 % | 101 % |

**The shortfall starts at once** — 7 % behind by 1846, 15 % by 1876 — and compounds smoothly with
no inflection. So "the mod economy is smaller" is not a late-game phenomenon to be explained by
late-game mechanics; it is present from the first decade.

**Paper BE−20 did nothing at world level**: within ±5 % of the mod baseline at every date, no
trend. Whatever it fixed in paper supply (F8) did not reach GDP.

### World GDP is trustworthy at n=3; almost nothing else is

Within-arm spread (max ÷ min across that arm's runs):

| | 1836 | 1876 | 1906 | 1935 |
|---|--:|--:|--:|--:|
| vanilla | 1.00× | 1.15× | 1.19× | 1.07× |
| mod base | 1.01× | 1.12× | 1.41× | 1.59× |
| paper−20 | 1.01× | 1.11× | 1.08× | 1.38× |

Compare a **single market** at 1935 in the same runs: 9.55 / 17.70 / 33.81 M, a **3.5×** spread.
**Aggregate over everything and the noise cancels; look at one market or one country and it does
not.** This is the practical rule for reading any of these batches.

### Country-level GDP is mostly unusable — from attrition, not noise

Runs in which each country still exists (vanilla / mod / paper, of 3 / 5 / 3):

| | 1836 | 1856 | 1876 | 1896 | 1935 |
|---|---|---|---|---|---|
| Russia | 3/5/2 | 3/5/3 | 3/5/3 | 3/5/3 | 3/3/3 |
| USA | 3/5/2 | 3/5/3 | 3/5/3 | 3/5/3 | 3/5/3 |
| Great Britain | 3/5/2 | 2/3/3 | 2/3/3 | 2/2/3 | 2/2/3 |
| Great Qing | 3/5/2 | 3/5/2 | 2/4/2 | 1/3/2 | 1/3/0 |
| Prussia | 3/5/2 | 3/3/2 | 3/2/1 | 0/0/0 | 0/0/0 |
| France | 3/5/2 | 0/1/0 | 0/0/0 | 0/0/0 | 0/0/0 |

**Only the USA and Russia survive everywhere.** France stops being "France" almost immediately in
every arm; Prussia becomes Germany; Britain is absent from a third of the vanilla runs. A country
series that quietly drops to 2 runs is not a comparison, and averaging over the survivors
selects for countries that did well.

**The one country-level signal large enough to survive that:** the mod's **USA runs ~2× vanilla** —
210 % at 1896, 200 % at 1935, and 175 / 146 % in the paper arm. Present in all runs at all dates,
so it is not attrition. Unexplained, and worth a look: something about the tier split is very good
for the United States specifically.

### ⚠ Data quality: the v8 arm lost 2 of 33 country dumps

`country_state` rows per dump: vanilla min 200, mod min 196 — both clean. **The v8 paper arm has
two badly short dumps** (run 1 at 1846 = 58 rows, run 3 at 1836 = 141, against ~283 expected). So
despite phased dumps, 200 ms polling and ring recovery, the heaviest telemetry still occasionally
loses most of a phase. Market-level rows in the same arm look intact, so **F8's paper numbers are
unaffected**, but country-level cells from those two dumps must be excluded. Any future batch
should check rows-per-dump before analysis, not after.

---

<!-- FINDINGS.md lines 5802–5873 at 5ab4fd1 -->
## F8 — Lowering paper BE by 20 pp helps, but does not fix the shortfall

**Claim.** Cutting every paper tier's `target_be` by 20 pp and re-solving volumes moves paper
supply in the right direction — **pooled across all markets, self-supply rises 61 % → 64 % at 1935**
against vanilla's 95 % — and pulls prices back toward vanilla. In the major markets the effect is
several times larger. But **3 pp against a 34 pp gap is not a fix**, and one major market moved the
wrong way.

### The change

Paper only; all 64 non-paper tiers restored to canonical, verified by diff (three lines differ).
Volumes re-solved from the new targets, build costs re-solved on the 10-year payback at BE+20 pp.

| rung | BE | inputs before | inputs after |
|---|--:|---|---|
| rung 1 | 115 → **95** | wood 51 | wood 43 |
| rung 2 | 90 → **70** | sulfur 11, wood 35 | sulfur 9, wood 26 |
| rung 3 | 90 → **70** | dye 13, sulfur 13, wood 40 | dye 9, sulfur 9, wood 28 |

Build costs are unchanged — correct, not an oversight: on the output basis cost keys off *output*
value, and only inputs moved.

### Evidence

Session `20260801_225108_paper-be20-n3`, **n=3**, 1836→1935, 11 dumps, all complete, no crashes.
Compared against the mod baseline (`20260731_103246_be-defaults-n5`, n=5) and vanilla
(`20260801_001026_vanilla-n3-v5`, n=3).

**Paper self-supply (production ÷ buy), pooled over ALL markets** — the stable measure:

| | 1836 | 1856 | 1876 | 1896 | 1916 | 1935 |
|---|--:|--:|--:|--:|--:|--:|
| vanilla | 83 % | 53 % | 77 % | 82 % | 86 % | **95 %** |
| mod baseline | 78 % | 52 % | 56 % | 59 % | 57 % | **61 %** |
| **paper BE−20** | 84 % | 59 % | 58 % | 62 % | 62 % | **64 %** |

**Per major market at 1935** (self-supply, and paper price as % of base):

| market | vanilla | mod | BE−20 | | price vanilla | mod | BE−20 |
|---|--:|--:|--:|---|--:|--:|--:|
| British | 98 % | 60 % | **76 %** | | 102 % | 138 % | **125 %** |
| French | 74 % | 65 % | **79 %** | | 128 % | 153 % | **121 %** |
| Russian | 88 % | 62 % | **70 %** | | 112 % | 147 % | **133 %** |
| Qing | 124 % | 59 % | **40 %** ⚠ | | 98 % | 153 % | **171 %** ⚠ |

Britain +16 pp, France +14 pp (now above vanilla), Russia +8 pp, Prussia +13 pp at 1876. **Qing went
backwards**, −19 pp with prices rising — and its market vanishes entirely by 1935 in this arm, so
that cell is as likely to be collapse as economics.

### What it does NOT say

- **Not a fix.** The pooled gain is 3 pp against a 34 pp gap to vanilla. The per-market majors look
  much better, but the world as a whole barely moved — pooling is the honest number.
- **Nothing about the wider economy.** At n=3 the late game is uninterpretable: at 1906 the British
  Market appears in **one of three runs** (Britain lost or renamed it in the others), and at 1935 its
  size spans 9.55 / 17.70 / 33.81 M — a 3.5× range, consistent with F5's ~64 % CV. Any claim that
  this change grew or shrank the economy would be reading noise.
- ⚠ **Cross-arm market-size sums are invalid unless deduped.** The older arms logged *tags*, and
  several tags share one market (GBR, BIC and IND all map to the British Market), so a naive sum
  triple-counts it; the v8 arm logs each market once. Compare named markets, deduped, or not at all.
- **Three different telemetry schemas** (mod v3, vanilla v5, this v8). The market-goods fields are
  identical across them, so per-good comparisons hold; anything relying on newer metrics does not.

### What would settle it

The direction is right, so the open question is dose, not sign. A −40 pp arm would show whether the
relationship is roughly linear (predicting ~67 % pooled) or whether something else binds. Worth
pairing with the wood/sulfur supply, since paper's inputs may themselves be the constraint —
the origins data now logged for wood, sulfur and dye is exactly the check.

---

<!-- FINDINGS.md lines 5874–5952 at 5ab4fd1 -->
## F7 — Bankruptcies +49 %; industrialisation faster early, slower late. Neither traces to prices.

**Claim.** Against the vanilla control: the mod produces **1.49× the bankruptcies** (383 ± 41 vs
257 ± 34, Welch t = 4.66), and its industrial **capacity** crosses over — ahead of vanilla until
~1896, then behind, ending at **69 % of vanilla's manufacturing levels** in 1935. **Paper is
+30–35 pp dearer than vanilla in every market; tools only ~+10 pp.** But the tempting causal
chains — dear paper → bankruptcies, dear tools → slow industry — are **not supported** by this
data, and the tools one is contradicted by it.

### Late-game prices (% of base)

| | 1906 vanilla | 1906 mod | 1935 vanilla | 1935 mod |
|---|--:|--:|--:|--:|
| **paper** GBR | 114 % | **144 %** | 106 % | **136 %** |
| paper FRA | 109 % | 137 % | 128 % | 153 % |
| paper RUS | 126 % | 159 % | 112 % | 147 % |
| paper TUR | 146 % | 156 % | 127 % | 157 % |
| **tools** GBR | 98 % | 112 % | 94 % | 96 % |
| tools FRA | 110 % | 122 % | 102 % | 121 % |
| tools RUS | 112 % | 121 % | 112 % | 106 % |

Paper is dearer in the mod in **every market at both dates**, by ~30–35 pp. Tools are dearer by
~10 pp and at GBR 1935 the gap has essentially closed (94 → 96 %).

### Bankruptcies

| | mod (n=5) | vanilla (n=3) | ratio | Welch t |
|---|--:|--:|--:|--:|
| **bankruptcies** | 383.4 ± 41.3 | 257.3 ± 34.3 | **1.49×** | **4.66** |
| defaults (entries) | 3006 ± 499 | 2198 ± 604 | 1.37× | 1.95 *(n.s.)* |
| war starts | 879 | 782 | 1.12× | — |

The bankruptcy gap is solid. Note bankruptcies separate more cleanly than defaults, which is what
you would expect if the mod pushes marginal states past the point of no return rather than merely
making them wobble.

### Industrialisation — the crossover

World manufacturing, mod as a share of vanilla:

| | 1836 | 1856 | 1876 | 1896 | 1916 | 1935 |
|---|--:|--:|--:|--:|--:|--:|
| **buildings** | 101 % | 151 % | 165 % | 166 % | 164 % | 150 % |
| **levels** | 100 % | **123 %** | 114 % | 100 % | 86 % | **69 %** |

⚠ **Count is the wrong measure and is structurally inflated**: the mod has 67 tier buildings where
vanilla has ~22, so one industry necessarily spreads across more building *types*. **Levels are
industrial capacity**, and they tell the real story: the mod industrialises **faster than vanilla
until ~1896**, then falls behind, ending 31 % short.

### Why the price hypotheses do NOT hold

- **Tools → slow industry: contradicted.** Tools run only ~10 pp above vanilla, and the mod is
  *ahead* on capacity (123 % at 1856) during the very period when tools are already elevated. A
  10 pp input-price gap cannot produce a 31 % capacity shortfall while the same gap coexists with
  a 23 % capacity *surplus* forty years earlier. The crossover shape points instead at the mod's
  own mechanism: each tier must be **constructed**, so capital, not tool prices, is the constraint
  — which is what the design intends.
- **Paper → bankruptcies: unsupported, though not refuted.** Both effects are real and both are
  large, but nothing here links them. Paper is one input among many, and there are strong
  competing explanations for the bankruptcies: per-tier construction costs, an economy 58 % of
  vanilla's by 1935 (F6) servicing comparable obligations, and 12 % more wars.

**What would actually test it:** the treasury telemetry (v5) now logs `GetPrincipal`, interest,
subsidies and the full expense breakdown per tracked country — so a repeat with **both arms on
v5** could show whether bankrupting countries are the paper-hungry ones and whether their expense
mix is input-cost-driven. That is a direct test; the present data only establishes the two facts
side by side.

### What it does NOT say

- **Not that paper is harmless.** Paper is under-built in the mod (F6) *and* over-priced (here).
  It is a real defect worth fixing regardless of whether it drives bankruptcies.
- **Asymmetric n** (5 vs 3) and different schemas (v3 vs v5). The bankruptcy separation is large
  enough to survive that; the defaults comparison is not significant and should not be quoted.
- **Building counts must never be compared across arms** without the levels caveat above.

---

<!-- FINDINGS.md lines 6044–6100 at 5ab4fd1 -->
## F5 — Runs are near-identical at 1836 and diverge ~6 pp per decade after that

**Claim.** Cross-run spread in market size is **0.8 % at 1836** and **64 % at 1935**. Divergence
grows steadily from the 1840s and accelerates after 1906. This sets how many runs a question needs
and how late a date can still answer it.

### Evidence

Session `20260731_103246_be-defaults-n5`, n=5. Metric: coefficient of variation (sd ÷ mean) across
the 5 runs of each market's **price-weighted size** (Σ buy × price), averaged over the **stable
core** — GBR, FRA, RUS, USA, the only watch-list tags present in all 5 runs at all 11 dates.

| date | mean CV | | date | mean CV |
|---|--:|---|---|--:|
| 1836 | **0.8 %** | | 1896 | 29.3 % |
| 1846 | 6.8 % | | 1906 | 35.1 % |
| 1856 | 13.9 % | | 1916 | 51.0 % |
| 1866 | 21.5 % | | 1926 | 58.9 % |
| 1876 | 25.5 % | | 1935 | **63.9 %** |
| 1886 | 30.0 % | | | |

Per-market at 1935: GBR 53 %, RUS 52 %, TUR 69 %, USA 71 %, FRA 79 %.

**The excluded tags are excluded because they diverged structurally**, not because their numbers
were noisy — the tag stops existing in some runs: **PRU** vanishes after 1876, **AUS** is missing
from some runs from 1846 onward, **CHI** from 1876. A tag present in fewer than 5 runs cannot be
compared across runs at all, so it is dropped from the date onward rather than averaged over a
shrinking sample.

⚠ **Do not read PRU's disappearance as Prussia collapsing, and do not assume PRU became GER.**
**Either Prussia or Austria can form Germany**, and a late-formed AUS-based Germany is a
continuation of *Austria*, not of Prussia — its economy, states and history are Austria's. Plenty
of other things can happen too (annexation, a different unifier, no unification at all), so no
single successor rule is safe. The concrete rule that is: **when neither PRU nor AUS is present,
do not attribute GER to Prussia by default.** Chaining PRU→GER automatically will sometimes graft
Austrian numbers onto a Prussian series. There is no country-tag data function
(TESTBED_METRICS §3), so where the lineage actually matters, check within that same run which
predecessor stopped appearing and when — not against the batch mean.

### What this means for experiment design

- **Early dates are cheap and sharp.** At 1836–1856 a difference of >15 % between arms is already
  outside the noise at n=5. At 1935 the noise alone is ~64 %, so only very large effects survive.
- **Prefer the earliest date that can show the effect**, and treat 1916+ comparisons as needing
  either many runs or an effect measured in multiples, not percentages.
- This is consistent with F1, where the vanilla-vs-stub gap was significant at 1860 and 1910 but
  **not** at 1886 — vanilla's spread there was enormous.

### Open anomaly

**The Ottoman market splits bimodally at the very first snapshot** — runs 1–2 at ~560 k, runs 3–5
at ~370 k, a 21 % CV at 1836.2.1 when every other market is at 0–2 %. Market *membership* is
identical (TUR alone in all five), so something discrete happens inside the first month. Not
explained; worth a look before Ottoman numbers are used for anything.

---

<!-- FINDINGS.md lines 6101–6151 at 5ab4fd1 -->
## F4 — The simulation slows 2.2× over a campaign, and the cost is in the late game

**Claim.** Wall-clock cost per in-game year is **not** constant: a 1836→1935 run completes
**13.2 in-game months per real minute in the 1830s** and only **6.0 in the 1930s**. Budgeting a
batch off its early pace underestimates it badly — the 1920s cost **18.7 min/run** against the
1840s' 10.5.

### Evidence

Same session as F3 (`20260731_103246_be-defaults-n5`), n=5, from 1 977 progress samples
(elapsed-seconds ↔ in-game-date pairs, ~20 s apart) parsed out of each run's `run.log`.

| Decade | months/min | min per run |
|---|--:|--:|
| 1830s* | 13.16 | 3.8 |
| 1840s | 11.46 | 10.5 |
| 1850s | 10.82 | 11.0 |
| 1860s | 10.24 | 11.7 |
| 1870s | 9.98 | 12.1 |
| 1880s | 9.66 | 12.3 |
| 1890s | 8.84 | 13.5 |
| 1900s | 7.94 | 15.1 |
| 1910s | 7.29 | 16.5 |
| 1920s | 6.37 | 18.7 |
| 1930s* | 6.03 | 10.0 |

*partial decades (1836–40, 1930–35). Whole-campaign runs: 124 / 133 / 140 / 141 / 141 min,
mean **132 min**, i.e. ~9.0 months/min averaged.

**Practical rule: a full 1836→1935 run costs ~2 h 15 m, and the second half costs ~1.4× the
first.** Estimating from the opening decade overstates throughput by ~45 %.

### Confidence and what it does NOT say

**Solid for the mod arm** (n=5, monotone across 11 decades, tight between runs). **It is not a
vanilla comparison.** The only vanilla figure that survives is F2's whole-campaign mean of
**161 min ± 18** (≈7.4 months/min), which is (a) an average, not a curve — the per-decade vanilla
data was in the deleted sessions and **is irretrievable**; and (b) **not like-for-like**: those
runs carried market-goods telemetry at 4 dump dates, whereas these carry per-country GDP, building
counts by category and a monthly bankruptcy poll at 11 dump dates. The mod arm being *faster*
(132 vs 161 min) despite heavier instrumentation is suggestive of the smaller-economy effect in
F2, but it is confounded and should not be quoted as a measured speedup.

The surviving smoke sessions (`20260731_002048_post-audit-smoke`) hold a vanilla run of **one
in-game year**, which is all startup and yields no usable pace curve.

**To get a real curve, the vanilla arm must run the same telemetry** — which is exactly what the
queued vanilla baseline run would deliver, at no extra cost.

---

<!-- FINDINGS.md lines 6152–6275 at 5ab4fd1 -->
## F3 — The BE ladder does NOT produce specialisation: markets stay self-supplied

> ⚠ **SUPERSEDED IN PART BY F6.** F3 had no vanilla arm, and the vanilla arm (F6) shows that
> **vanilla behaves the same way**: ~90 % self-supply and 2–5 % trade intensity are base-game
> traits, not mod effects. Read F3's numbers as accurate descriptions of the mod that do **not**
> isolate anything the mod caused. The parts of F3 that survive independently are the per-good
> composition shifts and the paper shortfall (which F6 confirms is mod-specific).

**Claim.** Under the mod's current BE defaults, laggard markets do **not** lose their manufacturing
to efficient producers. Domestic production still covers **60–96 %** of domestic demand in every
major market through 1935, and for the biggest laggards self-supply **rises** over the century
rather than collapsing. Cross-market trade never becomes the channel the design assumes: imports
are **2.2 % of buy orders in 1836 and only 6.6 % in 1935**, across all nine markets combined.

This is the design goal stated in CLAUDE.md — "efficient producers should drive inefficient ones
out of a market" — and the conceptual target ("Russia imports 99 % of its electronics from
Britain"). Neither is happening.

### Evidence

Session `tools/testbed/sessions/20260731_103246_be-defaults-n5`. **n = 5, mod only**, 1836→1935,
11 snapshots (Feb 1 each decade + 1935.2.1). All five runs reached 1935.3.1 with all 11 dumps,
**zero crashes, zero resumes**; 124–141 min each.

**Self-supply share** = `production / buy_orders`, mean of 5 runs. 100 % = domestic output exactly
covers domestic demand; >100 % = net exporter.

| tools | 1836 | 1856 | 1876 | 1896 | 1916 | 1935 |
|---|--:|--:|--:|--:|--:|--:|
| GBR | 80 % | 75 % | 73 % | 89 % | 96 % | **106 %** |
| FRA | 75 % | 50 % | 59 % | 61 % | 65 % | 70 % |
| RUS | 62 % | 64 % | 70 % | 71 % | 80 % | **89 %** |
| TUR | 53 % | 66 % | 64 % | 59 % | 50 % | 63 % |
| CHI | 54 % | 57 % | 67 % | 75 % | 83 % | **96 %** |

| steel | 1836 | 1856 | 1876 | 1896 | 1916 | 1935 |
|---|--:|--:|--:|--:|--:|--:|
| GBR | 138 % | 65 % | 71 % | 82 % | 89 % | 95 % |
| RUS | — | 0 % | 43 % | 58 % | 77 % | **88 %** |
| TUR | — | 0 % | 1 % | 55 % | 47 % | 67 % |
| CHI | — | — | 35 % | 64 % | 76 % | **96 %** |

Clothes, furniture, paper and glass all sit in the same 44–82 % band at 1935 with no divergence
between leader and laggard. **Russia and China converge toward self-sufficiency**, which is the
opposite of the intended direction.

**Trade intensity** — total imports ÷ total buy orders, all nine markets:

| 1836 | 1846 | 1856 | 1866 | 1876 | 1886 | 1896 | 1906 | 1916 | 1926 | 1935 |
|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| 2.2 % | 2.0 % | 2.7 % | 2.7 % | 2.6 % | 3.4 % | 3.8 % | 4.6 % | 5.2 % | 5.0 % | **6.6 %** |

Per-good manufactured import shares are mostly 0–16 %, never approaching dominance.

**Supporting aggregates.** World GDP 361.7 M ± 0.7 (1836) → 2 740 M ± 441 (1935). Manufacturing
buildings worldwide 469 → 4 110 (×8.8); extraction 347 → 959; agriculture 2 365 → 3 359;
subsistence flat ~830–880. So the mod *does* build the tier ladder — the industry exists, it is
simply built **everywhere** rather than concentrating.

### Why this is robust

The self-supply figure comes from `GetMarketProduction / GetMarketBuyOrders` and **does not depend
on the import metric at all**. Even if `GetMarketImports` is net of exports (an open question in
TESTBED_METRICS §2.5), a market whose own production covers 89 % of its demand cannot be importing
more than 11 % of it. The conclusion therefore survives that unresolved question.

### Side observation: paper is structurally short; tools are not

Prices as % of **base**, mean over all markets (count of market-snapshots above base in brackets):

| | 1836 | 1856 | 1886 | 1916 | 1935 |
|---|--:|--:|--:|--:|--:|
| **paper** | 127 % (42/50) | 160 % (48/48) | 153 % (44/45) | 151 % (44/44) | **145 % (43/43)** |
| **tools** | 131 % (47/50) | 132 % (48/48) | 124 % (41/45) | 116 % (37/44) | **109 % (30/43)** |

**Paper sits ~50 % above base in essentially every market at every date** (43/43 at 1935) and
never converges, while tools decay toward base. That matches paper's self-supply share above —
GBR 48–63 %, TUR down to 44 % — i.e. production covers only about half of demand, so the price
rides high permanently. **Paper looks under-built across the board**, and is the first place to
look if a good's volumes are mis-set.

⚠ Against **vanilla**, only 1836 can be compared (the vanilla control at `sessions/probe002`); the
per-good vanilla price series for later dates does not exist — **and 1836 is the least interesting
date**, since one month in, the two arms have barely diverged by construction. The late-game
comparison is the one that matters and it is still unmeasured; the queued vanilla arm supplies it. Paired at 1836.2.1, the mod is above
vanilla on both goods but by very different margins: **paper +6 pp on average** (GBR 141→153,
FRA 91→100, RUS 96→96, CHI 102→102), **tools +22 pp** (AUS 119→158, RUS 108→136, USA 98→122).
Note paper is *already* expensive in vanilla at 1836 (141 % of base in the British market), so its
high price is a vanilla trait the mod amplifies slightly — not something the mod introduced.

### ⚠ Expected at this stage, per design intent

**The absence of separation is broadly acceptable for now**: the **extended tech tiers are not
built yet**. The ladder currently spans the vanilla-derived tiers only, so the N+2 obsolescence
gap that is supposed to push a laggard's plant out of the market has fewer rungs to work with than
the finished design will have. Read F3 as *"the current partial ladder does not yet produce
specialisation"*, not as *"the mechanism is refuted"*. The trade-channel observation below is the
part that would survive more tiers, and is the reason to check it early.

### Interpretation — the binding constraint is trade, not competitiveness

The BE ladder makes a tier-N building unprofitable against tier-(N+2) **inside one market**. Driving
a *foreign* producer out requires the two to compete in the same market, which requires trade — and
vanilla's AI barely trades: 2–7 % import intensity over a century. With the transmission channel
nearly closed, relative productivity cannot express itself as specialisation no matter how the BE
ladder is sloped. **This suggests the current lever cannot reach the goal on its own**, and that the
next design question is about trade-route/market-access behaviour rather than about BE numbers.

### What it does NOT say

- **Not a mod-vs-vanilla comparison.** There is no vanilla arm in this batch, and F1's vanilla data
  cannot supply one (different mod, different telemetry, per-good data lost). **The vanilla
  baseline for self-supply share is unmeasured** — the user's recollection is ~80 % for Russian
  electronics, which would mean the mod barely moved it, but that has not been measured here.
  A vanilla arm with this telemetry is the single most valuable next run.
- **Not "the tier split does nothing".** Manufacturing building count grows ×8.8 and the ladder is
  clearly being built. What fails is the *concentration* of that industry.
- **Not a statement about who supplies whom.** Bilateral origins were not logged (task #4), so
  "Russia imports from Britain specifically" is untested — only the aggregate import share is.
- **Goods are V3 goods.** "Electronics" is not one; the closest are telephones/radios/electricity,
  which are late-unlock and were not in the sampled set above.

---

<!-- FINDINGS.md lines 6276–6403 at 5ab4fd1 -->
## F1 — Tiering alone shrinks the economy, and the gap compounds

**Claim.** Applying **only** the tier split — same recipes, same building costs, same `ai_value`
as vanilla, *nothing* rebalanced — leaves the AI economy substantially smaller, and the shortfall
**grows over the campaign**: Britain's market is ~80 % of vanilla's by 1860 and ~39 % by 1935.

### Evidence

Arms: **vanilla control** vs **tiering stub** (`tools/testbed/make_vanilla_stub.ps1` — structure
tiered, base-game economics). **n = 5 per arm**, 1836→1935, dumps at 1860/1886/1910/1935. All ten
runs self-quit at 1935.2.1 with all four dumps; **zero crashes, zero resumes**. ~26 h of runtime.

**What the control was.** Vanilla **1.13.9** compared against **1.13.9 + tiering**, both instrumented by
the same generator. This is the standing vanilla baseline for now: **the full per-good logs are lost**
(below), so only the figures reproduced in this entry survive. More vanilla runs, with the wider
telemetry (per-country GDP, building counts by category, market ownership, import/self-supply shares),
will be run later — but not yet, so until then any mod-vs-vanilla comparison rests on the numbers in
this entry alone.

**⚠️ The raw data no longer exists.** Sessions `tools/testbed/runs/20260729_101106` (vanilla) and
`20260729_233413` (stub) were deleted in the `runs/`→`sessions/` consolidation (`b6f77cb`). They
were never committed — `runs/` was gitignored from the start, so there is nothing on GitHub, and
the recycle bin is empty. Everything below was reconstructed from the analysis output preserved in
the session transcript. **Only what was printed at the time survives**; anything not queried then
can never be queried now. This is the finding that produced the never-delete rule.

British market total orders (buy + sell, the summed market):

| Date | Vanilla (mean ± sd) | Stub (mean ± sd) | Stub share | Welch t |
|---|---|---|---|---|
| 1860 | 200 851 ± 28 781 | 161 062 ± 18 822 | **80 %** | 2.59 |
| 1886 | 410 429 ± 155 874 | 274 120 ± 47 673 | 67 % | 1.87 *(n.s.)* |
| 1910 | 933 388 ± 363 085 | 435 865 ± 141 403 | **47 %** | 2.86 |
| 1935 | 1 530 708 ± 528 095 | 597 220 ± 189 525 | **39 %** | 3.72 |

*"Stub share" = stub mean ÷ vanilla mean at that date* — the surviving fraction of the vanilla
economy, not a percentage-point difference.

At ~5–7 df, t ≳ 2.5 is roughly p < 0.05: 1860, 1910 and 1935 clear it. 1886 does not, because
vanilla's spread there is enormous (one run 221 k, another 574 k). **The monotone trend across
four dates is stronger evidence than any single date.**

A compounding gap is what the mechanism predicts: each era the AI must *build* the next tier
instead of flipping a PM for free, so the shortfall accumulates instead of sitting at a fixed
offset.

### Is the shrinkage universal across goods, or concentrated?

**Broadly universal, with a real minority tail — and the tail points the same way the mechanism
does.**

Each good's **share of the 1935 GBR market**, averaged per arm, as `stub share ÷ vanilla share`
(n=5 per arm). **A ratio of 1.00 means that good shrank exactly in proportion with the whole
economy** — i.e. to ~39 % of its vanilla *absolute* level.

| Over-represented in the stub | share × | | Under-represented in the stub | share × |
|---|---|---|---|---|
| clippers | **32.99** | | rubber | **0.21** |
| liquor | 2.12 | | fine_art | **0.23** |
| merchant_marine | 1.74 | | luxury_furniture | 0.47 |
| artillery | 1.72 | | steamers | 0.66 |
| wood | 1.52 | | hardwood | 0.72 |
| fish | 1.43 | | sugar | 0.73 |
| ammunition | 1.43 | | steel | 0.77 |
| fruit | 1.36 | | telephones | 0.79 |
| tobacco | 1.28 | | oil | 0.81 |
| small_arms | 1.28 | | dye | 0.84 |
| porcelain | 1.23 | | | |
| opium | 1.14 | | | |

**These are the two tails, not the whole distribution** — the analysis printed `head -12` of the
descending sort and `head -10` of the ascending one. The unprinted remainder — the **majority of
goods** — therefore sits between **0.84× and 1.14×**, i.e. within roughly ±15 % of proportional
shrinkage, or **0.33–0.44× in absolute terms** against the 0.39 headline.

**So the answer is: broad.** Most goods shrank close to proportionally; the deviations are a
minority, and they are not random — obsolete goods persist (clippers, opium, liquor, wood, fish)
while modern and high-tier ones lag (steamers, telephones, steel, rubber, fine art). That is the
tiering mechanism, not noise.

**Caveats on this table.** (a) It is **composition**, not level — every entry is already
normalised by the 61 % total contraction. (b) The two lists used slightly different inclusion
filters (top: vanilla or stub share > 0.05 %; bottom: vanilla share > 0.2 %), so the bottom list
excludes small goods the top list would have admitted. (c) It is **1935 GBR only**. (d) The
pilot's dramatic single-run swings mostly did **not** survive: **opium's "+937 %" collapsed to
1.14×**. Treat any single-run per-good number as noise.

⚠️ **Recovered from a chat transcript, not from data.** The raw `markets_all.tsv` files are gone,
so the unprinted middle of the distribution cannot be filled in and no dispersion statistic
(median, IQR, histogram of per-good share) can be computed now. **The next tiering-vs-vanilla
batch should emit the full per-good distribution**, in *absolute* terms as well as share — a cheap
post-hoc analysis of data the harness already writes.

### The clean case: clippers

Share of the 1935 British market, per run — no overlap between arms:

| | run 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| **Vanilla clippers** | 0.016 % | 0.043 % | 0.006 % | 0.036 % | 0.030 % |
| **Stub clippers** | 0.906 % | 0.841 % | 0.856 % | 0.868 % | 0.867 % |

~33× separation, the stub's five runs inside a 0.07 pp band. This is the mechanism visible in
isolation: vanilla flips one shipyard from clippers to steamers for free, so clippers go extinct;
the stub requires *constructing* a steamer yard, so clipper yards keep running. (It is also why
`shipyard` is split by output good into two chains — CLAUDE.md → Scope.)

### Confidence

**Good for the direction and the compounding; approximate for the magnitude.** n=5 per arm, and
V3 campaigns diverge politically (in the pilot, France went Communard). What raises it: more
runs, shorter spans, and above all **direct observables** — building levels per type,
construction throughput, investment-pool state — which should show the same thing in a fraction
of the runs and answer *why* rather than *that*.

### What it does NOT say

- **Not a verdict on the mod.** This is the **stub** — tiering with vanilla economics, i.e. the
  deliberately un-rebalanced control. It measures what the *structural* change does on its own.
  The shipped config re-slopes volumes and build costs precisely because the raw split is not
  meant to ship as-is.
- **Not necessarily bad.** A smaller AI economy may be the intended consequence of making
  modernization cost capital. It is a **magnitude to calibrate**, not automatically a defect.
- **Britain, not the world.** Only GBR and FRA were tagged, and French totals swung wildly with
  politics (203 % of vanilla at 1860 → 17 % at 1935). The 39 % is a British number.

---

<!-- FINDINGS.md lines 6404–6427 at 5ab4fd1 -->
## F2 — The tiered build runs ~14 % faster in wall-clock

**Claim.** The tiering stub completes a 1836→1935 campaign faster than vanilla: **138 min ± 9**
vs **161 min ± 18** (n=5 per arm, t ≈ 2.6). Consistent with simulating a smaller economy (F1) —
extra *building types* cost little, but fewer actual buildings and orders cost less to tick.

**Same batch as F1.**

### Confidence

**Direction likely, magnitude soft — there is an acknowledged confound.** The arms were run
*sequentially, not interleaved*: vanilla 10:11–23:34, stub 23:34–11:04. Any background load
during the day inflates the vanilla arm. The user reports the machine had no external load, which
weakens but does not eliminate the objection (thermal state, OS activity). **The fix is free:
interleave the arms (A, B, A, B, …) in the next batch** — `run_schedule.ps1`'s explicit ordered
`runs` list supports exactly this.

### What it does NOT say

Nothing about the market numbers. **Simulation output does not depend on wall-clock speed**, so
F1 is immune to this confound whichever way it resolves.

---

<!-- FINDINGS.md lines 7255–7298 at 5ab4fd1 -->
## F70 — The research-event machinery works; the WAR GATE is the only part that does not fire

**Session** `20260818_003120_wargate-probe-n2`, run 1 (to 1843 at time of reading), shipped config with
the rebuilt war channel. Arm: `{kind: config, config: config/mod_config.json}`.

**Two results, and the second is only interpretable because of the first.**

**1 — The ROOT defect is fixed.** `link 'owner'` errors in this run's own window: **0**, against
**18,720** before (F-ref: BUGS_AND_FIXES 2026-08-17). No error in the log names any `pm_rehaul` file at
all. The gate moved to `on_monthly_pulse_country`, where ROOT resolves, and the bars now read an
expiring country variable.

**2 — The journal-entry machinery is proven end to end, by the industry channel.**

| | |
|---|---|
| `PMR_JE` completions | **2 308** |
| by stage | inception 1 693 · development 531 · implementation 84 |
| distinct technologies completing | 16 |
| **war-tech completions** | **0** of 40 covered technologies |

⇒ Bars accumulate, journal entries complete, stages chain, and grants land. **So a zero on the war side
is not a plumbing failure** — it is the war GATE specifically declining. That distinction is the whole
value of measuring both channels in one run; the war count alone would have been uninterpretable.

⚠ **What it does NOT yet say: whether 50 000 front casualties is simply too high for 1843.** The gate
requires, on ONE front: our general at ≥100 mobilised battalions, an enemy general there whose owner
holds the technology, and ≥50 000 of our casualties. A zero is consistent with both "the mechanism
never sets the variable" and "no 1836–43 war reaches that bar". A follow-up probe at
`front_casualties_min = 100` (`config/mod_config.wargate_lowthr.json`, diagnostic only) separates them.

⚠ **And a zero at threshold 100 would still not condemn the plumbing**, because the tech clause may be
the binding one: in a CIVIL war the breakaway side normally starts with the parent's technologies, so
no differential exists. Brazil's 1836 Ragamuffin revolt is exactly that shape. Read a low-threshold
zero as pointing at the tech clause, and probe that next rather than lowering casualties further.

⚠ **A methodological note worth keeping.** The first parse of this log reported **0 completions of any
kind** — the regex expected a country TAG where the emitted line carries a display NAME with spaces
(`[THIS.GetCountry.GetNameNoFormatting]`). The correct count is 2 308. A telemetry reader that assumes
the wrong field shape reports silence indistinguishable from a dead mechanic; check the emitting
template before believing a zero.

---

<!-- FINDINGS.md lines 7299–7432 at 5ab4fd1 -->
## F71 — ⭐⭐ THE MOD DOES NOT SLOW THE GAME DOWN: **−2.5% pop-matched**. And the raw wall-clock total says the opposite of the truth — it reads as a **14% speedup** that is really a missing third of an economy

**Claim.** Measured at a comparable economy size, the mod costs the engine **−2.5%** per in-game year
against vanilla — no slowdown, well inside the 10% budget ruled 2026-08-18. **The naive reading of the
same data is not merely weaker but inverted in meaning**: totalled over the century the modded arm looks
**14% faster**, entirely because it built a third less economy.

**Arms, n, span.** Retrospective analysis of session `20260813_083557_vanilla-vs-mod-n4` — **no new game
time**. Alternating V/M/V/M, 1836.1.1→1936.1.1, game 1.13.10, one machine, one night, all runs
`moderate_consolidation`. Completed runs only: **vanilla n=4, mod n=2** (the other two mod runs died and
are void — see that session's VERDICT.md and landmine L17). Reader:
`tools/testbed/ledger/report_perf.mjs`.

### 1. The naive total — do not quote it

| arm | wall clock, 1836→1936 | median |
|---|---|---|
| vanilla (n=4) | 155.5 / 161.0 / 155.9 / 186.7 min | 158.5 |
| mod (n=2) | 137.2 / 134.6 min | **135.9** |

Ratio mod/vanilla **×0.858**. ⚠ But the arms did not simulate the same thing: at 1936 the mod arm held
**×0.65 the live pop objects** (83–89k vs 122–147k) and **×0.61 the building levels** (139–145k vs
219–274k).

### 2. Seconds per in-game year, by decade (median) — the shape of the illusion

| decade | vanilla | mod | mod/van |
|---|---|---|---|
| 1830s | 58.5 | 64.5 | 1.103 |
| 1840s | 69.5 | 71.5 | 1.029 |
| 1850s | 75.0 | 76.5 | 1.020 |
| 1860s | 77.0 | 76.5 | 0.994 |
| 1870s | 77.0 | 75.0 | 0.974 |
| 1880s | 84.5 | 71.0 | 0.840 |
| 1890s | 93.0 | 75.0 | 0.806 |
| 1900s | 98.0 | 80.5 | 0.821 |
| 1910s | 123.5 | 83.0 | 0.672 |
| 1920s | 133.0 | 92.0 | 0.692 |
| 1930s | 142.5 | 93.0 | **0.653** |

The apparent advantage grows monotonically after the 1870s — which is exactly the period in which the two
economies diverge. It is a measure of the divergence, not of speed.

### 3. ⭐ Pop-matched — the reading that answers the question

Binned by `world.pop_objects_live`; only bins where **both** arms have samples are comparable.

| live pop objects | vanilla s/yr | mod s/yr | mod ÷ van | samples (v,m) |
|---|---|---|---|---|
| 30–38k | 61.0 | 68.5 | 1.123 | 22,14 |
| 38–46k | 70.5 | 72.0 | 1.021 | 28,17 |
| 46–55k | 75.0 | 76.0 | 1.013 | 38,29 |
| 55–63k | 77.0 | 72.0 | 0.935 | 45,34 |
| 63–72k | 77.0 | 75.0 | 0.974 | 40,38 |
| 72–80k | 86.0 | 84.0 | 0.977 | 44,39 |
| 80–88k | 96.0 | 92.5 | 0.964 | 36,26 |
| 88–97k | 100.0 | 94.0 | 0.940 | 29,1 |
| 97–105k … 139–147k | 117 → 161 | — | **no overlap** | 31…7, 0 |

**Median ratio over the 8 overlapping bins: 0.975, i.e. −2.5%**, range 0.935–1.123. The two arms lie on
essentially **one cost curve**: at equal pop-record count the engine costs the same whichever arm runs.

### What it does NOT say

- **It is not a clean bill of health above ~97k live pop objects.** Six of fourteen bins have no mod
  samples at all, because the mod's world never gets that big. If a future arm reaches vanilla's scale,
  the top of the curve is unmeasured and must be re-read there.
- **The 1830s bin (×1.12) is the one adverse reading** and is not dismissed: it is where our extra content
  (research journal entries, the larger tech tree, the added buildings) is largest relative to a tiny
  economy. It is inside the budget, on the smallest workload, and it shrinks as the economy grows — but a
  future load-time or startup regression would show here first.
- **It says nothing about load time, save time or UI responsiveness** — only about simulation throughput
  between autosaves. Autosave *writing* stalls the engine (the reason batches use yearly cadence) and is
  inside these intervals, unseparated.
- **n is small on the mod side (2).** The vanilla arm's spread is itself 155.5–186.7 min (±10%), which is
  the noise floor for the *total*; the pop-matched bins are far better resolved (26–45 samples each)
  because every run contributes ~99 yearly intervals.
- **Absolute minutes do not travel.** Machine load, thermal state and game version all move them; only
  the within-session ratio survives. This is why an alternating same-night design is the right one.
- **Valid only within one `pop_consolidation` setting** (TESTBED_METRICS §7¼/§7⅜) — the dial that decides
  how many pop records exist is the cost driver itself. All runs here were on the default.

**Confidence: high for the conclusion (no slowdown in the measured range), moderate for the exact −2.5%.**
The sign and rough magnitude are robust — eight independent bins, none above 1.13, six below 1.0. The
point estimate is a median of medians over an unevenly sampled range.

### F70.1 — RETRACTION: the war-gate zeros were CONFOUNDED, and the tech-clause explanation is withdrawn

**User challenge, 2026-08-18: "Did we have A in all probes as well? This is guaranteed not to fire in
1836." Correct on both counts.**

The gate ANDs three clauses:

```
A  any_scope_general = { owner = ROOT            num_mobilized_battalions >= 100 }
B  any_scope_general = { NOT = { owner = ROOT }  owner = { has_technology_researched = X } }
C  num_front_casualties = { target = ROOT  value >= N }
```

Both probes (`20260818_003120` at N=50 000, `20260818_011524` at N=100) held **A at 100 mobilised
battalions** and varied only C. **A is essentially unreachable in 1836–46**: measured across the whole
1836 start there are **8 399 barrack levels world-wide**, and Britain — the largest army in the game —
holds about **705**, i.e. its entire empire's standing army split across many generals and many fronts.
Clause A demands ONE general, ≥100 MOBILISED battalions, on ONE front.

⇒ **Clause A alone accounts for both zeros.** The two runs are therefore uninformative about B and C,
and the following claims are **WITHDRAWN**:
- "casualties are not what blocks the war channel" — unsupported; C was never reached.
- "the binding clause is the TECHNOLOGY one" — unsupported, and A is the more likely blocker.
- the civil-war/no-tech-differential argument — still plausible, still untested, and it was never the
  first thing to suspect.

**What survives:** the ROOT fix (0 owner-link errors on three independent runs, from 18 720) and the
journal-entry machinery (2 695 / 3 207 / 2 809 completions, all three stages chaining). Those were
measured, not inferred.

⚠⚠ **THE METHOD ERROR, WHICH IS THE TRANSFERABLE PART.** Varying one term of a conjunction while
holding the others at values that may themselves be false cannot identify anything: every clause is a
candidate, and the null result looks identical whichever is responsible. **Isolate the terms before
tuning any of them** — emit one `debug_log` per clause from the pulse (A alone, B alone, C alone, then
the conjunctions) and a single short run says which ever pass, for whom, and when. That is one run and
it answers what two runs and a threshold sweep could not.
⚠ Related: **no error in the log does not prove a trigger evaluates as intended.** C is syntactically
accepted and might still be always-false; that remains untested.

**Open design question this exposes, for the user.** 100 mobilised battalions on one front may be
perfectly correct for an 1870s+ great-power war and simply unreachable early — in which case the war
research channel is *intended* to be a late-game mechanic and the zeros are not a defect at all. The
threshold came from a ruling aimed at stopping micro-states firing it (session 20260812_010659, where
military took 70% of completions). Whether it should also fire in early-game wars is a design call, not
a bug report.

---

<!-- FINDINGS.md lines 7520–7611 at 5ab4fd1 -->
## F73 — ⭐ THE INDUSTRY RESEARCH CHANNEL FIRES DECADES EARLY, IN THE **TAIL** NOT THE MEDIAN — and **87% of its firings go to countries outside the twelve majors**

⚠⚠ **MAGNITUDE CORRECTION, 2026-08-19 — EVERY COUNT BELOW WAS TAKEN FROM RAW LOG LINES AND IS INFLATED.**
Measured on canon-n7 run 1 (landmine **L23**): the telemetry holds **12 143 `PMR_JE` lines against 5 293
distinct `(stage, tech, country)` triples — 2.29x**. The duplication is concentrated in a handful of
SECONDS during the game's own burst ticks, and the early-1840s window that produces this finding's peak
is exactly where those bursts are. A journal entry completes once per country per technology by
construction, so the distinct-triple count is the honest one; raw lines are an upper bound.
⇒ **The SHAPE of this finding stands** — the duplication is not selective by country, technology or date,
so "the tail, not the median", the nine early technologies and the majors/minors split are unaffected in
kind. **The NUMBERS do not**: treat 10 093, the 1840s peak of 2 221 and the per-decade series as upper
bounds, and re-derive from distinct triples before taking any threshold ruling on them. The 87.2% share is
a RATIO and is the most likely of the three to survive intact, but it has not been re-measured either.
⚠ The cause is not identified (mirror re-append under rapid ring rotation vs the engine re-emitting) and
the correction does not depend on which it is — see L23.

**Claim.** Measured over canon-n2's two full-century runs (**10 093 industry-channel firings**), the
industry research journal entries have three distinct properties, and only the first was suspected:

1. **Nine technologies have `implementation` completed BEFORE their own narrative onset year**, the worst
   by **41 years**. This is an *earliest-adopter* effect: for eight of the nine the MEDIAN firing lands
   *after* onset, so it is the leading edge that is broken, not the whole distribution.
2. **The channel front-loads hard**: firings peak in the **1840s (2 221)** and fall monotonically to
   **294 in the 1930s** — a 7.6× decline over the century.
3. ⭐ **It is overwhelmingly a MINOR-country mechanism**: only **1 289 of 10 093 firings (12.8%)** go to
   the twelve majors; **8 804 (87.2%)** go to everyone else.

**Arms, n, span.** `20260818_084128_canon-n2`, config arm, n=2, 1836→1936, game 1.13.10, frozen config
sha `ee029e5e`. War- and fleet-gated bars excluded (this is the industry channel only). In-game dates are
interpolated from the observer's own tick lines, so timings carry ±a few in-game weeks. Onset years are
the narrative real-world dates `tech_tree_spec.mjs` carries per technology. Reader: `je_dist.mjs`.

### The egregious cases — implementation granted before the technology existed

| technology | era | onset | first fired | years early | firings | majors reached |
|---|---|---|---|---|---|---|
| `steam_donkey` | 3 | 1881 | 1840 | **−41** | 85 | 10 |
| `automatic_bottle_blowers` | 4 | 1903 | 1865 | **−38** | 81 | 11 |
| `compression_ignition` | **5** | 1897 | 1860 | **−37** | 57 | 11 |
| `electrical_generation` | 3 | 1882 | 1849 | −33 | 26 | 7 |
| `mechanized_farming` | 4 | 1892 | 1860 | −32 | 65 | 9 |
| `vacuum_canning` | 3 | 1874 | 1852 | −22 | 84 | 11 |
| `dough_rollers` | 5 | 1920 | 1910 | −10 | 10 | 4 |
| `rotary_valve_engine` | 3 | 1849 | 1845 | −4 | 148 | 11 |
| `screw_frigate` | 2 | 1843 | 1842 | −1 | 41 | 2 |

⚠ **An ERA-5 technology (`compression_ignition`) completing in 1860 is the sharpest single statement**
this batch makes about the channel: 37 years before its onset and four eras ahead of the calendar.

### The systemic case is one technology, not many

Ranked by reach × earliness with only genuinely-early technologies counted, **exactly one survives**:
`steam_donkey`, median **10.2 years early**, 85 firings, 11 distinct countries. Every other early
technology fires early only at its leading edge. ⚠ An earlier cut of this analysis ranked by a score
that collapses to zero for late-firing technologies and so listed twelve "systemic" entries that were
mostly *late*; that table was wrong and is void.

### Distribution and recipients

```
1830s 1123 ####################        1890s  625 ###########
1840s 2221 ########################################   1900s  657 ############
1850s 1230 ######################      1910s  623 ###########
1860s 1143 #####################       1920s  598 ###########
1870s  807 ###############             1930s  294 #####
1880s  772 ##############
```
Majors, firings each: RUS 150 · TUR 138 · USA 122 · SPA 118 · GBR 115 · BRZ 110 · AUS 108 · SIC 106 ·
POR 106 · PRU 91 · NET 81 · **FRA 44**. ⚠ FRA's outlier-low count is not a mechanism finding — that run's
France suffered a civil war with a **−94% population collapse at 1879** (report_data2 anomaly flags).

### What this says for the threshold rework

The thresholds are **employment in the predecessor tier** (5k/15k/45k/135k/405k by era). The pattern —
early tail, minor-country dominance, front-loading — is consistent with **small countries clearing a
low absolute bar on a handful of buildings**, long before the technology is plausible. That argues for
thresholds that scale with something relative (share of the country's own workforce, or of world output)
rather than an absolute head-count, and/or a hard **date floor** at the technology's onset.
⚠ **This finding does not test either remedy** — it characterises the fault only.

### What it does NOT say

- **Onset years are narrative, not mechanical.** A firing "before onset" is ahead of the real-world date,
  not necessarily ahead of anything the game enforces. It is the yardstick the complaint was raised in.
- **It says nothing about whether the technology was actually RESEARCHED early** — a completed
  journal entry grants half an era's research cost, it does not by itself unlock anything.
- **Timings are interpolated** from ~20-second tick lines; treat single-year precision as approximate.
- **n=2, one arm.** Given canon-n2's measured 2.1× spread on war firings, the industry channel's 2%
  run-to-run agreement suggests these counts are stable, but the *tail* dates rest on single events.

---

<!-- FINDINGS.md lines 8418–8477 at 5ab4fd1 -->
## F81 — THE +5%-MARGIN INVERSE BOOK IN-GAME: world GDP ×0.18 of vanilla by 1936 — zero-margin cost envelopes stall the investment loop

**Session** `20260824_114350_solver2-n2`, arm `{kind: config, config: config/mod_config.solver2.json}`
(sha `53CC8F13…724F0F`): the §10.65.2 inverse recipe book solved at **+5% dominant margin** on the
175−25pp×tier design ladder, plus `ai_value = 500+1000×(era+1)` (98/105 tiers). Game 1.13.11,
1836.1.1→1936.1.1, metrics identical to the F76 family and the F79 baseline. **Effective n=1**
(run001 complete, 100/100 yearly summaries; run002 killed mid-run by user ruling — L17-void).
Comparators: F79 vanilla n=18; canon-n7 (n=6, 1.13.10); aival2 (n=2, 1.13.11 — the same-ladder-family
arm whose difference from this one is essentially the recipe book).

### World GDP (run001 vs benchmarks)

| year | solver2 | vanilla med (n=18, min–max) | canon-n7 | aival2 | s2/van | s2/aival2 |
|---|---|---|---|---|---|---|
| 1840 | £370M | £445M (437–462) | £449M | £457M | 0.83× | 0.81× |
| 1850 | £423M | £577M (548–599) | £560M | £575M | 0.73× | 0.73× |
| 1860 | £468M | £725M (657–744) | £675M | £704M | 0.65× | 0.67× |
| 1870 | £519M | £864M (717–930) | £769M | £862M | 0.60× | 0.60× |
| 1880 | £564M | £1,056M (942–1,150) | £910M | £1,008M | 0.53× | 0.56× |
| 1890 | £582M | £1,351M (1,149–1,518) | £1,075M | £1,209M | 0.43× | 0.48× |
| 1900 | £634M | £1,725M (1,235–1,982) | £1,286M | £1,511M | 0.37× | 0.42× |
| 1910 | £697M | £2,142M (1,655–2,459) | £1,608M | £1,823M | 0.33× | 0.38× |
| 1920 | £724M | £2,815M (2,031–3,283) | £2,230M | £2,531M | 0.26× | 0.29× |
| 1930 | £778M | £3,827M (3,040–4,433) | £3,152M | £3,538M | 0.20× | 0.22× |
| 1936 | £802M | £4,551M (3,750–5,199) | £3,815M | £4,332M | **0.18×** | **0.19×** |

×2.2 growth over the century against vanilla's ×10; below the vanilla envelope from 1840 and
monotonically diverging; no recovery shape.

### The mechanism, measured (pooled GBR/USA/FRA/NET/BEL/PRU/GER)

| | 1850 | 1880 | 1910 |
|---|---|---|---|
| tiered profit, solver2 | £33k/wk | £38k/wk | £53k/wk |
| tiered profit, aival2 | £446k/wk | £1,500k/wk | £3,222k/wk |
| tiered LOSSES, solver2 | −£1k | −£3k | −£3k |
| investment pool, solver2 | £0.7M | £0.8M | £1.5M |
| investment pool, aival2 | £6.4M | £7.8M | £4.7M |
| tiered levels, solver2 | 1,121 | 1,382 | 1,413 |
| tiered levels, aival2 | 1,490 | 2,850 | 5,916 |

The buildings were **zero-margin, not insolvent** (losses trivial): recipes solved to +5% at design
prices of 150–175% have cost envelopes C = P/(1+m) ≈ 143–167% of base, above any price the live
market delivers, so realised margins sat at ~0 for a century, dividends never flowed, the pool never
filled, private construction never spun up (F78's loop as the binding channel). Consequence ruled the
same day: the dominant margin became a design AXIOM at +40% (`INV_MARGIN`, commit `1bb96f5` — envelopes
125/107/89/71/54/36), validated next as arm solver2b.

### What it does NOT say

- n=1; no within-arm variance. The GDP effect (5–36% of every comparator, monotone, mechanism
  measured) does not need it; nothing subtler from this session does without replication.
- The arm moved two levers (book + ai_value ladder); ONLY the GDP/margins channel has clean
  attribution (via aival2). **The tier-choice numbers from this arm are NOT admissible into the F76
  ladder table** — computed on starved construction (214 lower-tier levels over 5,022
  country-industry-years pre-adoption).
- It does not condemn the inverse ARCHITECTURE — the recipes' substance is the envelope row, and the
  architecture takes any envelope row (§10.65.2, the factorisation argument). It condemns C ≈ 143–167
  early, i.e. thin margins priced against a market that never materialises.

<!-- FINDINGS.md lines 8478–8524 at 5ab4fd1 -->
## F82 — THE MARGIN-AXIOM A/B: +5% → +40% on identical everything moved world GDP from ×0.18 to ×0.40 of vanilla, with a late-century inflection to vanilla-pace growth

**Arms:** solver2-n2 run001 (`20260824_114350`, the +5% inverse book) vs solver2b-n1 (`20260824_152005`,
the +40% book) — **structural diff exactly `tiers[].inputs` + `tiers[].target_be`** (the margin axiom's
consequences); ai_value ladder, config, patch (1.13.11), machine, day identical. n=1 each,
1836.1.1→1936.1.1, both L17-clean. Benchmarks: F79 vanilla n=18; aival2 (n=2).

### World GDP

| year | solver2b (+40%) | solver2 (+5%) | vanilla med | s2b/van | s2b/s2 |
|---|---|---|---|---|---|
| 1840 | £402M | £370M | £445M | 0.90× | 1.09× |
| 1860 | £522M | £468M | £725M | 0.72× | 1.12× |
| 1880 | £642M | £564M | £1,056M | 0.61× | 1.14× |
| 1900 | £779M | £634M | £1,725M | 0.45× | 1.23× |
| 1920 | £1,097M | £724M | £2,815M | 0.39× | 1.52× |
| 1930 | £1,472M | £778M | £3,827M | **0.38×** | 1.89× |
| 1936 | £1,842M | £802M | £4,551M | **0.40×** | **2.30×** |

×4.6 century growth vs ×2.2; **the vanilla ratio bottoms at 1930 and turns UP** — 1920→1936 growth
×1.68 vs vanilla's ×1.62. The book's back half (envelopes ≤ vanilla parity from t3, measured F81-style
at ×1.00/×0.76 vanilla input share at t3/t4) grows at vanilla pace once the economy reaches it.

### The mechanism (pooled GBR/USA/FRA/NET/BEL/PRU/GER)

| | 1850 | 1880 | 1910 | 1930 |
|---|---|---|---|---|
| tiered profit, solver2b | £233k/wk | £337k | £1,011k | £3,312k |
| tiered profit, solver2 (+5%) | £33k | £38k | £53k | — |
| tiered profit, aival2 | £446k | £1,500k | £3,222k | £7,607k |
| investment pool, solver2b | £2.8M | £1.2M | £4.7M | £24.3M |
| tiered levels, solver2b | 1,365 | 1,638 | 2,637 | 4,673 |
| tiered levels, aival2 | 1,490 | 2,850 | 5,916 | 9,648 |

The zero-margin signature (F81) is gone from 1850; the engine still starts ~60 years late vs the
canonical-book aival2 — early tiered profit half of aival2's — which is the t0/t1 rich-rung drag
(input share ×2.15/×1.54 vanilla, the −10% 1837 stock effect), i.e. the ladder TOP, not the margins.
Closed by §10.65.3 (vanilla-anchored ladder, envelopes 86/71/60/51/42/36) → validation arm solver2c.

### What it does NOT say

n=1 per arm — the GDP effect (×2 at century-end, monotone, mechanism measured) doesn't need more;
anything subtler does. Attribution is clean ONLY for the margin lever (s2→s2b); comparisons to
aival/vanilla still confound the whole book. Build-choice numbers remain inadmissible-with-caveats
(volumes still well under aival2's). The inflection is one run's shape; treat the "vanilla-pace late
growth" claim as provisional until solver2c replicates it from a better start.

<!-- FINDINGS.md lines 8525–8596 at 5ab4fd1 -->
## F83 — THE VANILLA-ANCHORED LADDER IN-GAME: vanilla-fidelity to 1890, then an OVERSHOOT to ×1.53 — and a century with ZERO tiered losses, so the ladder climbs by accumulation, not displacement

**Arm:** solver2c-n1 (`20260824_174224`) — the §10.65.3 book (price ladder 120/100/84/71/59/50,
+40% margins, envelopes be 86/71/60/51/42/36) + ai_value 500+1000×(tier+1), sha `0549AD08…D039FA`.
vs solver2b: **only `tiers[].inputs` + `target_be`** — the price-ladder axiom's one-lever A/B
(top 175/150 → 120/100, slope 25pp-linear → ×0.84). n=1, 1836.1.1→1936.1.1, L17-clean, 100/100
summaries. Benchmarks: F79 vanilla n=18, solver2b (F82), aival2.

### World GDP

| year | solver2c | vanilla med (min–max) | s2c/van | in env | s2b/van | aival2/van |
|---|---|---|---|---|---|---|
| 1840 | £430M | £445M (£437–462M) | 0.97× | no | 0.90× | 1.03× |
| 1850 | £547M | £577M (£548–599M) | 0.95× | no (−£1M) | 0.84× | 1.00× |
| 1860 | £666M | £725M (£657–744M) | 0.92× | YES | 0.72× | 0.97× |
| 1880 | £931M | £1,056M (£942–1,150M) | 0.88× | no (−£11M) | 0.61× | 0.95× |
| 1890 | £1,177M | £1,351M (£1,149–1,518M) | 0.87× | YES | 0.50× | 0.90× |
| 1900 | £1,692M | £1,725M (£1,235–1,982M) | 0.98× | YES | 0.45× | 0.88× |
| 1910 | £2,730M | £2,142M (£1,655–2,459M) | **1.27×** | no | 0.43× | 0.85× |
| 1920 | £4,293M | £2,815M (£2,031–3,283M) | **1.53×** | no | 0.39× | 0.90× |
| 1930 | £6,285M | £3,827M (£3,040–4,433M) | **1.64×** | no | 0.38× | 0.92× |
| 1936 | £6,952M | £4,551M (£3,750–5,199M) | **1.53×** | no | 0.40× | 0.95× |

In-envelope 40/100 years (all pre-1900). Century ×17.3 vs vanilla ×10.9. 1920→1936 growth ×1.62 =
vanilla's ×1.62 exactly — the overshoot accumulates 1890–1920 and then parallels. The anchor test
(pre-registered): 1837 −3.5% (predicted ~2%, narrow miss; s2b was −10%, s2 −16%), 1840 £7M under
the envelope floor, **inside the envelope every year 1841–1850** — the F81/F82 early-book stock
effect is closed.

### Mechanism (pooled GBR/USA/FRA/NET/BEL/PRU/GER)

| | 1850 | 1880 | 1910 | 1930 |
|---|---|---|---|---|
| tiered profit s2c | £391k/wk | £856k | £7,444k | £16,047k |
| tiered profit aival2 | £446k | £1,500k | £3,222k | £7,607k |
| tiered levels s2c / aival2 | 1,442/1,490 | 2,288/2,850 | 9,943/5,916 | 18,151/9,648 |
| investment pool s2c / aival2 | £22.6M/£6.4M | £5.4M/£7.8M | £183M/£4.7M | **£2,451M**/£102M |
| tiered VA share s2c | 36% | 53% | 79% | 80% |

A genuine construction boom (~2× aival2's physical scale by 1930) with the pool ending at 24×
aival2's — margins outran even a booming economy's absorptive capacity.

### ⭐ THE DESIGN FINDING: NOTHING DIES — accumulation, not displacement

Tiered losses ≈ £0 in every read, all century. Stale rungs keep GROWING beside the new ones
(1900→1930, world levels: sewing textile 284→936, pig-iron tooling 398→568, baking-powder food
210→531 — while mechanised food, electric-arc steel, highdraft textile, carbide tooling all adopt
on top). Prices explain it: **the consumer chains genuinely deflate in-game** (British market 1930,
% of base: clothes 62, furniture 42, fabric 55, groceries 82 — the mod's designed decline, live)
**but intermediates do not** (tools 102, iron 108, steel 84, paper 97 vs designed ~50–59), and
input/output prices CO-DEFLATE (fabric 55 under clothes 62), so an old rung's effective break-even
falls with its output price and only the 10–40% wage share differentiates rungs. The
relative-price squeeze the scenario solver engineers does not self-reproduce in the live game
under ×0.84 slope + 40% margins — §10.65.2's stale-profitable trade confirmed in-game at full
strength.

### Tier choice (F75/F76 family)

Below-best **39.8%** raw / 42.3% unit-weighted / 44.6% ex-ports — past aival2's 47.17%, best yet.
⚠ Confounded (book × the 500+1000×(tier+1) variant); volumes exceed aival2's, so admissible unlike
s2/s2b. First frontier building: below-frontier 86.6%→35.9%. Adoption lag median 0y, p75 4y;
30.6% of unlockable tiers never built.

### What it does NOT say

n=1 — GDP-shape claims (×1.5-scale, monotone, mechanism measured) stand; anything subtler does
not. GDP = 52×VA and a leaner book inflates VA per unit of activity — part of the late ratio is
bookkeeping, though the 2× level count says most is scale. Whether the ×1.5 overshoot is
acceptable against the "after 1836 only GDP stays near vanilla" premise, and whether
no-displacement demands a steeper late slope or lower late margins, are DESIGN RULINGS pending —
this finding measures, it does not decide.

<!-- FINDINGS.md lines 8597–8629 at 5ab4fd1 -->
## F84 — REALIZED PRICE PATHS, MOD vs VANILLA: the co-deflation that shields stale rungs is ENDOGENOUS to the lean late recipes; vanilla runs the OPPOSITE regime (input scarcity)

**Source:** market telemetry (British market, 12 pinned dump dates), solver2c-n1 vs the vanilla
n=18 baseline (per-good MEDIAN across the 16 n16 runs). % of base price:

| good | class | mod 1850/1880/1900/1930 | vanilla 1850/1880/1900/1930 |
|---|---|---|---|
| fabric | raw input | 84 · 69 · 58 · **55** | 70 · 79 · 93 · **96** |
| wood | raw input | 109 · 103 · 106 · 96 | 107 · 102 · 86 · 87 |
| iron | raw input | 137 · 102 · 103 · 108 | 142 · 103 · 94 · 100 |
| coal | raw input | 110 · 103 · 124 · 113 | 109 · 118 · 106 · 107 |
| tools | intermediate | 136 · 139 · 130 · **102** | 130 · 115 · 102 · 91 |
| steel | intermediate | 132 · 59 · 83 · 84 | 132 · 124 · 107 · 114 |
| paper | intermediate | 170 · 137 · 113 · 97 | 162 · 133 · 118 · 109 |
| engines | intermediate | 131 · 91 · 116 · 96 | 150 · 140 · 138 · 135 |
| clothes | final | 103 · 105 · 98 · **62** | 109 · 109 · 120 · **108** |
| furniture | final | 109 · 119 · 57 · **42** | 121 · 115 · 107 · 84 |
| groceries | final | 139 · 121 · 115 · 82 | 143 · 119 · 110 · 114 |

**The reading.** (1) **Vanilla is a near-base economy end to end** — finals at 84–114% in 1930,
intermediates 91–135 — and its raw inputs get SCARCER, not cheaper: fabric RISES 70→96 while
clothes hold ~108. The engine's natural regime squeezes input-heavy production. (2) **The mod
inverts that**: fabric crashes 84→55 UNDER clothes' 103→62 — the F83 co-deflation — and the cause
is our own book: later tiers eat far less raw input per unit of output, so raw demand lags supply
growth and the raw price falls WITH the output price instead of against it. The design's flat-100
raw premise is broken by the design's own leanness. (3) The mod's finals overshoot the design's
decline (clothes 62 vs designed ~59–71 band) while intermediates undershoot it (tools 102 vs
designed ~50–59) — consumer chains deflate hard, producer chains hold near base.

**What it does NOT say:** n=1 on the mod side; one market (Britain — the biggest); realized paths
under a build-cost fix will differ (less boom = more downward price pressure). The vanilla side is
n=16 medians and solid.

<!-- FINDINGS.md lines 8630–8685 at 5ab4fd1 -->
## F85 — THE GRANULAR PRICE SYSTEM IN-GAME (n=3): a U-shaped century landing ON vanilla at the median; displacement fails broadly because the designed death prices never realize — and succeeds exactly where they do

**Arm:** solver2d-n3 (`20260824_225259`) — the §10.65.5 book (measured vanilla anchors, per-industry
death-condition slopes, measured raw paths) + ai_value 500+1000×(tier+1), sha `1B4B21AB…967B13`.
vs solver2c: recipes + target_be only. n=3, 1836→1936, all L17-clean, 100/100 summaries each.

### World GDP (median of 3, ÷ vanilla n=18 median)

0.95× (1840) · 0.93× (1850) · 0.85× (1860) · 0.75× (1880) · **0.59× (1900)** · 0.73× (1920) ·
0.82× (1930) · **0.98× (1936, £4,448M)**. Per-run endpoints **0.98× / 1.19× / 0.71×** — two inside
the 0.8–1.25× band; the spread EXCEEDS the vanilla n=18 envelope's own width, so single-run GDP
endpoints in this family are ±20%-class noise. The mid-century dip bottoms 0.59–0.69× in all three
runs (replicated shape). Century growth ×11.2/×13.9/×8.0 vs vanilla ×10.9. solver2c at the same
dates: 0.98×/1.53×/1.53× (1900/1920/1936).

### ⭐⭐ The displacement result

- **Broadly FAILED**: stale rungs grow in every run (sewing textile 152→732/821/489 world levels
  1900→1935; pig-iron tooling →453/427/349; baking-powder food →517/523/350); tiered losses stay
  ~£0 (35–78 building types × trivial amounts); the t0 base tiers even grow slightly.
- **Cause, measured**: realized prices refuse the designed declines — 1930 British market: tools
  **119** realized vs **46** designed, clothes 82 vs 38, engines 89 vs 52, paper 107 vs 76. The
  economy undershoots all mid-century (0.59–0.75×), so scarcity is GENERAL: every sector is
  supply-short at once and every price holds far above its design.
- ⭐ **Where the price DID comply, the design worked exactly**: fabric tracked its measured-path
  premise (58 realized vs 55 designed), steel nearly (62 vs 57), and **furniture landed on its
  design to the point (49 = 49) — and its t0 rung FROZE AND DIED** (world 102→105→99 levels;
  pooled-7 2 levels at ~£0) precisely as the death validation designed, **while its t1 rung
  survived precisely as the validation's "+22% open miss" predicted** (202→515 levels, £108k/wk).
  The death arithmetic is correct; the prices it requires are what the live economy withholds.

### The two self-defeating price loops (the design-level finding)

solver2c (gentle ladder): strong margins → boom → inputs co-deflate with outputs → nothing dies —
**accumulation**. solver2d (steep granular ladder): scarcity-measured anchors (paper 158, groceries
156) price early recipes for a scarcity that normalizes → thin mid-century margins → slower capacity
growth → **general scarcity holds prices above the death levels** → nothing dies — stagnation, then
a late margin surge (lean late envelopes × still-high prices) back to vanilla. In both regimes the
realized price adjusts to keep the marginal standing producer viable: pop demand follows supply
(F31/F40 supply-share), buildings shed workers before posting deep losses, and free entry stops
where margins thin. **Price-driven displacement at scale is structurally resisted by the engine.**

### Secondary

Pool at 1935: £288M/£1,688M/£467M (solver2c £4,650M — the hoard shrank 3–16×). Tiered levels
9.0k/17.1k/8.7k (s2c 19.1k). Tier choice: below-best 44.2% raw / 41.0% ex-ports, less-efficient
31.7% — WORSE than solver2c's 39.8/27.9 (scarcity makes old rungs pay, and the AI buys them).

### What it does NOT say

The granular SYSTEM is not refuted — its calibration inputs (raw paths, anchors) were measured off
solver2c's boom regime and are now shown to be regime-dependent, itself a measured property of the
inverse-design approach. The early-half slide (0.85× by 1860, below solver2c's 0.92×) traces to the
scarcity-priced anchors — a fixable anchor choice, not the slopes. Whether displacement must come
from a non-price channel is a design ruling, not a measurement.

<!-- FINDINGS.md lines 8686–8741 at 5ab4fd1 -->
## F86 — THE §10.65.6 PACKAGE (n=3): the dip shallows, the endpoint lands on vanilla, the identity closes, and displacement becomes a FLOW phenomenon

**Arm:** solver2e-n3 (`20260825_095912`) — margin ladder m(e)=0.30+0.08e · anchor blend (measured
anchors t0/t1, re-base 100@t1 from t2) · payback-normalized cost book (10y own-tier design, ×1.1–1.4
median lift) · ai_value 750×1.8^tier. Sha `43BAAED0…1B4D86`. Package A/B vs solver2d (recipes,
target_be, ai_value, building_cost all move). n=3, 1836→1936, L17-clean, 100/100 each.

### World GDP (median of 3 ÷ vanilla n=18 median; per-run in brackets)

0.93× (1840) · 0.85× (1850) · 0.78× (1870) · **0.72× (1890 — the bottom)** · 0.74× (1900) ·
0.82× (1920) · **0.97× (1936)** [endpoints 0.90/1.26/0.97]. vs solver2d: dip bottom 0.72 vs 0.59
(SHALLOWER, earlier), endpoint 0.97 vs 0.98 (same), early half WORSE (0.85 vs 0.93 at 1850 — the
m(t0)=0.30 recipe-richness cost, predicted and measured live). ⚠ Run 1 alone read the dip DEEPER
than solver2d (0.61× at 1910) — mid-flight single-run shapes mislead; the median reversed it.

### ⭐ The §10.65.7 identity (medians)

| | 1840 | 1860 | 1880 | 1900 | 1920 | 1935 |
|---|---|---|---|---|---|---|
| workers ÷van | 0.97 | 0.87 | 0.77 | 0.67 | 0.61 | **0.68** |
| productivity ÷van | 0.96 | 0.95 | 1.01 | 1.10 | 1.34 | **1.42** |
| GDP ÷van | 0.93 | 0.83 | 0.78 | 0.74 | 0.82 | **0.96** |

At 1935 the ruled goals' derived requirement (productivity ≈ 1/workers ≈ 1.47×) is nearly met at
1.42× — the retained-peasantry + GDP-parity pair is jointly achievable, and the whole mid-century
dip is the identity's own arithmetic (0.67×1.10 ⇒ 0.74 at 1900).

### Displacement: the flow channel works, price-death stays rare

- Below-best construction **38.7%** raw / 36.1% unit-weighted / 36.3% ex-ports — the family's best
  (canon 52.6 → s2c 39.8 → s2d 44.2 → **38.7**); less-efficient cut 27.7%.
- Stale-rung growth roughly HALVED vs solver2d at HIGHER total building (sewing 325–416 end levels
  vs 732; baking-powder 175–391 vs 517; total tiered levels 9.8–12.4k vs ~9k) — the construction
  flow moved up-ladder (the exponential ai_value's doing; the sub-default t0 values froze the t0
  family: textile base ~150–177 flat, furniture base ~70–92, steel base 14–36).
- Price-death remains rare: pooled-7 losses £1–13k/wk at 1935 across 37–61 building types. The
  1870 three-way attribution (user-challenged): ONE textbook within-market displacement (PRU base
  steel −£8/lv beside bessemer +£1,016/lv), the other flagged losses industry-wide, not
  tier-competitive.

### The §10.65.7 goal readings (1935 medians)

Peasants: GBR **10.5%** (vanilla 1.0 — in the ruled 10–20% target) · USA 44.6% (31.4) · RUS 53.4%
(47.0) · NET **1.0%** (1.4 — ⚠ run 1's 22.5% was ONE SEED; the median fully depeasants, so
tall-major retention is seed-contingent outside GBR). SoL: GBR 25.2 (19.7) · USA 14.7 (14.9) ·
RUS 12.0 (10.7) · NET 20.8 (17.7) — unsuppressed; the tall-major premium is wage-driven (GBR base
wage ×2.24 vanilla at run-1 read) — the ruled watch item stands.

### What it does NOT say

Package arm — no lever-level attribution inside it. The pool GREW vs solver2d (£0.7–1.5B pooled-7:
the ×1.1–1.4 cost lift under-compensates margins at realized prices, as pre-stated). Endpoint
spread 0.90–1.26× — single-run GDP endpoints remain inadmissible. NET/small-tag social readings
are seed-dominated. Whether flow-displacement without price-death satisfies the design goal is a
ruling, not a measurement.

<!-- FINDINGS.md lines 8742–8783 at 5ab4fd1 -->
## F87 — THE INVESTMENT-HOARD LEVERS (n=3): six NAI defines cure the hoard-stagnation completely — and reveal that the §10.65.7 goal set was standing on the dam

**Arm:** solver2f-n3 (`20260825_204213`) — pool-pressure factor 0.75→0.9, wanted-construction
thresholds 1.05→1.5 / 0.75→0.9, private-queue cap 0.05→0.10, long-build maluses ×3 (120/180wk),
over a tier-book BYTE-IDENTICAL to solver2e (sha `1BE9B93F…D40F46`) — a clean one-lever-set A/B.
n=3, 1836→1936, L17-clean. Baselines: solver2e-n3 (F86), vanilla n=18 (F79).

### The levers work

| 1935 (medians) | solver2e | solver2f | vanilla |
|---|---|---|---|
| world investment pool ÷ GDP | 51% | **32%** | 31% |
| construction-sector levels | 1,959 | **3,477** | — |
| gross construction ÷ GDP (1920) | 11.1% | **15.7%** | 9.7% |
| uncompensated gov constr ÷ GDP | 3.0% | **2.4%** | 2.2% |
| USA peasant workforce Δ 1930–35 | −0.09…−3.0M | **−2.0/−5.2/−6.6M** | — |
| RUS peasant workforce Δ 1930–35 | ±0.0…−0.5M | **−0.6/−1.7/−4.1M** | — |

The pool ratio lands ON vanilla's; the state's own (post-IP-compensation) construction burden falls
while total construction booms — the pool now carries more of a bigger total. The early game
IMPROVED (0.89× of vanilla at 1850 vs solver2e's 0.85×). Expensive-frontier adds
(electrics+steel+automotive, 1920→35) ×1.7; below-best 39.0% ≈ unchanged.

### And the trade they reveal

World GDP 1936 median **1.33× of vanilla** (runs 1.06/1.33/1.53 — the G4 band broken upward,
solver2c's failure mode returning at ~85% strength); GBR peasants **0.4%** (below vanilla's 1.0),
USA **14.6%** (half of vanilla's 31.4) — **depeasanting became LIKELY, not possible**, breaking the
§10.65.7 ruling's first goal. SoL stays healthy (GBR 23.5, USA 16.1, RUS 12.6 vs vanilla
19.7/14.9/10.7) with the wage premium easing as labour turns abundant.
⇒ **solver2e's on-vanilla endpoint and retained peasantry were both partly FINANCED by the pool's
failure to spend.** The hoard was the dam; the goal set stood on it. The knobs interpolate between
solver2e (near end) and these values (far end) — a middle setting (~0.8 / ~1.2 / 0.075) is the
obvious probe if the middle of the pool–GDP–peasantry triangle is wanted.

### What it does NOT say

Package-of-six attribution only (which knob carries how much is unmeasured). Endpoint spread
1.06–1.53× — single-run endpoints inadmissible as ever. No pool anywhere drains in ABSOLUTE terms
even under the levers — growth outruns spending; only the ratio normalizes. Different-nights
vanilla baseline, same patch.

<!-- FINDINGS.md lines 8784–8810 at 5ab4fd1 -->
## F88 — GDP IS LINEAR IN STANDING ECONOMIC CAPITAL, WITH A NEAR-UNIVERSAL SLOPE: GDP_t ≈ a + b·K_t, b ≈ 0.29–0.34 across every arm INCLUDING vanilla

**Method:** K_t = Σ levels × construction cost × £720 over economic buildings (tiered from the arm's
book; extraction/agriculture/trade from vanilla's `required_construction`; state, military,
subsistence, urban centres, ownership excluded). OLS per run over the 100 yearly points, 1837–1936.
Sessions: solver2f n=3, solver2e r1, vanilla n16 r1–r2.

| arm | a (£M) | b (£GDP/yr per £K) | R² (levels) | R² (ΔGDP vs ΔK) |
|---|---|---|---|---|
| s2f r1/r2/r3 | 248/286/306 | 0.32/0.30/0.29 | 0.997/0.993/0.998 | 0.61/0.45/0.80 |
| s2e r1 | 199 | 0.34 | 0.992 | 0.73 |
| vanilla r1/r2 | 491/439 | 0.29/0.30 | 0.991/0.991 | 0.28/0.21 |

**Readings.** (1) The slope is ~arm-invariant: every £ of standing economic capital yields ~£0.30/yr
of GDP (gross capital-output ~3.1–3.4) regardless of recipe book, ai_values or the hoard levers —
arms differ in HOW MUCH K they deploy, not in what a unit produces (F87's dam finding as one
number). (2) Vanilla's intercept is ~£200M higher — it extracts more GDP from the capital-light
base (subsistence/urban/1836 stock). (3) ⭐ The first-difference check (which kills co-trending):
mod arms hold R² 0.45–0.80 — yearly GDP movement largely IS capital formation — while vanilla reads
0.21–0.28; the mod has made the economy far more literally "GDP = what you built" than the base
game. **Used predictively for the first time in solver2g** (t3 ×1.5 / t4–t5 ×2 costs: static
prediction 1.33× → 1.07× of vanilla at 1936; the arm is the model's test).

**What it does NOT say:** K is net standing stock (demolitions drop out), flat-£720 basis; the
levels-R² flatters any two monotone series (the Δ column is the honest one); b's invariance is
measured across THESE books — a radically different output-per-level design would move it.

<!-- FINDINGS.md lines 8811–8859 at 5ab4fd1 -->
## F89 — THE COST MULTIPLIERS (n=3): the linear-K law survives its first out-of-sample test per-run; the arm-level prediction fails through K-formation, not the law

**Arm:** solver2g-n3 (`20260826_080546`) — solver2f + t3 building_cost ×1.5, t4/t5 ×2 (58 tiers) +
long-build thresholds 240/360wk (sha `1868572A…AE5E11`; all else byte-identical). The first
quantitatively pre-registered arm: F88 predicted the 1936 median at 1.07× static / 1.1–1.2× with
claw-back. n=3, L17-clean.

### ⭐ The model test, per run (GDP from each world's OWN K, solver2f-valued; a=£280M, b=0.303)

| | 1900 actual/model | 1936 actual/model | 1936 ÷vanilla |
|---|---|---|---|
| run 1 | 0.97 | 1.18 | 1.08× |
| run 2 | 0.90 | **0.98** | 0.53× |
| run 3 | 0.91 | 1.02 | 0.76× |

**GDP = a + b·K held in every world** — most strikingly in run 2, the family's lowest-ever endpoint
(0.53× of vanilla), whose GDP is exactly what its own meagre capital predicts. The law is
structural. **The arm-level median (0.76×) missed the 1.07–1.2× band** because the auxiliary
assumption — "the same construction points get formed as in solver2f" — failed in runs 2–3.
Candidate causes, not separable at n=3: the multipliers suppressing point-formation via feedback
(dearer buildings → thinner queues → smaller construction sector → less K), and/or two low-roll
seeds (run 2: Russia £56M, no German unification; but two of three under the family's historical
floor leans feedback-real). No claw-back materialized.

### Goals (1935): the first arm holding peasantry AND pool simultaneously

GBR peasants **9.9%** median (5.6/15.3/9.9 — back in the ruled 10–20% band; s2f read 0.4%) at a
**31% pool ratio** (= vanilla; s2e needed 51% to hold its peasantry). Price: GDP 0.76× (below
band), workers ~0.59×, and a K-starved USA over-retaining (median 66% peasants — an artifact of
the weak seeds, not design). Paybacks at own-tier prices: several t4 rungs into/near the 8–15y
target (glass 9.1, fertilizer 8.9, steel 8.4, arms 8.4); food/tooling still short (2.9/4.7);
port/railway long (24/32).

### The triangle at three corners

s2e (0.97× · 10.5% · 51%) → s2f (1.41× · 0.4% · 32%) → s2g (0.76× · 9.9% · 31%): the cost
multipliers cancel the hoard levers' GDP effect while keeping the pool normalization and returning
the peasantry — the two lever sets are near-independent on the goals axis. Interpolation candidate
if GDP ~0.9–1.1× with GBR ~5–10% is wanted: costs ×1.25/×1.5.

### What it does NOT say

Which of the six-defines + cost-multiplier interactions drives the K-formation shortfall is open
(the next arm's question if pursued). Median claims only — the endpoint spread (0.53–1.08×) is the
family's widest. The thresholds rode along with the costs by ruling (two-knob delta).


---

<!-- FINDINGS.md lines 8860–8987 at 5ab4fd1 -->
## F90 — OBSOLESCENCE DEATH ARITHMETIC ON THE CANONICAL BOOK: designed vs FACTUAL price paths (derived analysis, 2026-08-26)

**Arm/basis:** derived analysis, no new runs. Recipes = the canonical config (= solver2f, §10.65.9).
Designed prices = the `mandate` book in `config/era_inverse.json` (pure design, anchor×slope,
plateau holds). Factual prices = median realized % of base pooled over EVERY mod run of the week
of 2026-08-24 (8 sessions solver2→solver2h, 16 runs with the relevant dumps, 7 instrumented
markets), read at each tier's calendar year: t0→1836.2, t1→1850, t2→1870, t3→1900, t4→1920+1930
pooled, t5→1935. Wages on the premise ramp (era_prices.json base_wage) at the evaluation tier;
throughput ×1.2; margin = (R − inputs − wages)/(inputs + wages). GBR scope = British Market rows,
excluding solver2-n2 r1/r2 (GBR dead: GDP £13M/£11M vs £309–860M elsewhere). t+3 for t2 rungs
evaluated only where the t5 tier exists at 1935 (steel/glass/tooling/art_academy — every other t5
tier is absent or negligible in nearly every run: research reaches t5 only at century end).
art_academy excluded throughout (jobs live in its ownership PMG → this wage read is 0, margins are
an artifact). Shipyard (clippers) excluded: extinct-by-placement.

### 1. The DESIGN book kills everything on schedule except port t1

Every ordinary t0–t2 rung is dead at its tier+2 design prices: t0 rungs at −22…−50%, t1 at −1…−51%,
t2 at −3…−28% (t2 deaths uniformly shallower — the ladder re-bases at 100 from t2 and the wage
ramp slows ×1.82→×1.46 per two tiers). Own-tier margins sit on the §10.65.6 ladder m(e)=0.30+0.08e
except where derivation clamps bound: compressed (steel t0 +1%, textile t0 +3%, shipyard_steam t1
+5%, railway t1 +13% — the 175 cap × dear measured raws) or inflated (furniture t1 +97%, food t2
+74% — lean-floor-pinned recipes that cannot be enriched down to target). Three cost classes do
the killing: raw-fed rungs die of output collapse against flat raws; manufactured-fed rungs are
sheltered by co-deflation and die of the wage ramp (hairline deaths furniture t1 −1%,
shipyard_steam t1 −2% carry wage shares 25–44% at death); **port t1 is the one OPEN survivor
(+11% at t3 design prices)** — steamers deflate faster than merchant_marine, a pure co-deflation
escape (masked in practice by the must_have subsidy mandate).

### 2. At FACTUAL prices, t0 is born dying and death arrives one tier late

Margin trios own → t+2 → t+3 (world scope | GBR scope):

```
rung             WORLD  own    +2    +3      GBR  own    +2    +3
food e0                  -5%   -9%  -19%          +23%   -7%  -18%
food e1                 +43%  +17%   -1%          +60%  +24%   -6%
food e2                +187% +104%    -          +209%  +95%    -
textile e0              -42%  -11%  -10%          -56%   +1%  -18%
textile e1              +79%  +79%  +43%          +99%  +66%  +20%
textile e2              +87%  +52%    -          +118%  +30%    -
furniture e0            -39%   -3%   -9%          -31%   -4%  -23%
furniture e1           +115%  +91%  +43%          +96%  +66%   +4%
furniture e2           +168%  +81%    -          +167%  +33%    -
glass e0                -48%  +13%  +34%           -4%  +23%  +27%
glass e1                +29%  +64%  +39%          +22%  +56%  +30%
glass e2               +105%  +82%  +64%         +115%  +72%  +56%
tooling e0              -25%  +17%   +8%          -21%   +9%   -4%
tooling e1              +79%  +70%  +39%          +72%  +60%  +21%
tooling e2             +171% +113%  +78%         +185%  +90%  +66%
paper e0                -32%  +27%  +12%           +3%  +17%   -5%
paper e1                +48%  +23%   -6%          +46%   +7%  -20%
paper e2               +252% +105%    -          +252%  +73%    -
fertilizer e1           +19%   -4%  -16%          +27%   -8%  -19%
fertilizer e2           +76%  +28%    -           +91%  +25%    -
explosives e1           +61%  +37%  +15%          +69%  +38%  +18%
explosives e2          +120%  +63%    -          +124%  +68%    -
steel e0                -39%  -27%  -41%          -56%  -40%  -47%
steel e2                +94%  +40%  +24%          +59%  +29%  +26%
motor e1                +37%  +29%   +2%          +43%  +22%   -2%
motor e2               +108%  +59%    -          +122%  +52%    -
shipyard_steam e1       +41%  +20%   +2%          +19%   +6%   -7%
shipyard_steam e2       +37%   +9%    -           +26%    0%    -
arms e0                 -20%  +10%  -17%          -21%  -11%  -33%
arms e1                 +88%  +31%   +5%          +79%  +10%   -1%
arms e2                 +97%  +30%    -           +74%  +23%    -
artillery e0            -39%  -13%  -26%          -44%  -20%  -42%
artillery e1            +46%  +15%  -19%          +49%  -10%  -25%
artillery e2            +81%  +19%    -           +82%  +14%    -
munition e1             +42%   -3%  -25%          +33%  -25%  -36%
munition e2            +146%  +31%    -          +124%  +11%    -
synthetics e2            -7%   -9%    -           -53%   -3%    -
electrics e2            +56%  +45%    -           +55%  +53%    -
port e0                 +25%   +7%  +16%          +17%  +26%  +16%
port e1                 +77%  +92%  +89%         +117% +106%  +55%
port e2                +107% +119%    -          +159%  +80%    -
railway e1              +17%   +5%   +1%          +14%   +1%   -5%
railway e2             +174% +112%    -          +170%  +97%    -
```

Key factual price paths (world medians, t0→t5): tools 122→158→154→142→119→106 · steel
112→126→115→92→81→76 · engines —→146→133→116→(89 at t4) · groceries 134→141→135→127→118→112 ·
wood 142→104→98→91→91→91 · coal 107→109→121→122→117→111 · iron 164→144→118→112→101→103.

**Readings.** (1) ⭐ **At factual prices, t0 rungs are born dying, not made obsolete** — nearly
every t0 rung is unprofitable at its OWN tier (1836's realized raws are dear: wood 142, iron 164,
fabric 129, hardwood 157) and several IMPROVE with age (glass t0 −48→+13→+34%, tooling t0
−25→+17%, paper t0 −32→+27%): the mid-century price hump (output prices rising to 1850–70 as
demand outruns capacity) rewards staleness exactly where the design wants the first deaths. The
design's monotone "profitable young, dead old" trajectory exists almost nowhere in the factual
data. (2) **Death arrives ~one tier late**: t+2 kills ~8 rungs (food/textile/furniture/steel/
artillery t0, fertilizer/munition t1, synthetics t2); t+3 roughly doubles the list (food/paper/
artillery t1 world; + motor/shipyard_steam/railway/arms t1 in GBR). The designed two-tiers-stale
death is factually a three-tiers-stale death — consistent with the 1935 snapshot (20/45 rungs dead
at pooled 1935 prices; no t2 rung dead except synthetics, food t2 +73% three tiers stale).
(3) **GBR kills harder and earlier than the world median** (munition t1 at t+2: −25% GBR vs −3%
world; artillery t1 −10% vs +15%) — the frontier market deflates manufactured goods (steel 73,
tools 103, engines 80 by t+3) while the world median holds them up. Emergent obsolescence works
where the technology is; the laggard-market median is where old capacity shelters. (4) **The
war chain dies best** (output deflation against hardwood/lead staying high); the never-dies set
at factual prices: glass (all rungs), tooling t1/t2, textile t1/t2, food t2, paper t2, explosives
(worst +15%), electrics, port (worst +7% before subsidy), railway t2 — every t2 rung outside
synthetics, whose own later tiers deflated dye (the one industry where the designed mechanism
fully fired).

### 3. The recipe book is pinned from both sides — composition has no degrees of freedom left

Lean-room census (O:I value at base prices vs the 4:1 lean floor): **37 of 58 t3+ tiers at the
floor** (O:I > 3.8); median remaining lean-room ×1.20 at t3, ×1.00 at t4/t5. Rich outliers with
real headroom: power t3/t4 (1.7/2.6), shipyard_steam t3–t5 (1.8–2.3), synthetics t3/t4 (2.3/2.7),
automotive t3 (2.1). §10.50 ratchet census: 83 adjacent pairs, **0 violations, 1 rounding
hairliner** (art_academy t3→t4, 4.007→3.986, −0.5%) — the inverse solve enforces the strong form
by construction (`monoCapInfo` in era_inverse.mjs). Leaning mid/late recipes further to steepen
price ladders is therefore not available without raising the 4:1 cap, and its obsolescence effect
is two-edged regardless (leaner late tiers cut input demand → F84 co-deflation shelters the rung
below).

### What it does NOT say

The factual price vectors are cross-arm pooled medians over a family of DIFFERENT recipe/cost
books (solver2→2h) — arm-specific death timing may differ (canon-arms-only margins agree in sign
almost everywhere at 1935, checked). Wages are the premise ramp, not each run's realized wages;
margins assume full employment, no subsidies, no throughput beyond the flat ×1.2. The world scope
is the 7-market median, not a GDP-weighted world. Nothing here measures WHEN within a tier a rung
crosses zero, only the tier-anchored snapshots. The t+3 skip rule means most t2 rungs' three-tier
verdicts are unmeasurable this century by construction (no t5 capacity exists to price them
against).

<!-- FINDINGS.md lines 8988–9080 at 5ab4fd1 -->
## F91 — THE BAND BUDGET: the six-rung ladder is over it, and that is why its own margin ladder INVERTS at t4/t5 (derived analysis, 2026-08-29)

**Arm/basis:** derived analysis, no new runs. Two independent reads. (a) The **shipped** book —
recipe caps and realised own-tier margins straight out of `config/era_inverse.json`, i.e. the
canonical solver2f config (§10.65.9). (b) A **band-budget model** written for this question
(scratch, not committed): the §10.65.5 death condition `r_o² ≤ κ·[(1−w)r_i² + w·g_w]/(1+m)` solved
for the required per-rung slope at rung counts 6/5/4/3 and death horizons of 1 and 2 rungs, holding
each tier's shipped input MIX and wage share, respreading the output ladder (×1.5^(5/(N−1))), the
wage ramp and the measured raw price paths over the new rung count. (c) A confirmation arm: the
four-rung ladder actually built and solved (§10.66, `config/era_inverse.tier4.json`).

### 1. The engine's price band sets a MINIMUM slope, and it depends only on the rung count

Obsolescence is bought with per-rung output-price slope, and every rung of slope compounds. Rebased
at the 1836 anchor, the last rung must clear the 25% floor:

| rungs | steps rung1→last | min slope @ floor 25 | @ non-pinned 35 |
|---|---|---|---|
| 6 | 4 | **0.707** | 0.769 |
| 5 | 3 | 0.630 | 0.705 |
| 4 | 2 | 0.500 | 0.592 |
| 3 | 1 | 0.250 | 0.350 |

⭐ **0.707 is `SLOPE_MIN = 0.70` in `era_inverse.mjs`.** The clamp the solver already ships is this
band floor showing up in the code — it was tuned, not derived, and it landed on the arithmetic.
Three goods sit on it (engines, electricity, transportation), i.e. their death condition is unmet.

### 2. The shipped book pays for it by clamping a third of its recipes, and the margin ladder inverts

Counted directly off the artifact's own `cap` field, 105 tiers:

```
      designed   realised median   lean-floor or insolvent-at-target
 e0     +30%          +30%                 0/11
 e1     +38%          +38%                 0/17
 e2     +46%          +46%                 1/19
 e3     +54%          +54%                 6/21
 e4     +62%          +42%                16/21
 e5     +70%          +25%                13/16
```

**36 of 105 tiers (34%) are clamped, 30 of them at t4/t5.** The design asks for an output price so
low that no recipe legal under `MFG_IO_CAP = 4` earns the margin at it, so the frontier rungs earn
**+42% and +25% against mid-rungs at +46%**. A frontier rung cannot displace a rung that out-earns
it. This is the mechanism behind "the obsolescence is too weak", and it is arithmetic, not tuning.

### 3. A one-rung death rule is arithmetically impossible above four rungs

Required slope vs the band floor, per good, model (b):

| death horizon | N=6 | N=5 | N=4 | N=3 |
|---|---|---|---|---|
| **2 rungs** (the standing rule) | 14/22 with headroom · 7 pinned · **1 impossible** | 21/22 · 1 · 0 | **22/22** · 0 · 0 | 22/22 · 0 · 0 |
| **1 rung** | 1/22 · 0 · **21 impossible** | 1/22 · 3 · 18 | 10/22 · 10 · 2 | **22/22** · 0 · 0 |

At the shipped margin ladder (0.30→0.70). Flattening it to 0.30→0.50 at N=4/H=1 takes the
lean-clamped rungs from 18 to 5 — **a fat top margin is self-defeating**, because it raises the bar
the price decline has to clear.

⚠ **Reducing the per-INDUSTRY tier count buys nothing on its own.** The compounding runs over the
number of tiers in the price path, so the TIER count is the lever.

### 4. Confirmed by building it (§10.66, both arms converged at INV_ITERS=1500)

|  | four rungs | six rungs (canon, same solver, same budget) |
|---|---|---|
| tier buildings | 70 | 105 |
| recipes earning their designed margin | 50/70 (71%) | 66/105 (63%) |
| recipes clamped | 16/70 (23%) | 35/105 (33%) |
| superseded rungs dead two tiers on | 29/32 (91%) | 53/66 (80%) |
| slope clamps | 2 (1 at the floor) | 3, all at the floor |
| analytic illogicality | 9 | 17 |

The four-rung tier-2 (1905) ladder reads frontier +48…+57% / one stale −25…+16% / **two stale
−12…−58%, dead in all 19 industries** — the shape the design has always described and the six-rung
book does not produce.

### What it does NOT say

- **It is not a measurement of the game.** Every number here is the model's own; no run was made.
  Whether a shorter ladder changes what the AI builds, or how fast prices actually fall in a live
  campaign, is untested and is a separate question from feasibility on paper.
- **It does not say four is optimal.** Four is what the standing *current−2* rule needs to fit
  inside the band with headroom to spare; three is what a *current−1* rule would need. Both are
  feasible; which is wanted is a design choice, and the cost of four is that only 2 of 4 rungs get a
  two-rung death horizon inside the campaign (against 4 of 6 today).
- **It does not touch the two named residuals.** Textile and furniture stay stale-profitable at any
  rung count because clothes and furniture are pop-bought and a pop budget is not mandatable
  (§10.65); transportation stays un-killable because railway's inputs deflate at its own rate
  (§10.47.1). Neither is a rung-count problem.
- **The 4:1 lean cap is OUR invariant, not the engine's.** Part of the clamping in §2 would relax if
  it were loosened — that is an untaken option, not a fact about Victoria 3.

<!-- FINDINGS.md lines 9146–9307 at 5ab4fd1 -->
## F93 — The JE cut works and barely moves research; the cost ladder buys obsolescence on paper and loses it in fact

**Session** `20260829_152435_tier4-n1` · arm `{kind: config, config: config/mod_config.tier4.json}`
(the four-rung ladder, §10.66–10.67) · 1836→1936 · **n=1 by ruling** · reached 1936.1.1, 0 resumes,
0 quarantined saves, 100 summaries, 2h40.
**Compared against** `20260825_204213_solver2f-n3` (canonical six-rung, n=3) and
`20260821_131149_vanilla-baseline-n16` (n=16, save_summary_version 8 — the first vanilla baseline
carrying `va_out`, so the vanilla productivity denominator is answerable at all).
⚠ Different nights: ratios travel, absolutes do not.

### 1. The journal entries were made ~4× less productive, as designed

`PMR_JE|` counts from `debug.log`. tier4 runs six stages at `grant_fraction` 0.25 and workforce
thresholds 30k/120k/480k; solver2f runs three at 0.5 and 15k/45k/135k/405k.

| | tier4 | solver2f (mean of 3) | ratio |
|---|---|---|---|
| chains started (inception) | 994 | 2,324 | 0.43× |
| chains completed (final stage) | **97** | **839** | **0.116×** |
| total firings | 2,788 | 4,972 | 0.561× |
| completion rate | **9.8%** | **36.1%** | — |
| research subsidy delivered (firings × grant_fraction) | 697 | 2,486 | **0.28×** |

Both halves bit independently: the ×4 thresholds cut chains *started*, the six stages cut the
fraction that *finish*.

### 2. …and vanilla-tree research did not move

**A raw technology count is not comparable across arms** — the pools differ (tier4 adds 9
technologies, solver2f 42, vanilla 0). On the common denominator (vanilla's own **178** technologies,
read live from `common/technology/technologies/*.txt`), advanced majors hold:

| | tier4 | solver2f | vanilla |
|---|---|---|---|
| vanilla technologies held (majors) | **149.9** | 150.6 | 145.3 |
| ÷ solver2f | **0.995** | — | 0.965 |
| added technologies held (majors) | 4.7 of 9 | 27.8 of 42 | — |

Cutting the research subsidy by 72% changed vanilla-tree research by **half a percent**. The entire
raw-count gap (154.6 vs 178.4) is our own added technologies.
⚠ **Two paths cancel and are not separable at n=1**: tier4 has a 36% smaller economy (less research
funding) but only 9 added technologies competing for the budget instead of 42. Do NOT read 0.995 as
"the JE subsidy does not matter".
⚠ ~1.0 technology per country falls outside the parsed vanilla set in **every** arm, so the
added-tech column is uniformly inflated by ~1; the true shares are ~41% vs ~64%.

### 3. Below-best build share got WORSE — against a confound pushing the other way

⚠⚠ **THIS SECTION IS VOID — SEE F96.** The figures below counted vanilla ports as our tiers. The
corrected numbers are 32.0% (margins) and 34.7% (flat) against solver2f 39.0%, i.e. BETTER, not worse.

Pre-registered prediction: it improves, with the stated confound that four rungs give mechanically
fewer rungs to build below.

| | below-best share | excl. ports |
|---|---|---|
| tier4 | **52.7%** | 48.8% |
| solver2f | **39.0%** (runs 38.09/38.84/39.92, sd 0.75pp) | 36.2% |

**+13.7pp, ~18σ outside the canonical arm's own noise.** The structural confound should have lowered
it for free; it rose anyway, so the result is stronger than the metric alone. 72.7% of the fault is
exactly one tier behind.

### 4. The mechanism — more builders, fewer buildings

| world | 1840 | 1860 | 1880 | 1900 | 1920 | 1936 |
|---|---|---|---|---|---|---|
| tier4 GDP | 440M | 658M | 808M | 1,156M | 2,000M | **3,815M** |
| vanilla GDP | 446M | 716M | 1,034M | 1,668M | 2,789M | **4,490M** |
| solver2f GDP | 411M | 583M | 810M | 1,272M | 2,997M | **5,962M** |
| tier4 peasant % | 76.1 | 66.9 | 63.6 | 59.6 | 53.5 | **44.7** |
| vanilla peasant % | 75.8 | 66.5 | 60.1 | 51.3 | 40.3 | **29.7** |

**Divergence begins 1875–1880 — exactly when rung 1 unlocks and the first ×1.4 cost step binds.**
Rungs sit at 1836/1875/1905/1940 at costs ×1.0/1.4/1.96/2.74.

The signature, on the clean comparison (tier4 and vanilla both run vanilla ports, so neither level
count is inflated by the graded-port factor):

> **tier4 ends with 1.28× vanilla's construction capacity and 0.81× its buildings** —
> 68.6 standing levels per construction level against 108.1, **0.63×**.

Construction capacity was never the constraint; each building cost more, so the same effort bought
fewer, so fewer jobs existed. Advanced-group peasants finish at **37.0%** against vanilla's 17.7%
and solver2f's 12.0%; the G5 productive share of the workforce is **52.61%** against 74.29% and
84.46%; GDP per productive worker £26.5 / £19.8 / £32.1; tiered share of the workforce **10.21%**,
*below* vanilla's 12.31%.

This also explains §3: **an AI that cannot afford the frontier buys the cheap obsolete rung.**

### What this does NOT say

- **No single-dial attribution.** SIX changes shipped together (four rungs, 18 industries not 22,
  four industries handed to vanilla, flat 26% margin, cost ×1.4^tier, 9-technology tree). The cost
  ladder is the leading suspect for §4 on the date match and the builders/buildings signature —
  that is a mechanism with evidence, not an isolated result.
- **n=1.** No median or arm-separation claims. Only §3's gap (13.7pp vs 0.75pp sd) sits comfortably
  outside the ~20% single-seed GDP spread.
- **It does not say four rungs is wrong** — it says THIS four-rung configuration underbuilds. §1–2
  are clean and would survive a cost-ladder revert.
- **Nothing on performance**: 2h40 raw is not a verdict, and tier4 ends at 0.75× solver2f's live pop
  objects, so the pop-matched bins may not overlap enough to answer it.

### 5. Addendum — the AI defines DID reach this arm, and they cut in our favour

Checked after the fact (user question, same evening). `config/mod_config.tier4.json` carries all
**six** `ai_defines` verbatim — `make_tier4_config.mjs` never mentions the block, so it rides along
with the config — and the built mod emitted the full `NAI` block. Both long-build-time thresholds
are present:

| define | vanilla | ours | effect |
|---|---|---|---|
| `PRODUCTION_BUILDING_LONG_CONSTRUCTION_TIME_THRESHOLD` | 40 wk | **120 wk** | score ×0.5 past it |
| `PRODUCTION_BUILDING_VERY_LONG_CONSTRUCTION_TIME_THRESHOLD` | 60 wk | **180 wk** | score ×0.25 past it |

**Units are weeks, and the raise is a RELAXATION**: the two `..._MULT` values (0.5 / 0.25) are left
at vanilla, so tripling the thresholds keeps an expensive building *out* of the penalty band.

Three consequences for §3–§4 above:

1. **Not a tier4-vs-solver2f confound.** Both arms carry the identical six defines, so the
   below-best and underbuilding gaps between them are not explained by these.
2. **It strengthens the cost-ladder attribution against vanilla.** Vanilla has none of the six, and
   they push toward *more* construction — solver2f carries them and built 280k levels against
   vanilla's 230k. tier4 underbuilt to 187k **despite** holding them.
3. ⭐ **But the malus is differentially LIVE in tier4, on identical thresholds.** With the flat
   vanilla cost book, solver2f's buildings sit far below 120 weeks and never approach the band. With
   costs up to **1.4³ = 2.744×**, tier4's frontier rung approaches it. So the newest rung can take a
   step-function **×0.5, then ×0.25** cut to its AI score that the rung below does not — a much
   sharper account of "72.7% of the fault is exactly one tier behind" than diffuse affordability.
   ⚠ **Hypothesis, not a measured result.** The threshold is construction time *at full
   construction-industry usage*, so it binds on countries with small construction sectors rather
   than on cost alone. The test is whether the below-best fault concentrates in low-construction-
   capacity countries; not run.
   ⚠ The ×3 threshold raise nearly exactly covers the ×2.744 cost ladder **by coincidence** — k was
   chosen on payback grounds and the thresholds for the investment-hoard levers, on different days
   and for unrelated reasons. Do not read them as a designed pair.


### 6. Addendum — a SECOND confound, found the same evening: ai_value was rung-keyed, not tier-keyed

`make_tier4_config.mjs` set `ai_value` from the rung index rather than the absolute tier, so tier 2
carried three different values (750 / 1998 / 5321, a **7.1× spread**) where the canonical book
carries exactly one per tier. The industries whose ladders start late took a malus nobody designed:
**automotive and power 7.1× too low, synthetics and electrics 2.66× too low** — the whole new
economy. Their workers came back at **0.14× / 0.34× / 0.06× / 0.54×** of the canonical arm against
0.38–1.27× for the t0-starting industries: four of the five worst-shrunk. See BUGS_AND_FIXES
2026-08-29. Fixed in the generator; the config and artifact corrected in place (10 tiers, exact —
`ai_value` never enters the solve).

**What it changes above:**
- **§1–2 (the JE result) stand unaffected** — `ai_value` has no path to research.
- **§4 now has TWO candidate causes**, the cost ladder and this defect, and they are not separable
  in this run. The new-economy collapse is much better explained by the malus than by cost.
- **§3 is NOT obviously explained by it.** Within an industry the rung ladder stayed monotone and
  *steeper* than canonical (×2.66 vs ×1.8), so the incentive to climb was intact or stronger. The
  defect shifts *composition* (four industries barely built, so the below-best denominator is
  dominated by t0-starters) rather than the within-industry choice. Unseparable at n=1.
- ⚠ **The recommendation in the verdict is superseded.** Re-run with the ai_value fix BEFORE judging
  the cost ladder: one is an outright bug, the other a design choice, and the bug should not be
  charged to the design.

<!-- FINDINGS.md lines 9371–9418 at 5ab4fd1 -->
## F95 — The lean floor and the price decline compete for the same headroom (and the 1:6 ruling)

**Measured 2026-08-30**, on the four-rung book, while fitting the rising margin ladder
(0.26/0.41/0.55/0.70).

### The arithmetic

`MFG_IO_CAP` is a floor on INPUTS expressed as a ceiling on the output:input VALUE ratio, **both at
BASE prices** (`Ibase >= Obase / CAP`, applied LAST in `solveInputsAt` so it overrides the ratchet
and the solvency clamp). But the margin TARGET is met at DESIGN prices. At `wage_pct` 0.25 the two
meet as:

> **max expressible margin = 0.75 x CAP x (p_out / p_in) - 1**

| designed p_out (inputs at base) | max margin at 1:4 | at 1:6 |
|---|---|---|
| 0.68 | 104% | 206% |
| 0.55 | 65% | 148% |
| 0.48 | **44%** | 116% |
| 0.40 | 20% | 80% |
| 0.25 | -25% | 13% |

**A tier designed for a low output price cannot reach a high margin however lean its recipe.** The
steeper the mandated price decline, the lower the margin ceiling at the frontier — the two levers
draw on one budget, and roughly linearly: ~10pp off the designed output price costs ~30pp of
expressible margin at 1:4.

### What it did in practice

At 1:4 the 0.70 t3 target **pinned 10 of 18 tiers at the floor**, median realised margin **44%**, i.e.
BELOW t2's 55% — an inverted top rung, with `food` at -1% and `art_academy` at 0%. ⚠ It passed my
verification because the MEDIAN across the 18 was 70%: the distribution is bimodal and the median hid
it. **Check the spread, not the central value, when a clamp may be active.**

At 1:6: pinned tiers **10 -> 5**, on-target tiers **8 -> 13**. Median O:I by rung 1.50 / 2.11 / 2.83 /
4.26. Three remain short — `art_academy` 33%, `electrics` 33%, `food` -7% — and those are
**price-limited, not floor-limited**: their designed output prices are 0.25-0.40 of base, so the
ceiling binds before the floor does. Raising the cap further would not fix them; only the price book
would.

### The ruling (user, 2026-08-30)

**1:6 at base prices is ACCEPTED**, on the explicit ground that *base prices are not expected to be
the norm for higher tiers* — so a 6:1 base-price ratio is not a realism claim about the running
economy, and is not a narrative problem. Knob: `INV_IO_CAP`, default 4, so nothing changes without
it. ⚠ The realism cost is still real and should be watched: the capped tiers turn ~GBP 600 of inputs
into ~GBP 3,600 of output at base prices.

<!-- FINDINGS.md lines 9419–9455 at 5ab4fd1 -->
## F96 — ⚠ RETRACTION: the four-rung "below-best got worse" result was an artifact

**F93 §3 is VOID.** It reported below-best build share rising to 52.7% against solver2f's 39.0% and
called prediction 3 failed "in the direction that matters". That comparison was invalid.

**The defect.** `analyse_ai_tier_choice.mjs` built its tier map from **all** config industries,
including `disabled` ones. A disabled industry's rung 0 KEY IS THE VANILLA BUILDING KEY, so every
vanilla port in the save was counted as one of our tiers — carrying the canonical book's
`workforce_mult` of 0.1. On any arm that hands an industry back to vanilla this inflates the
below-best denominator with buildings the arm does not tier at all. The four-rung arms hand back
port, shipyard, shipyard_steam, railway and power.

**The tell was visible and I read past it**: "raw 52.7% · unit-weighted 49.8% · excluding ports 49.4%"
on a book where **every live tier has `workforce_mult = 1` and there are no tiered ports**. Those
three numbers cannot legitimately differ there. The user spotted it — *"unclear how ports change
anything, since this version doesn't tier them"*.

**Corrected figures** (disabled industries now skipped; all three measures agree per arm):

| arm | as reported | corrected |
|---|---|---|
| tier4 margins n=1 | 52.5% | **32.0%** |
| tier4 flat n=3 | 55.0% | **34.7%** |
| tier4 vanilla-ladder n=4 | 52.7% | **37.8%** |
| solver2f n=3 (canonical) | 39.0% | **39.0%** — unaffected, it has real tiered ports |

**What this reverses.** Every four-rung arm is BETTER than the canonical six-rung book on build
choice, not worse. The margins arm at 32.0% is the best figure the project has recorded. F93's
"prediction 3 failed" and every downstream statement resting on it — including the reasoning that
recipe-side levers move the build mix by ~1pp — must be re-read against these numbers.

⚠ **What is NOT retracted**: F93 §1–2 (the JE result) and §4 (the trajectory) do not route through
this metric and stand. F94 (prices do not fall) is untouched.

**Fixed** in `analyse_ai_tier_choice.mjs` with a comment naming the mechanism. ⚠ Any other ledger
tool that maps tier keys must skip disabled industries for the same reason.

<!-- FINDINGS.md lines 17574–17631 at 5ab4fd1 -->
## F170 — THE REDESIGNED DAMS OVER A CENTURY (n=1): overlord financing works at real dates for five countries and every financed level stays the financier's; nothing is privatised; but the OWNER QUEUE stalls for a decade or more in countries with little government construction

**Arm.** config/mod_config.canon-dams.json at commit 81d13d5 (the BALANCE_FRAMEWORK 10.89.9 redesign on the canon + the power plant at
1,600 points), session 20260926_195231_canon-dams-v2-n1, one run 1836.1.1 -> 1936.1.1, reached, no crash. Compared with the stage-design
run 20260926_154538_canon-dams-n1 (n=1) and the canon n=3 (20260926_002930). DIRECTIONAL (n=1).

**Economy (the register, vanilla n=16).** Intact; world GDP 0.98 (the stage run 1.02); loss 6.8 (the stage run 3.7; the canon's intact seeds
4.3 / 11.9), carried by T0 (1935 / the 1900s 1.43, beyond the soft line; the stage run 0.22, the canon 0.43), PI 0.97 (not falling every
decade) and T3 0.40. Pool W 0.79, U* 39.3% (1.85x), H 0.57, GDP 1.22, PP 0.70. Britain U* 35.5 / 25.6 / 12.6% at 1926 / 1931 / 1936, hoard
0.13 / 0.14 / 0.23. Which of the dams or the seed moved T0 is not separable at n=1.

**Dams.**
| year | levels standing | dam electricity / world electricity (per week) | power-plant levels |
|---|---|---|---|
| 1900 | 5 | 1,650 / 2,707 (61%) | 29 |
| 1910 | 20 | 5,361 / 8,138 (66%) | 73 |
| 1920 | 45 | 11,467 / 17,977 (64%) | 161 |
| 1930 | 72 | 19,377 / 34,396 (56%) | 316 |
| 1935 | 90 | 23,122 / 44,523 (52%) | 432 |
79 projects surveyed (first the USA, 1878), 49 complete. The stage run: 81 stages, 54,280 electricity on 566 plants at 1935.
Electricity prices: never at 175% in a major (the highest the Dutch market at 1.68 in 1930); Russia's at the 25% floor from 1920, its dams
selling 2,879-3,550 a week against 867-1,436 bought.

**1. Overlord financing at real technology dates, by five countries** (log + the melted 1936 save): Britain 9 levels completed (Canada:
Laurentian x2, Nechako-Kootenay x2; Australia: Derwent x2, Upper Murray, Waitaki; Ceylon: Laxapana), Sweden 7 (Norway: Western Fjords x4,
Glommen x2, Aura-Nordland), Austria 4 (Greece: Achelous x2; Moldova: Bistritza; Hungary: Lower Drave), Russia 4 (Finland: Imatra;
Travancore x2; Carnatic: Nilgiri), Spain 1 (Siak: Asahan-Toba). In the 1936 save every one of those levels is owned by its financier.

**2. Ownership.** 74 dam buildings in the 1936 save; every level owned by a COUNTRY (the host's government or the financier), none by a
financial district or company, none flagged for privatisation (the USA and France included, whatever their laws).

**3. ⚠ DEFECT — the owner queue stalls.** A level the driver queues for the state owner is built by that country's government construction,
and the driver gives every country at least one slot whatever that capacity is. Measured points left on the level in the government
queue: Japan Shinano-Kurobe 7,205 (1890) -> 3,520 (1900), then a second level ~7,700 (1910) -> 7,358 (1920) -> 2,481 (1929), i.e. 18 and
~19 years a level; Sardinia Maurienne-Tarentaise 3,956 (1910) -> 4,094 (1920) -> 3,628 (1929); East Africa Kafue 7,611 (1929) -> 7,608
(1935); Argentina Iguazu started 1927, 1932 and 1934, nothing built. At 1935 sixteen dam items sit in government queues; Japan's
government queue speed read 0 at 1936. This is the "dropped or stalled" waste the user ruled out, in the owner path — the p6 subject case
was the same mechanism.

**4. A financing lost part-way.** Britain started financing Kafue (East Africa) in 1917 and no completion follows: the journal entry was
invalidated when the chain changed, and the instalments already paid are lost.

**Watch item (not a dam effect).** Qing leads world GDP 1900-1922 (324M at 1922, GDP per capita 0.767, literacy 0.445). Across 22 vanilla
and 129 mod runs, Qing leads at 1922 in 3 of 16 vanilla seeds and 10 of 129 mod runs; its per-capita GDP is inside vanilla's range
(median 0.602, max 0.875; the mod median 0.510) and its literacy too (vanilla max 0.489); Britain was weak at 1922 (256M against the canon's
483-595M). No Qing dam activity; nothing in the dam book reaches a Chinese state.

**Wall clock: VOID** — external machine load 1865-1895 (play and the harvester's melts slowed ~3x and recovered at the same wall-clock
moment on a world the size of the comparison runs).
⚠⚠ **CORRECTED 2026-10-06: the melt evidence was circular and the VOID is unsupported.** The "melt time" was a summary's file time minus
its save's archive stamp, and in watch mode the harvester waits for the NEXT save before summarising one, so that gap is the game's own
wall time per in-game year. The run's own harvest.log puts the real melts at ~4.6 s a save over the slow stretch (21:00–22:00, in-game
1878–1892) against ~10 s around it, i.e. the machine was not slower. RULED the same day: this wall clock COUNTS (a slowdown stays in
the record unless a machine-wide one is shown); read factorised it is a slowdown episode 1866–1896, peak 3.15×, +58 min.

**What it does NOT say.** Anything beyond direction at n=1; whether the loss difference to the stage run is the redesign or the seed; the
design's performance cost.

<!-- FINDINGS.md lines 17632–17665 at 5ab4fd1 -->
## F171 — THE DAMS WITH THE OWNER CAPACITY GATE, n=3: two intact runs at world GDP 1.03 / 0.94 (consensus loss 5.97), one pre-dam stuck Britain; the gate halves the waiting dam items, and what still stalls comes from events after the queue

**Arm.** config/mod_config.canon-dams.json at commit 4a0fcbe (the BALANCE_FRAMEWORK 10.89.9 redesign + the owner capacity gate: owner
levels only at GDP >= 4,000 x the level's points, construction unpaused, government queue draining within 520 weeks; the same GDP floor on
AI surveys of own sites), session 20260927_001731_canon-dams-v3-n3, three runs 1836.1.1 -> 1936.1.1, all reached, one attempt each.
Compared with the ungated redesign (20260926_195231, n=1), the stage design (20260926_154538, n=1) and the canon n=3 (20260926_002930).

**Register.** Run 1 intact, world GDP 1.03, loss 10.0; run 2 intact, 0.94, loss 2.8; run 3 BROKEN BY STALL at 0.57. Consensus of the
intact pair: loss 5.97 — world GDP 0.99, world W 0.68, pool W 0.68, pool U* 2.04 (at the aim), pool GDP 1.23, pool H 2.28, PI 0.93 (not
falling every decade), PP 1.01, T0 1935 / the 1900s 0.53, T3 / rest 0.71. The canon n=3 has no consensus (divergent pair).
Run 3's stall predates the dams: Britain lost a revolution in 1845-46 (its 1846 summary is a rump: GDP 8M, 924 levels; it returns as a
constitutional empire) and sat at U* 61-67% through 1890 - F166's stuck-Britain mode; that run's first dam survey is 1885.

**Dams (run 1 / 2 / 3).** Surveyed 84 / 69 / 44 projects; built 101 / 92 / 45 levels, 94 / 88 / 39 standing at 1935; dam electricity
22,296 / 24,254 / 10,989 a week = 43 / 44 / 52% of the world's; power-plant levels 551 / 496 / 228. Financing completed by 3 / 7 / 5
overlords (Britain 28 / 15 / 11; Germany 10 in run 2); levels owned by a non-host country at 1936 37 / 33 / 16.

**The gate.** Dam items in government queues at 1935: 8 / 11 / 7 against the ungated run's 16; most are back-to-back levels of one dam.
Two real stalls, both caused AFTER a gate-passing queue: Prussia's Moldau (queued 1919; Prussia's construction paused every year 1921-1935;
1,907 points left since 1922) and the Piave (queued by Austria 1913; Venetia passed to the Papal States, which funded nothing 1918-1934).
The yearly gov_paused / gov_backlog lines fire for small states (the Papal States, Sardinia, Switzerland, Lucca, Puerto Rico), none of which
queued a level.

**Ownership.** No dam level owned by a financial district, manor house or company. One level SELF-OWNED (run 3: the Iron Gates in Wallachia,
financed by Austria 1898): the engine's record is identity = the building itself with privatization = yes, which is how it stores EVERY
self-owned building (manor houses, urban centres, financial districts and company HQs read identically) - so the flag means privately held,
not "for sale". It stays subsidised, earns ~1,700 a week and pays it out as dividends (taxed 266 a week) to its own workforce: the profit does
not evaporate. Most likely Austria lost the level when Wallachia left its chain (not traced).

**Play time.** 173 / 148 / 144 min, sum 465 against the canon n=3's 492 (0.95x).

**What it does NOT say.** Whether the gate itself moved the economy (the ungated comparison is n=1); how often a financed level ends
self-owned; anything beyond direction.
