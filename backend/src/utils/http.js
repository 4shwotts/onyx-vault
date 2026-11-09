// Express 4 ignores the promise an async route handler returns, so an
// error thrown (or a rejected await) outside a try/catch never reaches the
// error middleware. The request hangs and, on Node 15+, the unhandled
// rejection terminates the whole process. Wrapping every async handler
// forwards those errors to next(), where the error middleware answers 500.
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Postgres INTEGER (SERIAL) range. Anything outside it — or anything that
// isn't a plain whole number — makes Postgres throw, so ids from the client
// are checked before they reach a query.
const MAX_INT4 = 2147483647;

// Returns the id as a number, or null when it isn't a positive whole number
// within the Postgres INTEGER range. Accepts numbers and digit-only strings
// (form values and URL params arrive as strings).
function parseId(value) {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 && value <= MAX_INT4 ? value : null;
  }
  if (typeof value === 'string' && /^[1-9]\d{0,9}$/.test(value)) {
    const n = Number(value);
    return n <= MAX_INT4 ? n : null;
  }
  return null;
}

module.exports = { asyncHandler, parseId, MAX_INT4 };
