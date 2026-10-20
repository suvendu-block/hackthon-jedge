import jwt from 'jsonwebtoken';
import User from '../model/user.model.js';




// authorization
export const protect = async (req,res,next) => {
    try {
        const header = req.headers.authorization;

        // header bearer
        if (!header || !header.startsWith('Bearer ')) {
            return res.status(401).json({
                error: {code: "UNAUTHORIZED",message: "Not Authenticated"}
            });
        }

        // decoded
        const decoded = jwt.verify(header.split(' ')[1],process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);


        // not user
        if (!user) {
            return res.status(401).json({
                error: {code: "UNAUTHORIZED", message: "User no longer exists"}
            });
        }


        /// everything is fine 
        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({
            error: {code: "Invalid token", message: "invalid or expired token "}
        });

    };
}




/// roles
export const requireRole = (...roles) => (req,res,next) => {
    if (!roles.includes(req.user.role)) {
        return res.status(403).json({
            error: {code: "FORBIDDEN" , message: "Insufficient Permissions"}
        })
    }
    next();
}