# Requirements: ANT Spread Board

Status key: all requirements are for the v1 static build.

## R1. Live data fetching
1. The app SHALL fetch the OKX public ticker for `ANTHROPIC-USDT-SWAP` from `https://www.okx.com/api/v5/market/ticker?instId=ANTHROPIC-USDT-SWAP`.
2. The app SHALL fetch the OKX public funding rate for the same instrument.
3. The app SHALL POST to `https://api.hyperliquid.xyz/info` with `{"type":"metaAndAssetCtxs","dex":"xyz"}` and read the `xyz:ANT` entry (mark, mid, funding).
4. The app SHALL POST to `https://api.hyperliquid.xyz/info` with `{"type":"metaAndAssetCtxs","dex":"io"}` and read the `io:ANTH` entry (mark, mid, funding).
5. The app SHALL provide a Binance row that is marked "unreachable from this location" when the fetch fails, and that accepts a manually entered price.
6. The app SHALL NOT call any Binance endpoint that requires a key.
7. Refresh SHALL be user-triggered or on a fixed interval no shorter than 30 seconds.

## R2. Per-share conversion
1. The app SHALL support three scenario share counts: 12.3B, 12.7B, and 13.1B. The default is 12.7B.
2. OKX per-share SHALL equal `quoted × 10 / scenarioShares` (shares in billions).
3. Binance per-share SHALL equal `quoted × 1 / scenarioShares` (shares in billions).
4. `xyz:ANT` per-share SHALL equal its quoted price, because one contract equals one Class A share.
5. `io:ANTH` per-share SHALL equal `quoted / 16.7`, which is the price times 10 divided by 167 (about 167B fully diluted shares). This value SHALL NOT change with the scenario selector.
6. The app SHALL display the formula used next to each converted value.

## R3. Spread table
1. The app SHALL show, for each source, its quoted price, its per-share price for the selected scenario, and its spread versus `xyz:ANT`.
2. Spread SHALL equal `(perShare − xyzPerShare) / xyzPerShare`, shown as a percentage with two decimal places.
3. When a source is unavailable, its row SHALL show "no data" and SHALL NOT show a stale or estimated value as live.

## R4. History chart
1. The app SHALL store the most recent 50 spread snapshots per source in `localStorage`.
2. Each snapshot SHALL include the timestamp, the source, the scenario, and the spread.
3. The app SHALL draw a line chart from the stored snapshots.
4. The app SHALL provide a control to clear the stored history.

## R5. Funding display
1. The app SHALL display the latest funding rate for OKX, `xyz:ANT`, and `io:ANTH`.
2. The app SHALL show the funding value exactly as the API returns it, with its source and timestamp.
3. The app SHALL NOT annualize or otherwise transform funding rates in v1, because the funding period for each source is not verified.

## R6. Rebase explainer
1. The app SHALL include a plain-language section explaining that exchanges may rebase pre-IPO quotes to the real per-share price once the company discloses its actual share count.
2. The section SHALL explain why the three scenarios exist.
3. The section SHALL describe the SpaceX precedent in the app's own words: the author reports that OKX used 12.52B shares and Binance used 13.08B shares, and that the spread converged after the rebase. The app SHALL label this as the author's reading and not as verified data.
4. The section SHALL state that the share-count estimate of about 12.7B means about 12.3B already issued plus about 0.4B new IPO shares, and excludes options, unvested RSUs, reserved shares, the greenshoe, and the Amazon convertible above the 12% cap.

## R7. Sources and timestamps
1. Every number SHALL display its source name and the time it was fetched, in UTC.
2. The app SHALL show the source endpoint or a link to the source documentation.

## R8. Disclaimer
1. A DYOR disclaimer SHALL appear on every page and near every table.
2. The disclaimer SHALL state that the app is not investment advice, does not execute trades, and does not place orders.

## R9. Static deployment
1. The app SHALL consist of `index.html`, `styles.css`, and `app.js` with no backend.
2. The app SHALL contain no secrets, API keys, or login flows.
3. The app SHALL deploy to Cloudflare Pages or GitHub Pages without build-time secrets.

## R10. Honest source status
1. The app SHALL show a status indicator per source: live, error, unreachable, or manual.
2. The app SHALL show the HTTP or network error message for failed sources.
3. The app SHALL offer a labelled sample mode that uses clearly fake data, marked "SAMPLE DATA" on every affected value. Sample mode SHALL NOT be the default.
