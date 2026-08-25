import { type Response } from "express";

import config from "../config";
import { isProduction } from "../config/env";

export interface AuthTokens {
  accessToken?: string;
  refreshToken?: string;
}

/**
 * Turns `15m` / `30d` / `900` into milliseconds.
 *
 * The cookie's lifetime has to match the token's. When they drift the browser
 * keeps sending a credential the server has already stopped honouring — which
 * looks to the user like being signed out at random.
 */
function durationToMs(value: string, fallbackMs: number): number {
  const match = /^(\d+)(ms|s|m|h|d|w|y)?$/.exec(String(value).trim());

  if (!match) return fallbackMs;

  const amount = Number(match[1]);

  const unit: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
    w: 604_800_000,
    y: 31_536_000_000,
  };

  return amount * (unit[match[2] ?? "s"] ?? 1000);
}

/**
 * Writes the session cookies.
 *
 * The refresh cookie is the one that keeps somebody signed in: the access token
 * expires in minutes and is replaced silently, while this is what the client
 * exchanges for a new one. It stays httpOnly so the long-lived credential is
 * never readable from JavaScript, which is the whole reason it can be long-lived
 * in the first place.
 */
export const setAuthCookie = (
  res: Response,
  tokenInfo: AuthTokens
) => {
  const base = {
    httpOnly: true,
    secure: isProduction,
    // Cross-site in production, where the console and the API sit on different
    // domains and a Lax cookie would never be sent at all.
    sameSite: isProduction ? ("none" as const) : ("lax" as const),
    path: "/",
  };

  if (tokenInfo.accessToken) {
    res.cookie("accessToken", tokenInfo.accessToken, {
      ...base,
      maxAge: durationToMs(config.jwt.jwt_access_expires_in, 15 * 60 * 1000),
    });
  }

  if (tokenInfo.refreshToken) {
    res.cookie("refreshToken", tokenInfo.refreshToken, {
      ...base,
      maxAge: durationToMs(
        config.jwt.jwt_refresh_expires_in,
        365 * 24 * 60 * 60 * 1000
      ),
    });
  }
};

/** Clears both cookies with the same attributes they were set with. */
export const clearAuthCookies = (res: Response) => {
  const base = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? ("none" as const) : ("lax" as const),
    path: "/",
  };

  res.clearCookie("accessToken", base);
  res.clearCookie("refreshToken", base);
};
