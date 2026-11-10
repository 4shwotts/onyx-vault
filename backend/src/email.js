// Transactional email (verification and password reset).
//
// In production and development, mail goes through Brevo's HTTPS API.
// Under NODE_ENV=test — and only then — it goes to an in-memory outbox
// instead, so the test suite can read the links it would have sent and
// nothing is ever delivered to a real inbox.

const isTest = process.env.NODE_ENV === 'test';

if (!isTest) {
  if (!process.env.BREVO_API_KEY) {
    throw new Error('BREVO_API_KEY is not set. Refusing to start.');
  }
  if (!process.env.BREVO_SENDER_EMAIL) {
    throw new Error('BREVO_SENDER_EMAIL is not set. Refusing to start.');
  }
}

if (!process.env.CLIENT_ORIGIN) {
  throw new Error('CLIENT_ORIGIN must be set. Refusing to start.');
}

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

// Test-only outbox. Always empty outside NODE_ENV=test.
const testOutbox = [];

// Sends via Brevo's HTTPS API rather than SMTP, since Render's free tier
// blocks outbound traffic on SMTP ports (25, 465, 587) entirely. An API
// call over HTTPS on port 443 sidesteps that restriction completely.
async function sendViaBrevo({ to, subject, html }) {
  const response = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'Onyx Vault', email: process.env.BREVO_SENDER_EMAIL },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Brevo API error (${response.status}): ${errorBody}`);
  }
}

async function send(message) {
  // Demo accounts use the reserved .invalid domain. The routes already
  // refuse anything that would email one; this is the last line of
  // defence, so nothing can ever be sent to such an address.
  if (/\.invalid$/i.test(String(message.to).trim())) {
    throw new Error('Refusing to send email to a .invalid (demo) address');
  }
  if (isTest) {
    testOutbox.push({ ...message, sentAt: new Date() });
    return;
  }
  await sendViaBrevo(message);
}

async function sendVerificationEmail(to, token) {
  const link = `${process.env.CLIENT_ORIGIN}/verify-email?token=${token}`;
  await send({
    to,
    subject: 'Verify your Onyx Vault account',
    link,
    html: `
      <p>Welcome to Onyx Vault.</p>
      <p>Click the link below to verify your email address. This link expires in 24 hours.</p>
      <p><a href="${link}">${link}</a></p>
      <p>If you did not create this account, you can ignore this email.</p>
    `,
  });
}

async function sendPasswordResetEmail(to, token) {
  const link = `${process.env.CLIENT_ORIGIN}/reset-password?token=${token}`;
  await send({
    to,
    subject: 'Reset your Onyx Vault password',
    link,
    html: `
      <p>We received a request to reset your Onyx Vault password.</p>
      <p>Click the link below to choose a new password. This link expires in 1 hour and only works once.</p>
      <p><a href="${link}">${link}</a></p>
      <p>If you did not request this, you can ignore this email, your password will stay the same.</p>
    `,
  });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail, testOutbox, send };
