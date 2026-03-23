import { Router } from "express";

import {
  createFormula,
  getFormulas
} from "../controllers/formulaController.js";

export const formulaRoutes = Router();

// Return every saved formula.
formulaRoutes.get("/", getFormulas);

// Create a new formula document.
formulaRoutes.post("/", createFormula);
