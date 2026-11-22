# No Free Upgrades: An industrial realism overhaul — known issues

Issues a player may notice in the current release, version 1.1.2 for Victoria 3 1.15.2. Each line goes when a release fixes it; the fix is
then in `CHANGELOG.md`.

*Like the 1.1.2 changelogs, this list is AI-generated. Claude wrote it from the mod's repository and test records.*


How 1.1.2 was tested

* Mod 1.1.2 is mod 1.1.1 on Victoria 3 1.15.2, with no balance change. On 1.15.2 it played one automated ten-year campaign (an observer
  run, no player) beside one of vanilla 1.15.2, to check that it loads and runs; it has not been measured there over a century yet.
* Mod 1.1.1 played ten automated 1836–1936 campaigns with full telemetry (observer runs, no player) against ten of vanilla 1.15.1,
  alternating on one machine in the same days, and five more against five since; over all fifteen, world GDP ended at 1.19 times vanilla 1.15.1's (1.18 over the first ten). The figures
  below are from the first ten, on Victoria 3 1.15.1.
* The balance is still mod 1.0's. Mod 1.0 was tuned on Victoria 3 1.13 and confirmed there over 64 automated campaigns against 56 of
  vanilla; mods 1.1, 1.1.1 and 1.1.2 carry it over to game 1.15 without retuning. The retune for game 1.15 is planned for mod 1.2.


Mechanical

* Four buildings run only on electricity: Tier 3 Explosives Factory, Tier 2 Motor Industries, Tier 3 Automotive Industries and Tier 3 Arts
  Academy. They can be built in a state that produces no electricity, and they cannot run there. Before building one, make sure the state
  has a power plant, a dam or electric streetlights. A build condition is planned for a later version.
* The research journal entries share one group, "Tech Advancements and Inventions". The journal shows it above the other blocks, and it
  cannot be collapsed. Over a campaign it fills with possible and completed entries, so reaching the blocks below it takes a long scroll.
* A research journal entry (other than the military and naval ones) appears only once the country's literacy reaches the line for its
  technology's era: 25% for era 1, 35% for era 2, 45% for era 3, 55% for era 4 and 65% for era 5. Below that the entry is simply missing,
  with nothing saying why; an entry already open pauses, and its progress bar gives the line.
* A company mandate chosen by the player covers only one tier of an industry. For factories this matters little: the latest tier
  available is always the best one. From mod 1.2, where mines, oil wells and fishing get tiers too, it will matter more, since an older
  extraction tier stays useful beside a newer one; this is not fixed in mod 1.2.


Balance

* The world economy ends larger than intended. The mod aims for a world GDP slightly below an unmodded game's, because modernising costs
  capital. In mod 1.1.1's tests world GDP ended the 1930s at 1.18 times vanilla 1.15.1's (1.02 to 1.36 across the ten campaigns). Most of
  the gap is vanilla's own change: vanilla 1.15.1's world ends about 9% poorer than vanilla 1.15.0's, while the mod's ends the same size on
  both versions.
* Depeasantation is too easy in the leading industrial economies on game 1.15.1. The mod aims to make leaving subsistence farming and
  unemployment harder than in an unmodded game, because every modern job needs capital to build. In mod 1.1.1's ten test campaigns that
  holds for the world as a whole: in the 1930s about 34% of its workforce was still unemployed or peasants (for reference, vanilla 1.15.1:
  30%). It does not hold for Britain, the USA, France, the Low Countries and Germany taken together: only 3.6% of their workforce was
  unemployed or peasants (vanilla 1.15.1: 4.8%), and none of the ten campaigns kept them above 10%. The balance was tuned on game 1.13,
  where about a quarter of these economies' workforce was still unemployed or peasants in the 1930s; game 1.15 lets every economy, the
  mod's and vanilla's, find work for far more people. The retune for game 1.15 is planned for mod 1.2.
* Capital can pile up unspent in the leading industrial economies. In two of mod 1.1.1's ten test campaigns Britain had almost no
  unemployed or peasants left from 1920 on and still held an unspent investment pool of about four times its yearly GDP on average over
  1920–1936; in a third, Germany did the same over 1920–1931 at about one and a half times. In a typical campaign Germany ends the 1930s with
  an unspent pool about equal to its yearly GDP (for reference, vanilla 1.15.1's Germany: about a tenth). The mod means capital to stay
  scarce, so that the money finds use in costly modern plants rather than piling up.
* Old plants are not pushed out as strongly as intended. The design retires an old plant when newer plants' output pushes its prices down
  relative to wages. In mod 1.1.1's tests consumer goods did get that much cheaper (0.66 of vanilla 1.15.1's price in wage terms, against
  an aim of 0.8 or less), but building inputs cost 0.88 of vanilla's price (aim 0.8). An industry two tiers behind a better plant in its own
  market, without the technology for the next tier, still kept 117% of its workers over ten years (for reference, vanilla 1.15.1: 117%);
  only in the heavy and war industries did it shrink (to 71%; vanilla 102%). In the 1930s about an eighth of textile and furniture workers,
  and almost a fifth of arts academy workers, were still on plants two or more tiers behind the best in their market. Older textile and
  furniture plants stay profitable on their luxury clothes and luxury furniture lines long after newer tiers exist.
* Competition through trade is weak. Cheaper goods made in other markets hardly push a backward industry out: in mod 1.1.1's tests such an
  industry kept 116% of its workers over ten years (for reference, vanilla 1.15.1: 114%), and many markets have little or no trade capacity.
  Prices do not even out between markets as much as intended.
* Research is uneven between the trees. Over half of the research journal entries cover the production tree, so that tree runs ahead of its
  intended pace while the military tree falls far behind. In mod 1.1.1's tests no country held a single last-era military technology by
  1936 in any of the ten campaigns. The total number of technologies is acceptable. For reference, Britain ended with 164 technologies
  (vanilla 1.15.1: 168): 58 production (vanilla 52), 43 military (54) and 62 society (62).
