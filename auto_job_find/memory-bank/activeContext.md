# Active Context - 2025-04-17 00:00

## Current State - 2025-04-17 00:00

The project has pivoted from a self-hosted Python automation engine to using a cloud-based browser automation service (Browserless.io) integrated with a Next.js backend.

Key components established:

1.  **Next.js Project (`trailsetter/`)**: Initialized with TypeScript, Tailwind CSS, ESLint, and App Router. Located in `auto_job_find/trailsetter/`.
2.  **Prisma Setup**: Initialized within `trailsetter/`, schema defined (`prisma/schema.prisma`), client generated (`src/generated/prisma`), and singleton instance created (`src/lib/prisma.ts`).
3.  **API Route (`/api/v1/applications`)**: Placeholder created (`src/app/api/v1/applications/route.ts`) with basic structure, request validation placeholders, and initial database interaction logic using Prisma to create an `Application` record.
4.  **Configuration**: `.env.example` updated with `BROWSERLESS_API_KEY` placeholder. `.gitignore` confirmed to ignore `.env*` files.
5.  **Memory Bank**: Updated with ApplyRight API integration details (`integrations/applyright_api.md`), database schema (`database/schema.md`), and LinkedIn integration strategy (`integrations/linkedin_strategy.md`).

## Recent Changes - 2025-04-17 00:00

- **Architecture Shift**: Decided to use Browserless.io for cloud browser automation instead of a self-hosted Docker container on Fly.io.
- **Backend Initialization**: Created the `trailsetter` Next.js project.
- **Database Setup**: Configured Prisma, defined the schema, and generated the client.
- **API Implementation**: Created the initial `POST /api/v1/applications` endpoint with Prisma integration.
- **Documentation**: Added new Memory Bank files for API integration, DB schema, and LinkedIn strategy. Updated `.env.example`.

## Current Focus - 2025-04-17 00:00

Refining the initial backend setup and preparing for core logic implementation.

1.  **API Refinement**: Implement the remaining TODOs in the `/api/v1/applications` route, specifically the find-or-create logic for related User, Job, and Resume records.
2.  **Authentication**: Implement the JWT validation logic (`validateRequest` function) based on the shared secret with ApplyRight.
3.  **Automation Trigger**: Implement the logic to trigger the asynchronous task, likely involving structuring the call to the Browserless.io API.
4.  **Database Migrations**: Apply the initial Prisma schema to a development database.

## Next Steps - 2025-04-17 00:00

1.  **Database Connection**: Configure the `DATABASE_URL` in `trailsetter/.env` to point to a valid PostgreSQL development database.
2.  **Run Initial Migration**: Execute `npx prisma migrate dev --name init` within the `trailsetter` directory to create the database tables based on `schema.prisma`.
3.  **Implement Find/Create Logic**: Update `trailsetter/src/app/api/v1/applications/route.ts` to correctly find or create related `User`, `Job`, and `Resume` records before creating the `Application` record. This will require adding more Prisma queries.
4.  **Implement JWT Validation**: Update the `validateRequest` function in the API route to perform actual JWT validation using the `APPLYRIGHT_SHARED_AUTH_SECRET`. Libraries like `jose` or `jsonwebtoken` will be needed.
5.  **Browserless.io Integration**:
    - Sign up for Browserless.io free tier and add the API key to `trailsetter/.env`.
    - Implement the initial structure for calling the Browserless.io API (Step 5 TODO in the API route), likely involving sending a Puppeteer/Playwright script.

## Active Decisions - 2025-04-17 00:00

- **Automation Service**: Use Browserless.io.
- **Backend Framework**: Next.js (TypeScript, App Router, Tailwind).
- **Database ORM**: Prisma.
- **Project Structure**: Next.js app located in `trailsetter/` subdirectory.
- **LinkedIn Strategy**: Browser automation via Browserless.io for application submission. Official API potentially for job discovery later.
