import type mongoose from "mongoose";
import { type TErrorSource, type TgenereicErrorResponse } from "../interfaces/errors";

const handleCastError = (
  err: mongoose.Error.CastError,
): TgenereicErrorResponse => {
  const errorSources: TErrorSource = [
    {
      path: err.path,
      message: err.message,
    },
  ];

  const statusCode = 400;
  return {
    statusCode,
    message: "Invalid ID",
    errorSources,
  };
};

export default handleCastError;
