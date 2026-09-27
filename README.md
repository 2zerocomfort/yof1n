# Link page with real bot-gating

```
visitor/bot  →  Turnstile challenge  →  server checks it  →  only then, links are revealed
```

Nothing in the HTML or JS ever contains your real URLs. They live only in
a Pages environment variable, and `/api/links` refuses to hand them over
unless the request carries a session cookie your server issued after a
Turnstile check actually passed. A scraper that just downloads the page
(or replays your JS without solving Turnstile) gets nothing.

## Files

```
linktree-guard/
├── public/
│   └── index.html          the page visitors see
└── functions/
    ├── _lib/session.js     signs/checks the "verified" session cookie
    └── api/
        ├── verify.js       POST — checks the Turnstile token server-side
        └── links.js        GET  — returns real links, only with a valid session
```

## 1. Get a Turnstile site key + secret

1. Cloudflare dashboard → **Turnstile** → **Add site**.
2. Add the hostname you'll deploy to (you can add `yof1nn.pages.dev` now
   and your custom domain later — you can list multiple hostnames on one
   widget).
3. Copy the **Site Key** and **Secret Key**.

## 2. Fill in the site key

In `public/index.html`, replace:

```html
data-sitekey="YOUR_TURNSTILE_SITE_KEY"
```

with your real site key. (Site keys are public by design — safe to commit.)

## 3. Push this to a GitHub repo

Cloudflare Pages deploys from a git repo (or `wrangler pages deploy` directly,
if you'd rather skip git).

## 4. Create the Pages project

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** →
   connect your repo.
2. Build settings:
   - **Build output directory:** `public`
   - **Build command:** leave blank (nothing to build)
3. Deploy. You'll get `https://<project-name>.pages.dev` — this is where
   `yof1nn.pages.dev` in your plan comes from (Cloudflare assigns/lets you
   pick this subdomain).

## 5. Set environment variables (secrets)

Pages project → **Settings** → **Environment variables** → add for
**Production** (and Preview, if you want previews to work too):

| Name | Value |
|---|---|
| `TURNSTILE_SECRET_KEY` | the secret key from step 1 |
| `SESSION_SECRET` | any long random string, e.g. `openssl rand -hex 32` |
| `LINKS_JSON` | your real links, e.g. `[{"label":"Portfolio","url":"https://..."},{"label":"Fiverr","url":"https://fiverr.com/..."},{"label":"Upwork","url":"https://upwork.com/..."}]` |

Redeploy (or just retrigger a deployment) after adding these — Pages
Functions only pick up env vars on a fresh deployment.

## 6. Test it

Open the `.pages.dev` URL in an incognito window. You should see the
Turnstile checkbox/challenge, then the real links appear after it passes.
Open dev tools → Network tab before completing the challenge — you'll see
`index.html` and the JS contain no real URLs at all; they only show up in
the `/api/links` response, and only after `/api/verify` has set the cookie.

To sanity-check the gate itself: `curl -s https://yof1nn.pages.dev/api/links`
with no cookie should return `{"error":"not_verified"}`, not your links.

## 7. Connect your custom domain (later)

Pages project → **Custom domains** → add your domain. Then go back to the
Turnstile widget settings and add that hostname to the allowed list too.

## Notes / things worth knowing

- Sessions last 15 minutes (`SESSION_TTL_MS` in `functions/_lib/session.js`)
  before a visitor has to pass Turnstile again. Adjust to taste.
- This stops **scanners that don't run JS or can't solve Turnstile** —
  it doesn't stop a determined human from viewing the links once revealed
  (nothing can; they're meant to be clicked). It also won't stop a bot
  that pays a CAPTCHA-solving service, though that raises the cost/effort
  a lot compared to a plain scrape.
- If you ever want an extra layer, Cloudflare's **Bot Fight Mode** /
  WAF rules can be turned on for the zone alongside this, at no extra
  code cost.
