import { Op, fn, col } from "sequelize";

import  Complaint  from "../models/Complaint.js";
import AppError from "../utils/AppError.js";

// ==========================================
// HELPERS
// ==========================================

// Ensure every complaint query is scoped to the user's school.
const getSchoolId = (req, next) => {
  if (!req.user?.schoolId) {
    next(
      new AppError(
        "Your account is not associated with a school.",
        403
      )
    );

    return null;
  }

  return req.user.schoolId;
};

// Hide sender identity from school administrators for anonymous complaints.
const hideAnonymousIdentity = (complaint) => {
  const result =
    typeof complaint.toJSON === "function"
      ? complaint.toJSON()
      : { ...complaint };

  if (result.isAnonymous) {
    delete result.senderId;
    delete result.sender;
  }

  return result;
};

// Calculate the exclusive end of a calendar day for YYYY-MM-DD filters.
const getDateFilter = (startDate, endDate) => {
  const dateFilter = {};

  if (startDate) {
    dateFilter[Op.gte] = new Date(startDate);
  }

  if (endDate) {
    const end = new Date(endDate);

    if (/^\d{4}-\d{2}-\d{2}$/.test(String(endDate))) {
      end.setUTCDate(end.getUTCDate() + 1);
      dateFilter[Op.lt] = end;
    } else {
      dateFilter[Op.lte] = end;
    }
  }

  return dateFilter;
};

// ==========================================
// 1. CREATE COMPLAINT
// ==========================================

export const createComplaint = async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req, next);

    if (!schoolId) return;

    const {
      category,
      subject,
      description,
      isAnonymous = false,
    } = req.body;

    const complaint = await Complaint.create({
      schoolId,
      senderId: req.user.id,
      category,
      subject,
      description,
      isAnonymous,
      status: "SUBMITTED",
    });

    return res.status(201).json({
      success: true,
      message: "Complaint submitted successfully.",
      data: {
        complaint,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// ==========================================
// 2. GET MY COMPLAINTS
// ==========================================

export const getMyComplaints = async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req, next);

    if (!schoolId) return;

    const status = req.query.status || undefined;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const where = {
      schoolId,
      senderId: req.user.id,
    };

    if (status) {
      where.status = status;
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await Complaint.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    return res.status(200).json({
      success: true,
      message: "Your complaints retrieved successfully.",
      data: {
        complaints: rows,
        pagination: {
          totalItems: count,
          currentPage: page,
          pageSize: limit,
          totalPages: Math.ceil(count / limit),
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};

// ==========================================
// 3. GET SCHOOL COMPLAINTS
// ==========================================

export const getSchoolComplaints = async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req, next);

    if (!schoolId) return;

    const {
      status,
      category,
      startDate,
      endDate,
    } = req.query;

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    // Apply filters to the complaint list only.
    const where = { schoolId };

    if (status) {
      where.status = status;
    }

    if (category) {
      where.category = category;
    }

    if (startDate || endDate) {
      where.createdAt = getDateFilter(startDate, endDate);
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await Complaint.findAndCountAll({
      where,
      include: [
        {
          association: "sender",
          attributes: ["id", "firstName", "surName", "role"],
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    // Remove sender identity from anonymous complaints.
    const complaints = rows.map(hideAnonymousIdentity);

    // Summary counts are independent of the list filters.
    const groupedCounts = await Complaint.findAll({
      attributes: [
        "status",
        [fn("COUNT", col("id")), "count"],
      ],
      where: { schoolId },
      group: ["status"],
      raw: true,
    });

    const summary = {
      total: 0,
      submitted: 0,
      inProgress: 0,
      resolved: 0,
      closed: 0,
    };

    for (const item of groupedCounts) {
      const countForStatus = Number(item.count);

      summary.total += countForStatus;

      switch (item.status) {
        case "SUBMITTED":
          summary.submitted = countForStatus;
          break;

        case "IN_PROGRESS":
          summary.inProgress = countForStatus;
          break;

        case "RESOLVED":
          summary.resolved = countForStatus;
          break;

        case "CLOSED":
          summary.closed = countForStatus;
          break;

        default:
          break;
      }
    }

    return res.status(200).json({
      success: true,
      message: "School complaints retrieved successfully.",
      data: {
        summary,
        complaints,
        pagination: {
          totalItems: count,
          currentPage: page,
          pageSize: limit,
          totalPages: Math.ceil(count / limit),
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};

// ==========================================
// 4. UPDATE COMPLAINT STATUS
// ==========================================

export const updateComplaintStatus = async (req, res, next) => {
  try {
    const schoolId = getSchoolId(req, next);

    if (!schoolId) return;

    const { complaintId } = req.params;
    const { status, resolutionNote } = req.body;

    // Always scope the lookup to the administrator's school.
    const complaint = await Complaint.findOne({
      where: {
        id: complaintId,
        schoolId,
      },
    });

    if (!complaint) {
      return next(
        new AppError("Complaint not found in your school.", 404)
      );
    }

    // Allowed forward transitions.
    const allowedTransitions = {
      SUBMITTED: ["IN_PROGRESS", "RESOLVED", "CLOSED"],
      IN_PROGRESS: ["RESOLVED", "CLOSED"],
      RESOLVED: ["CLOSED"],
      CLOSED: [],
    };

    const allowedNextStatuses =
      allowedTransitions[complaint.status] || [];

    if (!allowedNextStatuses.includes(status)) {
      return next(
        new AppError(
          `Cannot change complaint status from ${complaint.status} to ${status}.`,
          400
        )
      );
    }

    complaint.status = status;

    if (resolutionNote !== undefined) {
      complaint.resolutionNote = resolutionNote || null;
    }

    // resolvedAt means the complaint was actually resolved.
    if (status === "RESOLVED") {
      complaint.resolvedAt = new Date();
    }

    await complaint.save();

    return res.status(200).json({
      success: true,
      message: `Complaint status updated to ${status}.`,
      data: {
        complaint: hideAnonymousIdentity(complaint),
      },
    });
  } catch (error) {
    return next(error);
  }
};