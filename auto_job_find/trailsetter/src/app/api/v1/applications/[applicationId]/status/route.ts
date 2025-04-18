import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // Corrected: Use named import

// Placeholder for a shared secret validation mechanism
const validateAutomationRequest = (request: Request): boolean => {
  const secret = request.headers.get("X-Automation-Secret");
  // TODO: Implement proper secret validation using environment variables
  // For now, allow any request if the header exists (replace with actual check)
  // return secret === process.env.BROWSERLESS_CALLBACK_SECRET;
  return !!secret; // Placeholder: Allow if header exists
};

interface StatusUpdatePayload {
  status: string; // e.g., 'PROCESSING', 'APPLIED', 'FAILED', 'NEEDS_REVIEW'
  message?: string; // Optional details or error message
  jobTitle?: string; // Optional: Update job title if found
  jobCompany?: string; // Optional: Update job company if found
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

    // Explicitly type the expected return shape when using include
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { job: true }, // Include job to potentially update it
    });

    // Add a check if application exists before proceeding
    if (!application) {
      console.error(`Application not found for ID: ${applicationId}`);
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    // Type assertion to help TypeScript understand the included relation
    // Note: This assumes the relation always exists if the application is found,
    // which should be true based on the schema being non-nullable.
    const job = application.job;

    // Prepare data for update (Removed the misplaced/redundant check)
    const updateData: {
      status: string;
      job?: { update?: { title?: string; company?: string } };
    } = {
      status: payload.status,
    };

    // Conditionally update job details if provided and not already set
    // Use the 'job' variable derived from the included relation
    const jobUpdateData: { title?: string; company?: string } = {};
    if (payload.jobTitle && !job.title) {
      // Use job.title
      jobUpdateData.title = payload.jobTitle;
    }
    if (payload.jobCompany && !job.company) {
      // Use job.company
      jobUpdateData.company = payload.jobCompany;
    }

    if (Object.keys(jobUpdateData).length > 0) {
      updateData.job = {
        update: jobUpdateData,
      };
    }

    // Perform the update
    const updatedApplication = await prisma.application.update({
      where: { id: applicationId },
      data: updateData,
    });

    console.log(
      `Successfully updated status for application ID: ${applicationId} to ${payload.status}`
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
