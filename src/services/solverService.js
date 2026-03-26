import { GoogleGenerativeAI } from "@google/generative-ai";
import nerdamer from "nerdamer";
import "nerdamer/Algebra.js";
import "nerdamer/Calculus.js";
import "nerdamer/Solve.js";

import { env } from "../config/env.js";
import { SolutionLibrary } from "../models/solutionLibraryModel.js";
import { AppError } from "../utils/AppError.js";

const GEMINI_MODEL = "gemini-2.5-flash";
const ALLOWED_COMPLEXITIES = new Set(["identity", "basic", "complex"]);
const SUPPORTED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_EXPRESSION_LENGTH = 1200;
const EPSILON = 1e-9;
const LIBRARY_QUERY_TIMEOUT_MS = 2000;
const LIBRARY_LABEL = "រកឃើញក្នុងបណ្ណាល័យចម្លើយ";

const INVALID_EQUATION_MESSAGE = "The math expression is not valid. Please check it again.";

const buildTextPrompt = (expression, detectedType = "general_math") => `
You are the Intelligent Math Engine for Math Vision, developed by Hong Sovannarith.
Your goal is to solve math problems with maximum efficiency.

Detected problem type: ${detectedType}

You must categorize every user input into exactly one level before responding:

1. identity
- Examples: "102", "x", "22"
- Do NOT explain.
- Do NOT provide steps.
- final_answer must just be the original number or variable in LaTeX.

2. basic
- Examples: "1+1", "5*10", "100/4"
- Provide the answer immediately.
- Use at most 1 short step.
- Keep the Khmer explanation concise and professional.

3. complex
- Examples: equations, calculus, systems, graphing, or word problems
- Provide a detailed professional step-by-step solution in Khmer.
- Never repeat the original question in the steps.
- Avoid wasting words.

Question:
${expression}

Return this exact JSON shape:
{
  "question_text": "Clean math text or LaTeX",
  "complexity": "identity | basic | complex",
  "final_answer": "LaTeX_string",
  "steps": [
    {
      "step": 1,
      "explanation": "Khmer_text",
      "formula": "LaTeX_string"
    }
  ],
  "token_saved_mode": true
}

Rules:
- Return only JSON, no markdown fences.
- Keep every formula and final_answer value valid LaTeX.
- Use Khmer for every explanation value.
- For identity: steps must be [].
- For basic: use 0 or 1 short step only.
- For complex: use 3 to 6 steps.
- token_saved_mode must be true.
- question_text must preserve the actual math problem cleanly.
`;

const buildImagePrompt = () => `
You are the Intelligent Math Engine for Math Vision, developed by Hong Sovannarith.

The user uploaded an image of a math problem. Complete these tasks in one pass:
1. Read the math problem from the image.
2. Convert it into a clean math text/LaTeX string.
3. Solve it step-by-step in Khmer.

Return this exact JSON shape:
{
  "question_text": "Clean math text or LaTeX extracted from the image",
  "complexity": "identity | basic | complex",
  "final_answer": "LaTeX_string",
  "steps": [
    {
      "step": 1,
      "explanation": "Khmer_text",
      "formula": "LaTeX_string"
    }
  ],
  "token_saved_mode": true
}

Rules:
- Return only JSON, no markdown fences.
- question_text must contain only the math problem, not extra narration.
- Keep every formula and final_answer value valid LaTeX.
- Use Khmer for every explanation value.
- For identity: steps must be [].
- For basic: use 0 or 1 short step only.
- For complex: use 3 to 6 steps.
- token_saved_mode must be true.
`;

const buildImageExtractionPrompt = () => `
You are the Math Vision OCR extraction engine.

The user uploaded an image containing a math question.
Read the image carefully and return only the extracted math expression or question text.

Return this exact JSON shape:
{
  "question_text": "Clean math text or LaTeX extracted from the image"
}

Rules:
- Return only JSON, no markdown fences.
- question_text must contain only the math problem.
- Preserve math symbols and LaTeX when possible.
- Do not include explanations or steps.
`;

const buildGeometryPrompt = (expression) => `
You are the Math Vision geometry specialist for Khmer high-school mathematics.

The question below may be a long analytic geometry, vector, line, plane, or 3D coordinate problem.
Solve it carefully and professionally in Khmer.

Important priorities:
- Read the full problem before solving.
- If the problem has multiple sub-parts, solve them in a logical order.
- Keep formulas mathematically rigorous.
- Use vector, coordinate, line, plane, distance, dot-product, and cross-product formulas when relevant.
- Preserve symbols such as A, B, C, D, M, O, i, j, k, AB, AC, (P), (D), etc.
- Do not skip important derivation steps for geometry.
- If there are multiple sub-questions, steps may correspond to those sub-questions.

Question:
${expression}

Return this exact JSON shape:
{
  "question_text": "Clean math text or LaTeX",
  "complexity": "identity | basic | complex",
  "final_answer": "LaTeX_string",
  "steps": [
    {
      "step": 1,
      "explanation": "Khmer_text",
      "formula": "LaTeX_string"
    }
  ],
  "token_saved_mode": true
}

Rules:
- Return only JSON, no markdown fences.
- question_text must preserve the actual geometry problem cleanly.
- Use Khmer for every explanation.
- For long geometry questions, use 4 to 8 high-value steps if needed.
- Keep every formula and final_answer valid LaTeX or clean math notation.
- final_answer should summarize the important final results, not just repeat the question.
- token_saved_mode must be true.
`;

const buildRepairPrompt = (rawResponse, fallbackQuestionText = "") => `
You are repairing a malformed Math Vision solver response.

Return only valid JSON in this exact shape:
{
  "question_text": "Clean math text or LaTeX",
  "complexity": "identity | basic | complex",
  "final_answer": "LaTeX_string",
  "steps": [
    {
      "step": 1,
      "explanation": "Khmer_text",
      "formula": "LaTeX_string"
    }
  ],
  "token_saved_mode": true
}

Rules:
- Return only JSON, with no markdown fences or extra text.
- Keep question_text as the real math problem.
- Keep every formula and final_answer as valid LaTeX or clean math text.
- Use Khmer for every explanation.
- For identity: steps must be [].
- For basic: use 0 or 1 short step only.
- For complex: use 3 to 6 steps.
- token_saved_mode must be true.
- If question_text is missing, use this question: ${fallbackQuestionText || "unknown"}.

Malformed response:
${rawResponse}
`;

const extractJson = (text) => {
  const normalized = text.trim();
  const codeBlockMatch = normalized.match(/```json\s*([\s\S]*?)```/i);

  if (codeBlockMatch) {
    return JSON.parse(codeBlockMatch[1]);
  }

  const firstBrace = normalized.indexOf("{");
  const lastBrace = normalized.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1) {
    throw new AppError("Gemini did not return a valid JSON object.", 502);
  }

  return JSON.parse(normalized.slice(firstBrace, lastBrace + 1));
};

const sanitizeField = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/```(?:json|latex)?/gi, "")
    .replace(/```/g, "")
    .trim();
};

const hasMathLikeContent = (value) => /[0-9a-zA-Z\\^_=+\-*/()[\]{}]/.test(value);

const normalizeExpressionInput = (expression) => {
  if (typeof expression !== "string") {
    throw new AppError(INVALID_EQUATION_MESSAGE, 400);
  }

  const normalized = expression.replace(/\u0000/g, "").replace(/\s+/g, " ").trim();

  if (!normalized || !hasMathLikeContent(normalized)) {
    throw new AppError(INVALID_EQUATION_MESSAGE, 400);
  }

  if (normalized.length > MAX_EXPRESSION_LENGTH) {
    throw new AppError("The math expression is too long to solve right now.", 400);
  }

  return normalized;
};

const normalizeExpressionForLibrary = (expression) =>
  sanitizeField(expression)
    .toLowerCase()
    .replace(/\\left|\\right/g, "")
    .replace(/\\,/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([=+\-*/^(){}\[\],])\s*/g, "$1")
    .trim();

