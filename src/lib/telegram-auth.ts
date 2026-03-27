import crypto from 'crypto';

/**
 * Validates the data received from Telegram Mini App to prevent user_id spoofing.
 * @param initData The raw initData string from Telegram.
 * @param botToken The bot token provided by BotFather.
 */
export function verifyTelegramWebAppData(initData: string, botToken: string): boolean {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    params.delete('hash');

    // 1. Sort the remaining parameters alphabetically
    const dataCheckString = Array.from(params.entries())
      .map(([key, value]) => `${key}=${value}`)
      .sort()
      .join('\n');

    // 2. Compute Secret Key using bot token
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    // 3. Compute Hash of the dataCheckString
    const computedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // 4. Compare computed hash with received hash
    return computedHash === hash;
  } catch (error) {
    console.error('Telegram Auth Verification Error:', error);
    return false;
  }
}
