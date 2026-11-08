import Joi from "joi";

export const assignSubjectToClassSchema = Joi.object({
  subjectIds: Joi.array()
    .items(Joi.string().guid({ version: ["uuidv4", "uuidv5"] }))
    .min(1)
    .unique()
    .required(),

  classIds: Joi.array()
    .items(Joi.string().guid({ version: ["uuidv4", "uuidv5"] }))
    .min(1)
    .unique()
    .required(),
});