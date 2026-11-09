import { getSchoolSubscriptionOverview } from "../services/subscription.js";
import { handleControllerError } from "../utils/controllerError.js";
import AppError from "../utils/AppError.js";

export const getSubscriptionOverview = async (req, res, next) => {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      throw new AppError("School information is missing.", 400);
    }

    const overview = await getSchoolSubscriptionOverview(schoolId);

    return res.status(200).json({
      success: true,
      message: "Subscription overview retrieved successfully.",
      data: overview,
    });
  } catch (error) {
    return handleControllerError(
      error,
      next,
      req,
      "GET_SUBSCRIPTION_OVERVIEW_ERROR",
      "Unable to retrieve subscription overview."
    );
  }
};