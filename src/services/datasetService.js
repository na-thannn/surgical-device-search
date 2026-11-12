import fs from "node:fs/promises";
import path from "node:path";

import { config } from "../config.js";

let datasetCache;

export async function loadDataset() {
  if (!datasetCache) {
    const raw = await fs.readFile(path.resolve(config.datasetPath), "utf-8");
    datasetCache = JSON.parse(raw);
  }

  return datasetCache;
}
