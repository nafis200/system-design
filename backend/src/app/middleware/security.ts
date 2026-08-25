import crypto from "crypto";

import compression from "compression";
import cors from "cors";
import { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import httpStatus from "http-status-codes";
import pinoHttp from "pino-http";

import config from "../config";
import { allowedOrigins, isProduction } from "../config/env";
import ApiError from "../errors/ApiError";
import { logger } from "../utils/logger";

/**
 * Cross-cutting request middleware: correlation IDs, logging, compression,
 * security headers, CORS, rate limiting and payload sanitisation.
 */

/** Correlates every log line and error response for a single request. */
export const requestId = (req: Request, res: Response, next: NextFunction) => {
  const incoming = req.headers["x-request-id"];
  const id =
    typeof incoming === "string" && incoming.length > 0 && incoming.length <= 200
      ? incoming
      : crypto.randomUUID();

  req.id = id;
  res.setHeader("X-Request-Id", id);
  next();
};

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => (req as Request).id ?? crypto.randomUUID(),

  // Health checks would otherwise dominate the log volume.
  autoLogging: {
    ignore: (req) => req.url === "/health" || req.url === "/ready",
  },

  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },

  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});

export const securityHeaders = helmet({
  // This is a JSON API, so the restrictive default CSP costs nothing. Uploaded
  // avatars are served from the same origin, hence 'self' for images.
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      imgSrc: ["'self'", "data:"],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" }, // the front end loads /users/* avatars
  referrerPolicy: { policy: "no-referrer" },
  hsts: isProduction ? { maxAge: 31_536_000, includeSubDomains: true, preload: true } : false,
});

export const corsMiddleware = cors({
  origin(origin, callback) {
    // Same-origin and non-browser callers (curl, server-to-server) send no Origin.
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new ApiError(httpStatus.FORBIDDEN, `Origin ${origin} is not allowed`));
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
  exposedHeaders: ["X-Request-Id", "RateLimit-Remaining", "RateLimit-Reset"],
  maxAge: 600,
});

export const responseCompression = compression({
  // Small JSON bodies cost more to compress than they save.
  threshold: 1024,
});

const rateLimitHandler = (req: Request, res: Response) => {
  logger.warn({ ip: req.ip, path: req.originalUrl, reqId: req.id }, "rate limit exceeded");
  res.status(httpStatus.TOO_MANY_REQUESTS).json({
    success: false,
    message: "Too many requests. Please slow down and try again shortly.",
    errorSources: [{ path: req.originalUrl, message: "Rate limit exceeded" }],
  });
};

/**
 * NOTE: these limiters are backed by in-process memory. Behind more than one
 * instance each process keeps its own counters, so the effective limit is
 * `max × instances`. Swap in a shared store (`rate-limit-redis`) when you scale
 * horizontally.
 */
export const globalRateLimiter = rateLimit({
  windowMs: config.security.rate_limit_window_ms,
  max: config.security.rate_limit_max,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: (req) => req.path === "/health" || req.path === "/ready",
});

/**
 * Tight limit for credential endpoints. Keyed by IP *and* the submitted
 * identifier so one attacker cannot lock out an entire office NAT, and so
 * rotating identifiers from a single IP is still throttled.
 */
export const authRateLimiter = rateLimit({
  windowMs: config.security.rate_limit_window_ms,
  max: config.security.auth_rate_limit_max,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitHandler,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const body = req.body as { email?: unknown; phone?: unknown } | undefined;
    const identifier =
      (typeof body?.email === "string" && body.email.toLowerCase()) ||
      (typeof body?.phone === "string" && body.phone) ||
      "anonymous";
    // ipKeyGenerator normalises IPv6 so a /64 cannot be used to bypass the limit.
    return `${ipKeyGenerator(req.ip ?? "")}:${identifier}`;
  },
});

const FORBIDDEN_KEY = /^\$|\./;

/**
 * Recursively drops keys that Mongo treats as operators (`$gt`, `$ne`) or as
 * dotted paths. Without this, `?role[$ne]=admin` or a crafted JSON body reaches
 * `.find()` as a query operator instead of a value.
 *
 * Express 5 exposes `req.query` through a getter, so it is sanitised in place
 * rather than reassigned.
 */
function stripOperators(value: unknown, path: string, hits: string[], depth = 0): void {
  if (depth > 10 || value === null || typeof value !== "object") return;

  if (Array.isArray(value)) {
    value.forEach((entry, index) => stripOperators(entry, `${path}[${index}]`, hits, depth + 1));
    return;
  }

  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEY.test(key)) {
      delete (value as Record<string, unknown>)[key];
      hits.push(path ? `${path}.${key}` : key);
      continue;
    }
    stripOperators((value as Record<string, unknown>)[key], path ? `${path}.${key}` : key, hits, depth + 1);
  }
}

export const sanitizeRequest = (req: Request, _res: Response, next: NextFunction) => {
  const hits: string[] = [];

  if (req.body && typeof req.body === "object") stripOperators(req.body, "body", hits);
  if (req.params && typeof req.params === "object") stripOperators(req.params, "params", hits);

  try {
    if (req.query && typeof req.query === "object") stripOperators(req.query, "query", hits);
  } catch {
    // Some Express 5 configurations expose an immutable query object; the
    // QueryBuilder allow-list is the backstop in that case.
  }

  if (hits.length > 0) {
    logger.warn({ reqId: req.id, ip: req.ip, path: req.originalUrl, keys: hits }, "stripped operator-like keys from request");
  }

  next();
};

/**
 * Rejects duplicated query parameters (`?limit=10&limit=9999`), which arrive as
 * arrays and would otherwise reach code expecting a single string.
 */
export const rejectParameterPollution = (req: Request, _res: Response, next: NextFunction) => {
  const duplicated = Object.entries(req.query ?? {})
    .filter(([, value]) => Array.isArray(value))
    .map(([key]) => key);

  if (duplicated.length > 0) {
    next(
      new ApiError(
        httpStatus.BAD_REQUEST,
        `Repeated query parameter(s): ${duplicated.join(", ")}. Send each parameter once.`,
      ),
    );
    return;
  }

  next();
};
