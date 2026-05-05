import { createTransport, type TransportOptions } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

type ServerOpts = SMTPTransport.Options | TransportOptions;

/**
 * Custom Nodemailer `sendVerificationRequest` for Auth.js magic links.
 *
 * Why we override the default:
 * 1. Plain-text alternative — biggest single factor in spam scoring. Auth.js's
 *    default Email provider only sends a plain-text body OR HTML, not both.
 * 2. Subject line should be transactional and recognizable ("Sign in to EnVizhi"
 *    not "Verify your email").
 * 3. Reply-To set to the From so the domain looks consistent.
 * 4. Minimal HTML — no images, no tracking pixels, no marketing-style banner —
 *    exactly what spam filters expect from a transactional sign-in.
 */
export async function sendMagicLinkEmail({
  identifier: to,
  url,
  provider,
}: {
  identifier: string;
  url: string;
  provider: {
    server: ServerOpts;
    from?: string;
  };
}) {
  const { host } = new URL(url);
  const from = provider.from ?? "EnVizhi";
  const transport = createTransport(provider.server as TransportOptions);

  const result = await transport.sendMail({
    to,
    from,
    replyTo: from,
    subject: `Sign in to EnVizhi`,
    text: textBody({ url, host }),
    html: htmlBody({ url, host }),
    headers: {
      // Helps inbox providers classify this as transactional, not bulk.
      "X-Entity-Ref-ID": cryptoRandomId(),
      "Auto-Submitted": "auto-generated",
    },
  });

  const failed = result.rejected.concat(result.pending).filter(Boolean);
  if (failed.length) {
    throw new Error(`Email(s) (${failed.join(", ")}) could not be sent`);
  }
}

function htmlBody({ url, host }: { url: string; host: string }) {
  // Inline styles only — Gmail / Outlook strip <style> blocks.
  // Single-column, max-width 480, no images, no external links besides the CTA.
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#fafaf9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0a0f1c;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
      <tr>
        <td align="center" style="padding:48px 16px;">
          <table width="480" cellpadding="0" cellspacing="0" border="0" role="presentation" style="max-width:480px;width:100%;">
            <tr>
              <td style="padding-bottom:24px;">
                <span style="display:inline-block;font-weight:600;font-size:18px;letter-spacing:-0.01em;">
                  <span style="display:inline-block;width:22px;height:22px;border-radius:6px;background:#0E2A47;color:#fafaf9;text-align:center;line-height:22px;font-size:12px;font-family:'SFMono-Regular',Menlo,Consolas,monospace;vertical-align:-5px;margin-right:6px;">V</span>
                  EnVizhi
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:8px;font-size:22px;font-weight:600;letter-spacing:-0.01em;line-height:1.3;">
                Sign in to EnVizhi
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:24px;font-size:15px;line-height:1.55;color:#475569;">
                Click the button below to sign in. This link expires in 24 hours and can only be used once. If you didn't request this, you can ignore this email.
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:24px;">
                <a href="${escapeHtml(url)}" style="display:inline-block;background:#0E2A47;color:#fafaf9;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:14px;font-weight:500;">Sign in to EnVizhi</a>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:8px;font-size:13px;color:#64748b;">
                Or copy and paste this URL into your browser:
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:32px;font-size:12px;color:#475569;font-family:'SFMono-Regular',Menlo,Consolas,monospace;word-break:break-all;line-height:1.5;">
                ${escapeHtml(url)}
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #e5e5e0;padding-top:16px;font-size:12px;color:#94a3b8;line-height:1.55;">
                You're receiving this because someone (hopefully you) entered this email address at <strong style="color:#475569;font-weight:500;">${escapeHtml(host)}</strong>. Quotes on EnVizhi are delayed by 15 minutes. Not investment advice.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function textBody({ url, host }: { url: string; host: string }) {
  return `Sign in to EnVizhi
─────────────────

Click the link below to sign in. It expires in 24 hours and can only be used once. If you didn't request this, you can ignore this email.

${url}

You're receiving this because someone (hopefully you) entered this email address at ${host}.

Quotes on EnVizhi are delayed by 15 minutes. Not investment advice.
`;
}

/** Send a password-reset email. Same envelope/template philosophy as magic
 *  link — minimal HTML + plain-text alternative for spam scoring. */
export async function sendPasswordResetEmail({
  to,
  smtp,
  resetUrl,
}: {
  to: string;
  smtp: { server: ServerOpts; from?: string };
  resetUrl: string;
}) {
  const transport = createTransport(smtp.server as TransportOptions);
  const from = smtp.from ?? "EnVizhi";
  const { host } = new URL(resetUrl);

  const result = await transport.sendMail({
    to,
    from,
    replyTo: from,
    subject: "Reset your EnVizhi password",
    text: resetTextBody({ resetUrl, host }),
    html: resetHtmlBody({ resetUrl, host }),
    headers: {
      "X-Entity-Ref-ID": cryptoRandomId(),
      "Auto-Submitted": "auto-generated",
      "X-Vizhi-Category": "password-reset",
    },
  });

  const failed = result.rejected.concat(result.pending).filter(Boolean);
  if (failed.length) throw new Error(`Email(s) (${failed.join(", ")}) could not be sent`);
}

