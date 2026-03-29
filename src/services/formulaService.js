import { AppError } from "../utils/AppError.js";
import { AdminDocument } from "../models/adminDocumentModel.js";
import { formulaRepository } from "../repositories/formulaRepository.js";

/**
 * Handles business logic for formula operations.
 */
const gradePattern = /(\d{1,2})/;

const parseGradeLevel = (value) => {
  const match = String(value || "").match(gradePattern);
  const parsedGrade = Number(match?.[1]);

  if (Number.isInteger(parsedGrade) && parsedGrade >= 7 && parsedGrade <= 12) {
    return parsedGrade;
  }

  return 9;
};

const inferCategoryFromDocument = (document) => {
  if (typeof document.category === "string" && document.category.trim()) {
    return document.category.trim();
  }

  const source = `${document.title || ""} ${document.description || ""} ${document.file_name || ""}`.toLowerCase();

  if (/algebra|equation|polynomial|linear|quadratic/.test(source)) {
    return "Algebra";
  }

  if (/geometry|triangle|circle|angle|area|volume/.test(source)) {
    return "Geometry";
  }

  if (/calculus|derivative|integral|limit|function/.test(source)) {
    return "Calculus";
  }

  return "PDF Resources";
};

const mapAdminDocumentToFormula = (document) => ({
  _id: `admin-document-${document._id.toString()}`,
  title_kh: document.title,
  category: inferCategoryFromDocument(document),
  grade: parseGradeLevel(document.grade_level),
  latex_content: [
    `PDF file: ${document.file_name}`,
    `Grade: ${document.grade_level || "N/A"}`,
    `Download URL: ${document.file_url}`
  ].join("\n"),
  description_kh: document.description,
  pdf_url: document.file_url,
  thumbnail_url: document.thumbnail_url || "",
  source_type: document.source_type || "link",
  file_name: document.file_name,
  file_size: document.file_size || 0,
  page_count: Number(document.page_count || 1) || 1,
  createdAt: document.createdAt,
  updatedAt: document.updatedAt
});

class FormulaService {
  async getFormulas() {
    const [formulas, publicDocuments] = await Promise.all([
      formulaRepository.findAll(),
      AdminDocument.find({ visibility: "public" }).sort({ updatedAt: -1, createdAt: -1 }).lean()
    ]);

    const bridgedDocuments = publicDocuments.map(mapAdminDocumentToFormula);

    return [...formulas, ...bridgedDocuments].sort((left, right) => {
      const gradeDifference = Number(left.grade || 0) - Number(right.grade || 0);

      if (gradeDifference !== 0) {
        return gradeDifference;
      }

      return String(left.title_kh || "").localeCompare(String(right.title_kh || ""));
    });
  }

  async createFormula(formulaData) {
    const requiredFields = [
      "title_kh",
      "category",
      "grade",
      "latex_content",
      "description_kh"
    ];

    for (const field of requiredFields) {
      if (!formulaData[field] && formulaData[field] !== 0) {
        throw new AppError(`The field "${field}" is required.`, 400);
      }
    }

    return formulaRepository.create(formulaData);
  }
}

export const formulaService = new FormulaService();
