# PM & Tech Rehaul — known issues

Issues a player may notice in the current release, version 1.0.0 for Victoria 3 1.13. Each line goes when a release fixes it; the fix is then in
`CHANGELOG.md`. Figures come from sixteen 1836–1936 test campaigns of the mod, compared with forty of vanilla.


Mechanical

* Four buildings run only on electricity: Tier 3 Explosives Factory, Tier 2 Motor Industries, Tier 3 Automotive Industries and Tier 3 Arts
  Academy. They can be built in a state that produces no electricity, and they cannot run there. Before building one, make sure the state
  has a power plant, a dam or electric streetlights. A build condition is planned for a later version.


Balance

* Old plants are not pushed out as strongly as intended. Prices fall less than the design aims for: by the 1930s, building inputs cost
  about 0.93 of vanilla's price and consumer goods about 0.95 in wage terms, against an aim of 0.8. Older textile and furniture plants
  stay profitable on their luxury clothes and luxury furniture lines long after newer tiers exist.
* Competition through trade is weak. A backward industry shrinks when a far better plant opens in its own market, but cheaper goods made
  in other markets hardly push it out, and many markets have little or no trade capacity. Prices do not even out between markets as
  much as intended.
* Britain often reaches near-full employment: in 10 of 16 test campaigns, its unemployment (peasants included) stayed under 5% for 5 to
  17 years.
* The United States often industrialises late: in most test campaigns it builds too few mines, logging camps and oil rigs between 1890
  and 1910, and by 1936 its GDP is about 0.6 of vanilla's (in 9 of 16 campaigns under 0.6; in 5 it matches or beats vanilla), with
  vanilla's population but far more peasants.
* The AI invests less efficiently than in vanilla: 14–21% of each decade's new capital goes into buildings that pay back far worse than
  the best alternative, against 12–15% in vanilla.
* In testing of earlier versions, about one campaign in three or four ran away (a few economies grew far beyond vanilla's range) or
  stalled (a major economy fell far below it). None of the sixteen 1.0 test campaigns did, but it may still happen.
