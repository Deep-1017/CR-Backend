import 'express';

declare global {
    namespace Express {
        interface User {
            id?: string;
            email?: string;
            role?: string;
            name?: string;
        }
    }
}

declare module 'express-serve-static-core' {
    interface Request {
        id: string;
        user?: Express.User;
    }
}
