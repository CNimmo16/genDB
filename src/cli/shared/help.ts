import chalk from "chalk";

export function help() {
  console.log(chalk.green("Welcome to Generative DB!"));
  console.log(" ");
  console.log(chalk.blue("Usage:"));
  console.log(
    `- gendb generate [--businessSummary <string>] [--companyName <string>] [--help]`,
  );
  console.log(`- gendb apply <filePath> [--help]`);
  console.log(" ");
  console.log(
    chalk.yellow(
      `Please note: you should set the OPENAI_API_KEY environment variable before running the generate command eg. ${chalk.bgGray.white("OPENAI_API_KEY=mykey npx gendb generate")}`,
    ),
  );
  console.log(" ");
  process.exit(0);
}
