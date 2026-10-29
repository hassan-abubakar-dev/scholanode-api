import { Op } from "sequelize";
import {
    Announcement,
    Notification,
} from "../relationships/associations.js";
import { dbConnection } from "../config/db.js";
import AppError from "../utils/AppError.js";

const allowedManagementRoles = [
    "LEADER",
    "VICE_LEADER",
    "ADMINISTRATOR",
];

const audienceByRole = {
    LEADER: "STAFF",
    VICE_LEADER: "STAFF",
    ADMINISTRATOR: "STAFF",
    EXAM_OFFICER: "STAFF",
    STAFF: "STAFF",
    STUDENT: "STUDENTS",
    PARENT: "PARENTS",
    SECURITY: "SECURITY",
};

const getPagination = (query) => {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 100);

    return {
        page,
        limit,
        offset: (page - 1) * limit,
    };
};

const getAnnouncementFilters = (query) => {
    const where = {};

    if (query.search?.trim()) {
        where[Op.or] = [
            { title: { [Op.iLike]: `%${query.search.trim()}%` } },
            { message: { [Op.iLike]: `%${query.search.trim()}%` } },
        ];
    }

    if (query.audience) {
        where.audience = query.audience;
    }

    return where;
};

const getCreatorInclude = () => ({
    association: "creator",
    attributes: ["id", "firstName", "surName", "role"],
    required: false,
});

const getPaginatedAnnouncements = async ({
    schoolId,
    where,
    page,
    limit,
    offset,
}) => {
    const { count, rows } = await Announcement.findAndCountAll({
        where: {
            schoolId,
            ...where,
        },
        include: [getCreatorInclude()],
        order: [["createdAt", "DESC"]],
        limit,
        offset,
    });

    return {
        announcements: rows,
        pagination: {
            page,
            limit,
            totalItems: count,
            totalPages: Math.ceil(count / limit),
        },
    };
};

// =====================================
// CREATE ANNOUNCEMENT
// LEADER, VICE_LEADER, ADMINISTRATOR
// =====================================

export const createAnnouncement = async (req, res, next) => {
    const transaction = await dbConnection.transaction();

    try {
        const { schoolId, id: userId } = req.user ?? {};
        const { title, message, audience } = req.body;

        if (!schoolId || !userId) {
            throw new AppError("Authenticated school user not found.", 401);
        }

        if (!allowedManagementRoles.includes(req.user.role)) {
            throw new AppError(
                "You are not authorized to create announcements.",
                403
            );
        }

        const announcement = await Announcement.create(
            {
                schoolId,
                createdBy: userId,
                title,
                message,
                audience,
            },
            { transaction }
        );

        await Notification.create(
            {
                schoolId,
                deliveryType: "SHARED",
                recipientUserId: null,
                audience: [audience],
                type: "ANNOUNCEMENT",
                title,
                message,
                referenceId: announcement.id,
            },
            { transaction }
        );

        await transaction.commit();

        return res.status(201).json({
            success: true,
            message: "Announcement created successfully.",
            data: { announcement },
        });
    } catch (error) {
        if (!transaction.finished) {
            await transaction.rollback();
        }

        return next(error);
    }
};

// =====================================
// GET ALL ANNOUNCEMENTS FOR MANAGEMENT
// LEADER, VICE_LEADER, ADMINISTRATOR
// =====================================

export const getAnnouncements = async (req, res, next) => {
    try {
        const { schoolId } = req.user ?? {};

        if (!schoolId) {
            throw new AppError("Authenticated school not found.", 401);
        }

        if (!allowedManagementRoles.includes(req.user.role)) {
            throw new AppError(
                "You are not authorized to manage announcements.",
                403
            );
        }

        const { page, limit, offset } = getPagination(req.query);
        const where = getAnnouncementFilters(req.query);

        const result = await getPaginatedAnnouncements({
            schoolId,
            where,
            page,
            limit,
            offset,
        });

        return res.status(200).json({
            success: true,
            message: "Announcements retrieved successfully.",
            data: result,
        });
    } catch (error) {
        return next(error);
    }
};

// =====================================
// GET ANNOUNCEMENTS FOR CURRENT USER
// =====================================

export const getMyAnnouncements = async (req, res, next) => {
    try {
        const { schoolId, role } = req.user ?? {};

        if (!schoolId) {
            throw new AppError("Authenticated school not found.", 401);
        }

        const audience = audienceByRole[role];

        if (!audience) {
            throw new AppError(
                "Your role is not supported for announcements.",
                403
            );
        }

        const { page, limit, offset } = getPagination(req.query);
        const where = getAnnouncementFilters(req.query);

        // A user can only retrieve announcements for their own audience.
        // Ignore any audience filter supplied in the query string.
        where.audience = audience;

        const result = await getPaginatedAnnouncements({
            schoolId,
            where,
            page,
            limit,
            offset,
        });

        return res.status(200).json({
            success: true,
            message: "Your announcements were retrieved successfully.",
            data: result,
        });
    } catch (error) {
        return next(error);
    }
};

// =====================================
// DELETE ANNOUNCEMENT
// LEADER, VICE_LEADER, ADMINISTRATOR
// =====================================

export const deleteAnnouncement = async (req, res, next) => {
    const transaction = await dbConnection.transaction();

    try {
        const { schoolId } = req.user ?? {};
        const { announcementId } = req.params;

        if (!schoolId) {
            throw new AppError("Authenticated school not found.", 401);
        }

        if (!allowedManagementRoles.includes(req.user.role)) {
            throw new AppError(
                "You are not authorized to delete announcements.",
                403
            );
        }

        const announcement = await Announcement.findOne({
            where: {
                id: announcementId,
                schoolId,
            },
            transaction,
        });

        if (!announcement) {
            throw new AppError(
                "Announcement not found in this school.",
                404
            );
        }

        await Notification.destroy({
            where: {
                schoolId,
                deliveryType: "SHARED",
                type: "ANNOUNCEMENT",
                referenceId: announcement.id,
            },
            transaction,
        });

        await announcement.destroy({ transaction });

        await transaction.commit();

        return res.status(200).json({
            success: true,
            message: "Announcement deleted successfully.",
        });
    } catch (error) {
        if (!transaction.finished) {
            await transaction.rollback();
        }

        return next(error);
    }
};