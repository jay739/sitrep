# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project adheres to
[Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-07-03

Initial release.

### Added

- Public status page: components with live status and a 90-day uptime history bar, an overall
  status banner, active incident timeline, recent incident history, and scheduled maintenance,
  server-rendered with light and dark themes and an auto-refresh.
- Uptime Kuma webhook ingest with per-source secret tokens, native parsing of Kuma heartbeats,
  auto-created components for new monitors, idempotent handling of repeated states, and payload
  size and rate limits.
- Admin area behind a single password: rate-limited login, signed httpOnly session, and CRUD
  for incidents (open, update, resolve with post-mortem), components, ingest sources, and
  maintenance windows.
- Incident RSS feed at `/feed.xml`.
- Optional Telegram notifications on incident open and update.
- Health endpoint at `/api/health` that reports app and database health without leaking
  internals.
- Demo mode that seeds a realistic fictional dataset with zero external dependencies.
- Multi-arch Docker image, docker-compose file, CI, and a semver-tag-driven release workflow
  that publishes to GHCR.
