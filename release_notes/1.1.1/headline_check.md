# 1.1.1 — the headline descriptions against the build and the newest measurement

The `release` skill's step 1½, run 2026-11-15. The measurement is mod 1.1.1 against vanilla 1.15.1, ten alternating automated campaigns each
(FINDINGS F271). A slightly stale figure is fine; a statement that is no longer true is listed.

## The Workshop item's description (the user's own text: listed, not reworded)

Read from the public page on 2026-11-15; the copy is `release_notes/published/workshop_description.txt` (its BBCode, rebuilt from the page and checked
to round-trip). At the user's request
(2026-11-15), `release_notes/1.1.1/workshop_description.txt` is that text with the five sentences below brought up to date (BBCode,
7,859 characters against the live 7,453; every tag kept, so it is pasted whole into Steam's editor). The rest is the user's
text unchanged. Its last line says no part was written or edited by AI, and these five sentences now are.

1. **No longer true.** "For mod 1.1 over vanilla 1.15, there was only one mod over one vanilla observer run so far … More significant
   measurement and balance retune for 1.15 will come in several weeks."
   Now: mod 1.1 played ten campaigns against ten of vanilla 1.15.0. Mod 1.1.1 played ten against ten of vanilla 1.15.1. The retune is
   planned for mod 1.2.
2. **No longer true for the leading economies on 1.15.1.** "full employment, which throws the game off balance completely in vanilla pretty
   often, is harder to achieve" and "In AI-only observer runs, there tends to be significantly more peasants left in the late game."
   Now: in the 1930s Britain, the USA, France, the Low Countries and Germany taken together had 3.6% of their workforce unemployed or
   peasants, against vanilla 1.15.1's 4.8%: fewer than vanilla, not more. The world as a whole still has more: 34% against vanilla's 30%,
   a small margin rather than "significantly more". On 1.13, mod 1.0 had 24.6% against vanilla's 19.1% for the same economies.
3. **Weakened.** "The world GDP doesn't diverge from vanilla values that much … There is a GDP dip in mid-game … But by 1920s this balances
   out."
   Now: world GDP ends the 1930s at 1.18 times vanilla 1.15.1's (1.02 to 1.36 across campaigns). Most of that is vanilla 1.15.1 ending about
   9% poorer than 1.15.0; the mod's world is the same size on both versions. The dip is deepest in 1886 (0.87) and is over by 1896, and the
   mod's world runs ahead of vanilla's from the 1910s.
4. **A stale figure, still inside the claim.** "the game is about 2% slower on my machine". That was game 1.13. On 1.15.1 a century took
   1.09 times as long as vanilla's (177 minutes against 163, ten alternating campaigns each), inside the mod's +10% budget. Your call
   whether "doesn't meaningfully change" still reads right.

Everything else in it still holds against the 1.1.1 build: the four tiers, crafts, research entries, dams, power plants at 4×,
streetlights, the electricity state traits, the scope (mines, agriculture and most infrastructure vanilla's), and 1836 close to vanilla.

## The forum thread's first post

Not read: the forum shows automated browsers a verification check. Paste the first post, or pass the check in the browser pane, and it
gets the same reading. Its known-issues section is replaced whole by `forum_known_issues.txt`.

## In the repository

- `mod/.metadata/metadata.json` `short_description` ("Economic realism: each technology step is a new building, …"): still true.
- README's opening said "For Victoria 3 (1.13 "Matcha")": corrected to 1.15 ("Ivan-Chai"; mod 1.1.1 built on 1.15.1).
- CLAUDE.md §1.2: current (it already carries 1.15.1's dam subsidy rule and the AI research weights).
