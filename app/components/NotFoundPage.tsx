import { Link } from "@tanstack/react-router";

export function NotFoundPage() {
  return (
    <main className="error-page">
      <h1>404</h1>
      <p>The requested page could not be found.</p>
      <Link to="/">Return home →</Link>
    </main>
  );
}
