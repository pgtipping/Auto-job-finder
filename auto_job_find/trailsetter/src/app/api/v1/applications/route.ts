import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma"; // Import the Prisma client instance
import * as jose from "jose"; // Import jose for JWT validation

// User authentication/validation logic using JWT
async function validateRequest(request: NextRequest): Promise<{
  isValid: boolean;
  userId?: string;
  email?: string;
  error?: string;
}> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { isValid: false, error: "Authorization header missing or invalid" };
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return { isValid: false, error: "Bearer token missing" };
  }

  const secretString = process.env.APPLYRIGHT_SHARED_AUTH_SECRET;
  if (!secretString) {
    console.error("APPLYRIGHT_SHARED_AUTH_SECRET is not set in environment");
    return { isValid: false, error: "Server configuration error" };
  }

  try {
    const secret = new TextEncoder().encode(secretString);
    // TODO: Confirm expected issuer (iss) and audience (aud) with ApplyRight if necessary
    const { payload } = await jose.jwtVerify(token, secret, {
      // issuer: 'urn:applyright:issuer', // Example: Add expected issuer
      // audience: 'urn:autojobfinder:audience', // Example: Add expected audience
    });

    // 'sub' claim typically holds the user identifier (applyrightUserId in this context)
    const userId = payload.sub;
    const email = typeof payload.email === "string" ? payload.email : undefined;

    if (!userId) {
      return { isValid: false, error: "Invalid token: Missing 'sub' claim" };
    }

    // TODO: Optionally check for other claims like 'premium_active' if needed for logic

    console.log(`JWT validated successfully for user: ${userId}`);
    return { isValid: true, userId: userId, email: email };
  } catch (error: unknown) {
    let errorMessage = "Invalid token";
    if (error instanceof Error) {
      errorMessage = `Invalid token: ${error.message}`;
      // Specific checks for common jose errors
      if (error.name === "JWTExpired") {
        errorMessage = "Token has expired";
      } else if (error.name === "JWSSignatureVerificationFailed") {
        errorMessage = "Token signature verification failed";
      } else if (error.name === "JWTClaimValidationFailed") {
        errorMessage = `Token claim validation failed: ${error.message}`;
      }
    }
    console.error("JWT validation failed:", errorMessage);
    return { isValid: false, error: errorMessage };
  }
}

/**
 * POST /api/v1/applications
 * Initiates a job application process.
 */
