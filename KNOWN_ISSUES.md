# No Free Upgrades: An industrial realism overhaul — known issues

Issues a player may notice in the current release, version 1.1.0 for Victoria 3 1.15. Each line goes when a release fixes it; the fix is then in
`CHANGELOG.md`.

*Like the 1.1 changelogs, this list is AI-generated. Claude wrote it from the mod's repository and test records.*


How 1.1 was tested

* Mod 1.1 was neither measured nor tuned as thoroughly as mod 1.0. Mod 1.0 played 64 automated 1836–1936 campaigns with full telemetry (48 of
  1.0 itself and 16 of its 0.99 pre-release; observer runs with no player) against 56 of vanilla. This was done after balance finalisation to
  ensure that the targets are met. Mod 1.1 carries that balance over to game 1.15 without retuning it.
* Mod 1.1 played one automated campaign beside one of vanilla 1.15.0, plus several hours of manual play, and is published as is.
* In that campaign, world GDP ended too high, at 1.11× vanilla 1.15's (the mod aims for slightly less than vanilla's). That is consistent with
  the investment AI's improved ability on 1.15 to spend its pool in full, which was expected and is clearly measured, but one campaign cannot
  tell it apart from the variation between random seeds.
* The full measurement on 1.15 and the retuning are planned for mod 1.2, in about a month.
* The balance figures below therefore come from mod 1.0's 48 campaigns on Victoria 3 1.13. Game 1.15 also changed how buildings hire and pay,
  so on 1.15 they may differ.


Mechanical

* Four buildings run only on electricity: Tier 3 Explosives Factory, Tier 2 Motor Industries, Tier 3 Automotive Industries and Tier 3 Arts
  Academy. They can be built in a state that produces no electricity, and they cannot run there. Before building one, make sure the state
  has a power plant, a dam or electric streetlights. A build condition is planned for a later version.
* The research journal entries share one group, "Tech Advancements and Inventions". The journal shows it above the other blocks, and it
  cannot be collapsed. Over a campaign it fills with possible and completed entries, so reaching the blocks below it takes a long scroll.


Balance

* Old plants are not pushed out as strongly as intended, because prices fall less than the design aims for. In mod 1.0's tests, by the 1930s
  building inputs cost about 0.93 of vanilla's price and consumer goods about 0.87 in wage terms, against an aim of 0.8. Older textile and
  furniture plants stay profitable on their luxury clothes and luxury furniture lines long after newer tiers exist.
* Competition through trade is weak. A backward industry shrinks when a far better plant opens in its own market, but cheaper goods made in
  other markets hardly push it out, and many markets have little or no trade capacity. Prices do not even out between markets as much as
  intended.
* Britain may reach near-full employment. In 30 of mod 1.0's 48 test campaigns, its unemployment (peasants included) stayed under 5% for 5 to
  17 years.
* Research is uneven between the trees. Over half of the research journal entries cover the production tree, so that tree runs ahead of its
  intended pace while the military tree falls far behind. In mod 1.0's tests, by 1936 several countries held seven of the eight last-era
  production technologies, and no country held a single last-era military technology; the society tree ended about where vanilla's AI has
  it. The total number of technologies is acceptable. For reference, a great power ended with about as many as in vanilla (Britain 160,
  vanilla 162), with more production technologies and fewer military ones (Britain 42 military, vanilla 51).
* Runaway growth can happen. In 4 of mod 1.0's 48 test campaigns, the leading industrial economies nearly ran out of unemployed workers and
  peasants: under 10% of the workforce together, or Britain alone under 5% for nine years. Vanilla's own campaigns cross the same line more
  often. None of the 48 stalled.
