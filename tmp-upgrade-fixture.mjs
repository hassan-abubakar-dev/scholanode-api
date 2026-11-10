import bcrypt from "bcryptjs";
import { dbConnection } from "./config/db.js";
import { School, User } from "./relationships/associations.js";
import { createFreeSubscriptionForSchool } from "./services/subscription.js";

const PASSWORD = "UpgradeTest#2026";
const suffix = Date.now().toString().slice(-5);
const schoolCode = `ZZUPG${suffix}`;
const loginId = `ZZUPGLEADER${suffix}`;

async function main() {
  try {
    const school = await School.create({
      schoolName: "ZZ Upgrade Verification Academy",
      schoolCode,
      address: "1 Verification Lane, Test City",
      schoolLevel: "COMBINED",
      ownershipType: "PRIVATE",
      status: "ACTIVE",
    });

    const passwordHash = await bcrypt.hash(PASSWORD, 12);
    const user = await User.create({
      schoolId: school.id,
      firstName: "Upgrade",
      surName: "Verifier",
      loginId,
      passwordHash,
      role: "LEADER",
      email: "upgrade.verifier@example.com",
      status: "ACTIVE",
      mustChangePassword: false,
      profileCompleted: true,
    });

    const tx = await dbConnection.transaction();
    const subscription = await createFreeSubscriptionForSchool({ school, transaction: tx });
    await tx.commit();

    console.log(JSON.stringify({
      schoolId: school.id,
      schoolCode,
      loginId,
      password: PASSWORD,
      userId: user.id,
      subscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
    }, null, 2));
  } catch (error) {
    console.error("FIXTURE ERROR:", error);
    process.exitCode = 1;
  } finally {
    await dbConnection.close();
  }
}

main();