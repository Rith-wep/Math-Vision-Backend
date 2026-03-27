import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { AdminDocument } from "../models/adminDocumentModel.js";
import { AdminQcmSettings } from "../models/adminQcmSettingsModel.js";
import { QcmQuestion } from "../models/qcmQuestionModel.js";
import { SolutionLibrary } from "../models/solutionLibraryModel.js";
import { AppError } from "../utils/AppError.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDirectory = path.resolve(__dirname, "../../uploads/admin-documents");
const DEFAULT_QCM_SETTINGS = {
  title: "Admin QCM",
  description: "Questions created from the admin panel."
};

const normalizeCategoryName = (value = "") => value.trim().replace(/\s+/g, " ");

const buildSettingsKey = (category) =>
  `category:${normalizeCategoryName(category)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "general"}`;

const sanitizeFileName = (value) =>
  value
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

const isValidHttpUrl = (value) => {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const getFileNameFromUrl = (url, fallback) => {
  try {
    const pathname = new URL(url).pathname;
    const candidate = path.basename(pathname);
    return candidate || fallback;
  } catch {
    return fallback;
  }
};

const normalizeQuestionPayload = (payload = {}) => {
  const question_title = typeof payload.question_title === "string" ? payload.question_title.trim() : "";
  const question_text = typeof payload.question_text === "string" ? payload.question_text.trim() : "";
  const question_input_type = payload.question_input_type === "latex" ? "latex" : "text";
  const question_latex = typeof payload.question_latex === "string" ? payload.question_latex.trim() : "";
  const options = Array.isArray(payload.options)
    ? payload.options.map((option) => (typeof option === "string" ? option.trim() : ""))
    : [];
  const option_latex = Array.isArray(payload.option_latex)
    ? payload.option_latex.map((option) => (typeof option === "string" ? option.trim() : ""))
    : [];
  const option_input_types = Array.isArray(payload.option_input_types)
    ? payload.option_input_types.map((item) => (item === "latex" ? "latex" : "text"))
    : ["text", "text", "text", "text"];
  const correct_answer = typeof payload.correct_answer === "string" ? payload.correct_answer.trim().toUpperCase() : "";
  const explanation = typeof payload.explanation === "string" ? payload.explanation.trim() : "";
  const category = typeof payload.category === "string" ? payload.category.trim() : "";
  const level = Number(payload.level);

  if (!question_title) {
    throw new AppError("Question title is required.", 400);
  }

  if (question_input_type === "text" && !question_text) {
    throw new AppError("Question content text is required.", 400);
  }

  if (question_input_type === "latex" && !question_latex) {
    throw new AppError("Question content LaTeX is required.", 400);
  }

  if (options.length !== 4 || options.some((option) => !option)) {
    throw new AppError("Exactly four answer options are required.", 400);
  }

  if (option_latex.length && option_latex.length !== 4) {
    throw new AppError("LaTeX answer options must contain exactly four values.", 400);
  }

  if (option_input_types.length !== 4) {
    throw new AppError("Option input types must contain exactly four values.", 400);
  }

  if (!["A", "B", "C", "D"].includes(correct_answer)) {
    throw new AppError("Correct answer must be one of A, B, C, or D.", 400);
  }

  if (!Number.isInteger(level) || level < 1 || level > 5) {
    throw new AppError("Level must be a whole number between 1 and 5.", 400);
  }

  return {
    question_title,
    question_text,
    question_input_type,
    question_latex,
    options,
    option_latex: option_latex.length ? option_latex : ["", "", "", ""],
    option_input_types,
    correct_answer,
    explanation,
    level,
    category: category || "General"
  };
};

const normalizeQcmSettingsPayload = (payload = {}) => {
  const category = normalizeCategoryName(typeof payload.category === "string" ? payload.category : "");
  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const description = typeof payload.description === "string" ? payload.description.trim() : "";

  if (!category) {
    throw new AppError("QCM category is required.", 400);
  }

  if (!title) {
    throw new AppError("QCM title is required.", 400);
  }

  if (!description) {
    throw new AppError("QCM description is required.", 400);
  }

  return { category, title, description };
};

const normalizeDocumentVisibilityUpdate = (payload = {}) => {
  const visibility = typeof payload.visibility === "string" ? payload.visibility.trim().toLowerCase() : "";

  if (!["public", "private"].includes(visibility)) {
    throw new AppError("Visibility must be either public or private.", 400);
  }

  return { visibility };
};

const normalizeDocumentMetadataUpdate = (payload = {}) => {
  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const description = typeof payload.description === "string" ? payload.description.trim() : "";
  const category = typeof payload.category === "string" ? payload.category.trim() : "";
  const grade_level = typeof payload.grade_level === "string" ? payload.grade_level.trim() : "";
  const pdf_link = typeof payload.pdf_link === "string" ? payload.pdf_link.trim() : "";
  const thumbnail_link = typeof payload.thumbnail_link === "string" ? payload.thumbnail_link.trim() : "";

  if (!title || !description || !category || !grade_level || !pdf_link) {
    throw new AppError("Title, description, category, grade level, and PDF link are required.", 400);
  }

  if (!isValidHttpUrl(pdf_link)) {
    throw new AppError("PDF link must be a valid http or https URL.", 400);
  }

  if (thumbnail_link && !isValidHttpUrl(thumbnail_link)) {
    throw new AppError("Thumbnail link must be a valid http or https URL.", 400);
  }

  return { title, description, category, grade_level, pdf_link, thumbnail_link };
};

const mapQuestion = (question) => ({
  id: question._id.toString(),
  question_title: question.question_title || question.question_text,
  question_text: question.question_text,
  question_input_type: question.question_input_type || "text",
  question_latex: question.question_latex || "",
  options: question.options,
  option_latex: Array.isArray(question.option_latex) ? question.option_latex : ["", "", "", ""],
  option_input_types: Array.isArray(question.option_input_types)
    ? question.option_input_types
    : ["text", "text", "text", "text"],
  correct_answer: question.correct_answer,
  explanation: question.explanation || "",
  level: question.level || 1,
  category: question.category,
  updated_at: question.updatedAt
});

const mapQcmSetting = (settings) => ({
  id: settings?._id?.toString() || settings?.key || "",
  category: settings?.category || "General",
  title: settings?.title || DEFAULT_QCM_SETTINGS.title,
  description: settings?.description || DEFAULT_QCM_SETTINGS.description
});

const mapDocument = (document) => ({
  id: document._id.toString(),
  title: document.title,
  description: document.description,
  category: document.category || "PDF",
  grade_level: document.grade_level,
  visibility: document.visibility,
  file_name: document.file_name,
  file_url: document.file_url,
  thumbnail_url: document.thumbnail_url || "",
  source_type: document.source_type || "upload",
  uploaded_at: document.updatedAt || document.createdAt
});

const mapSolutionLibraryItem = (entry) => ({
  id: entry._id.toString(),
  original_expression: entry.originalExpression || "",
  normalized_expression: entry.normalizedExpression || "",
  search_expression: entry.searchExpression || "",
  solution: entry.solution || {},
  question_text: entry.solution?.question_text || entry.originalExpression || "",
  final_answer: entry.solution?.final_answer || "",
  complexity: entry.solution?.complexity || "complex",
  steps_count: Array.isArray(entry.solution?.steps) ? entry.solution.steps.length : 0,
  updated_at: entry.updatedAt || entry.createdAt
});

export const adminService = {
  async getQcmSettings() {
    const settings = await AdminQcmSettings.find({ category: { $exists: true, $ne: "" } })
      .sort({ category: 1, updatedAt: -1 })
      .lean();

    return settings.map(mapQcmSetting);
  },

  async updateQcmSettings(payload) {
    const normalizedPayload = normalizeQcmSettingsPayload(payload);
    const key = buildSettingsKey(normalizedPayload.category);
    const settings = await AdminQcmSettings.findOneAndUpdate(
      { key },
      { key, ...normalizedPayload },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return mapQcmSetting(settings);
  },

  async getQuestions() {
    const questions = await QcmQuestion.find().sort({ updatedAt: -1, createdAt: -1 }).lean();
    return questions.map(mapQuestion);
  },

  async createQuestion(payload) {
    const question = await QcmQuestion.create(normalizeQuestionPayload(payload));
    return mapQuestion(question);
  },

  async updateQuestion(questionId, payload) {
    const question = await QcmQuestion.findByIdAndUpdate(
      questionId,
      normalizeQuestionPayload(payload),
      { new: true, runValidators: true }
    );

    if (!question) {
      throw new AppError("QCM question not found.", 404);
    }

    return mapQuestion(question);
  },

  async deleteQuestion(questionId) {
    const question = await QcmQuestion.findByIdAndDelete(questionId);

    if (!question) {
      throw new AppError("QCM question not found.", 404);
    }
  },

  async getDocuments() {
    const documents = await AdminDocument.find().sort({ updatedAt: -1, createdAt: -1 }).lean();
    return documents.map(mapDocument);
  },

  async uploadDocument(payload = {}, file) {
    const title = typeof payload.title === "string" ? payload.title.trim() : "";
    const description = typeof payload.description === "string" ? payload.description.trim() : "";
    const category = typeof payload.category === "string" ? payload.category.trim() : "";
    const grade_level = typeof payload.grade_level === "string" ? payload.grade_level.trim() : "";
    const pdf_link = typeof payload.pdf_link === "string" ? payload.pdf_link.trim() : "";
    const thumbnail_link = typeof payload.thumbnail_link === "string" ? payload.thumbnail_link.trim() : "";

    if (!title || !description || !category || !grade_level) {
      throw new AppError("Title, description, category, and grade level are required.", 400);
    }

    if (thumbnail_link && !isValidHttpUrl(thumbnail_link)) {
      throw new AppError("Thumbnail link must be a valid http or https URL.", 400);
    }

    if (!file && !pdf_link) {
      throw new AppError("Upload a PDF file or provide a PDF link.", 400);
    }

    if (file && pdf_link) {
      throw new AppError("Choose either a PDF file upload or a PDF link, not both.", 400);
    }

    if (pdf_link) {
      if (!isValidHttpUrl(pdf_link)) {
        throw new AppError("PDF link must be a valid http or https URL.", 400);
      }

      const document = await AdminDocument.create({
        title,
        description,
        category,
        grade_level,
        visibility: "private",
        file_name: getFileNameFromUrl(pdf_link, `${sanitizeFileName(title) || "document"}.pdf`),
        file_path: "",
        file_url: pdf_link,
        thumbnail_url: thumbnail_link,
        source_type: "link",
        mime_type: "application/pdf",
        file_size: 0
      });

      return mapDocument(document);
    }

    if (file.mimetype !== "application/pdf") {
      throw new AppError("Only PDF documents are supported.", 400);
    }

    await mkdir(uploadsDirectory, { recursive: true });

    const extension = path.extname(file.originalname || ".pdf") || ".pdf";
    const baseName = sanitizeFileName(path.basename(file.originalname || title, extension) || title || "document");
    const storedFileName = `${Date.now()}-${baseName || "document"}${extension.toLowerCase()}`;
    const absoluteFilePath = path.join(uploadsDirectory, storedFileName);
    const publicFileUrl = `/uploads/admin-documents/${storedFileName}`;

    await writeFile(absoluteFilePath, file.buffer);

    const document = await AdminDocument.create({
      title,
      description,
      category,
      grade_level,
      visibility: "private",
      file_name: file.originalname,
      file_path: absoluteFilePath,
      file_url: publicFileUrl,
      thumbnail_url: thumbnail_link && isValidHttpUrl(thumbnail_link) ? thumbnail_link : "",
      source_type: "upload",
      mime_type: file.mimetype,
      file_size: file.size || 0
    });

    return mapDocument(document);
  },

  async updateDocument(documentId, payload) {
    const document = await AdminDocument.findById(documentId);

    if (!document) {
      throw new AppError("Document not found.", 404);
    }

    const nextVisibility =
      typeof payload?.visibility === "string" && Object.keys(payload || {}).length === 1
        ? normalizeDocumentVisibilityUpdate(payload)
        : null;

    if (nextVisibility) {
      document.visibility = nextVisibility.visibility;
      await document.save();
      return mapDocument(document);
    }

    const metadataUpdate = normalizeDocumentMetadataUpdate(payload);
    document.title = metadataUpdate.title;
    document.description = metadataUpdate.description;
    document.category = metadataUpdate.category;
    document.grade_level = metadataUpdate.grade_level;
    document.file_url = metadataUpdate.pdf_link;
    document.thumbnail_url = metadataUpdate.thumbnail_link;
    document.file_name = getFileNameFromUrl(
      metadataUpdate.pdf_link,
      document.file_name || `${sanitizeFileName(metadataUpdate.title) || "document"}.pdf`
    );
    document.source_type = "link";
    document.file_path = "";
    document.mime_type = "application/pdf";
    await document.save();

    return mapDocument(document);
  },

  async deleteDocument(documentId) {
    const document = await AdminDocument.findById(documentId);

    if (!document) {
      throw new AppError("Document not found.", 404);
    }

    await AdminDocument.findByIdAndDelete(documentId);
  },

  async getSolutionLibraryEntries() {
    const entries = await SolutionLibrary.find()
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();

    return entries.map(mapSolutionLibraryItem);
  },

  async deleteSolutionLibraryEntry(entryId) {
    const entry = await SolutionLibrary.findByIdAndDelete(entryId);

    if (!entry) {
      throw new AppError("Solution library entry not found.", 404);
    }
  }
};
