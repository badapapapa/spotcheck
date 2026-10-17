// Client side of the compute worker: send a request, get a promise.
// Falls back to computing in the page if workers aren't available.

import type { RateInputs } from "@/engine/forwards.ts";
import {
  hedgeReplay,
  makeOptionPricer,
  type HedgeReplayResult,
  type OptionSettings,
} from "@/engine/hedge-replay.ts";
import {
  replay,
  type ReplayOptions,
  type ReplayResult,
} from "@/engine/replay.ts";
import type { Scenario, Series } from "@/engine/types.ts";

export type ComputeRequest =
  | { kind: "replay"; fx: Series; scenario: Scenario; options: ReplayOptions }
  | {
      kind: "hedge";
      inputs: RateInputs;
      scenario: Scenario;
      referenceSpot: number;
      option: OptionSettings;
    };

export type ComputeResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: string };

let worker: Worker | null | undefined;
let nextId = 0;
const pending = new Map<
  number,
  { resolve: (v: unknown) => void; reject: (e: Error) => void }
>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL("./compute.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (e: MessageEvent<ComputeResponse>) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.ok) p.resolve(e.data.result);
      else p.reject(new Error(e.data.error));
    };
  } catch {
    worker = null;
  }
  return worker;
}

function runInline(req: ComputeRequest): unknown {
  return req.kind === "replay"
    ? replay(req.fx, req.scenario, req.options)
    : hedgeReplay(
        req.inputs,
        req.scenario,
        req.referenceSpot,
        makeOptionPricer(req.inputs.fx, req.option),
      );
}

function compute(req: ComputeRequest): Promise<unknown> {
  const w = getWorker();
  if (!w) return Promise.resolve().then(() => runInline(req));
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ ...req, id });
  });
}

export const computeReplay = (
  fx: Series,
  scenario: Scenario,
  options: ReplayOptions,
) =>
  compute({ kind: "replay", fx, scenario, options }) as Promise<ReplayResult>;

export const computeHedges = (
  inputs: RateInputs,
  scenario: Scenario,
  referenceSpot: number,
  option: OptionSettings,
) =>
  compute({
    kind: "hedge",
    inputs,
    scenario,
    referenceSpot,
    option,
  }) as Promise<HedgeReplayResult>;
