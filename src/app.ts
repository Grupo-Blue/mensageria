import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import 'express-async-errors';
import swaggerUi from 'swagger-ui-express';
import swaggerFile from './swagger.json';

import routes from './routes';
import AppError from './errors/AppError';


const app = express();

app.use(express.json());
app.use(cors());
app.use(routes);

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerFile))

app.use((err: Error, req: Request, res: Response, _: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.error,
    });
  }
  if (err instanceof Error) {
    return res.status(400).json({ error: err.message });
  }

  return res.status(500).json({
    error: 'Erro interno de servidor',
  });
});



export default app;
