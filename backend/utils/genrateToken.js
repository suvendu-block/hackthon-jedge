import JWT from "jsonwebtoken";



// genrate token
const genrateToken = (id) => {
    return JWT.sign({ id }, process.env.JWT_SECRET, {expiresIn: "30d"});
}




export default genrateToken;