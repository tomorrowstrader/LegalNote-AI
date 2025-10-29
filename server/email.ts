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
  caseId: string;
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
 * Sends a professional email to a client with case document access
 */
export async function sendCaseEmail(params: SendCaseEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const {
    to,
    caseTitle,
    clientName,
    matterReference,
    caseId,
    customMessage,
    firmProfile
  } = params;

  // Construct the case view URL (assumes your app is accessible via REPLIT_DOMAINS)
  const baseUrl = process.env.REPLIT_DOMAINS 
    ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
    : 'http://localhost:5000';
  const caseUrl = `${baseUrl}/case/${caseId}`;

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

        <a href="${caseUrl}" class="cta-button">View Case Documents</a>

        <p style="font-size: 12px; color: #666;">
          If the button above doesn't work, copy and paste this link into your browser:<br>
          <a href="${caseUrl}">${caseUrl}</a>
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
      from: 'LegalNote AI <onboarding@resend.dev>', // Use verified domain in production
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
