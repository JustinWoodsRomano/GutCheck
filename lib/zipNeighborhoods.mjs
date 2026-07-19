// Shared ZIP -> Chicago neighborhood mapping, used both by the build-time
// data pipeline (scripts/fetch-data.mjs) and by pages/r/[slug]/index.js at
// ISR revalidate time, so a restaurant's neighborhood is computed
// identically regardless of which code path built the page.

export const ZIP_NEIGHBORHOOD = {
  "60601": "Loop", "60602": "Loop", "60603": "Loop", "60604": "Loop",
  "60605": "South Loop", "60606": "West Loop", "60607": "West Loop",
  "60608": "Pilsen", "60609": "Back of the Yards", "60610": "Near North Side",
  "60611": "Streeterville", "60612": "East Garfield Park", "60613": "Lakeview",
  "60614": "Lincoln Park", "60615": "Hyde Park", "60616": "Chinatown",
  "60617": "South Chicago", "60618": "North Center", "60619": "Chatham",
  "60620": "Auburn Gresham", "60621": "Englewood", "60622": "Wicker Park",
  "60623": "Little Village", "60624": "West Garfield Park", "60625": "Albany Park",
  "60626": "Rogers Park", "60628": "Roseland", "60629": "Gage Park",
  "60630": "Portage Park", "60631": "Edison Park", "60632": "Archer Heights",
  "60633": "Hegewisch", "60634": "Dunning", "60636": "West Englewood",
  "60637": "Woodlawn", "60638": "Garfield Ridge", "60639": "Belmont Cragin",
  "60640": "Uptown", "60641": "Irving Park", "60642": "Noble Square",
  "60643": "Beverly", "60644": "Austin", "60645": "West Ridge",
  "60646": "Forest Glen", "60647": "Logan Square", "60649": "South Shore",
  "60651": "Humboldt Park", "60652": "Ashburn", "60653": "Bronzeville",
  "60654": "River North", "60655": "Mount Greenwood", "60656": "Norwood Park",
  "60657": "Lakeview", "60659": "West Rogers Park", "60660": "Edgewater",
  "60661": "West Loop", "60664": "Loop", "60666": "O'Hare",
  "60827": "Riverdale", "60707": "Dunning",
};

export function neighborhoodFor(zip) {
  const z = (zip || "").trim().slice(0, 5);
  return ZIP_NEIGHBORHOOD[z] || "Other Chicago";
}
