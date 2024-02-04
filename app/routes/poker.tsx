import { Outlet } from "@remix-run/react";

export default function PokerLayout() {
  return (
    <div className="py-10 h-full border border-red-500">
      <main>
        <div className="mx-auto max-w-7xl sm:px-6 lg:px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
