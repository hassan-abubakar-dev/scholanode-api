import bcrypt from "bcryptjs";
import { Op } from "sequelize";

import AppError from "../utils/AppError.js";
import sendEmail from "../config/emailService.js";
import generateVerificationCode from "../utils/verificationCode.js";
import generateExpiryTime from "../utils/experyTime.js";

import { User } from "../relationships/associations.js";
import VerificationCode from "../models/VerificationCode.js";

const EMAIL_CHANGE_PURPOSE = "PROFILE_EMAIL_CHANGE";

const getAuthenticatedUser = async (req) => {
    const user = await User.findByPk(req.user.id);

    if (!user) {
        throw new AppError("User account not found.", 404);
    }

    if (user.status !== "ACTIVE") {
        throw new AppError("Your account is not active.", 403);
    }

    return user;
};

// ======================================================
// UPDATE PROFILE INFORMATION
// PATCH /profile
// ======================================================

export const updateProfile = async (req, res, next) => {
    try {
        const user = await getAuthenticatedUser(req);

        // Students cannot update their first name or surname here.
        if (user.role === "STUDENT") {
            throw new AppError(
                "Students cannot update these profile fields.",
                403
            );
        }

        const { firstName, surName } = req.body;

        if (firstName !== undefined) {
            user.firstName = firstName;
        }

        if (surName !== undefined) {
            user.surName = surName;
        }

        await user.save();

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully.",
            user: {
                id: user.id,
                firstName: user.firstName,
                surName: user.surName,
                email: user.email,
                phoneNumber: user.phoneNumber,
                profileImageUrl: user.profileImageUrl,
                role: user.role,
            },
        });
    } catch (error) {
        next(error);
    }
};

// ======================================================
// REQUEST EMAIL CHANGE
// POST /profile/email-change/request
// ======================================================

export const requestEmailChange = async (req, res, next) => {
    try {
        const user = await getAuthenticatedUser(req);

        const { newEmail, currentPassword } = req.body;

        const normalizedEmail = newEmail.trim().toLowerCase();
        const currentEmail = user.email?.trim().toLowerCase();

        if (normalizedEmail === currentEmail) {
            throw new AppError(
                "The new email address is the same as your current email.",
                400
            );
        }

        const passwordMatches = await bcrypt.compare(
            currentPassword,
            user.passwordHash
        );

        if (!passwordMatches) {
            throw new AppError("Current password is incorrect.", 401);
        }

        // Emails are checked across all schools because account recovery
        // currently searches users by email without a school restriction.
        const existingUser = await User.findOne({
            where: {
                email: normalizedEmail,
                id: { [Op.ne]: user.id },
            },
        });

        if (existingUser) {
            throw new AppError(
                "This email address is already associated with an account.",
                409
            );
        }

        const code = String(generateVerificationCode()).padStart(6, "0");
        const expiryTime = generateExpiryTime();

        // Replace only this user's pending profile-email verification codes.
        // Never delete password-reset codes as part of this operation.
        await VerificationCode.destroy({
            where: {
                userId: user.id,
                purpose: EMAIL_CHANGE_PURPOSE,
            },
        });

        await VerificationCode.create({
            code,
            expiryTime,
            userEmail: normalizedEmail,
            userId: user.id,
            purpose: EMAIL_CHANGE_PURPOSE,
        });

        try {
            await sendEmail(
                normalizedEmail,
                "Verify your new ScholaNode email address",
                `
                    <div style="font-family:Arial,sans-serif;line-height:1.6">
                        <h2>Email address verification</h2>
                        <p>Hello ${user.firstName},</p>
                        <p>
                            You requested to change the email address
                            associated with your ScholaNode account.
                        </p>
                        <p>Your verification code is:</p>
                        <h1 style="letter-spacing:6px">${code}</h1>
                        <p>
                            This code expires shortly. If you did not
                            request this change, you can ignore this email.
                        </p>
                    </div>
                `
            );
        } catch (emailError) {
            await VerificationCode.destroy({
                where: {
                    userId: user.id,
                    purpose: EMAIL_CHANGE_PURPOSE,
                    userEmail: normalizedEmail,
                    code,
                },
            });

            throw emailError;
        }

        return res.status(200).json({
            success: true,
            message:
                "A verification code has been sent to your new email address.",
        });
    } catch (error) {
        next(error);
    }
};

// ======================================================
// VERIFY EMAIL CHANGE
// POST /profile/email-change/verify
// ======================================================

export const verifyEmailChange = async (req, res, next) => {
    try {
        const user = await getAuthenticatedUser(req);

        const { newEmail, code } = req.body;
        const normalizedEmail = newEmail.trim().toLowerCase();

        // Find a code belonging to this authenticated user, for this exact
        // email address, and for this specific verification purpose.
        const verification = await VerificationCode.findOne({
            where: {
                userId: user.id,
                userEmail: normalizedEmail,
                code,
                purpose: EMAIL_CHANGE_PURPOSE,
            },
        });

        if (!verification) {
            throw new AppError(
                "Invalid verification code or email address.",
                400
            );
        }

        if (Number(verification.expiryTime) <= Date.now()) {
            await verification.destroy();

            throw new AppError(
                "Verification code has expired. Request a new code.",
                400
            );
        }

        if (user.email?.trim().toLowerCase() === normalizedEmail) {
            await verification.destroy();

            throw new AppError(
                "This is already your current email address.",
                400
            );
        }

        // Recheck availability because another account might have claimed
        // this address after the verification code was requested.
        const existingUser = await User.findOne({
            where: {
                email: normalizedEmail,
                id: { [Op.ne]: user.id },
            },
        });

        if (existingUser) {
            await verification.destroy();

            throw new AppError(
                "This email address is already associated with an account.",
                409
            );
        }

        // Update the email only after successful verification.
        // The old email remains unchanged until this point.
        await user.update({
            email: normalizedEmail,
        });

        // Consume all pending email-change codes for this user.
        await VerificationCode.destroy({
            where: {
                userId: user.id,
                purpose: EMAIL_CHANGE_PURPOSE,
            },
        });

        return res.status(200).json({
            success: true,
            message: "Your email address has been updated successfully.",
            user: {
                id: user.id,
                firstName: user.firstName,
                surName: user.surName,
                email: user.email,
                role: user.role,
            },
        });
    } catch (error) {
        next(error);
    }
};