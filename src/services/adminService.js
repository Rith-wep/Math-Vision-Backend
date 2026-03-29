import { AdminDocument } from "../models/adminDocumentModel.js";
import { AdminQcmSettings } from "../models/adminQcmSettingsModel.js";
import { QcmQuestion } from "../models/qcmQuestionModel.js";
import { SolutionLibrary } from "../models/solutionLibraryModel.js";
import { cloudinaryService } from "./cloudinaryService.js";
import { AppError } from "../utils/AppError.js";
const DEFAULT_QCM_SETTINGS = {
  title: "Admin QCM",
  description: "Questions created from the admin panel."
};
const MAX_QUESTIONS_PER_LEVEL = 10;

const normalizeCategoryName = (value = "") => value.trim().replace(/\s+/g, " ");

const enforceQuestionLevelLimit = async ({ category, level, excludeQuestionId = null }) => {
  const query = {
    category: normalizeCategoryName(category) || "General",
    level
  };

  if (excludeQuestionId) {
    query._id = { $ne: excludeQuestionId };
  }

  const existingCount = await QcmQuestion.countDocuments(query);

  if (existingCount >= MAX_QUESTIONS_PER_LEVEL) {
    throw new AppError(
      `Level ${level} in ${query.category} already has ${MAX_QUESTIONS_PER_LEVEL} questions. Please use another level or category.`,
      400
    );
  }
};

const buildLegacySettingsKey = (category) =>
  `category:${normalizeCategoryName(category)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "general"}`;

const buildSettingsKey = (category) => {
  const normalizedCategory = normalizeCategoryName(category).toLowerCase();

  return `category:${encodeURIComponent(normalizedCategory) || "general"}`;
};

const buildSettingsLookupQuery = (category) => ({
  $or: [
    { category: normalizeCategoryName(category) },
    { key: buildSettingsKey(category) },
    { key: buildLegacySettingsKey(category) }
  ]
});

const buildTargetSettingsLookupQuery = (category) => ({
  $or: [{ category: normalizeCategoryName(category) }, { key: buildSettingsKey(category) }]
});

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

const normalizeRenameCategoryPayload = (payload = {}) => {
  const fromCategory = normalizeCategoryName(
    typeof payload.fromCategory === "string" ? payload.fromCategory : payload.from_category
  );
  const toCategory = normalizeCategoryName(
    typeof payload.toCategory === "string" ? payload.toCategory : payload.to_category
  );

  if (!fromCategory) {
    throw new AppError("Current category is required.", 400);
  }

  if (!toCategory) {
    throw new AppError("New category name is required.", 400);
  }

  if (fromCategory === toCategory) {
    throw new AppError("The new category name must be different.", 400);
  }

  return { fromCategory, toCategory };
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
  const pdf_link = typeof payload.pdf_link === "string" ? payload.pdf_link.trim() : "";
  const thumbnail_link = typeof payload.thumbnail_link === "string" ? payload.thumbnail_link.trim() : "";

  if (!title || !description || !category || !pdf_link) {
    throw new AppError("Title, description, category, and PDF link are required.", 400);
  }

  if (!isValidHttpUrl(pdf_link)) {
    throw new AppError("PDF link must be a valid http or https URL.", 400);
  }

  if (thumbnail_link && !isValidHttpUrl(thumbnail_link)) {
    throw new AppError("Thumbnail link must be a valid http or https URL.", 400);
  }

  return { title, description, category, pdf_link, thumbnail_link };
};

const getUploadedFile = (files, fieldName) => {
  if (!files || typeof files !== "object") {
    return null;
  }

  const value = files[fieldName];
  return Array.isArray(value) && value.length ? value[0] : null;
};

