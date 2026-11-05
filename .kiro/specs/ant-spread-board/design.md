# Design: ANT Spread Board

## 1. Architecture
A single static site with three files at the project root:
- `index.html`: layout, disclaimer, source status panel, spread table, funding panel, rebase explainer, chart canvas.
- `styles.css`: styling only.
- `app.js`: fetch logic, conversion math, rendering, localStorage history, and chart drawing.

No build step, no framework, no backend. Hosting is Cloudflare Pages or GitHub Pages.

## 2. Client-side fetching and CORS
- OKX public REST endpoints are called from the browser with `fetch` (GET, no headers, no credentials).
- Hyperliquid `POST https://api.hyperliquid.xyz/info` is called from the browser with `fetch` (JSON body, no credentials).
- Binance is blocked from the build VM (`api.binance.com` and `fapi.binance.com` return "Service unavailable from a restricted location"). The app does not call Binance. It shows a Binance row as "unreachable" with a manual price input. The app does not guess a Binance price.
- Browser CORS behavior for these endpoints has not been verified from a browser context. The first build task includes a browser check. If a call is blocked, the source shows an error and the rest of the app still works.

## 3. Fetch flow
Each source is an independent async function that returns:
```
{ source, ok, status, quote, fundingRate, mark, mid, fetchedAt, error }
```
- Sources run in parallel with `Promise.allSettled`.
- A failure in one source never blocks rendering of the others.
- Each function has a timeout (for example 8 seconds) using `AbortController`.

Endpoints:
| Source | Request | Fields used |
|---|---|---|
| OKX ticker | GET `/api/v5/market/ticker?instId=ANTHROPIC-USDT-SWAP` | last price |
| OKX funding | GET `/api/v5/public/funding-rate?instId=ANTHROPIC-USDT-SWAP` | funding rate |
| Hyperliquid xyz | POST `/info` `{"type":"metaAndAssetCtxs","dex":"xyz"}` | `xyz:ANT` mark, mid, funding |
| Hyperliquid io | POST `/info` `{"type":"metaAndAssetCtxs","dex":"io"}` | `io:ANTH` mark, mid, funding |
| Binance | none (manual input only) | user-entered price |

Verified values on 2026-11-05 about 09:40 UTC, used for documentation and sample-mode reference only:
- OKX last: $160.11
- xyz:ANT mark $116.49, mid $116.52, funding 0.0000022692
- io:ANTH mark $1848.7, mid $1847.45, funding 0.0001082856
- OKX funding returned 0

## 4. Data model
```
Config {
  scenarioShares: 12.3 | 12.7 | 13.1   // billions, default 12.7
  refreshSeconds: number               // >= 30
  mode: "live" | "sample"              // default "live"
}

Quote {
  source: "okx" | "hl-xyz" | "hl-io" | "binance-manual"
  price: number | null                 // quoted units
  quotedBasis: "per-10B" | "per-share" | "per-1B" | "market-cap-167B"
  fetchedAt: ISO8601 UTC string | null
  status: "live" | "error" | "unreachable" | "manual" | "sample"
  error: string | null
  fundingRate: number | null
}

Snapshot {                             // stored in localStorage
  t: ISO8601 UTC
  source: string
  scenarioShares: number
  perShare: number
  spread: number                       // fraction, e.g. 0.0823
}
```
localStorage key: `ant-spread-board:history:v1`. Keep at most 50 snapshots per source. Oldest entries are dropped first.

## 5. Formulas
Let `S` be `scenarioShares` in billions.

- OKX per-share: `perShare = okxPrice × 10 / S`
- Binance per-share: `perShare = binancePrice × 1 / S`
- xyz:ANT per-share: `perShare = xyzPrice` (one contract = one Class A share)
- io:ANTH per-share: `perShare = ioPrice / 16.7` (equivalent to `ioPrice × 10 / 167`). Not scenario-dependent.
- Spread: `spread = (perShare − xyzPerShare) / xyzPerShare`

Price used for `xyzPrice` and `ioPrice` is the mid price. The mark price is displayed alongside for reference. Mid is chosen as the single price for the spread so that the calculation is consistent across sources. This is an assumption and is shown in the UI.

Worked example using verified values and S = 12.7:
- OKX per-share = 160.11 × 10 / 12.7 = 126.07
- xyz per-share = 116.52 (mid)
- spread = (126.07 − 116.52) / 116.52 = +8.20%

If `xyzPrice` or `perShare` is missing, the spread cell shows "no data".

## 6. Rendering
- Spread table: one row per source with columns for source, status, quote, basis, per-share, spread vs xyz, fetchedAt (UTC).
- Scenario selector: radio buttons for 12.3B, 12.7B, 13.1B. Changing it recomputes without refetching.
- Funding panel: OKX, xyz:ANT, io:ANTH, each with value, source, and fetchedAt.
- Status panel: one line per source with status and error text.
- Chart: canvas line chart of stored spread snapshots, one line per source, with a clear-history button.
- Explainer section: static text covering the rebase, scenarios, and SpaceX precedent, labelled as the author's reading.
- Footer and near-table disclaimer: DYOR statement, not investment advice, no trades, no orders.

## 7. Sample mode
- Off by default. Enabled by an explicit toggle.
- When on, sources return fixed illustrative values, and every affected value displays a "SAMPLE DATA" badge.
- Sample snapshots are not written to the history store.

## 8. Error handling
- Network errors, timeouts, and non-2xx responses set `status: "error"` or `"unreachable"` with the message shown.
- Malformed JSON or missing fields set `status: "error"` with the field name in the message.
- No retries beyond one automatic retry per refresh cycle.

## 9. Security and privacy
- No cookies, no login, no API keys, no wallet connection.
- No third-party scripts. No analytics.
- Only the public GET and POST endpoints above are contacted.
- Manual Binance input is held in memory and is not persisted.

## 10. Open items
- [Closed 2026-11-05] OKX funding endpoint verified: `GET /api/v5/public/funding-rate?instId=ANTHROPIC-USDT-SWAP` returns `data[0].fundingRate`.
- Confirm the funding period for Hyperliquid and OKX so the UI can label it. Until then, display the raw value only.
- Confirm browser CORS behavior from a real browser session.