export async function POST(request: NextRequest) {
  console.log("Received POST request to /api/v1/applications");

  // 1. Validate Authentication
  const authResult = await validateRequest(request);
  if (!authResult.isValid || !authResult.userId) {
    // Ensure userId is present
    console.error("Authentication failed:", authResult.error);
    return NextResponse.json(
      { error: authResult.error || "Unauthorized" },
      { status: 401 }
    );
  }
  // Use validated user ID and potentially email from the token
  const applyrightUserId = authResult.userId;
  const userEmail = authResult.email; // May be undefined if not in token
  console.log(`Request validated for user: ${applyrightUserId}`);

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

  // 4. Find or create related records and store the application
  let newApplication;
  try {
    // Upsert User based on applyrightUserId
    const user = await prisma.user.upsert({
      where: { applyrightUserId: applyrightUserId },
      update: {
        // Update email if provided in token and different from placeholder
        ...(userEmail && { email: userEmail }),
      },
      create: {
        applyrightUserId: applyrightUserId,
        // Use email from token if available, otherwise use placeholder
        email: userEmail || `${applyrightUserId}@placeholder.email`,
      },
    });
    console.log(`Upserted user: ${user.id}`);

    // Upsert Resume based on applyrightResumeId
    const resume = await prisma.resume.upsert({
      where: { applyrightResumeId: applyrightResumeId },
      update: { userId: user.id }, // Ensure it's linked to the correct user
      create: {
        applyrightResumeId: applyrightResumeId,
        userId: user.id,
      },
    });
    console.log(`Upserted resume: ${resume.id}`);

    // Upsert Job based on URL
    // Basic platform detection (can be improved)
    let platform = "unknown";
    let platformJobId = "TBD"; // Default placeholder
    if (jobUrl.includes("linkedin.com")) {
      platform = "linkedin";
      // Attempt to extract LinkedIn job ID from URL
      // Matches numbers after /view/ or ?jobId=
      const match = jobUrl.match(/(?:view|jobId=)\/(\d+)/);
      if (match && match[1]) {
        platformJobId = match[1];
        console.log(`Extracted LinkedIn Job ID: ${platformJobId}`);
      } else {
        console.warn(`Could not extract Job ID from LinkedIn URL: ${jobUrl}`);
      }
    }
    // TODO: Add extraction logic for other platforms if needed

    const job = await prisma.job.upsert({
      where: { url: jobUrl },
      update: {}, // No fields to update based on this request alone
      create: {
        url: jobUrl,
        platform: platform,
        platformJobId: platformJobId, // Use extracted ID or placeholder
        title: "Job Title TBD", // Placeholder - To be updated by automation
        company: "Company TBD", // Placeholder - To be updated by automation
        // location, description, hasQuickApply can be added later by automation
      },
    });
    console.log(`Upserted job: ${job.id}`);

    // Create the Application record linking the upserted records
    console.log(
      `Attempting to create application record for user ${user.id}, job ${job.id}, resume ${resume.id}`
    );
    newApplication = await prisma.application.create({
      data: {
        userId: user.id,
        jobId: job.id,
        resumeId: resume.id,
        applyrightCoverLetterId: applyrightCoverLetterId, // Store the linked cover letter ID
        status: "pending", // Initial status
      },
    });
    console.log("Application record created successfully:", newApplication);
  } catch (error) {
    // Log the specific error for better debugging
    console.error("Database error during upsert/create:", error);
    return NextResponse.json(
      {
        error: "Failed to initiate application process due to database error.",
      },
      { status: 500 }
    );
  }

  const applicationId = newApplication.id; // Use the actual ID from the created record

  // 5. Trigger asynchronous automation task (fire-and-forget for now)
  triggerAutomationTask({
    applicationId,
    applyrightUserId, // Pass the validated user ID
    jobUrl,
    applyrightResumeId,
    applyrightCoverLetterId,
  }).catch((error) => {
    // Log errors from the async task initiation, but don't block the response
    console.error("Error triggering automation task:", error);
  });

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

// Function to trigger the Browserless.io task asynchronously
async function triggerAutomationTask(payload: {
  applicationId: string;
  applyrightUserId: string;
  jobUrl: string;
  applyrightResumeId: string;
  applyrightCoverLetterId?: string;
}) {
  console.log(
    `Attempting to trigger automation task for application ${payload.applicationId}`
  );
  const browserlessApiKey = process.env.BROWSERLESS_API_KEY;

  if (!browserlessApiKey) {
    console.error(
      "BROWSERLESS_API_KEY is not set. Cannot trigger automation task."
    );
    // In a real scenario, might update application status to 'error' here
    return;
  }

  // TODO: Define the actual code/script to be executed by Browserless
  // This is just a placeholder structure. The 'code' property would contain
  // the Puppeteer/Playwright script as a string.
  const browserlessPayload = {
    code: `
      // Placeholder for Puppeteer/Playwright script
      module.exports = async ({ page, data }) => {
        console.log('Received data in Browserless:', data);
        // 1. Login to LinkedIn (using secure credential handling - TBD)
        // 2. Navigate to jobUrl: data.jobUrl
        // 3. Initiate Apply (check for Quick Apply)
        // 4. Fill form using data.applyrightResumeId (requires ApplyRight API call)
        // 5. Potentially use data.applyrightCoverLetterId
        // 6. Submit application
        // 7. Detect success/failure/review status
        // 8. TODO: Send status update back to our API (e.g., via webhook)
        await page.goto('https://example.com'); // Placeholder navigation
        console.log('Browserless task completed (placeholder).');
        return { success: true, message: 'Placeholder task executed.' };
      };
    `,
    context: payload, // Pass our application data to the script
  };

  try {
    const response = await fetch(
      `https://chrome.browserless.io/function?token=${browserlessApiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(browserlessPayload),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        `Browserless API request failed with status ${response.status}: ${errorBody}`
      );
      // TODO: Update application status to 'error'
    } else {
      // Browserless endpoint returns the result of the function directly
      // Since we run this async, we might not process the result here immediately.
      // A webhook from the script back to our API is a better approach for status updates.
      console.log(
        `Browserless task successfully initiated for application ${payload.applicationId}. Status: ${response.status}`
      );
      // const result = await response.json(); // Or .text() depending on script output
      // console.log('Browserless function result:', result);
    }
  } catch (error) {
    console.error("Network error calling Browserless API:", error);
    // TODO: Update application status to 'error'
  }
}
