import { type Request, type Response } from 'express';
import httpStatus from 'http-status-codes';

/**
 * Terminal handler for unmatched routes.
 *
 * Registered before the error handler, since Express only invokes 4-argument
 * middleware when an error is passed along.
 *
 * Standardised on `http-status-codes`; this was the one module still importing
 * the separate `http-status` package for the same constants.
 */
const Notfound = (req: Request, res: Response) => {
  res.status(httpStatus.NOT_FOUND).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} does not exist on this API.`,
    errorSources: [{ path: req.originalUrl, message: 'Not found' }],
    requestId: req.id,
  });
};

export default Notfound;
