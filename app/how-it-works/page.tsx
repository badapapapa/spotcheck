import type { Metadata } from "next";
import { ScenarioDataNote } from "../components/DataNote";
import { ScenarioLink } from "../components/ScenarioLink";
import meta from "@/data/meta.json";
import { CURRENCIES } from "@/engine/currencies.ts";
import { formatDate } from "@/lib/dates.ts";
import { DISCLAIMER } from "@/lib/site";
import { METHOD } from "../components/Methodology";
import { HISTORICAL_CONTEXT } from "../components/Glance";
import { StrategyGuide } from "../components/StrategyGuide";

export const metadata: Metadata = {
  title: "How it works | SpotCheck",
  description:
    "The four strategies, how SpotCheck replays them against past exchange rates, where the data comes from and what the results can't tell you.",
};

const method = (id: string) => METHOD.find((m) => m.id === id)!;

/**
 * Explanations, method, data and limits on one page (DESIGN.md §1: the
 * method is a trust feature, so it gets a page of its own rather than a
 * footer link). Fully static: every figure comes from the committed data.
 */
export default function HowItWorks() {
  const bySource = (s: string) => CURRENCIES.filter((c) => c.fxSource === s);
  const ecb = bySource("ecb");
  const blended = bySource("blended");
  const ratesTo = formatDate(meta.series["SGD-USD"]?.last ?? "");
  const first = formatDate(meta.series["SGD-USD"]?.first ?? "");

  const toc: [string, string][] = [
    ["question", "The question"],
    ["strategies", "The four strategies"],
    ["replay", "The method"],
    ["data", "The data"],
    ["limits", "What it can't tell you"],
    ["about", "About SpotCheck"],
  ];

  return (
    <div className="page pt-10 lg:pt-16">
      <div className="max-w-4xl">
        <h1 className="t-h1">How SpotCheck works</h1>
        <p className="t-lede mt-5">
          SpotCheck answers one question with history: for an amount you need by
          a date, how did different ways of converting it work out in every
          comparable past period?
        </p>
      </div>

      <div className="mt-12 lg:mt-16 lg:grid lg:grid-cols-12 lg:gap-6">
        <nav
          aria-label="On this page"
          className="hidden lg:col-span-3 lg:block"
        >
          <ol className="t-small sticky top-8 border-l">
            {toc.map(([id, label]) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="-ml-px flex min-h-11 items-center border-l-2 border-transparent pl-4 text-muted-foreground hover:border-ink hover:text-ink"
                >
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="lg:col-span-8 lg:col-start-5">
          <Part id="question" title="The question">
            <p>
              Exchange students usually know two things: how much foreign
              currency they need, and when. What they don&apos;t know is whether
              to convert it all now, spread it out, wait, or hold out for a
              better rate.
            </p>
            <p>
              Nobody knows which way exchange rates move next. What can be known
              is how each of those approaches would have worked out, had the
              same plan started on any day since {first}. SpotCheck replays your
              plan over every one of those periods and shows the range of costs,
              rescaled to today&apos;s rate. The result is a record of what
              happened, not a forecast.
            </p>
          </Part>

          <Part id="strategies" title="The four strategies">
            <StrategyGuide />
          </Part>

          <Part id="replay" title="The method">
            {(["replay", "rescaling", "trends", "overlap"] as const).map(
              (id) => (
                <div key={id} className="space-y-3">
                  <h3 className="t-h3">{method(id).title}</h3>
                  {method(id).body}
                </div>
              ),
            )}
          </Part>

          <Part id="data" title="The data">
            <div className="space-y-3">{method("sources").body}</div>
            <dl className="mt-2 grid gap-x-8 border-t sm:grid-cols-[12rem_minmax(0,1fr)]">
              <dt className="pt-4 font-medium">
                ECB reference rates ({ecb.length})
              </dt>
              <dd className="t-small border-b pt-1 pb-4 text-muted-foreground sm:pt-4">
                {ecb.map((c) => c.code).join(", ")}
              </dd>
              <dt className="pt-4 font-medium">
                Frankfurter blended ({blended.length})
              </dt>
              <dd className="t-small border-b pt-1 pb-4 text-muted-foreground sm:pt-4">
                {blended.map((c) => c.code).join(", ")}
              </dd>
              <dt className="pt-4 font-medium">Fixed peg (1)</dt>
              <dd className="t-small border-b pt-1 pb-4 text-muted-foreground sm:pt-4">
                BND, pegged 1:1 to the Singapore dollar
              </dd>
              <dt className="pt-4 font-medium">Interest rates</dt>
              <dd className="t-small border-b pt-1 pb-4 text-muted-foreground sm:pt-4">
                SORA from the Monetary Authority of Singapore and the US federal
                funds rate from FRED, used only on the Hedging page.
              </dd>
            </dl>
            <ScenarioDataNote />
            <p>
              Rates run from {first} to {ratesTo}. An automated job adds each
              working day&apos;s rates, checks them and rebuilds the site.
            </p>
            <ul className="t-small">
              {meta.attribution.map((source) => (
                <li key={source.name}>
                  <a
                    href={source.url}
                    className="link inline-flex min-h-11 items-center"
                  >
                    {source.name}
                  </a>
                </li>
              ))}
            </ul>
          </Part>

          <Part id="limits" title="What it can't tell you">
            <p>{HISTORICAL_CONTEXT}</p>
            <p>
              How the strategies compare depends on three things: the currency
              pair, the direction its rate was moving during the periods tested,
              and the length of the window. A strategy that cost less across one
              currency&apos;s history may have cost more across another&apos;s,
              because their trends differed. The US dollar&apos;s history says
              nothing about the yen&apos;s or the euro&apos;s; each currency is
              replayed against its own rates only. Changing the currency, the
              dates or the number of conversions in the planner shows how much
              the comparison moves.
            </p>
            {method("limits").body}
            <p>
              The rates are mid-market reference rates. Banks, cards and money
              changers charge more; the spread setting adds that cost to every
              conversion, but your provider&apos;s fees may differ from it.
            </p>
            <p>
              The Hedging page prices forwards and options from past overnight
              interest rates and past volatility, a stand-in for the quotes a
              bank would give. A real quote differs. The Hedging page covers USD
              only for now.
            </p>
          </Part>

          <Part id="about" title="About SpotCheck">
            <p>
              SpotCheck is a free, independent educational project for students
              going on exchange. It has no accounts, sets no cookies and stores
              nothing about you: your scenario lives only in the page&apos;s
              address, which is how a copied link reproduces it.
            </p>
            <p className="font-medium">{DISCLAIMER}</p>
            <p>
              <ScenarioLink href="/">Back to the planner</ScenarioLink>
            </p>
          </Part>
        </div>
      </div>
    </div>
  );
}

function Part({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-8 border-t pt-8 pb-16 first:border-t-0 first:pt-0"
    >
      <h2 id={`${id}-title`} className="t-h2">
        {title}
      </h2>
      <div className="prose-measure mt-6 space-y-5">{children}</div>
    </section>
  );
}
