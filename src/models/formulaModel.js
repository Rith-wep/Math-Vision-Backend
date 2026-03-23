import mongoose from "mongoose";

// This schema defines how each math formula is stored in MongoDB.
const formulaSchema = new mongoose.Schema(
  {
    title_kh: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      required: true,
      trim: true
    },
    grade: {
      type: Number,
      required: true,
      min: 7,
      max: 12
    },
    latex_content: {
      type: String,
      required: true,
      trim: true
    },
    description_kh: {
      type: String,
      required: true,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

export const Formula = mongoose.model("Formula", formulaSchema);
