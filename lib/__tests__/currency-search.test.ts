import { describe, expect, it } from "vitest";
import { CURRENCIES } from "@/engine/currencies.ts";
import {
  POPULAR,
  countriesFor,
  orderedCurrencies,
  searchCurrencies,
} from "../currency-search.ts";

const codes = (q: string) => searchCurrencies(q).map((c) => c.code);

describe("searchCurrencies", () => {
  it("lists every currency once, popular destinations first", () => {
    const all = codes("");
    expect(all.slice(0, POPULAR.length)).toEqual(POPULAR);
    expect(new Set(all).size).toBe(CURRENCIES.length);
    const rest = all.slice(POPULAR.length);
    expect(rest).toEqual([...rest].sort());
  });

  it("matches country names", () => {
    expect(codes("Japan")[0]).toBe("JPY");
    expect(codes("Korea")[0]).toBe("KRW");
    expect(codes("korea")[0]).toBe("KRW");
    expect(codes("Germany")).toEqual(["EUR"]);
    expect(codes("UK")[0]).toBe("GBP");
    expect(codes("Vietnam")).toEqual(["VND"]);
    expect(codes("turkiye")).toEqual(["TRY"]); // accents folded
  });

  it("matches codes and currency names, strongest first", () => {
    expect(codes("usd")[0]).toBe("USD");
    expect(codes("yen")).toEqual(["JPY"]);
    // Every dollar currency, with the exact-prefix ones before substrings.
    const dollars = codes("dollar");
    expect(dollars).toContain("AUD");
    expect(dollars).toContain("NZD");
    expect(dollars[0]).toBe("USD"); // popular order breaks the tie
    expect(codes("zzz")).toEqual([]);
  });

  it("has search terms for every currency", () => {
    for (const c of CURRENCIES) {
      expect(countriesFor(c.code).length, c.code).toBeGreaterThan(0);
    }
    const { popular, rest } = orderedCurrencies();
    expect(popular.length + rest.length).toBe(CURRENCIES.length);
  });
});
