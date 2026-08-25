import config from "../config";
import { SettingsServices } from "../modules/settings/settings.service";

/**
 * Outbound email templates.
 *
 * Every message the CRM sends shares one shell: the company logo, a headline, a
 * body, an optional call-to-action button and a footer carrying the support
 * details. Writing the markup once means a change to the brand is a change in
 * one place, and it means no message goes out as the bare unstyled paragraphs
 * the reset flow used to send.
 *
 * The markup is deliberately old-fashioned — nested tables, inline styles, no
 * external stylesheet, no flexbox. That is not carelessness: Outlook renders
 * with Word's HTML engine, Gmail strips `<style>` blocks in some clients, and
 * anything cleverer arrives as an unreadable stack of full-width blocks.
 */

export interface EmailAction {
  label: string;
  url: string;
}

export interface EmailBlock {
  /** Small label above a value, e.g. "Order number". */
  label: string;
  value: string;
}

export interface RenderEmailOptions {
  /** Shown large at the top of the card. */
  heading: string;
  /** One-line summary shown in the inbox preview, before the body is opened. */
  preheader: string;
  /** Optional "Hi Nusrat," line. */
  greeting?: string;
  /** Paragraphs of body copy, rendered in order. Plain text; escaped. */
  paragraphs: string[];
  action?: EmailAction;
  /** Key/value rows rendered as a bordered summary table under the body. */
  details?: EmailBlock[];
  /** Small print under the body, above the footer. */
  note?: string;
  /** Rendered verbatim; only for markup this module itself builds. */
  rawHtml?: string;
}

/** Escapes text that ends up inside an HTML attribute or element body. */
function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Makes a logo path absolute.
 *
 * Mail clients fetch images over the public internet, so a `/logo.png` that
 * works in the console resolves to nothing in an inbox. Paths are resolved
 * against the front end's public origin, which is where those files are served.
 */
