import Joi from "joi";

const allowedAudiences = [
    "STAFF",
    "STUDENTS",
    "PARENTS",
    "SECURITY",
];

export const announcementParamsSchema = Joi.object({
    announcementId: Joi.string().trim().required().messages({
        "string.empty": "Announcement ID is required.",
        "any.required": "Announcement ID is required.",
    }),
});

export const createAnnouncementSchema = Joi.object({
    title: Joi.string().trim().min(3).max(200).required().messages({
        "string.empty": "Announcement title is required.",
        "string.min": "Announcement title must be at least 3 characters.",
        "string.max": "Announcement title cannot exceed 200 characters.",
        "any.required": "Announcement title is required.",
    }),

    message: Joi.string().trim().min(1).required().messages({
        "string.empty": "Announcement message is required.",
        "any.required": "Announcement message is required.",
    }),

    audience: Joi.string()
        .valid(...allowedAudiences)
        .required()
        .messages({
            "any.only": "Select a valid announcement audience.",
            "any.required": "Announcement audience is required.",
        }),
}).required();

export const announcementQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),

    limit: Joi.number().integer().min(1).max(100).default(20),

    search: Joi.string().trim().max(100).allow(""),

    audience: Joi.string().valid(...allowedAudiences),
});