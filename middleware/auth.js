import jwt from 'jsonwebtoken';
import User from '../models/user.js';
import AppError from '../utils/AppError.js';

// Protect routes
export const protectRoutes = async (req, res, next) => { 
    try { 
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next(new AppError('Not logged in or invalid token', 401));
        }

        const token = authHeader.split(' ')[1].trim();

        // 1. Verify token signature
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_KEY);

        // 2. 🛡️ Live Security Check: Verify the user still exists in the database
        const currentUser = await User.findByPk(decoded.id);
        if (!currentUser) {
            return next(new AppError('The user belonging to this token no longer exists.', 401));
        }

        
        req.user = currentUser; 
        
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return next(new AppError('Token expired', 401));
        }
        return next(new AppError('Invalid token', 401));
    }
};



export const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        // If no token is provided, just move to the next function as a "Guest"
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }

        const token = authHeader.split(' ')[1].trim();

        // 1. Verify token signature
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_KEY);

        // 2. Live Security Check: Verify the user still exists
        // If the token is valid but the user was deleted, we treat them as a guest
        const currentUser = await User.findByPk(decoded.id);
        
        if (currentUser) {
            req.user = currentUser;
        }
        
        next();
    } catch (err) {
        // If token is expired or invalid, simply proceed as a guest.
        // Do NOT call next(new AppError(...)) here, or it will block the request.
        next();
    }
};

// Grant access to specific roles
export const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return next(
                new AppError('User role not authorized to access this route', 403)
            );
        }
        next();
    };
};