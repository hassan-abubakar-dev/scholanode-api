import jwt from "jsonwebtoken";
import AppError from "../utils/AppError.js";

const verifyInitialPaymentToken = (token) => {
    if (!token || typeof token !== "string") {
        throw new AppError(
            "Initial payment authorization token is required.",
            401
        );
    }

    if (!process.env.INITIAL_PAYMENT_TOKEN_KEY) {
        throw new AppError(
            "Initial payment token configuration is missing.",
            500
        );
    }

    let decoded;

    try {
        decoded = jwt.verify(
            token,
            process.env.INITIAL_PAYMENT_TOKEN_KEY
        );
    } catch (error) {
        if (
            error instanceof jwt.TokenExpiredError ||
            error instanceof jwt.JsonWebTokenError
        ) {
            throw new AppError(
                "Your payment session has expired or is invalid. Please verify your account again.",
                401
            );
        }

        throw error;
    }

    if (
        decoded.purpose !== "initial_payment" ||
        !decoded.id ||
        !decoded.schoolId
    ) {
        throw new AppError(
            "Invalid initial payment authorization token.",
            401
        );
    }

    return {
        userId: decoded.id,
        schoolId: decoded.schoolId,
    };
};

export default verifyInitialPaymentToken;