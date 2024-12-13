import { confirm, input, select } from "@inquirer/prompts";
import chalk from "chalk";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod.mjs";
import { ChatCompletionMessageParam } from "openai/resources/index.mjs";
import yoctoSpinner from "yocto-spinner";
import { z, ZodType } from "zod";
import samplemodel from "./samplemodel.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateResponse<T extends ZodType>(
  loadingText: string,
  messages: ChatCompletionMessageParam[],
  validator: T,
  dataDesc: string,
  options: Omit<
    Parameters<typeof openai.beta.chat.completions.parse>[0],
    "messages"
  > = {
    model: "gpt-4o-mini",
  },
): Promise<{
  response: z.infer<T>;
}> {
  const spinner = yoctoSpinner({ text: loadingText }).start();

  const {
    choices: [
      {
        message: { parsed },
      },
    ],
  } = await openai.beta.chat.completions.parse({
    messages,
    response_format: zodResponseFormat(
      validator,
      `${dataDesc}_response_format`,
    ),
    ...options,
  });

  spinner.stop();

  if (!parsed) {
    throw new Error("Failed to generate response");
  }

  return { response: parsed };
}

async function generateDb() {
  console.log(chalk.blue("Welcome to Generative DB!"));
  console.log("");

  console.log(chalk.green("Let's generate a database for your fake company"));

  let businessSummary = await input({
    message:
      "Describe what your company does in a few sentences. Or leave blank and press enter to generate a random business.",
  });

  console.log(" ");

  let companyName: string;
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

  // const { response: dataModel } = await generateResponse(
  //   "Generating data model",
  //   [
  //     {
  //       role: "user",
  //       content: `imagine a data model for a company called ${companyName} with the following business model:\n${businessSummary}\nReturn a list of tables and columns for the company's database, including foreign keys. Aim for around 10 tables.`,
  //     },
  //   ],
  //   z.object({
  //     tables: z.array(
  //       z.object({
  //         name: z.string(),
  //         columns: z.array(
  //           z.object({
  //             name: z.string(),
  //             isPrimaryKey: z.boolean(),
  //             type: z.enum(["string", "number", "boolean", "datetime"]),
  //             foreignKey: z.object({
  //               referencedTable: z.string(),
  //               referencedColumn: z.string(),
  //             }),
  //           }),
  //         ),
  //       }),
  //     ),
  //   }),
  //   "data_model",
  //   {
  //     model: "gpt-4o",
  //     max_completion_tokens: 6000,
  //   },
  // );
  const dataModel = samplemodel;

  const tables = dataModel.tables.map((table) => ({
    ...table,
    columns: table.columns.map((col) => ({
      ...col,
      foreignKey: col.foreignKey.referencedColumn ? col.foreignKey : null,
    })),
  }));

  console.log(" ");
  console.log(chalk.green("We've generated a data model for you!"));
  console.log(`(Tokens used: ${JSON.stringify(dataModel).length})`);
  console.log(" ");
  console.log(
    `${chalk.blue(`Tables with columns`)} (including ${chalk.green("primary keys")} and ${chalk.yellow("foreign keys")})`,
  );
  tables.forEach((table) => {
    console.log(
      `- ${chalk.white(table.name)}:  ${table.columns
        .map((col) => {
          if (col.isPrimaryKey) {
            return chalk.green(col.name);
          }
          if (col.foreignKey) {
            return chalk.yellow(col.name);
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
    console.log(chalk.green("Goodbye!"));
    process.exit(0);
  }

  console.dir(dataModel.tables, { depth: null });
}

generateDb();
