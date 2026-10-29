import { Op } from "sequelize";

import School from "../models/School.js";
import SchoolInquiry from "../models/SchoolInquiry.js";
import AppError from "../utils/AppError.js";

const isDev = process.env.NODE_ENV !== "production";


// 1. Submit a public inquiry to a school
export const createSchoolInquiry = async (req, res, next) => {
  try {
    const { schoolId, fullName, contact, subject, message } = req.body;

    // Confirm that the school exists
    const school = await School.findByPk(schoolId, {
      attributes: ["id", "status"],
    });

    if (!school) {
      return next(new AppError("School not found.", 404));
    }

    // Only active schools can receive public inquiries
    if (school.status !== "ACTIVE") {
      return next(
        new AppError(
          "This school is currently unavailable for inquiries.",
          400
        )
      );
    }

    const inquiry = await SchoolInquiry.create({
      schoolId,
      fullName: fullName.trim(),
      contact: contact.trim(),
      subject: subject.trim(),
      message: message.trim(),
      status: "NEW",
    });

    return res.status(201).json({
      status: "success",
      message: "Your inquiry has been submitted successfully.",
      data: {
        id: inquiry.id,
        subject: inquiry.subject,
        status: inquiry.status,
        createdAt: inquiry.createdAt,
      },
    });
  } catch (err) {
    console.error("CREATE_SCHOOL_INQUIRY_ERROR:", {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      error: err,
    });

    return next(
      new AppError(
        isDev
          ? err.message
          : "Something went wrong while submitting your inquiry.",
        500
      )
    );
  }
};


// 2. Get inquiries belonging to the authenticated user's school
export const getSchoolInquiries = async (req, res, next) => {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return next(
        new AppError("School information is not available for this account.", 401)
      );
    }

    const {
      page,
      limit,
      search,
      status,
      sortBy,
      sortOrder,
    } = req.query;

    // Confirm the school exists
    const school = await School.findByPk(schoolId, {
      attributes: ["id"],
    });

    if (!school) {
      return next(new AppError("School not found.", 404));
    }

    const where = { schoolId };

    // Optional status filter
    if (status) {
      where.status = status;
    }

    // Optional search across inquiry details
    if (search) {
      where[Op.or] = [
        { fullName: { [Op.iLike]: `%${search}%` } },
        { contact: { [Op.iLike]: `%${search}%` } },
        { subject: { [Op.iLike]: `%${search}%` } },
        { message: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const offset = (page - 1) * limit;

    // Fetch the requested page and the total matching count
    const { count, rows } = await SchoolInquiry.findAndCountAll({
      where,
      attributes: [
        "id",
        "fullName",
        "contact",
        "subject",
        "message",
        "status",
        "createdAt",
        "updatedAt",
      ],
      order: [[sortBy, sortOrder]],
      limit,
      offset,
    });

    // Counts for the whole school, independent of list filters
    const [totalInquiries, newInquiries, reviewedInquiries] =
      await Promise.all([
        SchoolInquiry.count({ where: { schoolId } }),
        SchoolInquiry.count({ where: { schoolId, status: "NEW" } }),
        SchoolInquiry.count({ where: { schoolId, status: "REVIEWED" } }),
      ]);

    return res.status(200).json({
      status: "success",
      message: "School inquiries retrieved successfully.",
      data: rows,
      pagination: {
        totalItems: count,
        currentPage: page,
        pageSize: limit,
        totalPages: Math.ceil(count / limit),
        hasNextPage: page < Math.ceil(count / limit),
        hasPreviousPage: page > 1,
      },
      counts: {
        total: totalInquiries,
        new: newInquiries,
        reviewed: reviewedInquiries,
      },
    });
  } catch (err) {
    console.error("GET_SCHOOL_INQUIRIES_ERROR:", {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      error: err,
    });

    return next(
      new AppError(
        isDev
          ? err.message
          : "Something went wrong while retrieving school inquiries.",
        500
      )
    );
  }
};


// 3. Update an inquiry's status
export const updateSchoolInquiryStatus = async (req, res, next) => {
  try {
    const schoolId = req.user?.schoolId;
    const { id } = req.params;
    const { status } = req.body;

    if (!schoolId) {
      return next(
        new AppError("School information is not available for this account.", 401)
      );
    }

    // Scope the lookup to this school to prevent cross-school access
    const inquiry = await SchoolInquiry.findOne({
      where: {
        id,
        schoolId,
      },
    });

    if (!inquiry) {
      return next(new AppError("School inquiry not found.", 404));
    }

    if (inquiry.status === status) {
      return res.status(200).json({
        status: "success",
        message: `Inquiry is already marked as ${status}.`,
        data: inquiry,
      });
    }

    await inquiry.update({ status });

    return res.status(200).json({
      status: "success",
      message: "School inquiry status updated successfully.",
      data: inquiry,
    });
  } catch (err) {
    console.error("UPDATE_SCHOOL_INQUIRY_STATUS_ERROR:", {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      error: err,
    });

    return next(
      new AppError(
        isDev
          ? err.message
          : "Something went wrong while updating the inquiry status.",
        500
      )
    );
  }
};