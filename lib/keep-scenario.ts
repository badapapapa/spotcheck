// Why this exists: the site is a static export, and the static HTML can't know
// the query string a visitor arrives with. So until React takes over, the
// Suspense fallback nav and every ScenarioLink are plain links with no query
// (`/advanced`), and following one loses the plan. A shared link on a slow
// connection is where this bites: the links are on screen well before the
// JavaScript has loaded.
//
// This small inline script closes that gap. It has to be inline, because a
// script file would arrive no sooner than the ones it stands in for. The CSP
// allows no inline script by keyword: scripts/csp-hashes.ts adds this one's
// SHA-256 hash (with Next's own inline scripts) to each page's policy after
// the build.
//
// One listener on the document, in the capture phase, so it runs before the
// browser follows the link. It only touches links marked data-keep-scenario
// and does nothing to a link that already has a query, so it is inert once
// React has filled the real hrefs in. "click" covers a tap, a mouse click,
// Enter on a focused link and Cmd/Ctrl-click; a middle-click is "auxclick".
//
// Just after hydration there is a short window where React's links are
// still bare (their query comes from a store whose server value is empty,
// and React re-renders with the real one a moment later). A tap there would
// reach Next's <Link>, which navigates client-side to its own bare href, not
// the one rewritten here. So when the script rewrites a link it also stops
// the event there: the browser then follows the rewritten href itself, a
// full page load with the scenario. Only bare links on a page with a
// scenario are affected; once the real hrefs are in, Next navigates as usual.

import { SCENARIO_KEYS } from "./url-state.ts";

export const KEEP_SCENARIO_SCRIPT = `(function () {
  var keys = ${JSON.stringify(SCENARIO_KEYS)};
  function keep(e) {
    var a = e.target.closest && e.target.closest("a[data-keep-scenario]");
    if (!a || a.search) return;
    var page = new URLSearchParams(location.search);
    var kept = new URLSearchParams();
    keys.forEach(function (k) {
      if (page.has(k)) kept.set(k, page.get(k));
    });
    // Not kept.size: it needs iOS 17, and undefined would end the script here.
    var query = kept.toString();
    if (!query) return;
    var href = a.getAttribute("href");
    a.search = query;
    // Keep React's handler (Next's <Link>) from following the bare href.
    e.stopPropagation();
    // Put it back once the browser has read it: after a Cmd-click this page
    // stays open, and React expects to find the href it rendered.
    setTimeout(function () {
      a.setAttribute("href", href);
    });
  }
  document.addEventListener("click", keep, true);
  document.addEventListener("auxclick", keep, true);
})();`;
