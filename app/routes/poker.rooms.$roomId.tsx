// Createa template page

import { json } from "@remix-run/node";
import { Link, useLoaderData, useMatches } from "@remix-run/react";
import { db } from "../db.server";
import { Tables } from "consts";

export const loader = async ({ params }) => {
  const users = await db(Tables.USERS)
    .join(
      Tables.USERS_IN_ROOMS,
      `${Tables.USERS}.id`,
      "=",
      `${Tables.USERS_IN_ROOMS}.user_id`
    )
    .join(
      Tables.ROOMS,
      `${Tables.ROOMS}.id`,
      "=",
      `${Tables.USERS_IN_ROOMS}.room_id`
    )
    .select(`${Tables.USERS}.*`) // Select all user fields; adjust if you need specific fields
    .where(`${Tables.ROOMS}.custom_id`, params.roomId);

  const room = await db(Tables.ROOMS)
    .select()
    .where({ custom_id: params.roomId })
    .limit(1);

  console.log(`USERS: ${users}`);
  console.log(`ROOM: ${JSON.stringify(room)}`);
  return json({ users, room: room[0] });
};

export default function Room() {
  const { users, room } = useLoaderData();
  return (
    <div>
      <header>
        <div className=" max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-gray-900">
            {room.name}
          </h1>
        </div>
      </header>
      <div className="max-w-4xl px-4 sm:px-6 lg:px-8 space-y-4 py-8">
        <span className="isolate inline-flex rounded-md shadow-sm ">
          <button
            type="button"
            className="relative inline-flex items-center rounded-l-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-10"
          >
            1 point
          </button>
          <button
            type="button"
            className="relative -ml-px inline-flex items-center bg-white px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-10"
          >
            2 points
          </button>
          <button
            type="button"
            className="relative -ml-px inline-flex items-center bg-white px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-10"
          >
            3 points
          </button>
          <button
            type="button"
            className="relative -ml-px inline-flex items-center bg-white px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-10"
          >
            5 points
          </button>
          <button
            type="button"
            className="relative -ml-px inline-flex items-center rounded-r-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-10"
          >
            8 points
          </button>
        </span>
        <div className="relative">
          <div
            className="absolute inset-0 flex items-center"
            aria-hidden="true"
          >
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-2 text-sm text-gray-500">Players</span>
          </div>
        </div>

        <ul>
          {users.map((user) => (
            <li key={user.id}>- {user.name}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
