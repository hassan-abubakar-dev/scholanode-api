import { Op } from "sequelize";
import { dbConnection } from "../config/db.js";
import {
  User,
  VerificationCode,
} from "../relationships/associations.js";
import generateVerificationCode from "../utils/verificationCode.js";
import generateExpiryTime from "../utils/experyTime.js";
import sendEmail from "../config/emailService.js";

const RESEND_COOLDOWN_MS = 60 * 1000;

const issueVerificationCode = async ({
  userId,
  email,
  purpose,
  subject,
  buildEmail,
}) => {
  let transaction;
  let verificationRecord;

  const normalizedEmail = email.trim().toLowerCase();

  try {
    transaction = await dbConnection.transaction();

    // Lock the user row to serialize simultaneous resend requests.
    const user = await User.findByPk(userId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!user || user.email.toLowerCase() !== normalizedEmail) {
      await transaction.rollback();
      transaction = null;
      return { sent: false };
    }

    // Check the most recent request for this email and purpose.
    const latestCode = await VerificationCode.findOne({
      where: {
        userEmail: normalizedEmail,
        purpose,
      },
      order: [["createdAt", "DESC"]],
      transaction,
    });

    if (latestCode) {
      const elapsed = Date.now() - new Date(latestCode.createdAt).getTime();

      if (elapsed < RESEND_COOLDOWN_MS) {
        await transaction.rollback();
        transaction = null;

        return {
          sent: false,
          cooldown: true,
          remainingSeconds: Math.ceil(
            (RESEND_COOLDOWN_MS - elapsed) / 1000
          ),
        };
      }
    }

    const code = generateVerificationCode();
    const expiryTime = generateExpiryTime();

    verificationRecord = await VerificationCode.create(
      {
        code,
        expiryTime,
        userEmail: normalizedEmail,
        userId: user.id,
        purpose,
      },
      { transaction }
    );

    await transaction.commit();
    transaction = null;

    // Send the email only after the new code has been saved.
    try {
      await sendEmail({
        to: normalizedEmail,
        subject,
        html: buildEmail(code),
      });
    } catch (emailError) {
      // The new code must not remain usable if its email failed.
      await verificationRecord.destroy();

      throw emailError;
    }

    // Invalidate previous codes for this purpose only.
    await VerificationCode.destroy({
      where: {
        userEmail: normalizedEmail,
        purpose,
        id: {
          [Op.ne]: verificationRecord.id,
        },
      },
    });

    return { sent: true };
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    throw error;
  }
};

export default issueVerificationCode;