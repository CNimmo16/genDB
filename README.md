# GenDB

The quickest and easiest way to generate a database, optionally with sample data, based off a short description of a company.

## CLI usage

To get started run `npx gendb generate --key=<your-openai-api-key>` and follow the wizard.

You can alternatively set the OPENAI_API_KEY environment variable and run generate without the --key argument.

### Applying saved changes

At the end of the `generate` wizard you will be asked whether you'd like to save the schema and data to a JSON file. If you choose to do so, you may then run `npx gendb apply <file-path>` at a later date to apply these changes to the database.

## Programmatic usage

The library exposes the following functions which you can consume from your own code:

- `generateDataModel`
- `generateData`
- `applyToDb`

Simply add `import { functionName } from 'gendb'` to your code.

## Roadmap

- Add ability to edit the tables and columns of the generated data model via CLI prompts.
- Add support for more common databases.
- Add tests for `./service` functions

## Contributing

Open a PR!
