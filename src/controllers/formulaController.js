import { formulaService } from "../services/formulaService.js";

/**
 * Returns every formula in the database.
 */
export const getFormulas = async (request, response, next) => {
  try {
    const formulas = await formulaService.getFormulas();
    response.status(200).json(formulas);
  } catch (error) {
    next(error);
  }
};

/**
 * Creates a new formula document.
 */
export const createFormula = async (request, response, next) => {
  try {
    const formula = await formulaService.createFormula(request.body);
    response.status(201).json(formula);
  } catch (error) {
    next(error);
  }
};
