import { STRATEGY_IDS } from "@/engine/types.ts";
import { STRATEGY_STYLE } from "@/lib/strategy-style.ts";
import { timing } from "@/lib/timing.ts";
import { Marker } from "./ChartLegend";

/**
 * When each strategy converts, on one shared line from the start date to
 * the deadline (lib/timing.ts). Conceptual: the rules only, no rates or
 * figures. Each row's sentence is the text equivalent of its marks.
 */
export function TimingDiagram({ tranches = 6 }: { tranches?: number }) {
  const rows = timing(tranches);
  return (
    <figure className="space-y-1" data-testid="timing-diagram">
      <figcaption className="t-h3">When each strategy converts</figcaption>
      <ol className="mt-3">
        {STRATEGY_IDS.map((id) => (
          <li
            key={id}
            className="grid gap-x-6 gap-y-2 border-b py-4 sm:grid-cols-[11rem_minmax(0,1fr)]"
          >
            <div>
              <p className="font-medium">{STRATEGY_STYLE[id].label}</p>
              <p className="t-small text-muted-foreground">
                {rows[id].caption}
              </p>
            </div>
            {/* The plan as a hairline; each conversion a marker on it. */}
            {/* Inset by half a marker, so the ends' markers stay inside. */}
            <div aria-hidden className="relative mx-2 h-6 self-center">
              <span className="absolute inset-x-0 top-1/2 h-px bg-input" />
              {rows[id].marks.map((m) => (
                <span
                  key={`${m.at}${m.fallback ? "f" : ""}`}
                  className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 ${m.fallback ? "opacity-50" : ""}`}
                  style={{ left: `${m.at * 100}%` }}
                >
                  <Marker
                    shape={STRATEGY_STYLE[id].shape}
                    color={STRATEGY_STYLE[id].color}
                  />
                </span>
              ))}
            </div>
          </li>
        ))}
      </ol>
      <div
        aria-hidden
        className="t-small flex justify-between text-muted-foreground sm:ml-[calc(11rem+1.5rem)]"
      >
        <span>Start date</span>
        <span>Deadline</span>
      </div>
      <p className="t-small pt-2 text-muted-foreground">
        The target rate&apos;s faded mark on the deadline is its fallback, used
        only when the target was never reached.
      </p>
    </figure>
  );
}