function resetHtmlBody({ resetUrl, host }: { resetUrl: string; host: string }) {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
      <tr><td align="center" style="padding:48px 16px;">
        <table width="480" cellpadding="0" cellspacing="0" border="0" role="presentation" style="max-width:480px;width:100%;">
          <tr><td style="padding-bottom:24px;">
            <span style="display:inline-block;font-weight:600;font-size:18px;letter-spacing:-0.01em;">
              <span style="display:inline-block;width:22px;height:22px;border-radius:6px;background:#4f46e5;color:#fafafa;text-align:center;line-height:22px;font-size:12px;font-family:'SFMono-Regular',Menlo,Consolas,monospace;vertical-align:-5px;margin-right:6px;">V</span>
              EnVizhi
            </span>
          </td></tr>
          <tr><td style="padding-bottom:8px;font-size:22px;font-weight:600;letter-spacing:-0.01em;line-height:1.3;">
            Reset your password
          </td></tr>
          <tr><td style="padding-bottom:24px;font-size:15px;line-height:1.55;color:#52525b;">
            Click the button below to set a new password. This link expires in 1 hour and can only be used once. If you didn't request this, you can ignore this email — your password won't change.
          </td></tr>
          <tr><td style="padding-bottom:24px;">
            <a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:#4f46e5;color:#fafafa;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:14px;font-weight:500;">Reset password</a>
          </td></tr>
          <tr><td style="padding-bottom:8px;font-size:13px;color:#71717a;">
            Or copy and paste this URL into your browser:
          </td></tr>
          <tr><td style="padding-bottom:32px;font-size:12px;color:#52525b;font-family:'SFMono-Regular',Menlo,Consolas,monospace;word-break:break-all;line-height:1.5;">
            ${escapeHtml(resetUrl)}
          </td></tr>
          <tr><td style="border-top:1px solid #e4e4e7;padding-top:16px;font-size:12px;color:#a1a1aa;line-height:1.55;">
            You're receiving this because someone (hopefully you) requested a password reset on <strong style="color:#52525b;font-weight:500;">${escapeHtml(host)}</strong>. If it wasn't you, ignore this email.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function resetTextBody({ resetUrl, host }: { resetUrl: string; host: string }) {
  return `Reset your EnVizhi password
─────────────────────────

Click the link below to set a new password. It expires in 1 hour and can only be used once. If you didn't request this, you can ignore this email — your password won't change.

${resetUrl}

You're receiving this because someone requested a password reset on ${host}. If it wasn't you, ignore this email.
`;
}

/** Send an email-verification link after signup. */
export async function sendVerificationEmail({
  to,
  smtp,
  verifyUrl,
}: {
  to: string;
  smtp: { server: ServerOpts; from?: string };
  verifyUrl: string;
}) {
  const transport = createTransport(smtp.server as TransportOptions);
  const from = smtp.from ?? "EnVizhi";
  const { host } = new URL(verifyUrl);

  const result = await transport.sendMail({
    to,
    from,
    replyTo: from,
    subject: "Verify your EnVizhi email",
    text: verifyTextBody({ verifyUrl, host }),
    html: verifyHtmlBody({ verifyUrl, host }),
    headers: {
      "X-Entity-Ref-ID": cryptoRandomId(),
      "Auto-Submitted": "auto-generated",
      "X-Vizhi-Category": "email-verification",
    },
  });

  const failed = result.rejected.concat(result.pending).filter(Boolean);
  if (failed.length) throw new Error(`Email(s) (${failed.join(", ")}) could not be sent`);
}

function verifyHtmlBody({ verifyUrl, host }: { verifyUrl: string; host: string }) {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
      <tr><td align="center" style="padding:48px 16px;">
        <table width="480" cellpadding="0" cellspacing="0" border="0" role="presentation" style="max-width:480px;width:100%;">
          <tr><td style="padding-bottom:24px;">
            <span style="display:inline-block;font-weight:600;font-size:18px;letter-spacing:-0.01em;">
              <span style="display:inline-block;width:22px;height:22px;border-radius:6px;background:#4f46e5;color:#fafafa;text-align:center;line-height:22px;font-size:12px;font-family:'SFMono-Regular',Menlo,Consolas,monospace;vertical-align:-5px;margin-right:6px;">V</span>
              EnVizhi
            </span>
          </td></tr>
          <tr><td style="padding-bottom:8px;font-size:22px;font-weight:600;letter-spacing:-0.01em;line-height:1.3;">
            Verify your email
          </td></tr>
          <tr><td style="padding-bottom:24px;font-size:15px;line-height:1.55;color:#52525b;">
            Welcome to EnVizhi. Click the button below to confirm this email address. The link expires in 24 hours.
          </td></tr>
          <tr><td style="padding-bottom:24px;">
            <a href="${escapeHtml(verifyUrl)}" style="display:inline-block;background:#4f46e5;color:#fafafa;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:14px;font-weight:500;">Verify email</a>
          </td></tr>
          <tr><td style="padding-bottom:8px;font-size:13px;color:#71717a;">
            Or copy and paste this URL into your browser:
          </td></tr>
          <tr><td style="padding-bottom:32px;font-size:12px;color:#52525b;font-family:'SFMono-Regular',Menlo,Consolas,monospace;word-break:break-all;line-height:1.5;">
            ${escapeHtml(verifyUrl)}
          </td></tr>
          <tr><td style="border-top:1px solid #e4e4e7;padding-top:16px;font-size:12px;color:#a1a1aa;line-height:1.55;">
            You're receiving this because someone signed up at <strong style="color:#52525b;font-weight:500;">${escapeHtml(host)}</strong> with this email. If it wasn't you, ignore this email.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function verifyTextBody({ verifyUrl, host }: { verifyUrl: string; host: string }) {
  return `Verify your EnVizhi email
───────────────────────

Welcome to EnVizhi. Click the link below to confirm this email address. It expires in 24 hours.

${verifyUrl}

You're receiving this because someone signed up at ${host} with this email. If it wasn't you, ignore this email.
`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cryptoRandomId() {
  // 16 hex chars — enough for a unique X-Entity-Ref-ID per send.
  const bytes = new Uint8Array(8);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
