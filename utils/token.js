import jwt from 'jsonwebtoken';

const generateToken = (payload, tokenKey, tokenExpry) => {
    return jwt.sign(payload, tokenKey, {expiresIn: tokenExpry}); 
};

export default generateToken;