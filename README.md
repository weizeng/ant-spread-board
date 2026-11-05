# ANT Spread Board

A read-only, static web dashboard (Chinese primary, English market terms) that converts Anthropic (ANT) pre-IPO contract quotes from several venues into an implied per-share price and shows the spread against the Hyperliquid `xyz:ANT` perpetual.

- No trading, no orders, no login, no API keys, no backend, no build step.
- Vanilla HTML/CSS/JS plus a `<canvas>` chart. No third-party scripts.
- Every number shows its source and an as-of time (UTC).
- A failing source is shown as failed. The app never invents a price.

**DYOR. Not investment advice.**

## What it shows

Spread table (OKX, Hyperliquid `xyz:ANT`, Hyperliquid `io:ANTH`, Binance), a scenario selector (12.3B / 12.7B / 13.1B shares, default 12.7B), raw funding rates, a local history chart (last 50 points per source in `localStorage`), a rebase explainer, the SpaceX precedent (the author's reading, not verified data), the data sources, and a disclaimer. Auto-refresh every 30 seconds plus a manual button.

## Per-share math

`S` = scenario share count in billions.

| Market | Quote basis | Per-share |
|---|---|---|
| Hyperliquid `xyz:ANT` | 1 contract = 1 Class A share | `mid` |
| OKX `ANTHROPIC-USDT-SWAP` | per 10B shares | `last × 10 / S` |
| Binance (manual) | per 1B shares | `price × 1 / S` |
| Hyperliquid `io:ANTH` (Entropy) | market cap, ~167B fully diluted shares | `mid / 16.7` (independent of `S`) |

Spread vs xyz = `(perShare − xyzPerShare) / xyzPerShare`, shown in $ and %.

Worked example (verified prices, 2026-11-05 ~09:40 UTC, S = 12.7):

- OKX per-share = 160.11 × 10 / 12.7 = **$126.07**
- xyz per-share = **$116.52** (mid)
- Spread = (126.07 − 116.52) / 116.52 = **+$9.55, +8.20%**
- io:ANTH per-share = 1847.45 / 16.7 = $110.63 → −$5.89, −5.06%

Mid prices are used for the spread; mark prices are shown for reference. Funding values are shown exactly as returned and are not annualised, because the funding periods are unverified.

## Data sources and live status (checked from the build VM, 2026-11-05 ~09:40 UTC)

| Source | Request | Status |
|---|---|---|
| OKX ticker | `GET https://www.okx.com/api/v5/market/ticker?instId=ANTHROPIC-USDT-SWAP` | Reachable (last $160.11) |
| OKX funding | `GET https://www.okx.com/api/v5/public/funding-rate?instId=ANTHROPIC-USDT-SWAP` | Reachable (fundingRate 0) |
| Hyperliquid xyz | `POST https://api.hyperliquid.xyz/info` `{"type":"metaAndAssetCtxs","dex":"xyz"}` | Reachable (mark $116.49, mid $116.52, funding 0.0000022692) |
| Hyperliquid io | same URL, `"dex":"io"` | Reachable (`io:ANTH` mark $1848.7, mid $1847.45, funding 0.0001082856) |
| Binance | none | **Blocked from this VM** (HTTP 451 / "Service unavailable from a restricted location"). The app does not call Binance; it offers a manual price field. |

Curl showed permissive CORS headers on the OKX ticker and on Hyperliquid (`access-control-allow-origin`). See "Not verified" below.

### Sample mode

"加载示例数据" loads a stale snapshot (2026-11-04 09:59 Beijing time: xyz $110.52, io:ANTH $1773.5, OKX $166.57, Binance $1647.26). Every number is badged `SAMPLE DATA`, nothing is written to history, and it is never the default.

## Run locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

Opening `index.html` via `file://` may work but a local server is the tested path.

## Deploy

- **Cloudflare Pages:** create a project from the Git repo (or direct upload), framework preset "None", build command empty, output directory `/`.
- **GitHub Pages:** push to a public repo, then Settings → Pages → deploy from branch `main`, folder `/ (root)`.

No environment variables or secrets are needed.

## Kiroween track recommendation (your decision)

- **Frankenstein (recommended first):** the product is the stitching of mismatched parts. Four quote conventions (per share, per 10B, per 1B, market cap) from three venues are converted into one per-share view, with the conversion visible on screen. That is the Frankenstein brief almost literally.
- **Costume Contest (fallback):** it fits only if you lean on a Halloween-themed look. The current UI is a plain light, App-Store-style design with no costume concept, so it would need extra visual work and is a weaker fit.

## Not done yet

- Demo video
- Public GitHub repository
- Devpost submission
- Deployment to Cloudflare Pages / GitHub Pages

## Not verified

- Browser CORS from a real browser against the live endpoints. The headless Chromium on the build VM could not reach the internet (proxy tunnel failure), so the live path was tested with mocked responses captured from the real APIs, plus curl CORS headers.
- Funding periods for OKX and Hyperliquid.
- Binance data (blocked).

## License

MIT, see `LICENSE`.