const isSupportedThumbnailMimeType = (mimeType = "") =>
  ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/heic", "image/heif", "image/bmp"].includes(
    String(mimeType).toLowerCase()
  );

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
  page_count: Number(document.page_count || 1) || 1,
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
    const existingSettings = await AdminQcmSettings.findOne(buildSettingsLookupQuery(normalizedPayload.category));

    const settings = existingSettings
      ? await AdminQcmSettings.findByIdAndUpdate(
          existingSettings._id,
          { key, ...normalizedPayload },
          { new: true, runValidators: true }
        )
      : await AdminQcmSettings.findOneAndUpdate(
          { key },
          { key, ...normalizedPayload },
          { new: true, upsert: true, setDefaultsOnInsert: true }
        );

    return mapQcmSetting(settings);
  },

  async renameQcmCategory(payload) {
    const { fromCategory, toCategory } = normalizeRenameCategoryPayload(payload);
    const [sourceQuestionsCount, sourceSettings, targetQuestionsCount, targetSettings] = await Promise.all([
      QcmQuestion.countDocuments({ category: fromCategory }),
      AdminQcmSettings.findOne(buildSettingsLookupQuery(fromCategory)),
      QcmQuestion.countDocuments({ category: toCategory }),
      AdminQcmSettings.findOne(buildTargetSettingsLookupQuery(toCategory))
    ]);

    if (!sourceQuestionsCount && !sourceSettings) {
      throw new AppError("Selected category was not found.", 404);
    }

    if (targetQuestionsCount || targetSettings) {
      throw new AppError("That category name already exists. Choose a different name.", 400);
    }

    await QcmQuestion.updateMany({ category: fromCategory }, { $set: { category: toCategory } });

    if (sourceSettings) {
      sourceSettings.key = buildSettingsKey(toCategory);
      sourceSettings.category = toCategory;
      await sourceSettings.save();
    }

    return {
      fromCategory,
      toCategory,
      updatedQuestions: sourceQuestionsCount,
      settingsUpdated: Boolean(sourceSettings)
    };
  },

  async getQuestions() {
    const questions = await QcmQuestion.find().sort({ updatedAt: -1, createdAt: -1 }).lean();
    return questions.map(mapQuestion);
  },

  async createQuestion(payload) {
    const normalizedPayload = normalizeQuestionPayload(payload);
    await enforceQuestionLevelLimit({
      category: normalizedPayload.category,
      level: normalizedPayload.level
    });
    const question = await QcmQuestion.create(normalizedPayload);
    return mapQuestion(question);
  },

  async updateQuestion(questionId, payload) {
    const normalizedPayload = normalizeQuestionPayload(payload);
    await enforceQuestionLevelLimit({
      category: normalizedPayload.category,
      level: normalizedPayload.level,
      excludeQuestionId: questionId
    });
    const question = await QcmQuestion.findByIdAndUpdate(
      questionId,
      normalizedPayload,
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

  async uploadDocument(payload = {}, files) {
    const file = getUploadedFile(files, "file");
    const thumbnailFile = getUploadedFile(files, "thumbnail_file");
    const title = typeof payload.title === "string" ? payload.title.trim() : "";
    const description = typeof payload.description === "string" ? payload.description.trim() : "";
    const category = typeof payload.category === "string" ? payload.category.trim() : "";
    const pdf_link = typeof payload.pdf_link === "string" ? payload.pdf_link.trim() : "";
    const thumbnail_link = typeof payload.thumbnail_link === "string" ? payload.thumbnail_link.trim() : "";

    if (!title || !description || !category) {
      throw new AppError("Title, description, and category are required.", 400);
    }

    if (thumbnail_link && !isValidHttpUrl(thumbnail_link)) {
      throw new AppError("Thumbnail link must be a valid http or https URL.", 400);
    }

    if (thumbnailFile && !isSupportedThumbnailMimeType(thumbnailFile.mimetype)) {
      throw new AppError("Thumbnail must be a JPG, PNG, WEBP, GIF, AVIF, HEIC, HEIF, or BMP image.", 400);
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

      const thumbnailAsset = thumbnailFile
        ? await cloudinaryService.uploadImage(thumbnailFile, {
            publicIdPrefix: `${sanitizeFileName(title) || "document"}-thumbnail`
          })
        : null;

      const document = await AdminDocument.create({
        title,
        description,
        category,
        grade_level: "",
        visibility: "private",
        file_name: getFileNameFromUrl(pdf_link, `${sanitizeFileName(title) || "document"}.pdf`),
        file_path: "",
        file_url: pdf_link,
        thumbnail_url: thumbnailAsset?.secureUrl || thumbnail_link,
        cloudinary_public_id: "",
        cloudinary_resource_type: "",
        thumbnail_cloudinary_public_id: thumbnailAsset?.publicId || "",
        thumbnail_cloudinary_resource_type: thumbnailAsset?.resourceType || "",
        source_type: "link",
        mime_type: "application/pdf",
        file_size: 0,
        page_count: 1
      });

      return mapDocument(document);
    }

    if (file.mimetype !== "application/pdf") {
      throw new AppError("Only PDF documents are supported.", 400);
    }

    const uploadResult = await cloudinaryService.uploadDocument(file, {
      publicIdPrefix: sanitizeFileName(title) || "document"
    });
    const thumbnailAsset = thumbnailFile
      ? await cloudinaryService.uploadImage(thumbnailFile, {
          publicIdPrefix: `${sanitizeFileName(title) || "document"}-thumbnail`
        })
      : null;

    const document = await AdminDocument.create({
      title,
      description,
      category,
      grade_level: "",
      visibility: "private",
      file_name: file.originalname,
      file_path: "",
      file_url: uploadResult.secureUrl,
      thumbnail_url: thumbnailAsset?.secureUrl || (thumbnail_link && isValidHttpUrl(thumbnail_link) ? thumbnail_link : ""),
      cloudinary_public_id: uploadResult.publicId,
      cloudinary_resource_type: uploadResult.resourceType,
      thumbnail_cloudinary_public_id: thumbnailAsset?.publicId || "",
      thumbnail_cloudinary_resource_type: thumbnailAsset?.resourceType || "",
      source_type: "upload",
      mime_type: file.mimetype,
      file_size: uploadResult.bytes || file.size || 0,
      page_count: uploadResult.pages || 1
    });

    return mapDocument(document);
  },

  async updateDocument(documentId, payload, files) {
    const document = await AdminDocument.findById(documentId);
    const file = getUploadedFile(files, "file");
    const thumbnailFile = getUploadedFile(files, "thumbnail_file");

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

    const title = typeof payload?.title === "string" ? payload.title.trim() : "";
    const description = typeof payload?.description === "string" ? payload.description.trim() : "";
    const category = typeof payload?.category === "string" ? payload.category.trim() : "";
    const thumbnailLink = typeof payload?.thumbnail_link === "string" ? payload.thumbnail_link.trim() : "";

    if (!title || !description || !category) {
      throw new AppError("Title, description, and category are required.", 400);
    }

    if (thumbnailLink && !isValidHttpUrl(thumbnailLink)) {
      throw new AppError("Thumbnail link must be a valid http or https URL.", 400);
    }

    if (thumbnailFile && !isSupportedThumbnailMimeType(thumbnailFile.mimetype)) {
      throw new AppError("Thumbnail must be a JPG, PNG, WEBP, GIF, AVIF, HEIC, HEIF, or BMP image.", 400);
    }

    document.title = title;
    document.description = description;
    document.category = category;
    document.grade_level = "";

    if (thumbnailFile) {
      const previousThumbnailPublicId = document.thumbnail_cloudinary_public_id;
      const previousThumbnailResourceType = document.thumbnail_cloudinary_resource_type || "image";
      const thumbnailAsset = await cloudinaryService.uploadImage(thumbnailFile, {
        publicIdPrefix: `${sanitizeFileName(title) || "document"}-thumbnail`
      });

      document.thumbnail_url = thumbnailAsset.secureUrl;
      document.thumbnail_cloudinary_public_id = thumbnailAsset.publicId;
      document.thumbnail_cloudinary_resource_type = thumbnailAsset.resourceType;

      if (previousThumbnailPublicId) {
        await cloudinaryService.destroyAsset({
          publicId: previousThumbnailPublicId,
          resourceType: previousThumbnailResourceType
        });
      }
    } else if (thumbnailLink) {
      if (document.thumbnail_cloudinary_public_id) {
        await cloudinaryService.destroyAsset({
          publicId: document.thumbnail_cloudinary_public_id,
          resourceType: document.thumbnail_cloudinary_resource_type || "image"
        });
      }

      document.thumbnail_url = thumbnailLink;
      document.thumbnail_cloudinary_public_id = "";
      document.thumbnail_cloudinary_resource_type = "";
    }

    if (file) {
      if (file.mimetype !== "application/pdf") {
        throw new AppError("Only PDF documents are supported.", 400);
      }

      const previousCloudinaryPublicId = document.cloudinary_public_id;
      const previousCloudinaryResourceType = document.cloudinary_resource_type || "raw";
      const uploadResult = await cloudinaryService.uploadDocument(file, {
        publicIdPrefix: sanitizeFileName(title) || "document"
      });

      document.file_url = uploadResult.secureUrl;
      document.file_name = file.originalname;
      document.file_path = "";
      document.cloudinary_public_id = uploadResult.publicId;
      document.cloudinary_resource_type = uploadResult.resourceType;
      document.source_type = "upload";
      document.mime_type = file.mimetype;
      document.file_size = uploadResult.bytes || file.size || 0;
      document.page_count = uploadResult.pages || 1;

      if (previousCloudinaryPublicId) {
        await cloudinaryService.destroyAsset({
          publicId: previousCloudinaryPublicId,
          resourceType: previousCloudinaryResourceType
        });
      }
    } else if (typeof payload?.pdf_link === "string" && payload.pdf_link.trim()) {
      const metadataUpdate = normalizeDocumentMetadataUpdate(payload);

      if (document.cloudinary_public_id) {
        await cloudinaryService.destroyAsset({
          publicId: document.cloudinary_public_id,
          resourceType: document.cloudinary_resource_type || "raw"
        });
      }

      document.file_url = metadataUpdate.pdf_link;
      document.file_name = getFileNameFromUrl(
        metadataUpdate.pdf_link,
        document.file_name || `${sanitizeFileName(metadataUpdate.title) || "document"}.pdf`
      );
      document.source_type = "link";
      document.file_path = "";
      document.cloudinary_public_id = "";
      document.cloudinary_resource_type = "";
      document.mime_type = "application/pdf";
      document.file_size = 0;
      document.page_count = 1;
    }

    await document.save();

    return mapDocument(document);
  },

  async deleteDocument(documentId) {
    const document = await AdminDocument.findById(documentId);

    if (!document) {
      throw new AppError("Document not found.", 404);
    }

    if (document.cloudinary_public_id) {
      await cloudinaryService.destroyAsset({
        publicId: document.cloudinary_public_id,
        resourceType: document.cloudinary_resource_type || "raw"
      });
    }

    if (document.thumbnail_cloudinary_public_id) {
      await cloudinaryService.destroyAsset({
        publicId: document.thumbnail_cloudinary_public_id,
        resourceType: document.thumbnail_cloudinary_resource_type || "image"
      });
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
