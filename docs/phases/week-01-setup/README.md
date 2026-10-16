# Week 1 · Phase 0: Setup

**Status:** built and merged on `main`. CI green.

## What was built

| Item | Where |
| --- | --- |
| Next.js 16 App Router, static export to `out/` | `next.config.ts` |
| TypeScript strict (+ `noUncheckedIndexedAccess`, no `any`) | `tsconfig.json`, `eslint.config.mjs` |
| Tailwind CSS v4 + shadcn/ui (base-nova style) | `app/globals.css`, `components/ui/`, `components.json` |
| ESLint + Prettier, Vitest, `npm run check` | `package.json`, `vitest.config.mts`, `.prettierrc.json` |
| Header, tagline, disclaimer footer on every page | `app/layout.tsx`, `lib/site.ts` |
| Test that blocks advisory wording ("best", "recommended", "you should"...) in UI code | `tests/advisory-wording.test.ts` |
| CI: type-check, lint, tests, build, gitleaks full-history scan | `.github/workflows/ci.yml` |
| Dependabot (minor/patch only; majors by hand) | `.github/dependabot.yml` |
| Security headers + CSP for Cloudflare Pages | `public/_headers` |
| `.env` ignored, `.env.example` with placeholder | `.gitignore`, `.env.example` |
| Private repo | https://github.com/badapapapa/spotcheck |

## Decisions made along the way

- Dark mode follows the OS setting (pure CSS, nothing stored).
- gitleaks runs as a checksum-verified CLI over the whole history instead of `gitleaks-action`, which fails on a repo's first push.
- The lockfile was regenerated once because npm on macOS dropped Linux-only optional packages.
- `npm audit` reports 5 "high" issues inside `eslint-config-next`'s dev tooling (`braces`); they never ship to the browser, and the only fix offered downgrades Next.js.

## [BEN] still to do for Gate 0

1. **Cloudflare Pages:** Workers & Pages → Create → Pages → Connect to Git → `badapapapa/spotcheck`. Framework preset "Next.js (Static HTML Export)", build command `npm run build`, output directory `out`, environment variable `NODE_VERSION=24`. Then turn on Web Analytics for the site.
2. **Secret scanning / push protection:** GitHub doesn't offer these for private repos on a free personal plan (the API reports them as unavailable). Turn them on when the repo goes public; gitleaks covers it until then.
