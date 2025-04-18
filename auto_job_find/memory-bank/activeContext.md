# Active Context - 2025-04-18 00:57

## Current State - 2025-04-18 00:57

The core backend infrastructure for the `trailsetter` Next.js application is established, including API routes for application initiation (`/api/v1/applications`) and status updates (`/api/v1/applications/[applicationId]/status`), Prisma setup, and placeholder ApplyRight API client functions. The initial Browserless.io script for LinkedIn login (`trailsetter/src/browserless-scripts/linkedinLogin.ts`) has been created using Playwright. This script includes basic login logic (navigation, filling fields, clicking submit), login success verification, and a helper function (`sendStatusUpdate`) to send status callbacks (success/failure) back to the backend API. The `playwright` dependency has been installed.

Key components established:

1.  **Next.js Project (`trailsetter/`)**: Initialized and configured.
2.  **Prisma Setup**: Schema defined, client generated, singleton instance created.
3.  **Database**: Initial migration (`init`) successfully applied to the development database.
4.  **API Routes**:
    - `/api/v1/applications`: Implemented JWT validation (`jose`), find-or-create logic for User/Job/Resume (with basic LinkedIn ID extraction), and initial Browserless.io API call structure.
    - `/api/v1/applications/[applicationId]/status`: Endpoint created and validated.
5.  **ApplyRight Client**: Placeholder functions created in `trailsetter/src/lib/applyrightClient.ts`.
6.  **Browserless Script (`linkedinLogin.ts`)**: Initial script created in `trailsetter/src/browserless-scripts/`. Includes Playwright setup, basic login steps, success check, and status callback helper (`sendStatusUpdate`).
7.  **Dependencies**: Installed `playwright` dev dependency in `trailsetter/`.
8.  **Configuration**: `.env.example` includes necessary variables (`DATABASE_URL`, `APPLYRIGHT_SHARED_AUTH_SECRET`, `BROWSERLESS_API_KEY`, `APPLYRIGHT_API_BASE_URL`). User confirmed `.env` is configured.
9.  **Memory Bank**: Updated to reflect backend setup completion.
10. **MCP**: `postgres-mcp` server installed and configured successfully.

## Recent Changes - 2025-04-18 00:57

- **Browserless Script Creation**: Created `trailsetter/src/browserless-scripts/linkedinLogin.ts`.
- **Playwright Installation**: Installed `playwright` and browser binaries in `trailsetter/`.
- **LinkedIn Login Logic**: Implemented basic login steps (navigate, fill fields, click) using Playwright in `linkedinLogin.ts`.
- **Login Verification**: Added basic check for successful login by waiting for a feed element.
- **Status Callback Implementation**: Added `sendStatusUpdate` helper function using `fetch` to call the backend status endpoint. Integrated calls to this function for success and failure scenarios within `linkedinLogin.ts`.
- **Error Handling**: Resolved TypeScript/ESLint errors related to `playwright` import, unused variables, and type checking in `catch` blocks within `linkedinLogin.ts`.

## Current Focus - 2025-04-18 00:57

Continuing development of the Browserless automation script (`linkedinLogin.ts` or potentially new scripts).

1.  **Refine Login & Error Handling**: Improve the robustness of the LinkedIn login logic in `linkedinLogin.ts`, specifically handling potential captchas, MFA prompts, or different page structures.
2.  **Secure Credential Handling**: Implement the chosen strategy for securely passing/accessing LinkedIn credentials within the Browserless environment (e.g., using Browserless secure context variables instead of passing directly in `data`).
3.  **Job Navigation & Application Logic**: Extend the script (or create a new one called by the login script) to:
    - Navigate to the `jobUrl` provided in the `data`.
    - Detect if the job uses LinkedIn's "Easy Apply" / "Quick Apply" feature.
    - Implement logic to interact with the application form.
4.  **ApplyRight API Integration**:
    - Determine how the necessary `authToken` (user's JWT) will be passed securely to the Browserless script context.
    - Import and use the `getApplyRightResume` and potentially `getApplyRightUserProfile` functions from `trailsetter/src/lib/applyrightClient.ts` within the script to fetch data needed for form filling.
5.  **Form Filling & Submission**: Implement the logic to fill the application form fields using data obtained from ApplyRight and submit the application.
6.  **Outcome Detection**: Implement logic to detect the outcome of the submission (e.g., success message, error message, confirmation page).
7.  **Refine Status Callbacks**: Update the `sendStatusUpdate` calls to reflect more granular statuses (e.g., `NAVIGATING_TO_JOB`, `APPLYING`, `SUBMITTED`, `APPLICATION_FAILED`, `NEEDS_REVIEW`).

## Next Steps - 2025-04-18 00:57

1.  **Secure Credential Handling**: Research and implement the method for securely providing LinkedIn credentials to the Browserless script (e.g., investigate Browserless secure context variables or environment variables). Update `linkedinLogin.ts` and the backend API call (`triggerAutomationTask` in `applications/route.ts`) accordingly.
2.  **Pass Auth Token**: Modify `triggerAutomationTask` in `applications/route.ts` to securely include the user's JWT (`authToken`) in the data passed to the Browserless script context, so it can be used for ApplyRight API calls. Update the `ScriptData` interface in `linkedinLogin.ts`.
3.  **Job Navigation**: Add logic to `linkedinLogin.ts` (after successful login) to navigate to the `jobUrl`.
4.  **ApplyRight Client Usage**: Import `getApplyRightResume` into `linkedinLogin.ts` and add a placeholder call after successful login/navigation to test fetching resume data using the passed `authToken`.

## Active Decisions - 2025-04-18 00:57

- **Automation Service**: Use Browserless.io.
- **Backend Framework**: Next.js (TypeScript, App Router, Tailwind).
- **Database ORM**: Prisma.
- **Project Structure**: Next.js app located in `trailsetter/` subdirectory.
- **LinkedIn Strategy**: Browser automation via Browserless.io for application submission.
- **Authentication**: JWT via `Authorization: Bearer` header, validated using `jose` and `APPLYRIGHT_SHARED_AUTH_SECRET`.
- **API Structure**:
  - Main application initiation: `POST /api/v1/applications`.
  - Status updates from automation: `POST /api/v1/applications/[applicationId]/status` (requires `X-Automation-Secret` header TBD).
- **ApplyRight Client**: Utility functions in `trailsetter/src/lib/applyrightClient.ts`, requires `APPLYRIGHT_API_BASE_URL` env var. To be called from Browserless script.
- **Browserless Scripting**: Using Playwright within Node.js environment provided by Browserless. Initial script focuses on login (`linkedinLogin.ts`). Status updates via helper function calling backend API.
