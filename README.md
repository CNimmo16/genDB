# GenDB

The quickest and easiest way to generate a database, optionally with sample data, based off a short description of a company.

## Usage

Simply run `npx gendb generate` and follow the wizard.

### Applying saved changes

At the end of the `generate` wizard you will be asked whether you'd like to save the schema and data to a JSON file. If you choose to do so, you may then run `npx gendb apply <file-path>` at a later date to apply these changes to the database.
