import { Compass } from "lucide-react";
import { ButtonLink } from "../components/ui/Button.jsx";
import { Container } from "../components/layout/Page.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useDocumentTitle } from "../hooks/useDocumentTitle.js";
import { homePathFor } from "../utils/constants.js";

export default function NotFoundPage() {
  useDocumentTitle("Page not found");
  const { user } = useAuth();
  return (
    <Container narrow className="py-16 text-center">
      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand-50 text-brand-700">
        <Compass className="size-7" aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-2xl font-bold">We couldn't find that page</h1>
      <p className="mt-2 text-ink-2">The link may be mistyped or the page may have moved.</p>
      <ButtonLink to={user ? homePathFor(user) : "/"} className="mt-6">
        {user ? "Go to my dashboard" : "Back to the home page"}
      </ButtonLink>
    </Container>
  );
}
