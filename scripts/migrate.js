import { Umzug, SequelizeStorage } from "umzug";
import { dbConnection } from "../config/db.js";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrator = new Umzug({
migrations: {
  glob: [
    "migrations/*.js",
    {
      cwd: path.resolve(__dirname, ".."),
    },
  ],
},

  context: dbConnection.getQueryInterface(),

  storage: new SequelizeStorage({
    sequelize: dbConnection,
  }),

  logger: console,
});

export default migrator;

// Execute migrations when this file is run directly.
const isDirectExecution =
  process.argv[1] &&
  path.resolve(process.argv[1]) === __filename;

if (isDirectExecution) {
  try {
    await dbConnection.authenticate();
    console.log("Database connection established.");

    const pending = await migrator.pending();

console.log(
  "Pending migrations:",
  pending.map((migration) => migration.name)
);

    await migrator.up();

    console.log("Migrations completed successfully.");
  } catch (error) {
    console.error("Migration execution failed:", error);
    process.exitCode = 1;
  } finally {
    await dbConnection.close();
  }
}