import dotenv from "dotenv";
dotenv.config();

import { createRequestHandler } from "@remix-run/express";
import express from "express";
import { broadcastDevReady } from "@remix-run/node";
import * as build from "./build/index.js";

const app = express();
app.use(express.static("public"));

// @ts-expect-error dont wanna deal with this right now
app.all("*", createRequestHandler({ build }));

const server = app.listen(3000, async () => {
  // eslint-disable-next-line no-undef
  if (process.env.NODE_ENV === "development") {
    // @ts-expect-error dont wanna deal with this right now
    broadcastDevReady(build);
  }

  console.log("App listening on http://localhost:3000");
});

const gracefulShutdown = () => {
  console.log("Shutting down gracefully...");
  server.close(() => {
    console.log("Closed out remaining connections.");
    process.exit(0);
  });

  // If the server hasn't finished in a timely manner, force shut down
  setTimeout(() => {
    console.error(
      "Could not close connections in time, forcefully shutting down"
    );
    process.exit(1);
  }, 1000);
};

// Listen for TERM signal .e.g. kill
process.on("SIGTERM", gracefulShutdown);

// Listen for INT signal e.g. Ctrl-C
process.on("SIGINT", gracefulShutdown);
