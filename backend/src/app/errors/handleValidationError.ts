import type mongoose from 'mongoose';
import { type TErrorSource, type TgenereicErrorResponse } from '../interfaces/errors';

const handleValidationError = (
  err: mongoose.Error.ValidationError,
): TgenereicErrorResponse => {
  const errorSources: TErrorSource = Object.values(err.errors).map(
    (val: mongoose.Error.ValidatorError | mongoose.Error.CastError) => {
      return {
        path: val.path || '',
        message: val.message || 'Invalid value',
      };
    },
  );

  const statusCode = 400;
  return {
    statusCode,
    message: 'Validation Error',
    errorSources,
  };
};

export default handleValidationError;