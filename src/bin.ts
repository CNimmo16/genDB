#!/usr/bin/env node

import minimist from "minimist";
import { help } from "./cli/shared/help.js";
import generate from "./cli/generate.js";
import apply from "./cli/apply.js";

const args = minimist(process.argv.slice(2));

if (args.help) {
  help();
}

const [command] = args._;

if (!command) {
  console.error("gendb called without a script. Run with --help for help.");
  process.exit(0);
}

switch (command) {
  case "generate":
    generate(args);
    break;
  case "apply":
    apply(args);
    break;
  default:
    console.error(`Unknown command ${command}. Run with --help for help.`);
    process.exit(0);
}
