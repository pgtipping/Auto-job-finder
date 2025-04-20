import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
// Removed duplicate imports below
import { prisma } from "@/lib/prisma"; // Import the Prisma client instance
// Removed problematic Prisma type imports - rely on inference
import * as jose from "jose"; // Import jose for JWT validation
import * as fs from "fs/promises"; // Import fs promises API
import * as path from "path"; // Import path module
import { decrypt } from "@/lib/cryptoUtils"; // Import the decrypt function

// User authentication/validation logic using JWT
async function validateRequest(request: NextRequest): Promise<{
  isValid: boolean;
  userId?: string;
  email?: string;
  token?: string; // Add token to the return type
  error?: string;
}> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { isValid: false, error: "Authorization header missing or invalid" };
  }

  const token = authHeader.split(" ")[1]; // Use const as it's assigned once
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
    return { isValid: true, userId: userId, email: email, token: token }; // Return the token
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
  // Declare variables outside the try block to ensure they are accessible later
  let user: Awaited<ReturnType<typeof prisma.user.upsert>> | null = null; // Use inferred type
  let decryptedPassword: string | undefined;
  let newApplication: Awaited<
    ReturnType<typeof prisma.application.create>
  > | null = null; // Use inferred type

  try {
    // Upsert User based on applyrightUserId
    user = await prisma.user.upsert({
      where: { applyrightUserId: applyrightUserId },
      update: {
        // Update email if provided in token and different from placeholder
        ...(userEmail && { email: userEmail }),
      },
      create: {
        applyrightUserId: applyrightUserId,
        // Use email from token if available, otherwise use placeholder
        email: userEmail || `${applyrightUserId}@placeholder.email`,
        // NOTE: Credentials fields (e.g., linkedinUsername, linkedinPasswordEncrypted) need to be added to the schema first
      },
      // Select the user object including the new credential fields
      select: {
        id: true,
        applyrightUserId: true,
        email: true,
        createdAt: true,
        updatedAt: true,
        linkedinUsername: true, // Select username
        linkedinPasswordEncrypted: true, // Select encrypted password
      },
    });
    console.log(
      `Upserted user: ${user.id}. Fetched credentials (username: ${
        user.linkedinUsername ? "yes" : "no"
      }, encrypted password: ${user.linkedinPasswordEncrypted ? "yes" : "no"})`
    );

    // Decrypt password if it exists
    // Remove 'let' to assign to the variable declared in the outer scope
    if (user.linkedinPasswordEncrypted) {
      try {
        decryptedPassword = decrypt(user.linkedinPasswordEncrypted);
        console.log(`Successfully decrypted password for user ${user.id}`);
      } catch (decryptError) {
        console.error(
          `Failed to decrypt password for user ${user.id}:`,
          decryptError
        );
        // Decide how to handle decryption failure:
        // Option 1: Stop processing and return an error
        // return NextResponse.json({ error: "Internal server error: Failed to process credentials." }, { status: 500 });
        // Option 2: Log and continue without credentials (automation will likely fail)
        // Option 3: Update application status to 'error'
        // For now, log and continue, letting the automation task potentially fail if creds are required.
      }
    } else {
      console.log(`No encrypted password found for user ${user.id}`);
    }

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

  // Ensure application and user were created successfully before proceeding
  if (!newApplication || !user) {
    console.error(
      "Critical error: Application or User record not available after database operations."
    );
    // Return an internal server error as something went wrong
    return NextResponse.json(
      { error: "Internal server error during application creation." },
      { status: 500 }
    );
  }

  const applicationId = newApplication.id; // Use the actual ID from the created record

  // 5. Trigger asynchronous automation task (fire-and-forget for now)
  // Pass the original token and fetched credentials for potential use in the automation script
  triggerAutomationTask({
    applicationId,
    applyrightUserId, // Pass the validated user ID
    jobUrl,
    applyrightResumeId,
    applyrightCoverLetterId,
    authToken: authResult.token, // Pass the validated token
    // Pass the actual fetched username and decrypted password
    linkedinUsername: user.linkedinUsername ?? undefined, // Pass username or undefined if null
    linkedinPassword: decryptedPassword, // Pass decrypted password or undefined if missing/decryption failed
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
// Updated payload to include fetched credentials
async function triggerAutomationTask(payload: {
  applicationId: string;
  applyrightUserId: string;
  jobUrl: string;
  applyrightResumeId: string;
  applyrightCoverLetterId?: string;
  authToken?: string;
  linkedinUsername?: string; // Add credential fields
  linkedinPassword?: string;
}) {
  console.log(
    `Attempting to trigger automation task for application ${payload.applicationId}`
  );
  const browserlessApiKey = process.env.BROWSERLESS_API_KEY;
  let scriptContent: string;

  // --- Read the Browserless script file ---
  try {
    // Construct path relative to project root (trailsetter/)
    const scriptPath = path.resolve(
      process.cwd(),
      "src",
      "browserless-scripts",
      "linkedinLogin.ts"
    );
    console.log(`Reading Browserless script from: ${scriptPath}`);
    scriptContent = await fs.readFile(scriptPath, "utf8");
    console.log("Successfully read Browserless script file.");
  } catch (error) {
    console.error("Failed to read Browserless script file:", error);
    // Optionally update application status to 'error' here
    // await prisma.application.update({ where: { id: payload.applicationId }, data: { status: 'error', statusMessage: 'Failed to load automation script.' } });
    return; // Stop if script cannot be loaded
  }
  // --- End script reading ---

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
    // Use the dynamically loaded script content
    code: scriptContent,
    // Pass sensitive data (like tokens, credentials, secrets) in 'context'
    // Pass non-sensitive data needed directly by the script function in 'data'
    context: {
      authToken: payload.authToken,
      linkedinUsername: payload.linkedinUsername, // Pass username from payload
      linkedinPassword: payload.linkedinPassword, // Pass password from payload
      // Pass callback info from environment variables
      callbackUrl: process.env.AUTOMATION_CALLBACK_URL,
      callbackSecret: process.env.AUTOMATION_CALLBACK_SECRET,
    },
    // Pass data needed by the script's main function arguments
    // Browserless passes this to the 'data' parameter in `module.exports = async ({ page, data, context }) => { ... }`
    data: {
      applicationId: payload.applicationId,
      jobUrl: payload.jobUrl,
      applyrightResumeId: payload.applyrightResumeId,
      applyrightCoverLetterId: payload.applyrightCoverLetterId,
      applyrightUserId: payload.applyrightUserId,
    },
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
