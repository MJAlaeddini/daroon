/** An error that is safe to show to the client: a stable code plus an HTTP status. */
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message = code,
  ) {
    super(message);
  }
}
export const badRequest = (code = 'bad_request') => new AppError(400, code);
export const unauthorized = (code = 'unauthorized') => new AppError(401, code);
export const forbidden = (code = 'forbidden') => new AppError(403, code);
export const notFound = (code = 'not_found') => new AppError(404, code);
export const tooMany = (code = 'too_many_requests') => new AppError(429, code);
export const unavailable = (code = 'unavailable') => new AppError(503, code);
