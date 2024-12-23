import { z } from "zod";
import generateResponse from "../util/generateResponse.js";
import shuffleArray from "../util/shuffleArray.js";
import transposeArray from "../util/transposeArray.js";
import { DataType, Table } from "./generateDataModel.js";
import chalk from "chalk";
import { v4 } from "uuid";

export type RowsByTable = {
  [tableName: string]: {
    [columnName: string]: string;
  }[];
};

export async function generateData(
  businessSummary: string,
  tables: Table[],
  log: (message: string) => void = () => {},
  rowCountPerBaseTable = 5,
  rowCountPerReferencedValue = 2,
): Promise<{
  rowsByTable: RowsByTable;
  tokensUsed: number;
}> {
  const sourceTables = tables.filter((table) =>
    table.columns.every((col) => !col.foreignKey),
  );

  const { rowsByTable, totalTokensUsed } = await generateDataForTable(
    rowCountPerBaseTable,
    rowCountPerReferencedValue,
    businessSummary,
    tables,
    sourceTables[0],
    {},
    log,
    0,
  );

  return {
    rowsByTable,
    tokensUsed: totalTokensUsed,
  };
}

async function generateDataForTable(
  rowCountPerBaseTable: number,
  rowCountPerReferencedValue: number,
  businessSummary: string,
  tables: Table[],
  table: Table,
  rowsByTable: {
    [tableName: string]: {
      [columnName: string]: string;
    }[];
  },
  log: (message: string) => void,
  totalTokensUsed: number,
) {
  let rowsWithForeignKeyColumnData: { [columnName: string]: string | null }[] =
    [];
  if (table.columns.some((col) => col.foreignKey)) {
    const foreignKeyColumnValuesMappingEntries = await Promise.all(
      table.columns
        .filter((col) => col.foreignKey)
        .map(async (foreignKeyColumn) => {
          const referencedTable = tables.find(
            (t) => t.name === foreignKeyColumn.foreignKey!.referencedTable,
          )!;
          const allRowsFromReferencedTable = rowsByTable[referencedTable.name];
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
            : rowCountPerReferencedValue;
          const allValuesFromReferencedTable =
            allRowsFromReferencedTable.flatMap((row) => {
              const value = row[actualColumnName];
              return [...new Array(rowCountPerReference)].map(() => value);
            });
          return [
            foreignKeyColumn.name,
            shuffleArray(allValuesFromReferencedTable),
          ] as const;
        }),
    );
    const foreignKeyColumnValuesMapping = Object.fromEntries(
      foreignKeyColumnValuesMappingEntries,
    );
    const usedForeignKeyColumnValuesMapping: {
      [columnName: string]: string[];
    } = Object.fromEntries(
      foreignKeyColumnValuesMappingEntries.map(([key]) => [key, []]),
    );

    while (Object.values(foreignKeyColumnValuesMapping).flat().length > 0) {
      // while there are still values in the mapping
      const rowEntries = table.columns.map((column) => {
        if (foreignKeyColumnValuesMapping[column.name]) {
          const value = foreignKeyColumnValuesMapping[column.name].pop();
          if (!value) {
            // pop() returns undefined when no values left
            if (column.isPrimaryKey) {
              throw new Error(
                `Need more foreign key values than available for column ${column.name} in table ${table.name} but it is a primary key so cannot insert duplicates`,
              );
            }
            // if no more values for this column just take a random already used value
            const usedVals = usedForeignKeyColumnValuesMapping[column.name];
            return [
              column.name,
              usedVals[Math.floor(Math.random() * usedVals.length)],
            ] as const;
          }
          usedForeignKeyColumnValuesMapping[column.name].push(value);
          return [column.name, value] as const;
        } else {
          return [column.name, null] as const;
        }
      });
      const row = Object.fromEntries(rowEntries);
      rowsWithForeignKeyColumnData.push(row);
    }
  } else {
    rowsWithForeignKeyColumnData = [...new Array(rowCountPerBaseTable)].map(
      () => {
        const rowEntries = table.columns.map((column) => [column.name, null]);
        return Object.fromEntries(rowEntries);
      },
    );
  }

  const rowCount = rowsWithForeignKeyColumnData.length;

  const nonForeignKeyColumnValues: (string | null)[][] = await Promise.all(
    table.columns.map(async (column) => {
      if (column.foreignKey) {
        return [...new Array(rowCount)].map(() => null);
      } else if (column.isAutoIncrementing) {
        return [...new Array(rowCount)].map((_, i) => (i + 1).toString());
      } else if (column.type === DataType.Boolean) {
        return [...new Array(rowCount)].map(() =>
          Math.random() < 0.5 ? "true" : "false",
        );
      } else if (column.type === DataType.Date) {
        return [...new Array(rowCount)].map(() => {
          const isRecent = Math.random() < 0.5;
          const msInADay = 24 * 60 * 60 * 1000;
          if (isRecent) {
            const daysAgo = Math.floor(Math.random() * 14);
            return new Date(Date.now() - daysAgo * msInADay).toISOString();
          } else {
            const daysAgo = Math.floor(Math.random() * 365);
            return new Date(Date.now() - daysAgo * msInADay).toISOString();
          }
        });
      } else if (column.type === DataType.Float) {
        return [...new Array(rowCount)].map(() =>
          (Math.random() * 100).toFixed(2),
        );
      } else if (column.type === DataType.UUID) {
        return [...new Array(rowCount)].map(() => v4());
      } else {
        const values: string[] = [];
        while (values.length < rowCount) {
          const { response, tokensUsed } = await generateResponse(
            [
              {
                role: "system",
                content: `You are an assistant to generate column values for a database. You work for a company described as: ${businessSummary}`,
              },
              {
                role: "user",
                content: `Generate ${Math.min(rowCount - values.length, 30)} values for column "${column.name}" with type ${column.type} in table "${table.name}".`,
              },
            ],
            z.object({
              values: z.array(z.string()),
            }),
            "row_data",
          );
          totalTokensUsed += tokensUsed;
          values.push(...response.values);
        }
        return values.slice(0, rowCount);
      }
    }),
  );

  const rowsWithNonForeignKeyData = transposeArray(nonForeignKeyColumnValues);

  rowsByTable[table.name] = rowsWithForeignKeyColumnData.map(
    (rowWithForeignKeyData, i) => {
      return Object.fromEntries(
        Object.entries(rowWithForeignKeyData).map(([columnName, value]) => {
          const columnIndex = table.columns.findIndex(
            (c) => c.name === columnName,
          );
          const ret = value ?? rowsWithNonForeignKeyData[i][columnIndex];
          if (!ret) {
            throw new Error(
              `Missing value for row ${i}, column ${table.name}.${columnName}. This should never happen. rowsWithNonForeignKeyData:\n ${JSON.stringify(rowsWithNonForeignKeyData)}`,
            );
          }
          return [columnName, ret];
        }),
      );
    },
  );
  log(
    chalk.blue(
      `Generated ${rowsByTable[table.name].length} rows for table ${table.name}`,
    ),
  );

  const visitedTables = Object.keys(rowsByTable).length;
  if (visitedTables === tables.length) {
    // once all tables visited return from recursive loop
    return {
      rowsByTable,
      totalTokensUsed,
    };
  }

  // otherwise find the next table which can be safely created
  const firstTableWithAllReferencedTablesPopulated = tables.find((_table) => {
    return (
      !rowsByTable[_table.name] &&
      _table.columns.every((col) => {
        return (
          !col.foreignKey ||
          Boolean(rowsByTable[col.foreignKey!.referencedTable])
        );
      })
    );
  });
  if (!firstTableWithAllReferencedTablesPopulated) {
    throw new Error(
      "Could not find a table with all referenced tables populated",
    );
  }
  return generateDataForTable(
    rowCountPerBaseTable,
    rowCountPerReferencedValue,
    businessSummary,
    tables,
    firstTableWithAllReferencedTablesPopulated,
    rowsByTable,
    log,
    totalTokensUsed,
  );
}
