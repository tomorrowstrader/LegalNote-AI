import { Resend } from 'resend';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import type { FirmRiskDigest } from './storage';

type EmailProvider = 'resend' | 'ses';

const EMAIL_PROVIDER: EmailProvider =
  (process.env.EMAIL_PROVIDER || 'resend').toLowerCase() === 'ses' ? 'ses' : 'resend';

console.log(`[EMAIL] Active provider: ${EMAIL_PROVIDER}`);

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const sesClient =
  EMAIL_PROVIDER === 'ses'
    ? new SESv2Client({ region: process.env.AWS_REGION || 'eu-west-2' })
    : null;

interface SendEmailParams {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  headers?: Record<string, string>;
}

async function sendEmail(
  params: SendEmailParams
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const to = Array.isArray(params.to) ? params.to : [params.to];
  const { from, subject, html, replyTo, headers } = params;

  try {
    if (EMAIL_PROVIDER === 'ses') {
      if (!sesClient) {
        return { success: false, error: 'SES client not configured' };
      }

      const simpleHeaders = headers
        ? Object.entries(headers).map(([Name, Value]) => ({ Name, Value }))
        : undefined;

      const result = await sesClient.send(
        new SendEmailCommand({
          FromEmailAddress: from,
          Destination: { ToAddresses: to },
          ReplyToAddresses: replyTo ? [replyTo] : undefined,
          Content: {
            Simple: {
              Subject: { Data: subject, Charset: 'UTF-8' },
              Body: { Html: { Data: html, Charset: 'UTF-8' } },
              ...(simpleHeaders ? { Headers: simpleHeaders } : {}),
            },
          },
        })
      );

      return { success: true, messageId: result.MessageId };
    }

    if (!resend) {
      return { success: false, error: 'Email service not configured' };
    }

    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
      ...(headers ? { headers } : {}),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (error: any) {
    return { success: false, error: error.message || 'Unknown error' };
  }
}

/** Canonical outbound email brand mark — text only (no remote images). */
export function legalNoteTextLogoHtml(): string {
  return `
    <div style="margin:0 auto;text-align:center;line-height:1;">
      <span style="font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:700;letter-spacing:-0.03em;color:#3d3028;">
        Legal<span style="color:#c97d4d;">Note</span>
      </span>
      <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#8a7d72;display:block;margin-top:6px;">
        Meeting to Matter
      </span>
    </div>
  `;
}

/** Full-width brand header for div-based email layouts. */
export function legalNoteBrandHeaderHtml(): string {
  return `
    <div style="text-align:center;padding:28px 24px 24px;background-color:#faf9f7;border-bottom:1px solid #e8e4df;">
      ${legalNoteTextLogoHtml()}
    </div>
  `;
}

/** Brand header as a table row for table-based layouts (e.g. secure share). */
export function legalNoteBrandHeaderTableRow(): string {
  return `
    <tr>
      <td align="center" style="background-color:#faf9f7;padding:28px 24px 24px;border-bottom:1px solid #e8e4df;">
        ${legalNoteTextLogoHtml()}
      </td>
    </tr>
  `;
}

interface SendCaseEmailParams {
  to: string;
  shareLinkId: string;
  /** Optional solicitor-written note. Must not include matter/client PII for data residency. */
  customMessage?: string;
  /** Automated access notice (expiry / password / SMS). Must not include matter/client PII. */
  systemMessage?: string;
  firmProfile?: {
    firmName: string;
    phone?: string;
    email?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    postcode?: string;
    logoUrl?: string;
  };
}

/**
 * Sends a secure share-link email.
 * GDPR / data residency: intentionally omits client name, case title, and matter reference
 * from subject and body. Only a generic message, optional personal note, and the link are sent.
 */
export async function sendCaseEmail(params: SendCaseEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const {
    to,
    shareLinkId,
    customMessage,
    systemMessage,
    firmProfile
  } = params;

  // Construct the secure share link URL (publicly accessible, no authentication required)
  const baseUrl = process.env.APP_URL?.replace(/\/$/, '') || 'https://legalnote.ai';
  const shareUrl = `${baseUrl}/share/${shareLinkId}`;

  const defaultMessage =
    'You have received a secure document. Use the button below to continue — SMS verification may be required before you can view it.';

  const escapeHtml = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const safePersonal = customMessage
    ? escapeHtml(customMessage).replace(/\n/g, '<br>')
    : '';
  const safeSystem = systemMessage
    ? escapeHtml(systemMessage).replace(/\n/g, '<br>')
    : '';
  const safeFirmName = firmProfile?.firmName ? escapeHtml(firmProfile.firmName) : '';
  const logoSrc = firmProfile?.logoUrl?.trim() || '';

  // YouSign-inspired layout: light/black split, firm branding only, white overlay card, black CTA
  const emailHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Secure document access</title>
    </head>
    <body style="margin:0;padding:0;background-color:#f3f3f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f3f3;">
        <tr>
          <td align="center" style="padding:0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;">
              ${legalNoteBrandHeaderTableRow()}
              <!-- Light top band with firm branding only (no client / matter data) -->
              <tr>
                <td align="center" style="background-color:#f3f3f3;padding:40px 24px 56px;">
                  ${logoSrc ? `
                    <img src="${escapeHtml(logoSrc)}" alt="${safeFirmName || 'Firm'}" width="56" height="56" style="display:block;width:56px;height:56px;border-radius:50%;object-fit:cover;margin:0 auto 16px;" />
                  ` : ''}
                  ${safeFirmName ? `
                    <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:400;line-height:1.3;color:#1a1a1a;text-align:center;">
                      ${safeFirmName}
                    </h1>
                  ` : ''}
                </td>
              </tr>

              <!-- Black lower band; white card overlaps via negative margin -->
              <tr>
                <td align="center" style="background-color:#000000;padding:0 20px 48px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;margin:-40px auto 0;background-color:#ffffff;border-radius:16px;">
                    <tr>
                      <td style="padding:40px 32px 36px;text-align:center;">
                        <div style="width:56px;height:56px;margin:0 auto 24px;border-radius:50%;background:linear-gradient(145deg,#c8d4c4 0%,#9aab9a 55%,#b8e000 100%);line-height:56px;font-size:26px;color:#ffffff;">✓</div>

                        <h2 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:400;line-height:1.25;color:#1a1a1a;">
                          Secure document ready
                        </h2>

                        <p style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;line-height:1.5;color:#1a1a1a;">
                          ${safePersonal || defaultMessage}
                        </p>

                        ${safeSystem ? `
                          <p style="margin:0 0 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;font-weight:400;line-height:1.5;color:#555555;">
                            ${safeSystem}
                          </p>
                        ` : `
                          <p style="margin:0 0 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;font-weight:400;line-height:1.5;color:#555555;">
                            Continue to the secure portal to complete verification and view your documents.
                          </p>
                        `}

                        <!-- Black CTA with lime accent (email-safe table button) -->
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
                          <tr>
                            <td align="center" style="background-color:#000000;border-radius:8px;">
                              <a href="${shareUrl}" style="display:block;padding:16px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.06em;text-decoration:none;color:#ffffff;text-transform:uppercase;">
                                View Secure Document
                                <span style="display:inline-block;margin-left:12px;padding-left:12px;border-left:2px solid #b8e000;line-height:1;">↓</span>
                              </a>
                            </td>
                          </tr>
                        </table>

                        <p style="margin:24px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;line-height:1.5;color:#888888;">
                          If the button does not work, copy this link into your browser:<br>
                          <a href="${shareUrl}" style="color:#555555;word-break:break-all;">${shareUrl}</a>
                        </p>
                      </td>
                    </tr>
                  </table>

                  <p style="margin:28px 20px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;line-height:1.5;color:#999999;text-align:center;">
                    This email contains a confidential link intended only for the recipient.
                    If you are not the intended recipient, please delete this email and notify the sender immediately.
                    ${safeFirmName ? `<br><br>&copy; ${new Date().getFullYear()} ${safeFirmName}. All rights reserved.` : ''}
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  try {
    const result = await sendEmail({
      from: 'LegalNote™ <support@legalnote.ai>',
      to,
      subject: 'Secure document access',
      html: emailHtml,
    });

    if (!result.success) {
      console.error('Error sending email:', result.error);
    }

    return result;
  } catch (error: any) {
    console.error('Exception sending email:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

interface SendRecordingConfirmationParams {
  to: string;
  solicitorName: string;
  caseTitle: string;
  clientName: string;
  matterReference?: string;
  recordingDuration: string;
  recordedAt: Date;
  caseId: string;
  documentsGenerated: string[];
  firmProfile?: {
    firmName: string;
    phone?: string;
    email?: string;
  };
}

/**
 * Sends a confirmation email to the solicitor when a recording is successfully saved
 */
export async function sendRecordingConfirmationEmail(params: SendRecordingConfirmationParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const {
    to,
    solicitorName,
    caseTitle,
    clientName,
    matterReference,
    recordingDuration,
    recordedAt,
    caseId,
    documentsGenerated,
    firmProfile
  } = params;

  const baseUrl = process.env.APP_URL?.replace(/\/$/, '') || 'https://legalnote.ai';
  const caseUrl = `${baseUrl}/cases/${caseId}`;

  const formattedDate = recordedAt.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const formattedTime = recordedAt.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f9f9f9;
        }
        .container {
          background-color: #fff;
          padding: 0;
          overflow: hidden;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
          text-align: center;
          padding: 24px 30px 20px;
          margin-bottom: 0;
          border-bottom: 2px solid #22c55e;
        }
        .success-icon {
          width: 60px;
          height: 60px;
          background-color: #22c55e;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 15px;
        }
        .success-icon svg {
          width: 30px;
          height: 30px;
          fill: white;
        }
        .header h1 {
          font-size: 22px;
          color: #22c55e;
          margin: 0;
        }
        .case-box {
          background-color: #f5f5f5;
          padding: 20px;
          border-radius: 6px;
          margin: 20px 0;
        }
        .case-box h3 {
          margin: 0 0 15px 0;
          font-size: 16px;
          color: #333;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #e5e5e5;
        }
        .detail-row:last-child {
          border-bottom: none;
        }
        .detail-label {
          color: #666;
          font-size: 14px;
        }
        .detail-value {
          font-weight: 600;
          font-size: 14px;
        }
        .documents-list {
          background-color: #f0fdf4;
          border: 1px solid #22c55e30;
          border-radius: 6px;
          padding: 15px 20px;
          margin: 20px 0;
        }
        .documents-list h4 {
          margin: 0 0 10px 0;
          font-size: 14px;
          color: #166534;
        }
        .documents-list ul {
          margin: 0;
          padding-left: 20px;
        }
        .documents-list li {
          padding: 3px 0;
          font-size: 14px;
          color: #166534;
        }
        .cta-button {
          display: inline-block;
          background-color: #000;
          color: #fff;
          padding: 14px 35px;
          text-decoration: none;
          border-radius: 6px;
          font-weight: bold;
          margin: 20px 0;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
          font-size: 12px;
          color: #666;
          text-align: center;
        }
        .protection-note {
          background-color: #f0f9ff;
          border-left: 4px solid #3b82f6;
          padding: 12px 15px;
          margin: 20px 0;
          font-size: 13px;
        }
        .protection-note strong {
          color: #1e40af;
        }
      </style>
    </head>
    <body>
      <div class="container">
        ${legalNoteBrandHeaderHtml()}
        <div class="header" style="border-bottom:2px solid #22c55e;">
          <div class="success-icon">
            <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
          </div>
          <h1>Recording Successfully Saved</h1>
        </div>

        <div style="padding: 0 30px 30px;">
        <p>Dear ${solicitorName},</p>

        <p>Your client meeting recording has been successfully processed and saved to LegalNote. All protection layers were active during recording.</p>

        <div class="case-box">
          <h3>Recording Details</h3>
          <div class="detail-row">
            <span class="detail-label">Case</span>
            <span class="detail-value">${caseTitle}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Client</span>
            <span class="detail-value">${clientName}</span>
          </div>
          ${matterReference ? `
          <div class="detail-row">
            <span class="detail-label">Matter Reference</span>
            <span class="detail-value">${matterReference}</span>
          </div>
          ` : ''}
          <div class="detail-row">
            <span class="detail-label">Date</span>
            <span class="detail-value">${formattedDate}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Time</span>
            <span class="detail-value">${formattedTime}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Duration</span>
            <span class="detail-value">${recordingDuration}</span>
          </div>
        </div>

        ${documentsGenerated.length > 0 ? `
        <div class="documents-list">
          <h4>Documents Being Generated</h4>
          <ul>
            ${documentsGenerated.map(doc => `<li>${doc}</li>`).join('')}
          </ul>
        </div>
        ` : ''}

        <div class="protection-note">
          <strong>Protected Recording</strong><br>
          Your recording was protected with chunked uploads, network monitoring, and session auto-extension. The consent segment has been flagged for extended retention.
        </div>

        <p style="text-align: center;">
          <a href="${caseUrl}" class="cta-button">View Case</a>
        </p>

        <p style="font-size: 13px; color: #666;">
          If the button above doesn't work, copy and paste this link into your browser:<br>
          <a href="${caseUrl}">${caseUrl}</a>
        </p>

        <div class="footer">
          <p>This confirmation was sent by LegalNote</p>
          ${firmProfile?.firmName ? `<p>${firmProfile.firmName}</p>` : ''}
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const result = await sendEmail({
      from: 'LegalNote™ <support@legalnote.ai>',
      to,
      subject: `Recording Saved - ${clientName}${matterReference ? ` (${matterReference})` : ''} - ${formattedDate}`,
      html: emailHtml,
    });

    if (!result.success) {
      console.error('[EMAIL] Error sending recording confirmation:', result.error);
    } else {
      console.log('[EMAIL] Recording confirmation sent successfully:', result.messageId);
    }

    return result;
  } catch (error: any) {
    console.error('[EMAIL] Exception sending recording confirmation:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

interface SendPreConsentEmailParams {
  to: string;
  /** Display name only — never an email address. Omitted from greeting if missing/email-like. */
  recipientName?: string;
  consentUrl: string;
  /** Optional schedule context (date/time only — never matter title or client identifiers). */
  scheduledMeetingTime?: Date;
}

function publicFacingDisplayName(name?: string | null): string | null {
  const trimmed = name?.trim();
  if (!trimmed || trimmed.includes("@")) return null;
  return trimmed;
}

/**
 * Pre-meeting recording consent request.
 * GDPR / data residency: omits client identifiers, matter titles, and case references.
 * Schedule date/time may be included; all matter detail stays behind the consent link.
 */
export async function sendPreConsentEmail(params: SendPreConsentEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { to, recipientName, consentUrl, scheduledMeetingTime } = params;

  const displayName = publicFacingDisplayName(recipientName);
  const greeting = displayName ? `Hello ${escapeHtmlPlain(displayName)},` : "Hello,";

  const whenLine = scheduledMeetingTime && !isNaN(scheduledMeetingTime.getTime())
    ? (() => {
        const date = scheduledMeetingTime.toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        });
        const time = scheduledMeetingTime.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        });
        return ` for your meeting on <strong>${escapeHtmlPlain(date)}</strong> at <strong>${escapeHtmlPlain(time)}</strong>`;
      })()
    : "";

  const emailHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Recording consent request</title>
    </head>
    <body style="margin:0;padding:0;background-color:#f3f3f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f3f3;">
        <tr>
          <td align="center" style="padding:0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;">
              ${legalNoteBrandHeaderTableRow()}
              <tr>
                <td align="center" style="background-color:#f3f3f3;padding:36px 24px 48px;">
                  <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:400;line-height:1.3;color:#1a1a1a;">
                    Recording consent
                  </p>
                </td>
              </tr>
              <tr>
                <td align="center" style="background-color:#000000;padding:0 20px 48px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;margin:-36px auto 0;background-color:#ffffff;border-radius:16px;">
                    <tr>
                      <td style="padding:40px 32px 36px;text-align:left;">
                        <p style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1a1a1a;">
                          ${greeting}
                        </p>
                        <p style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1a1a1a;">
                          Your solicitor has asked for your consent to record an upcoming meeting${whenLine}, so accurate attendance notes can be prepared.
                        </p>
                        <p style="margin:0 0 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.55;color:#555555;">
                          Continue on LegalNote to consent or decline. No matter details are included in this email.
                        </p>
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
                          <tr>
                            <td align="center" style="background-color:#000000;border-radius:8px;">
                              <a href="${escapeHtmlPlain(consentUrl)}" style="display:block;padding:16px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.06em;text-decoration:none;color:#ffffff;text-transform:uppercase;">
                                Review and respond
                                <span style="display:inline-block;margin-left:12px;padding-left:12px;border-left:2px solid #b8e000;line-height:1;">→</span>
                              </a>
                            </td>
                          </tr>
                        </table>
                        <p style="margin:24px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;line-height:1.5;color:#888888;">
                          If the button does not work, copy this link into your browser:<br>
                          <a href="${escapeHtmlPlain(consentUrl)}" style="color:#555555;word-break:break-all;">${escapeHtmlPlain(consentUrl)}</a>
                        </p>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:28px 20px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;line-height:1.5;color:#999999;text-align:center;">
                    If you do not wish the meeting to be recorded, open the link and choose Decline — or ignore this email and nothing will be recorded.
                    <br><br>Sent via LegalNote — Meeting to Matter.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  try {
    const result = await sendEmail({
      from: 'LegalNote™ <support@legalnote.ai>',
      to,
      subject: 'Recording consent request',
      html: emailHtml,
    });

    if (!result.success) {
      console.error('[EMAIL] Error sending pre-consent email:', result.error);
    } else {
      console.log('[EMAIL] Pre-consent email sent successfully:', result.messageId);
    }

    return result;
  } catch (error: any) {
    console.error('[EMAIL] Exception sending pre-consent email:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

function escapeHtmlPlain(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Generic branded notice for clients — no matter titles or client identifiers in content. */
export async function sendBrandedClientNoticeEmail(params: {
  to: string;
  subject: string;
  heading: string;
  messageHtml: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { to, subject, heading, messageHtml } = params;
  const emailHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escapeHtmlPlain(subject)}</title>
    </head>
    <body style="margin:0;padding:0;background-color:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1a1a;">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;">
        ${legalNoteBrandHeaderHtml()}
        <div style="padding:28px 32px 36px;">
          <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:400;color:#3d3028;">${escapeHtmlPlain(heading)}</h1>
          <div style="font-size:15px;line-height:1.55;color:#333333;">${messageHtml}</div>
          <hr style="margin:32px 0;border:none;border-top:1px solid #e8e4df;">
          <p style="margin:0;font-size:12px;color:#8a7d72;">Sent via LegalNote — Meeting to Matter.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  try {
    return await sendEmail({
      from: 'LegalNote™ <support@legalnote.ai>',
      to,
      subject,
      html: emailHtml,
    });
  } catch (error: any) {
    return { success: false, error: error.message || 'Unknown error' };
  }
}

interface SendConsentResponseNotificationParams {
  to: string;
  solicitorName: string;
  clientName: string;
  clientEmail: string;
  responseStatus: string;
  meetingTitle?: string;
  meetingTime?: Date;
  rescheduleNote?: string;
  caseId?: string;
}

export async function sendConsentResponseNotification(params: SendConsentResponseNotificationParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const {
    to,
    solicitorName,
    clientName,
    clientEmail,
    responseStatus,
    meetingTitle,
    meetingTime,
    rescheduleNote,
    caseId,
  } = params;

  const baseUrl = process.env.APP_URL?.replace(/\/$/, '') || 'https://legalnote.ai';

  const statusLabel = responseStatus === 'granted' ? 'Consent Granted'
    : responseStatus === 'declined' ? 'Consent Declined'
    : responseStatus === 'reschedule_requested' ? 'Reschedule Requested'
    : responseStatus;

  const statusColor = responseStatus === 'granted' ? '#22c55e'
    : responseStatus === 'declined' ? '#dc2626'
    : '#f59e0b';

  const meetingTimeStr = meetingTime
    ? meetingTime.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) +
      ' at ' + meetingTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : 'Not specified';

  const caseLink = caseId ? `<a href="${baseUrl}/cases/${caseId}" style="color: #000; text-decoration: underline;">View Case</a>` : '';

  const rescheduleSection = rescheduleNote ? `
    <div style="background: #fef3c7; border-radius: 6px; padding: 16px; margin-top: 16px;">
      <strong>Client's message:</strong>
      <p style="margin: 8px 0 0;">${rescheduleNote.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
    </div>
  ` : '';

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
      <div style="background: white; border-radius: 8px; padding: 0; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
        ${legalNoteBrandHeaderHtml()}
        <div style="padding: 32px;">
        <div style="border-bottom: 2px solid ${statusColor}; padding-bottom: 16px; margin-bottom: 24px;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 600;">Client Consent Response</h1>
        </div>
        <p>Dear ${solicitorName},</p>
        <p>Your client <strong>${clientName}</strong> (${clientEmail}) has responded to your pre-meeting consent request.</p>
        <div style="background: #f8f9fa; border-radius: 6px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: 600;">${statusLabel}</span></p>
          ${meetingTitle ? `<p style="margin: 8px 0 0;"><strong>Meeting:</strong> ${meetingTitle}</p>` : ''}
          <p style="margin: 8px 0 0;"><strong>Scheduled:</strong> ${meetingTimeStr}</p>
        </div>
        ${rescheduleSection}
        ${responseStatus === 'declined' ? '<p style="color: #dc2626;"><strong>Note:</strong> No recording will be attempted for this meeting as the client has declined consent.</p>' : ''}
        ${responseStatus === 'reschedule_requested' ? '<p>Please review the client\'s request and send a new meeting time at your convenience.</p>' : ''}
        ${caseLink ? `<p style="margin-top: 24px;">${caseLink}</p>` : ''}
        <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e5e5;" />
        <p style="font-size: 12px; color: #666;">This is an automated notification from LegalNote. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const subject = responseStatus === 'granted'
    ? `Consent Granted: ${clientName} has approved recording`
    : responseStatus === 'declined'
    ? `Consent Declined: ${clientName} has declined recording`
    : `Reschedule Requested: ${clientName} has requested a new time`;

  try {
    const result = await sendEmail({
      from: 'LegalNote™ <support@legalnote.ai>',
      to,
      subject,
      html: emailHtml,
    });

    if (!result.success) {
      console.error('[EMAIL] Error sending consent response notification:', result.error);
    } else {
      console.log('[EMAIL] Consent response notification sent successfully:', result.messageId);
    }

    return result;
  } catch (error: any) {
    console.error('[EMAIL] Exception sending consent response notification:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

export async function sendWaitlistConfirmationEmail(to: string, firstName: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: Georgia, 'Times New Roman', serif;
          line-height: 1.7;
          color: #2d2520;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #faf9f7;
        }
        .container {
          background: white;
          border-radius: 8px;
          padding: 0;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .content {
          margin-bottom: 24px;
          padding: 0 32px 32px;
        }
        .highlight {
          background: linear-gradient(135deg, #3d3028 0%, #5a4a3a 100%);
          padding: 20px;
          border-radius: 8px;
          margin: 24px 0;
        }
        .highlight-heading {
          color: #f0c8a0;
          font-weight: 700;
          font-size: 16px;
          display: block;
          margin-bottom: 14px;
        }
        .highlight-body {
          color: #ffffff;
          font-size: 15px;
          line-height: 1.7;
        }
        .benefits {
          background: #faf8f5;
          border-left: 3px solid #c97d4d;
          padding: 16px 20px;
          margin: 24px 0;
        }
        .benefits ul {
          margin: 0;
          padding-left: 20px;
        }
        .benefits li {
          margin-bottom: 8px;
          color: #4a3f35;
        }
        .cta-section {
          text-align: center;
          margin: 28px 0;
          padding: 20px;
          background: #fdfcfa;
          border-radius: 8px;
        }
        .cta-button {
          display: inline-block;
          background: #c97d4d;
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 600;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .reply-note {
          font-size: 14px;
          color: #6b5d52;
          font-style: italic;
          margin-top: 24px;
        }
        .footer {
          margin-top: 32px;
          padding-top: 16px;
          border-top: 1px solid #e8e4df;
          font-size: 12px;
          color: #8a7d72;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="container">
        ${legalNoteBrandHeaderHtml()}
        <div class="content" style="padding-top:28px;">
          <p>Dear ${firstName},</p>
          
          <p>Thank you for registering your interest in LegalNote. You're now on our early access waitlist.</p>
          
          <div class="highlight">
            <span class="highlight-heading">What happens next?</span>
            <span class="highlight-body">We're carefully onboarding firms during private beta to ensure the highest standards of compliance and data protection. As part of onboarding, we'll help you create contemporaneous attendance notes aligned with SRA expectations from day one. We'll be in touch as soon as we're ready to welcome your practice.</span>
          </div>
          
          <div class="benefits">
            <p style="margin: 0 0 12px 0; font-weight: 600; color: #3d3028;">LegalNote helps your practice:</p>
            <ul>
              <li>Create defensible, contemporaneous attendance notes</li>
              <li>GDPR-compliant consent-first recording with full audit trail</li>
              <li>SRA-defensible records that reduce PI exposure and protect against complaints</li>
              <li>Relieve cognitive fatigue for fee-earners with AI-powered documentation</li>
            </ul>
          </div>
          
          <p class="reply-note">Have a question on how to make your firm's meetings defensible and compliant? Simply reply to this email.</p>
          
          <p>Kind regards,<br><strong>LegalNote Client Support</strong></p>
        
          <div class="footer">
            <p>You received this email because you registered for early access to LegalNote.</p>
            <p>LegalNote\u2122 \u2014 Compliance-first legal documentation</p>
            <p>Registered Office: 71-75 Shelton Street, Covent Garden, London, WC2H 9JQ</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const result = await sendEmail({
      from: 'LegalNote\u2122 <support@legalnote.ai>',
      to,
      replyTo: 'support@legalnote.ai',
      headers: {
        'Precedence': 'bulk',
        'X-Entity-Ref-ID': Date.now().toString(),
      },
      subject: 'Welcome to the LegalNote Waitlist',
      html: emailHtml,
    });

    if (!result.success) {
      console.error('[EMAIL] Error sending waitlist confirmation:', result.error);
    } else {
      console.log('[EMAIL] Waitlist confirmation sent successfully:', result.messageId);
    }

    return result;
  } catch (error: any) {
    console.error('[EMAIL] Exception sending waitlist confirmation:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

interface WaitlistAdminNotificationParams {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  firmName?: string | null;
  firmSize?: string | null;
  role?: string | null;
  source?: string | null;
}

/**
 * Sends a notification email to admin when someone joins the waitlist
 */
export async function sendWaitlistAdminNotification(params: WaitlistAdminNotificationParams): Promise<{ success: boolean; error?: string }> {
  const { email, firstName, lastName, firmName, firmSize, role, source } = params;
  
  // support@ is a Google Workspace alias for the monitored Jazz Dennis inbox.
  // Use the alias only so the same notification is not delivered twice.
  const adminEmails = ['support@legalnote.ai'];
  
  const submittedAt = new Date().toLocaleString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/London'
  });

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #1a1a1a;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          background: white;
          border-radius: 8px;
          padding: 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        .header {
          background: linear-gradient(135deg, #c97d4d 0%, #8b5a3c 100%);
          color: white;
          padding: 16px 20px;
          border-radius: 8px 8px 0 0;
          margin: -24px -24px 20px -24px;
        }
        .header h1 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
        }
        .detail-row {
          display: flex;
          border-bottom: 1px solid #eee;
          padding: 10px 0;
        }
        .detail-row:last-child {
          border-bottom: none;
        }
        .detail-label {
          width: 120px;
          color: #666;
          font-size: 14px;
          flex-shrink: 0;
        }
        .detail-value {
          font-weight: 500;
          font-size: 14px;
          color: #1a1a1a;
        }
        .timestamp {
          font-size: 12px;
          color: #888;
          margin-top: 16px;
          padding-top: 12px;
          border-top: 1px solid #eee;
        }
      </style>
    </head>
    <body>
      <div class="container" style="padding:0;overflow:hidden;">
        ${legalNoteBrandHeaderHtml()}
        <div style="padding:24px;">
        <div style="margin-bottom:20px;">
          <h1 style="margin:0;font-size:18px;font-weight:600;color:#3d3028;">New Early Access Request</h1>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Email</span>
          <span class="detail-value">${email}</span>
        </div>
        
        ${firstName || lastName ? `
        <div class="detail-row">
          <span class="detail-label">Name</span>
          <span class="detail-value">${[firstName, lastName].filter(Boolean).join(' ')}</span>
        </div>
        ` : ''}
        
        ${firmName ? `
        <div class="detail-row">
          <span class="detail-label">Firm</span>
          <span class="detail-value">${firmName}</span>
        </div>
        ` : ''}
        
        ${firmSize ? `
        <div class="detail-row">
          <span class="detail-label">Firm Size</span>
          <span class="detail-value">${firmSize}</span>
        </div>
        ` : ''}
        
        ${role ? `
        <div class="detail-row">
          <span class="detail-label">Role</span>
          <span class="detail-value">${role}</span>
        </div>
        ` : ''}
        
        ${source ? `
        <div class="detail-row">
          <span class="detail-label">Source</span>
          <span class="detail-value">${source}</span>
        </div>
        ` : ''}
        
        <div class="timestamp">
          Submitted: ${submittedAt} (UK time)
        </div>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const result = await sendEmail({
      from: 'LegalNote Waitlist <support@legalnote.ai>',
      to: adminEmails,
      subject: `New Early Access Request: ${firmName || email}`,
      html: emailHtml,
    });

    if (!result.success) {
      console.error('[EMAIL] Error sending admin notification:', result.error);
      return { success: false, error: result.error };
    }

    console.log('[EMAIL] Admin notification sent successfully:', result.messageId);
    return { success: true };
  } catch (error: any) {
    console.error('[EMAIL] Exception sending admin notification to', adminEmails.join(', '), ':', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

/**
 * Sends a lead magnet email for "The Defensible Record". PDF attachment is optional.
 */
export async function sendLeadMagnetEmail(
  to: string, 
  firstName: string = 'there',
  pdfBuffer?: Buffer | null
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const hasPdf = Boolean(pdfBuffer && pdfBuffer.length > 0);
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: 'Georgia', serif;
          line-height: 1.7;
          color: #2a1f17;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #faf7f4;
        }
        .header {
          background: linear-gradient(135deg, #b4523b 0%, #8b3d2b 100%);
          padding: 30px;
          border-radius: 8px 8px 0 0;
          margin: -20px -20px 30px -20px;
        }
        .header h1 {
          color: #ffffff;
          margin: 0;
          font-size: 24px;
          font-weight: normal;
        }
        .header p {
          color: rgba(255,255,255,0.85);
          margin: 8px 0 0 0;
          font-size: 14px;
        }
        .content {
          background: #ffffff;
          padding: 30px;
          border-radius: 8px;
          border: 1px solid #e8e2dc;
          margin-bottom: 20px;
        }
        h2 {
          color: #2a1f17;
          font-size: 22px;
          margin-top: 0;
          font-weight: normal;
        }
        .guide-box {
          background: #faf7f4;
          border-left: 4px solid #b4523b;
          padding: 20px;
          margin: 25px 0;
        }
        .guide-box h3 {
          color: #b4523b;
          margin: 0 0 10px 0;
          font-size: 16px;
        }
        .guide-box ul {
          margin: 0;
          padding-left: 20px;
          color: #5a4a3f;
        }
        .guide-box li {
          margin-bottom: 8px;
        }
        .cta-button {
          display: inline-block;
          background: #b4523b;
          color: #ffffff !important;
          padding: 14px 32px;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 500;
          margin: 20px 0;
        }
        .footer {
          text-align: center;
          color: #8a7a6f;
          font-size: 12px;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e8e2dc;
        }
        .footer a {
          color: #b4523b;
          text-decoration: none;
        }
      </style>
    </head>
    <body>
      ${legalNoteBrandHeaderHtml()}
      <div class="content" style="margin-top:0;border-radius:0 0 8px 8px;">
        <h2>Hello ${firstName},</h2>
        
        <p>Thank you for your interest in creating better legal documentation.${hasPdf ? ' Your guide is attached to this email.' : ''}</p>
        
        <div class="guide-box">
          <h3>The Defensible Record</h3>
          <p style="margin: 0 0 12px 0; color: #5a4a3f;">A Solicitor's Guide to Creating Contemporaneous Evidence</p>
          <ul>
            <li>What makes a file note "defensible" in an SRA complaint</li>
            <li>The 3 elements every attendance note needs</li>
            <li>Common documentation gaps that expose firms to PI claims</li>
            <li>Sample attendance note template</li>
          </ul>
        </div>
        
        <p>This guide covers the practical frameworks solicitors need to create documentation that protects both the firm and its clients.</p>
        
        <p>When you're ready to automate this process, LegalNote captures consent, transcribes meetings with speaker identification, and generates professional attendance notes automatically.</p>
        
        <a href="https://legalnote.ai" class="cta-button">Learn More About LegalNote</a>
        
        <p style="margin-top: 30px;">Best regards,<br>The LegalNote Team</p>
      </div>
      
      <div class="footer">
        <p>LegalNote | Professional Legal Documentation<br>
        <a href="https://legalnote.ai">legalnote.ai</a></p>
        <p style="margin-top: 15px; font-size: 11px;">You received this email because you requested our free guide. We won't send marketing emails unless you opted in.</p>
      </div>
    </body>
    </html>
  `;

  try {
    const result = await sendEmail({
      from: 'LegalNote™ <support@legalnote.ai>',
      to,
      replyTo: 'support@legalnote.ai',
      headers: {
        'Precedence': 'bulk',
        'X-Entity-Ref-ID': Date.now().toString(),
      },
      subject: 'Your Guide: The Defensible Record',
      html: emailHtml,
    });

    if (!result.success) {
      console.error('[EMAIL] Error sending lead magnet:', result.error);
    } else {
      console.log('[EMAIL] Lead magnet sent successfully:', result.messageId);
    }

    return result;
  } catch (error: any) {
    console.error('[EMAIL] Exception sending lead magnet:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

/**
 * @deprecated DPA 11.2 — document body must never be emailed.
 * Client care letters are delivered via secure share link only
 * (`POST /api/cases/:id/send-client-care-letter` → `sendCaseEmail`).
 * This body-email path is retained as a hard failure so any residual
 * caller cannot silently reintroduce privileged content in email.
 */
export async function sendClientCareLetterEmail(_params: {
  to: string;
  clientName: string;
  firmName: string;
  letterContent: string;
  matterReference?: string;
  firmEmail?: string;
  firmPhone?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  console.error(
    "[EMAIL] sendClientCareLetterEmail blocked: document body email is prohibited (DPA 11.2). Use share-link delivery."
  );
  return {
    success: false,
    error:
      "Client care letters cannot be sent as email body content. Use the secure share-link delivery path.",
  };
}

interface SendAcknowledgementRequestParams {
  to: string;
  clientName: string;
  caseTitle: string;
  matterReference?: string;
  token: string;
  documentLabel?: string;
  firmProfile?: {
    firmName: string;
    phone?: string;
    email?: string;
  };
}

/**
 * Sends a document acknowledgement request email with a secure one-time link
 * (Client Letter or Client Care Letter).
 */
export async function sendAcknowledgementRequestEmail(
  params: SendAcknowledgementRequestParams
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const {
    to,
    clientName,
    caseTitle,
    matterReference,
    token,
    documentLabel = "Client Care Letter",
    firmProfile,
  } = params;

  const baseUrl = process.env.APP_URL?.replace(/\/$/, '') || 'https://legalnote.ai';
  const acknowledgeUrl = `${baseUrl}/acknowledge/${token}`;

  const firmName = firmProfile?.firmName || 'Your Solicitors';
  const isCareLetter = documentLabel === "Client Care Letter";
  const noticeWhy = isCareLetter
    ? "SRA regulations require us to confirm that our clients have received and understood the terms of our engagement. Your acknowledgement creates a secure record for your protection as well as ours."
    : "Your solicitor has asked you to confirm that you have received and read this letter. Your acknowledgement creates a secure record for your protection as well as theirs.";

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0; }
        .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 32px 40px; }
        .header h1 { color: #fff; margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -0.3px; }
        .header p { color: rgba(255,255,255,0.7); margin: 6px 0 0; font-size: 13px; }
        .content { padding: 36px 40px; background: #fff; }
        .content h2 { font-size: 18px; margin: 0 0 8px; color: #1a1a2e; }
        .content p { margin: 0 0 16px; color: #555; font-size: 14px; }
        .cta-btn { display: inline-block; background: #c0552a; color: #fff !important; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 15px; margin: 8px 0 24px; }
        .notice { background: #f8f6f3; border-left: 3px solid #c0552a; padding: 14px 18px; border-radius: 0 6px 6px 0; font-size: 13px; color: #555; margin: 24px 0 0; }
        .footer { padding: 20px 40px; background: #f5f5f5; font-size: 12px; color: #888; border-top: 1px solid #e8e8e8; }
        .url-fallback { word-break: break-all; color: #888; font-size: 12px; margin-top: 12px; }
      </style>
    </head>
    <body>
      ${legalNoteBrandHeaderHtml()}
      <div class="content" style="padding:36px 40px;background:#fff;">
        <p style="margin:0 0 8px;font-size:13px;color:#8a7d72;text-transform:uppercase;letter-spacing:0.06em;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${firmName} · Secure Document Portal</p>
        <h2>Your ${documentLabel} is ready</h2>
        <p>Dear ${clientName},</p>
        <p>We have prepared your ${documentLabel} in connection with the matter: <strong>${caseTitle}</strong>.${matterReference ? ` (Ref: ${matterReference})` : ''}</p>
        <p>Please click the button below to read your letter and confirm that you have received and understood its contents.</p>
        <a href="${acknowledgeUrl}" class="cta-btn">Read &amp; Acknowledge Letter</a>
        <p>This is a one-time secure link. It will remain active until you have confirmed acknowledgement.</p>
        <div class="notice">
          <strong>Why are we asking you to do this?</strong><br>
          ${noticeWhy}
        </div>
        <p class="url-fallback">If the button does not work, copy and paste this link into your browser:<br>${acknowledgeUrl}</p>
      </div>
      <div class="footer">
        <p>${firmName}${firmProfile?.phone ? ` &bull; ${firmProfile.phone}` : ''}${firmProfile?.email ? ` &bull; ${firmProfile.email}` : ''}</p>
        <p>This email was sent to ${to}. If you believe you received this in error, please contact us immediately.</p>
      </div>
    </body>
    </html>
  `;

  try {
    const result = await sendEmail({
      from: 'LegalNote <noreply@legalnote.ai>',
      to,
      subject: `Action required: Please acknowledge your ${documentLabel} — ${caseTitle}`,
      html: emailHtml,
    });

    if (!result.success) {
      console.error('[EMAIL] Error sending acknowledgement request:', result.error);
    } else {
      console.log('[EMAIL] Acknowledgement request sent successfully:', result.messageId);
    }

    return result;
  } catch (error: any) {
    console.error('[EMAIL] Exception sending acknowledgement request:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

export async function sendRiskDigestEmail(params: {
  to: string;
  firmName: string;
  digest: FirmRiskDigest;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { to, firmName, digest } = params;

  const rowStyle = 'padding: 10px 0; border-bottom: 1px solid #f0ede8;';
  const badgeStyle = (color: string) => `display:inline-block; padding:2px 8px; border-radius:3px; background:${color}; color:#fff; font-size:12px; font-weight:600;`;

  const overdueSection = digest.overdueUndertakings.length > 0 ? `
    <h3 style="color:#c0392b; margin:20px 0 10px;">Overdue Undertakings (${digest.overdueUndertakings.length})</h3>
    <table style="width:100%; border-collapse:collapse;">
      ${digest.overdueUndertakings.map(u => `
        <tr style="${rowStyle}">
          <td style="padding-right:12px;"><strong>${u.caseTitle}</strong><br/><span style="color:#666; font-size:13px;">${u.wording.slice(0, 120)}${u.wording.length > 120 ? '...' : ''}</span></td>
          <td style="white-space:nowrap; text-align:right;"><span style="${badgeStyle('#c0392b')}">${u.daysOverdue}d overdue</span></td>
        </tr>`).join('')}
    </table>` : '';

  const upcomingSection = digest.upcomingUndertakings.length > 0 ? `
    <h3 style="color:#d68910; margin:20px 0 10px;">Upcoming Undertakings — Next 7 Days (${digest.upcomingUndertakings.length})</h3>
    <table style="width:100%; border-collapse:collapse;">
      ${digest.upcomingUndertakings.map(u => `
        <tr style="${rowStyle}">
          <td><strong>${u.caseTitle}</strong><br/><span style="color:#666; font-size:13px;">${u.wording.slice(0, 120)}${u.wording.length > 120 ? '...' : ''}</span></td>
          <td style="white-space:nowrap; text-align:right;"><span style="${badgeStyle('#d68910')}">${u.daysUntil}d</span></td>
        </tr>`).join('')}
    </table>` : '';

  const amlSection = digest.highAmlCases.length > 0 ? `
    <h3 style="color:#884ea0; margin:20px 0 10px;">High/Medium AML Risk — No Recent Review (${digest.highAmlCases.length})</h3>
    <table style="width:100%; border-collapse:collapse;">
      ${digest.highAmlCases.map(c => `
        <tr style="${rowStyle}">
          <td><strong>${c.title}</strong>${c.clientName ? ` &mdash; ${c.clientName}` : ''}</td>
          <td style="white-space:nowrap; text-align:right;"><span style="${badgeStyle(c.riskLevel === 'high' ? '#c0392b' : '#d68910')}">${c.riskLevel.toUpperCase()}</span></td>
        </tr>`).join('')}
    </table>` : '';

  const cclSection = digest.unacknowledgedLetters.length > 0 ? `
    <h3 style="color:#1a5276; margin:20px 0 10px;">Unacknowledged Client Care Letters (${digest.unacknowledgedLetters.length})</h3>
    <table style="width:100%; border-collapse:collapse;">
      ${digest.unacknowledgedLetters.map(l => `
        <tr style="${rowStyle}">
          <td><strong>${l.caseTitle}</strong>${l.clientName ? ` &mdash; ${l.clientName}` : ''}</td>
          <td style="white-space:nowrap; text-align:right; color:#666; font-size:13px;">Sent ${new Date(l.sentAt).toLocaleDateString('en-GB')}</td>
        </tr>`).join('')}
    </table>` : '';

  const docSection = digest.missingSessions.length > 0 ? `
    <h3 style="color:#117a65; margin:20px 0 10px;">Matters With Undocumented Sessions (${digest.missingSessions.length})</h3>
    <table style="width:100%; border-collapse:collapse;">
      ${digest.missingSessions.map(m => `
        <tr style="${rowStyle}">
          <td><strong>${m.caseTitle}</strong></td>
          <td style="white-space:nowrap; text-align:right; color:#666; font-size:13px;">${m.documentedSessions}/${m.completedSessions} documented</td>
        </tr>`).join('')}
    </table>` : '';

  const allClear = digest.totalIssues === 0 ? '<p style="color:#117a65; font-weight:600;">No outstanding compliance issues this week.</p>' : '';

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>Weekly Risk Digest</title></head>
    <body style="font-family: Georgia, serif; max-width: 680px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a; background: #fafaf8;">
      ${legalNoteBrandHeaderHtml()}
      <div style="border-bottom: 3px solid #8b4513; padding: 20px 0; margin-bottom: 28px;">
        <p style="color:#8b4513; font-size:12px; text-transform:uppercase; letter-spacing:1px; margin:0 0 6px;">Weekly Risk Digest</p>
        <h1 style="margin:0; font-size:22px; font-weight:700;">${firmName}</h1>
        <p style="margin:6px 0 0; color:#666; font-size:13px;">Week ending ${new Date(digest.generatedAt).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      <div style="background:#f5f0ea; border-radius:6px; padding:16px 20px; margin-bottom:24px;">
        <strong style="font-size:16px;">${digest.totalIssues} item${digest.totalIssues !== 1 ? 's' : ''} requiring attention</strong>
        ${digest.totalIssues === 0 ? ' &mdash; all clear this week.' : ''}
      </div>

      ${allClear}
      ${overdueSection}
      ${upcomingSection}
      ${amlSection}
      ${cclSection}
      ${docSection}

      <div style="margin-top:36px; padding-top:20px; border-top:1px solid #e8e0d8; color:#999; font-size:12px;">
        <p>This digest was produced by LegalNote. Log in to your dashboard to take action on these items.</p>
        <p>${firmName}</p>
      </div>
    </body>
    </html>
  `;

  try {
    const result = await sendEmail({
      from: 'LegalNote Compliance <noreply@legalnote.ai>',
      to,
      subject: `Weekly Risk Digest — ${digest.totalIssues} item${digest.totalIssues !== 1 ? 's' : ''} — ${firmName}`,
      html: emailHtml,
    });

    if (!result.success) {
      console.error('[EMAIL] Error sending risk digest:', result.error);
    } else {
      console.log('[EMAIL] Risk digest sent successfully:', result.messageId);
    }

    return result;
  } catch (error: any) {
    console.error('[EMAIL] Exception sending risk digest:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

interface SendInvitationEmailParams {
  to: string;
  invitingUserName: string;
  firmName: string;
  suggestedRole?: string | null;
  inviteToken: string;
}

/**
 * Sends a team invitation email to a prospective team member
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function sendInvitationEmail(params: SendInvitationEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { to, invitingUserName, firmName, suggestedRole, inviteToken } = params;

  const baseUrl = process.env.APP_URL?.replace(/\/$/, '') || 'https://legalnote.ai';

  const acceptUrl = `${baseUrl}/invite/accept/${inviteToken}`;

  const safeInvitingName = escapeHtml(invitingUserName);
  const safeFirmName = escapeHtml(firmName);
  const safeRole = suggestedRole ? escapeHtml(suggestedRole) : null;
  const safeEmail = escapeHtml(to);

  const roleText = safeRole ? `<p>You have been invited to join as: <strong>${safeRole}</strong></p>` : '';

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
        .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        .body { padding: 32px; }
        .cta-btn { display: inline-block; background: #c97d4d; color: #fff !important; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 15px; margin: 24px 0; }
        .notice { background: #faf8f5; border-radius: 6px; padding: 16px; margin-top: 24px; font-size: 13px; color: #555; }
        .url-fallback { font-size: 12px; color: #888; word-break: break-all; margin-top: 16px; }
        .footer { padding: 20px 32px; background: #f8f8f8; border-top: 1px solid #eee; font-size: 12px; color: #999; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        ${legalNoteBrandHeaderHtml()}
        <div style="padding: 24px 32px; border-bottom: 1px solid #e8e4df; text-align: center;">
          <p style="margin: 0; font-size: 14px; color: #8a7d72; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Team Invitation</p>
        </div>
        <div class="body">
          <p>Hello,</p>
          <p><strong>${safeInvitingName}</strong> has invited you to join <strong>${safeFirmName}</strong> on LegalNote, the UK law firm compliance and case management platform.</p>
          ${roleText}
          <p>Click the button below to accept the invitation and set up your account. Once accepted, a firm administrator will activate your account before you gain full access.</p>
          <a href="${acceptUrl}" class="cta-btn">Accept Invitation</a>
          <div class="notice">
            <strong>This invitation expires in 7 days.</strong><br>
            If you were not expecting this invitation, you can safely ignore this email. No account will be created without your action.
          </div>
          <p class="url-fallback">If the button does not work, copy and paste this link into your browser:<br>${acceptUrl}</p>
        </div>
        <div class="footer">
          <p>${safeFirmName} via LegalNote &bull; legalnote.app</p>
          <p>This email was sent to ${safeEmail}. If you believe you received this in error, please disregard it.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const result = await sendEmail({
      from: 'LegalNote <invitations@legalnote.ai>',
      to,
      replyTo: 'support@legalnote.ai',
      subject: `You have been invited to join ${firmName} on LegalNote`,
      html: emailHtml,
    });

    if (!result.success) {
      console.error('[EMAIL] Error sending invitation email:', result.error);
    } else {
      console.log('[EMAIL] Invitation email sent successfully:', result.messageId);
    }

    return result;
  } catch (error: any) {
    console.error('[EMAIL] Exception sending invitation email:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

interface SendMeetingReminderEmailParams {
  to: string;
  recipientName?: string;
  meetingTitle: string;
  startTime: Date;
  minutesBefore: 30 | 10;
  meetingUrl?: string;
  meetingPlatform?: string;
  caseTitle?: string;
}

/**
 * Sends a solicitor-facing reminder email 30 or 10 minutes before a synced calendar meeting.
 */
export async function sendMeetingReminderEmail(
  params: SendMeetingReminderEmailParams
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const {
    to,
    recipientName,
    meetingTitle,
    startTime,
    minutesBefore,
    meetingUrl,
    meetingPlatform,
    caseTitle,
  } = params;

  const baseUrl = process.env.APP_URL?.replace(/\/$/, '') || 'https://legalnote.ai';
  const safeName = escapeHtml(recipientName || 'there');
  const safeTitle = escapeHtml(meetingTitle);
  const safeCase = caseTitle ? escapeHtml(caseTitle) : null;
  const safePlatform = meetingPlatform ? escapeHtml(meetingPlatform) : null;
  const when = startTime.toLocaleString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/London',
  });
  const subject = `Meeting in ${minutesBefore} minutes: ${meetingTitle}`;

  const joinBlock = meetingUrl
    ? `<p style="margin: 24px 0;"><a href="${escapeHtml(meetingUrl)}" style="display:inline-block;background:#1e3a5f;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;">Join meeting${safePlatform ? ` (${safePlatform})` : ''}</a></p>
       <p style="font-size:12px;color:#888;word-break:break-all;">${escapeHtml(meetingUrl)}</p>`
    : `<p style="color:#666;">No meeting link is stored yet — open LegalNote to add or check the calendar invite.</p>`;

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5;">
      <div style="max-width: 600px; margin: 40px auto; background: #fff; border-radius: 8px; overflow: hidden;">
        ${legalNoteBrandHeaderHtml()}
        <div style="padding: 28px 32px; border-bottom: 1px solid #e8e4df;">
          <h1 style="margin: 0; font-size: 22px; color: #3d3028;">Meeting reminder</h1>
          <p style="margin: 8px 0 0; color: #8a7d72; font-size: 14px;">Starts in ${minutesBefore} minutes</p>
        </div>
        <div style="padding: 32px;">
          <p>Hi ${safeName},</p>
          <p>This is a reminder that the following meeting from your LegalNote Upcoming Meetings list starts soon:</p>
          <div style="background: #f0f4f8; border-radius: 6px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0 0 8px;"><strong>${safeTitle}</strong></p>
            <p style="margin: 0; color: #555;">${escapeHtml(when)} (UK time)</p>
            ${safeCase ? `<p style="margin: 8px 0 0; color: #555;">Matter: ${safeCase}</p>` : ''}
          </div>
          ${joinBlock}
          <p style="margin-top: 24px;"><a href="${baseUrl}/" style="color: #1e3a5f;">Open LegalNote dashboard</a></p>
        </div>
        <div style="padding: 16px 32px; background: #f8f8f8; font-size: 12px; color: #999; text-align: center;">
          You received this because the meeting is synced in LegalNote Upcoming Meetings.
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const result = await sendEmail({
      from: 'LegalNote <noreply@legalnote.ai>',
      to,
      subject,
      html: emailHtml,
    });

    if (!result.success) {
      console.error('[EMAIL] Failed to send meeting reminder:', result.error);
    } else {
      console.log('[EMAIL] Meeting reminder sent:', result.messageId, `(${minutesBefore}m)`);
    }

    return result;
  } catch (error: any) {
    console.error('[EMAIL] Exception sending meeting reminder:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

function escapeHtmlEmail(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getLegalNoteEmailBaseUrl(): string {
  return process.env.APP_URL?.replace(/\/$/, '') || 'https://legalnote.ai';
}

/**
 * Shared LegalNote platform shell — text wordmark header, warm brand palette, registered-office footer.
 * Used for DPA / legal agreement emails (and aligned with waitlist branding).
 */
function wrapLegalNoteBrandedEmail(opts: {
  eyebrow: string;
  bodyHtml: string;
  footerNote: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: Georgia, 'Times New Roman', serif;
          line-height: 1.7;
          color: #2d2520;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #faf9f7;
        }
        .container {
          background: #ffffff;
          border-radius: 8px;
          padding: 0;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .eyebrow {
          margin: 16px 0 0;
          text-align: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #8a7d72;
        }
        .content {
          padding: 8px 32px 32px;
        }
        .content h2 {
          font-size: 20px;
          margin: 0 0 16px;
          color: #3d3028;
          font-weight: 600;
        }
        .content p {
          margin: 0 0 16px;
          color: #4a3f35;
          font-size: 15px;
        }
        .cta-btn {
          display: inline-block;
          background: #c97d4d;
          color: #ffffff !important;
          padding: 12px 24px;
          border-radius: 6px;
          text-decoration: none;
          font-weight: 600;
          font-size: 15px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          margin: 8px 8px 8px 0;
        }
        .cta-btn-secondary {
          background: #3d3028;
        }
        .notice {
          background: #faf8f5;
          border-left: 3px solid #c97d4d;
          padding: 14px 18px;
          margin: 24px 0 0;
          font-size: 13px;
          color: #4a3f35;
        }
        .meta {
          background: #faf8f5;
          border: 1px solid #e8e4df;
          padding: 16px 18px;
          border-radius: 8px;
          font-size: 13px;
          color: #4a3f35;
          margin: 16px 0 24px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .meta code {
          font-size: 11px;
          word-break: break-all;
          color: #3d3028;
        }
        .url-fallback {
          word-break: break-all;
          color: #8a7d72;
          font-size: 12px;
          margin-top: 16px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .footer {
          margin-top: 32px;
          padding-top: 16px;
          border-top: 1px solid #e8e4df;
          font-size: 12px;
          color: #8a7d72;
          text-align: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .footer p { margin: 0 0 6px; }
      </style>
    </head>
    <body>
      <div class="container">
        ${legalNoteBrandHeaderHtml()}
        <p class="eyebrow">${opts.eyebrow}</p>
        <div class="content">
          ${opts.bodyHtml}
        </div>
        <div class="footer" style="padding:0 32px 32px;">
          <p>${opts.footerNote}</p>
          <p>LegalNote\u2122 \u2014 Compliance-first legal documentation</p>
          <p>LegalNote Technologies Ltd &bull; <a href="https://legalnote.ai" style="color:#8a7d72;">legalnote.ai</a></p>
          <p>Registered Office: 71-75 Shelton Street, Covent Garden, London, WC2H 9JQ</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Step 1 → Step 2: email confirmation link so the signatory proves inbox control.
 */
export async function sendDpaConfirmationEmail(params: {
  to: string;
  firmName: string;
  signerName: string;
  confirmationToken: string;
  evaluationPeriodDays: number;
  feeEarnerCount: number;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const baseUrl = getLegalNoteEmailBaseUrl();
  const confirmUrl = `${baseUrl}/dpa/confirm/${params.confirmationToken}`;
  const safeFirm = escapeHtmlEmail(params.firmName);
  const safeName = escapeHtmlEmail(params.signerName);
  const safeTo = escapeHtmlEmail(params.to);

  const emailHtml = wrapLegalNoteBrandedEmail({
    eyebrow: 'Agreement confirmation',
    footerNote: `This email was sent to ${safeTo}.`,
    bodyHtml: `
      <h2>Confirm your email to accept</h2>
      <p>Dear ${safeName},</p>
      <p>You requested to accept LegalNote&apos;s Data Processing Agreement and Governed Evaluation Agreement on behalf of <strong>${safeFirm}</strong>.</p>
      <p>Key Terms offered: Evaluation Period of <strong>${params.evaluationPeriodDays} days</strong>; Fee Earner Count of <strong>${params.feeEarnerCount}</strong>.</p>
      <p>Click below to review both agreements and complete acceptance. This confirms you control this email address.</p>
      <p style="text-align:center;margin:28px 0;">
        <a href="${confirmUrl}" class="cta-btn">Review &amp; Accept Agreements</a>
      </p>
      <div class="notice">
        <strong>This link expires in 72 hours.</strong><br>
        If you did not request this, you can ignore this email. No agreement is formed until you affirmatively accept on the confirmation page.
      </div>
      <p class="url-fallback">If the button does not work, copy and paste this link into your browser:<br>${confirmUrl}</p>
      <p style="margin-top:28px;">Kind regards,<br><strong>LegalNote</strong></p>
    `,
  });

  try {
    const result = await sendEmail({
      from: 'LegalNote\u2122 <noreply@legalnote.ai>',
      to: params.to,
      replyTo: 'legal@legalnote.ai',
      subject: 'Confirm your email to accept the LegalNote DPA and Evaluation Agreement',
      html: emailHtml,
    });
    if (!result.success) {
      console.error('[EMAIL] Error sending DPA confirmation:', result.error);
    } else {
      console.log('[EMAIL] DPA confirmation sent:', result.messageId);
    }
    return result;
  } catch (error: any) {
    console.error('[EMAIL] Exception sending DPA confirmation:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

/**
 * Executed copy after acceptance — HTML certificate links (no attachment).
 */
export async function sendLegalAgreementAcceptedEmail(params: {
  to: string;
  firmName: string;
  signerName: string;
  signerTitle: string;
  evaluationPeriodDays: number;
  feeEarnerCount: number;
  acceptedAt: Date;
  acceptanceId: string;
  dpaContentHash: string;
  evaluationContentHash: string;
  verifyToken: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const baseUrl = getLegalNoteEmailBaseUrl();
  const certificateUrl = `${baseUrl}/legal/acceptance/${params.acceptanceId}?token=${encodeURIComponent(params.verifyToken)}`;
  const verifyUrl = `${baseUrl}/api/legal-acceptances/${params.acceptanceId}/verify?token=${encodeURIComponent(params.verifyToken)}`;
  const acceptedUtc = params.acceptedAt.toISOString();
  const safeTo = escapeHtmlEmail(params.to);

  const emailHtml = wrapLegalNoteBrandedEmail({
    eyebrow: 'Executed acceptance certificate',
    footerNote: `This email was sent to ${safeTo}. Contact legal@legalnote.ai with questions.`,
    bodyHtml: `
      <h2>Agreements accepted</h2>
      <p>Dear ${escapeHtmlEmail(params.signerName)},</p>
      <p>This email confirms that <strong>${escapeHtmlEmail(params.firmName)}</strong> has accepted LegalNote&apos;s Data Processing Agreement and Governed Evaluation Agreement.</p>
      <div class="meta">
        <p style="margin:0 0 8px"><strong>Signatory:</strong> ${escapeHtmlEmail(params.signerName)}, ${escapeHtmlEmail(params.signerTitle)}</p>
        <p style="margin:0 0 8px"><strong>Accepted at (UTC):</strong> ${acceptedUtc}</p>
        <p style="margin:0 0 8px"><strong>Evaluation Period:</strong> ${params.evaluationPeriodDays} days</p>
        <p style="margin:0 0 8px"><strong>Fee Earner Count:</strong> ${params.feeEarnerCount}</p>
        <p style="margin:0 0 8px"><strong>Acceptance ID:</strong> <code>${escapeHtmlEmail(params.acceptanceId)}</code></p>
        <p style="margin:0 0 8px"><strong>DPA content hash:</strong> <code>${escapeHtmlEmail(params.dpaContentHash)}</code></p>
        <p style="margin:0"><strong>Evaluation content hash:</strong> <code>${escapeHtmlEmail(params.evaluationContentHash)}</code></p>
      </div>
      <p>LegalNote retains the exact text corresponding to each hash so the accepted version can be reproduced.</p>
      <p style="text-align:center;margin:28px 0;">
        <a href="${certificateUrl}" class="cta-btn">View certificate</a>
        <a href="${verifyUrl}" class="cta-btn cta-btn-secondary">Verify record</a>
      </p>
      <p style="margin-top:28px;">Kind regards,<br><strong>LegalNote</strong></p>
    `,
  });

  try {
    const result = await sendEmail({
      from: 'LegalNote\u2122 <noreply@legalnote.ai>',
      to: params.to,
      replyTo: 'legal@legalnote.ai',
      subject: 'LegalNote — Executed DPA and Evaluation Agreement acceptance',
      html: emailHtml,
    });
    if (!result.success) {
      console.error('[EMAIL] Error sending acceptance certificate:', result.error);
    } else {
      console.log('[EMAIL] Acceptance certificate sent:', result.messageId);
    }
    return result;
  } catch (error: any) {
    console.error('[EMAIL] Exception sending acceptance certificate:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

/**
 * Invite a provisioned governed-evaluation lead to sign in for the first time.
 * On first login they claim the reserved firm lead seat.
 */
export async function sendGovernedEvaluationLoginInviteEmail(params: {
  to: string;
  firmName: string;
  seatLimit?: number | null;
  evaluationEndsAt?: Date | null;
  invitedByName?: string | null;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const baseUrl = getLegalNoteEmailBaseUrl();
  const loginUrl = `${baseUrl}/login`;
  const safeTo = escapeHtmlEmail(params.to);
  const safeFirm = escapeHtmlEmail(params.firmName);
  const invitedBy = params.invitedByName
    ? escapeHtmlEmail(params.invitedByName)
    : null;

  const detailLines: string[] = [
    `<p style="margin:0 0 8px"><strong>Firm:</strong> ${safeFirm}</p>`,
    `<p style="margin:0 0 8px"><strong>Sign-in email:</strong> ${safeTo}</p>`,
  ];
  if (params.seatLimit != null && params.seatLimit > 0) {
    detailLines.push(
      `<p style="margin:0 0 8px"><strong>Seats:</strong> ${params.seatLimit}</p>`,
    );
  }
  if (params.evaluationEndsAt) {
    const endsDisplay = params.evaluationEndsAt.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    detailLines.push(
      `<p style="margin:0"><strong>Evaluation ends:</strong> ${escapeHtmlEmail(endsDisplay)}</p>`,
    );
  } else {
    // Keep last row without bottom margin when no end date
    detailLines[detailLines.length - 1] = detailLines[detailLines.length - 1].replace(
      'margin:0 0 8px',
      'margin:0',
    );
  }

  const emailHtml = wrapLegalNoteBrandedEmail({
    eyebrow: 'Evaluation invitation',
    footerNote: `This email was sent to ${safeTo}. Contact jazz.dennis@legalnote.ai if you are not the right person.`,
    bodyHtml: `
      <h2>Your evaluation account is ready</h2>
      ${
        invitedBy
          ? `<p>${invitedBy} has reserved a governed evaluation on LegalNote for <strong>${safeFirm}</strong>.</p>`
          : `<p>A governed evaluation on LegalNote has been reserved for <strong>${safeFirm}</strong>.</p>`
      }
      <p>Please sign in with Google or Microsoft using <strong>${safeTo}</strong>. On first login you become the firm lead and can invite colleagues within your seat allocation.</p>
      <div class="meta">
        ${detailLines.join('\n        ')}
      </div>
      <p style="text-align:center;margin:28px 0;">
        <a href="${loginUrl}" class="cta-btn">Sign in to LegalNote</a>
      </p>
      <div class="notice">
        <strong>Please use this exact email address when signing in.</strong><br>
        A different Google or Microsoft account will not claim the reserved firm.
      </div>
      <p class="url-fallback">If the button does not work, copy and paste this link into your browser:<br>${loginUrl}</p>
      <p style="margin-top:28px;">Kind regards,<br><strong>LegalNote</strong></p>
    `,
  });

  try {
    const result = await sendEmail({
      from: 'LegalNote\u2122 <noreply@legalnote.ai>',
      to: params.to,
      replyTo: 'jazz.dennis@legalnote.ai',
      subject: 'LegalNote evaluation — your account is ready',
      html: emailHtml,
    });
    if (!result.success) {
      console.error('[EMAIL] Error sending governed evaluation login invite:', result.error);
    } else {
      console.log('[EMAIL] Governed evaluation login invite sent:', result.messageId);
    }
    return result;
  } catch (error: any) {
    console.error('[EMAIL] Exception sending governed evaluation login invite:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

/**
 * After acceptance: ask the firm to complete evaluation configuration details.
 */
export async function sendEvaluationSetupEmail(params: {
  to: string;
  firmName: string;
  signerName: string;
  setupToken: string;
  feeEarnerCount: number;
  evaluationPeriodDays: number;
  expiresAt: Date;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const baseUrl = getLegalNoteEmailBaseUrl();
  const setupUrl = `${baseUrl}/evaluation/setup/${params.setupToken}`;
  const expiresDisplay = params.expiresAt.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const emailHtml = wrapLegalNoteBrandedEmail({
    eyebrow: 'Evaluation setup',
    footerNote: `This email was sent to ${escapeHtmlEmail(params.to)}. Contact jazz.dennis@legalnote.ai if you are not the right person.`,
    bodyHtml: `
      <h2>Next step: configure your evaluation</h2>
      <p>Dear ${escapeHtmlEmail(params.signerName)},</p>
      <p>Thank you — <strong>${escapeHtmlEmail(params.firmName)}</strong> has accepted LegalNote&apos;s Data Processing Agreement and Governed Evaluation Agreement.</p>
      <p>The evaluation period (<strong>${params.evaluationPeriodDays} days</strong>, up to <strong>${params.feeEarnerCount} fee earner${params.feeEarnerCount === 1 ? '' : 's'}</strong>) starts on the <strong>configuration date</strong>, not the acceptance date. We need a few operational details before we can configure the account and book your guided first-use session.</p>
      <p style="text-align:center;margin:28px 0;">
        <a href="${setupUrl}" class="cta-btn">Complete evaluation setup</a>
      </p>
      <div class="notice">
        <strong>Please complete within 5 working days where possible.</strong><br>
        This link expires on ${expiresDisplay}. If you are not responsible for onboarding, forward this email to the right person or reply and we will reissue the link.
      </div>
      <p class="url-fallback">If the button does not work, copy and paste this link into your browser:<br>${setupUrl}</p>
      <p style="margin-top:28px;">Kind regards,<br><strong>LegalNote</strong></p>
    `,
  });

  try {
    const result = await sendEmail({
      from: 'LegalNote\u2122 <noreply@legalnote.ai>',
      to: params.to,
      replyTo: 'jazz.dennis@legalnote.ai',
      subject: 'LegalNote evaluation — setup details needed',
      html: emailHtml,
    });
    if (!result.success) {
      console.error('[EMAIL] Error sending evaluation setup:', result.error);
    } else {
      console.log('[EMAIL] Evaluation setup sent:', result.messageId);
    }
    return result;
  } catch (error: any) {
    console.error('[EMAIL] Exception sending evaluation setup:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

/**
 * Notify LegalNote when a firm submits evaluation setup answers.
 */
export async function sendEvaluationSetupSubmittedAdminEmail(params: {
  firmName: string;
  signerEmail: string;
  setupId: string;
  acceptanceId: string;
  onboardingOwnerName: string;
  onboardingOwnerEmail: string;
  primaryAdminEmail: string;
  feeEarnerCount: number;
  feeEarnersNominated: number;
  preferredGoLive: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const emailHtml = wrapLegalNoteBrandedEmail({
    eyebrow: 'Admin — evaluation setup received',
    footerNote: 'Internal notification.',
    bodyHtml: `
      <h2>Setup submitted</h2>
      <p><strong>${escapeHtmlEmail(params.firmName)}</strong> has completed the evaluation configuration form.</p>
      <div class="meta">
        <p style="margin:0 0 8px"><strong>Onboarding owner:</strong> ${escapeHtmlEmail(params.onboardingOwnerName)} &lt;${escapeHtmlEmail(params.onboardingOwnerEmail)}&gt;</p>
        <p style="margin:0 0 8px"><strong>Primary admin:</strong> ${escapeHtmlEmail(params.primaryAdminEmail)}</p>
        <p style="margin:0 0 8px"><strong>Fee earners nominated:</strong> ${params.feeEarnersNominated} / ${params.feeEarnerCount}</p>
        <p style="margin:0 0 8px"><strong>Preferred go-live:</strong> ${escapeHtmlEmail(params.preferredGoLive)}</p>
        <p style="margin:0 0 8px"><strong>Signer email:</strong> ${escapeHtmlEmail(params.signerEmail)}</p>
        <p style="margin:0 0 8px"><strong>Acceptance ID:</strong> <code>${escapeHtmlEmail(params.acceptanceId)}</code></p>
        <p style="margin:0"><strong>Setup ID:</strong> <code>${escapeHtmlEmail(params.setupId)}</code></p>
      </div>
      <p>Configure the tenant, then confirm the configuration date to the firm in writing.</p>
    `,
  });

  try {
    const result = await sendEmail({
      from: 'LegalNote\u2122 <noreply@legalnote.ai>',
      to: 'support@legalnote.ai',
      replyTo: params.onboardingOwnerEmail,
      subject: `Evaluation setup received — ${params.firmName}`,
      html: emailHtml,
    });
    if (!result.success) {
      console.error('[EMAIL] Error sending setup admin notify:', result.error);
    }
    return result;
  } catch (error: any) {
    console.error('[EMAIL] Exception sending setup admin notify:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

