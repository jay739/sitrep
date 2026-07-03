# sitrep build report

## What was built and why this shape

sitrep is a self-hosted status page and incident communication tool that layers on top of
Uptime Kuma rather than doing its own monitoring. The design bet is that the monitoring
problem is already solved by tools people run, and the unsolved part is telling users what is
happening during an outage. So sitrep ingests Kuma heartbeats over a webhook, keeps its own
component and incident state, and renders a public page plus an RSS feed and Telegram
notifications.

The whole thing is one SvelteKit app backed by one SQLite file, deliberately, so that a
stranger can run it with one container and one volume and nothing else. There is no separate
database process, no message broker, and no background worker.

## Stack justification

- **SvelteKit with adapter-node.** Server-rendered pages are the right default for a status
  page: it must load fast, work without client JavaScript for the read path, and be simple to
  reverse-proxy. Form actions give a clean no-custom-JS admin.
- **SQLite via the Node 24 built-in `node:sqlite`.** This is the highest-leverage choice in
  the project. It removes the single biggest source of self-hosting pain, a native module that
  has to compile against the right Node ABI on both amd64 and arm64. There is nothing to
  compile, so the multi-arch Docker build is trivial and reliable.
- **zod as the only runtime dependency.** Every ingest and admin input is validated at the
  boundary. One dependency is a deliberate ceiling; the production `node_modules` tree is
  literally just zod.

## Routes, with validation, auth, and rate limit

| Route                                            | Method | Auth             | Validation                       | Rate limit                |
| ------------------------------------------------ | ------ | ---------------- | -------------------------------- | ------------------------- |
| `/`                                              | GET    | public           | n/a                              | none (cheap, cached read) |
| `/feed.xml`                                      | GET    | public           | n/a                              | none                      |
| `/api/health`                                    | GET    | public           | n/a                              | none                      |
| `/api/ingest/kuma/[token]`                       | POST   | per-source token | zod on body, 64KB cap            | 120/min per IP, burst 240 |
| `/admin/login`                                   | POST   | password         | zod on password (length-bounded) | 5/min per IP              |
| `/admin` (create/update/remove incident, logout) | POST   | session          | zod per action                   | login-gated               |
| `/admin/components` (create/update/remove)       | POST   | session          | zod per action                   | session-gated             |
| `/admin/sources` (create/toggle/remove)          | POST   | session          | zod per action                   | session-gated             |
| `/admin/maintenance` (create/remove)             | POST   | session          | zod per action                   | session-gated             |

Admin authorization is enforced in `hooks.server.ts` for every `/admin` path except the login
page, so it covers POST form actions and not only GET page loads.

## Security checklist

| Control                          | Status                   | Note                                                                                                        |
| -------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| XSS via markdown                 | Covered                  | Escape-first renderer; verified raw `<script>`/`<img onerror>` never reach the page, only escaped forms do. |
| XSS via component/incident names | Covered                  | Svelte auto-escapes interpolation; names are never fed to `{@html}`.                                        |
| SQL injection                    | Covered                  | Every statement is parameterized; the only interpolated value is an integer migration counter.              |
| Admin auth bypass                | Covered (was a real bug) | Form actions ran before the layout guard; moved enforcement into the server hook. See below.                |
| Ingest token probing             | Covered                  | Server-generated CSPRNG tokens, format-checked, generic 404 on miss.                                        |
| Timing attack on password        | Covered                  | Both sides SHA-256 hashed then `timingSafeEqual`, constant time regardless of length.                       |
| CSRF on admin posts              | Covered                  | adapter-node checks Origin against `ORIGIN`; verified cross-origin post returns 403.                        |
| Oversized/pathological payloads  | Covered                  | 64KB body cap, zod bounds, markdown tested against 10k-char input.                                          |
| Rate limiting                    | Covered, with caveat     | In-memory token buckets; see "known gaps" on proxies.                                                       |
| CSP and headers                  | Covered                  | `script-src self`, `object-src none`, `frame-ancestors none`, `X-Content-Type-Options`, `Referrer-Policy`.  |
| Secrets in repo                  | Covered                  | None committed; `.env` is gitignored, only `.env.example` is tracked.                                       |
| Session secret at rest           | Covered                  | Generated on first boot into `DATA_DIR` with `0600` permissions.                                            |
| Public page is public            | By design, documented    | Without `ADMIN_PASSWORD` the admin area is off but the status page is public; called out in README.         |

## Two real bugs the process caught

