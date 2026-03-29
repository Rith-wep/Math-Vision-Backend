import { Router } from "express";

import { adminController } from "../controllers/adminController.js";
import { requireAdmin } from "../middleware/adminAuthMiddleware.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { imageUpload } from "../middleware/uploadMiddleware.js";

export const adminRoutes = Router();

adminRoutes.use(requireAuth, requireAdmin);

adminRoutes.get("/qcm/settings", adminController.getQcmSettings);
adminRoutes.put("/qcm/settings", adminController.updateQcmSettings);
adminRoutes.put("/qcm/settings/rename-category", adminController.renameQcmCategory);
adminRoutes.get("/qcm", adminController.getQuestions);
adminRoutes.post("/qcm", adminController.createQuestion);
adminRoutes.put("/qcm/:questionId", adminController.updateQuestion);
adminRoutes.delete("/qcm/:questionId", adminController.deleteQuestion);

adminRoutes.get("/documents", adminController.getDocuments);
adminRoutes.post(
  "/documents",
  imageUpload.fields([
    { name: "file", maxCount: 1 },
    { name: "thumbnail_file", maxCount: 1 }
  ]),
  adminController.uploadDocument
);
adminRoutes.put(
  "/documents/:documentId",
  imageUpload.fields([
    { name: "file", maxCount: 1 },
    { name: "thumbnail_file", maxCount: 1 }
  ]),
  adminController.updateDocument
);
adminRoutes.delete("/documents/:documentId", adminController.deleteDocument);
adminRoutes.get("/solution-library", adminController.getSolutionLibraryEntries);
adminRoutes.delete("/solution-library/:entryId", adminController.deleteSolutionLibraryEntry);
