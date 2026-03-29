import { adminService } from "../services/adminService.js";

export const adminController = {
  async getQcmSettings(request, response, next) {
    try {
      const data = await adminService.getQcmSettings();
      response.status(200).json(data);
    } catch (error) {
      next(error);
    }
  },

  async updateQcmSettings(request, response, next) {
    try {
      const data = await adminService.updateQcmSettings(request.body);
      response.status(200).json(data);
    } catch (error) {
      next(error);
    }
  },

  async renameQcmCategory(request, response, next) {
    try {
      const data = await adminService.renameQcmCategory(request.body);
      response.status(200).json(data);
    } catch (error) {
      next(error);
    }
  },

  async getQuestions(request, response, next) {
    try {
      const data = await adminService.getQuestions();
      response.status(200).json(data);
    } catch (error) {
      next(error);
    }
  },

  async createQuestion(request, response, next) {
    try {
      const data = await adminService.createQuestion(request.body);
      response.status(201).json(data);
    } catch (error) {
      next(error);
    }
  },

  async updateQuestion(request, response, next) {
    try {
      const data = await adminService.updateQuestion(request.params.questionId, request.body);
      response.status(200).json(data);
    } catch (error) {
      next(error);
    }
  },

  async deleteQuestion(request, response, next) {
    try {
      await adminService.deleteQuestion(request.params.questionId);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  },

  async getDocuments(request, response, next) {
    try {
      const data = await adminService.getDocuments();
      response.status(200).json(data);
    } catch (error) {
      next(error);
    }
  },

  async uploadDocument(request, response, next) {
    try {
      const data = await adminService.uploadDocument(request.body, request.files);
      response.status(201).json(data);
    } catch (error) {
      next(error);
    }
  },

  async updateDocument(request, response, next) {
    try {
      const data = await adminService.updateDocument(request.params.documentId, request.body, request.files);
      response.status(200).json(data);
    } catch (error) {
      next(error);
    }
  },

  async deleteDocument(request, response, next) {
    try {
      await adminService.deleteDocument(request.params.documentId);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  },

  async getSolutionLibraryEntries(request, response, next) {
    try {
      const data = await adminService.getSolutionLibraryEntries();
      response.status(200).json(data);
    } catch (error) {
      next(error);
    }
  },

  async deleteSolutionLibraryEntry(request, response, next) {
    try {
      await adminService.deleteSolutionLibraryEntry(request.params.entryId);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  }
};
