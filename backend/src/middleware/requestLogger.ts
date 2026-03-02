import { Request, Response, NextFunction } from 'express';

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const ms = Date.now() - start;
    const status = res.statusCode;
    const color = status >= 500 ? RED : status >= 400 ? YELLOW : GREEN;
    const ts = new Date().toISOString();
    console.log(`${color}[${ts}] ${req.method} ${req.path} ${status} ${ms}ms${RESET}`);
  });

  next();
}
