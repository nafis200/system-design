import jwt, {
  type JwtPayload,
  type SignOptions,
} from "jsonwebtoken";

const generateToken = (
  payload: object,
  secret: string,
  expiresIn: string
): string => {
  return jwt.sign(
    payload,
    secret,
    {
      expiresIn,
    } as SignOptions
  );
};

const verifyToken = (
  token: string,
  secret: string
): JwtPayload => {
  return jwt.verify(token, secret) as JwtPayload;
};

export const jwtHelpers = {
  generateToken,
  verifyToken,
};