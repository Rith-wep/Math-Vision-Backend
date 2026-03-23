import { Formula } from "../models/formulaModel.js";

/**
 * Keeps MongoDB queries in one place.
 */
class FormulaRepository {
  async findAll() {
    return Formula.find().sort({ grade: 1, title_kh: 1 });
  }

  async create(payload) {
    return Formula.create(payload);
  }
}

export const formulaRepository = new FormulaRepository();
