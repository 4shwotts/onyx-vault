// Origins (scheme + host + port) allowed to make credentialed requests.
//
// ALLOWED_ORIGINS is a comma-separated list, e.g.
//   ALLOWED_ORIGINS=https://onyx-vault-six.vercel.app
// In production it should be set; if it isn't, CLIENT_ORIGIN is used so a
// missing variable can't lock the real site out. Outside production the
// default is the Vite dev and preview servers on localhost.
const DEV_DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

function normaliseOrigin(value) {
  try {
    const url = new URL(value.trim());
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

function getAllowedOrigins(env = process.env) {
  const listed = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
    .map(normaliseOrigin)
    .filter(Boolean);
  if (listed.length > 0) return [...new Set(listed)];

  if (env.NODE_ENV === 'production') {
    const fallback = env.CLIENT_ORIGIN ? normaliseOrigin(env.CLIENT_ORIGIN) : null;
    if (!fallback) throw new Error('ALLOWED_ORIGINS (or CLIENT_ORIGIN) must be set in production. Refusing to start.');
    console.warn('ALLOWED_ORIGINS is not set; falling back to CLIENT_ORIGIN only.');
    return [fallback];
  }
  return DEV_DEFAULT_ORIGINS;
}

// PUBLIC_SIGNUP_ENABLED: whether new people can create real accounts.
// On by default; "false", "0", "no" or "off" (any case) turns it off. When
// off, existing accounts still log in, verify and reset passwords, and the
// demo stays open. The live site runs with it off.
function isPublicSignupEnabled(env = process.env) {
  const value = String(env.PUBLIC_SIGNUP_ENABLED ?? '').trim().toLowerCase();
  if (value === '') return true;
  return !['false', '0', 'no', 'off'].includes(value);
}

// MAX_LIVE_DEMOS: how many demo accounts may exist at once (default 50),
// so the free database can't be filled up by demos.
const DEFAULT_MAX_LIVE_DEMOS = 50;

function maxLiveDemos(env = process.env) {
  const value = Number(env.MAX_LIVE_DEMOS);
  return Number.isInteger(value) && value >= 0 ? value : DEFAULT_MAX_LIVE_DEMOS;
}

module.exports = { getAllowedOrigins, normaliseOrigin, isPublicSignupEnabled, maxLiveDemos, DEFAULT_MAX_LIVE_DEMOS };