const buildLibrarySearchExpression = (expression) =>
  normalizeExpressionForLibrary(expression)
    .replace(/[{}[\]()]/g, " ")
    .replace(/\\[a-z]+/g, " ")
    .replace(/[^a-z0-9\u1780-\u17ff]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const computeSimilarityScore = (left, right) => {
  if (!left || !right) {
    return 0;
  }

  if (left === right) {
    return 1;
  }

  const leftTokens = new Set(left.split(" ").filter(Boolean));
  const rightTokens = new Set(right.split(" ").filter(Boolean));

  if (!leftTokens.size || !rightTokens.size) {
    return 0;
  }

  let intersectionCount = 0;

  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) {
      intersectionCount += 1;
    }
  });

  return intersectionCount / new Set([...leftTokens, ...rightTokens]).size;
};

const buildLibraryResponse = (solutionDocument) => {
  const plainSolution = JSON.parse(JSON.stringify(solutionDocument.solution || {}));

  return {
    ...plainSolution,
    servedFromLibrary: true,
    cacheLabel: LIBRARY_LABEL
  };
};

const normalizeComplexity = (complexity, steps) => {
  if (ALLOWED_COMPLEXITIES.has(complexity)) {
    return complexity;
  }

  return steps.length <= 1 ? "basic" : "complex";
};

const normalizeStep = (step, index) => {
  if (!step || typeof step !== "object") {
    return null;
  }

  const explanation = sanitizeField(step.explanation);
  const formula = sanitizeField(step.formula);

  if (!explanation && !formula) {
    return null;
  }

  return {
    step: Number.isFinite(step.step) ? step.step : index + 1,
    explanation,
    formula
  };
};

const validateAndNormalizeResponse = (parsed, fallbackQuestionText = "") => {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new AppError("Gemini returned an invalid solver payload.", 502);
  }

  const normalizedSteps = Array.isArray(parsed.steps)
    ? parsed.steps.map((step, index) => normalizeStep(step, index)).filter(Boolean)
    : [];

  const complexity = normalizeComplexity(parsed.complexity, normalizedSteps);

  let questionText = sanitizeField(parsed.question_text) || fallbackQuestionText;

  if (!questionText || !hasMathLikeContent(questionText)) {
    questionText = fallbackQuestionText;
  }

  if (!questionText) {
    throw new AppError("Gemini did not return a valid math question.", 502);
  }

  let finalAnswer =
    sanitizeField(parsed.final_answer)
    || normalizedSteps.at(-1)?.formula
    || (complexity === "identity" ? questionText : "");

  if (!finalAnswer) {
    throw new AppError("Gemini did not return a final answer.", 502);
  }

  let steps = normalizedSteps;

  if (complexity === "identity") {
    steps = [];
    finalAnswer = sanitizeField(parsed.final_answer) || questionText;
  } else if (complexity === "basic") {
    steps = normalizedSteps.slice(0, 1);
  } else {
    steps = normalizedSteps.slice(0, 6);

    if (steps.length === 0) {
      throw new AppError("Gemini did not return usable solution steps.", 502);
    }
  }

  return {
    question_text: questionText,
    expression: questionText,
    complexity,
    final_answer: finalAnswer,
    steps,
    token_saved_mode: true
  };
};

const validateExtractedQuestionText = (parsed) => {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new AppError("Gemini returned an invalid image extraction payload.", 502);
  }

  const questionText = sanitizeField(parsed.question_text);

  if (!questionText || !hasMathLikeContent(questionText)) {
    throw new AppError("Unable to extract a math problem from the image.", 422);
  }

  return normalizeExpressionInput(questionText);
};

const isApproximatelyZero = (value) => Math.abs(value) <= EPSILON;
const isPerfectSquareInteger = (value) => Number.isInteger(value) && value >= 0 && Number.isInteger(Math.sqrt(value));

const gcd = (left, right) => {
  let a = Math.abs(left);
  let b = Math.abs(right);

  while (b) {
    [a, b] = [b, a % b];
  }

  return a || 1;
};

const toReducedFraction = (value, maxDenominator = 1000) => {
  if (!Number.isFinite(value)) {
    return null;
  }

  const sign = value < 0 ? -1 : 1;
  const absolute = Math.abs(value);
  const rounded = Math.round(absolute);

  if (Math.abs(absolute - rounded) <= EPSILON) {
    return { numerator: sign * rounded, denominator: 1 };
  }

  for (let denominator = 1; denominator <= maxDenominator; denominator += 1) {
    const numerator = Math.round(absolute * denominator);

    if (Math.abs(absolute - numerator / denominator) <= 1e-9) {
      const divisor = gcd(numerator, denominator);

      return {
        numerator: sign * (numerator / divisor),
        denominator: denominator / divisor
      };
    }
  }

  return null;
};

const toLatexNumber = (value, { preferFraction = true } = {}) => {
  if (isApproximatelyZero(value)) {
    return "0";
  }

  const fraction = preferFraction ? toReducedFraction(value) : null;

  if (fraction) {
    if (fraction.denominator === 1) {
      return String(fraction.numerator);
    }

    const absoluteNumerator = Math.abs(fraction.numerator);
    const fractionLatex = `\\frac{${absoluteNumerator}}{${fraction.denominator}}`;

    return fraction.numerator < 0 ? `-${fractionLatex}` : fractionLatex;
  }

  return normalizeNumberString(value);
};

const normalizeNumberString = (value) => {
  if (isApproximatelyZero(value)) {
    return "0";
  }

  const rounded = Math.round(value);

  if (Math.abs(value - rounded) <= EPSILON) {
    return String(rounded);
  }

  return value.toFixed(6).replace(/\.?0+$/, "");
};

const replaceFractions = (value) => {
  let current = value;
  const fractionPattern = /\\frac\{([^{}]+)\}\{([^{}]+)\}/g;

  while (fractionPattern.test(current)) {
    current = current.replace(fractionPattern, "(($1)/($2))");
  }

  return current;
};

const normalizeLocalMath = (expression) => {
  let normalized = sanitizeField(expression)
    .replace(/\\left|\\right/g, "")
    .replace(/[−–—]/g, "-")
    .replace(/[×]/g, "*")
    .replace(/[÷]/g, "/")
    .replace(/\\times|\\cdot/g, "*")
    .replace(/\\div/g, "/")
    .replace(/\\pi/g, String(Math.PI))
    .replace(/([a-zA-Z0-9)])\^\{([^{}]+)\}/g, "$1^($2)")
    .replace(/([a-zA-Z0-9)])\^([a-zA-Z0-9.]+)/g, "$1^($2)");

  normalized = replaceFractions(normalized);
  normalized = normalized.replace(/[{}]/g, (character) => (character === "{" ? "(" : ")"));
  normalized = normalized.replace(/\s+/g, "");
  normalized = normalized.replace(/(\d)([xy(])/gi, "$1*$2");
  normalized = normalized.replace(/([xy])(\d)/gi, "$1*$2");
  normalized = normalized.replace(/([xy)])\(/gi, "$1*(");
  normalized = normalized.replace(/\)(\d|[xy])/gi, ")*$1");

  return normalized;
};

const evaluateSafeExpression = (expression, variableSymbol = "", variableValue = 0) => {
  let jsExpression = normalizeLocalMath(expression).replace(/\^/g, "**");

  if (variableSymbol) {
    const variablePattern = new RegExp(variableSymbol, "g");
    jsExpression = jsExpression.replace(variablePattern, `(${variableValue})`);
  }

  if (!/^[0-9+\-*/().*\s]+$/.test(jsExpression)) {
    throw new AppError(INVALID_EQUATION_MESSAGE, 400);
  }

  const value = Function(`"use strict"; return (${jsExpression});`)();

  if (!Number.isFinite(value)) {
    throw new AppError(INVALID_EQUATION_MESSAGE, 400);
  }

  return value;
};

const isIdentityExpression = (expression) =>
  /^\s*(?:\d+(?:\.\d+)?|[a-zA-Z])\s*$/.test(expression);

const canEvaluateLocally = (expression) => {
  try {
    const normalized = normalizeLocalMath(expression);

    if (!normalized || /[xy]/i.test(normalized)) {
      return false;
    }

    evaluateSafeExpression(expression);
    return true;
  } catch {
    return false;
  }
};

const buildArithmeticResult = (expression) => {
  const finalAnswer = toLatexNumber(evaluateSafeExpression(expression));

  return {
    question_text: expression,
    expression,
    complexity: "basic",
    final_answer: finalAnswer,
    steps: [
      {
        step: 1,
        explanation: "គណនាតម្លៃដោយផ្ទាល់។",
        formula: finalAnswer
      }
    ],
    token_saved_mode: true
  };
};

