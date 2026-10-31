# Cardbox

Baseball card collection tracker. Single static page, no build step.

- Cost basis, current value, unrealized gain, value by set, value history
- Optional [SportsCardsPro](https://sportscardspro.com/api-documentation) lookup and price refresh (paid API token, entered in Settings and stored only in the browser)
- eBay sold-comps link per card for manual pricing
- JSON import/export; data lives in browser localStorage

## Deploy

Cloudflare Pages, connected to this repo. No framework, no build command, output directory `/`.

## Local

Open `index.html` in a browser.
