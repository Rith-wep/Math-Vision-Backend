import mongoose from "mongoose";

const qcmQuestionSchema = new mongoose.Schema(
  {
    question_title: {
      type: String,
      default: "",
      trim: true
    },
    question_text: {
      type: String,
      required: true,
      trim: true
    },
    question_input_type: {
      type: String,
      enum: ["text", "latex"],
      default: "text"
    },
    question_latex: {
      type: String,
      default: "",
      trim: true
    },
    options: {
      type: [String],
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length === 4 && value.every((item) => typeof item === "string" && item.trim());
        },
        message: "QCM questions must include exactly four non-empty options."
      }
    },
    option_latex: {
      type: [String],
      default: ["", "", "", ""],
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length === 4;
        },
        message: "QCM LaTeX options must include exactly four values."
      }
    },
    option_input_types: {
      type: [String],
      default: ["text", "text", "text", "text"],
      validate: {
        validator(value) {
          return (
            Array.isArray(value) &&
            value.length === 4 &&
            value.every((item) => ["text", "latex"].includes(item))
          );
        },
        message: "QCM option input types must include exactly four text/latex values."
      }
    },
    correct_answer: {
      type: String,
      enum: ["A", "B", "C", "D"],
      default: "A"
    },
    explanation: {
      type: String,
      default: "",
      trim: true
    },
    level: {
      type: Number,
      min: 1,
      max: 5,
      default: 1
    },
    category: {
      type: String,
      default: "General",
      trim: true
    }
  },
  {
    timestamps: true
  }
);

export const QcmQuestion = mongoose.model("QcmQuestion", qcmQuestionSchema);