const normalizeInequalityOperators = (expression) =>
  sanitizeField(expression)
    .replace(/\\leq|≤/gi, "<=")
    .replace(/\\geq|≥/gi, ">=")
    .replace(/\\lt/gi, "<")
    .replace(/\\gt/gi, ">");

const parseInequalityExpression = (expression) => {
  const normalized = normalizeInequalityOperators(expression);
  const match = normalized.match(/^(.*?)(<=|>=|<|>)(.*)$/);

  if (!match) {
    return null;
  }

  const [, leftSide, operator, rightSide] = match;

  if (!leftSide?.trim() || !rightSide?.trim()) {
    return null;
  }

  if ((normalized.match(/<=|>=|<|>/g) || []).length !== 1) {
    return null;
  }

  return {
    leftSide: leftSide.trim(),
    operator,
    rightSide: rightSide.trim()
  };
};

const detectVariableSymbol = (expression) => {
  const variables = new Set((expression.match(/[xy]/gi) || []).map((character) => character.toLowerCase()));

  if (variables.size !== 1) {
    return "";
  }

  return [...variables][0];
};

const detectUnsupportedExpression = (expression) => {
  if (/\\begin\{(?:matrix|bmatrix|pmatrix|cases)\}/i.test(expression)) {
    return "structured_latex";
  }

  if (/\[[^\]]*,[^\]]*\]/.test(expression)) {
    return "matrix_like";
  }

  if (/[<>≤≥]/.test(expression) || /\\leq|\\geq|\\lt|\\gt/i.test(expression)) {
    return "inequality";
  }

  if (/\|[^|]+\|/.test(expression) || /\\left\|.+\\right\|/.test(expression)) {
    return "absolute_value";
  }

  if (/\\sum|\\prod|\\lim/i.test(expression)) {
    return "advanced_operator";
  }

  const variables = new Set((expression.match(/[a-z]/gi) || []).map((character) => character.toLowerCase()));

  if ([...variables].filter((character) => ["x", "y", "z"].includes(character)).length > 1) {
    return "multi_variable";
  }

  return "";
};

const buildUnsupportedResult = (expression, unsupportedType) => ({
  question_text: expression,
  expression,
  complexity: "complex",
  final_answer: "\\text{Not fully supported yet}",
  steps: [
    {
      step: 1,
      explanation: "ប្រភេទលំហាត់នេះមិនទាន់គាំទ្របានពេញលេញនៅក្នុងម៉ាស៊ីនដោះស្រាយក្នុងស្រុកនៅឡើយទេ។",
      formula: expression
    },
    {
      step: 2,
      explanation: `Math Vision បានរកឃើញថាវាជាប្រភេទ ${unsupportedType.replace(/_/g, " ")} ហើយត្រូវការម៉ូឌុលដោះស្រាយបន្ថែមដើម្បីឱ្យបានត្រឹមត្រូវជាងនេះ។`,
      formula: "\\text{Please try a simpler equivalent form}"
    }
  ],
  token_saved_mode: true
});

const toLatexFromNerdamer = (value) => {
  const text = typeof value === "string" ? value : value?.toString?.() || "";

  if (!text) {
    return "";
  }

  return nerdamer.convertToLaTeX(text).replace(/\\cdot/g, "");
};

const normalizeForNerdamer = (expression) =>
  sanitizeField(expression)
    .replace(/\\left|\\right/g, "")
    .replace(/[−–—]/g, "-")
    .replace(/[×]/g, "*")
    .replace(/[÷]/g, "/")
    .replace(/\\times|\\cdot/g, "*")
    .replace(/\\div/g, "/")
    .replace(/\\ln/g, "log")
    .replace(/\\sin/g, "sin")
    .replace(/\\cos/g, "cos")
    .replace(/\\tan/g, "tan")
    .replace(/\\pi/g, "pi")
    .replace(/\s+/g, "");

const splitSystemEquations = (expression) =>
  expression
    .split(/[\n;]+/)
    .map((part) => part.trim())
    .filter(Boolean);

const isAlgebraicEquation = (expression) => {
  if (!expression.includes("=")) {
    return false;
  }

  return !/sin|cos|tan|log|ln|\\int|d\/d|\\frac\{d\}/i.test(expression);
};

const detectDerivativeRequest = (expression) => {
  const compact = sanitizeField(expression).replace(/\s+/g, "");
  let match = compact.match(/^\\frac\{d\}\{d([a-zA-Z])\}\((.+)\)$/);

  if (match) {
    return { variable: match[1], body: match[2] };
  }

  match = compact.match(/^\\frac\{d\}\{d([a-zA-Z])\}(.+)$/);

  if (match) {
    return { variable: match[1], body: match[2] };
  }

  match = compact.match(/^d\/d([a-zA-Z])\((.+)\)$/i);

  if (match) {
    return { variable: match[1], body: match[2] };
  }

  match = compact.match(/^d\/d([a-zA-Z])(.+)$/i);

  if (match) {
    return { variable: match[1], body: match[2] };
  }

  return null;
};

const detectIntegralRequest = (expression) => {
  const compact = sanitizeField(expression).replace(/\s+/g, " ");
  let match = compact.match(/^\\int\s+(.+)\sd([a-zA-Z])$/i);

  if (match) {
    return { variable: match[2], body: match[1] };
  }

  match = compact.match(/^integrate\((.+),\s*([a-zA-Z])\)$/i);

  if (match) {
    return { variable: match[2], body: match[1] };
  }

  return null;
};

const buildSystemSolutionResult = (expression, solutionEntries) => {
  const formulas = solutionEntries.map(([variable, value]) => `${variable} = ${toLatexFromNerdamer(String(value))}`);

  return {
    question_text: expression,
    expression,
    complexity: "complex",
    final_answer: formulas.join(",\\quad "),
    steps: [
      {
        step: 1,
        explanation: "រៀបចំប្រព័ន្ធសមីការដែលត្រូវដោះស្រាយ។",
        formula: splitSystemEquations(expression).join(",\\quad ")
      },
      {
        step: 2,
        explanation: "ដោះស្រាយតម្លៃអថេរទាំងអស់ក្នុងប្រព័ន្ធសមីការ។",
        formula: formulas.join(",\\quad ")
      }
    ],
    token_saved_mode: true
  };
};

const trySolveLinearSystem = (expression) => {
  const equations = splitSystemEquations(expression);

  if (equations.length < 2) {
    return null;
  }

  const detectedVariables = [...new Set((equations.join("").match(/[xyz]/gi) || []).map((item) => item.toLowerCase()))];

  if (detectedVariables.length < 2 || detectedVariables.length > 3) {
    return null;
  }

  if (equations.some((equation) => !equation.includes("="))) {
    return null;
  }

  try {
    const normalizedEquations = equations.map((equation) => normalizeForNerdamer(equation));
    const solutions = nerdamer.solveEquations(normalizedEquations, detectedVariables);

    if (!Array.isArray(solutions) || solutions.length === 0) {
      return null;
    }

    return buildSystemSolutionResult(expression, solutions);
  } catch {
    return null;
  }
};

const buildSymbolicEquationResult = (expression, variableSymbol, solutions) => {
  const latexSolutions = solutions.map((solution) => `${variableSymbol} = ${toLatexFromNerdamer(solution)}`);

  return {
    question_text: expression,
    expression,
    complexity: "complex",
    final_answer: latexSolutions.join("\\;\\text{or}\\;"),
    steps: [
      {
        step: 1,
        explanation: "រៀបចំសមីការដើម្បីរកតម្លៃអថេរ។",
        formula: sanitizeField(expression)
      },
      {
        step: 2,
        explanation: "ប្រើម៉ាស៊ីនសមីការសញ្ញាណដើម្បីរកឫសទាំងអស់។",
        formula: latexSolutions.join(",\\quad ")
      }
    ],
    token_saved_mode: true
  };
};

