import AppError from "../utils/AppError.js";

const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const message = error.details.map((i) => i.message).join(', ');
      return next(new AppError(message, 400));
    }

    // FIX: Mutate existing object properties instead of overwriting the object
    if (req[property] && typeof req[property] === 'object') {
      // Clear existing keys to remove "unknown" or invalid data
      Object.keys(req[property]).forEach(key => delete req[property][key]);
      
      // Assign the sanitized/coerced values back into the existing object
      Object.assign(req[property], value);
    } else {
      req[property] = value;
    }
    
    next();
  };
};

export default validate;