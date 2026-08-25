import httpStatus from "http-status-codes";
import { type JwtPayload } from "jsonwebtoken";

import ApiError from "../errors/ApiError";
import config from "../config";
import { User } from "../modules/user.model";
import { jwtHelpers } from "./jwtHelper";



export const createUserTokens = (user: {
  _id: unknown;
  email?: string;
  phone?: string;
  role: string;
}) => {
  const jwtPayload = {
    userId: String(user._id),
    email: user.email,
    phone: user.phone,
    role: user.role,
  };

  const accessToken = jwtHelpers.generateToken(
    jwtPayload,
    config.jwt.jwt_access_secret as string,
    config.jwt.jwt_access_expires_in as string
  );

  const refreshToken = jwtHelpers.generateToken(
    jwtPayload,
    config.jwt.jwt_refresh_secret as string,
    config.jwt.jwt_refresh_expires_in as string
  );

  return {
    accessToken,
    refreshToken,
  };
};

export const createNewAccessTokenWithRefreshToken = async (
  refreshToken: string
) => {
  const verifiedRefreshToken = jwtHelpers.verifyToken(
    refreshToken,
    config.jwt.jwt_refresh_secret as string
  ) as JwtPayload;

  if (!verifiedRefreshToken.userId) {
    throw new ApiError(
      httpStatus.UNAUTHORIZED,
      "Invalid refresh token"
    );
  }

  const user = await User.findById(
    verifiedRefreshToken.userId
  ).select("+tokensValidFrom");

  if (!user) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      "User does not exist"
    );
  }

  /**
   * Refuse tokens minted before the account's session cutoff.
   *
   * Without this a stolen refresh token stayed usable for its full 30-day life
   * even after the owner changed or reset their password — the reset would lock
   * out the legitimate user while leaving the attacker's session intact.
   */
  if (user.tokensValidFrom && verifiedRefreshToken.iat) {
    const issuedAtMs = verifiedRefreshToken.iat * 1000;

    // One second of slack absorbs the rounding in the JWT `iat` claim, which has
    // second granularity while tokensValidFrom is millisecond-precise.
    if (issuedAtMs < user.tokensValidFrom.getTime() - 1000) {
      throw new ApiError(
        httpStatus.UNAUTHORIZED,
        "This session has been revoked. Please sign in again."
      );
    }
  }

  if (user.status === "blocked") {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "User is blocked"
    );
  }

  if (user.status === "inactive") {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "User is inactive"
    );
  }

  const jwtPayload = {
    userId: String(user._id),
    email: user.email,
    phone: user.phone,
    role: user.role,
  };

  const accessToken = jwtHelpers.generateToken(
    jwtPayload,
    config.jwt.jwt_access_secret as string,
    config.jwt.jwt_access_expires_in as string
  );

  return accessToken;
};