const trySolveSymbolicEquation = (expression) => {
  if (!isAlgebraicEquation(expression)) {
    return null;
  }

  const variableSymbol = detectVariableSymbol(expression);

  if (!variableSymbol) {
    return null;
  }

  try {
    const solutions = nerdamer.solveEquations(normalizeForNerdamer(expression), variableSymbol);

    if (!Array.isArray(solutions) || solutions.length === 0) {
      return null;
    }

    const solutionTexts = solutions.map((solution) => solution.toString());

    if (solutionTexts.some((item) => !item || item === "undefined")) {
      return null;
    }

    return buildSymbolicEquationResult(expression, variableSymbol, solutionTexts);
  } catch {
    return null;
  }
};

const buildDerivativeResult = (expression, variable, derivative) => ({
  question_text: expression,
  expression,
  complexity: "complex",
  final_answer: toLatexFromNerdamer(derivative),
  steps: [
    {
      step: 1,
      explanation: `កំណត់អនុគមន៍តាមអថេរ ${variable}។`,
      formula: sanitizeField(expression)
    },
    {
      step: 2,
      explanation: "គណនាដេរីវេដោយប្រើម៉ាស៊ីនសញ្ញាណ។",
      formula: toLatexFromNerdamer(derivative)
    }
  ],
  token_saved_mode: true
});

const trySolveDerivative = (expression) => {
  const request = detectDerivativeRequest(expression);

  if (!request) {
    return null;
  }

  try {
    const derivative = nerdamer(`diff(${normalizeForNerdamer(request.body)},${request.variable})`).toString();
    return buildDerivativeResult(expression, request.variable, derivative);
  } catch {
    return null;
  }
};

const buildIntegralResult = (expression, variable, integral) => ({
  question_text: expression,
  expression,
  complexity: "complex",
  final_answer: `${toLatexFromNerdamer(integral)} + C`,
  steps: [
    {
      step: 1,
      explanation: `កំណត់អាំងតេក្រាលតាមអថេរ ${variable}។`,
      formula: sanitizeField(expression)
    },
    {
      step: 2,
      explanation: "គណនាអាំងតេក្រាលមិនកំណត់។",
      formula: `${toLatexFromNerdamer(integral)} + C`
    }
  ],
  token_saved_mode: true
});

const trySolveIntegral = (expression) => {
  const request = detectIntegralRequest(expression);

  if (!request) {
    return null;
  }

  try {
    const integral = nerdamer(`integrate(${normalizeForNerdamer(request.body)},${request.variable})`).toString();
    return buildIntegralResult(expression, request.variable, integral);
  } catch {
    return null;
  }
};

const buildSymbolicExpressionResult = (expression, mode, result) => ({
  question_text: expression,
  expression,
  complexity: "basic",
  final_answer: toLatexFromNerdamer(result),
  steps: [
    {
      step: 1,
      explanation:
        mode === "factor"
          ? "បំបែកកន្សោមទៅជាផលគុណដែលសាមញ្ញជាង។"
          : "សម្រួលកន្សោមឱ្យមានទម្រង់ស្អាត និងខ្លីជាង។",
      formula: toLatexFromNerdamer(result)
    }
  ],
  token_saved_mode: true
});

const trySimplifySymbolicExpression = (expression) => {
  if (expression.includes("=") || /[<>≤≥]/.test(expression) || /\\int|\\frac\{d\}|d\/d/i.test(expression)) {
    return null;
  }

  if (!/[a-z]/i.test(expression)) {
    return null;
  }

  try {
    const normalized = normalizeForNerdamer(expression);
    const factored = nerdamer(`factor(${normalized})`).toString();

    if (factored && factored !== normalized) {
      return buildSymbolicExpressionResult(expression, "factor", factored);
    }

    const simplified = nerdamer(`simplify(${normalized})`).toString();

    if (simplified && simplified !== normalized) {
      return buildSymbolicExpressionResult(expression, "simplify", simplified);
    }

    return null;
  } catch {
    return null;
  }
};

const buildPolynomialLatex = (coefficients, variableSymbol) => {
  const entries = [
    { coefficient: coefficients.a || 0, power: 2 },
    { coefficient: coefficients.b || 0, power: 1 },
    { coefficient: coefficients.c || 0, power: 0 }
  ];

  const terms = [];

  for (const { coefficient, power } of entries) {
    if (isApproximatelyZero(coefficient)) {
      continue;
    }

    const absoluteValue = Math.abs(coefficient);
    const sign = coefficient < 0 ? "-" : "+";
    let body = toLatexNumber(absoluteValue);

    if (power === 1) {
      body = isApproximatelyZero(absoluteValue - 1)
        ? variableSymbol
        : `${body}${variableSymbol}`;
    } else if (power === 2) {
      body = isApproximatelyZero(absoluteValue - 1)
        ? `${variableSymbol}^{2}`
        : `${body}${variableSymbol}^{2}`;
    }

    terms.push({ sign, body });
  }

  if (terms.length === 0) {
    return "0";
  }

  return terms
    .map((term, index) => {
      if (index === 0) {
        return term.sign === "-" ? `-${term.body}` : term.body;
      }

      return `${term.sign === "-" ? "-" : "+"} ${term.body}`;
    })
    .join(" ");
};

const toLatexInequalityOperator = (operator) => {
  if (operator === "<=") return "\\leq";
  if (operator === ">=") return "\\geq";
  return operator;
};

const reverseInequalityOperator = (operator) => {
  if (operator === "<") return ">";
  if (operator === ">") return "<";
  if (operator === "<=") return ">=";
  if (operator === ">=") return "<=";
  return operator;
};

const analyzeLinearInequality = (expression) => {
  const parts = parseInequalityExpression(expression);

  if (!parts) {
    return null;
  }

  const variableSymbol = detectVariableSymbol(expression);

  if (!variableSymbol) {
    return null;
  }

  const normalizedLeft = normalizeLocalMath(parts.leftSide);
  const normalizedRight = normalizeLocalMath(parts.rightSide);

  if (!normalizedLeft || !normalizedRight) {
    return null;
  }

  if (!/^[0-9xy+\-*/().^]*$/i.test(normalizedLeft) || !/^[0-9xy+\-*/().^]*$/i.test(normalizedRight)) {
    return null;
  }

  try {
    const differenceExpression = `(${parts.leftSide})-(${parts.rightSide})`;
    const values = [0, 1, 2].map((sample) =>
      evaluateSafeExpression(differenceExpression, variableSymbol, sample)
    );

    const secondDifference = values[2] - 2 * values[1] + values[0];

    if (Math.abs(secondDifference) > 1e-6) {
      return null;
    }

    const constantTerm = values[0];
    const variableCoefficient = values[1] - values[0];

    if (isApproximatelyZero(variableCoefficient)) {
      return null;
    }

    return {
      variableSymbol,
      operator: parts.operator,
      variableCoefficient,
      constantTerm
    };
  } catch {
    return null;
  }
};

const analyzeQuadraticInequality = (expression) => {
  const parts = parseInequalityExpression(expression);

  if (!parts) {
    return null;
  }

  const variableSymbol = detectVariableSymbol(expression);

  if (!variableSymbol) {
    return null;
  }

  const normalizedLeft = normalizeLocalMath(parts.leftSide);
  const normalizedRight = normalizeLocalMath(parts.rightSide);

  if (!normalizedLeft || !normalizedRight) {
    return null;
  }

  if (!/^[0-9xy+\-*/().^]*$/i.test(normalizedLeft) || !/^[0-9xy+\-*/().^]*$/i.test(normalizedRight)) {
    return null;
  }

  try {
    const differenceExpression = `(${parts.leftSide})-(${parts.rightSide})`;
    const values = [0, 1, 2, 3].map((sample) =>
      evaluateSafeExpression(differenceExpression, variableSymbol, sample)
    );

    const thirdDifference = values[3] - 3 * values[2] + 3 * values[1] - values[0];

    if (Math.abs(thirdDifference) > 1e-6) {
      return null;
    }

    const c = values[0];
    const a = (values[2] - 2 * values[1] + values[0]) / 2;
    const b = values[1] - a - c;

    if (isApproximatelyZero(a)) {
      return null;
    }

    return {
      variableSymbol,
      operator: parts.operator,
      coefficients: {
        a,
        b,
        c
      }
    };
  } catch {
    return null;
  }
};

