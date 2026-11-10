const { sendError } = require('../utils/http');

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Refuses state-changing requests that a browser marks as coming from
// another site. This doesn't rely on CORS (which only controls whether a
// page may *read* a response) or on cookie settings alone:
// - an Origin header that isn't one of ours -> 403;
// - no Origin, but Sec-Fetch-Site says cross-site -> 403;
// - neither header (curl, server-to-server, tests) -> allowed, because a
//   cross-site attack needs a victim's browser, and browsers send them.
function rejectCrossSiteWrites(allowedOrigins) {
  const allowed = new Set(allowedOrigins);
  return function originCheck(req, res, next) {
    if (!UNSAFE_METHODS.has(req.method)) return next();

    const origin = req.get('Origin');
    if (origin && origin !== 'null' && allowed.has(origin)) return next();
    if (origin) return sendError(res, 403, 'Cross-site request refused');

    const fetchSite = req.get('Sec-Fetch-Site');
    if (fetchSite === 'cross-site') return sendError(res, 403, 'Cross-site request refused');
    return next();
  };
}

module.exports = { rejectCrossSiteWrites };
