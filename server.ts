import dotenv from "dotenv";
dotenv.config();
import knex from "knex";

import { createRequestHandler } from "@remix-run/express";
import express from "express";
import { broadcastDevReady } from "@remix-run/node";
import * as build from "./build/index.js";
import { Tables } from "consts.js";

const targetDatabase = "poker";

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
  const hasUsersInRoomsTable = await db.schema.hasTable(Tables.USERS_IN_ROOMS);

  if (!hasUsersTable) {
    console.log("DOE SNOT HAVE USERS TABLE");
    try {
      await db.schema.createTable(Tables.USERS, function (table) {
        table.bigIncrements("id");
        table.text("name");
        table.text("custom_id").unique();
        table.timestamp("created_at").defaultTo(db.fn.now());
        table.timestamp("updated_at").defaultTo(db.fn.now());
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
        table.text("custom_id").unique();
        table.timestamp("created_at").defaultTo(db.fn.now());
        table.timestamp("updated_at").defaultTo(db.fn.now());
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

        table.timestamp("created_at").defaultTo(db.fn.now());
        table.timestamp("updated_at").defaultTo(db.fn.now());

        table.integer("user_id").unsigned();
        table.integer("room_id").unsigned();
        table.text("custom_id").unique();

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

    if (!hasUsersInRoomsTable) {
      try {
        await db.schema.createTable(Tables.USERS_IN_ROOMS, function (table) {
          table.increments("id").primary(); // Primary key for the pivot table
          table.integer("user_id").unsigned().notNullable();
          table.integer("room_id").unsigned().notNullable();
          table
            .foreign("user_id")
            .references(`${Tables.USERS}.id`)
            .onDelete("CASCADE");
          table
            .foreign("room_id")
            .references(`${Tables.ROOMS}.id`)
            .onDelete("CASCADE");
          table.timestamp("created_at").defaultTo(db.fn.now());
          table.unique(["user_id", "room_id"]); // Ensure the combination of user_id and room_id is unique
        });
        console.log("Users in rooms pivot table created");
      } catch (error) {
        console.error("Error creating users in rooms pivot table:", error);
      }
    }
  }

  console.log("App listening on http://localhost:3000");
});
