import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/todos")({
  component: TodosComponent,
});

function TodosComponent() {
  return <div>TODOs should be here</div>;
}
