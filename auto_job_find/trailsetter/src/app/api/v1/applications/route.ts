import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma"; // Import the Prisma client instance

// Placeholder for user authentication/validation logic
async function validateRequest(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  request: NextRequest
): Promise<{ isValid: boolean; userId?: string; error?: string }> {
  // TODO: Implement JWT validation using APPLYRIGHT_SHARED_AUTH_SECRET
  // Extract token from Authorization header
  // Verify token signature and claims (iss, aud, exp, premium_active)
  // Return { isValid: true, userId: 'user_id_from_token' } or { isValid: false, error: '...' }
  console.log("TODO: Validate request JWT");
  // For now, assume valid for basic setup
  return { isValid: true, userId: "temp_user_123" };
}

/**
 * POST /api/v1/applications
 * Initiates a job application process.
 */
export async function POST(request: NextRequest) {
  console.log("Received POST request to /api/v1/applications");

  // 1. Validate Authentication
  const authResult = await validateRequest(request);
  if (!authResult.isValid) {
    console.error("Authentication failed:", authResult.error);
    return NextResponse.json(
      { error: authResult.error || "Unauthorized" },
      { status: 401 }
    );
  }
  const userId = authResult.userId;
  console.log(`Request validated for user: ${userId}`);

  // 2. Parse Request Body
  let body;
  try {
    body = await request.json();
    console.log("Request body parsed:", body);
  } catch (error) {
    console.error("Failed to parse request body:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const { jobUrl, applyrightResumeId, applyrightCoverLetterId } = body;

  // 3. Validate Input
  if (!jobUrl || !applyrightResumeId) {
    console.error("Missing required fields: jobUrl or applyrightResumeId");
    return NextResponse.json(
      { error: "Missing required fields: jobUrl and applyrightResumeId" },
      { status: 400 }
    );
  }
  console.log(
    `Received jobUrl: ${jobUrl}, resumeId: ${applyrightResumeId}, coverLetterId: ${applyrightCoverLetterId}`
  );

  // 4. Store initial application record in the database
  let newApplication;
  try {
    // TODO: Implement proper find-or-create logic for User, Job, Resume
    // For now, using placeholder IDs/logic assuming they exist or linking is handled elsewhere
    // We can safely assert userId is defined here because authResult.isValid is true
    const placeholderUserId = userId!;
    const placeholderJobId = "job_placeholder_123"; // Replace with actual Job find/create logic
    const placeholderResumeId = "resume_placeholder_456"; // Replace with actual Resume find logic based on applyrightResumeId + userId

    console.log(
      `Attempting to create application record for user ${placeholderUserId}, job ${placeholderJobId}, resume ${placeholderResumeId}`
    );

    newApplication = await prisma.application.create({
      data: {
        userId: placeholderUserId,
        jobId: placeholderJobId, // Link to the found/created Job record
        resumeId: placeholderResumeId, // Link to the found Resume record
        applyrightCoverLetterId: applyrightCoverLetterId, // Store the linked cover letter ID
        status: "pending", // Initial status
        // Other fields like notes, submittedAt will be updated later
      },
    });
    console.log("Application record created successfully:", newApplication);
  } catch (error) {
    console.error("Database error creating application record:", error);
    return NextResponse.json(
      {
        error: "Failed to initiate application process due to database error.",
      },
      { status: 500 }
    );
  }

  const applicationId = newApplication.id; // Use the actual ID from the created record

  // 5. TODO: Trigger asynchronous automation task
  //    - This could involve calling Browserless.io API
  //    - Pass necessary details: applicationId, userId, jobUrl, applyrightResumeId, applyrightCoverLetterId
  console.log(`TODO: Trigger automation task for application ${applicationId}`);

  // 6. Return initial response
  console.log(`Returning initial response for application ${applicationId}`);
  return NextResponse.json(
    {
      applicationId: applicationId, // Use actual ID
      status: newApplication.status, // Use status from created record
      message: "Application process initiated.",
    },
    { status: 202 } // Accepted
  );
}
