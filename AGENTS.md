# Ticket Gastos Super: Agent Handoff

Read this file and `README.md` before changing the project. The GitHub repository is the durable source of truth between ChatGPT/Codex accounts and computers.

## Product Contract

- Keep every user's receipts isolated by `user_id`.
- Keep the initial limit of three users and the invite-code registration flow.
- Never add invented supermarkets, receipts, products or amounts to the real dashboard.
- Never fabricate comparison offers. Surface empty or unavailable stores explicitly and keep successful stores usable.
- Compare only products with the same normalized unit (`kg`, `L` or `unit`).
- Keep a manual review step before saving OCR or parsed receipt data.
- Preserve learned per-user category rules.
- Treat receipt totals as authoritative for spending KPIs; item totals may differ because of discounts or OCR errors.
- Store secrets only as hosting secrets/environment variables. Never commit tokens, passwords or invite codes.

## Architecture

- `web/index.html`: complete client, styles, PDF text extraction, Tesseract OCR, parsing, settings and review UI.
- `server/index.js`: Worker backend, authentication, D1 schema, receipts, settings and dashboard API.
- `server/comparison.js`: independent store adapters, matching, normalization and short-lived cache.
- `scripts/build.mjs`: creates the deployable `dist/` tree.
- `scripts/dev_server.mjs`: local preview server with compare/settings/shopping-plan endpoints.
- `scripts/test_client.mjs`: deterministic client parser fixtures, including Hipercor paper ticket format.
- `scripts/test_comparison.mjs`: deterministic adapter and price-normalization fixtures.
- `.openai/hosting.json`: current OpenAI Sites project ID and D1 binding.
- `.github/workflows/deploy-cloudflare.yml`: automatic Cloudflare deployment from `main` once repository secrets are configured.
- `wrangler.jsonc`: production Worker bindings for D1 and Browser Run.

## Work From A Fresh Computer

1. Clone the GitHub repository and create a `codex/<topic>` branch.
2. Use Node.js 20 or newer. No npm packages are required by the app itself.
3. Run `node scripts/check.mjs` before opening a pull request.
4. Run `node scripts/dev_server.mjs` and open `http://127.0.0.1:8788/?preview=1` for local visual testing.
5. Test both a text PDF and a scanned/image ticket when changing import behavior.
6. Commit only source files. `dist/`, `.site-source/`, generated archives and real `.env` files stay untracked.

## Current Sites Project

The existing production URL is managed by OpenAI Sites with project ID `appgprj_6a81a21462a081918377a50db825e757`. Do not replace `.openai/hosting.json` or call `create_site` merely because the current account cannot access it.

Publishing to that exact URL requires the ChatGPT/Sites account that owns the project, or an editor in the same workspace. GitHub access alone does not grant Sites publishing access.

If Sites returns `project_not_found`, continue development through GitHub but do not deploy or alter `.openai/hosting.json`. The owner account must publish later, or the project should move to Cloudflare.

## Cloudflare Deployment

Cloudflare is the account-independent publishing path. Once the GitHub repository has the required secrets, any authorized GitHub/Codex workflow can deploy without depending on a specific ChatGPT account.

Required GitHub repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `INVITE_CODE`

The workflow `Deploy Cloudflare` runs automatically on every push to `main` and can also be launched manually. It configures `INVITE_CODE` as a Worker secret before deploying.

## Current Comparison Behavior

- Active sources: Mercadona, DIA, Carrefour, Alcampo, Ahorramas, Aldi and Hipercor.
- Lidl is intentionally removed from the comparator because it does not provide a full usable price catalogue.
- Hipercor is selectable and parsed from its public catalogue. The adapter tries structured HTML, Cloudflare Browser Run and then a text-reader fallback; if all fail, it appears as unavailable.
- Supercor and Eroski are not shown as pending sources.
- Store selection is persisted per user in `user_settings`.
- All active requests run independently; one failure must not fail the entire comparison.
- Results include source links, retrieval time, pack price and normalized price when available.
- Shopping-plan rows are private by `user_id` in D1.
- Matching includes product concepts and aliases for common naming differences between stores.
- Matching ignores package-size noise such as `1 l`, `500 g` or `pack de 6`, but must preserve product constraints such as `talla 6`.
- Source endpoints can change. Update one adapter without coupling it to receipt parsing or another store.

## Ticket Parsing Notes

- Keep OCR/import parsing client-side unless storage or background processing is explicitly added.
- Hipercor paper tickets use lines like `KINDER MAXI 10 UNIDA 2 B 7,98`; parse quantity `2`, unit price `3,99` and total `7,98`. OCR variants such as `SANCHINARRO HIFER` and `KINDER MAXI 1(1 UNIDA 28 7,98` must also activate this parser.
- Ignore tax/payment/footer lines such as `Precio unitario`, `IVA`, `EFECTIVO`, `CAMBIO`, `Base`, `Cuota` and control codes.
- Preserve manual review. OCR output must never be saved without letting the user fix it.
- Product text corrections should be conservative and visible in tests.

## Next Product Work

- Calibrate parsers with anonymized real tickets from each supermarket.
- Add fixtures for new ticket formats as soon as a real sample appears.
- Add postcode/store selection and regional availability to active adapters.
- Add maintained browser adapters only when there is a reliable, permitted source.
- Include shipping, minimum order and promotion conditions without folding them into the base unit price.
