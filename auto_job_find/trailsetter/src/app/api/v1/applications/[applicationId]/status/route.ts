import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // Corrected: Use named import

// Placeholder for a shared secret validation mechanism
const validateAutomationRequest = (request: Request): boolean => {
  const receivedSecret = request.headers.get("X-Automation-Secret");
  const expectedSecret = process.env.AUTOMATION_CALLBACK_SECRET;

  if (!expectedSecret) {
    console.error(
      "CRITICAL: AUTOMATION_CALLBACK_SECRET is not set in environment. Cannot validate callback requests."
    );
    return false; // Fail validation if the expected secret isn't configured
  }

  if (!receivedSecret || receivedSecret !== expectedSecret) {
    console.warn(
      "Callback validation failed: Incorrect or missing X-Automation-Secret header."
    );
    return false;
  }

  return true; // Secrets match
};

interface StatusUpdatePayload {
  status: string; // e.g., 'PROCESSING', 'APPLIED', 'FAILED', 'NEEDS_REVIEW'
  message?: string; // Optional details
  error?: string; // Optional error message
  // Removed jobTitle and jobCompany as we are not updating job from status endpoint for now
}

export async function POST(
  request: Request,
  { params }: { params: { applicationId: string } }
) {
  console.log(
    `Received status update request for application ID: ${params.applicationId}`
  );

  // 1. Validate the request (e.g., check a shared secret)
  if (!validateAutomationRequest(request)) {
    console.error("Status update request validation failed.");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse the request body
  let payload: StatusUpdatePayload;
  try {
    payload = await request.json();
    console.log("Received payload:", payload);
    if (!payload.status) {
      throw new Error("Missing required status field in payload.");
    }
  } catch (error) {
    console.error("Failed to parse request body:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  // 3. Find and update the application record
  try {
    const applicationId = params.applicationId; // ID is a string (UUID)
    if (!applicationId || typeof applicationId !== "string") {
      // Basic validation
      return NextResponse.json(
        { error: "Invalid application ID format" },
        { status: 400 }
      );
    }

    // Prepare data for update, including status and errorMessage
    // errorMessage will be set to the payload's error message, or null if no error provided
    const updateData = {
      status: payload.status,
      errorMessage: payload.error || null, // Set errorMessage from payload, default to null
      // Add submittedAt timestamp if status indicates success
      ...(payload.status === "SUBMISSION_SUCCESS" && {
        submittedAt: new Date(),
      }),
    };

    // Perform the update
    const updatedApplication = await prisma.application.update({
      where: { id: applicationId },
      data: updateData,
    });

    console.log(
      `Successfully updated status for application ID: ${applicationId} to ${payload.status}. Error message: ${updateData.errorMessage}`
    );
    // TODO: Potentially trigger notifications or other actions here

    return NextResponse.json({ success: true, updatedApplication });
  } catch (error) {
    console.error(
      `Error updating application status for ID: ${params.applicationId}:`,
      error
    );
    // Consider more specific error handling based on Prisma errors
    return NextResponse.json(
      { error: "Failed to update application status" },
      { status: 500 }
    );
  }
}
