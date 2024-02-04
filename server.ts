import dotenv from "dotenv";
dotenv.config();
import knex from "knex";

import { createRequestHandler } from "@remix-run/express";
import express from "express";
import { broadcastDevReady } from "@remix-run/node";
import * as build from "./build/index.js";

const targetDatabase = "poker";

enum Tables {
  USERS = "users",
  ROOMS = "rooms",
  VOTES = "votes",
}

async function addTimestampsToTable(tableName: string, db: knex.Knex) {
  const hasCreatedAt = await db.schema.hasColumn(tableName, "created_at");
  const hasUpdatedAt = await db.schema.hasColumn(tableName, "updated_at");

  if (!hasCreatedAt || !hasUpdatedAt) {
    console.log(`Adding timestamp columns to ${tableName}...`);
    await db.schema.alterTable(tableName, (table) => {
      if (!hasCreatedAt) {
        table.timestamp("created_at").defaultTo(db.fn.now());
      }
      if (!hasUpdatedAt) {
        table.timestamp("updated_at").defaultTo(db.fn.now());
      }
    });
  }
}

async function addTimestampsToTables(db: knex.Knex) {
  [Tables.USERS, Tables.ROOMS, Tables.VOTES].map(
    async (table) => await addTimestampsToTable(table, db)
  );

  console.log("Timestamp columns added to tables.");
}

const app = express();
app.use(express.static("public"));

// @ts-expect-error dont wanna deal with this right now
app.all("*", createRequestHandler({ build }));

app.listen(3000, async () => {
  // eslint-disable-next-line no-undef
  if (process.env.NODE_ENV === "development") {
    // @ts-expect-error dont wanna deal with this right now
    broadcastDevReady(build);
  }

  console.log({
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
  });
  const db = knex({
    client: "pg",
    connection: {
      host: "localhost",
      port: 5432,
      // eslint-disable-next-line no-undef
      user: process.env.POSTGRES_USER,
      // eslint-disable-next-line no-undef
      password: process.env.POSTGRES_PASSWORD,
      database: targetDatabase,
    },
  });

  const hasUsersTable = await db.schema.hasTable(Tables.USERS);
  const hasRoomsTable = await db.schema.hasTable(Tables.ROOMS);
  const hasVotesTable = await db.schema.hasTable(Tables.VOTES);

  if (!hasUsersTable) {
    console.log("DOE SNOT HAVE USERS TABLE");
    try {
      await db.schema.createTable(Tables.USERS, function (table) {
        table.bigIncrements("id");
        table.text("name");
      });
    } catch (error) {
      console.error("Error creating users table:", error);
    }
  }

  if (!hasRoomsTable) {
    try {
      await db.schema.createTable(Tables.ROOMS, function (table) {
        table.bigIncrements("id");
        table.text("name");
      });
    } catch (error) {
      console.error("Error creating rooms table:", error);
    }
  }

  if (!hasVotesTable) {
    try {
      await db.schema.createTable(Tables.VOTES, function (table) {
        table.bigIncrements("id");
        table.integer("amount");

        table.integer("user_id").unsigned();
        table.integer("room_id").unsigned();

        // Define foreign key for user_id
        table
          .foreign("user_id")
          .references(`${Tables.USERS}.id`)
          .onDelete("CASCADE");
        // Define foreign key for room_id
        table
          .foreign("room_id")
          .references(`${Tables.ROOMS}.id`)
          .onDelete("CASCADE");
      });
    } catch (error) {
      console.error("Error creating rooms table:", error);
    }
  }

  await addTimestampsToTables(db);

  console.log("App listening on http://localhost:3000");
});
