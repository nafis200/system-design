import { env } from "./env";

/**
 * Application config.
 *
 * Shape is unchanged from before so existing imports keep working, but every
 * value now comes from the boot-time validated environment in `./env`. That
 * makes these fields non-optional strings — the `as string` casts scattered
 * around call sites are no longer load-bearing.
 */
export default {
  NODE_ENV: env.NODE_ENV,
  port: env.PORT,
  database_url: env.DATABASE_URL,

  db: {
    max_pool_size: env.DB_MAX_POOL_SIZE,
    min_pool_size: env.DB_MIN_POOL_SIZE,
  },

  jwt: {
    bcrypt_salt_rounds: env.BCRYPT_SALT_ROUNDS,
    default_password: env.DEFAULT_PASS,
    jwt_access_secret: env.JWT_ACCESS_SECRET,
    jwt_refresh_secret: env.JWT_REFRESH_SECRET,
    jwt_access_expires_in: env.JWT_ACCESS_EXPIRES_IN,
    jwt_refresh_expires_in: env.JWT_REFRESH_EXPIRES_IN,
    reset_pass_secret: env.RESET_PASS_TOKEN,
    reset_pass_token_expires_in: env.RESET_PASS_TOKEN_EXPIRES_IN,
    register_verify_token: env.REGISTER_VERIFY_TOKEN,
    register_verify_token_expires_in: env.REGISTER_VERIFY_TOKEN_EXPIRES_IN,
  },

  reset_pass_link: env.RESET_PASS_LINK,
  registration_link: env.VERIFY_REGISTRATION_LINK,
  frontend_url: env.FRONTEND_URL,
  backend_url: env.BACKEND_URL,

  emailSender: {
    email: env.EMAIL,
    app_pass: env.APP_PASS,
  },

  security: {
    rate_limit_window_ms: env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
    rate_limit_max: env.RATE_LIMIT_MAX_REQUESTS,
    auth_rate_limit_max: env.AUTH_RATE_LIMIT_MAX_REQUESTS,
    max_login_attempts: env.MAX_LOGIN_ATTEMPTS,
    account_lock_ms: env.ACCOUNT_LOCK_MINUTES * 60 * 1000,
    trust_proxy: env.TRUST_PROXY,
  },

  log_level: env.LOG_LEVEL,
};
