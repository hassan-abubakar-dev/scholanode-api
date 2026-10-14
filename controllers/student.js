import bcrypt from "bcryptjs";

import { dbConnection } from "../config/db.js";
import User from "../models/User.js";
import Student from "../models/Student.js";

export const createStudent = async (req, res, next) => {
  let transaction;

  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        success: false,
        message: "School authentication is required.",
      });
    }

    const {
      firstName,
      surName,
      admissionNumber,
      gender,
      dateOfBirth,
      currentClassId,
      enrollmentDate,
    } = req.body;

    const normalizedAdmissionNumber = admissionNumber
      .trim()
      .toUpperCase();

    transaction = await dbConnection.transaction();

    const existingStudent = await Student.findOne({
      where: {
        schoolId,
        admissionNumber: normalizedAdmissionNumber,
      },
      transaction,
    });

    if (existingStudent) {
      await transaction.rollback();
      transaction = null;

      return res.status(409).json({
        success: false,
        message: "This admission number already exists in your school.",
      });
    }

    const existingUser = await User.findOne({
      where: {
        schoolId,
        loginId: normalizedAdmissionNumber,
      },
      transaction,
    });

    if (existingUser) {
      await transaction.rollback();
      transaction = null;

      return res.status(409).json({
        success: false,
        message: "This login ID is already in use in your school.",
      });
    }

    // Admission number is both the login ID and initial password.
    const passwordHash = await bcrypt.hash(
      normalizedAdmissionNumber,
      12
    );

    const user = await User.create(
      {
        schoolId,
        firstName: firstName.trim(),
        surName: surName.trim(),
        loginId: normalizedAdmissionNumber,
        passwordHash,
        mustChangePassword: true,
        profileCompleted: false,
        role: "STUDENT",
        status: "ACTIVE",
        email: null,
        phoneNumber: null,
      },
      { transaction }
    );

    const student = await Student.create(
      {
        schoolId,
        userId: user.id,
        admissionNumber: normalizedAdmissionNumber,
        gender,
        dateOfBirth: dateOfBirth || null,
        currentClassId: currentClassId || null,
        enrollmentDate: enrollmentDate || null,
        admissionStatus: "ACTIVE",
      },
      { transaction }
    );

    await transaction.commit();
    transaction = null;

    return res.status(201).json({
      success: true,
      message: "Student created successfully.",
      data: {
        student: {
          id: student.id,
          userId: user.id,
          schoolId: student.schoolId,
          firstName: user.firstName,
          surName: user.surName,
          loginId: user.loginId,
          admissionNumber: student.admissionNumber,
          gender: student.gender,
          dateOfBirth: student.dateOfBirth,
          currentClassId: student.currentClassId,
          enrollmentDate: student.enrollmentDate,
          admissionStatus: student.admissionStatus,
          status: user.status,
          mustChangePassword: user.mustChangePassword,
          createdAt: student.createdAt,
        },
      },
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        message:
          "This admission number or login ID is already in use in your school.",
      });
    }

    next(error);
  }
};