import { NextResponse } from "next/server";
import sgMail from "@sendgrid/mail";

    // Set your SendGrid API key.
    // NOTE: Hardcoding your API key is not recommended for production.
    // In production, consider using environment variables or a secure secrets management system.
    sgMail.setApiKey("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");

export async function POST(request: Request) {
  try {
    const { email, username, password } = await request.json();

    if (!email || !username || !password) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }



    // Create the email message
    const msg = {
      to: email, // Recipient email
      from: "iara.system.1@gmail.com", // Verified sender email in SendGrid
      subject: "Your Account Credentials",
      text: `Hello,

Your account has been created.
Username: ${username}
Password: ${password}

Please change your password after logging in.
https://thesis1-d9ca1.web.app/`,
    };

    // Send the email using SendGrid
    await sgMail.send(msg);
    console.log("Email sent successfully");

    return NextResponse.json(
      { message: "Email sent successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Email sending error:", error);
    return NextResponse.json(
      {
        error: "Failed to send email",
        details: error instanceof Error ? error.message : error,
      },
      { status: 500 }
    );
  }
}