function absoluteUrl(pathOrUrl: string, base: string): string {
  if (!pathOrUrl) return "";
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${base.replace(/\/$/, "")}/${pathOrUrl.replace(/^\//, "")}`;
}

interface BrandContext {
  companyName: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  supportEmail: string;
  supportPhone: string;
  website: string;
  address: string;
}

/** Reads the branding once per message. Falls back to sane defaults if unset. */
async function brandContext(): Promise<BrandContext> {
  const settings = await SettingsServices.getSettings();
  const { branding } = settings;

  const address = [branding.addressLine1, branding.addressLine2, branding.city, branding.country]
    .filter(Boolean)
    .join(", ");

  return {
    companyName: branding.companyName || "TaoJoo",
    // The light logo is used throughout: email clients composite onto white far
    // more often than not, and a dark-background logo disappears there.
    logoUrl: absoluteUrl(branding.logoLight || "/logo.png", config.frontend_url),
    primaryColor: branding.primaryColor || "#f15a29",
    accentColor: branding.accentColor || "#2a2263",
    supportEmail: branding.supportEmail || "",
    supportPhone: branding.supportPhone || "",
    website: branding.website || config.frontend_url,
    address,
  };
}

/**
 * Renders one message.
 *
 * Exported separately from the named templates below so a caller with a one-off
 * message still gets the branded shell rather than reinventing it.
 */
export async function renderEmail(options: RenderEmailOptions): Promise<string> {
  const brand = await brandContext();

  const paragraphs = options.paragraphs
    .map(
      (text) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#334155;">${escapeHtml(text)}</p>`,
    )
    .join("");

  const greeting = options.greeting
    ? `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#0f172a;font-weight:600;">${escapeHtml(
        options.greeting,
      )}</p>`
    : "";

  // Bulletproof button: the padded anchor works everywhere, and the surrounding
  // table keeps Outlook from collapsing the padding to nothing.
  const action = options.action
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
         <tr>
           <td align="center" bgcolor="${brand.primaryColor}" style="border-radius:10px;">
             <a href="${escapeHtml(options.action.url)}"
                style="display:inline-block;padding:14px 32px;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">
               ${escapeHtml(options.action.label)}
             </a>
           </td>
         </tr>
       </table>
       <p style="margin:0 0 20px;font-size:12px;line-height:20px;color:#94a3b8;word-break:break-all;">
         If the button does not work, paste this into your browser:<br />
         <a href="${escapeHtml(options.action.url)}" style="color:${brand.primaryColor};">${escapeHtml(
           options.action.url,
         )}</a>
       </p>`
    : "";

  const details =
    options.details && options.details.length > 0
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                style="margin:0 0 24px;border:1px solid #e2e8f0;border-radius:12px;border-collapse:separate;overflow:hidden;">
           ${options.details
             .map(
               (row, index) => `
             <tr style="background-color:${index % 2 === 0 ? "#f8fafc" : "#ffffff"};">
               <td style="padding:12px 16px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;">
                 ${escapeHtml(row.label)}
               </td>
               <td style="padding:12px 16px;font-size:14px;color:#0f172a;font-weight:600;text-align:right;">
                 ${escapeHtml(row.value)}
               </td>
             </tr>`,
             )
             .join("")}
         </table>`
      : "";

  const note = options.note
    ? `<p style="margin:0;padding:14px 16px;background-color:#f8fafc;border-left:3px solid ${brand.primaryColor};border-radius:6px;font-size:13px;line-height:20px;color:#64748b;">${escapeHtml(
        options.note,
      )}</p>`
    : "";

  const supportLine = [
    brand.supportEmail
      ? `<a href="mailto:${escapeHtml(brand.supportEmail)}" style="color:#64748b;text-decoration:none;">${escapeHtml(brand.supportEmail)}</a>`
      : "",
    brand.supportPhone ? escapeHtml(brand.supportPhone) : "",
  ]
    .filter(Boolean)
    .join(" &nbsp;·&nbsp; ");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="color-scheme" content="light" />
    <title>${escapeHtml(options.heading)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#eef2f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <!-- Inbox preview text, hidden in the rendered message. -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(options.preheader)}</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef2f7;">
      <tr>
        <td align="center" style="padding:32px 16px;">

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

            <!-- Brand -->
            <tr>
              <td align="center" style="padding:0 0 24px;">
                <a href="${escapeHtml(brand.website)}" style="text-decoration:none;">
                  <img src="${escapeHtml(brand.logoUrl)}" alt="${escapeHtml(brand.companyName)}"
                       width="140" style="display:block;width:140px;max-width:60%;height:auto;border:0;" />
                </a>
              </td>
            </tr>

            <!-- Card -->
            <tr>
              <td style="background-color:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="height:4px;background-color:${brand.primaryColor};font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                  <tr>
                    <td style="padding:32px 32px 28px;">
                      <h1 style="margin:0 0 20px;font-size:22px;line-height:30px;font-weight:800;color:${brand.accentColor};letter-spacing:-.01em;">
                        ${escapeHtml(options.heading)}
                      </h1>
                      ${greeting}
                      ${paragraphs}
                      ${action}
                      ${details}
                      ${options.rawHtml ?? ""}
                      ${note}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td align="center" style="padding:24px 16px 0;">
                <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#475569;">${escapeHtml(brand.companyName)}</p>
                ${brand.address ? `<p style="margin:0 0 6px;font-size:12px;color:#94a3b8;">${escapeHtml(brand.address)}</p>` : ""}
                ${supportLine ? `<p style="margin:0 0 12px;font-size:12px;color:#64748b;">${supportLine}</p>` : ""}
                <p style="margin:0;font-size:11px;line-height:18px;color:#a0aec0;">
                  This is an automated message from the ${escapeHtml(brand.companyName)} CRM.<br />
                  If it reached you by mistake, you can safely ignore it.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/* -------------------------------------------------------------------------- */
/* Named templates                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Welcome message for an account someone else created.
 *
 * Deliberately not "here is your password". Mailing a credential means it lives
 * in an inbox forever and in every mail server it passed through; a one-time
 * link that the recipient exchanges for a password of their own choosing does
 * not.
 */
export async function renderWelcomeEmail(params: {
  name: string;
  link: string;
  expiresIn: string;
  companyRole?: string;
}): Promise<string> {
  const brand = await brandContext();

  return renderEmail({
    heading: `Welcome to ${brand.companyName}`,
    preheader: `Set your password and sign in to your ${brand.companyName} account.`,
    greeting: `Hi ${params.name},`,
    paragraphs: [
      `An account has been created for you on the ${brand.companyName} portal. You can track your orders, review quotations and see your payment history there.`,
      "Choose a password to activate your account. For your security we never send passwords by email — the button below takes you to a private page where you set your own.",
    ],
    action: { label: "Set my password", url: params.link },
    note: `This link expires in ${params.expiresIn}. If it lapses, use "Forgot password" on the sign-in page to request a new one.`,
  });
}

export async function renderPasswordResetEmail(params: {
  name: string;
  link: string;
  expiresIn: string;
  /** True when an administrator triggered it rather than the account holder. */
  initiatedByStaff?: boolean;
}): Promise<string> {
  return renderEmail({
    heading: "Reset your password",
    preheader: "A link to choose a new password for your account.",
    greeting: `Hi ${params.name},`,
    paragraphs: [
      params.initiatedByStaff
        ? "A member of our team has started a password reset for your account at your request."
        : "We received a request to reset the password on your account.",
      "Click below to choose a new one. Your current password stays active until you do.",
    ],
    action: { label: "Choose a new password", url: params.link },
    note: `This link expires in ${params.expiresIn}. If you did not ask for this, ignore this email — your password will not change, and no one can use this link without your inbox.`,
  });
}

export async function renderVerifyEmail(params: {
  name: string;
  link: string;
  expiresIn: string;
}): Promise<string> {
  const brand = await brandContext();

  return renderEmail({
    heading: "Confirm your email address",
    preheader: `One click to finish setting up your ${brand.companyName} account.`,
    greeting: `Hi ${params.name},`,
    paragraphs: [
      `Thanks for signing up. Confirm this address to activate your ${brand.companyName} account.`,
    ],
    action: { label: "Confirm my email", url: params.link },
    note: `This link expires in ${params.expiresIn}.`,
  });
}

/** Sent when an invoice is issued against an order. */
export async function renderInvoiceEmail(params: {
  name: string;
  invoiceNumber: string;
  orderNumber: string;
  issueDate: string;
  dueDate: string;
  total: string;
  amountDue: string;
  link?: string;
  paymentInstructions?: string;
}): Promise<string> {
  const brand = await brandContext();

  return renderEmail({
    heading: `Invoice ${params.invoiceNumber}`,
    preheader: `${params.total} due by ${params.dueDate} for order ${params.orderNumber}.`,
    greeting: `Hi ${params.name},`,
    paragraphs: [
      `Here is the invoice for your order ${params.orderNumber}. The full breakdown is available in your ${brand.companyName} portal.`,
    ],
    details: [
      { label: "Invoice", value: params.invoiceNumber },
      { label: "Order", value: params.orderNumber },
      { label: "Issued", value: params.issueDate },
      { label: "Due", value: params.dueDate },
      { label: "Total", value: params.total },
      { label: "Amount due", value: params.amountDue },
    ],
    ...(params.link ? { action: { label: "View invoice", url: params.link } } : {}),
    ...(params.paymentInstructions ? { note: params.paymentInstructions } : {}),
  });
}

/** Sent when a payment is recorded against an invoice or order. */
export async function renderPaymentReceiptEmail(params: {
  name: string;
  amount: string;
  method: string;
  reference: string;
  orderNumber: string;
  paidAt: string;
  remaining: string;
}): Promise<string> {
  return renderEmail({
    heading: "Payment received",
    preheader: `We have recorded your payment of ${params.amount}.`,
    greeting: `Hi ${params.name},`,
    paragraphs: ["Thank you — your payment has been recorded against the order below."],
    details: [
      { label: "Amount", value: params.amount },
      { label: "Method", value: params.method },
      ...(params.reference ? [{ label: "Reference", value: params.reference }] : []),
      { label: "Order", value: params.orderNumber },
      { label: "Received", value: params.paidAt },
      { label: "Still outstanding", value: params.remaining },
    ],
  });
}
