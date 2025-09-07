import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  layout("layouts/blog-layout.tsx", [
    route("/just-do-the-thing", "routes/just-do-the-thing.tsx"),
    route("/rust-json-logging", "routes/rust-json-logging.tsx"),
  ]),
] satisfies RouteConfig;
