# PAWMENUAL V2 Azure Deployment

Status: Deployed

## Approved Scope

- Preserve existing routes, React/Vite architecture, LocalStorage values, AI recommendation and Kakao hospital features.
- Add `/care-passport`, derived only from existing profile, care checklist and care/health records. Provide explicit sensitive-section checkboxes, preview, profile edit link, print-to-PDF; never fabricate dates or records.
- Add `/food-scan`, maximum 5MB JPG/JPEG/PNG/WEBP, preview/change/delete, camera capture, explicit analysis, visible loading/errors, structured result and deletable LocalStorage record. Never store or log image data.
- Reuse the existing Azure OpenAI deployment and server endpoint. Verify the actual configured deployment `gpt-6.1-sol` against the matching Foundry resource `SellReady` before enabling image analysis. If image support cannot be established or is rejected, clearly label manual text-entry mode and do not claim image OCR succeeded.
- Only values visible on the label may be extracted. Use `확인되지 않음` for absent fields, preserve printed units, never infer health safety or diagnosis.
- Add Home and food-guide links, preserve existing design system and existing user data.
- Reuse existing Azure OpenAI model, Kakao Local API key, Static Web Apps Free resource and GitHub Actions workflow.
- No new paid Azure resource, model deployment or OCR service.
- User approved production deployment to the existing Free Static Web App on main on 2026-11-14.
- User explicitly approved upgrading the existing API runtime from Node 20 to Node 22.
- Develop and commit V2 changes on a separate feature branch, then merge the approved commit to main to trigger production CI/CD.

## Existing Architecture

- Frontend: React/Vite, React Router in `app/src/App.jsx`.
- Storage: `app/src/lib/storage.js`; existing keys include profile, meal, health, training, care checklist and care logs. Add only a new versioned scanner-results key.
- API: existing Azure Functions handlers under `api/`; `api/food-recommendation/index.js` uses the OpenAI SDK and server environment variables.
- Azure deployment: existing Static Web Apps Free and GitHub Actions pipeline.

## Proposed Deployment Target

- Subscription: 제일중 이은율 (`0895acce-50d3-445f-b39d-5d0519f2f615`), previously used for PAWMENUAL.
- Resource group: `rg-pawmenual-prod` (existing, Korea Central).
- Static Web App: `pawmenual-web-51103` (existing Free plan, East Asia app location).
- Workflow: existing `.github/workflows/azure-static-web-apps-thankful-sand-0954bbe00.yml`; API path `api`, frontend `app`, output `dist`, Node 22 runtime (approved; config and package engine must match).
- Secrets: preserve existing Azure app settings; local `api/.env` is ignored and must never be committed.
- No infrastructure provisioning or plan/SKU change.
- Production deployment requires publishing to `main`. To honor the earlier separate-branch requirement, a PR/preview deployment is the alternative.

## Validation Plan

- [x] All deployment validation checks pass
	- [x] Existing `pawmenual-web-51103` resource and Free SKU confirmed.
	- [x] Existing approved subscription and app setting names confirmed; secret values were not displayed.
	- [x] `npm --prefix app run build` passes.
	- [x] `npm --prefix api test` passes (17 tests).
	- [x] V2 pages and route files pass targeted ESLint.
	- [x] Existing and V2 routes load in browser; passport print CSS and default privacy selections checked.
	- [x] Existing vision deployment accepts a minimal image-label request; absent product name stays unknown.
	- [x] Scanner image validation and manual save/reopen/delete tested; image data is not saved.
	- [x] `api/.env` is Git-ignored; SWA API path/runtime configuration verified.
	- [x] Node 22 runtime change approved; `staticwebapp.config.json` and `api/package.json` aligned.
	- [x] Final branch diff check passed before commit.
	- [x] Production GitHub Actions verification.

## 7. Validation Proof

2026-11-14: Existing Azure Free SWA and subscription verified; existing OpenAI/Kakao app-setting names confirmed without reading values. No new resource or paid plan provisioned.
`npm --prefix app run build` passed; `npm --prefix api test` passed all 17 tests; targeted V2 ESLint passed. Runtime declaration and package engine both target Node 22 (user approved). Local test runner uses Node 24, which emitted only the expected engine warning during lockfile sync. Full app lint still reports existing V1 effect/state lint errors.
Browser verified the existing six routes and new `/food-scan` and `/care-passport`. Existing vision deployment analyzed a synthetic label image; missing product name was returned as unknown. Passport print CSS hides app chrome and sensitive sections default off. Manual scanner result save/reopen/delete and file format/size rejection verified; original image is not persisted.
2026-11-14: Created and pushed `feature/pawmenual-v2`, then fast-forward merged to production `main` as commit `f60c6f7a9dc5927a0ba5d77f7a85c81ee65e20ce`.
GitHub Actions deployment run [43544018188](https://github.com/Lee-EunYul/PawMenual/actions/runs/43544018188) completed successfully.
Production smoke checks: `/`, `/profile`, `/care/food`, `/care/health`, `/training`, `/records`, `/food-scan`, `/care-passport` all returned 200. Existing AI route returned 400 for an empty invalid request (route active); Kakao nearby-hospitals API returned 200 with 44 results for a Seoul test coordinate. Production scanner accepted a 51,154-byte synthetic label image and returned structured nutrient values; missing product name was `확인되지 않음`.
`az staticwebapp show` confirms the existing resource remains on Free. No new resource was provisioned. The local `.env` was not staged. Existing unrelated untracked `.azure/validate-status.json` and `.github/workflows/copilot-instructions.md` were left untouched.