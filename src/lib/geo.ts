// Lightweight US geography helpers shared by the library builder and search.

export const US_STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  DC: "District of Columbia",
};

export const STATE_REGION: Record<string, string> = {
  CT: "northeast", ME: "northeast", MA: "northeast", NH: "northeast", RI: "northeast",
  VT: "northeast", NJ: "northeast", NY: "northeast", PA: "northeast",
  DE: "south", DC: "south", FL: "south", GA: "south", MD: "south", NC: "south",
  SC: "south", VA: "south", WV: "south", AL: "south", KY: "south", MS: "south",
  TN: "south", AR: "south", LA: "south", OK: "south", TX: "south",
  IL: "midwest", IN: "midwest", MI: "midwest", OH: "midwest", WI: "midwest",
  IA: "midwest", KS: "midwest", MN: "midwest", MO: "midwest", NE: "midwest",
  ND: "midwest", SD: "midwest",
  AZ: "west", CO: "west", ID: "west", MT: "west", NV: "west", NM: "west",
  UT: "west", WY: "west", AK: "west", CA: "west", HI: "west", OR: "west", WA: "west",
};

// Bordering / practical driving-distance neighbours.
export const NEIGHBORS: Record<string, string[]> = {
  NJ: ["PA", "NY", "DE", "CT"], NY: ["NJ", "CT", "PA", "MA", "VT"],
  PA: ["NJ", "NY", "DE", "MD", "OH", "WV"], CT: ["NY", "MA", "RI"],
  MA: ["CT", "RI", "NH", "VT", "NY"], RI: ["MA", "CT"], NH: ["MA", "VT", "ME"],
  VT: ["NH", "NY", "MA"], ME: ["NH"], DE: ["PA", "MD", "NJ"],
  MD: ["DE", "PA", "VA", "WV", "DC"], DC: ["MD", "VA"], VA: ["MD", "NC", "TN", "WV", "DC"],
  WV: ["VA", "MD", "PA", "OH", "KY"], NC: ["VA", "SC", "GA", "TN"],
  SC: ["NC", "GA"], GA: ["SC", "NC", "TN", "AL", "FL"], FL: ["GA", "AL"],
  AL: ["GA", "FL", "MS", "TN"], MS: ["AL", "TN", "AR", "LA"], TN: ["KY", "VA", "NC", "GA", "AL", "MS", "AR", "MO"],
  KY: ["TN", "VA", "WV", "OH", "IN", "IL", "MO"], OH: ["PA", "WV", "KY", "IN", "MI"],
  IN: ["OH", "KY", "IL", "MI"], IL: ["IN", "KY", "MO", "IA", "WI"],
  MI: ["OH", "IN", "WI"], WI: ["MI", "IL", "IA", "MN"], MN: ["WI", "IA", "SD", "ND"],
  IA: ["MN", "WI", "IL", "MO", "NE", "SD"], MO: ["IA", "IL", "KY", "TN", "AR", "OK", "KS", "NE"],
  AR: ["MO", "TN", "MS", "LA", "TX", "OK"], LA: ["AR", "MS", "TX"],
  TX: ["LA", "AR", "OK", "NM"], OK: ["TX", "AR", "MO", "KS", "CO", "NM"],
  KS: ["NE", "MO", "OK", "CO"], NE: ["SD", "IA", "MO", "KS", "CO", "WY"],
  SD: ["ND", "MN", "IA", "NE", "WY", "MT"], ND: ["MN", "SD", "MT"],
  CO: ["WY", "NE", "KS", "OK", "NM", "UT"], NM: ["CO", "OK", "TX", "AZ", "UT"],
  AZ: ["NM", "UT", "NV", "CA"], UT: ["ID", "WY", "CO", "NM", "AZ", "NV"],
  NV: ["CA", "OR", "ID", "UT", "AZ"], CA: ["OR", "NV", "AZ"], OR: ["WA", "ID", "CA", "NV"],
  WA: ["OR", "ID"], ID: ["WA", "OR", "NV", "UT", "WY", "MT"], WY: ["MT", "SD", "NE", "CO", "UT", "ID"],
  MT: ["ND", "SD", "WY", "ID"], AK: [], HI: [],
};

/** Best-effort state code from free-text like "Cherry Hill, NJ" or "New Jersey". */
export function parseState(text: string): string | null {
  if (!text) return null;
  const t = text.trim();
  const upper = t.toUpperCase();
  const abbrMatch = upper.match(/\b([A-Z]{2})\b(?!.*\b[A-Z]{2}\b)/);
  if (abbrMatch && US_STATES[abbrMatch[1]]) return abbrMatch[1];
  const lower = t.toLowerCase();
  for (const [code, name] of Object.entries(US_STATES)) {
    if (lower.includes(name.toLowerCase())) return code;
  }
  return null;
}
