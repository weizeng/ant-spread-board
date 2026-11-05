# Product: ANT Spread Board

## Vision
A small, original, read-only web dashboard that shows the implied per-share price spread of Anthropic (ANT) pre-IPO contracts across several venues, compared against the Hyperliquid xyz:ANT perpetual. It makes the gap between venues visible and explains where the numbers come from.

## Audience
- Curious readers following pre-IPO markets who want to see the numbers side by side.
- Hackathon judges evaluating the Kiroween 2026 entry.

## What it does
- Fetches public market data from OKX, Hyperliquid (xyz and io dexes), and offers a manual price entry for Binance.
- Converts each quote to an implied per-share price under three share-count scenarios (12.3B, 12.7B, 13.1B).
- Shows a spread table, a local history chart, funding rates, and a plain-language explainer on share-count rebasing.
- Shows the source and as-of time for every number.
- Shows the status of each source honestly when it fails.

## Non-goals
- No trading. The app never places, modifies, or cancels orders.
- No logins, accounts, API keys, or wallet connections.
- No backend, database, or server-side secrets.
- No investment advice. The app carries a DYOR disclaimer on every page.
- No invented prices. If a source is unreachable, the app says so.

## Principles
- Read-only and static. Deployable to Cloudflare Pages or GitHub Pages.
- Every number is traceable to a named source and timestamp.
- Assumptions (share counts, conversion factors) are shown, not hidden.

## Frankenstein track idea
The Kiroween "Frankenstein" track rewards stitching mismatched parts into one working whole. This project stitches together exchange data that was never designed to be compared: a perp quoted per share, a perp quoted per 10B shares, a perp quoted per 1B shares, and a market-cap-quoted perp on a different dex. The stitching is the product. Each source keeps its own units and conventions, and the app converts them into a common per-share view with the conversion visible to the user.