const analyzePolynomialEquation = (expression) => {
  if ((expression.match(/=/g) || []).length !== 1) {
    return null;
  }

  const variableSymbol = detectVariableSymbol(expression);

  if (!variableSymbol) {
    return null;
  }

  const normalized = normalizeLocalMath(expression);

  if (!/^[0-9xy+\-*/().=^]*$/i.test(normalized)) {
    return null;
  }

  const [leftSide, rightSide] = normalized.split("=");

  if (!leftSide || !rightSide) {
    return null;
  }

  try {
    const values = [0, 1, 2, 3].map((sample) =>
      evaluateSafeExpression(`(${leftSide})-(${rightSide})`, variableSymbol, sample)
    );

    const thirdDifference = values[3] - 3 * values[2] + 3 * values[1] - values[0];

    if (Math.abs(thirdDifference) > 1e-6) {
      return null;
    }

    const c = values[0];
    const a = (values[2] - 2 * values[1] + values[0]) / 2;
    const b = values[1] - a - c;

    if (isApproximatelyZero(a) && isApproximatelyZero(b)) {
      return null;
    }

    if (isApproximatelyZero(a)) {
      return {
        type: "linear_equation",
        variableSymbol,
        coefficients: {
          a: 0,
          b,
          c
        }
      };
    }

    return {
      type: "quadratic_equation",
      variableSymbol,
      coefficients: {
        a,
        b,
        c
      }
    };
  } catch {
    return null;
  }
};

const buildLinearInequalityResult = (expression, analysis) => {
  const {
    variableSymbol,
    operator,
    variableCoefficient,
    constantTerm
  } = analysis;
  const standardForm = `${buildPolynomialLatex(
    { b: variableCoefficient, c: constantTerm },
    variableSymbol
  )} ${toLatexInequalityOperator(operator)} 0`;
  const boundary = -constantTerm / variableCoefficient;
  const finalOperator = variableCoefficient < 0 ? reverseInequalityOperator(operator) : operator;
  const finalAnswer = `${variableSymbol} ${toLatexInequalityOperator(finalOperator)} ${toLatexNumber(boundary)}`;

  return {
    question_text: expression,
    expression,
    complexity: "complex",
    final_answer: finalAnswer,
    steps: [
      {
        step: 1,
        explanation: "រៀបចំអសមីការទៅទម្រង់ស្តង់ដារ។",
        formula: standardForm
      },
      {
        step: 2,
        explanation: "ដោះស្រាយតម្លៃអថេរ ហើយប្តូរទិសសញ្ញាប្រសិនបើចែកដោយចំនួនអវិជ្ជមាន។",
        formula: finalAnswer
      }
    ],
    token_saved_mode: true
  };
};

const evaluateInequalityRelation = (value, operator) => {
  if (operator === "<") return value < -EPSILON;
  if (operator === "<=") return value <= EPSILON;
  if (operator === ">") return value > EPSILON;
  if (operator === ">=") return value >= -EPSILON;
  return false;
};

const getQuadraticRootLatex = (a, b, discriminant, variant = "single") => {
  if (isApproximatelyZero(discriminant)) {
    return toLatexNumber(-b / (2 * a));
  }

  const sqrtDiscriminant = Math.sqrt(Math.max(discriminant, 0));
  const denominator = 2 * a;
  const approximateRoot =
    variant === "lower"
      ? (-b - sqrtDiscriminant) / denominator
      : (-b + sqrtDiscriminant) / denominator;

  if (isPerfectSquareInteger(discriminant)) {
    return toLatexNumber(approximateRoot);
  }

  const denominatorLatex = toLatexNumber(denominator);
  const numeratorPrefix = isApproximatelyZero(-b) ? "" : `${toLatexNumber(-b, { preferFraction: false })}`;
  const sqrtLatex = `\\sqrt{${normalizeNumberString(discriminant)}}`;

  if (variant === "lower") {
    const numerator = numeratorPrefix ? `${numeratorPrefix} - ${sqrtLatex}` : `-${sqrtLatex}`;
    return `\\frac{${numerator}}{${denominatorLatex}}`;
  }

  const numerator = numeratorPrefix ? `${numeratorPrefix} + ${sqrtLatex}` : sqrtLatex;
  return `\\frac{${numerator}}{${denominatorLatex}}`;
};

const buildQuadraticInequalityFinalAnswer = ({
  variableSymbol,
  operator,
  a,
  b,
  discriminant
}) => {
  if (discriminant < -EPSILON) {
    return evaluateInequalityRelation(a, operator) ? "All real numbers" : "No real solution";
  }

  if (isApproximatelyZero(discriminant)) {
    const rootLatex = getQuadraticRootLatex(a, b, 0);

    if ((a > 0 && operator === ">=") || (a < 0 && operator === "<=")) {
      return "All real numbers";
    }

    if ((a > 0 && operator === "<") || (a < 0 && operator === ">")) {
      return "No real solution";
    }

    if ((a > 0 && operator === "<=") || (a < 0 && operator === ">=")) {
      return `${variableSymbol} = ${rootLatex}`;
    }

    return `${variableSymbol} < ${rootLatex} \\;\\mathrm{or}\\; ${variableSymbol} > ${rootLatex}`;
  }

  const lowerRootLatex = getQuadraticRootLatex(a, b, discriminant, "lower");
  const upperRootLatex = getQuadraticRootLatex(a, b, discriminant, "upper");
  const opensUp = a > 0;

  if ((opensUp && operator === "<") || (!opensUp && operator === ">")) {
    return `${lowerRootLatex} < ${variableSymbol} < ${upperRootLatex}`;
  }

  if ((opensUp && operator === "<=") || (!opensUp && operator === ">=")) {
    return `${lowerRootLatex} \\leq ${variableSymbol} \\leq ${upperRootLatex}`;
  }

  if ((opensUp && operator === ">") || (!opensUp && operator === "<")) {
    return `${variableSymbol} < ${lowerRootLatex} \\;\\mathrm{or}\\; ${variableSymbol} > ${upperRootLatex}`;
  }

  return `${variableSymbol} \\leq ${lowerRootLatex} \\;\\mathrm{or}\\; ${variableSymbol} \\geq ${upperRootLatex}`;
};

const buildQuadraticInequalityResult = (expression, analysis) => {
  const {
    variableSymbol,
    operator,
    coefficients: { a, b, c }
  } = analysis;
  const standardForm = `${buildPolynomialLatex({ a, b, c }, variableSymbol)} ${toLatexInequalityOperator(operator)} 0`;
  const discriminant = b ** 2 - 4 * a * c;
  const normalizedDiscriminant = isApproximatelyZero(discriminant) ? 0 : discriminant;
  const deltaLatex = `\\Delta = ${normalizeNumberString(b)}^{2} - 4(${normalizeNumberString(a)})(${normalizeNumberString(c)}) = ${normalizeNumberString(normalizedDiscriminant)}`;
  const finalAnswer = buildQuadraticInequalityFinalAnswer({
    variableSymbol,
    operator,
    a,
    b,
    discriminant: normalizedDiscriminant
  });

  return {
    question_text: expression,
    expression,
    complexity: "complex",
    final_answer: finalAnswer,
    steps: [
      {
        step: 1,
        explanation: "រៀបចំអសមីការទៅទម្រង់ស្តង់ដារ។",
        formula: standardForm
      },
      {
        step: 2,
        explanation: "គណនាតម្លៃ discriminant ដើម្បីពិនិត្យចំនុចកាត់អ័ក្ស។",
        formula: deltaLatex
      },
      {
        step: 3,
        explanation: "កំណត់ចន្លោះដែលធ្វើឱ្យអសមីការពិត តាមសញ្ញារបស់ប៉ារ៉ាបូល។",
        formula: finalAnswer
      }
    ],
    token_saved_mode: true
  };
};

const buildLinearEquationResult = (expression, variableSymbol, coefficients) => {
  const variableCoefficient = coefficients.b;
  const constantTerm = coefficients.c;

  if (isApproximatelyZero(variableCoefficient)) {
    return null;
  }

  const solution = -constantTerm / variableCoefficient;
  const standardForm = `${buildPolynomialLatex(
    { b: variableCoefficient, c: constantTerm },
    variableSymbol
  )} = 0`;
  const isolatedLatex = `${variableSymbol} = ${toLatexNumber(solution)}`;

  return {
    question_text: expression,
    expression,
    complexity: "complex",
    final_answer: isolatedLatex,
    steps: [
      {
        step: 1,
        explanation: "រៀបចំសមីការទៅទម្រង់ស្តង់ដារ។",
        formula: standardForm
      },
      {
        step: 2,
        explanation: "ដោះស្រាយតម្លៃអថេរ។",
        formula: isolatedLatex
      }
    ],
    token_saved_mode: true
  };
};

