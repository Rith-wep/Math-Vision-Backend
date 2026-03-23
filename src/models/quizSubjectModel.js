import mongoose from "mongoose";

const quizOptionSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      trim: true
    },
    label: {
      type: String,
      required: true,
      trim: true
    },
    isCorrect: {
      type: Boolean,
      default: false
    }
  },
  { _id: false }
);

const quizQuestionSchema = new mongoose.Schema(
  {
    questionId: {
      type: Number,
      required: true
    },
    promptKh: {
      type: String,
      required: true,
      trim: true
    },
    latex: {
      type: String,
      required: true,
      trim: true
    },
    explanationKh: {
      type: String,
      required: true,
      trim: true
    },
    image_url: {
      type: String,
      default: "",
      trim: true
    },
    options: {
      type: [quizOptionSchema],
      default: []
    }
  },
  { _id: false }
);

const quizLevelSchema = new mongoose.Schema(
  {
    levelNumber: {
      type: Number,
      required: true
    },
    label: {
      type: String,
      required: true,
      trim: true
    },
    requiredScore: {
      type: Number,
      default: 80
    },
    image_url: {
      type: String,
      default: "",
      trim: true
    },
    questions: {
      type: [quizQuestionSchema],
      default: []
    }
  },
  { _id: false }
);

const quizSubjectSchema = new mongoose.Schema(
  {
    subjectId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    titleKh: {
      type: String,
      required: true,
      trim: true
    },
    summaryKh: {
      type: String,
      required: true,
      trim: true
    },
    accent: {
      type: String,
      default: "from-emerald-500 to-green-500",
      trim: true
    },
    image_url: {
      type: String,
      default: "",
      trim: true
    },
    levels: {
      type: [quizLevelSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

export const QuizSubject = mongoose.model("QuizSubject", quizSubjectSchema);
