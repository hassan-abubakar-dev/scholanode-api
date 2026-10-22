
import School from "../models/School.js";
import User from "../models/User.js";

/**
 * Generates the next security login ID for a school.
 * The caller must pass the active transaction that will also
 * create the security account.
 */
const generateSecurityLoginId = async ({ schoolId, transaction }) => {
  if (!transaction || transaction.finished) {
    throw new Error(
      "An active transaction is required to generate a security login ID."
    );
  }

  const school = await School.findByPk(schoolId, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (!school) {
    throw new Error(
      "School not found while generating a security login ID."
    );
  }

  const prefix =
    `${school.schoolCode.substring(0, 3).toUpperCase()}/SEC/`;

  const users = await User.findAll({
    where: { schoolId },
    attributes: ["loginId"],
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  let highestSerial = 0;

  for (const user of users) {
    if (!user.loginId.startsWith(prefix)) {
      continue;
    }

    const serial = user.loginId.slice(prefix.length);

    if (/^\d+$/.test(serial)) {
      highestSerial = Math.max(highestSerial, Number(serial));
    }
  }

  return `${prefix}${String(highestSerial + 1).padStart(4, "0")}`;
};

export default generateSecurityLoginId;
