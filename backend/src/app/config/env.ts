import path from "path";

import dotenv from "dotenv";
import { z } from "zod";

/**
 * Environment validation.
 *
 * Every value the server depends on is declared here and checked once, at boot.
 * A missing or malformed variable stops the process with a readable report
 * instead of surfacing as an `undefined` secret on the first request that needs
 * it — which is how "jwt must be provided" reaches production.
 */

dotenv.config({ path: path.join(process.cwd(), ".env") });

/** `15m`, `7d`, `900` — the duration forms jsonwebtoken accepts. */
const duration = z
  .string()
  .regex(/^\d+(ms|s|m|h|d|w|y)?$/, {
    message: "must be a number optionally suffixed with ms, s, m, h, d, w or y",
  });

/** Secrets short enough to brute force are worse than no secret at all. */
const secret = (label: string) =>
  z.string().min(32, {
    message: `${label} must be at least 32 characters — generate one with: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`,
  });

const numeric = (opts: { min: number; max: number; default: number }) =>
  z.coerce.number().int().min(opts.min).max(opts.max).default(opts.default);

const boolish = (fallback: boolean) =>
  z
    .enum(["true", "false", "1", "0"])
    .default(fallback ? "true" : "false")
    .transform((value) => value === "true" || value === "1");

/** Blank strings in a .env mean "not set", not "empty value". */
const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  // 3001, with the Next.js console on 3000. Not 5000: macOS AirPlay Receiver
  // occupies it and answers 403, so the API looks broken rather than absent.
  PORT: numeric({ min: 1, max: 65535, default: 3001 }),

  DATABASE_URL: z
    .string()
    .min(1, { message: "DATABASE_URL is required" })
    .refine((value) => /^mongodb(\+srv)?:\/\//.test(value), {
      message: "DATABASE_URL must start with mongodb:// or mongodb+srv://",
    }),
  DB_MAX_POOL_SIZE: numeric({ min: 1, max: 500, default: 100 }),
  DB_MIN_POOL_SIZE: numeric({ min: 0, max: 100, default: 5 }),

  BCRYPT_SALT_ROUNDS: numeric({ min: 10, max: 15, default: 12 }),
  DEFAULT_PASS: optionalText,

  JWT_ACCESS_SECRET: secret("JWT_ACCESS_SECRET"),
  JWT_ACCESS_EXPIRES_IN: duration.default("15m"),
  JWT_REFRESH_SECRET: secret("JWT_REFRESH_SECRET"),
  /**
   * A year, up from thirty days.
   *
   * A CRM someone opens twice a week should not sign them out every month —
   * that is the behaviour that trains people to pick a memorable password. The
   * long life is safe because the token is httpOnly (never readable from
   * JavaScript) and is refused outright once `tokensValidFrom` moves, which a
   * password change, a reset or an admin blocking the account all do.
   */
  JWT_REFRESH_EXPIRES_IN: duration.default("365d"),
  RESET_PASS_TOKEN: secret("RESET_PASS_TOKEN"),
  RESET_PASS_TOKEN_EXPIRES_IN: duration.default("15m"),
  REGISTER_VERIFY_TOKEN: secret("REGISTER_VERIFY_TOKEN"),
  REGISTER_VERIFY_TOKEN_EXPIRES_IN: duration.default("1d"),

  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  BACKEND_URL: z.string().url().default("http://localhost:3001"),
  CORS_EXTRA_ORIGINS: z.string().default(""),
  RESET_PASS_LINK: z.string().url().default("http://localhost:3000/reset-password"),
  VERIFY_REGISTRATION_LINK: z
    .string()
    .url()
    .default("http://localhost:3001/api/auth/verify-email"),

  EMAIL: optionalText,
  APP_PASS: optionalText,

  RATE_LIMIT_WINDOW_MINUTES: numeric({ min: 1, max: 1440, default: 15 }),

  /**
   * General per-IP ceiling.
   *
   * Raised from 300. The console issues roughly five requests per screen — the
   * list, its summary, the sidebar badges and the notification poll — so a
   * single user working through a dozen screens spends 60 of them. Behind an
   * office NAT every member of staff shares one key, and 300 per quarter hour
   * locked out the whole building within minutes of the morning login rush.
   *
   * 1200 is still two orders of magnitude below what a scraper needs, and the
   * credential endpoints keep their own much tighter limit below.
   */
  RATE_LIMIT_MAX_REQUESTS: numeric({ min: 10, max: 100_000, default: 1200 }),

  /**
   * Credential endpoints. Deliberately left tight: this one is keyed by IP *and*
   * the submitted identifier and skips successful attempts, so it counts only
   * failed sign-ins against one account from one address — which is exactly what
   * credential stuffing looks like, and nothing a legitimate user does.
   */
  AUTH_RATE_LIMIT_MAX_REQUESTS: numeric({ min: 3, max: 1000, default: 10 }),

  MAX_LOGIN_ATTEMPTS: numeric({ min: 3, max: 20, default: 5 }),
  ACCOUNT_LOCK_MINUTES: numeric({ min: 1, max: 1440, default: 15 }),

  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  TRUST_PROXY: boolish(false),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const report = parsed.error.issues
      .map((issue) => `  • ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");

    // Written straight to stderr: the logger itself depends on this config.
    process.stderr.write(
      `\nInvalid environment configuration — refusing to start.\n\n${report}\n\n` +
        `Copy .env.example to .env and fill in the missing values.\n\n`,
    );
    process.exit(1);
  }

  const env = parsed.data;

  if (env.DB_MIN_POOL_SIZE > env.DB_MAX_POOL_SIZE) {
    process.stderr.write(
      `\nInvalid environment configuration: DB_MIN_POOL_SIZE (${env.DB_MIN_POOL_SIZE}) ` +
        `cannot exceed DB_MAX_POOL_SIZE (${env.DB_MAX_POOL_SIZE}).\n\n`,
    );
    process.exit(1);
  }

  // Reusing one secret for two token types means a leaked reset token is also a
  // valid access token.
  const secrets = {
    JWT_ACCESS_SECRET: env.JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET: env.JWT_REFRESH_SECRET,
    RESET_PASS_TOKEN: env.RESET_PASS_TOKEN,
    REGISTER_VERIFY_TOKEN: env.REGISTER_VERIFY_TOKEN,
  };
  const distinct = new Set(Object.values(secrets));

  if (distinct.size !== Object.keys(secrets).length) {
    process.stderr.write(
      `\nInvalid environment configuration: JWT secrets must all differ. ` +
        `Reusing one lets a token minted for one purpose be replayed as another.\n\n`,
    );
    process.exit(1);
  }

  if (env.NODE_ENV === "production" && !env.TRUST_PROXY) {
    process.stderr.write(
      `Warning: NODE_ENV=production with TRUST_PROXY=false. If this runs behind a ` +
        `load balancer, every request appears to come from the proxy and rate limiting ` +
        `will throttle all users together.\n`,
    );
  }

  return env;
}

export const env: Env = loadEnv();

export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";

/** Origins allowed to send credentialed cross-origin requests. */
export const allowedOrigins: string[] = Array.from(
  new Set(
    [
      env.FRONTEND_URL,
      env.BACKEND_URL,
      ...env.CORS_EXTRA_ORIGINS.split(",").map((origin) => origin.trim()),
      // Development only. The console runs on 3000, but Next.js silently steps
      // to the next free port when 3000 is taken, and the resulting CORS
      // rejection reads as "the backend is broken" rather than "wrong port" —
      // so the first few fallbacks are allowed too. 5173 is Vite.
      ...(isProduction
        ? []
        : [
            "http://localhost:3000",
            "http://localhost:3002",
            "http://localhost:3003",
            "http://localhost:5173",
          ]),
    ].filter(Boolean),
  ),
);

/** True when outbound mail is configured; callers skip sending when false. */
export const isMailConfigured = Boolean(env.EMAIL && env.APP_PASS);
