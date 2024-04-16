import dotenv from "dotenv";
dotenv.config();

import { remix } from "remix-hono/handler";
import { broadcastDevReady } from "@remix-run/node";
import * as build from "./build/index.js";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { serve } from "@hono/node-server";

const app = new Hono();

app.use("/build/*", serveStatic({ root: "public" }));

app.use("*", remix({ build, mode: process.env.NODE_ENV || "production" }));

app.get("/api/health", (c) => c.text("Hello Node.js!"));

const server = serve(app, () => {
  // eslint-disable-next-line no-undef
  if (process.env.NODE_ENV === "development") {
    // @ts-expect-error dont wanna deal with this right now
    broadcastDevReady(build);
  }
  console.log("Server is running on http://localhost:3000");
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
