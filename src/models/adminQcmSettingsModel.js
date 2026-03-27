import mongoose from "mongoose";

const adminQcmSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    category: {
      type: String,
      required: true,
      trim: true
    },
    title: {
      type: String,
      default: "Admin QCM",
      trim: true
    },
    description: {
      type: String,
      default: "Questions created from the admin panel.",
      trim: true
    }
  },
  {
    timestamps: true
  }
);

export const AdminQcmSettings = mongoose.model("AdminQcmSettings", adminQcmSettingsSchema);
