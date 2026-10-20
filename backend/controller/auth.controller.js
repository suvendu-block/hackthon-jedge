import  bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import GenrateToken from '../utils/genrateToken.js';
import User from '../model/user.model.js';





// signResponse 

const signResponse = (user) => ({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    token: GenrateToken(user._id)
});


/// register 
export const registerUser = async (req,res) => {
    try {
        const { name, email, password, role} = req.body;


        // something is empty
        if(!name || !email || !password || !role) {
            return res.status(400).json({
                error: {code : "MISSING FIELDS" , message: "name , email and password is required"}

            });

        }
        // password length check
        if(password.length < 8) {
            return res.status(400).json({
                error: {code : "Weak Password" , message: "Password must be at least 8 characters long....."},
            })
        }


        /// user already exists
        const exists = await User.findOne({email});
        if (exists) {
            return res.status(400).json({
                error: {code : "Email Already Taken", message: "Email Already registered"}
            })
        }


        // hash password
        const passwordHash = await bcrypt.hash(password, 10);
        const user = await User.create({name,email,password: passwordHash,role});


        return res.status(201).json(signResponse(user));
    } catch (error) {
        console.error("Register Error", error.message);
        res.status(500).json({
            error: {code : "Server Error" , messsage: "Registration Failed"}
        });
    }
}

















/// login 

export const login = async (req,res) => {
    try {
        const {email,password} = req.body;
        

        // hash & compare
        const user = await User.findOne({ email }).select("+password");
        const valid = user && (await bcrypt.compare(password,user.password));

        // not valid 
        if (!valid) {
            return res.status(401).json({
                error: {code : "Invalid Credentials", message: "Invalid Email or Password"}
            });
        };


        return res.json(signResponse(user));
    } catch (error) {
        console.error('Login Error',error.message);
        res.status(500).json({
            error: {code: 'Server Error', message: "Login Failed"}
        });
    };
}





/// logout 
export const logout = async (req,res) => {
    res.clearCookie("token");
    return res.json({ message: "Logged out successfully" });
};



/// admin (me)
export const me = async (req,res) => {
    const {_id,name,email,role} = req.user;
    res.json({_id,name,email,role});
}