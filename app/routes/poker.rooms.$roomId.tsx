// Createa template page

import { json } from "@remix-run/node";
import { Link, useLoaderData, useMatches } from "@remix-run/react";
import { db } from "../db.server";
import { Tables } from "consts";

const voteOptions = [
  // listen man, i dont care
  { amount: 1, label: "1 point", isLast: false, isMiddle: false },
  { amount: 2, label: "2 points", isLast: false, isMiddle: true },
  { amount: 3, label: "3 points", isLast: false, isMiddle: true },
  { amount: 5, label: "5 points", isLast: false, isMiddle: true },
  { amount: 8, label: "8 points", isLast: true, isMiddle: false },
];

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
      <div className="max-w-4xl px-4 sm:px-6 lg:px-8  py-8 flex flex-row  justify-between items-center">
        <span className="isolate inline-flex rounded-md shadow-sm">
          {voteOptions.map((option) => (
            <button
              key={option.label}
              type="button"
              className={`relative inline-flex items-center ${
                option.isLast ? "rounded-r-md border-l-0" : ""
              } ${
                !option.isMiddle && !option.isLast
                  ? "rounded-l-md rounded-r-none border-l"
                  : ""
              } bg-white px-3 py-2 text-sm font-semibold text-gray-900 border border-l-0 border-gray-300 hover:bg-gray-50 focus:z-10`}
            >
              {option.label}
            </button>
          ))}
        </span>
        <span className="isolate inline-flex rounded-md shadow-sm">
          <button
            type="button"
            className="relative inline-flex items-center gap-x-1.5 rounded-l-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 border border-gray-300 hover:bg-gray-50 focus:z-10"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-eye"
            >
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Show Votes
          </button>
          <button
            type="button"
            className="relative -ml-px inline-flex items-center rounded-r-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 border border-gray-300 hover:bg-gray-50 focus:z-10"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-eraser"
            >
              <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
              <path d="M22 21H7" />
              <path d="m5 11 9 9" />
            </svg>
            Clear Votes
          </button>
        </span>
      </div>
      <div className="max-w-4xl">
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

        <ul className="divide-y py-14">
          {[users[0], users[0], users[0], users[0]].map((user, idx) => (
            <li key={user.id} className="py-6">
              <p className="text-2xl">- {user.name}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
