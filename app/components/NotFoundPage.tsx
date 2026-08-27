import { ErrorScreen } from "./ErrorScreen";

export function NotFoundPage() {
  return (
    <ErrorScreen title="404" message="The requested page could not be found." />
  );
}
