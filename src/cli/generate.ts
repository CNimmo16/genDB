import { confirm, input, select } from "@inquirer/prompts";
import chalk from "chalk";
import { z } from "zod";
import actionWithLoading from "../util/actionWithLoading.js";
import { generateDataModel, Table } from "../service/generateDataModel.js";
import { generateData } from "../service/generateData.js";
import generateResponse from "../util/generateResponse.js";
import { applyToDb } from "../service/applyToDb.js";
import minimist from "minimist";
import { join } from "path";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from "fs";
import { help } from "./shared/help.js";
import getDbConfig from "./shared/getDbConfig.js";

const backupFolder = `${process.cwd()}/.generative-db`;
const modelBackupPrefix = "model-";

async function runCli(maybeInputs: {
  businessSummary?: string;
  companyName?: string;
}) {
  console.log(chalk.blue("Welcome to Generative DB!"));
  console.log("");

  const backup = await (async () => {
    if (!existsSync(backupFolder)) {
      return null;
    }
    const backups = readdirSync(backupFolder)
      .filter((f) => f.startsWith(modelBackupPrefix))
      .map((fileName: string) => {
        const datePortion = fileName.substring(
          modelBackupPrefix.length,
          modelBackupPrefix.length + 10,
        );
        const timePortion = fileName.split("_")[1].substring(0, 6);
        const timeFormatted =
          timePortion.substring(0, 2) +
          ":" +
          timePortion.substring(2, 4) +
          ":" +
          timePortion.substring(4, 6);
        return {
          contents: JSON.parse(
            readFileSync(`${backupFolder}/${fileName}`).toString(),
          ) as {
            companyName: string;
            businessSummary: string;
            tables: Table[];
          },
          date: new Date(`${datePortion} ${timeFormatted}`),
          path: `${backupFolder}/${fileName}`,
        };
      });
    backups.sort((a, b) => b.date.getTime() - a.date.getTime());

    if (backups.length === 0) {
      return null;
    }
    console.log(
      `Found ${chalk.cyan(backups.length)} data model backup${backups.length === 1 ? "" : "s"} available to generate data from.`,
    );
    const summariseBackup = (b: (typeof backups)[number]) =>
      `${b.date.toISOString().substring(0, 16).replace("T", " ")} - ${b.contents.companyName} (${b.contents.businessSummary.substring(0, 50)}...)`;
    if (backups.length === 1) {
      console.log(chalk.cyan(summariseBackup(backups[0])));
    }
    const wantsBackup = await confirm({
      message: `Would you like to continue from ${backups.length > 1 ? "a" : "the"} backup?`,
      default: false,
    });
    console.log(" ");
    if (!wantsBackup) {
      return null;
    }
    if (backups.length === 1) {
      return backups[0];
    }
    return select({
      message: "Which backup would you like to use?",
      choices: backups.map((b) => ({
        name: summariseBackup(b),
        value: b,
      })),
    });
  })();

  if (backup) {
    console.log(chalk.green(`Using selected backup.`));
  } else {
    console.log(chalk.green("Let's generate a database for your fake company"));
  }

  let businessSummary =
    backup?.contents.businessSummary ?? maybeInputs.businessSummary;

  if (!businessSummary) {
    businessSummary = await input({
      message:
        "Describe what your company does in a few sentences. Or leave blank and press enter to generate a random business.",
    });
  }

  let companyName = backup?.contents.companyName ?? maybeInputs.companyName;

  if (!companyName) {
    if (businessSummary) {
      const {
        response: { names: nameSuggestions },
      } = await actionWithLoading("Generating name suggestions", () =>
        generateResponse(
          [
            {
              role: "user",
              content: `Suggest 3 potential names for a startup company based on the following summary of its business: ${businessSummary}. Return only the names.`,
            },
          ],
          z.object({
            names: z.array(z.string()),
          }),
          "name",
        ),
      );

      companyName = await select({
        message: `What would you like to call your company?`,
        choices: [
          ...nameSuggestions.map((name) => ({
            name: `"${name}"`,
            value: name,
          })),
          {
            name: "I want a custom name",
            value: "other",
          },
        ],
        loop: false,
      });

      if (companyName === "other") {
        companyName = await input({
          message: "What would you like to call your company?",
        });
      }
    } else {
      const { response } = await actionWithLoading("Generating company", () =>
        generateResponse(
          [
            {
              role: "user",
              content: `Generate a business idea for a tech startup. Summarise the business business model in a few sentences. Also generate a suitable name for the company.`,
            },
          ],
          z.object({
            businessSummary: z.string(),
            companyName: z.string(),
          }),
          "summary_with_name",
        ),
      );
      businessSummary = response.businessSummary;
      companyName = response.companyName;

      console.log(chalk.green("We've generated a company for you!"));
      console.log("");
      console.log(`${chalk.blue(`Company Name: `)}${chalk.white(companyName)}`);
      console.log(
        `${chalk.blue(`Business Summary: `)}${chalk.white(businessSummary)}`,
      );
      console.log("");
    }
  }

  const tables = backup
    ? backup.contents.tables
    : await actionWithLoading("Generating data model", () =>
        generateDataModel({ businessSummary, companyName }),
      ).then((res) => res.tables);
  const modelGeneratedAt = new Date()
    .toISOString()
    .substring(0, 19)
    .replace("T", "_")
    .replaceAll(":", "");

  console.log(" ");
  if (!backup) {
    console.log(chalk.green("We've generated a data model for you!"));
  }
  console.log(" ");
  console.log(
    `${chalk.blue(`Tables with columns`)} (including ${chalk.green("primary keys")} and ${chalk.yellow("foreign keys")})`,
  );
  tables.forEach((table) => {
    console.log(
      `- ${chalk.white(table.name)}:  ${table.columns
        .map((col) => {
          if (col.foreignKey) {
            return chalk.yellow(col.name);
          }
          if (col.isPrimaryKey) {
            return chalk.green(col.name);
          }
          return chalk.gray(col.name);
        })
        .join("  ")}`,
    );
  });
  console.log(" ");

  const proceed = await confirm({
    message:
      "Would you like to continue? We will now generate some data for your database.",
  });

  if (!proceed) {
    // TODO: add table editor via prompts (select from list of table names to edit or add new one, then select from list of column names to edit or add new one)

    console.log(chalk.green("Goodbye!"));
    process.exit(0);
  }

  // TODO: proper typing
  let rowsByTableToSave: any;
  try {
    const rowsByTable = await actionWithLoading("Generating data...", () =>
      generateData(businessSummary, tables, console.log),
    );
    rowsByTableToSave = rowsByTable;

    console.log(chalk.green(`Data generated successfully!`));
    console.log(" ");

    const applyChanges = await select({
      message: "Would you like to apply this data to a database now?",
      choices: [
        {
          name: "Yes, apply changes now to a database of my choosing",
          value: true,
        },
        {
          name: "No, I'd like to get a JSON file of the generated data with the option to apply it to a database later",
          value: false,
        },
      ],
    });

    if (applyChanges) {
      const dbConfig = await getDbConfig();

      await applyToDb(dbConfig, tables, rowsByTable, console.log);

      console.log(chalk.green("Data inserted successfully!"));
    }
  } catch (err) {
    console.error(err);
    if (!backup) {
      if (!existsSync(backupFolder)) {
        mkdirSync(backupFolder, { recursive: true });
      }
      const backupLoc = `${backupFolder}/${modelBackupPrefix}${modelGeneratedAt}.json`;
      writeFileSync(
        backupLoc,
        JSON.stringify({
          businessSummary,
          companyName,
          tables,
        }),
        {},
      );
    }
    console.log(" ");
    console.log(
      chalk.red(
        `Something went wrong while generating the data (see error above).`,
      ),
    );
    console.log(" ");
    if (backup) {
      console.log(
        `We have left the existing backup of your data model at ${chalk.yellow(backup.path)}.`,
      );
    } else {
      console.log(
        `We have saved a backup of your data model at ${chalk.yellow(`${process.cwd()}/.generative-db/cache/model-${modelGeneratedAt}.json`)}.`,
      );
    }
    console.log(" ");
    console.log(
      `You can continue with this model by re-running the generate command now.`,
    );
    process.exit(0);
  }

  if (backup) {
    rmSync(backup.path);
    const backups = readdirSync(backupFolder);
    if (backups.length === 0) {
      rmdirSync(backupFolder);
    }
  }

  const save = await select({
    message:
      "Would you like to save your company name, business summary and data model as JSON to a file?",
    choices: [
      {
        name: "Yes",
        value: true,
      },
      {
        name: "No",
        value: false,
      },
    ],
  });

  if (save) {
    const fileName = await input({
      message: "Where would you like to save the file?",
      default: "./generated-db.json",
    });
    const filePath = join(process.cwd(), fileName);
    writeFileSync(
      filePath,
      JSON.stringify({
        businessSummary,
        companyName,
        tables,
        rowsByTable: rowsByTableToSave,
      }),
    );
    console.log(
      chalk.green(
        `Data saved successfully to ${chalk.yellow(filePath)}. Run the apply command to apply the data to your database.`,
      ),
    );
  }

  console.log(chalk.green("Goodbye!"));

  process.exit(0);
}

const args = minimist(process.argv.slice(2));

if (args.help) {
  help();
}

const { success, data: parsedArgs } = z
  .object({
    businessSummary: z.string().optional(),
    companyName: z.string().optional(),
  })
  .safeParse(args);
if (!success) {
  console.error(
    "generate called with invalid arguments. Run with --help for help.",
  );
  process.exit(0);
}

runCli(parsedArgs).catch((err) => {
  if (err instanceof Error && err.name === "ExitPromptError") {
    console.log(chalk.green("Oh, leaving so soon? Ok bye!"));
    console.log(" ");
    process.exit(0);
  } else {
    throw err;
  }
});