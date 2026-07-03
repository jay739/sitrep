# Mission: sitrep

This file is the build command for this project. It is written so it can be handed verbatim
to an autonomous Claude Code session (local or cloud) and produce the same product. It is
also the acceptance contract the finished repo is judged against.

## Mission statement

Build, polish, verify, and ship a complete, production-quality, self-hostable web application
called sitrep: an incident communication and public status page that layers on top of
monitoring the user already runs. It does zero monitoring itself. Uptime Kuma is the
first-class ingest source, generic webhooks and Prometheus Alertmanager are secondary. Work
autonomously, make decisions, record them, and finish. The end state is a repo a stranger can
clone, run one docker compose command, point their monitoring webhooks at, and have a
credible public status page with real incident communication. Finish with REPORT.md at the
repo root.

## Operator context (public-safe, never embed any of it)

The operator self-hosts about 40 Docker services behind Nginx Proxy Manager under his own
domain, monitors them with Uptime Kuma, and alerts through a Telegram bot. His nodes are one
amd64 host and one arm64 Oracle A1 VPS, so published Docker images must be multi-arch
(linux/amd64 and linux/arm64). Never hardcode his URLs, tokens, or service names. All
deployment specifics are runtime configuration supplied by whoever deploys the app.

## Product spec

A status page users trust during an outage, and an incident workflow the operator can drive
from a phone. Priority order:

1. Components: named pieces of infrastructure with a live status (operational, degraded,
   partial outage, major outage, maintenance) and a 90-day uptime history bar computed from
   ingested transitions.
2. Ingest: POST endpoints per source, authenticated by a per-source token in the URL path.
   Uptime Kuma webhook payloads are parsed natively; unbound monitors auto-create a
   component (per-source opt-out). Payload caps, strict validation, rate limiting. Ingest
   must never 500 on malformed input and must be idempotent for repeated notifications.
3. Incident lifecycle: investigating, identified, monitoring, resolved. Markdown updates at
   each step, affected components, severity (minor, major, critical), timestamps, and a
   post-mortem field on resolution. Past incidents visible for 14 days on the page and
   forever at a permalink.
4. Scheduled maintenance windows with affected components, shown upcoming and active.
5. Public page: overall banner, component list with status and uptime bars, active incident
   timeline, recent history, maintenance. Server-rendered, fast, readable on mobile, dark
   and light themes, auto-refreshing. Designed states for empty, error, and loading. RSS
   feed of incidents.
6. Admin area: single-admin auth via ADMIN_PASSWORD env, session cookie, rate-limited login.
   CRUD for components, sources, bindings, incidents, maintenance. Usable from a phone.
7. Notifications, in this order: RSS (free), Telegram (bot token + chat id via env),
   email via SMTP env vars last.
8. Demo mode: DEMO_MODE=true seeds a fictional but realistic dataset (components, 90 days of
   history, an active incident, resolved incidents, maintenance) so CI, screenshots, and
   first-run evaluation need zero external services.

Explicitly out of scope: doing any monitoring, multi-tenant orgs, user accounts beyond the
single admin, SSO. Prefer a small surface finished to a high standard. Any feature that
cannot be fully error-handled and tested gets cut and the cut is recorded in REPORT.md.

## Architecture and security (non-negotiable)

- SvelteKit with adapter-node, TypeScript strict. SQLite via the node:sqlite builtin
  (Node 24+), so there are no native build dependencies. Runtime dependency count stays
  minimal and every runtime dependency is justified in REPORT.md.
- Configuration via environment only: ADMIN*PASSWORD, DATA_DIR, SITE_NAME, DEMO_MODE, PORT,
  and later TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, SMTP*\*. Provide .env.example. A committed
  secret of any kind is a failed run.
- Session cookies are HMAC-signed with a secret generated on first boot and persisted into
  DATA_DIR with owner-only permissions. Login comparison is constant-time. Login and ingest
  routes are rate-limited (in-memory, single-instance target, limitation documented).
