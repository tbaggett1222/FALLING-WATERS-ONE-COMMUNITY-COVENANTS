const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to start the PostgreSQL API server.");
}

const requireSsl = String(process.env.PGSSLMODE || "").toLowerCase() === "require";

const pool = new Pool({
  connectionString,
  ssl: requireSsl ? { rejectUnauthorized: false } : undefined,
});

const query = (text, params = []) => pool.query(text, params);

const withClient = async (fn) => {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
};

module.exports = {
  pool,
  query,
  withClient,
};
