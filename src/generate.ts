import { confirm, input, select } from "@inquirer/prompts";
import chalk from "chalk";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod.mjs";
import { ChatCompletionMessageParam } from "openai/resources/index.mjs";
import yoctoSpinner from "yocto-spinner";
import { z, ZodType } from "zod";
import samplemodel from "./samplemodel.js";
import getDatabaseDriver, {
  GenericDataType,
} from "./drivers/database/DatabaseDriver.js";
import { topologicalSort } from "graph-data-structure";
import makeGraphForDatabase from "./util/makeGraphForDatabase.js";
import actionWithLoading from "./util/actionWithLoading.js";
import shuffleArray from "./util/shuffleArray.js";
import transposeArray from "./util/transposeArray.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateResponse<T extends ZodType>(
  loadingText: string | null,
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
  const cb = async () => {
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

    return parsed;
  };
  const parsed = loadingText
    ? await actionWithLoading(loadingText, cb)
    : await cb();

  if (!parsed) {
    throw new Error("Failed to generate response");
  }

  return { response: parsed };
}

async function generateDb() {
  // TODO: separate prompts from API layer - support non-cli use
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

  const { response: dataModel } = await generateResponse(
    "Generating data model",
    [
      {
        role: "user",
        content: `imagine a data model for a company called ${companyName} with the following business model:\n${businessSummary}\nReturn a list of tables and columns for the company's database, including foreign keys. Aim for around 10 tables.`,
      },
    ],
    z.object({
      tables: z.array(
        z.object({
          name: z.string(),
          columns: z.array(
            z.object({
              name: z.string(),
              isPrimaryKey: z.boolean(),
              type: z.nativeEnum(GenericDataType),
              foreignKey: z.object({
                referencedTable: z.string(),
                referencedColumn: z.string(),
              }),
            }),
          ),
        }),
      ),
    }),
    "data_model",
    {
      model: "gpt-4o",
      max_completion_tokens: 6000,
    },
  );
  // const dataModel = samplemodel;

  const tables = dataModel.tables.map((table) => ({
    ...table,
    columns: table.columns.map((col) => ({
      ...col,
      foreignKey: col.foreignKey.referencedColumn ? col.foreignKey : undefined,
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

  // TODO: add table editor prompts (select from list of table names to edit or add new one, then select from list of column names to edit or add new one)

  const proceed = await confirm({
    message:
      "Would you like to continue? We will now generate some data for your database.",
  });

  if (!proceed) {
    console.log(chalk.green("Goodbye!"));
    process.exit(0);
  }

  const graph = makeGraphForDatabase(
    tables.map((table) => ({
      name: table.name,
      foreignKeysPointTo: table.columns.flatMap((col) =>
        col.foreignKey ? [col.foreignKey.referencedTable] : [],
      ),
    })),
  );
  const topologicalOrder = topologicalSort(graph);

  const createOrder = topologicalOrder.reverse();

  const db = await getDatabaseDriver();

  try {
    for (const tableName of createOrder) {
      const table = tables.find((t) => t.name === tableName);
      if (!table) {
        throw new Error(`Could not find table ${tableName}`);
      }
      await db.createTable(tableName, table.columns);
    }

    console.log(chalk.green("Database tables created!"));

    await actionWithLoading("Generating data...", async () => {
      const sourceTables = tables.filter((table) =>
        table.columns.every((col) => !col.foreignKey),
      );

      const visitedTables: string[] = [];
      async function generateDataForTable(table: (typeof tables)[number]) {
        visitedTables.push(table.name);
        const ROW_COUNT_PER_REFERENCED_VALUE = 2;

        let rowsWithForeignKeyColumnData: (string | null)[][] = [];
        if (table.columns.some((col) => col.foreignKey)) {
          const foreignKeyColumnValuesMappingEntries = await Promise.all(
            table.columns
              .filter((col) => col.foreignKey)
              .map(async (foreignKeyColumn) => {
                const referencedTable = tables.find(
                  (t) =>
                    t.name === foreignKeyColumn.foreignKey!.referencedTable,
                )!;
                const allRowsFromReferencedTable = await db.getAllRows(
                  referencedTable.name,
                );
                const actualColumnName = Object.keys(
                  allRowsFromReferencedTable[0],
                ).find(
                  (key) =>
                    key.toLowerCase() ===
                    foreignKeyColumn.foreignKey!.referencedColumn.toLowerCase(),
                );
                if (!actualColumnName) {
                  throw new Error(
                    `Could not find column ${foreignKeyColumn.foreignKey!.referencedColumn} in table ${referencedTable.name}`,
                  );
                }
                const rowCountPerReference = foreignKeyColumn.isPrimaryKey
                  ? 1
                  : ROW_COUNT_PER_REFERENCED_VALUE;
                const allValuesFromReferencedTable =
                  allRowsFromReferencedTable.flatMap((row) => {
                    const value = row[actualColumnName];
                    return [...new Array(rowCountPerReference)].map(
                      () => value,
                    );
                  });
                return [
                  foreignKeyColumn.name,
                  shuffleArray(allValuesFromReferencedTable),
                ];
              }),
          );
          const foreignKeyColumnValuesMapping = Object.fromEntries(
            foreignKeyColumnValuesMappingEntries,
          );
          const usedForeignKeyColumnValuesMapping = Object.fromEntries(
            foreignKeyColumnValuesMappingEntries.map(([key, values]) => [
              key,
              [],
            ]),
          );

          while (
            Object.values(foreignKeyColumnValuesMapping).flat().length > 0
          ) {
            // while there are still values in the mapping
            const row = table.columns.map((column) => {
              if (foreignKeyColumnValuesMapping[column.name]) {
                if (foreignKeyColumnValuesMapping[column.name].length === 0) {
                  if (column.isPrimaryKey) {
                    throw new Error(
                      `Need more foreign key values than available for column ${column.name} in table ${table.name} but it is a primary key so cannot insert duplicates`,
                    );
                  }
                  // if no more values for this column just take a random already used value
                  const usedVals =
                    usedForeignKeyColumnValuesMapping[column.name];
                  return usedVals[Math.floor(Math.random() * usedVals.length)];
                }
                const value = foreignKeyColumnValuesMapping[column.name].pop();
                usedForeignKeyColumnValuesMapping[column.name].push(value);
                return value;
              } else {
                return null;
              }
            });
            rowsWithForeignKeyColumnData.push(row);
          }
        } else {
          const ROW_COUNT_FOR_NON_REFERENCING_TABLE = 5;
          rowsWithForeignKeyColumnData = [
            ...new Array(ROW_COUNT_FOR_NON_REFERENCING_TABLE),
          ].map(() => table.columns.map(() => null));
        }

        const rowCount = rowsWithForeignKeyColumnData.length;

        const nonForeignKeyColumnValues: (string | null)[][] =
          await Promise.all(
            table.columns.map(async (column) => {
              if (column.foreignKey) {
                return [...new Array(rowCount)].map(() => null);
              } else {
                const {
                  response: { values },
                } = await generateResponse(
                  null,
                  [
                    {
                      role: "system",
                      content: `You are an assistant to generate column values for a database. You work for a company described as: ${businessSummary}`,
                    },
                    {
                      role: "user",
                      content: `Generate ${rowCount} values for column "${column.name}" with type ${column.type} in table "${table.name}".`,
                    },
                  ],
                  z.object({
                    values: z.array(z.string()),
                  }),
                  "row_data",
                );
                return values;
              }
            }),
          );

        const rowsWithNonForeignKeyData = transposeArray(
          nonForeignKeyColumnValues,
        );

        const rows = rowsWithForeignKeyColumnData.map(
          (rowWithForeignKeyData, i) => {
            return rowWithForeignKeyData.map((value, j) => {
              const ret = value ?? rowsWithNonForeignKeyData[i][j];
              if (!ret) {
                throw new Error(`Missing value for row ${i}, column ${j}`);
              }
              return ret;
            });
          },
        );

        await db.insertRows(table.name, rows);
        console.log(
          chalk.green(`Inserted ${rows.length} rows into ${table.name} table`),
        );

        if (visitedTables.length < tables.length) {
          const firstTableWithAllReferencedTablesPopulated = tables.find(
            (table) => {
              return (
                !visitedTables.includes(table.name) &&
                table.columns.every((col) => {
                  return (
                    !col.foreignKey ||
                    visitedTables.includes(col.foreignKey!.referencedTable)
                  );
                })
              );
            },
          );
          if (!firstTableWithAllReferencedTablesPopulated) {
            throw new Error(
              "Could not find a table with all referenced tables populated",
            );
          }
          await generateDataForTable(
            firstTableWithAllReferencedTablesPopulated,
          );
        }
      }
      await generateDataForTable(sourceTables[0]);
    });

    await db.disconnect();
  } catch (e) {
    // TODO: drop already created tables if crashes halfway through (transaction?)
    // TODO: Save data model to a temporary file if crashes, add check for temporary file and option to restore when starting cli
    console.log(
      chalk.red(`Error creating database tables. Rejecting with error.`),
    );
    console.error(e);
    process.exit(1);
  }
}

generateDb();
