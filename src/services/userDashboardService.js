import { User } from "../models/userModel.js";

const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;

const getQuestionText = (entry = {}) => (entry.questionText || entry.expression || "").trim();

const parseStoredSolution = (entry = {}) => {
  if (entry.solutionText?.trim()) {
    try {
      return JSON.parse(entry.solutionText);
    } catch (error) {
      return null;
    }
  }

  if (entry.cachedSolution) {
    return entry.cachedSolution;
  }

  if (entry.finalAnswer || entry.expression) {
    return {
      final_answer: entry.finalAnswer || "",
      steps: [],
      expression: entry.expression || ""
    };
  }

  return null;
};

const getSolutionText = (entry = {}) => {
  if (entry.solutionText?.trim()) {
    return entry.solutionText;
  }

  const parsedSolution = parseStoredSolution(entry);

  if (!parsedSolution) {
    return "";
  }

  return JSON.stringify(parsedSolution);
};

const getFinalAnswer = (entry = {}) => {
  const parsedSolution = parseStoredSolution(entry);
  return parsedSolution?.final_answer || entry.finalAnswer || "";
};

const buildHistoryItem = (entry = {}) => ({
  id: entry._id?.toString?.() || `${getQuestionText(entry)}-${entry.solvedAt}`,
  questionText: getQuestionText(entry),
  solutionText: getSolutionText(entry),
  finalAnswer: getFinalAnswer(entry),
  parsedSolution: parseStoredSolution(entry),
  solvedAt: entry.solvedAt
});

const buildRecentHistory = (history = []) =>
  history
    .slice()
    .sort((left, right) => new Date(right.solvedAt) - new Date(left.solvedAt))
    .slice(0, 5)
    .map(buildHistoryItem);

const buildFullHistory = (history = []) =>
  history
    .slice()
    .sort((left, right) => new Date(right.solvedAt) - new Date(left.solvedAt))
    .map(buildHistoryItem);

export const userDashboardService = {
  async findCachedSolution(userId, questionText) {
    if (!userId || !questionText?.trim()) {
      return null;
    }

    const normalizedQuestionText = questionText.trim();
    const user = await User.findById(userId).lean();

    if (!user?.solveHistory?.length) {
      return null;
    }

    const matchedEntry = user.solveHistory.find(
      (entry) => getQuestionText(entry) === normalizedQuestionText
    );

    return parseStoredSolution(matchedEntry);
  },

  async recordSolvedProblem(userId, { questionText, solution, timestamp = new Date() }) {
    if (!userId || !questionText?.trim() || !solution) {
      return null;
    }

    const normalizedQuestionText = questionText.trim();
    const serializedSolution = JSON.stringify(solution);
    const duplicateWindowStart = new Date(Date.now() - 5000);

    const user = await User.findOneAndUpdate(
      {
        _id: userId,
        solveHistory: {
          $not: {
            $elemMatch: {
              questionText: normalizedQuestionText,
              solutionText: serializedSolution,
              solvedAt: { $gte: duplicateWindowStart }
            }
          }
        }
      },
      {
        $inc: { totalSolved: 1 },
        $push: {
          solveHistory: {
            $each: [
              {
                questionText: normalizedQuestionText,
                solutionText: serializedSolution,
                solvedAt: timestamp
              }
            ],
            $slice: -25
          }
        }
      },
      { new: true }
    );

    if (user) {
      return user;
    }

    return User.findById(userId).select("solveHistory totalSolved");
  },

  async getDashboardStats(userId) {
    const user = await User.findById(userId).lean();

    if (!user) {
      return {
        totalSolved: 0,
        weeklySolved: 0,
        recentHistory: []
      };
    }

    const now = Date.now();
    const history = Array.isArray(user.solveHistory) ? user.solveHistory : [];
    const weeklySolved = history.filter(
      (entry) => now - new Date(entry.solvedAt).getTime() <= WEEK_IN_MS
    ).length;

    return {
      totalSolved: user.totalSolved || history.length,
      weeklySolved,
      recentHistory: buildRecentHistory(history)
    };
  },

  async getSolveHistory(userId) {
    const user = await User.findById(userId).lean();

    if (!user) {
      return [];
    }

    return buildFullHistory(Array.isArray(user.solveHistory) ? user.solveHistory : []);
  },

  async deleteHistoryItem(userId, historyItemId) {
    const user = await User.findById(userId);

    if (!user) {
      return null;
    }

    const nextHistory = (user.solveHistory || []).filter(
      (entry) => entry._id.toString() !== historyItemId
    );

    const removedCount = (user.solveHistory || []).length - nextHistory.length;

    if (!removedCount) {
      return buildFullHistory(user.solveHistory || []);
    }

    user.solveHistory = nextHistory;
    user.totalSolved = Math.max((user.totalSolved || 0) - removedCount, 0);
    await user.save();

    return buildFullHistory(user.solveHistory || []);
  }
};