- Ingest tokens are generated server-side (crypto random), never chosen by the client.
  Token lookup failures return a generic 404 with no detail. Request bodies are capped at
  64KB and validated with zod; unknown monitors map through explicit binding rows.
- All markdown (incident updates, post-mortems) is rendered through the project's own
  escaping renderer: input is HTML-escaped first, then a small whitelisted markdown subset
  is applied. Incident titles and component names are hostile input everywhere they render.
- Strict Content-Security-Policy via SvelteKit csp config (no unsafe-inline scripts),
  plus X-Content-Type-Options, Referrer-Policy, and frame-ancestors none.
- Docker: multi-stage build, non-root user, pinned base image, HEALTHCHECK against
  /api/health, SQLite data on a volume. docker-compose.yml provided for end users.
- /api/health returns version, mode, and a database-ok boolean. It never leaks paths,
  upstream names, or error internals.

## Error handling bar

No unhandled path anywhere. Every route handles malformed input, oversized bodies, missing
auth, and database errors with typed, terse client responses and detailed server-side logs.
The public page renders a designed degraded state if the database is unavailable. Ingest
returns 200 for semantically ignorable payloads (pending states, duplicate transitions) so
upstream monitors do not retry-storm. Unhandled rejections terminate loudly, never silently.

## Testing

- Unit: uptime interval math, status derivation, markdown renderer (including XSS attempts),
  validators, session signing.
- Integration: ingest routes against realistic Kuma payloads, happy path and every error
  class (bad token, oversized body, malformed JSON, unknown monitor with auto-create off).
- End-to-end: Playwright against demo mode covering the public page, admin login, opening,
  updating, and resolving an incident. Screenshots from this run feed the README.
- Everything runs in CI; the run is red if any of it fails.

## CI/CD and releases (semver-driven)

- ci.yml on every push and PR to main: install from lockfile, lint, typecheck, unit and
  integration tests, Playwright, production build, dependency audit failing on high or
  critical advisories.
- release.yml on tags matching v*.*.\*: full validation, then a multi-arch image
  (linux/amd64, linux/arm64) pushed to GHCR tagged :vX.Y.Z and :latest, then a GitHub
  Release with generated notes. Conventional commits throughout, CHANGELOG.md maintained,
  first release v0.1.0 tagged when the pipeline is proven.

## Docs

README.md: pitch, screenshots from demo mode, quickstart compose, full configuration
reference, an Uptime Kuma webhook setup walkthrough, reverse proxy notes (Nginx Proxy
Manager example), security posture section, development guide. MIT license in the name of
Jayakrishna Konda. All prose in every file avoids em dashes and double hyphens; use commas,
conjunctions, or separate sentences.

## Git conduct (strict)

Author every commit as Jayakrishna Konda <contact@jay739.dev>. Never add AI attribution of
any kind anywhere: no Co-Authored-By trailers, no generated-with lines, nothing in commits,
docs, or code comments. Small, focused, conventionally named commits. Do not push; the
operator pushes.

## Final verification and adversarial pass

1. Full test suite green, production build clean, audits clean.
2. Run the production build in demo mode and exercise it end to end.
3. A dedicated adversarial review of the whole codebase hunting specifically: XSS through
   markdown or names, auth bypass on admin routes, timing leaks in token or password
   comparison, SQL injection (all statements parameterized), rate-limit gaps, oversized or
   pathological payloads, secrets or private URLs in the repo, CSP holes. Fix findings,
   re-run the suite.
4. A documented failure in REPORT.md is acceptable; a hidden one is not.

## REPORT.md

What was built and why this shape; stack justification; every route with its validation,
auth, and rate limit; security checklist with honest covered and not-covered status; test
coverage summary; dependency list with justifications; deployment steps for the operator's
stack (compose snippet, reverse proxy, Uptime Kuma webhook config, Uptime Kuma monitor
pointed at /api/health); known gaps ranked by risk; the next three things worth doing; and
anything attempted and abandoned, with reasons.
