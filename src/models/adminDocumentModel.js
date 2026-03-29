import mongoose from "mongoose";

const adminDocumentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      default: "PDF",
      trim: true
    },
    grade_level: {
      type: String,
      default: "",
      trim: true
    },
    visibility: {
      type: String,
      enum: ["public", "private"],
      default: "private"
    },
    file_name: {
      type: String,
      required: true,
      trim: true
    },
    file_path: {
      type: String,
      default: "",
      trim: true
    },
    file_url: {
      type: String,
      required: true,
      trim: true
    },
    thumbnail_url: {
      type: String,
      default: "",
      trim: true
    },
    cloudinary_public_id: {
      type: String,
      default: "",
      trim: true
    },
    cloudinary_resource_type: {
      type: String,
      default: "",
      trim: true
    },
    thumbnail_cloudinary_public_id: {
      type: String,
      default: "",
      trim: true
    },
    thumbnail_cloudinary_resource_type: {
      type: String,
      default: "",
      trim: true
    },
    source_type: {
      type: String,
      enum: ["upload", "link"],
      default: "upload"
    },
    mime_type: {
      type: String,
      default: "application/pdf",
      trim: true
    },
    file_size: {
      type: Number,
      default: 0
    },
    page_count: {
      type: Number,
      default: 1
    }
  },
  {
    timestamps: true
  }
);

export const AdminDocument = mongoose.model("AdminDocument", adminDocumentSchema);
