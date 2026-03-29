import { User } from "../models/userModel.js";

const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;
const DAILY_EXPLAINED_LIMIT = 4;
const DAILY_ANSWER_ONLY_LIMIT = 3;
const DAILY_SOLVE_LIMIT = DAILY_EXPLAINED_LIMIT + DAILY_ANSWER_ONLY_LIMIT;

const getQuestionText = (entry = {}) => (entry.questionText || entry.expression || "").trim();
const getDayStart = (timestamp = new Date()) => {
  const nextDate = new Date(timestamp);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
};

const getDailySolveEntries = (history = [], timestamp = new Date()) => {
  const dayStart = getDayStart(timestamp).getTime();
  return history.filter((entry) => {
    const solvedAt = new Date(entry.solvedAt).getTime();
    return Number.isFinite(solvedAt) && solvedAt >= dayStart;
  });
};

const buildSolveAccessSummary = (history = [], timestamp = new Date()) => {
  const dailyEntries = getDailySolveEntries(history, timestamp);
  const totalUsed = dailyEntries.length;
  const explainedUsed = Math.min(totalUsed, DAILY_EXPLAINED_LIMIT);
  const answerOnlyUsed = Math.min(
    Math.max(totalUsed - DAILY_EXPLAINED_LIMIT, 0),
    DAILY_ANSWER_ONLY_LIMIT
  );
  const remainingExplained = Math.max(DAILY_EXPLAINED_LIMIT - explainedUsed, 0);
  const remainingAnswerOnly = Math.max(DAILY_ANSWER_ONLY_LIMIT - answerOnlyUsed, 0);

  return {
    explainedUsed,
    answerOnlyUsed,
    totalUsed,
    remainingExplained,
    remainingAnswerOnly,
    totalRemaining: Math.max(DAILY_SOLVE_LIMIT - totalUsed, 0),
    dailyLimit: DAILY_SOLVE_LIMIT,
    fullExplanationLimit: DAILY_EXPLAINED_LIMIT,
    answerOnlyLimit: DAILY_ANSWER_ONLY_LIMIT,
    nextMode:
      remainingExplained > 0 ? "full" : remainingAnswerOnly > 0 ? "answer_only" : "blocked",
    isBlocked: totalUsed >= DAILY_SOLVE_LIMIT
  };
};

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

  async recordSolvedProblem(userId, { questionText, solution, accessMode = "full", timestamp = new Date() }) {
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
                accessMode: accessMode === "answer_only" ? "answer_only" : "full",
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

  async getSolveAccessStatus(userId, timestamp = new Date()) {
    const user = await User.findById(userId).lean();
    const history = Array.isArray(user?.solveHistory) ? user.solveHistory : [];

    return buildSolveAccessSummary(history, timestamp);
  },

  async getSolveAccessMode(userId, timestamp = new Date()) {
    const summary = await this.getSolveAccessStatus(userId, timestamp);

    return {
      mode: summary.nextMode,
      summary
    };
  },

  async getDashboardStats(userId) {
    const user = await User.findById(userId).lean();

    if (!user) {
      return {
        totalSolved: 0,
        weeklySolved: 0,
        recentHistory: [],
        solveAccess: buildSolveAccessSummary([])
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
      recentHistory: buildRecentHistory(history),
      solveAccess: buildSolveAccessSummary(history)
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
