import { confirm, input, number, password, select } from "@inquirer/prompts";
import chalk from "chalk";
import { z } from "zod";
import actionWithLoading from "../util/actionWithLoading.js";
import { generateDataModel } from "../service/generateDataModel.js";
import { generateData } from "../service/generateData.js";
import generateResponse from "../util/generateResponse.js";
import { applyToDb } from "../service/applyToDb.js";
import minimist from "minimist";

async function runCli(maybeInputs: {
  businessSummary?: string;
  companyName?: string;
}) {
  console.log(chalk.blue("Welcome to Generative DB!"));
  console.log("");

  console.log(chalk.green("Let's generate a database for your fake company"));

  let businessSummary = maybeInputs.businessSummary;

  if (!businessSummary) {
    businessSummary = await input({
      message:
        "Describe what your company does in a few sentences. Or leave blank and press enter to generate a random business.",
    });
  }

  let companyName = maybeInputs.companyName;

  if (businessSummary) {
    const {
      response: { names: nameSuggestions },
    } = await generateResponse(
      "Generating name suggestions",
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
    const { response } = await generateResponse(
      "Generating company",
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

  const { tables } = await generateDataModel({ businessSummary, companyName });

  console.log(" ");
  console.log(chalk.green("We've generated a data model for you!"));
  console.log(`(Tokens used: ${JSON.stringify(tables).length})`);
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

  const rowsByTable = await actionWithLoading("Generating data...", () =>
    generateData(businessSummary, tables, console.log),
  );

  console.log(chalk.green(`Data generated successfully! Inserting data...`));

  const dbType = await select({
    message: "What database would you like to use?",
    choices: [
      {
        name: "Postgres",
        value: "postgres",
      },
      {
        name: "MySQL",
        value: "mysql",
      },
    ],
  });

  console.log(chalk.green("Enter your database details"));

  const dbConfig = await (async () => {
    switch (dbType) {
      case "postgres": {
        const host = await input({
          message: "Host:",
          default: "localhost",
        });
        const port = await number({
          message: "Port:",
          default: 5432,
        });
        const user = await input({
          message: "User:",
          default: "postgres",
        });
        const pass = await password({
          message: "Password:",
        });
        const database = await input({
          message: "Database:",
          default: "postgres",
        });
        return {
          client: "pg",
          connection: {
            host,
            port,
            user,
            password: pass,
            database,
          },
        };
      }
      case "mysql": {
        const host = await input({
          message: "Host:",
          default: "localhost",
        });
        const port = await number({
          message: "Port:",
          default: 3306,
        });
        const user = await input({
          message: "User:",
          default: "root",
        });
        const pass = await password({
          message: "Password:",
        });
        const database = await input({
          message: "Database:",
          default: "postgres",
        });
        return {
          client: "mysql",
          connection: {
            host,
            port,
            user,
            password: pass,
            database,
          },
        };
      }
      default:
        throw new Error("Unknown database type");
    }
  })();

  await applyToDb(dbConfig, tables, rowsByTable, console.log);

  console.log(chalk.green("Data inserted successfully!"));

  console.log(chalk.green("Goodbye!"));

  process.exit(0);
}

const args = minimist(process.argv.slice(2));

if (args.help) {
  console.log(chalk.green("Welcome to Generative DB!"));
  console.log(" ");
  console.log(chalk.blue("Usage:"));
  console.log(
    `generate [--businessSummary <string>] [--companyName <string>] [--help]`,
  );
  console.log(" ");
  process.exit(0);
}

try {
  const parsedArgs = z
    .object({
      businessSummary: z.string().optional(),
      companyName: z.string().optional(),
    })
    .parse(args);

  runCli(parsedArgs).catch((err) => {
    if (err instanceof Error && err.name === "ExitPromptError") {
      console.log(chalk.green("Oh, leaving so soon? Ok bye!"));
      console.log(" ");
      process.exit(0);
    }
  });
} catch (err) {
  console.error(
    "generate called with invalid arguments. Run with --help for help.",
  );
  process.exit(0);
}
