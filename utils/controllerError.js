import AppError from "./AppError.js";

export const isDev = process.env.NODE_ENV === "development";

export const handleControllerError = (
  error,
  next,
  req,
  context,
  productionMessage = "Unable to process your request. Please try again."
) => {
  console.error(`${context}:`, {
    url: req?.originalUrl,
    method: req?.method,
    ip: req?.ip,
    error,
  });

  return next(
    new AppError(
      isDev
        ? error?.message || "Unexpected controller error."
        : productionMessage,
      500
    )
  );
};
