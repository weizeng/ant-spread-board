# Tasks: ANT Spread Board

## Spec (this step)
- [x] Write steering doc `.kiro/steering/product.md`
- [x] Write requirements `.kiro/specs/ant-spread-board/requirements.md`
- [x] Write design `.kiro/specs/ant-spread-board/design.md`
- [x] Write task list `.kiro/specs/ant-spread-board/tasks.md`

## Build

- [x] Create `index.html` with layout, disclaimer, status panel, spread table, funding panel, explainer, and chart canvas
- [x] Create `styles.css`
- [x] Create `app.js` config and scenario selector (12.3B / 12.7B / 13.1B, default 12.7B)
- [x] Implement OKX ticker fetch with timeout and error status
- [x] Implement OKX funding-rate fetch and confirm the endpoint path
- [x] Implement Hyperliquid `xyz` fetch (`metaAndAssetCtxs`, dex `xyz`) and extract `xyz:ANT`
- [x] Implement Hyperliquid `io` fetch (`metaAndAssetCtxs`, dex `io`) and extract `io:ANTH`
- [x] Implement Binance row as "unreachable" with manual price input (no Binance requests)
- [x] Implement per-share conversion and spread formulas
- [x] Implement spread table rendering with "no data" handling
- [x] Implement funding display with source and timestamp
- [x] Implement localStorage history (max 50 per source) and canvas chart with clear button
- [x] Implement rebase explainer section, labelled as the author's reading
- [x] Implement UTC as-of timestamps and source links on every number
- [x] Implement DYOR disclaimer on every page and near tables
- [x] Implement labelled sample mode (off by default, "SAMPLE DATA" badges, no history writes)
- [ ] Verify browser CORS for OKX and Hyperliquid from a real browser session (NOT done: headless Chromium on the build VM had no internet; only curl CORS headers and mocked-response tests)
- [x] Local testing: serve the folder with a static server and check each source status, scenario switching, chart persistence, and clear-history
- [x] Local testing: simulate a failed source and confirm the rest of the page still renders
- [x] Verify no login, API key, or Binance request exists in the code
- [x] Write `README.md` (what it is, how to run, data sources, formulas, disclaimer, deployment)
- [x] Add MIT `LICENSE` file
- [ ] Deploy to Cloudflare Pages or GitHub Pages (static, no secrets)
