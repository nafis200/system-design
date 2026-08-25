import { type ErrorRequestHandler } from 'express';
import httpStatus from 'http-status-codes';
import { MulterError } from 'multer';
import { ZodError } from 'zod';

import { isProduction } from '../config/env';
import handleCastError from '../errors/handleCastError';
import handleDuplicateError from '../errors/handleDuplicateError';
import handleValidationError from '../errors/handleValidationError';
import handleZodError from '../errors/handleZodError';
import ApiError from '../errors/ApiError';
import { type TErrorSource } from '../interfaces/errors';
import { logger } from '../utils/logger';

/** MongoDB's duplicate-key error code. */
const DUPLICATE_KEY = 11000;

const globalErrorhandler: ErrorRequestHandler = (err, req, res, _next) => {
  let statusCode = httpStatus.INTERNAL_SERVER_ERROR;
  let message = 'Something went wrong';
  let errorSources: TErrorSource = [{ path: '', message: 'Something went wrong' }];

  if (err instanceof ZodError) {
    const simplified = handleZodError(err);
    statusCode = simplified.statusCode;
    message = simplified.message;
    errorSources = simplified.errorSources;
  } else if (err?.name === 'ValidationError') {
    const simplified = handleValidationError(err);
    statusCode = simplified.statusCode;
    message = simplified.message;
    errorSources = simplified.errorSources;
  } else if (err?.name === 'CastError') {
    const simplified = handleCastError(err);
    statusCode = simplified.statusCode;
    message = simplified.message;
    errorSources = simplified.errorSources;
  } else if (err?.code === DUPLICATE_KEY || err?.code === String(DUPLICATE_KEY)) {
    // Previously compared against the string '11000' while the driver reports a
    // number, so duplicate keys fell through to a generic 500 instead of a 400.
    const simplified = handleDuplicateError(err);
    statusCode = simplified.statusCode;
    message = simplified.message;
    errorSources = simplified.errorSources;
  } else if (err instanceof MulterError) {
    statusCode =
      err.code === 'LIMIT_FILE_SIZE'
        ? httpStatus.REQUEST_TOO_LONG
        : httpStatus.BAD_REQUEST;
    message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'The uploaded file is larger than the 5 MB limit.'
        : `Upload rejected: ${err.message}`;
    errorSources = [{ path: err.field ?? '', message }];
  } else if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    errorSources = [{ path: '', message: err.message }];
  } else if (err instanceof Error) {
    // Unrecognised errors keep a 500 and a generic message in production; the
    // detail goes to the log, not to the client.
    message = isProduction ? 'Something went wrong' : err.message;
    errorSources = [{ path: '', message }];
  }

  // Server faults are our bug; client faults are theirs. Log accordingly so
  // 4xx noise does not bury real incidents.
  const logPayload = {
    err,
    reqId: req.id,
    method: req.method,
    url: req.originalUrl,
    statusCode,
    ip: req.ip,
  };

  if (statusCode >= 500) {
    logger.error(logPayload, 'request failed');
  } else {
    logger.warn(logPayload, 'request rejected');
  }

  res.status(statusCode).json({
    success: false,
    message,
    errorSources,
    requestId: req.id,
    // A stack trace tells an attacker your directory layout and dependencies.
    ...(isProduction ? {} : { stack: err instanceof Error ? err.stack : undefined }),
  });
};

export default globalErrorhandler;
