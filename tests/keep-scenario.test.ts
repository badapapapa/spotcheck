import { describe, expect, it, vi } from "vitest";
import { KEEP_SCENARIO_SCRIPT } from "@/lib/keep-scenario.ts";
import { parseState, SCENARIO_KEYS, serializeState } from "@/lib/url-state.ts";

type Listener = (e: { target: unknown }) => void;

/** Runs the inline script against a stand-in document and page URL. */
function load(search: string, Params: unknown = URLSearchParams) {
  const added: { type: string; fn: Listener; capture: unknown }[] = [];
  const timers: (() => void)[] = [];
  new Function(
    "document",
    "location",
    "setTimeout",
    "URLSearchParams",
    KEEP_SCENARIO_SCRIPT,
  )(
    {
      addEventListener: (type: string, fn: Listener, capture: unknown) =>
        added.push({ type, fn, capture }),
    },
    { search },
    (fn: () => void) => timers.push(fn),
    Params,
  );
  return { added, timers };
}

function link(search = "", href = "/advanced") {
  const a = {
    search,
    href,
    getAttribute: () => a.href,
    setAttribute: vi.fn((_: string, v: string) => {
      a.href = v;
    }),
  };
  return a;
}

/** An event from something inside `a`, as `closest` would find it. */
const inside = (a: unknown) => ({
  target: {
    closest: (s: string) => (s.includes("data-keep-scenario") ? a : null),
  },
});

function clickOn(pageSearch: string, a: ReturnType<typeof link>) {
  const page = load(pageSearch);
  page.added[0]!.fn(inside(a));
  return page;
}

describe("the inline script that keeps the scenario", () => {
  it("lists every key a scenario is written with, and not `from`", () => {
    const state = {
      ...parseState(new URLSearchParams(), "2026-10-17"),
      volOverride: 0.1,
      from: { currency: "JPY", amount: 500_000 },
    };
    const written = [...serializeState(state, { complete: true }).keys()];
    expect([...SCENARIO_KEYS, "from"].sort()).toEqual(written.sort());
  });

  it("listens once each for click and auxclick, in the capture phase", () => {
    expect(load("").added.map((l) => [l.type, l.capture])).toEqual([
      ["click", true],
      ["auxclick", true],
    ]);
  });

  it("copies the scenario keys and nothing else", () => {
    const a = link();
    clickOn("?c=USD&a=9000&from=JPY.500000&utm_source=x&vl=60", a);
    expect(a.search).toBe("c=USD&a=9000&vl=60");
  });

  it("works without URLSearchParams.size, which iOS 16 lacks", () => {
    class Older extends URLSearchParams {
      override get size(): number {
        return undefined as unknown as number;
      }
    }
    const a = link();
    load("?a=9000", Older).added[0]!.fn(inside(a));
    expect(a.search).toBe("a=9000");
  });

  it("leaves a link that already has a query alone", () => {
    const a = link("?a=1");
    const { timers } = clickOn("?a=9000", a);
    expect(a.search).toBe("?a=1");
    expect(timers).toHaveLength(0);
  });

  it("leaves the link alone when the page has no scenario", () => {
    const a = link();
    const { timers } = clickOn("?from=JPY.500000&utm_source=x", a);
    expect(a.search).toBe("");
    expect(timers).toHaveLength(0);
  });

  it("ignores anything but a marked link", () => {
    const { added, timers } = load("?a=9000");
    added[0]!.fn({ target: { closest: () => null } });
    added[0]!.fn({ target: {} });
    expect(timers).toHaveLength(0);
  });

  it("puts the href back afterwards", () => {
    const a = link();
    const { timers } = clickOn("?a=9000", a);
    expect(a.setAttribute).not.toHaveBeenCalled();
    timers[0]!();
    expect(a.setAttribute).toHaveBeenCalledWith("href", "/advanced");
  });
});
