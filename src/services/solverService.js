import { GoogleGenerativeAI } from "@google/generative-ai";

import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

const GEMINI_MODEL = "gemini-2.5-flash";

const INVALID_EQUATION_MESSAGE =
  "សមីការមិនត្រឹមត្រូវ សូមពិនិត្យឡើងវិញ";

const buildTextPrompt = (expression) => `
You are the Intelligent Math Engine for Math Vision, developed by Hong Sovannarith.
Your goal is to solve math problems with maximum efficiency.
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

const isIdentityExpression = (expression) =>
  /^\s*(?:\d+(?:\.\d+)?|[a-zA-Z])\s*$/.test(expression);

const isBasicExpression = (expression) =>
  /^\s*[\d+\-*/().\s]+\s*$/.test(expression) && /[+\-*/]/.test(expression);

const evaluateBasicExpression = (expression) => {
  const normalized = expression.replace(/\s+/g, "");

  if (!/^[\d+\-*/().]+$/.test(normalized)) {
    throw new AppError(INVALID_EQUATION_MESSAGE, 400);
  }

  const value = Function(`"use strict"; return (${normalized});`)();

  if (!Number.isFinite(value)) {
    throw new AppError(INVALID_EQUATION_MESSAGE, 400);
  }

  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
};

const mapGeminiResponse = (parsed, fallbackQuestionText = "") => ({
  question_text: parsed.question_text || fallbackQuestionText,
  expression: parsed.question_text || fallbackQuestionText,
  complexity: parsed.complexity || "complex",
  final_answer: parsed.final_answer || "",
  steps: Array.isArray(parsed.steps)
    ? parsed.steps.map((step, index) => ({
        step: step.step || index + 1,
        explanation: step.explanation || "",
        formula: step.formula || ""
      }))
    : [],
  token_saved_mode: parsed.token_saved_mode !== false
});

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

  async generateJson(parts) {
    const model = this.getModel();
    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json"
      }
    });

    const text = result.response.text();
    return extractJson(text);
  }

  async solveExpression(expression) {
    if (!expression || !expression.trim()) {
      throw new AppError(INVALID_EQUATION_MESSAGE, 400);
    }

    const normalizedExpression = expression.trim();

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

    if (isBasicExpression(normalizedExpression)) {
      const finalAnswer = evaluateBasicExpression(normalizedExpression);

      return {
        question_text: normalizedExpression,
        expression: normalizedExpression,
        complexity: "basic",
        final_answer: finalAnswer,
        steps: [
          {
            step: 1,
            explanation: `ការគណនាគ្រឹះ៖ ${finalAnswer}`,
            formula: finalAnswer
          }
        ],
        token_saved_mode: true
      };
    }

    const parsed = await this.generateJson([{ text: buildTextPrompt(normalizedExpression) }]);
    return mapGeminiResponse(parsed, normalizedExpression);
  }

  async solveImageBase64(imageBase64, mimeType = "image/jpeg") {
    if (!imageBase64?.trim()) {
      throw new AppError("Image data is missing.", 400);
    }

    const cleanedBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "").trim();

    if (!cleanedBase64) {
      throw new AppError("Image data is missing.", 400);
    }

    const parsed = await this.generateJson([
      { text: buildImagePrompt() },
      {
        inlineData: {
          mimeType,
          data: cleanedBase64
        }
      }
    ]);

    const questionText = (parsed.question_text || "").trim();

    if (!questionText) {
      throw new AppError("Unable to extract a math problem from the image.", 422);
    }

    return mapGeminiResponse(parsed, questionText);
  }
}

export const solverService = new SolverService();
