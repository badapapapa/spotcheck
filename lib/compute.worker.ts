// Runs the heavy replays off the main thread so typing and scrolling stay
// smooth on phones. Messages in: a request; out: its result or an error.

import { hedgeReplay, makeOptionPricer } from "@/engine/hedge-replay.ts";
import { replay } from "@/engine/replay.ts";
import type { ComputeRequest, ComputeResponse } from "./compute.ts";

function run(req: ComputeRequest): unknown {
  switch (req.kind) {
    case "replay":
      return replay(req.fx, req.scenario, req.options);
    case "hedge":
      return hedgeReplay(
        req.inputs,
        req.scenario,
        req.referenceSpot,
        makeOptionPricer(req.inputs.fx, req.option),
      );
  }
}

self.onmessage = (event: MessageEvent<ComputeRequest & { id: number }>) => {
  const { id } = event.data;
  let response: ComputeResponse;
  try {
    response = { id, ok: true, result: run(event.data) };
  } catch (err) {
    response = {
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
  self.postMessage(response);
};
