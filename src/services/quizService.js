import { quizSeedData } from "../data/quizSeedData.js";
import { QuizSubject } from "../models/quizSubjectModel.js";
import { User } from "../models/userModel.js";
import { AppError } from "../utils/AppError.js";

const DEFAULT_UNLOCK_SCORE = 80;

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

const buildLevelPayload = (subjectProgress, level) => {
  const score = findLevelScore(subjectProgress, level.levelNumber);
  const completed = (subjectProgress.completedLevels || []).includes(level.levelNumber);
  const unlocked = isLevelUnlocked(subjectProgress, level.levelNumber);

  return {
    id: level.levelNumber,
    label: level.label,
    unlocked,
    current: unlocked && !completed,
    completed,
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
    const count = await QuizSubject.countDocuments();

    if (!count) {
      await QuizSubject.insertMany(quizSeedData);
    }
  },

  async getSubjects(userId) {
    await this.ensureSeedData();

    const [subjects, user] = await Promise.all([
      QuizSubject.find().sort({ createdAt: 1 }).lean(),
      User.findById(userId).lean()
    ]);

    return subjects.map((subject) => {
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

    const [subject, user] = await Promise.all([
      QuizSubject.findOne({ subjectId }).lean(),
      User.findById(userId).lean()
    ]);

    if (!subject) {
      throw new AppError("Quiz subject not found.", 404);
    }

    const subjectProgress = findSubjectProgress(user, subjectId);

    return {
      id: subject.subjectId,
      titleKh: subject.titleKh,
      summaryKh: subject.summaryKh,
      image_url: subject.image_url || "",
      levels: subject.levels.map((level) => buildLevelPayload(subjectProgress, level))
    };
  },

  async getQuestions(userId, subjectId, levelId) {
    await this.ensureSeedData();

    const levelNumber = Number(levelId);
    const [subject, user] = await Promise.all([
      QuizSubject.findOne({ subjectId }).lean(),
      User.findById(userId).lean()
    ]);

    if (!subject) {
      throw new AppError("Quiz subject not found.", 404);
    }

    const subjectProgress = findSubjectProgress(user, subjectId);

    if (!isLevelUnlocked(subjectProgress, levelNumber)) {
      throw new AppError("Previous quiz level must be completed with at least 80% first.", 403);
    }

    const level = subject.levels.find((entry) => entry.levelNumber === levelNumber);

    if (!level) {
      throw new AppError("Quiz level not found.", 404);
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
        latex: question.latex,
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
