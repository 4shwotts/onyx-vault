const { verifySession } = require('../auth/sessions');
const { sendError } = require('../utils/http');

// Fail fast if the secret isn't configured — better than every
// verification silently breaking later.
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is not set. Refusing to start.');
}

// Reads the JWT from an httpOnly cookie rather than a header or
// localStorage, so client-side JS can never access the token directly.
// A valid signature isn't enough: the session it names must still exist
// (logout, password reset and account deletion remove it) and must not
// have expired.
function requireAuth(req, res, next) {
  verifySession(req.cookies?.token)
    .then((session) => {
      if (!session) return sendError(res, 401, 'Not signed in, or your session has ended');
      req.userId = session.userId;
      req.sessionId = session.sessionId;
      return next();
    })
    .catch(next);
}

module.exports = { requireAuth };