const buildQuadraticEquationResult = (expression, variableSymbol, coefficients) => {
  const { a, b, c } = coefficients;
  const discriminant = b ** 2 - 4 * a * c;

  if (discriminant < -EPSILON) {
    return {
      question_text: expression,
      expression,
      complexity: "complex",
      final_answer: "\\text{No real solution}",
      steps: [
        {
          step: 1,
          explanation: "រៀបចំសមីការទៅទម្រង់ស្តង់ដារ។",
          formula: `${buildPolynomialLatex({ a, b, c }, variableSymbol)} = 0`
        },
        {
          step: 2,
          explanation: "គណនាតម្លៃ discriminant។",
          formula: `\\Delta = ${normalizeNumberString(b)}^{2} - 4(${normalizeNumberString(a)})(${normalizeNumberString(c)}) = ${normalizeNumberString(discriminant)}`
        },
        {
          step: 3,
          explanation: "ព្រោះ \\(\\Delta < 0\\) សមីការនេះមិនមានឫសពិតទេ។",
          formula: "\\text{No real solution}"
        }
      ],
      token_saved_mode: true
    };
  }

  const normalizedDiscriminant = isApproximatelyZero(discriminant) ? 0 : discriminant;
  const sqrtDiscriminant = Math.sqrt(Math.max(normalizedDiscriminant, 0));
  const standardForm = `${buildPolynomialLatex({ a, b, c }, variableSymbol)} = 0`;
  const deltaLatex = `\\Delta = ${normalizeNumberString(b)}^{2} - 4(${normalizeNumberString(a)})(${normalizeNumberString(c)}) = ${normalizeNumberString(normalizedDiscriminant)}`;

  if (isApproximatelyZero(normalizedDiscriminant)) {
    const root = -b / (2 * a);
    const rootLatex = `${variableSymbol} = ${toLatexNumber(root)}`;

    return {
      question_text: expression,
      expression,
      complexity: "complex",
      final_answer: rootLatex,
      steps: [
        {
          step: 1,
          explanation: "រៀបចំសមីការទៅទម្រង់ស្តង់ដារ។",
          formula: standardForm
        },
        {
          step: 2,
          explanation: "គណនាតម្លៃ discriminant។",
          formula: deltaLatex
        },
        {
          step: 3,
          explanation: "ព្រោះ \\(\\Delta = 0\\) សមីការមានឫសតែមួយ។",
          formula: rootLatex
        }
      ],
      token_saved_mode: true
    };
  }

  const rootOne = (-b + sqrtDiscriminant) / (2 * a);
  const rootTwo = (-b - sqrtDiscriminant) / (2 * a);

  let rootOneLatex = toLatexNumber(rootOne);
  let rootTwoLatex = toLatexNumber(rootTwo);

  if (!isPerfectSquareInteger(normalizedDiscriminant)) {
    const denominatorLatex = toLatexNumber(2 * a);
    const numeratorPrefix = isApproximatelyZero(-b) ? "" : `${toLatexNumber(-b, { preferFraction: false })}`;
    const sqrtLatex = `\\sqrt{${normalizeNumberString(normalizedDiscriminant)}}`;
    const positiveNumerator = numeratorPrefix ? `${numeratorPrefix} + ${sqrtLatex}` : sqrtLatex;
    const negativeNumerator = numeratorPrefix ? `${numeratorPrefix} - ${sqrtLatex}` : `-${sqrtLatex}`;

    rootOneLatex = `\\frac{${positiveNumerator}}{${denominatorLatex}}`;
    rootTwoLatex = `\\frac{${negativeNumerator}}{${denominatorLatex}}`;
  }

  const rootsLatex = `${variableSymbol}_{1} = ${rootOneLatex},\\quad ${variableSymbol}_{2} = ${rootTwoLatex}`;
  const finalAnswer = `${variableSymbol} = ${rootOneLatex}\\;\\text{or}\\;${rootTwoLatex}`;

  return {
    question_text: expression,
    expression,
    complexity: "complex",
    final_answer: finalAnswer,
    steps: [
      {
        step: 1,
        explanation: "រៀបចំសមីការទៅទម្រង់ស្តង់ដារ។",
        formula: standardForm
      },
      {
        step: 2,
        explanation: "គណនាតម្លៃ discriminant។",
        formula: deltaLatex
      },
      {
        step: 3,
        explanation: "ប្រើរូបមន្តសមីការការេដើម្បីរកឫសទាំងពីរ។",
        formula: rootsLatex
      }
    ],
    token_saved_mode: true
  };
};

const parseLabeledPoint3D = (expression, label) => {
  const pattern = new RegExp(
    `${label}\\s*\\(\\s*([+-]?\\d+(?:\\.\\d+)?)\\s*,\\s*([+-]?\\d+(?:\\.\\d+)?)\\s*,\\s*([+-]?\\d+(?:\\.\\d+)?)\\s*\\)`,
    "i"
  );
  const match = sanitizeField(expression)
    .replace(/[−–—]/g, "-")
    .match(pattern);

  if (!match) {
    return null;
  }

  return {
    label,
    x: Number(match[1]),
    y: Number(match[2]),
    z: Number(match[3])
  };
};

const crossProduct3D = (left, right) => ({
  x: left.y * right.z - left.z * right.y,
  y: left.z * right.x - left.x * right.z,
  z: left.x * right.y - left.y * right.x
});

const vectorBetween3DPoints = (from, to) => ({
  x: to.x - from.x,
  y: to.y - from.y,
  z: to.z - from.z
});

const gcdMultiple = (values = []) =>
  values.reduce((current, value) => gcd(current, value), 0);

const normalizePlaneCoefficients = ({ a, b, c, d }) => {
  const rounded = [a, b, c, d].map((value) => Math.round(value));
  const areIntegers = [a, b, c, d].every((value, index) => Math.abs(value - rounded[index]) <= EPSILON);

  if (!areIntegers) {
    return { a, b, c, d };
  }

  const divisor = Math.abs(gcdMultiple(rounded)) || 1;
  let normalized = {
    a: rounded[0] / divisor,
    b: rounded[1] / divisor,
    c: rounded[2] / divisor,
    d: rounded[3] / divisor
  };

  const firstNonZero = [normalized.a, normalized.b, normalized.c].find((value) => !isApproximatelyZero(value));

  if (firstNonZero && firstNonZero < 0) {
    normalized = {
      a: -normalized.a,
      b: -normalized.b,
      c: -normalized.c,
      d: -normalized.d
    };
  }

  return normalized;
};

const buildPlaneEquationLatex = ({ a, b, c, d }) => {
  const terms = [];

  [
    { coefficient: a, symbol: "x" },
    { coefficient: b, symbol: "y" },
    { coefficient: c, symbol: "z" }
  ].forEach(({ coefficient, symbol }) => {
    if (isApproximatelyZero(coefficient)) {
      return;
    }

    const absolute = Math.abs(coefficient);
    const sign = coefficient < 0 ? "-" : "+";
    const body = isApproximatelyZero(absolute - 1) ? symbol : `${toLatexNumber(absolute)}${symbol}`;

    terms.push({ sign, body });
  });

  if (!isApproximatelyZero(d)) {
    terms.push({
      sign: d < 0 ? "-" : "+",
      body: toLatexNumber(Math.abs(d))
    });
  }

  if (terms.length === 0) {
    return "0 = 0";
  }

  const leftSide = terms
    .map((term, index) => {
      if (index === 0) {
        return term.sign === "-" ? `-${term.body}` : term.body;
      }

      return `${term.sign === "-" ? "-" : "+"} ${term.body}`;
    })
    .join(" ");

  return `${leftSide} = 0`;
};

