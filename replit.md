# agent-pay-for-urself

A Korean multi-agent investment platform console that runs a multi-step AI workflow pipeline to analyze stocks, generate investment reports, and plan orders.

## Run & Operate

- `PORT=23827 BASE_PATH=/ pnpm --filter @workspace/agent-pay-for-urself run dev` — run the frontend (Vite, port 23827)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: Vite + React + wouter (SPA)
- API: Express 5 (Node.js)
- Python FastAPI backend in `.migration-backup/` (original source)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Styling: Custom CSS (no Tailwind) in `src/styles.css`

## Where things live

- `artifacts/agent-pay-for-urself/` — Vite + React frontend
  - `src/App.tsx` — router and shell layout
  - `src/styles.css` — complete CSS theme (no Tailwind)
  - `src/lib/workspace.ts` — all types, helpers, normalizers, formatters
  - `src/lib/api.ts` — `fetchJson()`, `buildApiUrl()`, `ApiError`
  - `src/components/SiteNav.tsx` — sidebar + topbar
  - `src/components/WorkflowHome.tsx` — main console home page
  - `src/components/AgentWorkspace.tsx` — per-agent prompt editor + output viewer
  - `src/components/AccountOverview.tsx` — broker account status
  - `src/components/WorkflowReports.tsx` — saved experiment reports
  - `src/components/PromptSettings.tsx` — agent prompts + workspace defaults
- `artifacts/api-server/` — Express backend (to be built out)
- `.migration-backup/` — original Next.js + FastAPI source

## Architecture decisions

- Custom CSS only (no Tailwind) — the original Next.js app used pure CSS classes; `src/styles.css` is the single theme file
- `wouter` for routing — replaces Next.js `<Link>` and `usePathname()`
- All API calls go via `fetchJson()` → `/api/*` paths; `buildApiUrl()` handles optional `VITE_API_BASE_URL` env var
- Result/chat history persisted in `localStorage` — no backend DB needed for frontend state
- PORT and BASE_PATH must be set when running the dev server (handled by workflow command)

## Product

- **메인화면 (WorkflowHome)**: Start workflow runs, chat with follow-up assistant, save reports
- **계좌 상태 (AccountOverview)**: Broker connection config, portfolio summary + holdings table
- **보고서 (WorkflowReports)**: Browse and review saved experiment reports with full detail
- **에이전트 (AgentWorkspace)**: Per-agent prompt editor and latest output viewer
- **프롬프트 설정 (PromptSettings)**: Bulk agent prompt management + workspace defaults

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Vite dev server requires `PORT` and `BASE_PATH` env vars at startup — set them in the workflow command
- `src/index.css` imports Tailwind in the scaffold but is unused — replaced with a stub; all styles are in `src/styles.css`
- The original Python FastAPI backend is in `.migration-backup/` for reference; the Node.js Express API server needs to be built out to match its endpoints

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
