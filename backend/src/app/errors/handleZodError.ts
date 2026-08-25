import { type ZodError } from "zod";
import { type TErrorSource, type TgenereicErrorResponse } from "../interfaces/errors";

const handleZodError = (err: ZodError): TgenereicErrorResponse => {
  const statusCode = 400;

  const errorSources: TErrorSource = err.issues.map((issue) => {
    // Zod reports a path segment as a PropertyKey, which includes symbols, and
    // leaves the path empty for an error on the root value. Both are narrowed
    // here rather than cast away, so a symbol key cannot reach the response as
    // "Cannot convert a Symbol value to a string" and a root-level error is
    // reported with the same empty path the rest of the handlers use.
    const last = issue.path[issue.path.length - 1];

    return {
      path: typeof last === "string" || typeof last === "number" ? last : String(last ?? ""),
      message: issue.message,
    };
  });

  return {
    statusCode,
    message: "Validation Error",
    errorSources,
  };
};

export default handleZodError;
