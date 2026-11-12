import fs from "node:fs/promises";

import { config } from "../src/config.js";

async function main() {
  const raw = await fs.readFile("tests/test_queries.json", "utf-8");
  const tests = JSON.parse(raw);

  let top1 = 0;
  let top3 = 0;

  for (const testCase of tests) {
    const response = await fetch(`http://localhost:${config.port}/api/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: testCase.query, limit: 3 })
    });

    const data = await response.json();

    if (!response.ok) {
      console.log("\nQuery:", testCase.query);
      console.log("Request failed:", data);
      continue;
    }

    const resultIds = data.results.map(item => item.device_id);
    const expected = testCase.expected_device_ids;
    const isTop1 = Boolean(resultIds[0] && expected.includes(resultIds[0]));
    const isTop3 = resultIds.some(id => expected.includes(id));

    if (isTop1) top1 += 1;
    if (isTop3) top3 += 1;

    console.log("\nQuery:", testCase.query);
    console.log("Expected:", expected.join(", "));
    console.log("Got:", resultIds.join(", "));
    console.log("Top1:", isTop1 ? "PASS" : "FAIL");
    console.log("Top3:", isTop3 ? "PASS" : "FAIL");
  }

  console.log("\nSummary");
  console.log(`Top1 accuracy: ${top1}/${tests.length}`);
  console.log(`Top3 accuracy: ${top3}/${tests.length}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
