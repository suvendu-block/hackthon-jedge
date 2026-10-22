import bcrypt from 'bcryptjs';
import generateToken from '../utils/generateToken.js';
import User from '../models/user.model.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';


// signResponse — the shape the frontend auth flow depends on
const signResponse = (user) => ({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    token: generateToken(user._id)
});


/// register
export const registerUser = catchAsync(async (req, res) => {
    const { name, email, password, role } = req.body;

    // something is empty
    if (!name || !email || !password || !role) {
        throw new AppError('name, email and password is required', 400, 'MISSING FIELDS');
    }

    // password length check
    if (password.length < 8) {
        throw new AppError('Password must be at least 8 characters long.....', 400, 'Weak Password');
    }

    /// user already exists
    const exists = await User.findOne({ email });
    if (exists) {
        throw new AppError('Email Already registered', 400, 'Email Already Taken');
    }

    // hash password
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: passwordHash, role });

    return res.status(201).json(signResponse(user));
});


/// login
export const login = catchAsync(async (req, res) => {
    const { email, password } = req.body;

    // hash & compare
    const user = await User.findOne({ email }).select('+password');
    const valid = user && (await bcrypt.compare(password, user.password));

    // not valid — same message for both cases (no user enumeration)
    if (!valid) {
        throw new AppError('Invalid Email or Password', 401, 'Invalid Credentials');
    }

    return res.json(signResponse(user));
});


/// logout
export const logout = async (req, res) => {
    res.clearCookie('token');
    return res.json({ message: 'Logged out successfully' });
};


/// me — the logged-in user (req.user set by protect middleware)
export const me = async (req, res) => {
    const { _id, name, email, role } = req.user;
    res.json({ _id, name, email, role });
};
