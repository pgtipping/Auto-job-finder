import { NextRequest, NextResponse } from "next/server";
import { env } from "process";
import * as jose from "jose";
import * as fs from "fs/promises"; // Use promises API for async file reading
import * as path from "path";

const APPLYRIGHT_SHARED_AUTH_SECRET = env.APPLYRIGHT_SHARED_AUTH_SECRET;

// Helper function for JWT validation (similar to the one in applications route)
async function validateJwt(token: string): Promise<jose.JWTPayload | null> {
  if (!APPLYRIGHT_SHARED_AUTH_SECRET) {
    console.error("Missing APPLYRIGHT_SHARED_AUTH_SECRET for JWT validation.");
    return null;
  }
  if (!token) {
    return null;
  }

  try {
    const secret = new TextEncoder().encode(APPLYRIGHT_SHARED_AUTH_SECRET);
    const { payload } = await jose.jwtVerify(token, secret);
    // Optional: Add audience/issuer checks if needed
    // console.log("JWT Payload:", payload); // Log for debugging if necessary
    return payload;
  } catch (error) {
    console.error("JWT validation failed:", error);
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { resumeId: string } }
) {
  const resumeId = params.resumeId;
  const authorizationHeader = request.headers.get("authorization");
  const token = authorizationHeader?.split("Bearer ")[1];

  if (!token) {
    return NextResponse.json(
      { success: false, message: "Authorization token missing" },
      { status: 401 }
    );
  }

  const jwtPayload = await validateJwt(token);
  if (!jwtPayload) {
    return NextResponse.json(
      { success: false, message: "Invalid or expired token" },
      { status: 401 }
    );
  }

  // --- File Retrieval Logic ---
  // **ASSUMPTION:** Resumes are stored as PDFs in trailsetter/storage/resumes/
  // Please verify this path and format.
  const storagePath = path.resolve(process.cwd(), "storage", "resumes"); // process.cwd() should point to trailsetter/
  const filePath = path.join(storagePath, `${resumeId}.pdf`);
  const fileName = `resume_${resumeId}.pdf`; // Suggested download filename

  console.log(`Attempting to read resume file: ${filePath}`);

  try {
    const fileBuffer = await fs.readFile(filePath);

    // Set headers for file download
    const headers = new Headers();
    headers.set("Content-Type", "application/pdf"); // Adjust if DOCX/DOC
    headers.set("Content-Disposition", `attachment; filename="${fileName}"`);

    return new NextResponse(fileBuffer, { status: 200, headers });
  } catch (error: unknown) {
    // Use unknown type for error
    // Type check for file not found error
    if (
      error instanceof Error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      console.error(`Resume file not found: ${filePath}`);
      return NextResponse.json(
        { success: false, message: "Resume file not found" },
        { status: 404 }
      );
    } else {
      console.error(`Error reading resume file ${filePath}:`, error);
      return NextResponse.json(
        { success: false, message: "Error retrieving resume file" },
        { status: 500 }
      );
    }
  }
}
