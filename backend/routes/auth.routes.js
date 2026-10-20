import express from 'express';
import {
    registerUser ,
    login,
    logout,
    me
} from '../controller/auth.controller.js';
import { protect } from '../middleware/auth.middleware.js';





const router = express.Router();




router.post('/register',registerUser);
router.post('/login',login);
router.post('/logout',protect,logout);
router.get('/me',protect,me);




export default router;