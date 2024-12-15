import chalk from "chalk";

export function help() {
  console.log(chalk.green("Welcome to Generative DB!"));
  console.log(" ");
  console.log(chalk.blue("Usage:"));
  console.log(
    `- gendb generate [--key <string>] [--businessSummary <string>] [--companyName <string>] [--help]`,
  );
  console.log(
    chalk.yellow(
      `Please note: the --key argument should be set to your OpenAI api key. If you do not supply the --key argument you must have the OPENAI_API_KEY environment variable set before running the generate command.`,
    ),
  );
  console.log(`- gendb apply <filePath> [--help]`);
  console.log(" ");
  process.exit(0);
}
