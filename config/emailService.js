import { BrevoClient } from "@getbrevo/brevo";
import dotenv from "dotenv";

dotenv.config();

const brevo = new BrevoClient({
  apiKey: process.env.BREVO_API_KEY,
  timeoutInSeconds: 30,
  maxRetries: 3,
});

const sendEmail = async ({ to, subject, html }) => {
  try {
    if (!process.env.BREVO_API_KEY) {
      throw new Error("BREVO_API_KEY is missing from environment variables.");
    }

    if (
      !process.env.BREVO_EMAIL_NAME ||
      !process.env.BREVO_EMAIL_SENDER
    ) {
      throw new Error(
        "BREVO_EMAIL_NAME or BREVO_EMAIL_SENDER is missing."
      );
    }

    const result =
      await brevo.transactionalEmails.sendTransacEmail({
        subject,
        htmlContent: html,
        sender: {
          name: process.env.BREVO_EMAIL_NAME,
          email: process.env.BREVO_EMAIL_SENDER,
        },
        to: [{ email: to }],
      });

    console.log("Email sent successfully. Message ID:", result.messageId);

    return result;
  } catch (error) {
    console.error("BREVO EMAIL ERROR:", {
      message: error.message,
      statusCode: error.statusCode,
      body: error.body,
      response: error.response?.body,
      stack: error.stack,
    });

    throw error;
  }
};

export default sendEmail;