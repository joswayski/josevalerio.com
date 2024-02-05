import knex from "knex";

const db = knex({
  client: "pg",
  connection: {
    host: process.env.NODE_ENV === "development" ? "localhost" : "postgres",
    port: 5432,
    // eslint-disable-next-line no-undef
    user: process.env.POSTGRES_USER,
    // eslint-disable-next-line no-undef
    password: process.env.POSTGRES_PASSWORD,
    database: "poker",
  },
});

export { db };
