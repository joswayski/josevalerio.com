import logoDark from "./logo-dark.svg";
import logoLight from "./logo-light.svg";

export function Welcome() {
  return (
    <main className="flex items-center justify-center pt-16 pb-4">
      <div className="flex-1 flex flex-col items-center gap-16 min-h-0">

        <div className="max-w-[300px] w-full space-y-6 px-4">
          <nav className="rounded-3xl border border-gray-200 p-6 dark:border-gray-700 space-y-4">
            <h1 className="leading-6 text-gray-700 dark:text-gray-200 text-center">
              Hi! Currently migrating to on prem :) BRB!!
              Sept 7th 1pm est
            </h1>
      
          </nav>
        </div>
      </div>
    </main>
  );
}


