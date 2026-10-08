export const RESULTS = [
  { value: "pending", label: "Függőben", color: "#A1A1AA" },
  { value: "win", label: "Nyert", color: "#00E676" },
  { value: "lose", label: "Vesztett", color: "#FF3B30" },
  { value: "half_win", label: "Fél nyerés", color: "#00E676" },
  { value: "half_lose", label: "Fél vesztés", color: "#FF3B30" },
  { value: "void", label: "Érvénytelen", color: "#A1A1AA" },
];

export const RESULT_MAP = RESULTS.reduce((a, r) => ({ ...a, [r.value]: r }), {});

export const SPORTS = [
  "Labdarúgás",
  "Kosárlabda",
  "Tenisz",
  "Jégkorong",
  "Amerikai foci",
  "Baseball",
  "MMA / Ökölvívás",
  "eSport",
  "Egyéb",
];

export const MARKETS = [
  "Meccs kimenetel",
  "Hendikep",
  "Over / Under",
  "Mindkét csapat gólt szerez",
  "Szöglet",
  "Kombi",
  "Egyéb",
];

export const CURRENCIES = ["HUF", "EUR", "USD", "GBP"];
