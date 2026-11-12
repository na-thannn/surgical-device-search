import { config } from "../src/config.js";

async function main() {
  const response = await fetch(config.qdrantUrl);
  const text = await response.text();

  console.log(`Status: ${response.status}`);
  console.log(text);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
