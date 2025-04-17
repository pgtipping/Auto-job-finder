# ApplyRight API Integration - 2025-04-16 22:08

This document outlines the API contract and integration points between the Auto Job Finder service and the existing ApplyRight platform.

## Authentication - 2025-04-16 22:08

- **Method**: Shared JWT (JSON Web Token)
- **Flow**:
  1. User logs into ApplyRight (or Auto Job Finder, assuming shared login).
  2. ApplyRight issues a JWT containing user ID, premium status, and potentially other relevant claims.
  3. Auto Job Finder receives this JWT with requests originating from the ApplyRight frontend or via direct API calls.
  4. Auto Job Finder validates the JWT signature using a shared secret (`APPLYRIGHT_SHARED_AUTH_SECRET` from `.env`).
  5. Auto Job Finder extracts user information and premium status from the validated token to authorize actions.
- **Token Claims (Required)**:
  - `sub` (Subject/User ID - matching ApplyRight's user ID)
  - `premium_active` (Boolean - indicates if Auto Job Finder feature is enabled for the user)
  - `exp` (Expiration Time)
  - `iss` (Issuer - ApplyRight)
  - `aud` (Audience - Auto Job Finder)

## API Endpoints (Auto Job Finder -> ApplyRight) - 2025-04-16 22:08

These are endpoints that the Auto Job Finder service will need to call on the ApplyRight API.

1.  **Get Optimized Resume Data**

    - **Endpoint**: `GET /api/v1/resumes/{applyright_resume_id}/optimized` (Example path)
    - **Auth**: Requires validated shared JWT.
    - **Purpose**: Retrieve the processed/optimized resume content associated with a specific ApplyRight resume ID.
    - **Response**: JSON containing resume structure, text content, keywords, etc.

2.  **Get Generated Cover Letter**

    - **Endpoint**: `GET /api/v1/cover-letters/{applyright_cover_letter_id}` (Example path)
    - **Auth**: Requires validated shared JWT.
    - **Purpose**: Retrieve the generated cover letter content associated with a specific ApplyRight cover letter ID.
    - **Response**: JSON containing cover letter text, associated job details, etc.

3.  **Get User Profile/Preferences**
    - **Endpoint**: `GET /api/v1/users/me/profile` (Example path)
    - **Auth**: Requires validated shared JWT.
    - **Purpose**: Retrieve user details relevant to job applications (name, contact info, etc.) if not included in JWT.
    - **Response**: JSON containing user profile data.

## API Endpoints (ApplyRight -> Auto Job Finder) - 2025-04-16 22:08

These are endpoints that the Auto Job Finder service will expose for ApplyRight to call. (These will likely be implemented within the Next.js backend on Vercel).

1.  **Initiate Job Application**

    - **Endpoint**: `POST /api/v1/applications`
    - **Auth**: Requires validated shared JWT.
    - **Purpose**: Trigger the start of an automated job application process.
    - **Request Body**:
      ```json
      {
        "jobUrl": "https://www.linkedin.com/jobs/view/...",
        "applyrightResumeId": "resume_abc123",
        "applyrightCoverLetterId": "coverletter_xyz789" // Optional
      }
      ```
    - **Response**: JSON containing an application ID and initial status (`pending`, `processing`).

2.  **Get Application Status**
    - **Endpoint**: `GET /api/v1/applications/{application_id}`
    - **Auth**: Requires validated shared JWT.
    - **Purpose**: Allow ApplyRight to query the status of a specific application being processed by Auto Job Finder.
    - **Response**: JSON containing application status, details, logs, etc.

## Webhooks (Auto Job Finder -> ApplyRight) - 2025-04-16 22:08

Auto Job Finder will send webhook events to ApplyRight to provide real-time status updates.

- **Webhook URL**: Configured in ApplyRight, points to an ApplyRight endpoint.
- **Authentication**: Signed requests using `APPLYRIGHT_WEBHOOK_SECRET`.
- **Events**:
  - `application.updated`: Sent when application status changes (e.g., `processing`, `requires_review`, `submitted`, `failed`).
  - `application.screenshot_ready`: Sent when a preview screenshot is available.
  - `application.error`: Sent when a critical error occurs.
- **Payload**: JSON containing application ID, event type, timestamp, and relevant data (status, error message, screenshot URL).

## Data Synchronization - 2025-04-16 22:08

- User data primarily resides in ApplyRight. Auto Job Finder uses the shared JWT and potentially fetches profile data via API.
- Application history should ideally be consolidated. Auto Job Finder will push status updates back to ApplyRight via webhooks or allow ApplyRight to poll the status endpoint.
