# EH27 Bins

An installable community PWA for EH27 8DP, using West Lothian Council calendar **34 – MONHASAT22026**, May 2026–August 2027. Independent of the council. Holiday/disruption changes are intentionally excluded.

## Run

Requires Node.js 22.12+ (tested with Node 24) and npm.

```sh
npm ci
npm run build
npm start
```

The server listens on port 3000 and serves the built PWA and reminder API. For development, run `npm start` for the API and `npm run dev` in a second terminal; Vite proxies `/api` to port 3000. The existing checkout is already isolated; no additional Git worktree is necessary.

```sh
npm test
npm run build
npm run test:browser
```

Browser tests use installed Chromium (`/usr/bin/chromium` by default, override `CHROMIUM_PATH`). They build the app and launch a separate test server on port 3100. Tests cover the printed calendar, daylight-saving calculations, reminder dispatch/retry/removal, desktop/mobile screens, local preferences, export, service worker/offline behaviour and API validation. Browser tests do not deliver a real push message.

## Features

- Next collection, upcoming dates, a month selector and four-bin recycling guide.
- All 105 dates verified by independent transcription of the PDF into test fixtures.
- Household bin selection and timing preferences stored locally.
- Web Push subscription, test notification, updates and unsubscribe.
- Server scheduler runs every minute; exact 24-hour or chosen UK-local day-before reminder, plus an independently switchable 7pm check: “Have you kept the [colour] bin outside?” Both alerts are enabled by default.
- Offline app shell after first online load; install manifest and standalone icons.
- ICS download of upcoming selected collections. This is a static export without alarms, not a live calendar subscription.

## Live deployment

Deploy the **Node server**, not just `dist`, behind HTTPS. Keep exactly one server process with a **persistent writable data directory**. This first version uses an atomic JSON file store suitable for a small single-instance pilot; use a database/job queue before horizontal scaling. Run continuously: serverless request-only hosting cannot run the scheduler.

| Variable | Purpose |
| --- | --- |
| `PORT` | Listener port; default `3000` |
| `PUBLIC_ORIGIN` | Required behind HTTPS/reverse proxy, e.g. `https://your-domain.example`; no trailing slash |
| `DATA_DIR` | Persistent storage for subscriptions and generated VAPID keys; default `.data` |
| `VAPID_SUBJECT` | Set to your real HTTPS contact page or `mailto:` contact before launch |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Optional paired persistent VAPID keys; if omitted, keys are generated once into `DATA_DIR` |

Never commit `.data` or private keys. Preserve keys across deployments; replacing them invalidates existing subscriptions. Back up the data directory securely. Existing records store browser push endpoints/keys, preferences and delivery markers; unsubscribe deletes the record. No account, email or full address is collected. Confirm a public privacy notice and operator contact before resident rollout.

Allow outbound HTTPS to the relevant browser push providers (FCM, Mozilla, Apple, Windows). Push cannot be verified without an installed browser subscription and provider connectivity. HTTPS is required except on localhost. On iOS/iPadOS, Web Push requires a Home Screen web app on version 16.4+. The app includes installation guidance.

Before inviting residents: deploy with the settings above, enable reminders on real Android/iPhone devices, send test notifications, and verify a scheduled reminder while the app is closed. Delivery can be delayed by devices/networks; this is not a guaranteed alarm service. The scheduler retries transient failures each minute for up to 15 minutes after the due time and skips stale alerts after longer downtime. A crash between provider acceptance and delivery-marker persistence can produce a duplicate; strict exactly-once delivery is not claimed.

## Calendar maintenance

`server/calendar.js` contains bounded series matching the entire printed PDF. `tests/calendar.test.js` independently lists every printed date/colour. Dates stop at 31 August 2027; the UI shows expiry instead of inventing future dates. Replace and re-verify the source calendar before that date. The shared calendar is bundled into the client so it works offline. Holiday overrides and council-feed integration are future work.

The 7am deadline is a council put-out deadline, not a guaranteed arrival time. Collections may continue until 7pm. An exact 24-hour alert is measured from that deadline, including when clocks change; custom reminders stay at the chosen Europe/London wall time.
