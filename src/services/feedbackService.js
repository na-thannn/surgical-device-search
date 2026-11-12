import fs from "node:fs/promises";
import path from "node:path";

import { config } from "../config.js";

export async function saveFeedback(feedback) {
  const feedbackPath = path.resolve(config.feedbackLogPath);
  await fs.mkdir(path.dirname(feedbackPath), { recursive: true });

  const record = {
    ...feedback,
    created_at: new Date().toISOString()
  };

  await fs.appendFile(feedbackPath, `${JSON.stringify(record)}\n`, "utf-8");
  return record;
}
