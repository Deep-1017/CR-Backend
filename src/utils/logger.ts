import { createLogger, format, transports } from 'winston';
import env from '../config/env';

const logger = createLogger({
    level: env.isProduction ? 'info' : 'debug',
    format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.json()
    ),
    transports: [
        new transports.Console({
            format: format.combine(
                format.colorize(),
                format.simple()
            ),
        }),
    ],
});

// FIX-23: Morgan-compatible stream — HTTP access logs flow through Winston
export const morganStream = {
    write: (message: string) => logger.http(message.trim()),
};

export default logger;