const trySolvePlaneThroughThreePoints = (expression) => {
  const normalizedExpression = sanitizeField(expression).replace(/[−–—]/g, "-");
  const points = ["A", "B", "C"].map((label) => parseLabeledPoint3D(normalizedExpression, label));

  if (points.some((point) => !point)) {
    return null;
  }

  const mentionsPlane =
    /\(P\)|plane|find the plane|equation of the plane/i.test(normalizedExpression)
    || /áž”áŸ’áž›áž„áŸ‹|ážŸáž˜áž¸áž€áž¶ážšáž”áŸ’áž›áž„áŸ‹/i.test(normalizedExpression);

  if (!mentionsPlane) {
    return null;
  }

  const [pointA, pointB, pointC] = points;
  const vectorAB = vectorBetween3DPoints(pointA, pointB);
  const vectorAC = vectorBetween3DPoints(pointA, pointC);
  const normalVector = crossProduct3D(vectorAB, vectorAC);

  if (
    isApproximatelyZero(normalVector.x)
    && isApproximatelyZero(normalVector.y)
    && isApproximatelyZero(normalVector.z)
  ) {
    return null;
  }

  const coefficients = normalizePlaneCoefficients({
    a: normalVector.x,
    b: normalVector.y,
    c: normalVector.z,
    d: -(normalVector.x * pointA.x + normalVector.y * pointA.y + normalVector.z * pointA.z)
  });
  const normalLatex = `\\vec{n} = (${toLatexNumber(coefficients.a)}, ${toLatexNumber(coefficients.b)}, ${toLatexNumber(coefficients.c)})`;
  const pointFormLatex = `${toLatexNumber(coefficients.a)}(x-${toLatexNumber(pointA.x)}) + ${toLatexNumber(coefficients.b)}(y-${toLatexNumber(pointA.y)}) + ${toLatexNumber(coefficients.c)}(z-${toLatexNumber(pointA.z)}) = 0`;
  const finalAnswer = buildPlaneEquationLatex(coefficients);

  return {
    question_text: expression,
    expression,
    complexity: "complex",
    final_answer: finalAnswer,
    steps: [
      {
        step: 1,
        explanation: "Build direction vectors from the three given points.",
        formula: `\\overrightarrow{AB} = (${toLatexNumber(vectorAB.x)}, ${toLatexNumber(vectorAB.y)}, ${toLatexNumber(vectorAB.z)}),\\quad \\overrightarrow{AC} = (${toLatexNumber(vectorAC.x)}, ${toLatexNumber(vectorAC.y)}, ${toLatexNumber(vectorAC.z)})`
      },
      {
        step: 2,
        explanation: "Take the cross product to get a normal vector of the plane.",
        formula: normalLatex
      },
      {
        step: 3,
        explanation: "Use point-normal form through point A, then simplify.",
        formula: `${pointFormLatex} \\Rightarrow ${finalAnswer}`
      }
    ],
    token_saved_mode: true
  };
};

const parsePlaneEquation = (expression) => {
  const normalizedExpression = sanitizeField(expression)
    .replace(/[−–—]/g, "-")
    .replace(/\s+/g, "");
  const planeMatch = normalizedExpression.match(/([+-]?\d*)x([+-]\d*)y([+-]\d*)z([+-]\d+)=0/i);

  if (!planeMatch) {
    return null;
  }

  const parseCoefficient = (value, { allowImplicitOne = false } = {}) => {
    if (value === "+" || value === "" || value === undefined) {
      return allowImplicitOne ? 1 : 0;
    }

    if (value === "-") {
      return allowImplicitOne ? -1 : 0;
    }

    return Number(value);
  };

  const a = parseCoefficient(planeMatch[1], { allowImplicitOne: true });
  const b = parseCoefficient(planeMatch[2], { allowImplicitOne: true });
  const c = parseCoefficient(planeMatch[3], { allowImplicitOne: true });
  const d = parseCoefficient(planeMatch[4]);

  if ([a, b, c, d].some((value) => !Number.isFinite(value))) {
    return null;
  }

  return { a, b, c, d };
};

const buildPlaneSubstitutionLatex = (plane, point) => {
  const wrapSigned = (value) => (value < 0 ? `(${toLatexNumber(value)})` : toLatexNumber(value));

  return `${toLatexNumber(plane.a)}\\cdot ${wrapSigned(point.x)} + ${toLatexNumber(plane.b)}\\cdot ${wrapSigned(point.y)} + ${toLatexNumber(plane.c)}\\cdot ${wrapSigned(point.z)} ${plane.d < 0 ? "-" : "+"} ${toLatexNumber(Math.abs(plane.d))}`;
};

const trySolvePointOnPlane = (expression) => {
  const normalizedExpression = sanitizeField(expression).replace(/[−–—]/g, "-");
  const pointM = parseLabeledPoint3D(normalizedExpression, "M");
  const plane = parsePlaneEquation(normalizedExpression);

  if (!pointM || !plane) {
    return null;
  }

  const mentionsPlaneCheck =
    /\(P\)|plane/i.test(normalizedExpression)
    || /áŸ‹áž”áŸ’áž›áž„áŸ‹|áŸ‹áž›áŸ†áž |áŸ‹ážŸá្ថិត/i.test(normalizedExpression);

  if (!mentionsPlaneCheck) {
    return null;
  }

  const substitutionValue =
    plane.a * pointM.x
    + plane.b * pointM.y
    + plane.c * pointM.z
    + plane.d;
  const normalizedValue = isApproximatelyZero(substitutionValue) ? 0 : substitutionValue;
  const finalAnswer = normalizedValue === 0
    ? "ដូចនេះ ចំណុច M ស្ថិតនៅលើប្លង់"
    : "ដូចនេះ ចំណុច M មិនស្ថិតនៅលើប្លង់ទេ";
  const planeLatex = buildPlaneEquationLatex(plane);
  const substitutionLatex = buildPlaneSubstitutionLatex(plane, pointM);
  const evaluationLatex = `${substitutionLatex} = ${toLatexNumber(normalizedValue)}`;

  return {
    question_text: expression,
    expression,
    complexity: "complex",
    final_answer: finalAnswer,
    steps: [
      {
        step: 1,
        explanation: "យកកូអរដោនេរបស់ចំណុច M ដាក់ទៅក្នុងសមីការប្លង់។",
        formula: `${planeLatex},\\quad M(${toLatexNumber(pointM.x)}, ${toLatexNumber(pointM.y)}, ${toLatexNumber(pointM.z)})`
      },
      {
        step: 2,
        explanation: "ជំនួសតម្លៃ x_0, y_0, z_0 ទៅក្នុង ax + by + cz + d។",
        formula: evaluationLatex
      },
      {
        step: 3,
        explanation: finalAnswer,
        formula: normalizedValue === 0 ? "0 = 0" : `${toLatexNumber(normalizedValue)} \\neq 0`
      }
    ],
    token_saved_mode: true
  };
};

const detectPromptType = (expression) => {
  if (
    /\\vec|AB|AC|BC|\(P\)|\(D\)|cross|dot|plane|vector|distance/i.test(expression)
    || /ប្លង់|វ៉ិចទ័រ|ចម្ងាយ|បន្ទាត់|សមីការប្លង់|ប្រព័ន្ធអក្ស|ចំណុច|ត្រង់/i.test(expression)
  ) {
    return "vector_geometry";
  }

  if (/[ក-៿]/u.test(expression) && /\d/.test(expression)) {
    return "word_problem";
  }

  if (/\\int|\\frac\{d\}\{d[x|y]\}|sin|cos|tan|log|ln/i.test(expression)) {
    return "calculus_or_function";
  }

  if (/[xy]/i.test(expression) && expression.includes("=")) {
    return "algebra";
  }

  if (/[xy]/i.test(expression)) {
    return "graphing_or_expression";
  }

  return "general_math";
};

const isGeometryProblem = (expression) => {
  const geometrySignals = [
    /\\vec/i,
    /AB|AC|BC|OA|OB|OC/,
    /\(P\)|\(D\)|\(O,\s*i,\s*j,\s*k\)/i,
    /cross|dot|plane|vector|distance/i,
    /ប្លង់|វ៉ិចទ័រ|ចម្ងាយ|បន្ទាត់|សមីការប្លង់|ប្រព័ន្ធអក្ស|ចំណុច|កូអរដោនេ|ប្រលេឡូក្រាម|កែង/i
  ];

  return geometrySignals.some((pattern) => pattern.test(expression));
};

