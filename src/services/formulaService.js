import { AppError } from "../utils/AppError.js";
import { formulaRepository } from "../repositories/formulaRepository.js";

/**
 * Handles business logic for formula operations.
 */
class FormulaService {
  async getFormulas() {
    return formulaRepository.findAll();
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
