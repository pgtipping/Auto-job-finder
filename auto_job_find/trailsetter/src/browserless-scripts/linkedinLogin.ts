import { Page, Locator } from "playwright"; // Import Locator type
// Removed unused fs and path imports
import { Buffer } from "buffer"; // Import Buffer for file handling
import { getApplyRightUserProfile, UserProfile } from "../lib/applyrightClient"; // Corrected import path

// Non-sensitive data passed via 'data'
interface ScriptData {
  applicationId: string;
  applyrightUserId: string;
  jobUrl: string;
  applyrightResumeId: string;
  applyrightCoverLetterId?: string;
}

// Sensitive data passed via 'context'
interface ScriptContext {
  authToken?: string; // User's JWT for ApplyRight API calls
  linkedinUsername?: string;
  linkedinPassword?: string;
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
  context, // Add context parameter
}: {
  page: Page;
  data: ScriptData;
  context: ScriptContext; // Use ScriptContext type
}): Promise<ScriptResult> => {
  const { applicationId, jobUrl, applyrightResumeId } = data; // Destructure non-sensitive data
  const {
    linkedinUsername,
    linkedinPassword,
    callbackUrl,
    callbackSecret,
    authToken, // Destructure sensitive data from context
  } = context;

  console.log(
    `[Browserless Script: ${applicationId}] Starting LinkedIn login script.`
  );
  // Log data safely, removing duplicate/incorrect password log
  console.log(`[Browserless Script: ${applicationId}] Received data:`, {
    ...data,
    // Log context safely
    linkedinPassword: linkedinPassword ? "[REDACTED]" : undefined,
    callbackSecret: callbackSecret ? "[REDACTED]" : undefined,
    authToken: authToken ? "[REDACTED]" : undefined,
  });

  // Use destructured variables from context
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
  // Use destructured variables from context
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
    try {
      // Common selectors: button[type='submit'], button:has-text('Sign in')
      await page.getByRole("button", { name: "Sign in" }).click();
    } catch (clickError) {
      const errorMsg =
        clickError instanceof Error ? clickError.message : String(clickError);
      console.error(
        `[Browserless Script: ${applicationId}] Error clicking Sign In button: ${errorMsg}`
      );
      await sendStatusUpdate(
        callbackUrl,
        applicationId,
        callbackSecret,
        "LOGIN_FAILED",
        "Error clicking Sign In button.",
        errorMsg
      );
      return {
        success: false,
        message: "Error clicking Sign In button.",
        error: errorMsg,
      };
    }

    // 4. Wait for successful login indicator OR potential challenge (CAPTCHA/MFA)
    console.log(
      `[Browserless Script: ${applicationId}] Waiting for navigation/login confirmation or challenge...`
    );
    let loginSuccess = false;
    try {
      // Wait for either the feed URL, the feed element, or a challenge indicator
      await Promise.race([
        page.waitForURL("**/feed/**", {
          waitUntil: "networkidle",
          timeout: 15000,
        }),
        page
          .locator('div[data-test-id="main-feed-activity-list"]')
          .waitFor({ state: "visible", timeout: 15000 }),
        // Add selectors for common challenge elements (CAPTCHA iframe, verification code input)
        page
          .locator('iframe[title*="captcha" i], #input__email_verification_pin')
          .first()
          .waitFor({ state: "visible", timeout: 5000 }), // Shorter timeout for challenges
      ]);

      // Check which condition was met
      const currentUrl = page.url();
      const feedElement = page.locator(
        'div[data-test-id="main-feed-activity-list"]'
      );
      const challengeElement = page.locator(
        'iframe[title*="captcha" i], #input__email_verification_pin'
      );

      if (
        currentUrl.includes("/feed/") ||
        (await feedElement.isVisible({ timeout: 500 }))
      ) {
        loginSuccess = true;
        console.log(
          `[Browserless Script: ${applicationId}] Login confirmed by URL or feed element.`
        );
      } else if (await challengeElement.isVisible({ timeout: 500 })) {
        const challengeType = (await challengeElement
          .first()
          .getAttribute("title"))
          ? "CAPTCHA"
          : "Verification Code";
        console.error(
          `[Browserless Script: ${applicationId}] Login challenge detected: ${challengeType}. Cannot proceed automatically.`
        );
        await sendStatusUpdate(
          callbackUrl,
          applicationId,
          callbackSecret,
          "LOGIN_CHALLENGE",
          `Login challenge detected: ${challengeType}. Manual intervention likely required.`,
          `Challenge element found: ${challengeType}`
        );
        return {
          success: false,
          message: `Login challenge detected: ${challengeType}.`,
          error: `Login challenge detected: ${challengeType}.`,
        };
      } else {
        // If Promise.race resolved but none of the expected conditions are met (unlikely but possible)
        console.warn(
          `[Browserless Script: ${applicationId}] Login confirmation unclear after wait. Checking for error messages...`
        );
        loginSuccess = false; // Assume failure if unclear
      }
    } catch (e) {
      // Catch errors from Promise.race (likely timeouts)
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.warn(
        `[Browserless Script: ${applicationId}] Timeout or error during login confirmation/challenge wait: ${errorMsg}. Checking for specific error messages...`
      );
      loginSuccess = false;
    }

    // If login confirmation is still uncertain, check for specific error messages
    if (!loginSuccess) {
      const errorElement = page.locator(
        "#error-for-password, #error-for-username"
      );
      try {
        if (await errorElement.isVisible({ timeout: 1000 })) {
          const errorMessage = await errorElement.textContent();
          console.error(
            `[Browserless Script: ${applicationId}] Login failed with error message: ${errorMessage}`
          );
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
        } else {
          console.error(
            `[Browserless Script: ${applicationId}] Login failed. Could not confirm success and no specific error message found.`
          );
        }
      } catch (err) {
        const checkErrorMsg = err instanceof Error ? err.message : String(err);
        console.error(
          `[Browserless Script: ${applicationId}] Error checking for login error message: ${checkErrorMsg}`
        );
      }
      // Ensure loginSuccess remains false if we reach here without explicit success
      loginSuccess = false;
    }

    // 5. Final check on loginSuccess before proceeding
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

      // --- Next Steps after Login ---
      // Wrap main application logic in a try-catch for better error reporting
      try {
        // Fetch ApplyRight User Profile *before* navigating to job
        let userProfile: UserProfile | null = null;
        if (authToken) {
          console.log(
            `[Browserless Script: ${applicationId}] Fetching ApplyRight user profile...`
          );
          await sendStatusUpdate(
            callbackUrl,
            applicationId,
            callbackSecret,
            "FETCHING_USER_PROFILE",
            "Attempting to fetch user profile from ApplyRight API."
          );
          try {
            userProfile = await getApplyRightUserProfile(authToken);
            console.log(
              `[Browserless Script: ${applicationId}] Successfully fetched user profile for email: ${userProfile.email}`
            );
            await sendStatusUpdate(
              callbackUrl,
              applicationId,
              callbackSecret,
              "FETCH_USER_PROFILE_SUCCESS",
              `Successfully fetched user profile (Email: ${userProfile.email}).`
            );
          } catch (profileError) {
            const errorMsg =
              profileError instanceof Error
                ? profileError.message
                : String(profileError);
            console.warn(
              `[Browserless Script: ${applicationId}] Failed to fetch ApplyRight user profile: ${errorMsg}. Proceeding without profile data.`
            );
            await sendStatusUpdate(
              callbackUrl,
              applicationId,
              callbackSecret,
              "FETCH_USER_PROFILE_FAILED",
              "Failed to fetch user profile from ApplyRight API.",
              errorMsg
            );
            // Continue without profile data, contact info filling will be skipped/fail later
          }
        } else {
          console.warn(
            `[Browserless Script: ${applicationId}] No authToken provided in context. Cannot fetch ApplyRight user profile.`
          );
          await sendStatusUpdate(
            callbackUrl,
            applicationId,
            callbackSecret,
            "FETCH_USER_PROFILE_SKIPPED",
            "Skipped fetching user profile: No auth token provided."
          );
        }

        // 1. Navigate to the Job URL
        console.log(
          `[Browserless Script: ${applicationId}] Navigating to job URL: ${jobUrl}`
        );
        await sendStatusUpdate(
          callbackUrl,
          applicationId,
          callbackSecret,
          "NAVIGATING_TO_JOB",
          `Navigating to job: ${jobUrl}`
        );
        try {
          await page.goto(jobUrl, { waitUntil: "networkidle", timeout: 20000 }); // Increased timeout
          console.log(
            `[Browserless Script: ${applicationId}] Successfully navigated to job page.`
          );
          await sendStatusUpdate(
            callbackUrl,
            applicationId,
            callbackSecret,
            "NAVIGATION_SUCCESSFUL",
            `Successfully navigated to job page: ${jobUrl}`
          );
        } catch (navError) {
          const errorMsg =
            navError instanceof Error ? navError.message : String(navError);
          console.error(
            `[Browserless Script: ${applicationId}] Failed to navigate to job URL ${jobUrl}: ${errorMsg}`
          );
          await sendStatusUpdate(
            callbackUrl,
            applicationId,
            callbackSecret,
            "NAVIGATION_FAILED",
            `Failed to navigate to job URL: ${jobUrl}`,
            errorMsg
          );
          return {
            success: false,
            message: "Failed to navigate to job URL.",
            error: errorMsg,
          };
        }

        // 2. Fetch User Profile & Resume (User profile fetch can be added later if needed)
        // NOTE: We are now fetching the resume file directly, not the optimized data.
        // The call to getApplyRightResume is removed.

        // 3. Detect Easy Apply Button
        console.log(
          `[Browserless Script: ${applicationId}] Checking for Easy Apply button...`
        );
        // Common selectors for Easy Apply button:
        // - button:has-text("Easy Apply")
        // - button.jobs-apply-button--top-card
        // - button[data-control-name="jobdetails_topcard_inapply"]
        // Using a combination for robustness
        const easyApplyButtonSelector =
          'button:has-text("Easy Apply"), button.jobs-apply-button--top-card';
        let isEasyApply = false;
        let easyApplyButton;

        try {
          easyApplyButton = page.locator(easyApplyButtonSelector);
          await easyApplyButton.waitFor({ state: "visible", timeout: 5000 }); // Wait 5 seconds
          isEasyApply = true;
          console.log(
            `[Browserless Script: ${applicationId}] Easy Apply button detected.`
          );
          await sendStatusUpdate(
            callbackUrl,
            applicationId,
            callbackSecret,
            "DETECTED_EASY_APPLY",
            "Easy Apply button detected on job page."
          );
        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : String(e);
          console.log(
            `[Browserless Script: ${applicationId}] Easy Apply button not found or timed out. Assuming standard apply. Error: ${errorMsg}`
          );
          await sendStatusUpdate(
            callbackUrl,
            applicationId,
            callbackSecret,
            "STANDARD_APPLY_DETECTED",
            "Easy Apply button not found. Standard apply process required."
          );
          // For now, we stop if it's not Easy Apply
          return {
            success: true, // Script finished its current scope
            message:
              "Standard Apply detected. Stopping script as only Easy Apply is currently supported.",
          };
        }

        // 4. Initiate Easy Apply (if detected)
        if (isEasyApply && easyApplyButton) {
          console.log(
            `[Browserless Script: ${applicationId}] Clicking Easy Apply button...`
          );
          await sendStatusUpdate(
            callbackUrl,
            applicationId,
            callbackSecret,
            "INITIATING_EASY_APPLY",
            "Clicking Easy Apply button."
          );
          try {
            await easyApplyButton.click();
            // Wait for the Easy Apply modal to appear
            // Common selectors: [aria-label="Apply to Job"], .jobs-easy-apply-modal
            const easyApplyModalSelector =
              '[aria-label*="Apply to"], .jobs-easy-apply-modal';
            await page
              .locator(easyApplyModalSelector)
              .waitFor({ state: "visible", timeout: 10000 });
            console.log(
              `[Browserless Script: ${applicationId}] Easy Apply modal opened.`
            );
            await sendStatusUpdate(
              callbackUrl,
              applicationId,
              callbackSecret,
              "EASY_APPLY_MODAL_OPENED",
              "Easy Apply modal opened successfully."
            );

            // --- Start Form Filling Logic ---
            await sendStatusUpdate(
              callbackUrl,
              applicationId,
              callbackSecret,
              "FILLING_FORM_STEP_1",
              "Attempting to fill initial form fields (email, phone)."
            );

            try {
              // Example: Fill Email (assuming it's pre-filled or needs confirmation)
              // Common selectors: input[id*="email"], input[name*="email"]
              const emailInputSelector =
                'input[id*="email"], input[name*="email"]';
              const emailInput = page.locator(emailInputSelector).first(); // Take the first match
              if (await emailInput.isVisible({ timeout: 5000 })) {
                const currentEmail = await emailInput.inputValue();
                console.log(
                  `[Browserless Script: ${applicationId}] Found email input with value: ${currentEmail}`
                );
                // Fill email if profile data is available
                const expectedEmail = userProfile?.email;
                if (expectedEmail) {
                  if (currentEmail !== expectedEmail) {
                    console.log(
                      `[Browserless Script: ${applicationId}] Updating email input from '${currentEmail}' to '${expectedEmail}'`
                    );
                    await emailInput.fill(expectedEmail, { timeout: 3000 });
                  } else {
                    console.log(
                      `[Browserless Script: ${applicationId}] Email input already matches profile email: ${currentEmail}`
                    );
                  }
                } else {
                  console.log(
                    `[Browserless Script: ${applicationId}] Skipping email fill: No profile data available.`
                  );
                }
              } else {
                console.log(
                  `[Browserless Script: ${applicationId}] Email input not immediately visible or found.`
                );
              }

              // Fill Phone Number (Placeholder - requires UserProfile update)
              // Common selectors: input[id*="phone"], input[name*="phone"], #text-input-phoneNumber
              const phoneInputSelector =
                'input[id*="phone"], input[name*="phone"], #text-input-phoneNumber';
              const phoneInput = page.locator(phoneInputSelector).first();
              if (await phoneInput.isVisible({ timeout: 5000 })) {
                // const expectedPhone = userProfile?.phone; // Assumes 'phone' field exists on UserProfile
                // if (expectedPhone) {
                //   await phoneInput.fill(expectedPhone, { timeout: 3000 });
                //   console.log(`[Browserless Script: ${applicationId}] Filled phone number input.`);
                // } else {
                //   console.log(`[Browserless Script: ${applicationId}] Skipping phone fill: No phone number in profile.`);
                // }
                console.log(
                  `[Browserless Script: ${applicationId}] Skipping phone fill: 'phone' field not in UserProfile interface.`
                );
              } else {
                console.log(
                  `[Browserless Script: ${applicationId}] Phone input not immediately visible or found.`
                );
              }

              // Click "Next" or "Continue" for the first step
              const nextButtonStep1Selector =
                'button:has-text("Next"), button:has-text("Continue"), button[aria-label*="Continue"]';
              console.log(
                `[Browserless Script: ${applicationId}] Clicking Next/Continue button for Step 1...`
              );
              try {
                await page.locator(nextButtonStep1Selector).first().click();
                // Add a small delay or wait for next section to load if necessary
                await page.waitForTimeout(2000); // Increased delay slightly
              } catch (clickError) {
                const errorMsg =
                  clickError instanceof Error
                    ? clickError.message
                    : String(clickError);
                console.error(
                  `[Browserless Script: ${applicationId}] Error clicking Next/Continue on Step 1: ${errorMsg}`
                );
                await sendStatusUpdate(
                  callbackUrl,
                  applicationId,
                  callbackSecret,
                  "FORM_FILLING_FAILED",
                  "Error clicking Next/Continue on Step 1.",
                  errorMsg
                );
                return {
                  success: false,
                  message: "Error clicking Next/Continue on Step 1.",
                  error: errorMsg,
                };
              }

              await sendStatusUpdate(
                callbackUrl,
                applicationId,
                callbackSecret,
                "FILLED_FORM_STEP_1", // Or a more specific status
                "Successfully filled initial fields (placeholders/skipped) and clicked Next."
              );

              // --- Resume Selection/Upload Step ---
              await sendStatusUpdate(
                callbackUrl,
                applicationId,
                callbackSecret,
                "HANDLING_RESUME_STEP", // More specific status
                "Attempting to handle resume upload step."
              );

              // --- Start: Resume Upload Implementation (Using Download Endpoint) ---
              try {
                // 1. Construct the download URL
                // Assuming the main app runs on localhost:3000 during development
                // TODO: Make base URL configurable for production
                const downloadUrl = `http://localhost:3000/api/apply-right/download/${applyrightResumeId}`;
                console.log(
                  `[Browserless Script: ${applicationId}] Fetching resume file from: ${downloadUrl}`
                );
                await sendStatusUpdate(
                  callbackUrl,
                  applicationId,
                  callbackSecret,
                  "DOWNLOADING_RESUME",
                  `Attempting to download resume from ${downloadUrl}`
                );

                if (!authToken) {
                  throw new Error("Missing authToken for resume download.");
                }

                // 2. Fetch the resume file content
                const resumeFetchResponse = await fetch(downloadUrl, {
                  method: "GET",
                  headers: {
                    Authorization: `Bearer ${authToken}`,
                  },
                });

                if (!resumeFetchResponse.ok) {
                  const errorBody = await resumeFetchResponse.text();
                  throw new Error(
                    `Failed to download resume file: ${resumeFetchResponse.status} ${resumeFetchResponse.statusText} - ${errorBody}`
                  );
                }

                // 3. Get the file content as ArrayBuffer and convert to Buffer
                const arrayBuffer = await resumeFetchResponse.arrayBuffer();
                const fileBuffer = Buffer.from(arrayBuffer);
                console.log(
                  `[Browserless Script: ${applicationId}] Successfully downloaded resume file (Size: ${fileBuffer.length} bytes).`
                );
                await sendStatusUpdate(
                  callbackUrl,
                  applicationId,
                  callbackSecret,
                  "DOWNLOAD_RESUME_SUCCESS",
                  `Successfully downloaded resume file (Size: ${fileBuffer.length} bytes).`
                );

                // 4. Locate the file input element
                const fileInputSelector =
                  'input[type="file"], [aria-label*="upload resume" i]';
                const fileInput = page.locator(fileInputSelector).first();
                await fileInput.waitFor({ state: "visible", timeout: 10000 });
                console.log(
                  `[Browserless Script: ${applicationId}] Found resume file input element.`
                );

                // 5. Upload the buffer using Playwright
                // Determine filename and mime type (assuming PDF for now)
                const uploadFileName = `resume_${applicationId}.pdf`; // Use a consistent name
                const uploadMimeType = "application/pdf"; // Adjust if DOCX/DOC
                console.log(
                  `[Browserless Script: ${applicationId}] Uploading resume file: ${uploadFileName} (${uploadMimeType})`
                );

                await fileInput.setInputFiles({
                  name: uploadFileName,
                  mimeType: uploadMimeType,
                  buffer: fileBuffer,
                });
                console.log(
                  `[Browserless Script: ${applicationId}] Resume file uploaded via input element.`
                );

                // Optional: Wait for confirmation
                await page.waitForTimeout(2000);

                await sendStatusUpdate(
                  callbackUrl,
                  applicationId,
                  callbackSecret,
                  "RESUME_UPLOAD_SUCCESS", // Keep this status for the upload part
                  "Successfully uploaded resume file to LinkedIn."
                );
              } catch (uploadError) {
                const errorMsg =
                  uploadError instanceof Error
                    ? uploadError.message
                    : String(uploadError);
                console.error(
                  `[Browserless Script: ${applicationId}] Error during resume download/upload step: ${errorMsg}`
                );
                // Use a more specific status if possible, otherwise keep RESUME_UPLOAD_FAILED
                await sendStatusUpdate(
                  callbackUrl,
                  applicationId,
                  callbackSecret,
                  "RESUME_UPLOAD_FAILED", // Or DOWNLOAD_RESUME_FAILED if error was during fetch
                  "Error during resume download or upload step.",
                  errorMsg
                );
                // Decide if this is fatal
                return {
                  success: false,
                  message: "Error during resume download/upload step.",
                  error: errorMsg,
                };
              }
              // --- End: Resume Upload Implementation (Using Download Endpoint) ---

              // Click "Next" or "Review" button for the resume step
              const nextButtonStep2Selector =
                'button:has-text("Next"), button:has-text("Review"), button[aria-label*="Review"]';
              console.log(
                `[Browserless Script: ${applicationId}] Clicking Next/Review button after resume step...`
              );
              try {
                await page.locator(nextButtonStep2Selector).first().click();
                await page.waitForTimeout(2000); // Increased delay
              } catch (clickError) {
                const errorMsg =
                  clickError instanceof Error
                    ? clickError.message
                    : String(clickError);
                console.error(
                  `[Browserless Script: ${applicationId}] Error clicking Next/Review after resume step: ${errorMsg}`
                );
                await sendStatusUpdate(
                  callbackUrl,
                  applicationId,
                  callbackSecret,
                  "FORM_FILLING_FAILED",
                  "Error clicking Next/Review after resume step.",
                  errorMsg
                );
                return {
                  success: false,
                  message: "Error clicking Next/Review after resume step.",
                  error: errorMsg,
                };
              }

              await sendStatusUpdate(
                callbackUrl,
                applicationId,
                callbackSecret,
                "HANDLED_RESUME_STEP", // Status indicating completion of this step
                "Successfully handled resume upload step and clicked Next/Review."
              );

              // --- Start: Additional Questions Handling ---
              await sendStatusUpdate(
                callbackUrl,
                applicationId,
                callbackSecret,
                "HANDLING_QUESTIONS_STEP", // More specific status
                "Attempting to handle additional questions step."
              );

              // --- Helper Function for Robust Question Handling ---
              // This structure helps isolate errors for individual questions.
              const handleQuestion = async (
                description: string,
                logic: () => Promise<void>
              ) => {
                try {
                  console.log(
                    `[Browserless Script: ${applicationId}] Attempting to answer: ${description}`
                  );
                  await logic();
                } catch (questionError) {
                  console.warn(
                    `[Browserless Script: ${applicationId}] Non-critical error handling question "${description}": ${
                      questionError instanceof Error
                        ? questionError.message
                        : String(questionError)
                    }`
                  );
                  // Log warning but continue to next question
                }
              };
              // --- End Helper Function ---

              // Example 1: Work Authorization (Radio Button - Yes/No)
              await handleQuestion("Work Authorization", async () => {
                // Refined: Use getByRole('group') or common parent, then filter radio buttons
                const questionGroup = page
                  .locator(
                    "fieldset, div.fb-form-element, div.form-builder-element"
                  ) // Common group elements
                  .filter({
                    has: page.locator("legend, label", {
                      hasText: /authorized to work/i,
                    }),
                  }) // Find group containing the label text
                  .first();

                if (await questionGroup.isVisible({ timeout: 3000 })) {
                  // Find 'Yes' radio button within the group by label or value
                  const yesRadio = questionGroup
                    .locator('input[type="radio"]')
                    .filter({
                      has: page.locator("label", { hasText: /^Yes$/i }),
                    }) // Prefer label association
                    .or(
                      questionGroup.locator(
                        'input[type="radio"][value*="Yes" i]'
                      )
                    ) // Fallback to value
                    .first();

                  if (await yesRadio.isVisible({ timeout: 1000 })) {
                    await yesRadio.check({ force: true, timeout: 2000 });
                    console.log(
                      `[Browserless Script: ${applicationId}] Answered work authorization question (Selected 'Yes').`
                    );
                  } else {
                    console.log(
                      `[Browserless Script: ${applicationId}] Could not find 'Yes' radio button for work authorization within its group.`
                    );
                  }
                } else {
                  console.log(
                    `[Browserless Script: ${applicationId}] Work authorization question group not found.`
                  );
                }
              });

              // Example 2: Sponsorship Required (Radio Button - Yes/No)
              await handleQuestion("Sponsorship Required", async () => {
                // Refined: Similar approach to work authorization
                const questionGroup = page
                  .locator(
                    "fieldset, div.fb-form-element, div.form-builder-element"
                  )
                  .filter({
                    has: page.locator("legend, label", {
                      hasText: /sponsorship/i,
                    }),
                  })
                  .first();

                if (await questionGroup.isVisible({ timeout: 3000 })) {
                  // Find 'No' radio button within the group
                  const noRadio = questionGroup
                    .locator('input[type="radio"]')
                    .filter({
                      has: page.locator("label", { hasText: /^No$/i }),
                    })
                    .or(
                      questionGroup.locator(
                        'input[type="radio"][value*="No" i]'
                      )
                    )
                    .first();

                  if (await noRadio.isVisible({ timeout: 1000 })) {
                    await noRadio.check({ force: true, timeout: 2000 });
                    console.log(
                      `[Browserless Script: ${applicationId}] Answered sponsorship question (Selected 'No').`
                    );
                  } else {
                    console.log(
                      `[Browserless Script: ${applicationId}] Could not find 'No' radio button for sponsorship within its group.`
                    );
                  }
                } else {
                  console.log(
                    `[Browserless Script: ${applicationId}] Sponsorship question group not found.`
                  );
                }
              });

              // Example 3: Years of Experience (Text Input)
              await handleQuestion("Years of Experience", async () => {
                // Refined: Prioritize getByLabel if label text is stable enough, fallback to group search
                let experienceInput: Locator | undefined;
                try {
                  // Try getByLabel first (adjust text slightly if needed)
                  experienceInput = page.getByLabel(/experience|years/i, {
                    exact: false,
                  });
                  if (!(await experienceInput.isVisible({ timeout: 1500 }))) {
                    // Slightly longer timeout for getByLabel
                    experienceInput = undefined; // Reset if not found quickly
                  }
                } catch {
                  experienceInput = undefined;
                } // Catch potential errors if label not found

                // Fallback: Find group containing label, then find input within group
                if (!experienceInput) {
                  console.log(
                    `[Browserless Script: ${applicationId}] getByLabel for experience failed, trying group search...`
                  );
                  const questionGroup = page
                    .locator("div.fb-form-element, div.form-builder-element") // Common group elements
                    .filter({
                      has: page.locator("label", {
                        hasText: /experience|years/i,
                      }),
                    })
                    .first();

                  if (await questionGroup.isVisible({ timeout: 2000 })) {
                    experienceInput = questionGroup
                      .locator('input[type="text"], input[type="number"]')
                      .first();
                  }
                }

                if (
                  experienceInput &&
                  (await experienceInput.isVisible({ timeout: 1000 }))
                ) {
                  const defaultValue = "5"; // Default to 5 years for now
                  await experienceInput.fill(defaultValue, { timeout: 2000 });
                  console.log(
                    `[Browserless Script: ${applicationId}] Filled years of experience question (Value: ${defaultValue}).`
                  );
                } else {
                  console.log(
                    `[Browserless Script: ${applicationId}] Could not find input field for experience question using getByLabel or group search.`
                  );
                }
              });

              // Example 4: Salary Expectation (Text Input - often optional)
              await handleQuestion("Salary Expectation", async () => {
                // Refined: Similar approach to experience
                let salaryInput: Locator | undefined;
                try {
                  salaryInput = page.getByLabel(/salary/i, { exact: false });
                  if (!(await salaryInput.isVisible({ timeout: 1500 }))) {
                    salaryInput = undefined;
                  }
                } catch {
                  salaryInput = undefined;
                }

                if (!salaryInput) {
                  console.log(
                    `[Browserless Script: ${applicationId}] getByLabel for salary failed, trying group search...`
                  );
                  const questionGroup = page
                    .locator("div.fb-form-element, div.form-builder-element")
                    .filter({
                      has: page.locator("label", { hasText: /salary/i }),
                    })
                    .first();

                  if (await questionGroup.isVisible({ timeout: 2000 })) {
                    salaryInput = questionGroup
                      .locator('input[type="text"], input[type="number"]')
                      .first();
                  }
                }

                if (
                  salaryInput &&
                  (await salaryInput.isVisible({ timeout: 1000 }))
                ) {
                  const isRequired =
                    (await salaryInput.getAttribute("required")) !== null ||
                    (await salaryInput.getAttribute("aria-required")) ===
                      "true";
                  if (isRequired) {
                    const defaultValue = "0"; // Or get from config/profile
                    await salaryInput.fill(defaultValue, { timeout: 2000 });
                    console.log(
                      `[Browserless Script: ${applicationId}] Filled required salary expectation (Value: ${defaultValue}).`
                    );
                  } else {
                    console.log(
                      `[Browserless Script: ${applicationId}] Skipping optional salary expectation question.`
                    );
                  }
                } else {
                  console.log(
                    `[Browserless Script: ${applicationId}] Could not find input field for salary question using getByLabel or group search.`
                  );
                }
              });

              // Example 5: How did you hear about us? (Dropdown/Select)
              await handleQuestion("Referral Source Dropdown", async () => {
                // Refined: Similar approach, prioritize getByLabel
                let selectElement: Locator | undefined;
                try {
                  selectElement = page.getByLabel(
                    /hear about us|referral source/i,
                    { exact: false }
                  );
                  if (!(await selectElement.isVisible({ timeout: 1500 }))) {
                    selectElement = undefined;
                  }
                } catch {
                  selectElement = undefined;
                }

                if (!selectElement) {
                  console.log(
                    `[Browserless Script: ${applicationId}] getByLabel for referral source failed, trying group search...`
                  );
                  const questionGroup = page
                    .locator("div.fb-form-element, div.form-builder-element")
                    .filter({
                      has: page.locator("label", {
                        hasText: /hear about us|referral source/i,
                      }),
                    })
                    .first();

                  if (await questionGroup.isVisible({ timeout: 2000 })) {
                    selectElement = questionGroup.locator("select").first();
                  }
                }

                if (
                  selectElement &&
                  (await selectElement.isVisible({ timeout: 1000 }))
                ) {
                  const defaultValue = "LinkedIn"; // Example default value/label
                  try {
                    // Try selecting by visible label text first
                    await selectElement.selectOption(
                      { label: defaultValue },
                      { timeout: 2000 }
                    );
                    console.log(
                      `[Browserless Script: ${applicationId}] Selected dropdown option for referral source (Label: ${defaultValue}).`
                    );
                  } catch {
                    console.warn(
                      `[Browserless Script: ${applicationId}] Failed to select dropdown by label '${defaultValue}', trying by value...`
                    );
                    try {
                      // Fallback: Try selecting by value attribute
                      await selectElement.selectOption(
                        { value: defaultValue },
                        { timeout: 2000 }
                      );
                      console.log(
                        `[Browserless Script: ${applicationId}] Selected dropdown option for referral source (Value: ${defaultValue}).`
                      );
                    } catch {
                      console.warn(
                        `[Browserless Script: ${applicationId}] Failed to select dropdown by value '${defaultValue}', trying common fallback 'OTHER'.`
                      );
                      try {
                        // Fallback 2: Try a common default value like 'OTHER' or one likely to exist
                        await selectElement.selectOption(
                          { value: "OTHER" },
                          { timeout: 2000 }
                        );
                        console.log(
                          `[Browserless Script: ${applicationId}] Selected dropdown option for referral source (Fallback Value: OTHER).`
                        );
                      } catch (e3) {
                        console.error(
                          `[Browserless Script: ${applicationId}] Failed to select any option for referral source dropdown: ${
                            e3 instanceof Error ? e3.message : String(e3)
                          }`
                        );
                      }
                    }
                  }
                } else {
                  console.log(
                    `[Browserless Script: ${applicationId}] Could not find select element for referral source question using getByLabel or group search.`
                  );
                }
              });

              // --- End: Additional Questions Handling ---

              // Define the selector for the button *after* the questions step
              const reviewButtonSelector =
                'button:has-text("Review"), button:has-text("Next"), button[aria-label*="Review"]';

              // Click "Review" or "Next" after handling questions
              console.log(
                `[Browserless Script: ${applicationId}] Clicking Review/Next button after questions step...`
              );
              try {
                await page.locator(reviewButtonSelector).first().click();
                await page.waitForTimeout(2000); // Increased delay
              } catch (clickError) {
                const errorMsg =
                  clickError instanceof Error
                    ? clickError.message
                    : String(clickError);
                console.error(
                  `[Browserless Script: ${applicationId}] Error clicking Review/Next after questions step: ${errorMsg}`
                );
                await sendStatusUpdate(
                  callbackUrl,
                  applicationId,
                  callbackSecret,
                  "FORM_FILLING_FAILED",
                  "Error clicking Review/Next after questions step.",
                  errorMsg
                );
                return {
                  success: false,
                  message: "Error clicking Review/Next after questions step.",
                  error: errorMsg,
                };
              }

              await sendStatusUpdate(
                callbackUrl,
                applicationId,
                callbackSecret,
                "HANDLED_QUESTIONS_STEP", // Status indicating completion of this step
                "Successfully handled additional questions step (placeholders) and clicked Review/Next."
              );

              // --- Review and Submit Step ---
              await sendStatusUpdate(
                callbackUrl,
                applicationId,
                callbackSecret,
                "REVIEWING_APPLICATION",
                "Navigated to review step."
              );

              // TODO: Add logic to potentially review fields on this page if needed.

              // Click the final "Submit application" button
              await sendStatusUpdate(
                callbackUrl,
                applicationId,
                callbackSecret,
                "SUBMITTING_APPLICATION",
                "Attempting to click final submit button."
              );
              const submitButtonSelector =
                'button:has-text("Submit application"), button[aria-label*="Submit application"]';
              console.log(
                `[Browserless Script: ${applicationId}] Clicking final Submit button...`
              );
              try {
                await page.locator(submitButtonSelector).first().click();
              } catch (clickError) {
                const errorMsg =
                  clickError instanceof Error
                    ? clickError.message
                    : String(clickError);
                console.error(
                  `[Browserless Script: ${applicationId}] Error clicking final Submit button: ${errorMsg}`
                );
                await sendStatusUpdate(
                  callbackUrl,
                  applicationId,
                  callbackSecret,
                  "SUBMISSION_FAILED", // Use submission failed status here
                  "Error clicking final Submit button.",
                  errorMsg
                );
                return {
                  success: false,
                  message: "Error clicking final Submit button.",
                  error: errorMsg,
                };
              }

              // --- Outcome Detection ---
              console.log(
                `[Browserless Script: ${applicationId}] Waiting for submission confirmation...`
              );
              // Refined Selectors for confirmation: Look for specific success messages or modal closing.
              // Added role=alertdialog for potential error modals
              const successMessageSelector =
                'h2:text-matches(/Application submitted|Your application was sent/i), [aria-label*="Application sent"], p:text-matches(/submitted successfully/i), #post-apply-modal'; // Added common post-apply modal ID
              const modalSelector =
                '[aria-label*="Apply to"], .jobs-easy-apply-modal'; // Selector for the main apply modal itself
              const errorIndicatorSelector =
                '.artdeco-inline-feedback[type="error"], [aria-live="assertive"]:text-matches(/error|failed|unable/i), [role="alertdialog"]'; // Added role=alertdialog

              let submissionConfirmed = false; // Flag to track if success was confirmed

              try {
                console.log(
                  `[Browserless Script: ${applicationId}] Starting Promise.race for confirmation...`
                );
                // Wait for one of the conditions: success message appears, modal disappears, or error appears
                await Promise.race([
                  page
                    .locator(successMessageSelector)
                    .first()
                    .waitFor({ state: "visible", timeout: 20000 }),
                  page
                    .locator(modalSelector)
                    .waitFor({ state: "hidden", timeout: 20000 }),
                  page
                    .locator(errorIndicatorSelector)
                    .first()
                    .waitFor({ state: "visible", timeout: 5000 }), // Shorter timeout for errors
                ]);
                console.log(
                  `[Browserless Script: ${applicationId}] Promise.race completed. Checking results...`
                );

                // Now check which condition was met
                const successElement = page
                  .locator(successMessageSelector)
                  .first();
                const errorElement = page
                  .locator(errorIndicatorSelector)
                  .first();
                // Check modal visibility *after* the race, as it might have closed
                const modalStillVisible = await page
                  .locator(modalSelector)
                  .isVisible({ timeout: 500 });

                if (await successElement.isVisible({ timeout: 500 })) {
                  const successText =
                    (await successElement.textContent({ timeout: 500 })) ||
                    "Success message found";
                  console.log(
                    `[Browserless Script: ${applicationId}] Application submission confirmed by message: ${successText}`
                  );
                  await sendStatusUpdate(
                    callbackUrl,
                    applicationId,
                    callbackSecret,
                    "SUBMISSION_SUCCESS",
                    `Application submitted successfully (confirmed by message: ${successText})`
                  );
                  submissionConfirmed = true;
                } else if (!modalStillVisible) {
                  console.log(
                    `[Browserless Script: ${applicationId}] Application submission confirmed (modal closed).`
                  );
                  await sendStatusUpdate(
                    callbackUrl,
                    applicationId,
                    callbackSecret,
                    "SUBMISSION_SUCCESS",
                    "Application submitted successfully (confirmed by modal close)."
                  );
                  submissionConfirmed = true;
                } else if (await errorElement.isVisible({ timeout: 500 })) {
                  const errorText =
                    (await errorElement.textContent({ timeout: 500 })) ||
                    "Unknown submission error";
                  console.error(
                    `[Browserless Script: ${applicationId}] Application submission failed with error: ${errorText}`
                  );
                  await sendStatusUpdate(
                    callbackUrl,
                    applicationId,
                    callbackSecret,
                    "SUBMISSION_FAILED",
                    "Application submission failed (error indicator found).",
                    errorText
                  );
                  // Return failure from the script if submission explicitly failed
                  return {
                    success: false,
                    message: "Application submission failed.",
                    error: errorText,
                  };
                } else {
                  // Timeout occurred without explicit success, failure, or modal close
                  console.warn(
                    `[Browserless Script: ${applicationId}] Submission confirmation timed out without clear success/failure indicator.`
                  );
                  await sendStatusUpdate(
                    callbackUrl,
                    applicationId,
                    callbackSecret,
                    "SUBMISSION_UNCONFIRMED",
                    "Submission confirmation timed out.",
                    "Timeout waiting for success message, modal close, or error indicator."
                  );
                  // Check if modal is still visible after timeout - indicates a hang or unexpected state
                  if (modalStillVisible) {
                    console.warn(
                      `[Browserless Script: ${applicationId}] Modal still visible after confirmation timeout. Potential hang.`
                    );
                    await sendStatusUpdate(
                      callbackUrl,
                      applicationId,
                      callbackSecret,
                      "SUBMISSION_UNCONFIRMED",
                      "Submission confirmation timed out, modal still visible.",
                      "Modal remained visible after timeout."
                    );
                  }
                  // Consider this potentially successful but unconfirmed, don't return failure immediately
                  submissionConfirmed = false; // Explicitly false
                }
              } catch (confirmationError) {
                // Catch errors from the Promise.race or subsequent checks (e.g., element detached)
                const errorMsg =
                  confirmationError instanceof Error
                    ? confirmationError.message
                    : String(confirmationError);
                console.warn(
                  `[Browserless Script: ${applicationId}] Error or timeout during submission confirmation: ${errorMsg}.`
                );
                // Send an uncertain status, potentially failed
                await sendStatusUpdate(
                  callbackUrl,
                  applicationId,
                  callbackSecret,
                  "SUBMISSION_FAILED",
                  "Error or timeout during submission confirmation check.",
                  errorMsg
                );
                // Assume failure if confirmation check errors out or times out without success
                submissionConfirmed = false;
              }

              // Add a small delay after potential confirmation before returning
              if (submissionConfirmed) {
                console.log(
                  `[Browserless Script: ${applicationId}] Adding short delay after confirmed submission...`
                );
                await page.waitForTimeout(1500); // Wait 1.5 seconds
              }

              // --- End Outcome Detection ---
            } catch (fillError) {
              // This catch block now covers all form filling steps (including resume upload)
              const errorMsg =
                fillError instanceof Error
                  ? fillError.message
                  : String(fillError);
              console.error(
                `[Browserless Script: ${applicationId}] Error during form filling/submission process: ${errorMsg}`
              );
              await sendStatusUpdate(
                callbackUrl,
                applicationId,
                callbackSecret,
                "FORM_FILLING_FAILED", // Generic failure status for this block
                "Error during form filling or submission.",
                errorMsg
              );
              // Decide if this is fatal
              return {
                success: false,
                message: "Error during form filling or submission.",
                error: errorMsg,
              };
            }
            // --- End Form Filling Logic ---
          } catch (clickError) {
            const errorMsg =
              clickError instanceof Error
                ? clickError.message
                : String(clickError);
            console.error(
              `[Browserless Script: ${applicationId}] Error clicking Easy Apply button or waiting for modal: ${errorMsg}`
            );
            await sendStatusUpdate(
              callbackUrl,
              applicationId,
              callbackSecret,
              "EASY_APPLY_FAILED",
              "Error initiating Easy Apply process.",
              errorMsg
            );
            return {
              success: false,
              message: "Error initiating Easy Apply process.",
              error: errorMsg,
            };
          }
        }

        // TODO: Implement robust outcome detection after submission

        console.log(
          `[Browserless Script: ${applicationId}] Reached end of Easy Apply script logic.`
        );
        // Return success after placeholder submission (moved inside try)
        return {
          success: true,
          message: "Easy Apply script completed successfully.", // Updated message
        };
      } catch (applicationError: unknown) {
        // Catch errors specifically during the application process after login
        const errorMsg =
          applicationError instanceof Error
            ? applicationError.message
            : String(applicationError);
        console.error(
          `[Browserless Script: ${applicationId}] Error during application process after login: ${errorMsg}`
        );
        await sendStatusUpdate(
          callbackUrl,
          applicationId,
          callbackSecret,
          "APPLICATION_PROCESS_FAILED", // New status for errors after login
          "Error during application process after login.",
          errorMsg
        );
        return {
          success: false,
          message: "Error during application process after login.",
          error: errorMsg,
        };
      }
      // --- End Application Logic Try-Catch ---
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
