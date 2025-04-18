import { Page } from "playwright";

interface ScriptData {
  applicationId: string;
  applyrightUserId: string;
  jobUrl: string;
  applyrightResumeId: string;
  applyrightCoverLetterId?: string;
  // --- Credentials ---
  // IMPORTANT: Passing credentials directly like this is insecure for production.
  // Consider using Browserless secure context variables or environment variables.
  linkedinUsername?: string;
  linkedinPassword?: string;
  // --- Callback Info ---
  callbackUrl: string; // e.g., https://your-app.com/api/v1/applications/{appId}/status
  callbackSecret: string; // Shared secret for callback authentication
}

interface ScriptResult {
  success: boolean;
  message: string;
  error?: string;
  // Add any other relevant output data
}

// Helper function to send status updates back to the main API
async function sendStatusUpdate(
  callbackUrl: string,
  applicationId: string,
  secret: string,
  status: string,
  message?: string,
  error?: string
) {
  // Replace {appId} placeholder in the callback URL
  const url = callbackUrl.replace("{appId}", applicationId);
  console.log(
    `[Browserless Script: ${applicationId}] Sending status update '${status}' to ${url}`
  );
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Automation-Secret": secret, // Use the provided secret from script data
      },
      // Conditionally include message and error in the payload
      body: JSON.stringify({
        status,
        ...(message && { message }),
        ...(error && { error }),
      }),
    });
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        `[Browserless Script: ${applicationId}] Failed to send status update. API responded with ${response.status}: ${errorBody}`
      );
    } else {
      console.log(
        `[Browserless Script: ${applicationId}] Status update sent successfully.`
      );
    }
  } catch (fetchError: unknown) {
    const errorMsg =
      fetchError instanceof Error ? fetchError.message : String(fetchError);
    console.error(
      `[Browserless Script: ${applicationId}] Network error sending status update: ${errorMsg}`
    );
  }
}