1. **Admin auth bypass.** The first cut guarded `/admin` only in a layout `load`. SvelteKit
   runs form actions before parent layout loads, so an unauthenticated POST to `/admin?/create`
   executed and wrote an incident before any redirect. Verified by reproducing it (a 200 and a
   row created), then moved enforcement into `hooks.server.ts` and re-verified (403, no row).

2. **Non-deterministic test.** The Kuma ingest integration test shared one SQLite file across a
   run, and vitest re-evaluates the module per test, so sources and transitions accumulated and
   a leftover `up` heartbeat eventually made the recovery assertion flip. This was a test
   isolation defect, not a product defect, but it means the earlier green runs were not
   trustworthy. Fixed by wiping and reseeding tables in `beforeEach`; verified deterministic
   across repeated runs.

## Test coverage

- **Unit:** uptime interval integration (six cases including "no fabricated history before the
  first heartbeat" and ongoing outages), markdown rendering and XSS hardening (six cases),
  status rollup.
- **Integration:** Kuma ingest against realistic payloads, covering rejection, pending/maintenance
  ignore, auto-create, idempotency, recovery, maintenance protection, and auto-create-off.
- **Manual end-to-end (curl against the production build):** admin login success and failure,
  session cookie set, incident open, update, and resolve with post-mortem persisted, appearance
  on the public page and in RSS, CSRF rejection, login rate limiting, XSS escaping, logout.
- **Container:** built the image, ran it, confirmed `/api/health` returns 200, the page renders,
  the process runs as the non-root `node` user, and the Docker healthcheck reports healthy.
- 23 automated tests pass; typecheck is clean; production build is clean.

Not covered: no Playwright browser test yet (the end-to-end checks are curl-level, which
exercises the server but not client interaction). This is the top testing gap.

## Dependencies

- **Runtime:** `zod` only. Without it, every route would hand-roll input validation, which is
  exactly where injection and type-confusion bugs come from.
- **Dev:** SvelteKit, Vite, Svelte, adapter-node, svelte-check, TypeScript, vitest, @types/node.
  All standard, all dev-only, none shipped in the image beyond the built output plus zod.

## Deploying on your stack

1. Create the source repo and let the release workflow publish the image, or build locally.
2. Compose snippet:

   ```yaml
   services:
     sitrep:
       image: ghcr.io/jay739/sitrep:latest
       restart: unless-stopped
       environment:
         ADMIN_PASSWORD: <a real password>
         ORIGIN: https://status.jay739.dev
         SITE_NAME: jay739 status
       volumes:
         - sitrep-data:/data
   volumes:
     sitrep-data:
   ```

3. In Nginx Proxy Manager: proxy host `status.jay739.dev` to the container on 3000, Let's
   Encrypt cert, Force SSL. Make the public URL equal `ORIGIN`.
4. In Uptime Kuma: create a source in sitrep's admin, copy its webhook URL, add it as a Webhook
   notification (JSON), attach to monitors.
5. Point a Kuma HTTP monitor at `https://status.jay739.dev/api/health` so sitrep watches itself.

## Known gaps, ranked by risk

1. **Rate limiting behind a reverse proxy.** `getClientAddress()` sees the proxy IP unless
   adapter-node is told to trust `X-Forwarded-For` (`ADDRESS_HEADER=X-Forwarded-For` and
   `XFF_DEPTH`). Until set, the login and ingest limits are effectively global rather than
   per-client. It fails safe (more restrictive), but it should be documented in the compose file
   and ideally defaulted. Medium risk.
2. **No Playwright end-to-end.** Client interactions (keyboard, live refresh) are unverified by
   automation. Medium risk for regressions.
3. **Single admin, single password.** No per-user accounts or audit log of who posted what.
   Fine for the stated scope, a real limit for a team. Low risk.
4. **`ORIGIN` is easy to forget** and its absence produces confusing 403s on admin posts rather
   than a clear error. Low risk, high annoyance.

## Next three things worth doing

1. Add the `ADDRESS_HEADER`/`XFF_DEPTH` env passthrough and document it, so rate limiting is
   correct behind a proxy out of the box.
2. Add a Playwright smoke test against demo mode and wire it into CI, then take the README
   screenshots from that run.
3. Add a generic and an Alertmanager ingest source kind (the schema and source model already
   allow for them; only the Kuma parser is implemented).

## Attempted and abandoned

- **Nothing was abandoned mid-feature.** The one scope boundary held deliberately: email
  notifications via SMTP were listed last in the spec and deferred in favor of finishing RSS and
  Telegram to a high standard, since those two cover the stated need without adding an SMTP
  dependency and its failure modes. The `notify` module is structured so email slots in beside
  Telegram without reworking the incident actions.
