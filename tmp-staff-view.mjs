import dotenv from "dotenv";
dotenv.config();

import { Op } from "sequelize";
import generateToken from "./utils/token.js";
import { Class, User } from "./relationships/associations.js";

const command = process.argv[2];
const loginId = process.argv[3];

const tokenFor = (user) =>
  generateToken(
    { id: user.id, schoolId: user.schoolId, loginId: user.loginId, role: user.role },
    process.env.ACCESS_TOKEN_KEY,
    process.env.ACCESS_TOKEN_EXPIRY
  );

if (command === "list") {
  const staff = await User.findAll({
    where: { role: { [Op.in]: ["STAFF", "EXAM_OFFICER"] } },
    raw: true,
  });
  const classes = await Class.findAll({
    where: { formMasterId: { [Op.ne]: null } },
    attributes: ["id", "classLevel", "arm", "formMasterId"],
    raw: true,
  });

  for (const user of staff) {
    const owned = classes.filter((row) => row.formMasterId === user.id);
    console.log(
      JSON.stringify({
        loginId: user.loginId,
        role: user.role,
        name: `${user.firstName} ${user.surName}`,
        pw: Number(user.mustChangePassword),
        prof: Number(user.profileCompleted),
        forms: owned.map((row) => [row.classLevel, row.arm].filter(Boolean).join(" ")),
      })
    );
  }
} else if (command === "token") {
  const user = await User.findOne({ where: { loginId }, raw: true });
  console.log(JSON.stringify({ role: user.role, pw: Number(user.mustChangePassword), prof: Number(user.profileCompleted), token: tokenFor(user) }));
} else if (command === "flags") {
  // Lets the plain-staff layout be viewed without touching anything else.
  const user = await User.findOne({ where: { loginId } });
  await user.update({ mustChangePassword: false, profileCompleted: true });
  console.log(`cleared ceremony flags for ${loginId}`);
} else if (command === "pending") {
  const user = await User.findOne({ where: { loginId } });
  await user.update({ mustChangePassword: true, profileCompleted: false });
  console.log(`restored pending flags for ${loginId}`);
} else {
  console.log("usage: node tmp-staff-view.mjs list|token|flags|pending <loginId>");
}

process.exit(0);
