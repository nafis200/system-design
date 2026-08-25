import cookieParser from 'cookie-parser';
import express, { type Application, type Request, type Response } from 'express';

const app: Application = express();

app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true, limit: '256kb' }));
app.use(cookieParser());


app.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'TaoJoo CRM API',
    docs: '/health for liveness, /ready for readiness',
  });
});


export default app;
