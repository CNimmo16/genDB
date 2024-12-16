import generateResponse from "../util/generateResponse.js";
import { z } from "zod";

export enum DataType {
  UUID = "uuid",
  Text = "text",
  Integer = "integer",
  Float = "float",
  Date = "datetime",
  Boolean = "boolean",
}

type GenerateDataModelInputs = {
  businessSummary: string;
  tableCount: number;
  tokenLimit: number;
};

export function estimateRequiredTokensForDataModel({
  businessSummary,
  tableCount,
}: Omit<GenerateDataModelInputs, "tokenLimit">) {
  const prompt = `imagine a data model for a company with the following business model:\n${businessSummary}\nReturn a list of tables and columns for the company's database, including foreign keys. Generate a maximum of ${tableCount} tables. Do not generate foreign keys pointing to columns that do not exist.`;

  const ESTIMATED_TOKENS_PER_TABLE = 400;

  return {
    prompt,
    estimatedTokens: ESTIMATED_TOKENS_PER_TABLE * tableCount + prompt.length,
  };
}

export async function generateDataModel({
  businessSummary,
  tableCount,
  tokenLimit,
}: GenerateDataModelInputs) {
  const { prompt } = estimateRequiredTokensForDataModel({
    businessSummary,
    tableCount,
  });
  const maxCompletionTokens = tokenLimit - prompt.length;
  const { response: dataModel, tokensUsed } = await generateResponse(
    [
      {
        role: "user",
        content: prompt,
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
              type: z.nativeEnum(DataType),
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
      max_completion_tokens: maxCompletionTokens,
    },
  );

  const tables = dataModel.tables.map((table) => ({
    ...table,
    columns: table.columns.map((col) => ({
      ...col,
      foreignKey: col.foreignKey.referencedColumn ? col.foreignKey : undefined,
    })),
  }));

  return {
    tables,
    tokensUsed,
  };
}

export type Table = Awaited<
  ReturnType<typeof generateDataModel>
>["tables"][number];
