# The next book — build specification

**What this is.** One page that puts together the rulings of BALANCE_FRAMEWORK **§10.115** (tiered deposits, 2026-11-16), **§10.117** (the centuries start at cost slope 2.0, 2026-11-17), **§10.119** (the older
1.2 items placed one by one; tier-scaled secondary lines are in) and **§10.116**
(the engine rebalance, which is the electric engines redo, 2026-11-17, as amended the morning after by **§10.116.1**: the drives are a
succession, not a choice), in the order a generator needs them, so the session that builds
the starting book and its variations can work from here. Written at the user's word (2026-11-17): *"combine the rulings with the ones from
the neighbouring session so that it'd be easier for the next one to create the 1.3 starting book and variations when the current batch
ends."*

**What it is not.** It rules nothing. The two sections hold the rulings, their words and their reasons; where this page and a section
disagree, the section wins and this page is wrong. Every number in §3 was worked from the rules by a session script and is there to be
reproduced by the generator, not copied.

**Status (2026-11-17).** Nothing is built and nothing has run. The three-arm batch (session `20261116_005659`) may still be playing:
until its `SCHEDULE DONE`, no emitter, `build.ps1` or `tools/testbed/**` file is edited in the checkout (CLAUDE.md §5.1 rule 7). Every
run below needs the user's go-ahead (rules 3–4). The user on the open items: *"Open questions will get rulings when the first book
builds."* They are collected in §5 with a proposed default each, so the first build can raise them in one pass.

---

## 1. What the book is (confirmed by the user, 2026-11-17)

1. **It is the mod 1.2 book.** §10.115 ruling 4 makes the extraction overhaul mod 1.2, and the engine rebalance, first asked *"for
   1.3"*, is part of the same book (§10.116.3; the user: *"In the 1.2 book"*). "The next book" on this page is the mod 1.2 book.
2. **What it contains, from its first run.** The tiered deposits (§2.1), the engine rebalance (§2.2–§2.4) and cost slope C 2.0
   (§10.117). Since §10.118 there is no separate book for the short runs: the 1836–1855 legs are played on the exact book that plays
   the century, so §10.115's accepted *"No factory lever moves with the first tiered books … so what tiering does is seen alone"* no
   longer holds. A deposits-only reading exists only if a deposits-only book is also to play centuries (§4).
3. **Every open item of §5 that changes the book is settled before its first run**, short or long (§10.118).

## 2. The starting book, in build order

**The base** is the latest canon when building starts (§10.115): today `config/mod_config.g1151-canon-bz-dcu-ra-il-aw.json`
(sha256 `697d4869aefc3225`, mod 1.1.1 on game 1.15.1). Agree it before building (CLAUDE.md §5.1 rule 3). Nothing of the base's factory
ladder moves (A 2.2, B 1.64, C 1.9, input lift 1.2, engines 1.0) except what §2.2 and §2.4 say, and the cost slope:

- **The century arms start at C 2.0** (§10.117, user-ruled 2026-11-17; `--cost-ratio 2.0` in the recorded chain, `cost1` unset): t2
  costs 5% more and t3 11% more, t1 the same, the non-craft t0 5% less. It is a start for iteration; C 2.1 is the next bracket.
  Every run of the book carries it, the 1836–1855 legs included: a short run is played on the exact book of its full runs (§10.118).

### 2.1 Deposits become rungs (§10.115)

- **The family:** coal, iron, lead, sulfur, copper and gold mines; logging camps; fishing wharves; whaling stations; oil rigs. Each
  main method becomes a building with resource slots of its own. Gold fields stay vanilla's building.
- **Slots:** two methods → vanilla's slots × 1.5; three or four → × 2; split equally between the rungs. An uneven total is rounded UP
  to the next multiple of the rung count, at least one slot a rung. Gold: a rung's share is never under its 1836 levels.
- **Output is flat:** the rungs on the 1836 map (the first two methods; oil has none, so its first) keep vanilla's output, and every
  later rung takes the output of the highest 1836-map rung.
- **Inputs give equal value added at base prices:** a later rung's input value equals the highest 1836-map rung's, spread over the
  rung's own vanilla mix.
- **Staffing:** 5,000 workers a level on every rung, the rung's own vanilla professions.
- **Cost:** the 1836-map rungs at vanilla's cost; each rung above them × the cost step (the arms, §4).
- **AI desire:** the vanilla building's own, the same on every rung (gold keeps vanilla's static 5000).
- **Secondary lines:** a line that adds or converts output is scaled by vanilla's slots ÷ the tiered slots (½ for three or four rungs,
  ⅔ for two), the same recipe on every rung, no limit by tier (both explosives on all four mine rungs). A line that only saves labour
  (steam donkey, rail transport) is unchanged.
