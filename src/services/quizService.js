import { AdminQcmSettings } from "../models/adminQcmSettingsModel.js";
import { QcmQuestion } from "../models/qcmQuestionModel.js";
import { QuizSubject } from "../models/quizSubjectModel.js";
import { User } from "../models/userModel.js";
import { AppError } from "../utils/AppError.js";

const DEFAULT_UNLOCK_SCORE = 80;
const ADMIN_SUBJECT_PREFIX = "admin_qcm_";
const DEMO_SUBJECT_IDS = new Set(["general", "derivatives", "integrals"]);
const FREE_QUIZ_LEVEL_LIMIT = 2;
const buildDefaultAdminSubjectTitle = (category = "") => normalizeCategoryName(category) || "QCM";
const buildDefaultAdminSubjectDescription = (category = "") =>
  `Practice questions for ${normalizeCategoryName(category) || "this category"}.`;

const normalizeCategoryName = (value = "") => value.trim().replace(/\s+/g, " ");

const buildAdminSubjectId = (category) =>
  `${ADMIN_SUBJECT_PREFIX}${normalizeCategoryName(category)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "general"}`;

const isAdminSubjectId = (subjectId = "") => subjectId.startsWith(ADMIN_SUBJECT_PREFIX);

const escapeLatexText = (value = "") =>
  value
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([{}#$%&_])/g, "\\$1")
    .replace(/\^/g, "\\textasciicircum{}")
    .replace(/~/g, "\\textasciitilde{}");

const buildLatexFromText = (value = "") => {
  const trimmedValue = value.trim();
  return trimmedValue ? `\\text{${escapeLatexText(trimmedValue)}}` : "\\text{Question}";
};

const buildAdminQuestions = (questions = []) =>
  questions.map((question, index) => {
    const correctAnswerIndex = ["A", "B", "C", "D"].indexOf(question.correct_answer);
    const optionLatex = Array.isArray(question.option_latex) ? question.option_latex : [];
    const optionInputTypes = Array.isArray(question.option_input_types)
      ? question.option_input_types
      : ["text", "text", "text", "text"];
    const questionInputType = question.question_input_type === "latex" ? "latex" : "text";
    const questionTitle = question.question_title?.trim() || question.question_text;
    const questionTextContent = question.question_text?.trim() || question.question_title || "";
    const questionLatexContent = question.question_latex?.trim();

    return {
      questionId: index + 1,
      promptKh: questionTitle,
      contentValue:
        questionInputType === "latex"
          ? questionLatexContent || buildLatexFromText(questionTextContent)
          : questionTextContent,
      contentDisplayMode: questionInputType,
      explanationKh: question.explanation || `The correct answer is ${question.correct_answer}.`,
      image_url: "",
      options: question.options.map((option, optionIndex) => ({
        id: ["a", "b", "c", "d"][optionIndex] || `option-${optionIndex + 1}`,
        label:
          optionInputTypes[optionIndex] === "latex"
            ? optionLatex[optionIndex]?.trim() || buildLatexFromText(option)
            : option,
        displayMode: optionInputTypes[optionIndex] === "latex" ? "latex" : "text",
        isCorrect: optionIndex === correctAnswerIndex
      }))
    };
  });

const buildAdminLevels = (questions = []) => {
  const groupedQuestions = new Map();

  questions.forEach((question) => {
    const level = Math.min(5, Math.max(1, Number(question.level) || 1));
    const existingQuestions = groupedQuestions.get(level) || [];
    existingQuestions.push(question);
    groupedQuestions.set(level, existingQuestions);
  });

  return Array.from(groupedQuestions.entries())
    .sort(([leftLevel], [rightLevel]) => leftLevel - rightLevel)
    .map(([levelNumber, levelQuestions]) => ({
      levelNumber,
      label: `Level ${levelNumber}`,
      requiredScore: DEFAULT_UNLOCK_SCORE,
      image_url: "",
      questions: buildAdminQuestions(levelQuestions)
    }));
};

const buildAdminSubjects = (questions = [], settings = []) => {
  if (!questions.length) {
    return [];
  }

  const settingsByCategory = new Map(
    (Array.isArray(settings) ? settings : []).map((entry) => [
      normalizeCategoryName(entry.category).toLowerCase(),
      entry
    ])
  );
  const groupedQuestions = new Map();

  questions.forEach((question) => {
    const category = normalizeCategoryName(question.category || "General") || "General";
    const existingQuestions = groupedQuestions.get(category) || [];
    existingQuestions.push(question);
    groupedQuestions.set(category, existingQuestions);
  });

  return Array.from(groupedQuestions.entries())
    .sort(([leftCategory], [rightCategory]) => leftCategory.localeCompare(rightCategory))
    .map(([category, categoryQuestions]) => {
      const levels = buildAdminLevels(categoryQuestions);

      if (!levels.length) {
        return null;
      }

      const categorySettings = settingsByCategory.get(category.toLowerCase());

      return {
        subjectId: buildAdminSubjectId(category),
        titleKh: categorySettings?.title || buildDefaultAdminSubjectTitle(category),
        summaryKh: categorySettings?.description || buildDefaultAdminSubjectDescription(category),
        accent: "from-teal-500 to-emerald-600",
        image_url: "",
        levels
      };
    })
    .filter(Boolean);
};

const findSubjectProgress = (user = {}, subjectId) =>
  (user.quizProgress || []).find((item) => item.subjectId === subjectId) || {
    subjectId,
    completedLevels: [],
    levelScores: []
  };

const findLevelScore = (subjectProgress, levelNumber) =>
  (subjectProgress.levelScores || []).find((entry) => entry.levelNumber === levelNumber) || {
    levelNumber,
    bestScore: 0,
    lastScore: 0
  };

const isLevelUnlocked = (subjectProgress, levelNumber) => {
  if (levelNumber === 1) {
    return true;
  }

  const previousScore = findLevelScore(subjectProgress, levelNumber - 1);
  return (previousScore.bestScore || 0) >= DEFAULT_UNLOCK_SCORE;
};

const isFreeUser = (user = {}) => (user?.role || "user") !== "admin";

const buildLevelPayload = (subjectProgress, level, user) => {
  const score = findLevelScore(subjectProgress, level.levelNumber);
  const completed = (subjectProgress.completedLevels || []).includes(level.levelNumber);
  const overFreeLimit = isFreeUser(user) && level.levelNumber > FREE_QUIZ_LEVEL_LIMIT;
  const unlocked = !overFreeLimit && isLevelUnlocked(subjectProgress, level.levelNumber);

  return {
    id: level.levelNumber,
    label: level.label,
    unlocked,
    current: unlocked && !completed,
    completed,
    restricted: overFreeLimit,
    requiredScore: level.requiredScore || DEFAULT_UNLOCK_SCORE,
    bestScore: score.bestScore || 0,
    lastScore: score.lastScore || 0,
    progress: Math.max(
      0,
      Math.min(
        100,
        Math.round(((score.bestScore || 0) / (level.requiredScore || DEFAULT_UNLOCK_SCORE)) * 100)
      )
    ),
    image_url: level.image_url || ""
  };
};

export const quizService = {
  async ensureSeedData() {
    return null;
  },

  async getSubjects(userId) {
    await this.ensureSeedData();

    const [subjects, adminQuestions, adminSettings, user] = await Promise.all([
      QuizSubject.find().sort({ createdAt: 1 }).lean(),
      QcmQuestion.find().sort({ createdAt: 1, updatedAt: 1 }).lean(),
      AdminQcmSettings.find({ category: { $exists: true, $ne: "" } }).lean(),
      User.findById(userId).lean()
    ]);

    const visibleSubjects = subjects.filter((subject) => !DEMO_SUBJECT_IDS.has(subject.subjectId));
    const adminSubjects = buildAdminSubjects(adminQuestions, adminSettings);
    const combinedSubjects = adminSubjects.length ? [...adminSubjects, ...visibleSubjects] : visibleSubjects;

    return combinedSubjects.map((subject) => {
      const subjectProgress = findSubjectProgress(user, subject.subjectId);
      const completedLevels = (subjectProgress.completedLevels || []).length;
      const totalLevels = subject.levels.length;
      const currentUnlockedLevel =
        subject.levels.find((level) => isLevelUnlocked(subjectProgress, level.levelNumber) && !(subjectProgress.completedLevels || []).includes(level.levelNumber))
          ?.levelNumber || Math.min(completedLevels + 1, totalLevels || 1);

      return {
        id: subject.subjectId,
        titleKh: subject.titleKh,
        summaryKh: subject.summaryKh,
        accent: subject.accent,
        image_url: subject.image_url || "",
        completedLevels,
        totalLevels,
        currentLevel: currentUnlockedLevel,
        progress: totalLevels ? Math.round((completedLevels / totalLevels) * 100) : 0
      };
    });
  },

  async getSubjectLevels(userId, subjectId) {
    await this.ensureSeedData();

    const [adminQuestions, adminSettings, dbSubject, user] = await Promise.all([
      isAdminSubjectId(subjectId) ? QcmQuestion.find().sort({ createdAt: 1, updatedAt: 1 }).lean() : [],
      isAdminSubjectId(subjectId) ? AdminQcmSettings.find({ category: { $exists: true, $ne: "" } }).lean() : [],
      isAdminSubjectId(subjectId) ? null : QuizSubject.findOne({ subjectId }).lean(),
      User.findById(userId).lean()
    ]);

    const subject = isAdminSubjectId(subjectId)
      ? buildAdminSubjects(adminQuestions, adminSettings).find((entry) => entry.subjectId === subjectId)
      : dbSubject;

    if (!subject || (!isAdminSubjectId(subjectId) && DEMO_SUBJECT_IDS.has(subject.subjectId))) {
      throw new AppError("Quiz subject not found.", 404);
    }

    const subjectProgress = findSubjectProgress(user, subjectId);

    return {
      id: subject.subjectId,
      titleKh: subject.titleKh,
      summaryKh: subject.summaryKh,
      image_url: subject.image_url || "",
      levels: subject.levels.map((level) => buildLevelPayload(subjectProgress, level, user))
    };
  },

  async getQuestions(userId, subjectId, levelId) {
    await this.ensureSeedData();

    const levelNumber = Number(levelId);
    const [adminQuestions, adminSettings, dbSubject, user] = await Promise.all([
      isAdminSubjectId(subjectId) ? QcmQuestion.find().sort({ createdAt: 1, updatedAt: 1 }).lean() : [],
      isAdminSubjectId(subjectId) ? AdminQcmSettings.find({ category: { $exists: true, $ne: "" } }).lean() : [],
      isAdminSubjectId(subjectId) ? null : QuizSubject.findOne({ subjectId }).lean(),
      User.findById(userId).lean()
    ]);

    const subject = isAdminSubjectId(subjectId)
      ? buildAdminSubjects(adminQuestions, adminSettings).find((entry) => entry.subjectId === subjectId)
      : dbSubject;

    if (!subject || (!isAdminSubjectId(subjectId) && DEMO_SUBJECT_IDS.has(subject.subjectId))) {
      throw new AppError("Quiz subject not found.", 404);
    }

    const subjectProgress = findSubjectProgress(user, subjectId);

    if (isFreeUser(user) && levelNumber > FREE_QUIZ_LEVEL_LIMIT) {
      throw new AppError("Upgrade to Pro to unlock quiz levels above Level 2.", 403);
    }

    if (!isLevelUnlocked(subjectProgress, levelNumber)) {
      throw new AppError("Previous quiz level must be completed with at least 80% first.", 403);
    }

    const level = subject.levels.find((entry) => entry.levelNumber === levelNumber);

    if (!level) {
      throw new AppError("Quiz level not found.", 404);
    }

    if (!level.questions.length) {
      throw new AppError("No questions are available for this quiz level yet.", 404);
    }

    return {
      subjectId: subject.subjectId,
      titleKh: subject.titleKh,
      levelId: level.levelNumber,
      levelLabel: level.label,
      image_url: level.image_url || "",
      questions: level.questions.map((question) => ({
        id: question.questionId,
        promptKh: question.promptKh,
        contentValue: question.contentValue,
        contentDisplayMode: question.contentDisplayMode || "text",
        explanationKh: question.explanationKh,
        image_url: question.image_url || "",
        options: question.options
      }))
    };
  },

  async completeLevel(userId, subjectId, levelId, scorePercent) {
    await this.ensureSeedData();

    const levelNumber = Number(levelId);
    const normalizedScore = Math.max(0, Math.min(100, Number(scorePercent) || 0));
    const user = await User.findById(userId);

    if (!user) {
      throw new AppError("User not found.", 404);
    }

    let subjectProgress = (user.quizProgress || []).find((item) => item.subjectId === subjectId);

    if (!subjectProgress) {
      subjectProgress = {
        subjectId,
        completedLevels: [],
        levelScores: []
      };
      user.quizProgress.push(subjectProgress);
      subjectProgress = user.quizProgress[user.quizProgress.length - 1];
    }

    let levelScore = subjectProgress.levelScores.find((item) => item.levelNumber === levelNumber);

    if (!levelScore) {
      subjectProgress.levelScores.push({
        levelNumber,
        bestScore: normalizedScore,
        lastScore: normalizedScore,
        completedAt: normalizedScore >= DEFAULT_UNLOCK_SCORE ? new Date() : null
      });
    } else {
      levelScore.lastScore = normalizedScore;
      levelScore.bestScore = Math.max(levelScore.bestScore || 0, normalizedScore);
      if (normalizedScore >= DEFAULT_UNLOCK_SCORE && !levelScore.completedAt) {
        levelScore.completedAt = new Date();
      }
    }

    if (normalizedScore >= DEFAULT_UNLOCK_SCORE && !subjectProgress.completedLevels.includes(levelNumber)) {
      subjectProgress.completedLevels.push(levelNumber);
      subjectProgress.completedLevels.sort((left, right) => left - right);
    }

    user.markModified("quizProgress");
    await user.save();

    return this.getSubjectLevels(userId, subjectId);
  }
};
