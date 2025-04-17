# Database Schema - 2025-04-16 22:08

This document outlines the proposed PostgreSQL database schema for the Auto Job Finder service.

## Schema Diagram (Conceptual) - 2025-04-16 22:08

```mermaid
erDiagram
    USERS ||--o{ RESUMES : "has"
    USERS ||--o{ APPLICATIONS : "creates"
    JOBS ||--o{ APPLICATIONS : "targets"
    RESUMES ||--o{ APPLICATIONS : "uses"

    USERS {
        string id PK "UUID/Serial"
        string applyright_user_id UK, Idx "Link to ApplyRight User"
        string email UK
        datetime created_at
        datetime updated_at
    }

    RESUMES {
        string id PK "UUID/Serial"
        string user_id FK "References USERS.id"
        string applyright_resume_id UK "Link to ApplyRight Resume"
        datetime created_at
        datetime updated_at
        boolean is_default "Optional"
    }

    JOBS {
        string id PK "UUID/Serial"
        string platform "e.g., 'linkedin'"
        string platform_job_id Idx "Job ID from platform"
        string url UK
        string title
        string company
        string location Nullable
        string description Nullable "TEXT"
        boolean has_quick_apply Nullable
        datetime created_at
        datetime updated_at
        UK platform, platform_job_id "Unique Constraint"
    }

    APPLICATIONS {
        string id PK "UUID/Serial"
        string user_id FK "References USERS.id"
        string job_id FK "References JOBS.id"
        string resume_id FK "References RESUMES.id"
        string applyright_cover_letter_id Nullable "Link to ApplyRight Cover Letter"
        string status Idx "pending, processing, requires_review, submitted, error, etc."
        datetime submitted_at Nullable
        datetime last_status_update
        string error_message Nullable "TEXT"
        string notes Nullable "TEXT"
        datetime created_at
        datetime updated_at
    }
```

## Table Definitions - 2025-04-16 22:08

### `Users`

Stores basic user information, primarily linking to ApplyRight.

- `id` (PK, UUID/Serial)
- `applyright_user_id` (VARCHAR/UUID, Unique, Indexed): Link to the corresponding user in ApplyRight.
- `email` (VARCHAR, Unique): User's email, potentially synced from ApplyRight.
- `created_at` (TIMESTAMP): Timestamp of record creation.
- `updated_at` (TIMESTAMP): Timestamp of last update.
- _Note_: Authentication details (password) and subscription status are expected to be managed by ApplyRight and verified via shared JWT.

### `Resumes`

Tracks resumes linked from ApplyRight that the user has associated with Auto Job Finder.

- `id` (PK, UUID/Serial)
- `user_id` (FK to Users.id): The user who owns this resume link.
- `applyright_resume_id` (VARCHAR/UUID, Unique): Link to the specific resume in ApplyRight.
- `created_at` (TIMESTAMP): Timestamp of record creation.
- `updated_at` (TIMESTAMP): Timestamp of last update.
- `is_default` (BOOLEAN): Optional flag to mark a default resume for the user.
- _Note_: Actual resume content is fetched from ApplyRight via API as needed.

### `Jobs`

Stores information about job postings discovered or added by the user.

- `id` (PK, UUID/Serial)
- `platform` (VARCHAR): The platform where the job was found (e.g., 'linkedin').
- `platform_job_id` (VARCHAR, Indexed): The job's unique identifier on the source platform.
- `url` (VARCHAR, Unique): The direct URL to the job posting.
- `title` (VARCHAR): Job title.
- `company` (VARCHAR): Company name.
- `location` (VARCHAR, Nullable): Job location.
- `description` (TEXT, Nullable): Job description text (potentially summarized).
- `has_quick_apply` (BOOLEAN, Nullable): Indicates if LinkedIn Quick Apply is available.
- `created_at` (TIMESTAMP): Timestamp of record creation.
- `updated_at` (TIMESTAMP): Timestamp of last update.
- _Constraint_: Unique index on (`platform`, `platform_job_id`).

### `Applications`

Tracks the status and details of each job application attempt made through the system.

- `id` (PK, UUID/Serial)
- `user_id` (FK to Users.id): The user who initiated the application.
- `job_id` (FK to Jobs.id): The job being applied for.
- `resume_id` (FK to Resumes.id): The internal reference to the resume record used for this application.
- `applyright_cover_letter_id` (VARCHAR/UUID, Nullable): Link to the specific ApplyRight cover letter used (if any).
- `status` (VARCHAR, Indexed): Current status of the application (e.g., `pending`, `processing`, `requires_review`, `submitted`, `error`, `withdrawn`, `rejected`, `interviewing`, `offer`).
- `submitted_at` (TIMESTAMP, Nullable): Timestamp when the application was successfully submitted.
- `last_status_update` (TIMESTAMP): Timestamp of the last status change.
- `error_message` (TEXT, Nullable): Stores details if an error occurred during processing.
- `notes` (TEXT, Nullable): User-added notes about the application.
- `created_at` (TIMESTAMP): Timestamp of record creation.
- `updated_at` (TIMESTAMP): Timestamp of last update.

## Migration Strategy - 2025-04-16 22:08

- **Tool**: Prisma Migrate (integrates well with Next.js/Vercel).
- **Process**:
  1.  Define the schema models in `prisma/schema.prisma`.
  2.  Use `npx prisma migrate dev` during development to generate SQL migration files and apply changes to the development database.
  3.  In the CI/CD pipeline for deployment, use `npx prisma migrate deploy` to apply pending migrations to the production database.
