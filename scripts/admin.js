import bcrypt from "bcrypt";
import dotenv from "dotenv";
import User from "../models/User.js";
import { dbConnection } from "../config/db.js";

dotenv.config();

const seedAdmin = async () => {
  try {
    const regNo = process.env.ADMIN_REG_NO?.trim();
    const password = process.env.ADMIN_PASSWORD;

    if (!regNo || !password) {
      throw new Error(
        "ADMIN_REG_NO or ADMIN_PASSWORD is missing from the .env file."
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    let admin = await User.findOne({
      where: { regNo },
    });

    if (admin) {
      console.log("Admin found. Updating account...");

      await admin.update({
        fullName: process.env.ADMIN_FULL_NAME,
        department: process.env.ADMIN_DEPARTMENT,
        faculty: process.env.ADMIN_FACULTY,
        password: hashedPassword,
        role: "ADMIN",
        profileUrl:
          process.env.ADMIN_PROFILE_URL ||
          "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRiRo5RsazUIy3LPn-DG57NPTKgVyRcUqqJODFRmkEdbg&s=10",
      });

      console.log("Admin updated successfully.");
    } else {
      console.log("Creating admin account...");

      await User.create({
        fullName: process.env.ADMIN_FULL_NAME,
        regNo,
        department: process.env.ADMIN_DEPARTMENT,
        faculty: process.env.ADMIN_FACULTY,
        password: hashedPassword,
        role: "ADMIN",
        profileUrl:
          process.env.ADMIN_PROFILE_URL ||
          "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRiRo5RsazUIy3LPn-DG57NPTKgVyRcUqqJODFRmkEdbg&s=10",
      });

      console.log("Admin created successfully.");
    }
  } catch (error) {
    console.error("ADMIN SEED ERROR:", error.message);
  } finally {
    await dbConnection.close();
  }
};

seedAdmin();