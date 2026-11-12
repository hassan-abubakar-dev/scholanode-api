import migrator from "./migrate.js";
import { dbConnection } from "../config/db.js";

try {
  await dbConnection.authenticate();

  console.log("Database connection established.");

  const executed = await migrator.executed();

  if (executed.length === 0) {
    console.log("No migrations available to roll back.");
  } else {
    console.log("Rolling back:", executed.at(-1).name);

    await migrator.down();

    console.log("Rollback completed successfully.");
  }
} catch (error) {
  console.error("Rollback failed:", error);
  process.exitCode = 1;
} finally {
  await dbConnection.close();
}