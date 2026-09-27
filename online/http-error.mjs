// Error with the HTTP status and Chinese message the API answers with. Kept in its own
// module so the replay worker can throw / rebuild it without importing the API handler.
export class HttpError extends Error {
  constructor(status, message, headers) {
    super(message);
    this.status = status;
    // Extra response headers (e.g. Retry-After on 503).
    if (headers) this.headers = headers;
  }
}
