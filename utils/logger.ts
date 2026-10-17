import winston from 'winston';
import { env } from '@config/env';

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} [${level}] ${message}`),
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/test-run.log', options: { flags: 'a' } }),
  ],
});