- **Gold's depleted fields** are spread over the four rungs from the `on_resource_depleted` hook. **Oil:** one discoverable block per
  rung; the second never rolls and is revealed with the first from `on_resource_discovered`. Both need their probe first (§6).
- **Each rung stays in the vanilla building's building group**, so group-keyed vanilla script still reaches it (§7).

### 2.2 The motor ladder (§10.116 rulings 3–4)

t0 Steam Engines (atmospheric engine; a placement entry, as fertilizer and explosives have) · t1 a NEW rung, **Compound Engines**, gated
on pumpjacks (a vanilla technology, tech era 3; the rung takes the mix and staffing of the rung below) · t2 Electric Engines · t3
Diesel Engines.

- **Names (§10.116.2):** the technology `pumpjacks` is shown as **"Pumping Engines"** (display name and description only; the key
  stays; POLISH R9 reversed for it). The new rung is "Compound Engines"; t0 keeps vanilla's "Steam Engines".

- **Anchor:** t0 keeps vanilla's steam recipe; the t1 anchor is 1.5 × it. A new case in the formula of CLAUDE.md §1.3.
- **The quarter:** in the vanilla mix of Electric Engines and Diesel Engines the energy good is cut to a quarter (electricity 20 → 5,
  oil 50 → 12.5) before the rung's input value is spread over the mix. A second new exception to §1.3. Electric Engines keeps
  `required_input_goods = electricity`.
- Cost and AI desire by tier as the ladder gives them (421 / 800 / 1,520 / 2,888 points; 1000 / 1000 / 3000 / 5000).

### 2.3 Engines on the pump rungs (§10.116 ruling 5); no electric drive (§10.116.1)

- On every mine's condensing and diesel pump rungs, after §2.1's mix is worked, the tools above 5 become engines, value for value
  (tools × 40 ÷ 60). The picks and atmospheric rungs keep vanilla's inputs.
- **The rung is the drive.** The diesel pump rung gets no electric method beside it: the electric drive first ruled for it was
  dropped with the switchable drives (§10.116.1 item 6; the user: *"Yes, drop it"*). The condensing rung burns coal and the diesel
  rung oil, and the choice is what one builds.

### 2.4 Irrigation's two drives and the factory power lines (§10.116.1; §10.116 ruling 8)

