import JWT from "jsonwebtoken";

// name says it all — signs a JWT with the user id, valid 30 days
const generateToken = (id) => {
    return JWT.sign({ id }, process.env.JWT_SECRET, {expiresIn: "30d"});
}

export default generateToken;