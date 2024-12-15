import { input, number, password, select } from "@inquirer/prompts";
import chalk from "chalk";
import knex from "knex";

export default async function getDbConfig() {
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

  const config = await (async () => {
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

  const db = knex(config);
  try {
    await db.raw("SELECT 1");
  } catch {
    console.error(
      chalk.red(
        `Unable to connect to database. Check your config and try again.`,
      ),
    );
    console.log(" ");
    return await getDbConfig();
  }

  return config;
}
