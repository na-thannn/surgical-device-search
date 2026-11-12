import express from "express";

import { loadDataset } from "../services/datasetService.js";

export function createDeviceRouter(dependencies = {}) {
  const datasetProvider = dependencies.datasetProvider || loadDataset;
  const router = express.Router();

  router.get("/devices/:deviceId", async (req, res, next) => {
    try {
      const dataset = await datasetProvider();
      const device = dataset.find(item => item.device_id === req.params.deviceId);

      if (!device) {
        return res.status(404).json({ error: "Device not found" });
      }

      return res.json(device);
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
