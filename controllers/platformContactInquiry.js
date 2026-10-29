import { Op } from "sequelize";

import {
  PlatformContactInquiry,
  PlatformUser,
} from "../relationships/associations.js";

import AppError from "../utils/AppError.js";

const isDev = process.env.NODE_ENV !== "production";


// ========================================
// 1. Create a public Contact ScholaNode inquiry
// ========================================

export const createContactInquiry = async (req, res, next) => {
  try {
    const {
      fullName,
      email,
      category,
      subject,
      message,
      allowEmailReply,
    } = req.body;

    const inquiry = await PlatformContactInquiry.create({
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      category,
      subject: subject.trim(),
      message: message.trim(),
      allowEmailReply,
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
    console.error("CREATE_CONTACT_INQUIRY_ERROR:", {
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


// ========================================
// 2. Get and filter Contact ScholaNode inquiries
// ========================================

export const getContactInquiries = async (req, res, next) => {
  try {
    const {
      page,
      limit,
      search,
      status,
      category,
      sortBy,
      sortOrder,
    } = req.query;

    const where = {};

    // Optional status filter
    if (status) {
      where.status = status;
    }

    // Optional category filter
    if (category) {
      where.category = category;
    }

    // Search across visitor and inquiry details
    if (search) {
      where[Op.or] = [
        { fullName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { subject: { [Op.iLike]: `%${search}%` } },
        { message: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const offset = (page - 1) * limit;

    const { count, rows } =
      await PlatformContactInquiry.findAndCountAll({
        where,
        attributes: [
          "id",
          "fullName",
          "email",
          "category",
          "subject",
          "message",
          "allowEmailReply",
          "status",
          "reviewedByPlatformUserId",
          "reviewedAt",
          "createdAt",
          "updatedAt",
        ],
        order: [[sortBy, sortOrder]],
        limit,
        offset,
      });

    return res.status(200).json({
      status: "success",
      message: "Contact inquiries retrieved successfully.",
      data: rows,
      pagination: {
        totalItems: count,
        currentPage: page,
        pageSize: limit,
        totalPages: Math.ceil(count / limit),
        hasNextPage: page < Math.ceil(count / limit),
        hasPreviousPage: page > 1,
      },
    });
  } catch (err) {
    console.error("GET_CONTACT_INQUIRIES_ERROR:", {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      error: err,
    });

    return next(
      new AppError(
        isDev
          ? err.message
          : "Something went wrong while retrieving contact inquiries.",
        500
      )
    );
  }
};


// ========================================
// 3. Update a Contact ScholaNode inquiry status
// ========================================

export const updateContactInquiryStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // This assumes platform authentication attaches the authenticated
    // PlatformUser to req.platformUser.
    const platformUserId = req.platformUser?.id;

    if (!platformUserId) {
      return next(
        new AppError(
          "Authenticated platform user information is unavailable.",
          401
        )
      );
    }

    const inquiry = await PlatformContactInquiry.findByPk(id);

    if (!inquiry) {
      return next(new AppError("Contact inquiry not found.", 404));
    }

    if (inquiry.status === status) {
      return res.status(200).json({
        status: "success",
        message: `Inquiry is already marked as ${status}.`,
        data: inquiry,
      });
    }

    const updates = { status };

    // Record the platform user who reviewed the inquiry.
    // Do not erase review information when changing a later status.
    if (status !== "NEW" && !inquiry.reviewedAt) {
      updates.reviewedByPlatformUserId = platformUserId;
      updates.reviewedAt = new Date();
    }

    // If an inquiry is explicitly returned to NEW, clear its review
    // metadata so the record accurately reflects the current state.
    if (status === "NEW") {
      updates.reviewedByPlatformUserId = null;
      updates.reviewedAt = null;
    }

    await inquiry.update(updates);

    return res.status(200).json({
      status: "success",
      message: "Contact inquiry status updated successfully.",
      data: inquiry,
    });
  } catch (err) {
    console.error("UPDATE_CONTACT_INQUIRY_STATUS_ERROR:", {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      error: err,
    });

    return next(
      new AppError(
        isDev
          ? err.message
          : "Something went wrong while updating the contact inquiry.",
        500
      )
    );
  }
};


// ========================================
// 4. Get Contact ScholaNode inquiry statistics
// ========================================

export const getContactInquiryStats = async (req, res, next) => {
  try {
    const [
      total,
      newInquiries,
      reviewed,
      replied,
      closed,
    ] = await Promise.all([
      PlatformContactInquiry.count(),
      PlatformContactInquiry.count({
        where: { status: "NEW" },
      }),
      PlatformContactInquiry.count({
        where: { status: "REVIEWED" },
      }),
      PlatformContactInquiry.count({
        where: { status: "REPLIED" },
      }),
      PlatformContactInquiry.count({
        where: { status: "CLOSED" },
      }),
    ]);

    return res.status(200).json({
      status: "success",
      message: "Contact inquiry statistics retrieved successfully.",
      data: {
        total,
        new: newInquiries,
        reviewed,
        replied,
        closed,
      },
    });
  } catch (err) {
    console.error("GET_CONTACT_INQUIRY_STATS_ERROR:", {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      error: err,
    });

    return next(
      new AppError(
        isDev
          ? err.message
          : "Something went wrong while retrieving contact inquiry statistics.",
        500
      )
    );
  }
};