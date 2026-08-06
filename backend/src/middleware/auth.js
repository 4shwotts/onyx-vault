const jwt = require('jsonwebtoken');

// Fail fast if the secret isn't configured — better than every
// verification silently breaking later.
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is not set. Refusing to start.');
}

// Reads the JWT from an httpOnly cookie rather than a header or
// localStorage, so client-side JS can never access the token directly.
function requireAuth(req, res, next) {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // Restrict verification to HS256 to prevent algorithm-confusion attacks.
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    req.userId = payload.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

module.exports = { requireAuth };