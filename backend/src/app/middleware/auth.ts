import { type NextFunction, type Request, type Response } from "express";
import httpStatus from "http-status-codes";
import { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";

import config from "../config";
import ApiError from "../errors/ApiError";
import { USER_ROLES, type TUserRole } from "../modules/user-interface";
import { User } from "../modules/user.model";
import catchAsync from "../utils/catchAsync";
import { jwtHelpers } from "../utils/jwtHelper";

/**
 * Extracts the bearer token from the Authorization header, falling back to the
 * httpOnly cookie the login flow sets.
 *
 * The previous implementation passed the raw header value straight to
 * `jwt.verify`, so any client following the `Authorization: Bearer <token>`
 * convention was rejected — while `resetPassword` stripped the prefix, making
 * the two paths disagree. Both forms are accepted here.
 */
function extractToken(req: Request): string | undefined {
  const header = req.headers.authorization;

  if (typeof header === "string" && header.trim()) {
    const value = header.trim();
    const [scheme, ...rest] = value.split(/\s+/);

    if (scheme && /^bearer$/i.test(scheme)) {
      const token = rest.join(" ").trim();
      return token || undefined;
    }

    // Tolerate a bare token for older clients.
    return value;
  }

  const cookieToken = (req.cookies as Record<string, string> | undefined)?.accessToken;
  return cookieToken || undefined;
}

function assertKnownRoles(roles: string[]): TUserRole[] {
  const unknown = roles.filter((role) => !USER_ROLES.includes(role as TUserRole));

  if (unknown.length > 0) {
    // A typo'd role name would otherwise silently deny everyone.
    throw new Error(`auth() received unknown role(s): ${unknown.join(", ")}`);
  }

  return roles as TUserRole[];
}

/**
 * Authenticates the caller and, when roles are supplied, authorises them.
 *
 * The account is re-checked against the database on every request so that
 * blocking or deleting a user takes effect immediately rather than when their
 * access token happens to expire.
 */
const auth = (...roles: string[]) => {
  const allowed = assertKnownRoles(roles);

  return catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
    const token = extractToken(req);

    if (!token) {
      throw new ApiError(
        httpStatus.UNAUTHORIZED,
        "Authentication required. Send an Authorization: Bearer <token> header.",
      );
    }

    let decoded;

    try {
      decoded = jwtHelpers.verifyToken(token, config.jwt.jwt_access_secret);
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "Session expired. Please refresh your token.");
      }
      if (error instanceof JsonWebTokenError) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid authentication token.");
      }
      throw error;
    }

    if (typeof decoded !== "object" || decoded === null || !decoded.userId || !decoded.role) {
      throw new ApiError(httpStatus.UNAUTHORIZED, "Malformed authentication token.");
    }

    // Trust the stored record over the token payload: a role or status change
    // must not wait for token expiry to take effect.
    const account = await User.findById(String(decoded.userId))
      .select("role status")
      .lean<{ _id: unknown; role: TUserRole; status: string } | null>();

    if (!account) {
      throw new ApiError(httpStatus.UNAUTHORIZED, "Account no longer exists.");
    }

    if (account.status === "blocked") {
      throw new ApiError(httpStatus.FORBIDDEN, "This account has been blocked.");
    }

    if (account.status === "inactive") {
      throw new ApiError(httpStatus.FORBIDDEN, "Please verify your account before continuing.");
    }

    req.user = {
      ...decoded,
      userId: String(decoded.userId),
      email: decoded.email,
      phone: decoded.phone,
      role: account.role,
    };

    if (allowed.length > 0 && !allowed.includes(account.role)) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Your role does not have permission to perform this action.",
      );
    }

    next();
  });
};

export default auth;
