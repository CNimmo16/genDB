import chalk from "chalk";

export function help() {
  console.log(chalk.green("Welcome to Generative DB!"));
  console.log(" ");
  console.log(chalk.blue("Usage:"));
  console.log(
    `- generate [--businessSummary <string>] [--companyName <string>] [--help]`,
  );
  console.log(`- apply <filePath> [--help]`);
  console.log(" ");
  process.exit(0);
}
