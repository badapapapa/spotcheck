"use client";

import { ChevronDown } from "lucide-react";
import { lazy, Suspense } from "react";

// The combobox (Base UI plus its positioning code) loads in its own chunk
// just after the page, so it doesn't delay the first paint. Until then a
// same-size, disabled copy of the button holds its place.
const CurrencyCombobox = lazy(() =>
  import("./CurrencyCombobox").then((m) => ({ default: m.CurrencyCombobox })),
);

type Props = {
  value: string;
  onChange: (code: string) => void;
};

export function CurrencyPicker(props: Props) {
  return (
    <Suspense fallback={<Placeholder code={props.value} />}>
      <CurrencyCombobox {...props} />
    </Suspense>
  );
}

function Placeholder({ code }: { code: string }) {
  return (
    <button
      type="button"
      disabled
      aria-label={`Currency you need: ${code}`}
      className="field-chip gap-1.5 pr-2"
    >
      {code}
      <ChevronDown
        aria-hidden
        className="size-[0.8em] text-muted-foreground"
        strokeWidth={2.5}
      />
    </button>
  );
}
