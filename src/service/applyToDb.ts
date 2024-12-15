import { topologicalSort } from "graph-data-structure";
import makeGraphForDatabase from "../util/makeGraphForDatabase.js";
import { RowsByTable } from "./generateData.js";
import { Table } from "./generateDataModel.js";
import chalk from "chalk";
import knex, { type Knex } from "knex";

export async function applyToDb(
  dbConfig: Knex.Config,
  tables: Table[],
  rowsByTable: RowsByTable,
  log: (message: string) => void,
) {
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

  const db = knex(dbConfig);

  await db.transaction(async (trx) => {
    for (const tableName of createOrder) {
      const table = tables.find((t) => t.name === tableName);
      if (!table) {
        throw new Error(`Could not find table ${tableName}`);
      }
      await trx.schema.createTable(tableName, (t) => {
        for (const column of table.columns) {
          const c = t[column.type](column.name);
          if (column.isPrimaryKey) {
            c.primary();
          }
          if (column.foreignKey) {
            c.references(column.foreignKey.referencedColumn).inTable(
              column.foreignKey.referencedTable,
            );
          }
        }
      });

      await trx(tableName).insert(rowsByTable[tableName]);

      log(`- Created table and inserted rows for ${chalk.green(tableName)}`);
    }
  });
}
