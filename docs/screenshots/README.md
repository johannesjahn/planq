# Screenshots

Captured from the running app (backend on `:3000`, Vite dev server on `:5173`)
with headless Chromium at a 1440×900 viewport, then downscaled to 1×. The
mobile shot uses a 390×844 viewport.

| File                            | What it shows                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------ |
| `01-login.png`                  | Sign-in view — marketing column plus the auth card.                                              |
| `02-register.png`               | Create-account view, filled in, with the password strength meter at "Strong".                    |
| `03-dashboard.png`              | Signed-in dashboard. "Your next shifts" is the empty state — scheduling is still in development. |
| `04-dashboard-raw-response.png` | Dashboard, full page, with the raw `GET /users/me` disclosure expanded.                          |
| `05-login-rejected.png`         | Sign-in rejected after a wrong password (`InvalidCredentials` → 401).                            |
| `06-not-found.png`              | The 404 route.                                                                                   |
| `07-login-mobile.png`           | Sign-in at 390×844 — the marketing column drops away.                                            |

## Regenerating

Start both servers, then drive them with Playwright:

```bash
# backend — JWT_SECRET is required outside NODE_ENV=test
PORT=3000 DB_FILENAME=/tmp/screenshots.sqlite JWT_SECRET=<any-non-empty-secret> bun run start

# frontend
cd web && bun run dev
```

Notes for whoever automates this next:

- Chromium ships at `/opt/pw-browsers/chromium`, which is a symlink to the
  binary itself — pass it as Playwright's `executablePath` directly, not as a
  directory.
- Register requires `confirmPassword` as well as `password`, and usernames are
  letters/numbers/underscores only — a dot silently fails client-side validation
  and never reaches the API.
- `/login` redirects away while a session is live, so sign out before capturing
  any signed-out view.
- The raw-response toggle is a `<button>`, not a `<details>`/`<summary>`.
- Screenshots are captured at `deviceScaleFactor: 2` and downscaled afterwards.
  Don't compress them with PNG palette quantization — 256 colours visibly bands
  the aurora background.
