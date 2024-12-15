import minimist from "minimist";
import { readFileSync } from "fs";
import chalk from "chalk";
import { confirm } from "@inquirer/prompts";
import getDbConfig from "./shared/getDbConfig.js";
import { applyToDb } from "../service/applyToDb.js";

export default async function apply(args: minimist.ParsedArgs) {
  const filePath = args._[1];

  if (!filePath) {
    console.error(
      "apply called without a file path. Run with --help for help.",
    );
    process.exit(0);
  }

  const data = JSON.parse(readFileSync(filePath, "utf-8"));

  try {
    const proceed = await confirm({
      message: "Are you sure you want to apply this data?",
    });

    if (!proceed) {
      console.log(chalk.green("Ok, bye!"));
      process.exit(0);
    }

    const dbConfig = await getDbConfig();

    await applyToDb(dbConfig, data.tables, data.rowsByTable, console.log);

    console.log(chalk.green("Done!"));

    process.exit(0);
  } catch (err) {
    if (err instanceof Error && err.name === "ExitPromptError") {
      console.log(chalk.green("Oh, leaving so soon? Ok bye!"));
      console.log(" ");
      process.exit(0);
    } else {
      throw err;
    }
  }
}
