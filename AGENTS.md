# Ticket Gastos Super: agent handoff

Read this file and `README.md` before changing the project. The GitHub repository is the durable source of truth between ChatGPT/Codex accounts and computers.

## Product contract

- Keep every user's receipts isolated by `user_id`.
- Keep the initial limit of three users and the invite-code registration flow.
- Never add invented supermarkets, receipts, products or amounts to the real dashboard.
- Never fabricate comparison offers. Surface empty or unavailable stores explicitly and keep successful stores usable.
- Compare only products with the same normalized unit (`kg`, `L` or `unit`).
- Keep a manual review step before saving OCR or parsed receipt data.
- Preserve learned per-user category rules.
- Treat receipt totals as authoritative for spending KPIs; item totals may differ because of discounts or OCR errors.
- Store secrets only as Sites environment variables. Never commit tokens, passwords or invite codes.

## Architecture

- `web/index.html`: complete client, styles, PDF text extraction, Tesseract OCR, parsing and review UI.
- `server/index.js`: Sites/Worker backend, authentication, D1 schema, receipts and dashboard API.
- `server/comparison.js`: independent adapters for seven active stores, visible upcoming sources, matching, normalization and short-lived cache.
- `scripts/build.mjs`: creates the deployable `dist/` tree.
- `scripts/test_comparison.mjs`: deterministic adapter and price-normalization fixtures.
- `.openai/hosting.json`: persistent Sites project ID and D1 binding.
- `scripts/push_sites_source.py`: pushes a built source snapshot using a short-lived Sites repository credential.

## Work from a fresh computer

1. Clone the GitHub repository and create a `codex/<topic>` branch.
2. Use Node.js 20 or newer. No npm packages are required by the app itself.
3. Run `node scripts/check.mjs` before opening a pull request. `npm run check` is an optional shortcut when npm is available.
4. Run `node scripts/dev_server.mjs` and open `http://127.0.0.1:8788/?preview=1` for local visual testing.
5. Test both a text PDF and a scanned/image ticket when changing import behavior.
6. Commit only source files. `dist/`, `.site-source/` and real `.env` files stay untracked.

## Existing Sites project

The production project ID is `appgprj_6a81a21462a081918377a50db825e757`. Do not replace it or call `create_site` merely because the current account cannot access it.

Publishing to the existing URL requires the ChatGPT/Sites account that owns the project, or an editor in the same workspace. If two accounts are in different personal workspaces, GitHub access does not grant Sites publishing access. In that case, use the owner account for the current URL or plan a GitHub Actions deployment to Cloudflare Worker/D1 for account-independent publishing.

From the owner account, add the second account as a Sites editor when both accounts belong to the same ChatGPT workspace, then verify that `get_site` reports the second account with the `editor` role. Once verified:

1. Run `node scripts/check.mjs` to generate and validate `dist/`.
2. Ask Sites for a short-lived source repository write credential for the existing project.
3. Expose its remote URL as `SITES_REMOTE_URL` and token as `SITES_TOKEN` only for the push process.
4. Run `python scripts/push_sites_source.py` and retain the returned commit SHA.
5. Save a Sites version for that exact commit SHA, then deploy that saved version.
6. Confirm the production deployment status and smoke-test login, dashboard and ticket import.

If Sites returns `project_not_found`, continue development through GitHub but do not deploy or alter `.openai/hosting.json`. The owner account must publish later. Creating a replacement Site is a migration decision because it creates a new URL and D1 database.

## Current comparison behavior

- Active sources: Mercadona, Lidl Spain, DIA, Carrefour, Alcampo, Ahorramas and Aldi.
- All seven requests run independently; one failure must not fail the entire comparison.
- Upcoming sources shown in the UI: Hipercor, Supercor and Eroski.
- Results include source links, retrieval time, pack price and normalized price when available.
- Shopping-plan rows are private by `user_id` in D1.
- Matching includes product concepts and aliases for common naming differences between stores.
- Matching ignores package-size noise such as `1 l`, `500 g` or `pack de 6`, but must preserve product constraints such as `talla 6`.
- Source endpoints can change. Update one adapter without coupling it to receipt parsing or another store.

## Next product work

- Calibrate parsers with anonymized real tickets from each supermarket.
- Add fixtures for Carrefour, Mercadona, Lidl, Alcampo, Dia, Aldi, Eroski, Supercor and Hipercor.
- Add postcode/store selection and regional availability to active adapters.
- Add maintained browser adapters for Carrefour and Alcampo.
- Include shipping, minimum order and promotion conditions without folding them into the base unit price.
- Keep browser-based adapters isolated because store anti-bot behavior changes independently.
