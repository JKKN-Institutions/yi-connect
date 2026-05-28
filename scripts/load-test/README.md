# YIP Load Test

Read-only concurrency load test for the deployed YIP routes.

## What it is

A bash wrapper around [`autocannon`](https://github.com/mcollina/autocannon) that
hammers a handful of safe, public YIP endpoints to verify the platform can
survive June 4–5 — when up to 10 chapters may run their rounds in parallel,
each with ~150 jury + student logins.

The test is **read-only**:

- No POSTs to server actions.
- No authenticated requests (no session cookie is supplied).
- Endpoints tested are all anonymous GETs (landing, join, login pages, the
  jury-login redirect).
- Caps at 100 concurrent connections per scenario — well under Vercel hobby
  rate limits.

## Running

```bash
# Full sweep (4 scenarios, ~2 min wall-clock)
./scripts/load-test/run-yip-load-test.sh

# Quick smoke (single 10s burst)
./scripts/load-test/run-yip-load-test.sh --quick

# Override target
BASE_URL=https://yi.jkkn.ai ./scripts/load-test/run-yip-load-test.sh
```

Results are written to `scripts/load-test/reports/<UTC-timestamp>/<scenario>.txt`.

Requires `npx` (no global install — autocannon is fetched on demand).

## Scenarios

| # | Name              | Endpoint                              | Conns | Duration |
|---|-------------------|---------------------------------------|-------|----------|
| 1 | landing-burst     | `/yip`                                | 100   | 30s      |
| 2 | jury-login        | `/yip/jury/login` (307 → /yip/join)   | 50    | 30s      |
| 3 | join-page         | `/yip/join` (where 150 students land) | 100   | 30s      |
| 4 | organiser-login   | `/yip/login`                          | 50    | 30s      |

## What to look for

In each per-scenario `.txt` file autocannon prints:

- **Latency** table (2.5% / 50% / 97.5% / 99% / Avg / Max). p99 < 1500 ms is
  fine for a Vercel-edge cold path; > 3000 ms means the function is queueing.
- **Req/Sec** sustained. The platform should sustain at least 300 req/sec on
  anonymous pages.
- **Code** breakdown. We want:
  - Scenario 1, 3, 4: 100% `200`.
  - Scenario 2: 100% `307` (this endpoint redirects to `/yip/join`).
  - Any `5xx`, especially `502` (function crash) or `504` (function timeout),
    is a bottleneck signal.

## Capacity ceilings to know about

### Vercel (yi-connect-app)

- **Hobby tier**: 100 GB-hr functions/mo, soft cap ~100 concurrent
  serverless function executions, edge requests are essentially unlimited.
- **Pro tier**: 1000 GB-hr/mo, 1000 concurrent functions.
- Static + ISR pages (the YIP landing and join pages) are served from edge
  cache and do not consume serverless quota — so the heavy-load scenarios
  here mostly measure edge latency, not function capacity.
- Check the project at <https://vercel.com/jkkn/yi-connect-app>; Project ID
  is in `.vercel/project.json`.

### Supabase (project `bkmpbcoxbjyafieabxao`)

- **Free tier**: 60 direct Postgres connections, pgbouncer pool of 200.
- **Pro tier ($25/mo)**: 90 direct connections, pgbouncer pool of 400.
- For 10 parallel chapters × 150 users × ~2 in-flight queries each = 3 000
  query-slots peak. The pooler caps before connections are exhausted, so
  expect queue-up at the pooler boundary on free tier. **Recommend Pro tier
  before June 4 if not already.**
- Check at <https://supabase.com/dashboard/project/bkmpbcoxbjyafieabxao/settings/database>.

## Why not test the live event detail / scoring routes?

Those routes are gated behind a session (jury access code, student access
code, or organiser auth). Hitting them anonymously just measures the
auth-failure path — not useful. A real load test of those routes needs a
seeded test event + pool of pre-issued access codes + a script that does the
full login dance. That is a Phase-20 (post-launch) hardening task.