- **Irrigation** (vanilla's automatic irrigation on the plantations, vineyards and rubber) is a succession of two methods with the same
  output, never a choice of fuel (the user: *"balance it the way that one method is clearly superior"*):
  - **steam** = vanilla's engines + one coal per engine, on irrigation's own gate (pumpjacks; the world's technology once §10.115
    ruling 7's probe passes, as fertilizers);
  - **diesel** = fewer engines and less fuel for the same output (the user: *"Make it fewer engines and less fuel, same output"*): by
    default engines × 0.8 and oil at two thirds of the steam drive's coal value (§5, item 2). Gated on the country's OWN compression
    ignition, vanilla's ordinary `unlocking_technologies` (the user: *"Locked by tag tech, not worldwide"*);
  - no electric drive. Tea's vanilla method takes 4 engines, the others 5.
- **Factory power lines:** on every water-tube boiler, rotary valve engine and assembly line method of the tiered industries, the tools
  become engines, value for value. The tooling workshop's three lines carry no tools and do not change.

### 2.5 Secondary lines scale with their rung, and crafts carry lines (§10.119 item 2)

- **The rule:** a line that makes or converts output takes the same share of its rung's own main output on every rung, the share
  being today's on the t2 rung. So today's quantities on t2, ÷ A on t1, × A on t3, the whole line by one factor (inputs included);
  employment unscaled (a craft's × 0.1). This replaces the `top` sizing of `emit_secondaries.mjs` (one recipe per line sized on t2).
- **Names:** each scaled line is its own method, "<vanilla line name> (Tier N)", on vanilla's translation.
- **A merged building:** one copy sized on its upper method, named for the span ("(Tier 2-3)"), left off the lower method where it
  would take a good below zero (Elastics beside Electric Sewing Machines only; Precision Tools beside Spray Finishing only). Food's
  merged building is already sized on its upper method and does not change.
- **Crafts:** the handcraft-compatible first lines by the same rule: Pot Stills, Craftsman Sewing, Luxury Furniture, Ceramics.
- **Automation lines:** one recipe per industry as today, with §2.4's tools → engines.
- **Worked** (today → ruled): Craftsman Sewing 28.3 → t1 12.9, merged 62.2; Elastics 66 → 145.2; Luxury Furniture 32.5 → t1 14.8,
  merged 71.5; Precision Tools 71.5 → 157.3; Ceramics 8.8 → 4.0 / 8.8 / 19.4; Bone China 17.6 → t3 38.7; Aeroplanes 13.2 → t3 29.0;
  Tanks 26.4 → t3 58.1.

### 2.6 Left as vanilla's (§10.116 ruling 10; §10.115 ruling 6)

Radios, automobiles' oil, coffee's and the public trams' engines without fuel, iron in fertilizer, crystal glass, oil in rifles and
recoiled barrels. Same-acre steps (farms, plantations, ranches, rubber) stay methods; their gate on the world's technology is deferred
as the likely solution and is NOT part of the first book's rules (§10.115 ruling 7) until its probe passes.

## 3. Worked numbers (per level, at the base canon's ladder; to be reproduced)

**Mines** — four rungs, slots × 2 (each rung half of vanilla's), vanilla cost 400. Iron, lead, sulfur, copper and gold share the input
columns; their rung outputs are 20 / 40 / 40 / 40 (gold 8 / 15 / 15 / 15). The vanilla column is iron's.

| rung | gate (tech era) | vanilla | §2.1 | with §2.3 | cost |
|---|---|---|---|---|---|
| picks | — | 20 from tools 5 | the same | the same | 400 |
| atmospheric pump | atmospheric engine (2) | 40 from tools 10 + coal 10 | the same | the same | 400 |
| condensing pump | water-tube boiler (2) | 60 from tools 15 + coal 15 | 40 from tools 10 + coal 10 | tools 5 + engines 3.3 + coal 10 | 400 × step |
| diesel pump | compression ignition (5) | 70 (sulfur 80, gold 30) from tools 15 + oil 5 | 40 from tools 13.1 + oil 4.4 | tools 5 + engines 5.4 + oil 4.4 | 400 × step² |

**Coal mines** take no coal: picks 25 from tools 5; atmospheric 40 from tools 10; condensing 40 from tools 10 → tools 5 + engines 3.3;
diesel 40 from tools 7.5 + oil 2.5 → tools 5 + engines 1.7 + oil 2.5.

| building | rungs, slots | rung outputs | later rungs' inputs under §2.1 | vanilla cost |
|---|---|---|---|---|
| logging camp | 3, × 2 | wood 30 / 60 / 60 | electric saw mills: tools 3.6 + electricity 1.8 (the saw mills' £200) | 200, top × step |
| fishing wharf | 3, × 2 | fish 25 / 50 / 50 | steam trawlers: steamers 1.9 + coal 5.6 (the trawlers' £300) | 200, top × step |
| whaling station | 3, × 2 | meat 5 + oil 10 / 10 + 20 / 10 + 20 | steam whaling ships: steamers 1.6 + coal 6.3 (£300) | 200, top × step |
| oil rig | 2, × 1.5 | oil 60 / 60 | combustion derricks: engines 10 (the steam derricks' £600) | 400, second × step |

A full deposit then makes, per vanilla slot at base prices: iron, lead, copper and logging vanilla's own ceiling; coal £2,175 against
£2,700; sulfur £3,500 against £4,000; gold £2,650 against £3,000; fishing £1,667 against £2,000; whaling £1,833 against £2,200; oil
£3,600 against £4,000 (before the secondary lines).

**The motor industry**

| rung | gate | output | inputs | cost |
|---|---|---|---|---|
| t0 Steam Engines | atmospheric engine | 40 | steel 30 | 421 |
| t1 Compound Engines (new) | pumpjacks, shown as "Pumping Engines" | 60 | steel 45 | 800 |
| t2 Electric Engines | electric railway | 132 | steel 57.9 + copper 14.5 + electricity 7.2 | 1,520 |
| t3 Diesel Engines | compression ignition | 290.4 | steel 100.9 + oil 25.2 | 2,888 |

**Irrigation** (the 5-engine plantations; tea in brackets): steam engines 5 + coal 5 (4 + 4), £450 a level at base prices; diesel, at
§5's default, engines 4 + oil 2.5 (3.2 + 2), £340; vanilla's is engines 5, £300. On the ten canon end saves (1936 state prices) that
diesel step is cheaper than steam in 99–100% of states; with the same engines and oil of the coal's value, as first ruled, in 36%.

**The factory power lines today** (the canon's own methods; tools → engines at × ⅔): furniture boiler and rotary 6.15 tools, assembly
4.92; paper 7.21; steel 5.6; motor 2.73 and 2.19; arms 2.4; artillery 3.08; munition 4.43; automotive's Mass Production line 5.62.

## 4. The variations

**Ruled (§10.115):** the cost step per rung above the 1836-map rungs at **1.3, 1.6 and 1.9**, three arms, each through the 2+1 quick
config test on **1836–1855** runs, read against the existing vanilla 1.15.1 and canon runs over the same years; centuries after.
**Each arm is one book from its first run (§10.118):** its 1836–1855 runs are the checkpoint legs of century runs on that book
(`checkpoint: true`), and an arm that passes plays its century on the same book, continued from the legs' saves or started fresh;
the scheduler refuses a short run on any other terms once the gate is merged. Pass:
(a) the start is vanilla's — the register's 1836–1845 anchor line, the 1837 mining levels and output by good, raw-material prices at
the first dump inside vanilla's seed spread; (b) 1855 is not dead in half the world. The thresholds for (b) are a proposal the user left
for later (a country dead under 0.66 × vanilla's median; dead in both runs holding over 5% of the world a flag, over 20% a fail; world
GDP at 1855 outside 0.90–1.10 a flag). Read beside them: slot fill by rung, a raw-material price index, the red flags on raw materials,
mining employment.

**Proposed, none ruled** (each is another 2+1 on 1836–1855, so say which are wanted before any is built):
- **Deposits only** — §2.1 without §2.2–§2.4, at one cost step: what tiering does alone. Under §10.118 it is run only as a book that
  also plays centuries (§1, item 2).
- **The diesel irrigation step's quantities** — 4 engines + 2.5 oil against 3 + 2 (more room for the oil price the new demand
  raises). It acts only once compression ignition is held, so centuries read it, not 1855.
- **The engines' input lift** — 1.0 against 1.2, the routine counter-lever to the motor anchor's × 1.5 (§10.101).
- **The cost slope beyond the ruled start** — C 2.1 after C 2.0 (§10.117), on centuries only. At the 1.1.1 batch's realised prices
  t3 still pays back faster than t2 at C 2.0 in every decade and comes level with it by 1935 at C 2.1.

A 1836–1855 run reads the deposit rungs up to the condensing pump (water-tube boiler is tech era 2), engines on that rung, the motor's
t0 and the factory boiler lines. It does not read the t1 engine rung (pumpjacks, tech era 3), irrigation's drives, or the diesel rungs.

## 5. Open, to be ruled when the first book builds (with the default this page assumes)

| # | question | default assumed above | from |
|---|---|---|---|
| 1 | RULED, no longer open: the top mine rung has no electric drive (the user: "Yes, drop it") | not built | §10.116.1 |
| 2 | the diesel irrigation step's quantities (its form is ruled: fewer engines and less fuel, same output) | engines × 0.8 and oil at two thirds of the coal's base value: 4 + 2.5 | §10.116.1 |
| 3 | RULED, no longer open: the t1 rung is "Compound Engines" and the technology `pumpjacks` is shown as "Pumping Engines". Still to settle: its description, translation or English in the eleven languages, the icon | English, vanilla's icon | §10.116.2 |
| 4 | whose technology gates a drive | RULED for the diesel step: the country's own. The steam drive follows irrigation's gate: the host's until the world-gate probe passes | §10.116.1, §10.115 |
| 5 | the engines' input lift | 1.0, unchanged | §10.116 |
| 6 | the 1855 thresholds | as proposed in §4 | §10.115 |
| 7 | the staffing of the later deposit rungs. ⚠ At 5,000 a level and output 40, the same raw output needs 1.5–1.75 × vanilla's miners (twice on a full deposit), so the overhaul adds productive workers where mod 1.2 wants fewer (§10.117) | 5,000 on every rung (ruled to start with) | §10.115, §10.117 |
| 8 | where §10.110.1's other items go (the retune, military research, tier-scaled secondary lines, the minor fixes) | not in this book | §10.115 |
| 9 | the cost of oil's second rung | × step, as a rung above the first | this page's reading |
| 10 | whether the electric saw mills and steam trawler rungs want engines or a drive as the pump rungs do | no: §10.116 names the pump rungs only | this page's reading |
| 11 | RULED, no longer open: the 1836–1855 runs carry C 2.0, being played on the exact book of the centuries | — | §10.118 |
| 12 | the AI desire ladder at C 2.0 (calibrated per book; F228's C 2.0 book carried 3,200 / 5,600 on t2 / t3) | the canon's 1000 / 1000 / 3000 / 5000 | §10.117 |

## 6. The order of work

1. `SCHEDULE DONE` of the three-arm batch; then commit the readers worth keeping from `C:\claude-code\extraction_study_2026-11-16\`,
   `C:\claude-code\engine_study_2026-11-17\` and `C:\claude-code\cost_start_study_2026-11-17\` (the session scripts of §10.115–§10.117,
   kept outside the repo meanwhile), and **review and merge branch `same-book-machinery`** (§10.118: the scheduler's gate on short
   runs, checkpoint legs and verified continuations; worktree `C:\claude-code\nfu_wt_samebook`). No run of the new book before it is in.
2. **The probes**, each on the arm that fits (an engine question on vanilla + telemetry), with the go-ahead: gold's depleted fields;
   oil's linked discovery (and that vanilla's oil events on the hook do not fire twice); the world-technology gate
   (`unlocking_global_technologies`, unused by vanilla) and how the AI switches a method when its input is scarce — the last also
   tells how fast the AI moves to the diesel step (vanilla keeps 88% of its railway levels on steam in 1936).
3. **The generator** for §2, and the readers that are missing: slot fill by rung, a raw-material price index, the 1855 reader.
4. Confirm §1 and §5 with the user; state the arms, n, span and predictions back (rule 3); the named books and their field diffs.
5. The 1836–1855 arms through 2+1; then centuries.

## 7. What the build must carry (consequences nobody has ruled on; raise them, do not decide them)

- **Vanilla script that names a deposit building** — state traits (`building_coal_mine_throughput_add` and the like are hand-enumerated
  modifier types, one per building key), company building lists and bonuses, decrees, events, journal entries, AI strategies, the 1.15
  level counts (L48) — must reach every rung or the ruled set (`emit_vanilla_refs.mjs`, `TIER_REFERENCE_AUDIT.md`, L40).
- **The 1836 start:** every vanilla mine, camp, wharf and station lands on the rung of its active method (`convert_history.ps1`, L13).
- **DLC gates** on every copied or generated block (L39).
- **Names.** A deposit rung is not on the tier ladder of §2.3 of CLAUDE.md (its output does not rise with tier); what its in-game name
  says is unruled.
- **Research.** Whether the deposit rungs' technologies get research entries, and their marks; pumpjacks takes the standard entry of a
  t1 rung's technology (today it has none); a technology that unlocks rungs of two tiers takes the higher tier's mark (§10.110.3, ruled,
  not built) — compression ignition now gates the motor's t3, the mines' top rung and irrigation's diesel step.
- **Linters:** `lint_tier_eras.mjs` recomputes every rung from the book's records, so the two new formula cases of §2.2 and the deposit
  rules need their own records and checks; `lint_pm_combos.mjs` must pass with irrigation's two drives and with the scaled secondary
  lines; `lint_solvency.mjs` on every new rung.
- **The method icon** for the new engine rung, and localisation in all 11 languages (new names stay English).
- **The scaled secondary lines** (§2.5): a third sizing rule in `emit_secondaries.mjs` beside `top` and `lowest` (the `lowest`
  path already mints a method per tier); the tier in each line's name in all 11 languages; `lint_pm_combos.mjs` on every new
  combination, the crafts' included; the compatibility review for each craft line; whether the 1836 conversion carries vanilla's
  line choices onto the crafts, and the 1836 luxury and liquor output against vanilla's (unruled; report it when built).
- **The technology's rename** (§10.116.2): an entry in `TECH_RENAMES_RULED` (`tools/lib_tier4_spec.mjs`, empty today), a new
  description, what the vanilla-name lint says to it, vanilla's icon (a pumpjack) unless replaced, and a patch-notes line.
- **Known sizes, arithmetic on the canon's 1936 levels, not predictions:** the quarter takes 9% off buildings' electricity demand and 6%
  off oil; irrigation adds about 16% to coal while every level is on steam, and about 21% to oil in place of that coal, with a fifth fewer
  engines on irrigated levels, once every level is on the diesel step; engines on the
  pump rungs add about a third to engine demand on untiered levels, and the motor ladder makes 1.5 × today's engines per level.
