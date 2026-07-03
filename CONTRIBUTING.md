# Contributing

Thanks for your interest in sitrep.

## Development setup

Requires Node 24 or newer, since the app uses the built-in `node:sqlite` and there is no
native module to build.

```bash
npm install
npm run dev
```

The dev server runs the app with an empty database at `./data`. To explore with a realistic
fictional dataset instead, run `DEMO_MODE=true npm run dev`.

## Before you open a pull request

Run the same checks CI runs, and make sure they pass:

```bash
npm run check     # typecheck
npm test          # unit and integration tests
npm run build     # production build
npm audit --audit-level=high
```

## Conventions

- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/), for
  example `feat: add Alertmanager ingest` or `fix: escape link titles`.
- The project follows semantic versioning. Releases are cut by pushing a `vX.Y.Z` tag.
- Prose in docs and comments avoids em dashes and double hyphens; use commas, conjunctions, or
  separate sentences.
- Every new route validates its input, handles its error cases, and never leaks internal
  paths or upstream URLs to the client. New user-supplied text that renders to the page must
  go through the escaping path.

## Scope

sitrep intentionally does no monitoring of its own and stays a single-admin tool. Features
that pull it toward being a monitoring system or a multi-tenant product are probably out of
scope; open an issue to discuss before building one.
