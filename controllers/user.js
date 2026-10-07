import bcrypt from 'bcryptjs';
import { dbConnection } from '../config/db.js';
import User from '../models/User.js';
import Student from '../models/Student.js';

const publicUserFields = (user) => ({
  id: user.id,
  schoolId: user.schoolId,
  firstName: user.firstName,
  middleName: user.middleName,
  lastName: user.lastName,
  email: user.email,
  phoneNumber: user.phoneNumber,
  role: user.role,
  status: user.status,
});

const validateUserFields = ({ firstName, lastName, email, password }) => {
  if (!firstName || !lastName || !email || !password) {
    return 'firstName, lastName, email, and password are required.';
  }

  return null;
};

const findExistingUser = (schoolId, email) => (
  User.findOne({ where: { schoolId, email } })
);

export const registerTeacher = async (req, res) => {
  const transaction = await dbConnection.transaction();

  try {
    const { firstName, middleName, lastName, email, password, phoneNumber } = req.body;
    const validationError = validateUserFields({ firstName, lastName, email, password });

    if (validationError) {
      await transaction.rollback();
      return res.status(400).json({ status: 'error', message: validationError });
    }

    const existingUser = await findExistingUser(req.user.schoolId, email);
    if (existingUser) {
      await transaction.rollback();
      return res.status(400).json({ status: 'error', message: 'Email already registered in this school.' });
    }

    const user = await User.create({
      schoolId: req.user.schoolId,
      firstName,
      middleName,
      lastName,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      phoneNumber,
      role: 'TEACHER',
    }, { transaction });

    await transaction.commit();

    return res.status(201).json({
      status: 'success',
      message: 'Teacher added successfully.',
      data: publicUserFields(user),
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Register teacher error:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to add teacher.' });
  }
};

export const registerStudent = async (req, res) => {
  const transaction = await dbConnection.transaction();

  try {
    const {
      firstName,
      middleName,
      lastName,
      email,
      password,
      phoneNumber,
      admissionNumber,
      gender,
      dateOfBirth,
      currentClassId,
      enrollmentDate,
    } = req.body;

    const validationError = validateUserFields({ firstName, lastName, email, password });
    if (validationError || !admissionNumber || !gender || !enrollmentDate) {
      await transaction.rollback();
      return res.status(400).json({
        status: 'error',
        message: validationError || 'admissionNumber, gender, and enrollmentDate are required.',
      });
    }

    const existingUser = await findExistingUser(req.user.schoolId, email);
    if (existingUser) {
      await transaction.rollback();
      return res.status(400).json({ status: 'error', message: 'Email already registered in this school.' });
    }

    const existingAdmission = await Student.findOne({
      where: { schoolId: req.user.schoolId, admissionNumber },
    });
    if (existingAdmission) {
      await transaction.rollback();
      return res.status(400).json({ status: 'error', message: 'Admission number already registered.' });
    }

    const user = await User.create({
      schoolId: req.user.schoolId,
      firstName,
      middleName,
      lastName,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      phoneNumber,
      role: 'STUDENT',
    }, { transaction });

    const student = await Student.create({
      schoolId: req.user.schoolId,
      userId: user.id,
      admissionNumber,
      gender,
      dateOfBirth,
      currentClassId,
      enrollmentDate,
    }, { transaction });

    await transaction.commit();

    return res.status(201).json({
      status: 'success',
      message: 'Student added successfully.',
      data: {
        user: publicUserFields(user),
        student,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Register student error:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to add student.' });
  }
};

export const getLoggedInUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] },
    });

    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found.' });
    }

    return res.status(200).json({
      status: 'success',
      data: user,
    });
  } catch (error) {
    console.error('Get logged-in user error:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to get user profile.' });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'ASC']],
    });

    return res.status(200).json({
      status: 'success',
      count: users.length,
      data: users,
    });
  } catch (error) {
    console.error('Get all users error:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to fetch users.' });
  }
};
