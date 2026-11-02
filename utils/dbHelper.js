import { Op } from "sequelize";
import { dbConnection } from "../config/db.js";

/**
 * Return Sequelize's case-insensitive LIKE operator for the active dialect.
 * PostgreSQL supports ILIKE directly; MySQL and compatible collations use LIKE.
 */
export const getLikeOperator = () =>
  dbConnection.getDialect() === "postgres" ? Op.iLike : Op.like;

export const likeCondition = (value) => ({
  [getLikeOperator()]: value,
});

export default getLikeOperator;
