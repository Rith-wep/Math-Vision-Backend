import { userDashboardService } from "../services/userDashboardService.js";

export const getDashboardStats = async (request, response, next) => {
  try {
    const stats = await userDashboardService.getDashboardStats(request.user._id);
    response.status(200).json(stats);
  } catch (error) {
    next(error);
  }
};

export const getSolveAccessStatus = async (request, response, next) => {
  try {
    const summary = await userDashboardService.getSolveAccessStatus(request.user._id);
    response.status(200).json(summary);
  } catch (error) {
    next(error);
  }
};

export const getUserHistory = async (request, response, next) => {
  try {
    const history = await userDashboardService.getSolveHistory(request.user._id);
    response.status(200).json(history);
  } catch (error) {
    next(error);
  }
};

export const deleteUserHistoryItem = async (request, response, next) => {
  try {
    const history = await userDashboardService.deleteHistoryItem(
      request.user._id,
      request.params.historyItemId
    );
    response.status(200).json(history);
  } catch (error) {
    next(error);
  }
};
