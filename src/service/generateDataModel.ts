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
  companyName: string;
  tableCount: number;
};

export async function generateDataModel({
  businessSummary,
  companyName,
  tableCount,
}: GenerateDataModelInputs) {
  const { response: dataModel } = await generateResponse(
    [
      {
        role: "user",
        content: `imagine a data model for a company called ${companyName} with the following business model:\n${businessSummary}\nReturn a list of tables and columns for the company's database, including foreign keys. Aim for around ${tableCount} tables.`,
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
      max_completion_tokens: 6000,
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
  };
}

export type Table = Awaited<
  ReturnType<typeof generateDataModel>
>["tables"][number];
