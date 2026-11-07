"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * Wide content with a stacked alternative shows the wide form only when it
 * fits. The box gets the class `.fit`; CSS picks a layout by screen width,
 * and this hook adds `data-stacked` when the wide form would still be wider
 * than the box (a huge amount, or text zoomed to 200%). It measures with the
 * wide form shown for an instant, before the browser paints, so nothing
 * flickers.
 *
 * - A table with phone blocks: the table as `.fit-table`, the blocks as
 *   `.fit-blocks`, both children of the box.
 * - A table that restyles itself when stacked (the glance): `[data-stacked]`
 *   rules in CSS.
 *
 * `content` should change when the figures do, so a new scenario is
 * measured again.
 */
export function useFit<T extends HTMLElement>(content: unknown) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    const check = () => {
      box.removeAttribute("data-stacked");
      box.setAttribute("data-measuring", "");
      const wide = box.scrollWidth > box.clientWidth + 1;
      box.removeAttribute("data-measuring");
      box.toggleAttribute("data-stacked", wide);
    };
    check();
    // The box's width (a resize, a rotation) and the content's own size
    // (text zoom grows the table without changing the box). Checking leaves
    // both as they were, so this never loops.
    const observer = new ResizeObserver(check);
    observer.observe(box);
    if (box.firstElementChild) observer.observe(box.firstElementChild);
    // Fonts arriving late can widen the table.
    void document.fonts?.ready.then(check);
    return () => observer.disconnect();
  }, [content]);
  return ref;
}
