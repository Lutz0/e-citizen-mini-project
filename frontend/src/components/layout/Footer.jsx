import { Link } from "react-router";

export function Footer() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-ink-2 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>
          <span className="font-semibold text-ink">Public Service Request System</span> — a demonstration project for reporting
          and tracking local community issues.
        </p>
        <nav aria-label="Footer" className="flex gap-4">
          <Link to="/" className="font-medium text-brand-700 underline-offset-2 hover:underline">
            Home
          </Link>
          <a href="/#how-it-works" className="font-medium text-brand-700 underline-offset-2 hover:underline">
            How it works
          </a>
        </nav>
      </div>
    </footer>
  );
}
