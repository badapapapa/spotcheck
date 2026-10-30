"use client";

import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { findCurrency, type CurrencyInfo } from "@/engine/currencies.ts";
import { orderedCurrencies, searchCurrencies } from "@/lib/currency-search.ts";

type Group = { value: string; items: CurrencyInfo[] };

const { popular, rest } = orderedCurrencies();
const GROUPS: Group[] = [
  { value: "Popular destinations", items: popular },
  { value: "All currencies", items: rest },
];

/**
 * The currency button inside the converter sentence. It opens a list with a
 * search field that matches codes, currency names and countries ("Japan"
 * finds JPY). Base UI handles the listbox semantics, arrow keys, Enter and
 * Esc; the matching is ours (lib/currency-search.ts).
 */
export function CurrencyCombobox({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (code: string) => void;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const selected = findCurrency(value)!;
  const filtered = useMemo<Group[]>(
    () =>
      query.trim() === ""
        ? GROUPS
        : [{ value: "Matches", items: searchCurrencies(query) }],
    [query],
  );

  return (
    <Combobox.Root
      items={GROUPS}
      filteredItems={filtered}
      value={selected}
      onValueChange={(c: CurrencyInfo | null) => c && onChange(c.code)}
      inputValue={query}
      onInputValueChange={setQuery}
      onOpenChange={(open) => !open && setQuery("")}
      isItemEqualToValue={(a: CurrencyInfo, b: CurrencyInfo) =>
        a.code === b.code
      }
      itemToStringLabel={(c: CurrencyInfo) => c.code}
      autoHighlight
    >
      {/* The name includes the visible code, so voice users can say it. */}
      <Combobox.Trigger
        aria-label={`Currency you need: ${selected.code}`}
        className={`field-chip gap-1.5 pr-2 ${className}`}
      >
        <span aria-hidden className="font-sans text-[0.9em]">
          {selected.flag}
        </span>
        {selected.code}
        <ChevronDown
          aria-hidden
          className="size-[0.8em] text-muted-foreground"
          strokeWidth={2.5}
        />
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner align="start" sideOffset={6} className="z-50">
          <Combobox.Popup
            aria-label="Choose a currency"
            className="w-[min(22rem,var(--available-width))] overflow-hidden rounded-[10px] border bg-card text-foreground shadow-[var(--shadow-panel)]"
          >
            <div className="flex items-center gap-2 border-b px-3">
              <Search
                aria-hidden
                className="size-4 shrink-0 text-muted-foreground"
              />
              <Combobox.Input
                aria-label="Search by country, currency or code"
                placeholder="Country, currency or code"
                className="h-12 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
              />
            </div>
            <Combobox.Empty>
              <p className="px-4 py-6 text-sm text-muted-foreground">
                No currency matches &ldquo;{query}&rdquo;.
              </p>
            </Combobox.Empty>
            <Combobox.List className="max-h-[min(22rem,calc(var(--available-height)-3.5rem))] overflow-y-auto overscroll-contain py-1">
              {(group: Group) => (
                <Combobox.Group key={group.value} items={group.items}>
                  <Combobox.GroupLabel className="px-4 pt-3 pb-1 text-xs font-medium text-muted-foreground">
                    {group.value}
                  </Combobox.GroupLabel>
                  <Combobox.Collection>
                    {(c: CurrencyInfo) => (
                      <Combobox.Item
                        key={c.code}
                        value={c}
                        className="grid min-h-11 cursor-default grid-cols-[1.5rem_3rem_1fr_1rem] items-center gap-2 px-4 text-[15px] select-none data-highlighted:bg-sunken"
                      >
                        <span aria-hidden>{c.flag}</span>
                        <span className="font-semibold tabular-nums">
                          {c.code}
                        </span>
                        <span className="truncate text-muted-foreground">
                          {c.name}
                        </span>
                        <Combobox.ItemIndicator>
                          <Check aria-hidden className="size-4 text-link" />
                        </Combobox.ItemIndicator>
                      </Combobox.Item>
                    )}
                  </Combobox.Collection>
                </Combobox.Group>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
