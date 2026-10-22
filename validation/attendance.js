
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