// Main function executed by Browserless
module.exports = async ({
  page,
  data,
}: {
  page: Page;
  data: ScriptData;
}): Promise<ScriptResult> => {
  console.log(
    `[Browserless Script: ${data.applicationId}] Starting LinkedIn login script.`
  );
  console.log(`[Browserless Script: ${data.applicationId}] Received data:`, {
    ...data,
    linkedinPassword: data.linkedinPassword ? "[REDACTED]" : undefined, // Avoid logging password
    callbackSecret: data.callbackSecret ? "[REDACTED]" : undefined,
  });

  const {
    linkedinUsername,
    linkedinPassword,
    callbackUrl,
    callbackSecret,
    applicationId,
  } = data;

  if (!linkedinUsername || !linkedinPassword) {
    console.error(
      `[Browserless Script: ${applicationId}] Missing LinkedIn credentials.`
    );
    return {
      success: false,
      message: "Missing LinkedIn credentials.",
      error: "Credentials not provided.",
    };
  }
  if (!callbackUrl || !callbackSecret) {
    console.error(
      `[Browserless Script: ${applicationId}] Missing callback URL or secret.`
    );
    return {
      success: false,
      message: "Missing callback configuration.",
      error: "Callback info not provided.",
    };
  }

  try {
    console.log(
      `[Browserless Script: ${applicationId}] Navigating to LinkedIn login page...`
    );
    await page.goto("https://www.linkedin.com/login", {
      waitUntil: "networkidle",
    });
    console.log(`[Browserless Script: ${applicationId}] Login page loaded.`);

    // TODO: Implement login steps using Playwright selectors
    // 1. Fill username
    // 2. Fill password
    // 1. Fill username
    console.log(`[Browserless Script: ${applicationId}] Filling username...`);
    // Common selectors: #username, #session_key
    // Using getByLabel for resilience
    await page.getByLabel("Email or phone number").fill(linkedinUsername);

    // 2. Fill password
    console.log(`[Browserless Script: ${applicationId}] Filling password...`);
    // Common selectors: #password, #session_password
    await page.getByLabel("Password").fill(linkedinPassword);

    // 3. Click submit
    console.log(
      `[Browserless Script: ${applicationId}] Clicking sign in button...`
    );
    // Common selectors: button[type='submit'], button:has-text('Sign in')
    await page.getByRole("button", { name: "Sign in" }).click();

    // 4. Wait for successful login indicator
    console.log(
      `[Browserless Script: ${applicationId}] Waiting for navigation/login confirmation...`
    );
    // Example: Wait for the main feed container or the profile picture element
    // Common selectors: #feed-outlet, .feed-identity-module, [data-control-name="identity_profile_photo"]
    // Using a generic navigation wait combined with a selector wait for robustness
    await page
      .waitForNavigation({ waitUntil: "networkidle", timeout: 15000 })
      .catch(
        (
          e // Use the error variable
        ) => {
          const errorMsg = e instanceof Error ? e.message : String(e);
          console.log(
            `[Browserless Script: ${applicationId}] Navigation timed out or failed after login click, continuing check. Error: ${errorMsg}` // Log the error message
          );
        }
      );
    // Check for a common element on the feed page
    const feedElement = page.locator(
      'div[data-test-id="main-feed-activity-list"]'
    ); // Example selector, might need adjustment
    let loginSuccess = false;
    try {
      await feedElement.waitFor({ state: "visible", timeout: 10000 }); // Wait up to 10 seconds
      loginSuccess = true;
      console.log(
        `[Browserless Script: ${applicationId}] Login confirmed by feed element visibility.`
      );
    } catch (e) {
      // Use the error variable
      const errorMsg = e instanceof Error ? e.message : String(e); // Add type check
      console.warn(
        `[Browserless Script: ${applicationId}] Login confirmation element not found. Checking for error messages... Error: ${errorMsg}` // Use checked message
      );
      // Optional: Check for common error messages like "That's not the right password."
      const errorElement = page.locator(
        "#error-for-password, #error-for-username"
      ); // Example error selectors
      try {
        const errorVisible = await errorElement.isVisible({ timeout: 1000 });
        if (errorVisible) {
          const errorMessage = await errorElement.textContent();
          console.error(
            `[Browserless Script: ${applicationId}] Login failed with error message: ${errorMessage}`
          );
          // Call status update on specific login error
          await sendStatusUpdate(
            callbackUrl,
            applicationId,
            callbackSecret,
            "LOGIN_FAILED",
            "Login failed due to error message.",
            errorMessage || "Invalid credentials or other login error"
          );
          return {
            success: false,
            message: "LinkedIn login failed.",
            error: errorMessage || "Invalid credentials or other login error",
          };
        }
      } catch (err) {
        // Use the error variable
        // Error element not found, might be a different issue (e.g., captcha)
        const checkErrorMsg = err instanceof Error ? err.message : String(err);
        console.error(
          `[Browserless Script: ${applicationId}] Could not find confirmation element or known error message. Error checking for error element: ${checkErrorMsg}` // Log the error message
        );
      }
      loginSuccess = false; // Explicitly set to false if confirmation fails
    }

    // 5. Handle potential errors (partially handled above)
    // TODO: Add more robust error handling (e.g., captchas, unexpected pages)

    if (loginSuccess) {
      console.log(
        `[Browserless Script: ${applicationId}] LinkedIn login successful.`
      );
      // Send status update on successful login
      await sendStatusUpdate(
        callbackUrl,
        applicationId,
        callbackSecret,
        "LOGIN_SUCCESSFUL",
        "LinkedIn login successful."
      );
      // TODO: Proceed with next steps (navigate to job, apply, etc.)
      return {
        success: true,
        message: "LinkedIn login successful.",
      };
    } else {
      // If loginSuccess is false after checks
      console.error(
        `[Browserless Script: ${applicationId}] LinkedIn login failed.`
      );
      // Call status update on general login failure (confirmation element not found)
      await sendStatusUpdate(
        callbackUrl,
        applicationId,
        callbackSecret,
        "LOGIN_FAILED",
        "Could not confirm successful login."
      );
      return {
        success: false,
        message: "LinkedIn login failed.",
        error: "Could not confirm successful login or encountered an error.",
      };
    }
  } catch (error: unknown) {
    console.error(
      `[Browserless Script: ${applicationId}] Critical error during LinkedIn login process:`,
      error
    );
    const errorMessage = error instanceof Error ? error.message : String(error);
    // Call status update on critical script error
    await sendStatusUpdate(
      callbackUrl,
      applicationId,
      callbackSecret,
      "SCRIPT_ERROR",
      "Critical error during login process.",
      errorMessage
    );
    return {
      success: false,
      message: "Error during LinkedIn login.",
      error: errorMessage,
    };
  }
};
