import { Resend } from 'resend';

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
  const baseUrl = process.env.REPLIT_DOMAINS 
    ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
    : 'http://localhost:5000';
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
      from: 'LegalNote AI <jazz.dennis@legalnote.ai>', // Use verified domain in production
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

  const baseUrl = process.env.REPLIT_DOMAINS 
    ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
    : 'http://localhost:5000';
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

        <p>Your client meeting recording has been successfully processed and saved to LegalNote AI. All protection layers were active during recording.</p>

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
          <p>This confirmation was sent by LegalNote AI</p>
          ${firmProfile?.firmName ? `<p>${firmProfile.firmName}</p>` : ''}
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: 'LegalNote AI <jazz.dennis@legalnote.ai>',
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
          <p>This email was sent by LegalNote AI on behalf of your legal representative.</p>
          <p>If you did not expect this email, please contact your legal representative.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: 'LegalNote AI <jazz.dennis@legalnote.ai>',
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

export async function sendWaitlistConfirmationEmail(to: string, firstName: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[EMAIL] RESEND_API_KEY not configured, skipping waitlist confirmation email');
    return { success: false, error: 'Email service not configured' };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

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
          margin-bottom: 24px;
        }
        .highlight {
          background: linear-gradient(135deg, #1a1a1a 0%, #333 100%);
          color: white;
          padding: 20px;
          border-radius: 8px;
          margin: 24px 0;
        }
        .footer {
          margin-top: 32px;
          padding-top: 16px;
          border-top: 1px solid #e5e5e5;
          font-size: 12px;
          color: #666;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>LegalNote AI</h1>
        </div>
        
        <div class="content">
          <p>Hi ${firstName},</p>
          
          <p>Thank you for your interest in LegalNote AI. You're now on our early access waitlist.</p>
          
          <div class="highlight">
            <strong>What happens next?</strong><br>
            We're currently in private beta, carefully onboarding firms to ensure the best possible experience. We'll notify you as soon as early access becomes available.
          </div>
          
          <p>In the meantime, here's what LegalNote AI will help you achieve:</p>
          <ul>
            <li>Create attendance notes in minutes, not hours</li>
            <li>AI-powered transcription with legal vocabulary understanding</li>
            <li>GDPR-compliant consent management and audit trails</li>
            <li>Professional document exports with your firm branding</li>
          </ul>
          
          <p>We're excited to have you join us on this journey to transform legal documentation.</p>
          
          <p>Best regards,<br>The LegalNote AI Team</p>
        </div>
        
        <div class="footer">
          <p>This email was sent because you signed up for early access to LegalNote AI.</p>
          <p>LegalNote AI - Compliance-first legal documentation</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: 'LegalNote AI <jazz.dennis@legalnote.ai>',
      to: [to],
      subject: 'Welcome to the LegalNote AI Waitlist',
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

/**
 * Sends a lead magnet email with "The Defensible Record" PDF guide
 */
export async function sendLeadMagnetEmail(
  to: string, 
  firstName: string = 'there',
  pdfBuffer: Buffer
): Promise<{ success: boolean; messageId?: string; error?: string }> {
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
        
        <p>Thank you for your interest in creating better legal documentation. Your guide is attached to this email.</p>
        
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
      from: 'LegalNote AI <jazz.dennis@legalnote.ai>',
      to: [to],
      subject: 'Your Guide: The Defensible Record',
      html: emailHtml,
      attachments: [
        {
          filename: 'The-Defensible-Record-LegalNote.pdf',
          content: pdfBuffer,
        },
      ],
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
