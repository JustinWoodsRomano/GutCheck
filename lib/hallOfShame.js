// Manually curated. Each entry references an existing restaurant slug (see
// public/data/restaurants.json) plus which of that restaurant's CURRENT
// violations to feature -- the restaurant's live grade/violation data is
// always pulled fresh at build/request time via loadRestaurants(), never
// duplicated here, so this file only ever needs to say WHICH restaurant and
// WHICH violation, not what the violation says or what grade it holds.
//
// `revealed`: false hides the restaurant's name and links to its own page
// (see pages/hall-of-shame.js). Flip to true whenever you're ready to
// unhide a specific entry -- no other code changes needed.
//
// `caption`: optional short factual context shown above the violation.
// Keep it neutral and specific -- no editorializing or mockery.
//
// To add a new entry: find the restaurant's slug and the index of the
// violation you want to feature in its `v` array (see
// public/data/restaurants.json, or ask Claude to look one up), then add a
// row here.
export const HALL_OF_SHAME = [
  {
    slug: "magnolia-bakery-2114823",
    violationIndex: 0,
    revealed: false,
    caption: "A well-known national bakery chain's Chicago location.",
  },
  {
    slug: "gordo-s-tiny-taco-bar-2138371",
    violationIndex: 5,
    revealed: false,
    caption: null,
  },
  {
    slug: "kimberli-sushi-bar-and-thai-cuisine-2718150",
    violationIndex: 0,
    revealed: false,
    caption: null,
  },
  {
    slug: "stella-s-diner-2809079",
    violationIndex: 1,
    revealed: false,
    caption: "A repeat citation -- inspectors had flagged the same issue on a prior visit.",
  },
  {
    slug: "south-loop-cafe-inc-3069319",
    violationIndex: 3,
    revealed: false,
    caption: null,
  },
  {
    slug: "taco-burrito-king-2590021",
    violationIndex: 0,
    revealed: false,
    caption: "The ice from this machine is used in drinks.",
  },
  {
    slug: "wake-n-bacon-2163983",
    violationIndex: 10,
    revealed: false,
    caption: null,
  },
  {
    slug: "young-shing-foods-inc-1htx7g1",
    violationIndex: 1,
    revealed: false,
    caption: "One of the most severe pest citations currently on file.",
  },
  {
    slug: "manolos-tamales-inc-1-1873308",
    violationIndex: 7,
    revealed: false,
    caption: null,
  },
  {
    slug: "jiang-niu-bbq-house-2709508",
    violationIndex: 4,
    revealed: false,
    caption: "A repeat citation -- inspectors had flagged the same issue the week prior.",
  },
  {
    slug: "gangnam-market-express-3090185",
    violationIndex: 0,
    revealed: false,
    caption: null,
  },
  {
    slug: "janik-s-cafe-1356941",
    violationIndex: 0,
    revealed: false,
    caption: "The ice from this machine is used in drinks.",
  },
  {
    slug: "cochiaros-pizza-2-1044752",
    violationIndex: 0,
    revealed: false,
    caption: "A self-serve ice machine in the dining area.",
  },
  {
    slug: "bar-22-2432789",
    violationIndex: 3,
    revealed: false,
    caption: null,
  },
  {
    slug: "vintage-lounge-2304532",
    violationIndex: 4,
    revealed: false,
    caption: null,
  },
  {
    slug: "joe-s-barbeq-and-fish-1-1lwu2lt",
    violationIndex: 7,
    revealed: false,
    caption: null,
  },
];
