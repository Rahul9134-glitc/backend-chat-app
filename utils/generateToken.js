import jwt from "jsonwebtoken";

export const generateToken = async (user, message, statusCode, res) => {
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET_KEY, {
        expiresIn: process.env.JWT_EXPIRE,
    });

    const cookieOptions = {
        httpOnly: true, 
        maxAge: Number(process.env.COOKIE_EXPIRE) * 24 * 60 * 60 * 1000, 
        sameSite: process.env.NODE_ENV === "production" ? "none" : 'lax',
        secure: process.env.NODE_ENV === "production", 
    };

    return res
        .status(statusCode)
        .cookie("token", token, cookieOptions)
        .json({
            success: true,
            message,
            user: {
                _id: user._id,
                name: user.fullname,
                email: user.email,
            },
            token,
        });
};