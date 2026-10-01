// One place where server-side failures (the 500 paths of the online API, sync API and
// claim replay workers — all of them end in api.mjs sendError) are handed to the
// report store (online/report-api.mjs). Kept dependency-free so api.mjs can import it
// without a cycle. The sink must never throw back into the request path.
let sink = null;

export function setServerErrorSink(fn) {
  sink = typeof fn === 'function' ? fn : null;
}

// A client that hangs up mid-request (phone switched app, lost signal) is not a server fault.
const CLIENT_ABORT = new Set(['ECONNRESET', 'ECONNABORTED', 'EPIPE', 'ERR_STREAM_PREMATURE_CLOSE']);
export function isClientAbort(err) {
  return !!err && (err.message === 'aborted' || CLIENT_ABORT.has(err.code));
}

export function reportServerError(err, context = {}) {
  if (!sink || isClientAbort(err)) return;
  try { sink(err, context); } catch {}
}
