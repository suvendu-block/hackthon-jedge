import mongoose from 'mongoose';


/// users schema's 
const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        maxlength: 50,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        maxlength: 100,
        select: false
    },
    role: {
        type: String,
        enum: ["organizer","judge", "team"],
        default: "team"
    }
},{timestamps: true});


const User = mongoose.model('User', userSchema);



export default User;