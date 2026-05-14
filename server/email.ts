import { Resend } from 'resend';
import type { FirmRiskDigest } from './storage';

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY environment variable is not set');
}

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendCaseEmailParams {
  to: string;
  caseTitle: string;
  clientName: string;
  matterReference?: string;
  shareLinkId: string;
  customMessage?: string;
  firmProfile?: {
    firmName: string;
    phone?: string;
    email?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    postcode?: string;
  };
}

/**
 * Sends a professional email to a client with secure share link for document access
 */
export async function sendCaseEmail(params: SendCaseEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const {
    to,
    caseTitle,
    clientName,
    matterReference,
    shareLinkId,
    customMessage,
    firmProfile
  } = params;

  // Construct the secure share link URL (publicly accessible, no authentication required)
  const baseUrl = process.env.APP_URL?.replace(/\/$/, '') || 'https://legalnote.ai';
  const shareUrl = `${baseUrl}/share/${shareLinkId}`;

  // Build email HTML content
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
        }
        .header {
          border-bottom: 3px solid #000;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .firm-name {
          font-size: 20px;
          font-weight: bold;
          margin-bottom: 10px;
        }
        .firm-details {
          font-size: 12px;
          color: #666;
          line-height: 1.4;
        }
        .content {
          margin-bottom: 30px;
        }
        .case-details {
          background-color: #f5f5f5;
          padding: 15px;
          border-radius: 5px;
          margin: 20px 0;
        }
        .case-details strong {
          display: block;
          margin-bottom: 5px;
        }
        .cta-button {
          display: inline-block;
          background-color: #000;
          color: #fff;
          padding: 12px 30px;
          text-decoration: none;
          border-radius: 5px;
          font-weight: bold;
          margin: 20px 0;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
          font-size: 12px;
          color: #666;
        }
      </style>
    </head>
    <body>
      ${firmProfile?.firmName ? `
        <div class="header">
          <div class="firm-name">${firmProfile.firmName}</div>
          <div class="firm-details">
            ${firmProfile.addressLine1 ? `${firmProfile.addressLine1}<br>` : ''}
            ${firmProfile.addressLine2 ? `${firmProfile.addressLine2}<br>` : ''}
            ${firmProfile.city || firmProfile.postcode ? `${firmProfile.city || ''} ${firmProfile.postcode || ''}<br>` : ''}
            ${firmProfile.phone ? `Tel: ${firmProfile.phone}<br>` : ''}
            ${firmProfile.email ? `Email: ${firmProfile.email}` : ''}
          </div>
        </div>
      ` : ''}

      <div class="content">
        <p>Dear ${clientName},</p>

        ${customMessage ? `<p>${customMessage.replace(/\n/g, '<br>')}</p>` : `
          <p>We are pleased to provide you with access to your case documents.</p>
        `}

        <div class="case-details">
          <strong>Case Details:</strong>
          <p style="margin: 5px 0;">
            <strong>Case:</strong> ${caseTitle}<br>
            <strong>Client:</strong> ${clientName}
            ${matterReference ? `<br><strong>Matter Reference:</strong> ${matterReference}` : ''}
          </p>
        </div>

        <p>You can view your case documents by clicking the button below:</p>

        <a href="${shareUrl}" class="cta-button">View Case Documents</a>

        <p style="font-size: 12px; color: #666;">
          If the button above doesn't work, copy and paste this link into your browser:<br>
          <a href="${shareUrl}">${shareUrl}</a>
        </p>

        <p>If you have any questions or require further assistance, please don't hesitate to contact us.</p>

        <p>Kind regards,<br>
        ${firmProfile?.firmName || 'Your Legal Team'}</p>
      </div>

      <div class="footer">
        <p>This email contains confidential information intended only for ${clientName}. 
        If you are not the intended recipient, please delete this email and notify us immediately.</p>
        ${firmProfile?.firmName ? `<p>&copy; ${new Date().getFullYear()} ${firmProfile.firmName}. All rights reserved.</p>` : ''}
      </div>
    </body>
    </html>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: 'LegalNote™ <support@legalnote.ai>', // Use verified domain in production
      to: [to],
      subject: `Case Documents - ${clientName}${matterReference ? ` (${matterReference})` : ''}`,
      html: emailHtml,
    });

    if (error) {
      console.error('Error sending email via Resend:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
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
          padding: 30px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
          text-align: center;
          padding-bottom: 20px;
          margin-bottom: 25px;
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
        <div class="header">
          <div class="success-icon">
            <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
          </div>
          <h1>Recording Successfully Saved</h1>
        </div>

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
    </body>
    </html>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: 'LegalNote™ <support@legalnote.ai>',
      to: [to],
      subject: `Recording Saved - ${clientName}${matterReference ? ` (${matterReference})` : ''} - ${formattedDate}`,
      html: emailHtml,
    });

    if (error) {
      console.error('[EMAIL] Error sending recording confirmation via Resend:', error);
      return { success: false, error: error.message };
    }

    console.log('[EMAIL] Recording confirmation sent successfully:', data?.id);
    return { success: true, messageId: data?.id };
  } catch (error: any) {
    console.error('[EMAIL] Exception sending recording confirmation:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

interface SendPreConsentEmailParams {
  to: string;
  recipientName: string;
  subject: string;
  body: string;
  consentUrl: string;
}

export async function sendPreConsentEmail(params: SendPreConsentEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { to, recipientName, subject, body, consentUrl } = params;

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
          padding: 32px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        .header {
          border-bottom: 2px solid #000;
          padding-bottom: 16px;
          margin-bottom: 24px;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
        }
        .content {
          white-space: pre-wrap;
          margin-bottom: 24px;
        }
        .cta-button {
          display: inline-block;
          background: #000;
          color: #fff;
          padding: 14px 28px;
          border-radius: 6px;
          text-decoration: none;
          font-weight: 500;
          margin: 16px 0;
        }
        .cta-button:hover {
          background: #333;
        }
        .footer {
          margin-top: 32px;
          padding-top: 16px;
          border-top: 1px solid #e5e5e5;
          font-size: 12px;
          color: #666;
        }
        .notice {
          background: #f8f9fa;
          border-radius: 6px;
          padding: 16px;
          margin: 24px 0;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Recording Consent Request</h1>
        </div>
        
        <div class="content">${body.replace(/\n/g, '<br>')}</div>
        
        <div style="text-align: center;">
          <a href="${consentUrl}" class="cta-button">Provide Consent</a>
        </div>
        
        <div class="notice">
          <strong>What happens next?</strong><br>
          By clicking "Provide Consent", you acknowledge that the meeting may be recorded for the purpose of creating accurate legal documentation. The recording will be stored securely and processed in compliance with GDPR.
        </div>
        
        <p style="font-size: 13px; color: #666;">
          If the button above doesn't work, copy and paste this link into your browser:<br>
          <a href="${consentUrl}">${consentUrl}</a>
        </p>
        
        <div class="footer">
          <p>This email was sent by LegalNote on behalf of your legal representative.</p>
          <p>If you did not expect this email, please contact your legal representative.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: 'LegalNote™ <support@legalnote.ai>',
      to: [to],
      subject,
      html: emailHtml,
    });

    if (error) {
      console.error('[EMAIL] Error sending pre-consent email via Resend:', error);
      return { success: false, error: error.message };
    }

    console.log('[EMAIL] Pre-consent email sent successfully:', data?.id);
    return { success: true, messageId: data?.id };
  } catch (error: any) {
    console.error('[EMAIL] Exception sending pre-consent email:', error);
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
      <div style="background: white; border-radius: 8px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
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
    </body>
    </html>
  `;

  const subject = responseStatus === 'granted'
    ? `Consent Granted: ${clientName} has approved recording`
    : responseStatus === 'declined'
    ? `Consent Declined: ${clientName} has declined recording`
    : `Reschedule Requested: ${clientName} has requested a new time`;

  try {
    const { data, error } = await resend.emails.send({
      from: 'LegalNote™ <support@legalnote.ai>',
      to: [to],
      subject,
      html: emailHtml,
    });

    if (error) {
      console.error('[EMAIL] Error sending consent response notification:', error);
      return { success: false, error: error.message };
    }

    console.log('[EMAIL] Consent response notification sent successfully:', data?.id);
    return { success: true, messageId: data?.id };
  } catch (error: any) {
    console.error('[EMAIL] Exception sending consent response notification:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

export async function sendWaitlistConfirmationEmail(to: string, firstName: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[EMAIL] RESEND_API_KEY not configured, skipping waitlist confirmation email');
    return { success: false, error: 'Email service not configured' };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const emailBaseUrl = process.env.APP_URL?.replace(/\/$/, '') || 'https://legalnote.ai';
  const logoUrl = `${emailBaseUrl}/assets/email/legalnote-wordmark.png`;
  const logoHtml = `<img src="${logoUrl}" alt="LegalNote" style="height: 36px; width: auto;" />`;

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
          padding: 32px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .header {
          text-align: center;
          padding-bottom: 20px;
          margin-bottom: 24px;
          border-bottom: 1px solid #e8e4df;
        }
        .content {
          margin-bottom: 24px;
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
        <div class="header">
          ${logoHtml}
        </div>
        
        <div class="content">
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
        </div>
        
        <div class="footer">
          <p>You received this email because you registered for early access to LegalNote.</p>
          <p>LegalNote\u2122 \u2014 Compliance-first legal documentation</p>
          <p>Registered Office: 71-75 Shelton Street, Covent Garden, London, WC2H 9JQ</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: 'LegalNote\u2122 <support@legalnote.ai>',
      to: [to],
      reply_to: 'support@legalnote.ai',
      headers: {
        'Precedence': 'bulk',
        'X-Entity-Ref-ID': Date.now().toString(),
      },
      subject: 'Welcome to the LegalNote Waitlist',
      html: emailHtml,
    });

    if (error) {
      console.error('[EMAIL] Error sending waitlist confirmation via Resend:', error);
      return { success: false, error: error.message };
    }

    console.log('[EMAIL] Waitlist confirmation sent successfully:', data?.id);
    return { success: true, messageId: data?.id };
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
  
  const adminEmails = ['jazz.dennis@legalnote.ai', 'support@legalnote.ai'];
  
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
      <div class="container">
        <div class="header">
          <h1>New Early Access Request</h1>
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
    </body>
    </html>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: 'LegalNote Waitlist <support@legalnote.ai>',
      to: adminEmails,
      subject: `New Early Access Request: ${firmName || email}`,
      html: emailHtml,
    });

    if (error) {
      console.error('[EMAIL] Error sending admin notification via Resend:', error);
      return { success: false, error: error.message };
    }

    console.log('[EMAIL] Admin notification sent successfully:', data?.id);
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
      <div class="header">
        <h1>LegalNote</h1>
        <p>Professional Legal Documentation</p>
      </div>
      
      <div class="content">
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
    const { data, error } = await resend.emails.send({
      from: 'LegalNote™ <support@legalnote.ai>',
      to: [to],
      reply_to: 'support@legalnote.ai',
      headers: {
        'Precedence': 'bulk',
        'X-Entity-Ref-ID': Date.now().toString(),
      },
      subject: 'Your Guide: The Defensible Record',
      html: emailHtml,
      ...(hasPdf
        ? {
            attachments: [
              {
                filename: 'The-Defensible-Record-LegalNote.pdf',
                content: pdfBuffer as Buffer,
              },
            ],
          }
        : {}),
    });

    if (error) {
      console.error('[EMAIL] Error sending lead magnet via Resend:', error);
      return { success: false, error: error.message };
    }

    console.log('[EMAIL] Lead magnet sent successfully:', data?.id);
    return { success: true, messageId: data?.id };
  } catch (error: any) {
    console.error('[EMAIL] Exception sending lead magnet:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

interface SendClientCareLetterEmailParams {
  to: string;
  clientName: string;
  firmName: string;
  letterContent: string;
  matterReference?: string;
  firmEmail?: string;
  firmPhone?: string;
}

export async function sendClientCareLetterEmail(params: SendClientCareLetterEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { to, clientName, firmName, letterContent, matterReference, firmEmail, firmPhone } = params;

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; line-height: 1.6; max-width: 700px; margin: 0 auto; padding: 20px; }
        .header { border-bottom: 2px solid #1a365d; padding-bottom: 16px; margin-bottom: 24px; }
        .header h1 { color: #1a365d; font-size: 20px; margin: 0; }
        .header p { color: #4a5568; font-size: 13px; margin: 4px 0 0 0; }
        .letter-content { white-space: pre-wrap; font-size: 14px; }
        .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #718096; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${firmName}</h1>
        ${matterReference ? `<p>Reference: ${matterReference}</p>` : ''}
      </div>
      <p>Dear ${clientName},</p>
      <p>Please find attached your Client Care Letter. This document sets out the terms of our engagement and important information about the services we will provide.</p>
      <p>Please review the letter carefully and do not hesitate to contact us if you have any questions.</p>
      <div class="letter-content">${letterContent}</div>
      <div class="footer">
        <p>This email contains confidential and privileged information intended only for ${clientName}.
        If you are not the intended recipient, please delete this email and notify us immediately.</p>
        ${firmEmail ? `<p>Email: ${firmEmail}</p>` : ''}
        ${firmPhone ? `<p>Phone: ${firmPhone}</p>` : ''}
        <p>&copy; ${new Date().getFullYear()} ${firmName}. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: `${firmName} via LegalNote <support@legalnote.ai>`,
      to: [to],
      subject: `Client Care Letter - ${firmName}${matterReference ? ` (Ref: ${matterReference})` : ''}`,
      html: emailHtml,
    });

    if (error) {
      console.error('[EMAIL] Error sending client care letter via Resend:', error);
      return { success: false, error: error.message };
    }

    console.log('[EMAIL] Client care letter sent successfully:', data?.id);
    return { success: true, messageId: data?.id };
  } catch (error: any) {
    console.error('[EMAIL] Exception sending client care letter:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

interface SendAcknowledgementRequestParams {
  to: string;
  clientName: string;
  caseTitle: string;
  matterReference?: string;
  token: string;
  firmProfile?: {
    firmName: string;
    phone?: string;
    email?: string;
  };
}

/**
 * Sends a client care letter acknowledgement request email with a secure one-time link
 */
export async function sendAcknowledgementRequestEmail(
  params: SendAcknowledgementRequestParams
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { to, clientName, caseTitle, matterReference, token, firmProfile } = params;

  const baseUrl = process.env.APP_URL?.replace(/\/$/, '') || 'https://legalnote.ai';
  const acknowledgeUrl = `${baseUrl}/acknowledge/${token}`;

  const firmName = firmProfile?.firmName || 'Your Solicitors';
  const ref = matterReference ? `<p style="color:#666;font-size:13px;margin-top:4px">Matter reference: ${matterReference}</p>` : '';

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
      <div class="header">
        <h1>${firmName}</h1>
        <p>Secure Document Portal</p>
      </div>
      <div class="content">
        <h2>Your Client Care Letter is ready</h2>
        <p>Dear ${clientName},</p>
        <p>We have prepared your Client Care Letter in connection with the matter: <strong>${caseTitle}</strong>.${matterReference ? ` (Ref: ${matterReference})` : ''}</p>
        <p>Please click the button below to read your letter and confirm that you have received and understood its contents.</p>
        <a href="${acknowledgeUrl}" class="cta-btn">Read &amp; Acknowledge Letter</a>
        <p>This is a one-time secure link. It will remain active until you have confirmed acknowledgement.</p>
        <div class="notice">
          <strong>Why are we asking you to do this?</strong><br>
          SRA regulations require us to confirm that our clients have received and understood the terms of our engagement. Your acknowledgement creates a secure record for your protection as well as ours.
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
    const { data, error } = await resend.emails.send({
      from: 'LegalNote <noreply@legalnote.app>',
      to,
      subject: `Action required: Please acknowledge your Client Care Letter — ${caseTitle}`,
      html: emailHtml,
    });

    if (error) {
      console.error('[EMAIL] Error sending acknowledgement request:', error);
      return { success: false, error: error.message };
    }

    console.log('[EMAIL] Acknowledgement request sent successfully:', data?.id);
    return { success: true, messageId: data?.id };
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
      <div style="border-bottom: 3px solid #8b4513; padding-bottom: 20px; margin-bottom: 28px;">
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
    const { data, error } = await resend.emails.send({
      from: 'LegalNote Compliance <noreply@legalnote.app>',
      to,
      subject: `Weekly Risk Digest — ${digest.totalIssues} item${digest.totalIssues !== 1 ? 's' : ''} — ${firmName}`,
      html: emailHtml,
    });

    if (error) {
      console.error('[EMAIL] Error sending risk digest:', error);
      return { success: false, error: error.message };
    }

    console.log('[EMAIL] Risk digest sent successfully:', data?.id);
    return { success: true, messageId: data?.id };
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
        .header { background: #1e3a5f; color: #fff; padding: 32px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
        .header p { margin: 8px 0 0; opacity: 0.85; font-size: 14px; }
        .body { padding: 32px; }
        .cta-btn { display: inline-block; background: #1e3a5f; color: #fff !important; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 15px; margin: 24px 0; }
        .notice { background: #f0f4f8; border-radius: 6px; padding: 16px; margin-top: 24px; font-size: 13px; color: #555; }
        .url-fallback { font-size: 12px; color: #888; word-break: break-all; margin-top: 16px; }
        .footer { padding: 20px 32px; background: #f8f8f8; border-top: 1px solid #eee; font-size: 12px; color: #999; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>LegalNote</h1>
          <p>Team Invitation</p>
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
    const { data, error } = await resend.emails.send({
      from: 'LegalNote <noreply@legalnote.app>',
      to,
      subject: `You have been invited to join ${firmName} on LegalNote`,
      html: emailHtml,
    });

    if (error) {
      console.error('[EMAIL] Error sending invitation email:', error);
      return { success: false, error: error.message };
    }

    console.log('[EMAIL] Invitation email sent successfully:', data?.id);
    return { success: true, messageId: data?.id };
  } catch (error: any) {
    console.error('[EMAIL] Exception sending invitation email:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}
