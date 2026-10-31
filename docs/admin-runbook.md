# Jamo's Dugout Admin Runbook

_Last updated Oct 31, 2026_

Operator reference for jamosdugout.com: what runs where, how to add people, how to recover.

## At a glance

```
Jamo's browser  --visit-->  Cloudflare Access  --allowed-->  Worker: cardbox  --t=token-->  SportsCardsPro
(cards in browser storage)   (email + PIN, 7-day)     (serves public/, /api/scp proxy,   (search + price API)
                                                        secret SCP_TOKEN)
                                                              ^
                                                              | push to main = auto deploy
                                                       GitHub: cgans/cardbox
```

Every visit hits Cloudflare Access first; only allowed emails reach the Worker. The Worker serves the page and proxies price lookups to SportsCardsPro with the `SCP_TOKEN` secret (or a visitor's own token). Nothing is stored server-side; each browser keeps its own collection. Pushing to `main` on GitHub redeploys the Worker.

## Inventory

| Thing | Name / value | Where to manage it |
| --- | --- | --- |
| Public URL | https://jamosdugout.com | Domain registered on Cloudflare (chrisgans1@gmail.com account), auto-renew |
| Fallback URL | https://cardbox.chrisgans1.workers.dev | Same Worker; also behind Access |
| Source repo | github.com/cgans/cardbox (branch `main`) | [Repo](https://github.com/cgans/cardbox) |
| Worker | `cardbox` | [Worker overview](https://dash.cloudflare.com/?to=/:account/workers/services/view/cardbox/production) |
| Deployments | git-connected, auto on push | [Deployments](https://dash.cloudflare.com/?to=/:account/workers/services/view/cardbox/production/deployments) |
| Secret | `SCP_TOKEN` (SportsCardsPro API token) | [Worker settings](https://dash.cloudflare.com/?to=/:account/workers/services/view/cardbox/production/settings) → Variables and Secrets |
| Access app | `cardbox - Cloudflare Workers`, scope All traffic, 7-day session | [Zero Trust → Applications](https://one.dash.cloudflare.com/?to=/:account/access/apps) |
| Access policies | `Cloudflare account members` (you), `Jamo` (heathergans@gmail.com) | Same app → Policies |
| Price service | SportsCardsPro API (paid) | [sportscardspro.com](https://www.sportscardspro.com) → Subscription → API/Download |
| GitHub App | Claude app must list `cardbox` for Claude to push | [github.com/apps/claude](https://github.com/apps/claude/installations/select_target) |

Files in the repo: `public/index.html` (the whole app), `public/_headers` (security headers), `src/worker.js` (proxy), `wrangler.toml` (Worker config), `README.md`.

## How it works

**Request flow.** A visit to jamosdugout.com is intercepted by Cloudflare Access. No valid session cookie means a login page: the visitor enters an email, gets a one-time PIN, and if the email matches a policy, Access sets a 7-day cookie and forwards the request. The Worker then serves `public/index.html` for page requests, and handles `/api/*` itself.

**Token selection in the proxy** (`src/worker.js`):

1. The page calls `/api/scp/products?q=...` (search) or `/api/scp/product?id=...` (price).
2. If the browser has a token saved in Settings, the page sends it in an `X-SCP-Token` header and the Worker uses that.
3. Otherwise the Worker uses the `SCP_TOKEN` secret. The default token never leaves Cloudflare.
4. With neither, the Worker answers 401 and the page falls back to manual values.

`/api/config` tells the page whether a default exists, which controls the first-visit prompt. Responses are cached 5 minutes to keep SportsCardsPro calls down.

**Price mapping by grade:** Raw = `loose-price`, PSA 10 = `manual-only-price`, PSA 9 = `graded-price`, PSA 8 = `new-price`, PSA 7 = `cib-price`, BGS 10 = `bgs-10-price`, SGC 10 = `condition-18-price`. All in cents.

**Where data lives.** Each browser's `localStorage` holds the collection (`cardbox.v1`), the visitor's own token (`cardbox.token`), and two flags. There is no database. Two devices are two collections. Import/export is the only way to move or back up data.

## Users

Users are email addresses on an Access policy. There are no accounts to create and nothing to confirm on the user's side beyond receiving the PIN.

**Add a user**

1. [Zero Trust → Applications](https://one.dash.cloudflare.com/?to=/:account/access/apps) → `cardbox - Cloudflare Workers`.
2. **Policies** → open **Jamo** → under Include, the Emails rule → add the address → Save policy.
3. Back on the application, tap **Save** at the bottom. The policy list isn't committed until this Save.
4. Tell the person their login email and point them at the Getting Started guide.

**Confirm it worked.** Ask them to open jamosdugout.com in a private window. They should get the Cloudflare login page, enter their email, receive a PIN within a minute, and land on the app. Or check yourself: Zero Trust → **Logs** → **Access** shows every login attempt with the email and whether it was allowed or blocked.

**Remove a user.** Same policy, delete the email, Save policy, Save application. Their existing session cookie keeps working until it expires (up to 7 days). To cut them off immediately: Zero Trust → **My Team** → **Users** → the user → **Revoke sessions**.

**Test a policy without logging in.** On the application, the **Policy tester** tab takes an email and says allow or block.

**Your own access** comes from the `Cloudflare account members` policy, so you never need to be on the Jamo list.

## Deploying and rolling back

**Deploy.** Push to `main` on `cgans/cardbox`. Cloudflare clones the repo, runs `npx wrangler deploy`, and the new version is live in about a minute. Watch it on the [Deployments](https://dash.cloudflare.com/?to=/:account/workers/services/view/cardbox/production/deployments) tab; the top row should be your commit message with status Ready. Users with the page open get it on their next reload.

**Branch-and-PR** works the same way as GitHub normally does: open a PR, the **Enable Preview builds** setting gives each PR its own `*-cardbox.chrisgans1.workers.dev` URL (behind Access too), merge to deploy.

**Roll back.** Deployments tab → the `…` menu on any earlier Ready version → **Rollback**. Instant, no git involved. Then fix forward in the repo so the next push doesn't reintroduce the problem.

**Secrets survive deploys.** `SCP_TOKEN` is set in the dashboard, not the repo, so a rollback or redeploy never loses it. Never commit a token to the repo; it's public.

**Deploy fails?** Open the failed row to read the build log. The usual causes: a syntax error in `src/worker.js` (run `node --check src/worker.js` locally) or a bad `wrangler.toml`. The previous version stays live while a build fails.

## Rotating the SportsCardsPro token

Do this now (the current token was pasted into a chat), and any time you suspect it leaked.

1. Log in to [sportscardspro.com](https://www.sportscardspro.com) → Subscription → API/Download → regenerate the token. Copy the new 40-character value.
2. [Worker settings](https://dash.cloudflare.com/?to=/:account/workers/services/view/cardbox/production/settings) → Variables and Secrets → `SCP_TOKEN` → Edit → paste → **Deploy**.
3. On jamosdugout.com, Add card → search `mcgwire` → results come back. Done.

Nobody else needs to do anything: visitors on the shared default pick up the new token on their next lookup. Only a visitor who typed the *old* token into their own Settings would break, and that should never be the case.

## Recovery procedures

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| User gets "You don't have access" | Email not on a policy, or typo | Policy tester with their email; add to the Jamo policy; Save policy and Save application |
| PIN email never arrives | Spam filter, or Cloudflare One-time PIN provider off | Check Zero Trust → Logs → Access for the attempt; Settings → Authentication → One-time PIN must be enabled |
| Everyone locked out, including you | Access misconfigured (e.g. policy deleted) | Worker → Access tab → **Manage access** → remove the policy to drop the gate, fix in Zero Trust, re-apply. Dashboard login doesn't go through Access, so you can't lock yourself out of the fix |
| Site loads but every lookup says 401 "No SportsCardsPro token" | `SCP_TOKEN` missing or deleted | Re-add the secret and Deploy (Rotating section) |
| Lookups fail with an API error message | SportsCardsPro subscription lapsed or token revoked | Check the subscription; rotate the token |
| "Lookup failed: Failed to fetch" for one user only | Their browser extension or network blocking `/api/` | Try a private window; try another network |
| A user's cards vanished | Cleared browser data, new device, or a different browser profile | Restore from their last Import/export backup. There is no server copy; if they never exported, the data is gone |
| Site down after a push | Bad deploy | Deployments → Rollback to the previous Ready version; fix forward |
| jamosdugout.com won't resolve or shows a cert error | Domain detached from the Worker, or registration lapsed | Worker → Domains: `jamosdugout.com` should be listed Active; re-add if missing. Domain Registration → confirm not expired and auto-renew on |
| workers.dev URL works but custom domain doesn't | DNS record for the custom domain deleted | Worker → Domains → remove and re-add `jamosdugout.com`; Cloudflare recreates the record |
| Claude can't push to the repo | GitHub App lost repo access | github.com/apps/claude → Configure → add `cardbox` |
| Need the app with no Cloudflare at all | Total outage | `public/index.html` runs on its own from any static host or a local file; only the proxy (shared token) is lost, so users enter their own token or values |

**Backups you should keep:** the repo is on GitHub, so code is safe. The only unbacked-up state is each user's collection (browser-side) and the `SCP_TOKEN` value (recoverable from SportsCardsPro). Ask Jamo to export monthly.

## Costs and renewals

| Item | Cost | Renewal |
| --- | --- | --- |
| Cloudflare Workers | Free tier (100k requests/day) | None; family traffic won't come close |
| Cloudflare Access (Zero Trust) | Free up to 50 users | None |
| jamosdugout.com | \~$10/yr | Yearly; confirm auto-renew is on under Domain Registration |
| SportsCardsPro subscription | Per their plan | Monthly or yearly; lapsing breaks the shared-default lookups |
| GitHub | Free (public repo) | None |

The Cloudflare account email is chrisgans1@gmail.com; renewal notices go there.

## Known limits and next upgrades

- **No shared storage.** Collections are per browser. The upgrade is Cloudflare D1 (SQLite) or KV keyed by the Access user's email (the Worker can read it from the `Cf-Access-Authenticated-User-Email` header). That gives sync across devices, server-side backups, and per-user collections with no login code of your own.
- **No scheduled price refresh.** Depends on the storage upgrade; then a Worker cron trigger can refresh nightly and fill the history chart automatically.
- **Shared token is open to all allowed users.** Fine for family. If the list grows, add a per-user daily cap in the Worker, or require own tokens for non-family.
- **www.jamosdugout.com** isn't set up; a redirect rule in the zone handles it if ever needed.
- **Price source is single-vendor.** eBay Browse API is a free alternative for sold comps if SportsCardsPro stops being worth it.
