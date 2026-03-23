import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    googleId: {
      type: String,
      unique: true,
      index: true,
      sparse: true,
      trim: true
    },
    displayName: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    avatar: {
      type: String,
      default: ""
    },
    passwordHash: {
      type: String,
      default: ""
    },
    totalSolved: {
      type: Number,
      default: 0
    },
    quizProgress: {
      type: [
        new mongoose.Schema(
          {
            subjectId: {
              type: String,
              required: true,
              trim: true
            },
            completedLevels: {
              type: [Number],
              default: []
            },
            levelScores: {
              type: [
                new mongoose.Schema(
                  {
                    levelNumber: {
                      type: Number,
                      required: true
                    },
                    bestScore: {
                      type: Number,
                      default: 0
                    },
                    lastScore: {
                      type: Number,
                      default: 0
                    },
                    completedAt: {
                      type: Date,
                      default: null
                    }
                  },
                  { _id: false }
                )
              ],
              default: []
            }
          },
          { _id: false }
        )
      ],
      default: []
    },
    solveHistory: {
      type: [
        new mongoose.Schema(
          {
            questionText: {
              type: String,
              trim: true
            },
            solutionText: {
              type: String,
              default: ""
            },
            expression: {
              type: String,
              default: "",
              trim: true
            },
            finalAnswer: {
              type: String,
              default: ""
            },
            cachedSolution: {
              type: mongoose.Schema.Types.Mixed,
              default: null
            },
            source: {
              type: String,
              default: ""
            },
            solvedAt: {
              type: Date,
              default: Date.now
            }
          },
          { _id: true }
        )
      ],
      default: []
    }
  },
  {
    timestamps: true
  }
);

export const User = mongoose.model("User", userSchema);
