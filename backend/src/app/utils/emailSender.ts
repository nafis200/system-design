import nodemailer, { type Transporter } from "nodemailer";

import config from "../config";
import { isMailConfigured, isProduction } from "../config/env";
import { logger } from "./logger";

/**
 * Outbound mail.
 *
 * Three things this fixes:
 *
 * 1. A transporter was created per message. Nodemailer transports hold a
 *    connection pool, so building one per send opened a fresh SMTP handshake
 *    every time — fine for one signup, expensive at scale.
 * 2. The `from` address was a hardcoded personal Gmail account. It now comes
 *    from config.
 * 3. `sendMail` rejecting propagated all the way out of the request. With SMTP
 *    unconfigured, requesting a password reset for a *known* address returned
 *    500 while an unknown address returned 200 — reintroducing account
 *    enumeration through the status code. Callers that must not leak now use
 *    `sendEmailSafely`, which never throws.
 */

let transporter: Transporter | undefined;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: config.emailSender.email,
        pass: config.emailSender.app_pass,
      },
      // Reuse connections across sends rather than reconnecting per message.
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      // Certificate validation stays on in production; the previous
      // rejectUnauthorized:false applied everywhere and silently accepted any
      // certificate, which defeats TLS.
      ...(isProduction ? {} : { tls: { rejectUnauthorized: false } }),
    });
  }

  return transporter;
}

/** Sends mail, throwing on failure. Use where the caller must know it failed. */
const emailSender = async (
  email: string,
  html: string,
  subject?: string,
): Promise<void> => {
  if (!isMailConfigured) {
    throw new Error(
      "Email is not configured. Set EMAIL and APP_PASS to enable outbound mail.",
    );
  }

  await getTransporter().sendMail({
    from: config.emailSender.email,
    to: email,
    subject,
    html,
  });
};

/**
 * Sends mail without ever throwing.
 *
 * Returns whether it was delivered. Use this anywhere the HTTP response must
 * look the same regardless — password reset, email verification — so that mail
 * trouble cannot become a side channel or fail a request whose real work already
 * succeeded.
 *
 * In development, when mail is unconfigured, the link is logged so the flow is
 * still testable end to end.
 */
/**
 * Turns `sendEmailSafely`'s bare boolean into the three-state status the mail
 * log records. `isMailConfigured` is checked independently of the boolean
 * because `sendEmailSafely` returns `false` for both "SMTP rejected it" and
 * "no SMTP credentials at all" — an admin reading the log needs to tell those
 * apart to know which one is actually theirs to fix.
 */
export function resolveEmailLogStatus(delivered: boolean): "sent" | "failed" | "not-configured" {
  if (!isMailConfigured) return "not-configured";
  return delivered ? "sent" : "failed";
}

export const sendEmailSafely = async (
  email: string,
  html: string,
  subject: string,
  context: { purpose: string; link?: string },
): Promise<boolean> => {
  if (!isMailConfigured) {
    logger.warn(
      { purpose: context.purpose, to: email, ...(isProduction ? {} : { link: context.link }) },
      "email not sent: EMAIL/APP_PASS are not configured",
    );
    return false;
  }

  try {
    await emailSender(email, html, subject);
    logger.info({ purpose: context.purpose, to: email }, "email sent");
    return true;
  } catch (error) {
    logger.error({ err: error, purpose: context.purpose, to: email }, "email delivery failed");
    return false;
  }
};

export default emailSender;
