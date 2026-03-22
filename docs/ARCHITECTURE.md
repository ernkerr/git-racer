# Git Racer Architecture

A competitive commit-tracking platform that turns GitHub activity into a game. Race friends, climb leaderboards, and compete in weekly leagues — all based on real commit data.

## Table of Contents

- [How It All Fits Together](#how-it-all-fits-together)
- [Project Structure](#project-structure)
- [Data Pipeline](#data-pipeline)
- [The Dual-Source Blending Strategy](#the-dual-source-blending-strategy)
- [Leaderboard](#leaderboard)
- [Weekly Leagues](#weekly-leagues)
- [Races (Challenges)](#races-challenges)
- [Social Features](#social-features)
- [Authentication](#authentication)
- [Database Schema](#database-schema)
- [Cron Jobs](#cron-jobs)
- [Anti-Cheat](#anti-cheat)
- [Reliability & Safety](#reliability--safety)
- [Deployment](#deployment)
- [API Reference](#api-reference)

---

## How It All Fits Together

```
┌──────────────────────────────────────────────────────────────────┐
│                         Git Racer                                │
│                                                                  │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────────┐  │
│  │   React SPA │───▶│  Hono API    │───▶│    PostgreSQL        │  │
│  │  (client)   │◀───│  (server)    │◀───│                      │  │
│  └─────────────┘    └──────┬───────┘    └─────────────────────┘  │
│                            │                       ▲              │
│                            │                       │              │
│                     ┌──────┴───────┐               │              │
│                     │  Cron Jobs   │───────────────┘              │
│                     └──────┬───────┘                              │
│                            │                                      │
│              ┌─────────────┼─────────────┐                       │
│              ▼             ▼             ▼                        │
│     ┌──────────────┐ ┌──────────┐ ┌──────────────┐              │
│     │  GH Archive  │ │ GitHub   │ │ GitHub       │              │
│     │  (hourly     │ │ GraphQL  │ │ Events API   │              │
│     │   archives)  │ │ API      │ │ (real-time)  │              │
│     └──────────────┘ └──────────┘ └──────────────┘              │
└──────────────────────────────────────────────────────────────────┘
```

The app has three data sources feeding into one database, a Hono API serving it, and a React SPA displaying it. Cron jobs run on Vercel to keep everything fresh.

---

## Project Structure

```
git-racer/
├── api/index.ts                  # Vercel serverless entry point
├── vercel.json                   # Deployment config + cron schedules
├── packages/
│   ├── client/                   # React 19 + React Router v7 + Tailwind v4
│   │   └── src/
│   │       ├── pages/            # Landing, Dashboard, Challenge, CreateChallenge
│   │       ├── components/       # Leaderboard, LeagueCard, StreakCard, etc.
│   │       └── lib/              # api.ts (fetch wrapper), auth.tsx (context)
│   │
│   ├── server/                   # Hono REST API
│   │   └── src/
│   │       ├── app.ts            # Route mounting, CORS, error handling
│   │       ├── routes/           # 12 route files (auth, me, leaderboard, etc.)
│   │       ├── services/         # Business logic (commits, leagues, streaks, etc.)
│   │       ├── middleware/       # auth.ts (requireAuth / optionalAuth)
│   │       ├── db/               # Drizzle ORM schema + connection
│   │       └── lib/              # env, jwt, dates, bot-filter, advisory-lock
│   │
│   └── shared/                   # TypeScript types, constants, Zod validation
│       └── src/
│           ├── types.ts          # All shared interfaces
│           ├── constants.ts      # Cache TTLs, league config, limits
│           └── validation.ts     # Zod schemas for API input
```

**Why a monorepo?** The client and server share types and constants. A pnpm workspace keeps them in sync without publishing packages. The shared package means a type change in one place updates everywhere at build time.

**Why Hono?** It's fast, lightweight, and runs natively on Vercel serverless. Everything deploys as a single serverless function (`api/index.ts`) that routes internally via Hono, avoiding cold-start overhead from many separate functions.

---

## Data Pipeline

This is the most important design decision in the app. We need commit counts for millions of GitHub users, but GitHub doesn't provide a "global leaderboard" API. So we built a pipeline from three sources:

```
                    ┌──────────────────────────────────┐
                    │          DATA SOURCES             │
                    └──────────────────────────────────┘

 ┌─────────────────────┐  ┌─────────────────────┐  ┌──────────────────────┐
 │    GH Archive        │  │  GitHub GraphQL      │  │  GitHub Events API   │
 │                      │  │                      │  │                      │
 │  Every public event  │  │  Contribution         │  │  Real-time stream    │
 │  on GitHub, archived │  │  calendar for a       │  │  of public events.   │
 │  hourly as gzipped   │  │  specific user.       │  │  Polls 300 events    │
 │  NDJSON files.       │  │  Includes private     │  │  every 10 minutes.   │
 │                      │  │  repo commits.        │  │                      │
 │  ⏱ Hourly cron       │  │  ⏱ Hourly (top 10)   │  │  ⏱ Every 10 min      │
 │  📊 ~500K+ pushes/hr │  │  📊 10 users/call     │  │  📊 ~300 events/call │
 └──────────┬──────────┘  └──────────┬──────────┘  └──────────┬───────────┘
            │                        │                         │
            ▼                        ▼                         ▼
   ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
   │ event_committers │      │ commit_snapshots │      │ event_committers │
   │ (username+date)  │      │ (username+date)  │      │ (adds to totals)│
   └────────┬────────┘      └────────┬────────┘      └────────┬────────┘
            │                        │                         │
            └────────────┬───────────┘─────────────────────────┘
                         ▼
              ┌────────────────────┐
              │   Leaderboard      │
              │   FULL OUTER JOIN  │
              │   + GREATEST()     │
              └────────────────────┘
```

### Why three sources?

| Source | Pros | Cons |
|--------|------|------|
| **GH Archive** | Covers every public GitHub user. Complete hourly snapshots. | ~2 hour delay. Only public repos. Commit counts per push are estimates. |
| **GitHub GraphQL** | Exact commit counts. Includes private repos. | Rate-limited (5000 points/hr). Can only query one user at a time. |
| **GitHub Events API** | Near-real-time (seconds old). Free with ETags. | Only ~300 events per call. Tiny sample of global activity. |

**GH Archive is the backbone** — it's the only way to get data for users who haven't signed up. **GraphQL enriches the top 10** with accurate numbers. **Events API fills the gap** between archive publications for the "Today" tab.

### Processing flow

1. **Hourly**: `ingest-events` cron downloads one GH Archive hour (~100-500MB gzipped), stream-decompresses through a pipeline (`fetch body → gunzip → readline`), parses PushEvents line-by-line, aggregates commits per user, and atomically upserts into `event_committers` + marks the hour as ingested in a single transaction
2. **Hourly**: After ingestion, `enrichTopUsers()` takes today's top 10 from `event_committers`, fetches their real commit counts via GraphQL batch query, stores in `commit_snapshots`
3. **Every 10 min**: `poll-events` hits the GitHub Events API with ETags (304 = free), captures PushEvents, adds commit counts to `event_committers`
4. **Daily at midnight**: `daily-seed` fetches contribution data for 150 top GitHub users, populating `commit_snapshots` for the day

---

## The Dual-Source Blending Strategy

The leaderboard query is the core algorithm. It needs to show the best available data for every user:

```sql
SELECT COALESCE(ec.username, cs.username) AS username,
       GREATEST(
         COALESCE(ec.commits, 0),  -- GH Archive estimate
         COALESCE(cs.commits, 0)   -- Real GraphQL count
       ) AS commit_count
FROM event_committers ec
FULL OUTER JOIN commit_snapshots cs
  ON ec.username = cs.username
```

**Why FULL OUTER JOIN?** Some users only exist in GH Archive (non-app users). Some only exist in commit_snapshots (app users with private repos). The join ensures both are represented.

**Why GREATEST?** GH Archive estimates can be lower than reality (missing private commits) or slightly different due to how pushes are counted. `GREATEST()` always picks the higher, more accurate number. This works because:
- If only archive data exists → uses archive data
- If only GraphQL data exists → uses GraphQL data
- If both exist → picks the higher one (GraphQL is usually higher because it includes private repos)

---

## Leaderboard

```
┌──────────────────────────────────────────┐
│              Leaderboard                  │
│                                           │
│  ┌──────┬──────────┬─────────┬─────────┐ │
│  │Today │This Week │This Mo. │This Year│ │
│  └──┬───┴──────────┴─────────┴─────────┘ │
│     │                                     │
│  Period → periodRange() → {start, end}    │
│     │                                     │
│     ▼                                     │
│  ┌──────────────────────────────────────┐ │
│  │  day   → today .. today             │ │
│  │  week  → Monday .. today            │ │
│  │  month → 1st .. today               │ │
│  │  yearly→ Jan 1 .. today             │ │
│  └──────────────────────────────────────┘ │
│     │                                     │
│     ▼                                     │
│  Blended query (event_committers          │
│  FULL OUTER JOIN commit_snapshots)        │
│  → Top 100, sorted by commit_count DESC   │
└──────────────────────────────────────────┘
```

For multi-day periods (week, month, year), the query sums each user's daily counts across the date range. The client shows the top 10 by default with a "Show more" button for lazy loading.

**"Today" specifically** only shows today's date. If no data has been ingested yet (e.g., just after midnight UTC), it shows empty rather than falling back to yesterday's stale data. The hourly cron and 10-minute polling keep it populated throughout the day.

---

## Weekly Leagues

A tier-based competition system inspired by Duolingo's leagues:

```
                    ┌───────────┐
                    │  Diamond  │  ← Top tier
                    ├───────────┤
                    │ Platinum  │
                    ├───────────┤
                    │   Gold    │
                    ├───────────┤
                    │  Silver   │
                    ├───────────┤
                    │  Bronze   │  ← Starting tier
                    └───────────┘

    Each tier has groups of 30 members.
    Each week:
      🏆 Top 5 → promoted to next tier
      📉 Bottom 5 → demoted to lower tier
      🔄 Middle 20 → stay in current tier
```

### How group assignment works

When a user first requests their league, they're lazily assigned:

1. Determine tier (new users start at Bronze)
2. Find an open group in that tier (< 30 members) for the current week
3. If no open group exists, create a new one
4. Fill empty slots with "ghost" members from the `suggested_opponents` pool, matched by similar commit activity levels
5. This creates a competitive group that feels full and balanced, even early on

### Weekly lifecycle

```
Monday 00:00 UTC         Sunday 23:59 UTC    Monday 07:00 UTC
     │                          │                    │
     │  ◀── Active week ──▶    │                    │
     │  Users accumulate        │    Finalization:   │
     │  weekly commits          │    - Rank members  │
     │                          │    - Flag promote  │
     │                          │    - Flag demote   │
     │                          │    - New week starts│
```

**Why ghosts?** Without them, early groups would have 2-3 real users competing against nothing. Ghosts are real GitHub users from the `suggested_opponents` pool whose public commit data we already track. They don't know they're in a league — they're just providing a benchmark.

---

## Races (Challenges)

Head-to-head or team competitions:

```
┌─────────────────────────────────────────────────┐
│                  Race Types                      │
│                                                  │
│  ┌───────────────┐      ┌────────────────────┐  │
│  │    1v1         │      │      Team          │  │
│  │  2 participants│      │  Up to 50 members  │  │
│  │  Creator picks │      │  Anyone can join   │  │
│  │  the opponent  │      │  via share link    │  │
│  └───────────────┘      └────────────────────┘  │
│                                                  │
│  Duration Types:                                 │
│  ┌────────────────────────────────────────────┐  │
│  │ fixed   │ Set end date, most commits wins  │  │
│  │ ongoing │ No end date, runs indefinitely   │  │
│  │ goal    │ First to N commits wins          │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  Each race has a unique 8-char share slug:       │
│  gitracer.dev/c/a8f3k2m1                        │
└─────────────────────────────────────────────────┘
```

**Ghost participants**: When you create a 1v1 race against someone who hasn't signed up, they're added as a "ghost." Their public commit data is tracked through GH Archive, so the race still works — they just won't see it unless they sign up and check the link.

---

## Social Features

```
┌──────────────────────────────────────────────────────┐
│                                                       │
│  ┌─────────────────┐   ┌──────────────────────────┐  │
│  │  Starred Users   │   │   Social Circle          │  │
│  │                  │   │                           │  │
│  │  "Star" any      │   │  Your GitHub following    │  │
│  │  GitHub user to  │   │  list, ranked by this     │  │
│  │  track against.  │   │  week's commits.          │  │
│  │                  │   │                           │  │
│  │  Shows:          │   │  Shows where you rank     │  │
│  │  - Their commits │   │  among people you follow. │  │
│  │  - Your commits  │   │                           │  │
│  │  - Who's winning │   │  6-hour cache.            │  │
│  └─────────────────┘   └──────────────────────────┘  │
│                                                       │
│  ┌────────────────────────────────────────────────┐   │
│  │  Famous Dev Suggestions                        │   │
│  │                                                │   │
│  │  Curated list of well-known developers         │   │
│  │  (Torvalds, DHH, Guillermo Rauch, etc.)        │   │
│  │  suggested as people to star and race against.  │   │
│  └────────────────────────────────────────────────┘   │
│                                                       │
└──────────────────────────────────────────────────────┘
```

---

## Authentication

GitHub OAuth 2.0, stored as an httpOnly JWT cookie:

```
┌─────────┐                ┌──────────┐               ┌────────┐
│ Browser │                │  Server  │               │ GitHub │
└────┬────┘                └────┬─────┘               └───┬────┘
     │  Click "Sign in"         │                         │
     │─────────────────────────▶│                         │
     │                          │  Redirect to GitHub     │
     │                          │────────────────────────▶│
     │  ◀──────────────────────────────────────────────── │
     │       GitHub login page                            │
     │                                                    │
     │  User authorizes ───────────────────────────────▶ │
     │                                                    │
     │  ◀── Redirect with code ──────────────────────── │
     │─────────────────────────▶│                         │
     │                          │  Exchange code          │
     │                          │  for access token       │
     │                          │────────────────────────▶│
     │                          │◀────────────────────────│
     │                          │                         │
     │                          │  Fetch user info        │
     │                          │────────────────────────▶│
     │                          │◀────────────────────────│
     │                          │                         │
     │                          │  Upsert user in DB      │
     │                          │  Sign JWT (7-day exp)   │
     │                          │  Set httpOnly cookie    │
     │  ◀──────────────────────│                         │
     │  Redirect to /dashboard  │                         │
```

**Why httpOnly cookie over localStorage?** Prevents XSS attacks from stealing the token. The cookie is automatically sent with every API request via `credentials: "include"`.

**Why JWT?** Stateless session verification. The server doesn't need to hit the database on every request to validate the session — just verify the JWT signature.

Two auth middlewares:
- `requireAuth`: Returns 401 if no valid session (dashboard, create race, etc.)
- `optionalAuth`: Proceeds with or without auth (leaderboard, public race pages)

---

## Database Schema

```
┌─────────────────────┐     ┌───────────────────────────┐
│       users          │     │     challenges             │
│─────────────────────│     │───────────────────────────│
│ id (PK)             │◀────│ created_by (FK)            │
│ github_id (unique)  │     │ id (PK)                    │
│ github_username     │     │ name                       │
│ avatar_url          │     │ type (1v1 | team)          │
│ access_token        │     │ duration_type              │
│ created_at          │     │ start_date / end_date      │
└─────────┬───────────┘     │ goal_target / goal_metric  │
          │                  │ share_slug (unique)        │
          │                  └────────────┬──────────────┘
          │                               │
          │    ┌──────────────────────────┘
          │    │
          │    ▼
          │  ┌───────────────────────────┐
          │  │  challenge_participants    │
          │  │───────────────────────────│
          │  │ challenge_id (FK)         │
          │  │ user_id (FK, nullable)    │
          │  │ github_username           │
          │  │ is_ghost                  │
          │  │ (unique: challenge+user)  │
          │  └───────────────────────────┘
          │
          ├──▶ league_memberships
          │    (week_start + username unique)
          │    tier, group_number, weekly_commits
          │    final_rank, promoted, demoted
          │
          ├──▶ user_streaks
          │    current_streak, longest_streak
          │    best_week_commits, trend
          │
          └──▶ user_benchmarks
               (starred developers per user)


┌─────────────────────────┐    ┌───────────────────────────┐
│    event_committers      │    │     commit_snapshots       │
│─────────────────────────│    │───────────────────────────│
│ github_username + date   │    │ github_username + date     │
│ (unique composite)       │    │ (unique composite)         │
│ commit_count             │    │ commit_count               │
│ push_count               │    │ fetched_at                 │
│ avatar_url               │    └───────────────────────────┘
│ last_seen_at             │
└─────────────────────────┘    ┌───────────────────────────┐
                                │     suggested_opponents    │
┌─────────────────────────┐    │───────────────────────────│
│      seed_state          │    │ github_username (unique)   │
│─────────────────────────│    │ avatar_url, followers      │
│ key (unique)             │    └───────────────────────────┘
│ cursor (for resumption)  │
│ metadata (JSONB)         │    ┌───────────────────────────┐
│ last_run_at              │    │       famous_devs          │
└─────────────────────────┘    │───────────────────────────│
                                │ github_username (unique)   │
┌─────────────────────────┐    │ display_name, known_for    │
│     social_circles       │    │ category, active           │
│─────────────────────────│    └───────────────────────────┘
│ user_id + following_user │
│ (unique composite)       │
│ avatar_url, fetched_at   │
└─────────────────────────┘
```

**Key design decisions:**

- **`event_committers` and `commit_snapshots` are separate tables** because they serve different purposes and update at different rates. Archive data is append-only (hourly), while snapshots are refreshed on-demand with a 4-hour cache TTL.
- **`seed_state` with cursor + metadata** makes every cron job resumable. If GitHub rate-limits us mid-batch, the next cron invocation picks up where we left off.
- **Ghost participants** (`is_ghost = true, user_id = null`) let races work against users who haven't signed up. Their commit data comes from GH Archive.

---

## Cron Jobs

```
┌──────────────────────────────────────────────────────────────────┐
│                        Cron Schedule (UTC)                        │
├──────────────────┬──────────────┬────────────────────────────────┤
│ Job              │ Schedule     │ What it does                   │
├──────────────────┼──────────────┼────────────────────────────────┤
│ ingest-events    │ Every hour   │ Downloads 1 GH Archive hour,   │
│                  │ (0 * * * *)  │ parses PushEvents, upserts     │
│                  │              │ event_committers. Then enriches │
│                  │              │ top 10 via GraphQL.             │
├──────────────────┼──────────────┼────────────────────────────────┤
│ poll-events      │ Every 10 min │ Polls GitHub Events API with   │
│                  │ (*/10 * * *) │ ETags for real-time "Today"    │
│                  │              │ data. Supplements archives.     │
├──────────────────┼──────────────┼────────────────────────────────┤
│ daily-seed       │ 00:05 daily  │ Refreshes pool of 150 top      │
│                  │ (5 0 * * *)  │ GitHub users. Fetches today's   │
│                  │              │ contributions for all of them.  │
├──────────────────┼──────────────┼────────────────────────────────┤
│ weekly-leagues   │ Mon 07:00    │ Finalizes previous week's       │
│                  │ (0 7 * * 1)  │ leagues: ranks, promote/demote. │
└──────────────────┴──────────────┴────────────────────────────────┘
```

**Why hourly for archive ingestion?** GH Archive publishes files one hour after the hour ends. Each cron call processes exactly one hour. Over 24 calls, the full day is covered.

**Why 10-minute polling?** The GitHub Events API is near-real-time but only returns ~300 events per call. Frequent polling catches more events throughout the day, keeping the "Today" leaderboard responsive between hourly archive ingestions.

**Why is everything resumable?** Vercel serverless functions have a 300-second timeout. Processing 150 users via GraphQL can hit rate limits. The cursor in `seed_state` lets each cron invocation pick up exactly where the last one stopped.

**Concurrency protection**: Every cron handler is wrapped with `withAdvisoryLock()` — a Postgres advisory lock that ensures only one instance of each job runs at a time. If Vercel retries a timed-out invocation while the first is still running, the second one returns `{ status: "skipped", reason: "already_running" }` immediately instead of corrupting data. See [Reliability & Safety](#reliability--safety) for details.

---

## Anti-Cheat

Three layers prevent automated/spam accounts from dominating:

### 1. Bot filtering (13 patterns)

Defined once in `lib/bot-filter.ts`, imported by GH Archive ingestion, real-time event polling, and leaderboard queries:

```
[bot] suffix, -bot suffix, and specific names:
dependabot, renovate, github-actions, greenkeeper,
snyk-bot, codecov, imgbot, netlify, vercel, copilot,
github-merge-queue
```

### 2. Per-push commit cap (50)

Applied during GH Archive parsing and real-time event polling. A single `git push` with 1,000+ commits is almost always automated (dependency updates, generated code, CI artifacts). Capping at 50 per push lets normal development through while limiting abuse.

### 3. Real data enrichment

The top 10 users get their counts replaced with real GitHub GraphQL data (contribution calendar). This means even if archive data is inflated, the actual leaderboard shows verified numbers for the people who matter most — the top of the board.

---

## Reliability & Safety

The data pipeline handles millions of events per day across multiple cron jobs running concurrently on serverless infrastructure. Several mechanisms prevent data corruption and resource exhaustion:

### Transactional idempotency

Both GH Archive ingestion and real-time event polling wrap their data writes and state updates in a single Postgres transaction:

```
┌─────────────────────────────────────────┐
│           db.transaction()              │
│                                         │
│  1. Upsert commit data into             │
│     event_committers (chunked)          │
│                                         │
│  2. Mark hour/events as processed       │
│     in seed_state                       │
│                                         │
│  ── Either BOTH succeed or NEITHER ──   │
└─────────────────────────────────────────┘
```

**Why this matters**: Without the transaction, a crash between step 1 and step 2 creates a dangerous state — the data is written but the hour isn't marked as done. On retry, the same data gets added again, doubling commit counts. The transaction ensures all-or-nothing: if the process crashes, the hour is not marked as ingested, and the next run starts clean.

### Advisory locks for cron concurrency

Every cron handler is wrapped with `withAdvisoryLock()` (`lib/advisory-lock.ts`):

```
┌─────────────────────────────────────┐
│  Vercel cron triggers /ingest-events │
│                                      │
│  1. pg_try_advisory_lock(737005)     │
│     ├── acquired: true → run job     │
│     └── acquired: false → return     │
│         { status: "skipped" }        │
│                                      │
│  2. Run the actual cron logic        │
│                                      │
│  3. pg_advisory_unlock(737005)       │
└─────────────────────────────────────┘
```

**Why `pg_try_advisory_lock` (non-blocking)?** Vercel can retry timed-out functions while the first invocation is still running. A blocking lock would just queue up invocations. The try-lock returns immediately with `false` if another instance is already running, so the retry safely no-ops.

Each cron job has a unique lock ID (737001-737006) defined in a central map. Session-level locks are used rather than transaction-level because cron jobs may run multiple transactions internally.

### Streaming decompression

GH Archive hourly files are 40-80MB compressed and decompress to 400-800MB. Instead of buffering the full decompressed file in memory (`gunzipSync`), the pipeline streams through three stages:

```
fetch response body
  │
  ▼
Readable.fromWeb()  ──▶  createGunzip()  ──▶  readline
(Web Stream → Node)      (decompress)          (line-by-line parse)
```

**Memory impact**: Peak memory drops from ~500MB (full buffer) to ~50MB (stream buffers + aggregation map). This is critical on serverless where memory is capped and billed per-MB.

### CORS origin lock

The API only accepts cross-origin requests from the configured `CLIENT_URL` environment variable. This prevents CSRF attacks where a malicious site could make authenticated requests using a visitor's session cookie. Previously accepted any origin with `credentials: true`, which is a security anti-pattern.

### Batched league finalization

Weekly league finalization previously ran one `UPDATE` query per league member (O(n) round-trips). With 10,000 members, that's 10,000 sequential database calls which would timeout the serverless function.

Now the ranking is computed in memory and applied with a single `UPDATE ... FROM VALUES` query — O(1) round-trips regardless of member count.

---

## Deployment

Everything runs on Vercel:

```
┌───────────────────────────────────────────────────┐
│                    Vercel                          │
│                                                    │
│  ┌──────────────────┐  ┌───────────────────────┐  │
│  │  Static Assets   │  │  Serverless Function   │  │
│  │  (client build)  │  │  (api/index.ts)        │  │
│  │                  │  │                         │  │
│  │  React SPA       │  │  Hono app              │  │
│  │  Tailwind CSS    │  │  2048MB memory          │  │
│  │  Vite bundle     │  │  300s max duration      │  │
│  └──────────────────┘  └───────────────────────┘  │
│                                                    │
│  Routing:                                          │
│    /api/*  →  serverless function                  │
│    /*      →  index.html (SPA fallback)            │
│                                                    │
│  Cron triggers → POST to /api/cron/* endpoints     │
│  with CRON_SECRET Bearer token                     │
└───────────────────────────────────────────────────┘
```

**Why a single serverless function?** Hono handles all routing internally. This avoids the cold-start penalty of many separate functions and keeps the deployment simple. The 2GB memory allocation provides headroom for GH Archive stream processing and concurrent API requests.

**Why Vite + React SPA?** Fast dev experience, simple deployment as static files. No SSR needed — the app is behind auth for most features, and the landing page is lightweight.

---

## API Reference

All routes are prefixed with `/api`.

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/auth/github` | - | Initiate GitHub OAuth |
| GET | `/auth/github/callback` | - | OAuth callback, sets session cookie |
| POST | `/auth/logout` | - | Clear session cookie |

### User
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/me` | Required | Current user profile |
| GET | `/me/dashboard` | Required | Consolidated dashboard data |
| GET | `/me/share` | Required | Shareable week summary text |

### Leaderboard
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/leaderboard?period=day\|week\|month\|yearly&limit=100` | Optional | Global rankings |

### Challenges
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/challenges` | Required | Create a race |
| GET | `/challenges/:slug` | Optional | Race details + leaderboard |
| PATCH | `/challenges/:slug` | Required | Update end date (creator only) |
| DELETE | `/challenges/:slug` | Required | Delete race (creator only) |
| POST | `/challenges/:slug/join` | Required | Join a team race |

### Leagues
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/leagues/current` | Required | Current week's league group |

### Social
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/starred` | Required | Starred users with comparisons |
| GET | `/starred/suggestions` | Required | Famous devs to star |
| POST | `/starred` | Required | Star a user |
| DELETE | `/starred/:username` | Required | Unstar a user |
| GET | `/social/circle` | Required | Following list ranked by commits |
| GET | `/benchmarks` | Required | Famous dev benchmarks |

### Cron (requires CRON_SECRET)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/cron/ingest-events` | Ingest one GH Archive hour |
| POST | `/cron/poll-events` | Poll GitHub Events API |
| POST | `/cron/daily-seed` | Refresh user pool + today's data |
| POST | `/cron/backfill?days=7` | Backfill historical data |
| POST | `/cron/weekly-leagues` | Finalize previous week's leagues |
| POST | `/cron/seed-famous-devs` | Populate famous devs table |

### Utility
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/users/:username/stats` | Optional | Public user stats |
| GET | `/github/search?q=...` | Required | Search GitHub users |
| GET | `/suggested-opponents` | Required | Top GitHub users for races |
| GET | `/health` | - | Health check |

---

## Key Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `CACHE_TTL_MS` | 4 hours | How long before commit data is re-fetched from GitHub |
| `SOCIAL_CIRCLE_CACHE_MS` | 6 hours | How long before following list is re-fetched |
| `LEAGUE_GROUP_SIZE` | 30 | Members per league group |
| `LEAGUE_PROMOTE_COUNT` | 5 | Top N promoted each week |
| `LEAGUE_DEMOTE_COUNT` | 5 | Bottom N demoted each week |
| `MAX_TEAM_SIZE` | 50 | Max participants in a team race |
| `SLUG_LENGTH` | 8 | Characters in race share links |
| `CHALLENGE_REFRESH_MS` | 60 seconds | Auto-refresh interval on race page |
| `MAX_COMMITS_PER_PUSH` | 50 | Anti-cheat: cap per push event |
