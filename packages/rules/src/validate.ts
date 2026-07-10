import { validateBundledRules } from "./index.js";

const errors = validateBundledRules();

if (errors.length > 0) {
  console.error("NativeGuard rule validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("NativeGuard rule validation passed.");
