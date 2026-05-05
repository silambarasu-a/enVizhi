import { createTransport, type TransportOptions } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import type { AlertType } from "@/generated/prisma/enums";
import { ALERT_TYPE_LABEL, ALERT_TYPE_UNIT } from "./evaluator";

type ServerOpts = SMTPTransport.Options | TransportOptions;

export interface AlertEmailInput {
  to: string;
  /** SMTP transport options + From address. */
  smtp: { server: ServerOpts; from?: string };
  /** Public app origin for links (e.g. https://pangu.app). */
  appUrl: string;
  symbol: string;
  stockName: string;
  type: AlertType;
  threshold: number;
  observedValue: number;
  triggeredAt: Date;
  currency: string;
}

/**
 * Send an alert-triggered email.
 *
 * Same playbook as the magic-link email: minimal HTML + plain-text alternative
 * for spam scoring, transactional headers, no external resources.
 */
export async function sendAlertEmail(input: AlertEmailInput) {
  const { to, smtp, appUrl, symbol, stockName, type, threshold, observedValue, currency } = input;
  const transport = createTransport(smtp.server as TransportOptions);
  const from = smtp.from ?? "EnVizhi";

  const stockUrl = `${appUrl.replace(/\/$/, "")}/stock/${encodeURIComponent(symbol)}`;
  const subject = `${symbol} · ${ALERT_TYPE_LABEL[type]} ${formatThreshold(threshold, type, currency)}`;
  const intro = describeAlert(symbol, stockName, type, threshold, observedValue, currency);

  const result = await transport.sendMail({
    to,
    from,
    replyTo: from,
    subject,
    text: textBody({ intro, stockUrl }),
    html: htmlBody({ intro, stockUrl, symbol, stockName }),
    headers: {
      "X-Entity-Ref-ID": cryptoRandomId(),
      "Auto-Submitted": "auto-generated",
      "X-Vizhi-Category": "alert",
    },
  });

  const failed = result.rejected.concat(result.pending).filter(Boolean);
  if (failed.length) throw new Error(`Email(s) (${failed.join(", ")}) could not be sent`);
}

function describeAlert(
  symbol: string,
  stockName: string,
  type: AlertType,
  threshold: number,
  observed: number,
  currency: string,
): string {
  const label = ALERT_TYPE_LABEL[type];
  const tFmt = formatThreshold(threshold, type, currency);
  const oFmt = formatThreshold(observed, type, currency);
  return `${symbol} (${stockName}) — ${label} ${tFmt}. Currently at ${oFmt}.`;
}

function formatThreshold(v: number, type: AlertType, currency: string): string {
  const unit = ALERT_TYPE_UNIT[type];
  if (type === "PRICE_ABOVE" || type === "PRICE_BELOW") {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(v);
  }
  if (type === "MOVE_PCT") {
    return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
  }
  return `${v.toFixed(2)}${unit}`;
}

function htmlBody({
  intro,
  stockUrl,
  symbol,
  stockName,
}: {
  intro: string;
  stockUrl: string;
  symbol: string;
  stockName: string;
}) {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
      <tr>
        <td align="center" style="padding:48px 16px;">
          <table width="480" cellpadding="0" cellspacing="0" border="0" role="presentation" style="max-width:480px;width:100%;">
            <tr>
              <td style="padding-bottom:24px;">
                <span style="display:inline-block;font-weight:600;font-size:18px;letter-spacing:-0.01em;">
                  <span style="display:inline-block;width:22px;height:22px;border-radius:6px;background:#4f46e5;color:#fafafa;text-align:center;line-height:22px;font-size:12px;font-family:'SFMono-Regular',Menlo,Consolas,monospace;vertical-align:-5px;margin-right:6px;">V</span>
                  EnVizhi alert
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:8px;font-size:22px;font-weight:600;letter-spacing:-0.01em;line-height:1.3;">
                ${escapeHtml(symbol)} · ${escapeHtml(stockName)}
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:24px;font-size:15px;line-height:1.55;color:#52525b;">
                ${escapeHtml(intro)}
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:24px;">
                <a href="${escapeHtml(stockUrl)}" style="display:inline-block;background:#4f46e5;color:#fafafa;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:14px;font-weight:500;">
                  Open ${escapeHtml(symbol)} on EnVizhi
                </a>
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #e4e4e7;padding-top:16px;font-size:12px;color:#71717a;line-height:1.55;">
                You're receiving this because you set an alert on this stock at EnVizhi. Quotes are
                delayed 15 minutes — this alert is a heads-up, not investment advice.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function textBody({ intro, stockUrl }: { intro: string; stockUrl: string }) {
  return `EnVizhi alert
───────────

${intro}

Open the stock on EnVizhi:
${stockUrl}

You're receiving this because you set an alert on this stock. Quotes are delayed 15 minutes — heads-up, not investment advice.
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
  const bytes = new Uint8Array(8);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
