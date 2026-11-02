# Azure OpenAI Food Recommendations

Status: Validated

## Deployment Approval

User requested Azure deployment on 2026-11-02. Update the existing Free Static Web App only; do not create paid infrastructure. Application API usage charges remain separate.

## Recipe

- Type: AZCLI and existing GitHub Actions workflow.
- Subscription: 0895acce-50d3-445f-b39d-5d0519f2f615
- Resource group: rg-pawmenual-prod
- Static Web App: pawmenual-web-51103, East Asia, Free
- Frontend: app; build output: dist; managed API: api; runtime: node:20.
- Configure server secrets from local api/.env without printing values; never commit that file.
- Publish approved application changes to the existing main branch to trigger deployment.

## Validation Steps

- [x] All validation checks pass
	- [x] Existing resource and Free SKU confirmed.
	- [x] Frontend build and API tests pass.
	- [x] Runtime and SPA routing configuration parse correctly.
	- [x] Required local server environment values exist and secrets are Git-ignored.
	- [x] No infrastructure/RBAC changes; existing subscription access verified.

## 7. Validation Proof

2026-11-02: `npm --prefix app run build` passed; `npm --prefix api test` passed 10 tests.
`az staticwebapp show` confirmed existing resource and Free SKU; `az account show` confirmed approved subscription.
`git check-ignore api/.env` passed; Node environment-presence check confirmed required values without printing them.
Static config JSON parsed; node:20 runtime specified; API lockfile synchronized.
RBAC/IaC what-if/container/policy provisioning checks are not applicable: existing GitHub CI/CD application-only update, no infrastructure creation or role changes.
`gh api repos/Lee-EunYul/PawMenual --jq .permissions.push` confirmed write access. `git -c core.whitespace=cr-at-eol diff --check` passed.

- Keep the existing React/Vite frontend and Static Web Apps Free hosting.
- Add an integrated Node.js Functions API under api/.
- Keep Azure OpenAI credentials in api/.env locally and server application settings in Azure.
- Protect the production recommendation route with Static Web Apps authentication.
- Request recommendations only on button clicks; limit input size and output tokens.
- Preserve the existing basic guide and clearly distinguish it from AI results.
- Validate with mocked API tests and a frontend production build. Live model testing requires locally supplied credentials.
- Deploy only to the existing Free resource after validation.