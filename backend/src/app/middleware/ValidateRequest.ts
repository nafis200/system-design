import { type ZodObject } from 'zod';
import { type Request, type Response, type NextFunction } from 'express';

const ValidateRequest = (schema: ZodObject) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
      });
      next();
    } catch (error) {
      next(error);
    }
  };
};

export default ValidateRequest;