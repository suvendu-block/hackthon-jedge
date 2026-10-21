import express from 'express';
import {
    registerUser ,
    login,
    logout,
    me
} from '../controller/auth.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import validate from '../middleware/validate.middleware.js';
import { registerSchema, loginSchema } from '../schema/auth.schema.js';

const router = express.Router();

// validate() runs BEFORE the controller — bad body never reaches it
router.post('/register', validate(registerSchema), registerUser);
router.post('/login', validate(loginSchema), login);
router.post('/logout', protect, logout);
router.get('/me', protect, me);

export default router;