class SolverService {
  constructor() {
    this.client = env.geminiApiKey ? new GoogleGenerativeAI(env.geminiApiKey) : null;
  }

  getModel() {
    if (!this.client) {
      throw new AppError("GEMINI_API_KEY is missing in the backend environment.", 500);
    }

    return this.client.getGenerativeModel({ model: GEMINI_MODEL });
  }

  async generateRawText(parts) {
    const model = this.getModel();
    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json"
      }
    });

    return result.response.text();
  }

  async generateJson(parts, fallbackQuestionText = "") {
    const rawText = await this.generateRawText(parts);

    try {
      return validateAndNormalizeResponse(extractJson(rawText), fallbackQuestionText);
    } catch (error) {
      if (error instanceof AppError && error.statusCode < 500) {
        throw error;
      }

      const repairedText = await this.generateRawText([
        { text: buildRepairPrompt(rawText, fallbackQuestionText) }
      ]);

      return validateAndNormalizeResponse(extractJson(repairedText), fallbackQuestionText);
    }
  }

  async extractQuestionTextFromImage(cleanedBase64, mimeType) {
    const rawText = await this.generateRawText([
      { text: buildImageExtractionPrompt() },
      {
        inlineData: {
          mimeType,
          data: cleanedBase64
        }
      }
    ]);

    return validateExtractedQuestionText(extractJson(rawText));
  }

  async findSolutionInLibrary(expression) {
    const normalizedExpression = normalizeExpressionForLibrary(expression);
    const searchExpression = buildLibrarySearchExpression(expression);
    const startedAt = Date.now();
    const getRemainingTime = () => Math.max(LIBRARY_QUERY_TIMEOUT_MS - (Date.now() - startedAt), 1);

    try {
      const exactMatch = await SolutionLibrary.findOne({ normalizedExpression })
        .maxTimeMS(getRemainingTime())
        .lean();

      if (exactMatch?.solution) {
        return buildLibraryResponse(exactMatch);
      }

      if (!searchExpression) {
        return null;
      }

      const tokenPattern = searchExpression
        .split(" ")
        .filter((token) => token.length >= 2)
        .slice(0, 6)
        .map((token) => escapeRegex(token))
        .join("|");

      if (!tokenPattern || getRemainingTime() <= 1) {
        return null;
      }

      const candidates = await SolutionLibrary.find({
        searchExpression: { $regex: tokenPattern, $options: "i" }
      })
        .sort({ updatedAt: -1 })
        .limit(8)
        .maxTimeMS(getRemainingTime())
        .lean();

      const bestMatch = candidates
        .map((candidate) => ({
          candidate,
          score: computeSimilarityScore(searchExpression, candidate.searchExpression || "")
        }))
        .filter(({ score }) => score >= 0.6)
        .sort((left, right) => right.score - left.score)[0];

      return bestMatch?.candidate?.solution ? buildLibraryResponse(bestMatch.candidate) : null;
    } catch (error) {
      if (error?.name === "MongooseError" || error?.name === "MongoServerError") {
        return null;
      }

      if (String(error?.message || "").toLowerCase().includes("maxtimems")) {
        return null;
      }

      return null;
    }
  }

  async saveSolutionToLibrary(expression, solution) {
    if (!expression || !solution) {
      return;
    }

    const normalizedExpression = normalizeExpressionForLibrary(expression);
    const searchExpression = buildLibrarySearchExpression(expression);

    if (!normalizedExpression || !searchExpression) {
      return;
    }

    try {
      await SolutionLibrary.findOneAndUpdate(
        { normalizedExpression },
        {
          $set: {
            originalExpression: expression,
            normalizedExpression,
            searchExpression,
            solution
          }
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true
        }
      );
    } catch {
      // Library persistence should never block the main solver flow.
    }
  }

  async solveLibraryBackedExpression(expression) {
    const normalizedExpression = normalizeExpressionInput(expression);
    const cachedSolution = await this.findSolutionInLibrary(normalizedExpression);

    if (cachedSolution) {
      return cachedSolution;
    }

    const freshSolution = await this.solveExpressionCore(normalizedExpression);
    await this.saveSolutionToLibrary(normalizedExpression, freshSolution);

    return freshSolution;
  }

  async solveExpressionCore(expression) {
    const normalizedExpression = normalizeExpressionInput(expression);

    if (isIdentityExpression(normalizedExpression)) {
      return {
        question_text: normalizedExpression,
        expression: normalizedExpression,
        complexity: "identity",
        final_answer: normalizedExpression,
        steps: [],
        token_saved_mode: true
      };
    }

    const systemResult = trySolveLinearSystem(normalizedExpression);

    if (systemResult) {
      return systemResult;
    }

    const derivativeResult = trySolveDerivative(normalizedExpression);

    if (derivativeResult) {
      return derivativeResult;
    }

    const integralResult = trySolveIntegral(normalizedExpression);

    if (integralResult) {
      return integralResult;
    }

    if (canEvaluateLocally(normalizedExpression)) {
      return buildArithmeticResult(normalizedExpression);
    }

    const linearInequalityAnalysis = analyzeLinearInequality(normalizedExpression);

    if (linearInequalityAnalysis) {
      return buildLinearInequalityResult(normalizedExpression, linearInequalityAnalysis);
    }

    const quadraticInequalityAnalysis = analyzeQuadraticInequality(normalizedExpression);

    if (quadraticInequalityAnalysis) {
      return buildQuadraticInequalityResult(normalizedExpression, quadraticInequalityAnalysis);
    }

    const polynomialAnalysis = analyzePolynomialEquation(normalizedExpression);

    if (polynomialAnalysis?.type === "linear_equation") {
      const result = buildLinearEquationResult(
        normalizedExpression,
        polynomialAnalysis.variableSymbol,
        polynomialAnalysis.coefficients
      );

      if (result) {
        return result;
      }
    }

    if (polynomialAnalysis?.type === "quadratic_equation") {
      const result = buildQuadraticEquationResult(
        normalizedExpression,
        polynomialAnalysis.variableSymbol,
        polynomialAnalysis.coefficients
      );

      if (result) {
        return result;
      }
    }

    const symbolicEquationResult = trySolveSymbolicEquation(normalizedExpression);

    if (symbolicEquationResult) {
      return symbolicEquationResult;
    }

    const symbolicExpressionResult = trySimplifySymbolicExpression(normalizedExpression);

    if (symbolicExpressionResult) {
      return symbolicExpressionResult;
    }

    const pointOnPlaneResult = trySolvePointOnPlane(normalizedExpression);

    if (pointOnPlaneResult) {
      return pointOnPlaneResult;
    }

    const planeThroughThreePointsResult = trySolvePlaneThroughThreePoints(normalizedExpression);

    if (planeThroughThreePointsResult) {
      return planeThroughThreePointsResult;
    }

    const unsupportedType = detectUnsupportedExpression(normalizedExpression);

    if (unsupportedType) {
      return buildUnsupportedResult(normalizedExpression, unsupportedType);
    }

    if (isGeometryProblem(normalizedExpression)) {
      return this.generateJson([{ text: buildGeometryPrompt(normalizedExpression) }], normalizedExpression);
    }

    return this.generateJson(
      [{ text: buildTextPrompt(normalizedExpression, detectPromptType(normalizedExpression)) }],
      normalizedExpression
    );
  }

  async solveExpression(expression) {
    return this.solveLibraryBackedExpression(expression);
  }

  async solveImageBase64(imageBase64, mimeType = "image/jpeg") {
    if (!imageBase64?.trim()) {
      throw new AppError("Image data is missing.", 400);
    }

    const cleanedBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "").trim();

    if (!cleanedBase64) {
      throw new AppError("Image data is missing.", 400);
    }

    if (!SUPPORTED_IMAGE_MIME_TYPES.has(mimeType)) {
      throw new AppError("Unsupported image format. Please use JPG, PNG, or WEBP.", 400);
    }

    if (!/^[A-Za-z0-9+/=\s]+$/.test(cleanedBase64)) {
      throw new AppError("Image data is not valid base64.", 400);
    }

    const questionText = await this.extractQuestionTextFromImage(cleanedBase64, mimeType);
    return this.solveLibraryBackedExpression(questionText);
  }
}

export const solverService = new SolverService();
