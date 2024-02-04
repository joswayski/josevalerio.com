// Createa template page

import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

export const loader = async ({ params }) => {
  return json({ data: { message: "Ueah" } });
};

export default function Room() {
  const data = useLoaderData();
  return (
    <div>
      <h1>Room</h1>

      <p>You are in room: {data.data.message}</p>
    </div>
  );
}
