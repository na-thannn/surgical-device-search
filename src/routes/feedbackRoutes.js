import express from "express";

import { saveFeedback as defaultSaveFeedback } from "../services/feedbackService.js";

export function createFeedbackRouter(dependencies = {}) {
  const saveFeedback = dependencies.saveFeedback || defaultSaveFeedback;
  const router = express.Router();

  router.post("/feedback", async (req, res, next) => {
    try {
      const query = String(req.body?.query || "").trim();
      const selectedDeviceId = String(req.body?.selected_device_id || "").trim();

      if (!query || !selectedDeviceId) {
        return res.status(400).json({
          error: "query and selected_device_id are required"
        });
      }

      const saved = await saveFeedback({
        query,
        selected_device_id: selectedDeviceId,
        results_snapshot:
          req.body?.results_snapshot && typeof req.body.results_snapshot === "object"
            ? req.body.results_snapshot
            : []
      });

      return res.json({ ok: true, feedback: saved });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
