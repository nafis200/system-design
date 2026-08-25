import pino from "pino";

import { env, isProduction, isTest } from "../config/env";

/**
 * Structured logging.
 *
 * JSON in production so a log shipper can parse it; human-readable in
 * development. Credentials and tokens are redacted at the logger rather than at
 * every call site, so a future `logger.info({ req })` cannot leak an
 * Authorization header by accident.
 */
export const logger = pino({
  level: isTest ? "silent" : env.LOG_LEVEL,

  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
      "*.password",
      "*.passwordHash",
      "*.oldPassword",
      "*.newPassword",
      "*.accessToken",
      "*.refreshToken",
      "*.token",
      "password",
      "passwordHash",
      "accessToken",
      "refreshToken",
    ],
    censor: "[redacted]",
  },

  base: { service: "taojoo-crm-api", env: env.NODE_ENV },

  formatters: {
    level: (label) => ({ level: label }),
  },

  ...(isProduction
    ? { timestamp: pino.stdTimeFunctions.isoTime }
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname,service,env" },
        },
      }),
});

export type Logger = typeof logger;
