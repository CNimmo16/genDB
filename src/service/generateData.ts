import { z } from "zod";
import generateResponse from "../util/generateResponse.js";
import shuffleArray from "../util/shuffleArray.js";
import transposeArray from "../util/transposeArray.js";
import { Table } from "./generateDataModel.js";

export type RowsByTable = {
  [tableName: string]: {
    [columnName: string]: string;
  }[];
};

export async function generateData(
  businessSummary: string,
  tables: Table[],
  log: (message: string) => void,
): Promise<RowsByTable> {
  const sourceTables = tables.filter((table) =>
    table.columns.every((col) => !col.foreignKey),
  );

  const rowsByTable = await generateDataForTable(
    businessSummary,
    tables,
    sourceTables[0],
    {},
    log,
  );

  return rowsByTable;
}

async function generateDataForTable(
  businessSummary: string,
  tables: Table[],
  table: Table,
  _rowsByTable: {
    [tableName: string]: {
      [columnName: string]: string;
    }[];
  },
  log: (message: string) => void = () => {},
) {
  const ROW_COUNT_PER_REFERENCED_VALUE = 2;

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
          const allRowsFromReferencedTable = _rowsByTable[referencedTable.name];
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
      foreignKeyColumnValuesMappingEntries.map(([key, values]) => [key, []]),
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
    const ROW_COUNT_FOR_NON_REFERENCING_TABLE = 5;
    rowsWithForeignKeyColumnData = [
      ...new Array(ROW_COUNT_FOR_NON_REFERENCING_TABLE),
    ].map(() => {
      const rowEntries = table.columns.map((column) => [column.name, null]);
      return Object.fromEntries(rowEntries);
    });
  }

  const rowCount = rowsWithForeignKeyColumnData.length;

  const nonForeignKeyColumnValues: (string | null)[][] = await Promise.all(
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

  const rowsWithNonForeignKeyData = transposeArray(nonForeignKeyColumnValues);

  _rowsByTable[table.name] = rowsWithForeignKeyColumnData.map(
    (rowWithForeignKeyData, i) => {
      return Object.fromEntries(
        Object.entries(rowWithForeignKeyData).map(([columnName, value], j) => {
          const ret = value ?? rowsWithNonForeignKeyData[i][j];
          if (!ret) {
            throw new Error(`Missing value for row ${i}, column ${j}`);
          }
          return [columnName, ret];
        }),
      );
    },
  );
  log(
    `Generated ${_rowsByTable[table.name].length} rows for table ${table.name}`,
  );

  const visitedTables = Object.keys(_rowsByTable).length;
  if (visitedTables === tables.length) {
    // once all tables visited return from recursive loop
    return _rowsByTable;
  }

  // otherwise find the next table which can be safely created
  const firstTableWithAllReferencedTablesPopulated = tables.find((table) => {
    return (
      !_rowsByTable[table.name] &&
      table.columns.every((col) => {
        return (
          !col.foreignKey ||
          Boolean(_rowsByTable[col.foreignKey!.referencedTable])
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
    businessSummary,
    tables,
    firstTableWithAllReferencedTablesPopulated,
    _rowsByTable,
  );
}
