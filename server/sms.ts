import twilio from 'twilio';

// Initialize Twilio client with credentials from environment variables
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const twilioSenderName = process.env.TWILIO_SENDER_NAME; // Optional alphanumeric sender ID

// Validate that all required credentials are present
if (!accountSid || !authToken || !twilioPhoneNumber) {
  console.warn('Twilio credentials not configured. SMS functionality will be disabled.');
}

const twilioClient = accountSid && authToken ? twilio(accountSid, authToken) : null;

/**
 * Generates a random 6-digit verification code
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Sends an SMS verification code to the specified phone number
 * @param phoneNumber - Recipient phone number in E.164 format (e.g., +447xxx...)
 * @param verificationCode - 6-digit verification code
 * @param firmName - Name of the law firm (for personalized message)
 * @returns Promise<boolean> - true if sent successfully, false otherwise
 */
export async function sendVerificationCode(
  phoneNumber: string,
  verificationCode: string,
  firmName: string = 'LegalNote'
): Promise<{ success: boolean; error?: string }> {
  if (!twilioClient || !twilioPhoneNumber) {
    console.error('Twilio not configured - cannot send SMS');
    return { 
      success: false, 
      error: 'SMS service not configured. Please contact support.' 
    };
  }

  try {
    // Validate phone number format (basic E.164 validation)
    if (!phoneNumber.match(/^\+[1-9]\d{1,14}$/)) {
      return { 
        success: false, 
        error: 'Invalid phone number format. Please use international format (e.g., +447xxx...)' 
      };
    }

    // Send SMS via Twilio
    // Use alphanumeric sender ID if explicitly configured, otherwise fall back to phone number
    const message = await twilioClient.messages.create({
      body: `Your verification code for ${firmName} is: ${verificationCode}\n\nThis code expires in 15 minutes.\n\nPowered by LegalNote`,
      from: twilioSenderName ? twilioSenderName : twilioPhoneNumber,
      to: phoneNumber,
    });

    console.log(`SMS sent successfully. Message SID: ${message.sid}`);
    return { success: true };
  } catch (error: any) {
    console.error('Failed to send SMS:', error);
    
    // Return user-friendly error messages
    if (error.code === 21211) {
      return { success: false, error: 'Invalid phone number. Please check and try again.' };
    } else if (error.code === 21608) {
      return { success: false, error: 'This phone number is not verified for SMS in trial mode.' };
    } else if (error.code === 21610) {
      return { success: false, error: 'This phone number cannot receive SMS messages.' };
    } else {
      return { success: false, error: 'Failed to send SMS. Please try again later.' };
    }
  }
}

/**
 * Validates a UK mobile number in E.164 format (+447…)
 */
export function isValidUKPhoneNumber(phoneNumber: string): boolean {
  return /^\+447\d{9}$/.test(phoneNumber);
}

/**
 * Formats a UK mobile number to E.164 (+447…)
 * Accepts common national/international variants; returns original if unparseable.
 */
export function formatUKPhoneNumber(phoneNumber: string): string {
  let cleaned = phoneNumber.replace(/[\s\-\(\)\.]/g, '');

  // 0044753… -> +44753…
  if (cleaned.startsWith('0044')) {
    cleaned = '+' + cleaned.slice(2);
  }

  // 07xxxxxxxxx -> +447xxxxxxxxx
  if (/^07\d{9}$/.test(cleaned)) {
    return '+44' + cleaned.slice(1);
  }

  // 7xxxxxxxxx (missing leading 0) -> +447xxxxxxxxx
  if (/^7\d{9}$/.test(cleaned)) {
    return '+44' + cleaned;
  }

  // 447xxxxxxxxx -> +447xxxxxxxxx
  if (/^447\d{9}$/.test(cleaned)) {
    return '+' + cleaned;
  }

  // +447xxxxxxxxx (already correct)
  if (/^\+447\d{9}$/.test(cleaned)) {
    return cleaned;
  }

  return phoneNumber.trim();
}

/** Last 4 digits for masked UI display (never expose full number publicly). */
export function phoneLastFour(phoneNumber: string): string {
  const formatted = formatUKPhoneNumber(phoneNumber);
  const digits = formatted.replace(/\D/g, '');
  return digits.slice(-4) || '****';
}
