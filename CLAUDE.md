# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Browser Automation

Use `agent-browser` for web automation. Run `agent-browser --help` for all commands.

Core workflow:

1. `agent-browser open <url>` - Navigate to page
2. `agent-browser snapshot -i` - Get interactive elements with refs (@e1, @e2)
3. `agent-browser click @e1` / `fill @e2 "text"` - Interact using refs
4. Re-snapshot after page changes

## Commands

```bash
# Development (from repo root)
pnpm dev              # Run all packages in parallel
pnpm dev:server       # Server only (Hono on :3000)
pnpm dev:client       # Client only (Vite on :5173)
pnpm build            # Build all packages

# Database
pnpm db:generate      # Generate Drizzle migrations
pnpm db:migrate       # Run migrations

# Individual packages (from their directories)
cd packages/server && pnpm run dev    # tsx watch with .env.local
cd packages/client && pnpm run dev    # Vite dev server
```

No test runner is configured in this project.

## Architecture

**Monorepo** (pnpm workspaces) with three packages:

- **`packages/client`** — React 19 + Vite 6 + Tailwind CSS 4 + Three.js SPA
- **`packages/server`** — Hono 4.7 REST API + Drizzle ORM + PostgreSQL
- **`packages/shared`** — Zod schemas and TypeScript types shared between client/server

### Client → Server Communication

- Client calls `/api/*` endpoints (Vite proxies to `:3000` in dev)
- Auth is cookie-based: httpOnly JWT set after GitHub OAuth flow
- API helper at `packages/client/src/lib/api.ts` — always sends `credentials: "include"`
- Protected routes use `requireAuth` middleware; some use `optionalAuth`

### Server Structure

- **Entry:** `packages/server/src/index.ts` mounts all route modules under `/api`
- **Routes:** `packages/server/src/routes/*.ts` — 13 route files (auth, challenges, me, users, github, leagues, benchmarks, starred, social, suggested-opponents, badge, og, cron)
- **Services:** `packages/server/src/services/*.ts` — business logic layer
- **DB schema:** `packages/server/src/db/schema.ts` (Drizzle, all tables)
- **Auth middleware:** `packages/server/src/middleware/auth.ts` (JWT verification from session cookie)

### Key Data Model

- **Commit data** comes from two sources blended together:
  - `commit_snapshots` — GitHub API (for app users, 4-hour TTL)
  - `event_committers` — GH Archive + GitHub Events API (hourly cron, all public users)
- **Challenges** link users via `challenge_participants`; identified by `share_slug`
- **Leagues** are weekly tier-based groups (bronze→diamond), computed by cron

### Deployment

Deployed on Vercel. `api/index.ts` wraps the Hono app as a serverless function. Client builds to `packages/client/dist` as static SPA. Four cron jobs handle data ingestion and league computation.

### Environment Variables

Defined/validated in `packages/server/src/lib/env.ts`. Required: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `DATABASE_URL`, `SESSION_SECRET`. Local env file: `.env.local` at repo root.
