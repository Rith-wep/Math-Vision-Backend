import mongoose from "mongoose";

const solutionLibrarySchema = new mongoose.Schema(
  {
    originalExpression: {
      type: String,
      required: true,
      trim: true
    },
    normalizedExpression: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true
    },
    searchExpression: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    solution: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    }
  },
  {
    timestamps: true
  }
);

export const SolutionLibrary = mongoose.model("SolutionLibrary", solutionLibrarySchema);
