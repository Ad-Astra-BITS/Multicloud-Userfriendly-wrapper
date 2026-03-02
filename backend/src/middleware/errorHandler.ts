import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
}

export function errorHandler(err: AppError, _req: Request, res: Response, _next: NextFunction): void {
  const statusCode = err.statusCode ?? 500;
  const message = err.message ?? 'Internal Server Error';

  console.error(`[ERROR] ${statusCode} — ${message}`);

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

export function notFound(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`,
  });
}
