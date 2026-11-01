"use client";

import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
  // Base UI's list navigation keeps closures that point at each closed
  // list, so every open left ~40 detached options (+318 nodes, 42
  // listeners) behind. A fresh combobox after each close lets the old one
  // be collected; focus goes back to the button, as Base UI would do.
  const [generation, setGeneration] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);
  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    trigger.current?.focus();
  }, [generation]);
  const selected = findCurrency(value)!;
  // No group at all when nothing matches, so the empty message shows
  // (an empty "Matches" group used to hide it).
  const filtered = useMemo<Group[]>(() => {
    if (query.trim() === "") return GROUPS;
    const matches = searchCurrencies(query);
    return matches.length > 0 ? [{ value: "Matches", items: matches }] : [];
  }, [query]);

  return (
    <Combobox.Root
      key={generation}
      items={GROUPS}
      filteredItems={filtered}
      value={selected}
      onValueChange={(c: CurrencyInfo | null) => c && onChange(c.code)}
      inputValue={query}
      onInputValueChange={setQuery}
      onOpenChange={(open) => {
        if (open) return;
        setQuery("");
        // After Base UI has finished closing (and returned focus).
        setTimeout(() => {
          refocus.current = document.activeElement === trigger.current;
          setGeneration((g) => g + 1);
        });
      }}
      isItemEqualToValue={(a: CurrencyInfo, b: CurrencyInfo) =>
        a.code === b.code
      }
      itemToStringLabel={(c: CurrencyInfo) => c.code}
      autoHighlight
    >
      {/* The name includes the visible code, so voice users can say it. */}
      <Combobox.Trigger
        ref={trigger}
        aria-label={`Currency you need: ${selected.code}`}
        className={`field-chip gap-1.5 pr-2 ${className}`}
      >
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
            className="w-[min(22rem,var(--available-width))] overflow-hidden rounded-md border bg-surface text-foreground shadow-[var(--shadow-pop)]"
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
              <div className="px-4 py-5" data-testid="no-match">
                <p className="text-sm font-medium">
                  No currency matches &ldquo;{query.trim()}&rdquo;.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try a country (Japan), a currency name (yen) or a code (JPY).
                </p>
              </div>
            </Combobox.Empty>
            <Combobox.List className="max-h-[min(22rem,calc(var(--available-height)-3.5rem))] overflow-y-auto overscroll-contain py-1">
              {(group: Group) => (
                <Combobox.Group key={group.value} items={group.items}>
                  <Combobox.GroupLabel className="px-4 pt-3 pb-1 text-annotation font-medium text-muted-foreground">
                    {group.value}
                  </Combobox.GroupLabel>
                  <Combobox.Collection>
                    {(c: CurrencyInfo) => (
                      <Combobox.Item
                        key={c.code}
                        value={c}
                        // Selected: the check and a green tint. Highlighted
                        // (pointer or arrow keys): the sunken band, which
                        // wins when the two coincide; the check stays.
                        className="grid min-h-11 cursor-default grid-cols-[3rem_1fr_1rem] items-center gap-2 px-4 text-ui select-none data-highlighted:bg-sunken data-selected:not-data-highlighted:bg-accent-soft"
                      >
                        <span className="font-semibold tabular-nums">
                          {c.code}
                        </span>
                        <span className="truncate text-muted-foreground">
                          {c.name}
                        </span>
                        <Combobox.ItemIndicator>
                          <Check aria-hidden className="size-4 text-accent" />
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
