import { quizService } from "../services/quizService.js";

export const quizController = {
  async getSubjects(request, response, next) {
    try {
      const data = await quizService.getSubjects(request.user._id);
      response.status(200).json(data);
    } catch (error) {
      next(error);
    }
  },

  async getSubjectLevels(request, response, next) {
    try {
      const data = await quizService.getSubjectLevels(request.user._id, request.params.id);
      response.status(200).json(data);
    } catch (error) {
      next(error);
    }
  },

  async getQuestions(request, response, next) {
    try {
      const data = await quizService.getQuestions(
        request.user._id,
        request.params.subjectId,
        request.params.levelId
      );
      response.status(200).json(data);
    } catch (error) {
      next(error);
    }
  },

  async completeLevel(request, response, next) {
    try {
      const data = await quizService.completeLevel(
        request.user._id,
        request.params.subjectId,
        request.params.levelId,
        request.body.scorePercent
      );
      response.status(200).json(data);
    } catch (error) {
      next(error);
    }
  }
};
