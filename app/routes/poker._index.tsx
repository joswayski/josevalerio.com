import { Form } from "@remix-run/react";
import { redirect } from "@remix-run/node";

export const action = () => {
  console.log("In the server now!");

  return redirect("/poker/rooms/1");
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
                placeholder="Deliver Team"
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
