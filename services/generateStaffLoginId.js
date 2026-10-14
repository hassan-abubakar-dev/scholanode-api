import School from "../models/School.js";
import User from "../models/User.js";

/**
 * Generate the next staff login ID while holding a lock on the school row.
 * The caller must pass the transaction that will also create the user.
 */
const generateStaffLoginId = async ({ schoolId, transaction }) => {
  if (!transaction || transaction.finished) {
    throw new Error(
      "An active transaction is required to generate a staff login ID."
    );
  }

  const school = await School.findByPk(schoolId, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (!school) {
    throw new Error(
      "School not found while generating a staff login ID."
    );
  }

  const prefix = `${school.schoolCode.substring(0, 3).toUpperCase()}/STF/`;
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

export default generateStaffLoginId;
