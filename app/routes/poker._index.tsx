import { Form, Link } from "@remix-run/react";
import { redirect } from "@remix-run/node";
import { db } from "../db.server";
import { nanoid } from "nanoid";


export const action = async ({ request }) => {
  console.log("In the server now!");
  const formData = await request.formData();

  const roomName = formData.get("room-name");
  const name = formData.get("name");

  const custom_room_id = `room_${nanoid(10)}`;
  const room = await db("rooms")
    .insert({
      name: roomName,
      custom_id: custom_room_id,
    })
    .returning(["id", "custom_id"]);
  console.log("Room in server", room);

  const user = await db("users")
    .insert({
      name,
      custom_id: `user_${nanoid(10)}`,
    })
    .returning("id");

  console.log("User in server", user);
  await db("users_in_rooms").insert({
    user_id: user[0].id,
    room_id: room[0].id,
  });

  return redirect(`/poker/rooms/${custom_room_id}`);
};

export default function Poker() {
  return (
    <div>
      <header>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-gray-900">
            New Pointing Session
          </h1>
        </div>
      </header>
      <main className="max-w-xl px-4 sm:px-6 lg:px-8 mt-10  ">
        <Form method="post">
          <div className="flex flex-col space-y-4">
            <div className="relative">
              <label
                htmlFor="room-name"
                className="absolute -top-2 left-2 inline-block bg-white px-1 text-xs font-medium text-gray-900"
              >
                Room Name
              </label>
              <input
                type="text"
                name="room-name"
                id="room-name"
                className="block w-full px-2 rounded-md border-0 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                placeholder="Deliver Team"
              />
            </div>

            <div className="relative">
              <label
                htmlFor="name"
                className="absolute -top-2 left-2 inline-block bg-white px-1 text-xs font-medium text-gray-900"
              >
                Your Name
              </label>
              <input
                type="text"
                name="name"
                id="name"
                className="block w-full px-2 rounded-md border-0 py-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                placeholder="Jose Valerio"
              />
            </div>

            <div className="flex justify-end flex-row ">
              <button
                type="submit"
                className="rounded-md bg-white px-3.5 py-2.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
              >
                Create
              </button>
            </div>
          </div>
        </Form>
      </main>
    </div>
  );
}
