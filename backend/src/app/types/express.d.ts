import { type JwtPayload } from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload & {
        userId: string;
        email?: string;
        phone?: string;
        role: string;
      };

      /**
       * Date-partitioned directory (`YYYY/MM/DD`) the current upload was written
       * to, set by the local avatar storage engine.
       */
      uploadRelativeDir?: string;

      // NOTE: `id` is intentionally not declared here. pino-http augments
      // http.IncomingMessage with `id: ReqId` (string | number); redeclaring it
      // as `string` conflicts and breaks every handler signature.
    }
  }
}

export {};