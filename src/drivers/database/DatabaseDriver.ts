import { input, number, password, select } from "@inquirer/prompts";
import chalk from "chalk";
import pg from "pg";
import { type ClientConfig } from "pg";

export enum GenericDataType {
  UUID = "uuid",
  Text = "text",
  Integer = "integer",
  Float = "float",
  Date = "datetime",
  Boolean = "boolean",
}

interface ColumnDef {
  name: string;
  isPrimaryKey: boolean;
  type: GenericDataType;
  foreignKey?: {
    referencedTable: string;
    referencedColumn: string;
  };
}

interface DatabaseDriver {
  connect(): Promise<this>;

  disconnect(): Promise<void>;

  createTable(tableName: string, columns: ColumnDef[]): Promise<void>;

  insertRows(tableName: string, rows: string[][]): Promise<void>;

  getAllRows(tableName: string): Promise<
    {
      [column: string]: string;
    }[]
  >;
}

class PostgresDriver implements DatabaseDriver {
  client: pg.Client;

  constructor(clientConfig: ClientConfig) {
    this.client = new pg.Client(clientConfig);
  }

  async connect() {
    await this.client.connect();
    return this;
  }

  async disconnect() {
    await this.client.end();
  }

  async createTable(tableName: string, columns: ColumnDef[]) {
    const postgresTypeLookup = {
      [GenericDataType.Text]: "text",
      [GenericDataType.UUID]: "uuid",
      [GenericDataType.Integer]: "integer",
      [GenericDataType.Float]: "double precision",
      [GenericDataType.Date]: "timestamp",
      [GenericDataType.Boolean]: "boolean",
    };
    await this.client.query(`
    CREATE TABLE ${tableName} (
      ${columns.map((column) => {
        return `${column.name} ${postgresTypeLookup[column.type]} ${column.isPrimaryKey ? "PRIMARY KEY" : ""} ${column.foreignKey ? "REFERENCES " + column.foreignKey.referencedTable + " (" + column.foreignKey.referencedColumn + ")" : ""}`;
      })}
    )`);
  }

  async getAllRows(tableName: string): Promise<
    {
      [column: string]: string;
    }[]
  > {
    const res = await this.client.query({
      text: `SELECT * FROM ${tableName}`,
    });
    return res.rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([k, v]) => [k, (v as any).toString()]),
      ),
    );
  }

  async insertRows(tableName: string, rows: string[][]) {
    const text = `INSERT INTO ${tableName} VALUES ${rows
      .map(
        (row) => `(${row.map((v) => `'${v.replace(/'/g, `''`)}'`).join(",")})`,
      )
      .join(",")}`;
    try {
      await this.client.query({
        text,
      });
    } catch (e) {
      console.error(`Error while executing sql: ${text}`);
      throw e;
    }
  }
}

export default async function getDatabaseDriver() {
  // TODO: more DBs (move to knex?)
  const dbType = await select({
    message: "What database would you like to use?",
    choices: [
      {
        name: "Postgres",
        value: "postgres",
      },
    ],
  });

  console.log(chalk.green("Enter your database details"));

  switch (dbType) {
    case "postgres":
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
      return new PostgresDriver({
        host,
        port,
        user,
        password: pass,
        database,
      }).connect();
    default:
      throw new Error("Unknown database type");
  }
}
