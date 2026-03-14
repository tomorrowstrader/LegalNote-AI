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
 * Validates a phone number format (UK numbers)
 * @param phoneNumber - Phone number to validate
 * @returns boolean - true if valid UK format
 */
export function isValidUKPhoneNumber(phoneNumber: string): boolean {
  // UK phone numbers in E.164 format: +44 followed by 10 digits
  // Accepts: +447xxx... (mobile) or +441xxx.../+442xxx... (landline)
  return /^\+44[1-9]\d{9}$/.test(phoneNumber);
}

/**
 * Formats a UK phone number to E.164 format
 * Converts various UK number formats to +44 standard
 * @param phoneNumber - Phone number in various formats
 * @returns string - Phone number in E.164 format or original if cannot parse
 */
export function formatUKPhoneNumber(phoneNumber: string): string {
  // Remove all whitespace, dashes, parentheses
  let cleaned = phoneNumber.replace(/[\s\-\(\)]/g, '');
  
  // Handle different UK formats:
  // 07xxx... -> +447xxx...
  if (cleaned.match(/^07\d{9}$/)) {
    return '+44' + cleaned.substring(1);
  }
  
  // 447xxx... -> +447xxx...
  if (cleaned.match(/^447\d{9}$/)) {
    return '+' + cleaned;
  }
  
  // +447xxx... (already correct)
  if (cleaned.match(/^\+447\d{9}$/)) {
    return cleaned;
  }
  
  // Return original if we can't parse it
  return phoneNumber;
}
