// Manually curated. Each entry names a restaurant slug plus a distinctive
// fragment of the violation text to feature. Live grade and violation data is
// always pulled fresh via loadRestaurants(), never duplicated here.
//
// `match`: a substring of the violation's comment text, matched
// case-insensitively against the restaurant's CURRENT violations first, then
// its inspection history. Text matching replaced the old `violationIndex`
// approach, which silently rotted: once a restaurant was re-inspected the
// current violation array was replaced, so an entry either vanished (5 of 16
// had) or, worse, kept a valid index and displayed an unrelated violation
// under the curated caption. With a text match an entry either resolves to
// the violation that was actually curated, or to nothing.
//
// Entries resolving from history are labelled "since re-inspected" on the
// page, so a fixed problem is never presented as a current one.
//
// `revealed`: false hides the restaurant's name and the link to its page.
// `caption`: optional, factual, no editorialising.
//
// To add an entry: find the restaurant's slug and copy a distinctive phrase
// from the violation you want to feature.
export const HALL_OF_SHAME = [
  {
    slug: "kimberli-sushi-bar-and-thai-cuisine-2718150",
    match: "OBSERVED A PEST INFESTATION OF LIVE INSECTS AND EVIDENCE OF",
    revealed: false,
    caption: null,
  },
  {
    slug: "wake-n-bacon-2163983",
    match: "OBSERVED OVER 300 DEAD SMALL BLACK FLIES THROUGH OUT STORAGE",
    revealed: false,
    caption: null,
  },
  {
    slug: "young-shing-foods-inc-1htx7g1",
    match: "FOUND PEST INFESTATION. OBSERVED APPROX 800 MOUSE DROPPINGS",
    revealed: false,
    caption: "One of the most severe pest citations currently on file.",
  },
  {
    slug: "manolos-tamales-inc-1-1873308",
    match: "OBSERVED DEAD MICE ON TRAPS IN THE FACILITY. INSTRUCTED PERS",
    revealed: false,
    caption: null,
  },
  {
    slug: "jiang-niu-bbq-house-2709508",
    match: "PREVIOUS PRIORITY FOUNDATION VIOLATION NOT CORRECTED FROM FE",
    revealed: false,
    caption: "A repeat citation -- inspectors had flagged the same issue the week prior.",
  },
  {
    slug: "gangnam-market-express-3090185",
    match: "OBSERVED LIVE 2 MICE IN BASMENT DISH/STORAGE AREAS NEAR WATE",
    revealed: false,
    caption: null,
  },
  {
    slug: "janik-s-cafe-1356941",
    match: "OBSERVED ICE MACHINE LOCATED NEAR THE FRONTLINE WITH A BUILD",
    revealed: false,
    caption: "The ice from this machine is used in drinks.",
  },
  {
    slug: "cochiaros-pizza-2-1044752",
    match: "OBSERVED SELF-SERVE ICE MACHINE LOCATED IN DINING AREA WITH",
    revealed: false,
    caption: "A self-serve ice machine in the dining area.",
  },
  {
    slug: "bar-22-2432789",
    match: "OBSERVED IMPROPER CONVEYING OF SEWAGE IN THE REAR FOOD PREP/",
    revealed: false,
    caption: null,
  },
  {
    slug: "vintage-lounge-2304532",
    match: "HOLE IN CEILING IN PREP AREA. INSTD TO REPAIR AND MAINTAIN",
    revealed: false,
    caption: null,
  },
  {
    slug: "joe-s-barbeq-and-fish-1-1lwu2lt",
    match: "OBSERVED LARGE DEAD RATS IN UTILITY STORAGE CLOSET. INSTRUCT",
    revealed: false,
    caption: null,
  },
  {
    slug: "magnolia-bakery-2114823",
    match: "3 LIVE ROACHES IN FACILITY, OBSERVED LIVE ROACHES CRAWLING ON",
    revealed: false,
    caption: "A well-known national bakery chain's Chicago location.",
  },
  {
    slug: "gordo-s-tiny-taco-bar-2138371",
    match: "OF ONE LIVE ROACHES CRAWLING ON FLOOR FROM FLOOR DRAIN TO LEG OF",
    revealed: false,
    caption: null,
  },
  {
    slug: "stella-s-diner-2809079",
    match: "OVER 20 RAT DROPPINGS ON BASEMENT FLOOR UNDER THE STAIRS AND 5 RAT",
    revealed: false,
    caption: "A Lakeview mainstay that closed permanently in 2026 after a separate roach citation.",
  },
  {
    slug: "see-thru-chinese-restaurant-1227055",
    match: "10 LIVE COCKROACHES INSIDE THE OVEN AND 3 LIVE COCKROACHES ON",
    revealed: false,
    caption: "Cited across two consecutive inspections twelve days apart.",
  },
  {
    slug: "taqueria-el-ranchito-60184",
    match: "RODENT INFESTATION. LIVE MICE AND RAT OBSERVED IN BASEMENT",
    revealed: false,
    caption: "One of the oldest food licences in the city's active records.",
  },
  {
    slug: "giordano-s-of-prudential-plaza-2417839",
    match: "LARGE LIVE COCKROACHES LOCATED IN THE FOLLOWING AREAS; 5 LIVE",
    revealed: false,
    caption: "A downtown location of a deep-dish chain known well beyond Chicago.",
  },
  {
    slug: "potbelly-sandwich-works-llc-1300088",
    match: "OF 10- LIVE ROACHES CRAWLING IN OPENINGS IN FRAME AND CREVICES ON",
    revealed: false,
    caption: "A national sandwich chain. The same violation had gone uncorrected from a prior visit a week earlier.",
  },
  {
    slug: "momento-cantina-3002233",
    match: "OF 10 LIVE ROACHES CRAWLING INSIDE OF BROKEN LOWER WALL BASE,BOTH",
    revealed: false,
    caption: null,
  },
  {
    slug: "pittsfield-cafe-49503",
    match: "TABLES.LIVE ROACHES IN A BUCKET IN HOT WATER TANK AREA AND DEAD",
    revealed: false,
    caption: "Ground floor of a landmarked 1927 tower in the Loop.",
  },
  {
    slug: "fou-flavors-3025285",
    match: "20 RODENT DROPPINGS UNDER AND AROUND THE SHELVING IN THE",
    revealed: false,
    caption: "An uncorrected repeat of a violation flagged two weeks earlier.",
  },
  {
    slug: "yummy-yummy-noodles-inc-2495710",
    match: "100 MOUSE DROPPINGS IN THE FOLLOWING AREAS; BEHIND COUNTER",
    revealed: false,
    caption: null,
  },
  {
    slug: "barbacoa-and-carnitas-don-chepe-inc-3082807",
    match: "TWO LIVE ROACHES AND THREE SMALL FLIES IN BASEMENT STORAGE AREA.",
    revealed: false,
    caption: null,
  },
  {
    slug: "imperial-restaurant-2771659",
    match: "ONE LIVE ROACH AND SEVERAL DEAD ROACHES IN THE KITCHEN. OBSERVED",
    revealed: false,
    caption: null,
  },
];
