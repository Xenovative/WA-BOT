const axios = require('axios');

const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

function getRecipients() {
  const raw = process.env.ALERT_PHONE_NUMBER || process.env.ALERT_PHONE_NUMBERS || '';
  if (!raw.trim()) {
    return [];
  }
  return raw.split(/[,\s]+/).map(number => number.trim()).filter(Boolean);
}

function getCooldown() {
  const raw = process.env.ALERT_SMS_COOLDOWN_MS;
  if (!raw) {
    return DEFAULT_COOLDOWN_MS;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_COOLDOWN_MS;
}

function twilioConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER &&
    getRecipients().length > 0
  );
}

async function sendTwilioSms(body) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  const recipients = getRecipients();

  if (!twilioConfigured()) {
    console.warn('[Alerts] Twilio SMS is not fully configured. Skipping alert send.');
    return { success: false, reason: 'missing_configuration' };
  }

  const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const results = [];
  for (const to of recipients) {
    try {
      const formBody = new URLSearchParams();
      formBody.append('To', to);
      formBody.append('From', from);
      formBody.append('Body', body);

      const response = await axios.post(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        formBody.toString(),
        {
          headers: {
            Authorization: `Basic ${authHeader}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 10000
        }
      );

      results.push({ to, success: true, sid: response.data.sid });
    } catch (error) {
      console.error('[Alerts] Failed to send Twilio SMS to', to, error.response?.data || error.message);
      results.push({ to, success: false, error: error.message });
    }
  }

  const anySuccess = results.some(r => r.success);
  return { success: anySuccess, results };
}

function isConfigured() {
  const provider = (process.env.ALERT_SMS_PROVIDER || 'twilio').toLowerCase();
  if (provider === 'twilio') {
    return twilioConfigured();
  }
  return false;
}

async function sendConnectionAlert(message) {
  const provider = (process.env.ALERT_SMS_PROVIDER || 'twilio').toLowerCase();
  if (provider === 'twilio') {
    return sendTwilioSms(message);
  }

  console.warn(`[Alerts] Unsupported SMS provider "${provider}"`);
  return { success: false, reason: 'unsupported_provider' };
}

module.exports = {
  isConfigured,
  sendConnectionAlert,
  getCooldown,
  getRecipients
};
