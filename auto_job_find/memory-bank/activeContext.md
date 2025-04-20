# Active Context - 4/19/2025, 10:18:00 PM

## Current State - 4/19/2025, 10:18:00 PM

The core backend infrastructure (`trailsetter/`) is stable.

- The `POST /api/v1/applications` route correctly handles JWT validation, data upserts, dynamic script loading, credential decryption, and triggers the Browserless task with necessary context.
- The `POST /api/v1/applications/[applicationId]/status` route **now validates the incoming request using `AUTOMATION_CALLBACK_SECRET` and updates the corresponding `Application` record in the database with the received status, error message, and sets `submittedAt` on success.**
- The ApplyRight client (`trailsetter/src/lib/applyrightClient.ts`) includes a working implementation for fetching user profiles (`getApplyRightUserProfile`).

The Browserless script (`trailsetter/src/browserless-scripts/linkedinLogin.ts`) implements the core Easy Apply flow:

- Handles login with challenge detection.
- Fetches the ApplyRight user profile.
- Navigates to the job URL.
- Detects the Easy Apply button.
- Fills the email field using the fetched profile data.
- Uploads the resume fetched via the backend download endpoint.
- Handles common additional questions (placeholders/defaults).
- Includes refined submission/outcome detection logic.
- Sends granular status updates (including errors) via the `sendStatusUpdate` helper to the backend status endpoint.

Key components established:

1.  **Next.js Project (`trailsetter/`)**: Initialized and configured.
2.  **Prisma Setup**: Schema defined (including encrypted credential fields), client generated, singleton instance created.
3.  **Database**: Migrations applied (`init`, `add_linkedin_credentials`). Application status updates are functional.
4.  **API Routes**:
    - `/api/v1/applications`: Implemented JWT validation, find-or-create logic, credential decryption, dynamic script loading, and Browserless task triggering.
    - `/api/v1/applications/[applicationId]/status`: Endpoint implemented with secret validation and DB update logic.
    - `/api/apply-right/download/[resumeId]`: Endpoint created for ApplyRight to download resumes.
5.  **ApplyRight Client**: Implemented `getApplyRightUserProfile` in `trailsetter/src/lib/applyrightClient.ts`.
6.  **Browserless Script (`linkedinLogin.ts`)**: Core Easy Apply logic implemented, including profile fetch and email filling. Sends status updates.
7.  **Dependencies**: Installed `playwright` dev dependency.
8.  **Configuration**: `.env.example` includes necessary variables. User confirmed `.env` is configured.
9.  **Security Utilities**: `cryptoUtils.ts` created for encryption/decryption.
10. **Memory Bank**: Updated (`progress.md`, `activeContext.md`).
11. **MCP**: `postgres-mcp` server installed and configured successfully.

## Recent Changes - 4/19/2025, 10:18:00 PM

- **Status Update Route (`status/route.ts`)**:
  - Implemented request validation using `X-Automation-Secret` header and `AUTOMATION_CALLBACK_SECRET` environment variable.
  - Added logic to update `Application` record's `status`, `errorMessage`, and `submittedAt` fields based on the payload from the Browserless script.
  - Updated `StatusUpdatePayload` interface to include `error`.
- **Configuration (`.env.example`)**: Added `AUTOMATION_CALLBACK_SECRET` and `AUTOMATION_CALLBACK_URL`.
- **Memory Bank**: Updated `progress.md` and `activeContext.md` to reflect completed tasks and new focus.

## Current Focus - 4/19/2025, 10:18:00 PM

Preparing for and conducting end-to-end testing of the entire application flow, from initiating an application via the API to observing the Browserless script execution and verifying the final status update in the database.

## Next Steps - 4/19/2025, 10:18:00 PM

1.  **Prepare Test Environment**:
    - Ensure all required environment variables are correctly set in `.env` (`DATABASE_URL`, `APPLYRIGHT_SHARED_AUTH_SECRET`, `BROWSERLESS_API_KEY`, `CREDENTIAL_ENCRYPTION_KEY`, `AUTOMATION_CALLBACK_SECRET`, `AUTOMATION_CALLBACK_URL` pointing to the running dev server).
    - Ensure the development database contains a test user with encrypted LinkedIn credentials (manually added for now).
    - Ensure the Next.js development server (`npm run dev` in `trailsetter/`) is running.
2.  **Execute Test API Call**: Use a tool like `curl`, Postman, or an HTTP client script to send a `POST` request to `/api/v1/applications` with a valid JWT, a LinkedIn job URL, and an `applyrightResumeId`.
3.  **Monitor Execution**:
    - Observe the console logs from the Next.js server (`applications/route.ts` and `status/route.ts`).
    - Observe the console logs from the Browserless script execution (if Browserless provides access to these).
    - Check the database (`Application` table) to verify status updates (`pending` -> processing steps -> `SUBMISSION_SUCCESS` or error status) and `errorMessage`/`submittedAt` fields.
4.  **Analyze Results & Debug**: Identify and fix any issues encountered during the flow (e.g., script errors, API errors, incorrect status updates).
5.  **(Post-Testing)** **Build Initial Web UI**: Begin development of the basic web interface for submitting applications and viewing status.

## Active Decisions - 4/19/2025, 10:18:00 PM

- **Automation Service**: Use Browserless.io.
- **Backend Framework**: Next.js (TypeScript, App Router, Tailwind).
- **Database ORM**: Prisma.
- **Project Structure**: Next.js app located in `trailsetter/` subdirectory.
- **LinkedIn Strategy**: Browser automation via Browserless.io for application submission.
- **Authentication**: JWT via `Authorization: Bearer` header, validated using `jose` and `APPLYRIGHT_SHARED_AUTH_SECRET`.
- **API Structure**:
  - Main application initiation: `POST /api/v1/applications`.
  - Status updates from automation: `POST /api/v1/applications/[applicationId]/status` (requires `X-Automation-Secret` header, validated against `AUTOMATION_CALLBACK_SECRET`).
- **ApplyRight Client**: Utility functions in `trailsetter/src/lib/applyrightClient.ts`, requires `APPLYRIGHT_API_BASE_URL` env var. Called from Browserless script using user's JWT. Implemented profile fetch.
- **Browserless Scripting**: Using Playwright within Node.js environment provided by Browserless (`linkedinLogin.ts`). Handles login, profile fetch, navigation, email filling, resume upload, question handling. Sends status updates to backend.
- **Data Passing to Browserless**: Sensitive data (token, credentials, callback info) via `context`; non-sensitive (IDs, job URL) via `data`.
- **Credential Storage**: Encrypted LinkedIn credentials stored in the PostgreSQL database (`User` table). Encryption uses AES-256-GCM via `cryptoUtils.ts` and `CREDENTIAL_ENCRYPTION_KEY`.
- **Contact Info Source**: Email fetched from ApplyRight User Profile. Phone number pending API update/alternative source.
- **Status Update Validation**: Using a shared secret (`AUTOMATION_CALLBACK_SECRET`) passed via the `X-Automation-Secret` header.
