
import Joi from "joi";

export const registerIdSchema = Joi.object({
  registerId: Joi.string().uuid().required(),
});

export const saveAttendanceDraftSchema = Joi.object({
  students: Joi.array()
    .items(
      Joi.object({
        studentId: Joi.string().uuid().required(),
        status: Joi.string()
          .valid("PRESENT", "ABSENT")
          .allow(null)
          .required(),
      }).required()
    )
    .min(1)
    .required(),
});



export const submitAttendanceSchema = Joi.object({
  students: Joi.array()
    .items(
      Joi.object({
        studentId: Joi.string().uuid().required(),
        status: Joi.string()
          .valid("PRESENT", "ABSENT")
          .required(),
      }).required()
    )
    .min(1)
    .required(),
});

export const attendanceHistoryQuerySchema = Joi.object({
  sessionId: Joi.string().uuid().optional(),

  termId: Joi.string().uuid().optional(),

  classId: Joi.string().uuid().optional(),

  fromDate: Joi.date().iso().optional(),

  toDate: Joi.date().iso().optional(),

  status: Joi.string()
    .valid("DRAFT", "SUBMITTED")
    .optional(),

  page: Joi.number().integer().min(1).default(1),

  limit: Joi.number().integer().min(1).max(100).default(10),
});