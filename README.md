# sitrep

<p align="center">
  <img src="assets/logo.svg" alt="sitrep" width="420" />
</p>

A self-hosted status page and incident communication tool that layers on top of the
monitoring you already run. It does no monitoring itself. Uptime Kuma pushes heartbeats to
it over a webhook, and sitrep turns those into a public status page with a proper incident
lifecycle, scheduled maintenance windows, an RSS feed, and optional Telegram notifications.

Think of it as the piece Uptime Kuma's built-in status page is missing: the part where you
tell your users what is happening, in your words, while it is happening.

- Self-hosted, one container, one SQLite file, no external database.
- Multi-arch image (linux/amd64 and linux/arm64), so it runs on a Raspberry Pi or an ARM VPS
  as happily as on an x86 box.
- Ships with a demo mode, so you can see the whole thing working before you wire up anything.

## Quickstart

Explore it first with fictional data, no monitoring required:

```bash
docker run --rm -p 3000:3000 -e DEMO_MODE=true -e ORIGIN=http://localhost:3000 \
  ghcr.io/jay739/sitrep:latest
```

Open http://localhost:3000. The admin login in demo mode is the password `demo-admin` at
`/admin/login`.

For a real deployment, use the provided compose file. Set `ADMIN_PASSWORD` and `ORIGIN`
first:

```bash
# edit docker-compose.yml, then:
docker compose up -d
```

## Configuration

Everything is configured through environment variables. There is no config file to mount and
no secret committed anywhere.

| Variable             | Required      | Default                       | Purpose                                                                                                                                |
| -------------------- | ------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `ADMIN_PASSWORD`     | for admin     | none                          | Password for the admin area. If unset, the admin area is disabled and only the public page is served.                                  |
| `ORIGIN`             | in production | none                          | The public URL the app is served from, e.g. `https://status.example.com`. Required so admin form posts are not rejected as cross-site. |
| `SITE_NAME`          | no            | `Status`                      | Page title and header.                                                                                                                 |
| `DATA_DIR`           | no            | `/data` (image), `data` (dev) | Where the SQLite database and the generated session secret live.                                                                       |
| `PORT`               | no            | `3000`                        | Port the server listens on.                                                                                                            |
| `DEMO_MODE`          | no            | `false`                       | Seed a fictional dataset on first boot. Never use in production.                                                                       |
| `TELEGRAM_BOT_TOKEN` | no            | none                          | Bot token for incident notifications. Both Telegram vars must be set for notifications to fire.                                        |
| `TELEGRAM_CHAT_ID`   | no            | none                          | Chat or channel id to send incident notifications to.                                                                                  |

## Connecting Uptime Kuma

1. Log in to sitrep at `/admin/login`, open **Sources**, and create a source. It gives you a
   secret webhook URL that looks like `https://status.example.com/api/ingest/kuma/<token>`.
2. In Uptime Kuma, go to **Settings, Notifications, Setup Notification**, choose **Webhook**,
   set the POST URL to that URL, and set the content type to `application/json`.
3. Attach the notification to the monitors you want on your status page.

By default a source auto-creates a component the first time it sees a new monitor, so your
status page populates itself as heartbeats arrive. You can turn that off per source and bind
monitors to components by hand instead.

sitrep acts only on up and down heartbeats. Uptime Kuma "pending" and "maintenance"
heartbeats are acknowledged and ignored, and repeated same-state notifications do not create
duplicate history.

## Reverse proxy (Nginx Proxy Manager)

Point a proxy host at the container on port 3000 with websockets not required. Set the scheme
to `http` and the forward host to the container. Make sure the public HTTPS URL matches the
`ORIGIN` you configured, since that is what the app checks admin posts against. In Nginx
Proxy Manager that is just: Domain `status.example.com`, Forward Hostname `sitrep`, Forward
Port `3000`, SSL with a Let's Encrypt certificate and Force SSL on.

To monitor sitrep with the same Uptime Kuma that feeds it, add an HTTP(s) monitor pointed at
`https://status.example.com/api/health`. It returns 200 with a small JSON body when the app
and its database are healthy, and 503 otherwise. It never leaks the upstream URL or internal
paths.

## Security posture

- The browser never receives the admin password or the ingest tokens beyond the one shown in
  the admin UI. Ingest tokens are generated server-side with a CSPRNG, and an unknown token is
  answered with a generic 404 so token probing learns nothing.
- Admin authentication is a single password compared in constant time, with a signed,
  httpOnly, SameSite session cookie and a rate-limited login. Admin enforcement lives in the
  server hook, so it applies to form actions and not just page loads.
- All incident and maintenance text is markdown, rendered through an escape-first renderer:
  input is HTML-escaped before any markup is applied, links are restricted to http and https,
  and component and incident names are treated as hostile input everywhere they render.
- A strict Content-Security-Policy with no inline scripts, plus `X-Content-Type-Options`,
  `Referrer-Policy`, and `frame-ancestors none`.
- Every ingest and admin route validates its input with zod, caps body size, and is rate
  limited. All database access is parameterized.
- One caveat worth stating plainly: if you expose the app publicly without `ADMIN_PASSWORD`,
  the admin area is disabled but the public status page is, by design, public. Put it behind
  your reverse proxy and only expose the pages you intend to.

## Development

Requires Node 24 or newer (the app uses the built-in `node:sqlite`, so there is no native
module to compile).

```bash
npm install
npm run dev            # dev server
npm test               # unit and integration tests
npm run check          # typecheck
npm run build          # production build
DEMO_MODE=true node build/index.js
```

## Releases

Tags matching `vX.Y.Z` trigger the release workflow, which runs the full test suite, builds
the multi-arch image, pushes it to GHCR as `:vX.Y.Z` and `:latest`, and cuts a GitHub
Release. The project follows semantic versioning and conventional commit messages.

## License

MIT, see [LICENSE](LICENSE).
