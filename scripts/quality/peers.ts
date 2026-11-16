// Related currencies for the peer check: a currency's move is compared with
// the median move of its region's other currencies on the same day.
// Regions, not a model: currencies in one region tend to move together
// against the SGD, and every SGD cross shares the SGD's own moves.
// BND (pegged 1:1 to the SGD, a constant series) is left out.

export const REGIONS: Record<string, readonly string[]> = {
  americas: ["USD", "CAD", "MXN", "BRL", "CLP", "COP", "PEN", "ARS"],
  europe: [
    "EUR",
    "GBP",
    "CHF",
    "DKK",
    "NOK",
    "SEK",
    "ISK",
    "CZK",
    "HUF",
    "PLN",
    "TRY",
    "RUB",
  ],
  "asia-pacific": [
    "JPY",
    "CNY",
    "HKD",
    "MOP",
    "KRW",
    "TWD",
    "THB",
    "MYR",
    "IDR",
    "PHP",
    "INR",
    "VND",
    "AUD",
    "NZD",
  ],
  "middle-east-africa-central-asia": ["ILS", "SAR", "ZAR", "MAD", "KZT"],
};

/** The other currencies in `code`'s region; [] for one not listed. */
export function peersOf(code: string): string[] {
  const region = Object.values(REGIONS).find((r) => r.includes(code));
  return region ? region.filter((c) => c !== code) : [];
}
