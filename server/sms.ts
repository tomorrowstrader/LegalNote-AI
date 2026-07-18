import twilio from 'twilio';

function getTwilioAccountSid(): string | undefined {
  return process.env.TWILIO_ACCOUNT_SID?.trim() || undefined;
}

function getTwilioAuthToken(): string | undefined {
  return process.env.TWILIO_AUTH_TOKEN?.trim() || undefined;
}

function getTwilioPhoneNumber(): string | undefined {
  return process.env.TWILIO_PHONE_NUMBER?.trim() || undefined;
}

function getTwilioSenderName(): string | undefined {
  return process.env.TWILIO_SENDER_NAME?.trim() || undefined;
}

/** Opt-in: alphanumeric From is unreliable for UK OTP unless registered. */
function shouldUseAlphaSender(): boolean {
  return process.env.TWILIO_USE_ALPHA_SENDER === 'true';
}

// Validate that all required credentials are present at boot
if (!getTwilioAccountSid() || !getTwilioAuthToken() || !getTwilioPhoneNumber()) {
  console.warn('Twilio credentials not configured. SMS functionality will be disabled.');
}

function getTwilioClient() {
  const accountSid = getTwilioAccountSid();
  const authToken = getTwilioAuthToken();
  return accountSid && authToken ? twilio(accountSid, authToken) : null;
}

/** Alphanumeric sender IDs: 1–11 letters/digits, no spaces. */
export function isValidAlphaSenderId(sender: string): boolean {
  return /^[A-Za-z0-9]{1,11}$/.test(sender);
}

/**
 * Prefer the Twilio phone number for OTP deliverability.
 * Only use TWILIO_SENDER_NAME when explicitly opted in and valid —
 * unregistered UK alpha senders commonly fail with 21612 / 30041 / 30042.
 */
export function resolveSmsFromAddress(): { from: string; usedAlpha: boolean } {
  const phone = getTwilioPhoneNumber();
  const senderName = getTwilioSenderName();
  if (
    shouldUseAlphaSender() &&
    senderName &&
    isValidAlphaSenderId(senderName)
  ) {
    return { from: senderName, usedAlpha: true };
  }
  if (!phone) {
    throw new Error('TWILIO_PHONE_NUMBER is not configured');
  }
  return { from: phone, usedAlpha: false };
}

function twilioErrorCode(error: unknown): number | undefined {
  const code = (error as { code?: unknown })?.code;
  if (typeof code === 'number') return code;
  if (typeof code === 'string' && /^\d+$/.test(code)) return Number(code);
  return undefined;
}

function isSenderRelatedError(code: number | undefined): boolean {
  // Invalid/unauthorized From, unregistered alpha sender, etc.
  return code === 21606 || code === 21612 || code === 30041 || code === 30042;
}

function mapTwilioSendError(error: unknown): string {
  const code = twilioErrorCode(error);

  if (code === 21211) {
    return 'Invalid phone number. Please check and try again.';
  }
  if (code === 21408) {
    return 'SMS to this destination is not enabled. Please contact support.';
  }
  if (code === 21608) {
    return 'This phone number is not verified for SMS in trial mode.';
  }
  if (code === 21610) {
    return 'This phone number cannot receive SMS messages.';
  }
  if (isSenderRelatedError(code)) {
    return 'SMS sender is misconfigured. Please contact support.';
  }
  if (code === 20003 || code === 20001) {
    return 'SMS service authentication failed. Please contact support.';
  }
  return 'Failed to send SMS. Please try again later.';
}

function sanitizeFirmName(firmName: string): string {
  const cleaned = firmName
    .replace(/[^\w\s&.'-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
  return cleaned || 'LegalNote';
}

/**
 * Generates a random 6-digit verification code
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Low-level SMS send with phone-number fallback when an alpha sender fails.
 */
export async function sendSmsMessage(
  phoneNumber: string,
  body: string,
): Promise<{ success: boolean; error?: string }> {
  const twilioClient = getTwilioClient();
  const twilioPhoneNumber = getTwilioPhoneNumber();

  if (!twilioClient || !twilioPhoneNumber) {
    console.error('Twilio not configured - cannot send SMS');
    return {
      success: false,
      error: 'SMS service not configured. Please contact support.',
    };
  }

  if (!phoneNumber.match(/^\+[1-9]\d{1,14}$/)) {
    return {
      success: false,
      error: 'Invalid phone number format. Please use international format (e.g., +447xxx...)',
    };
  }

  const { from, usedAlpha } = resolveSmsFromAddress();

  try {
    const message = await twilioClient.messages.create({
      body,
      from,
      to: phoneNumber,
    });
    console.log(`SMS sent successfully. Message SID: ${message.sid}`);
    return { success: true };
  } catch (error: unknown) {
    const code = twilioErrorCode(error);
    console.error('Failed to send SMS:', {
      code,
      message: error instanceof Error ? error.message : String(error),
      fromKind: usedAlpha ? 'alpha' : 'phone',
    });

    // Unregistered / invalid alpha From → retry once from the phone number
    if (usedAlpha && isSenderRelatedError(code)) {
      try {
        console.warn('Retrying SMS with TWILIO_PHONE_NUMBER after alpha sender failure');
        const retry = await twilioClient.messages.create({
          body,
          from: twilioPhoneNumber,
          to: phoneNumber,
        });
        console.log(`SMS sent successfully on retry. Message SID: ${retry.sid}`);
        return { success: true };
      } catch (retryError: unknown) {
        console.error('SMS retry with phone number also failed:', {
          code: twilioErrorCode(retryError),
          message: retryError instanceof Error ? retryError.message : String(retryError),
        });
        return { success: false, error: mapTwilioSendError(retryError) };
      }
    }

    return { success: false, error: mapTwilioSendError(error) };
  }
}

/**
 * Sends an SMS verification code to the specified phone number
 * @param phoneNumber - Recipient phone number in E.164 format (e.g., +447xxx...)
 * @param verificationCode - 6-digit verification code
 * @param firmName - Name of the law firm (for personalized message)
 */
export async function sendVerificationCode(
  phoneNumber: string,
  verificationCode: string,
  firmName: string = 'LegalNote'
): Promise<{ success: boolean; error?: string }> {
  const safeFirm = sanitizeFirmName(firmName);
  const body = `Your verification code for ${safeFirm} is: ${verificationCode}\n\nThis code expires in 15 minutes.\n\nPowered by LegalNote`;
  return sendSmsMessage(phoneNumber, body);
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
