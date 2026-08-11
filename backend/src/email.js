const nodemailer = require('nodemailer');

if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
  throw new Error('GMAIL_USER and GMAIL_APP_PASSWORD must be set. Refusing to start.');
}

if (!process.env.CLIENT_ORIGIN) {
  throw new Error('CLIENT_ORIGIN must be set. Refusing to start.');
}

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
  
  family: 4,
});

async function sendVerificationEmail(to, token) {
  const link = `${process.env.CLIENT_ORIGIN}/verify-email?token=${token}`;
  await transporter.sendMail({
    from: `"Onyx Vault" <${process.env.GMAIL_USER}>`,
    to,
    subject: 'Verify your Onyx Vault account',
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
  await transporter.sendMail({
    from: `"Onyx Vault" <${process.env.GMAIL_USER}>`,
    to,
    subject: 'Reset your Onyx Vault password',
    html: `
      <p>We received a request to reset your Onyx Vault password.</p>
      <p>Click the link below to choose a new password. This link expires in 1 hour and only works once.</p>
      <p><a href="${link}">${link}</a></p>
      <p>If you did not request this, you can ignore this email, your password will stay the same.</p>
    `,
  });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };