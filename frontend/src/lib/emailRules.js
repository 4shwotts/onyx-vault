// The same email checks the API applies on sign-up, run in the browser
// first so mistakes are shown before anything is sent.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ALLOWED_DOMAINS = [
  'gmail.com', 'googlemail.com',
  'outlook.com', 'hotmail.com', 'hotmail.co.uk', 'live.com', 'live.co.uk', 'msn.com',
  'yahoo.com', 'yahoo.co.uk', 'ymail.com', 'rocketmail.com',
  'icloud.com', 'me.com', 'mac.com',
  'aol.com',
  'protonmail.com', 'proton.me', 'pm.me',
  'zoho.com', 'zohomail.com',
  'gmx.com', 'gmx.us',
  'mail.com',
  'yandex.com', 'yandex.ru',
  'fastmail.com', 'fastmail.fm',
  'tutanota.com', 'tuta.io',
];

export function getEmailError(rawEmail) {
  const value = rawEmail.trim();
  if (!EMAIL_SHAPE.test(value)) {
    return 'That doesn’t look like a valid email address.';
  }
  const domain = value.split('@')[1]?.toLowerCase();
  if (!ALLOWED_DOMAINS.includes(domain)) {
    return 'Please use a verified email provider, such as Gmail.';
  }
  return '';
}
