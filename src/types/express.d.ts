import 'express';

declare module 'express-serve-static-core' {
    interface Request {
        id: string;
        user?: {
            id: string;
            role: 'customer' | 'admin';
            email: string;
            name: string;
        };
    }
}
