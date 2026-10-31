# Jamo's Dugout

Baseball card collection tracker built for Jameson (Jamo) to log and value his cards and share with family and friends. Single static page, no build step.

- Cost basis, current value, unrealized gain, value by set, value history
- Optional [SportsCardsPro](https://sportscardspro.com/api-documentation) lookup and price refresh (paid API token, entered in Settings and stored only in the browser)
- eBay sold-comps link per card for manual pricing
- JSON import/export; data lives in browser localStorage

## Deploy

Cloudflare Workers, connected to this repo. `src/worker.js` serves `public/` and proxies SportsCardsPro at `/api/scp/*` using the `SCP_TOKEN` secret (set in the Worker dashboard under Settings → Variables and Secrets) unless the visitor supplies their own token.

## Local

Open `public/index.html` in a browser.
