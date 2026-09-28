// One place where server-side failures (the 500 paths of the online API, sync API and
// claim replay workers — all of them end in api.mjs sendError) are handed to the
// report store (online/report-api.mjs). Kept dependency-free so api.mjs can import it
// without a cycle. The sink must never throw back into the request path.
let sink = null;

export function setServerErrorSink(fn) {
  sink = typeof fn === 'function' ? fn : null;
}

export function reportServerError(err, context = {}) {
  if (!sink) return;
  try { sink(err, context); } catch {}
}
