// Createa template page

import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { db } from "../db.server";

export const loader = async () => {
  const users = await db.select().from("users");

  return json(users);
};

export default function Room() {
  const data = useLoaderData();
  console.log(`DATA: ${JSON.stringify(data)}`);
  return (
    <div>
      <h1>Room</h1>

      <p>You are in room with {JSON.stringify(data)}</p>
      <button
        type="button"
        className="rounded-md bg-indigo-50 px-3.5 py-2.5 text-sm font-semibold text-indigo-600 shadow-sm hover:bg-indigo-100"
      >
        <Link to="/">Home</Link>
      </button>
      <button
        type="button"
        className="rounded-md bg-indigo-50 px-3.5 py-2.5 text-sm font-semibold text-indigo-600 shadow-sm hover:bg-indigo-100"
      >
        <Link to="/poker">Back</Link>
      </button>
    </div>
  );
}
