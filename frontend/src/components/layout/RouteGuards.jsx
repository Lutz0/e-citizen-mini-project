import { Navigate, useLocation } from "react-router";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { homePathFor, ROLES } from "../../utils/constants.js";
import { ButtonLink } from "../ui/Button.jsx";
import { PageLoader } from "../ui/Loading.jsx";
import { Container } from "./Page.jsx";

export function Forbidden() {
  const { user } = useAuth();
  return (
    <Container narrow className="py-16 text-center">
      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-danger-50 text-danger-600">
        <ShieldAlert className="size-7" aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-2xl font-bold">You don't have access to this page</h1>
      <p className="mt-2 text-ink-2">This area is only available to administrators.</p>
      <ButtonLink to={homePathFor(user)} className="mt-6">
        Go to my dashboard
      </ButtonLink>
    </Container>
  );
}

/**
 * Protects a route. Anonymous visitors are sent to sign in (and returned here
 * afterwards). `role` restricts the route to citizens or administrators.
 *
 * This is a usability layer only - the API enforces the same rules on every
 * request, so bypassing the UI gains nothing.
 */
export function RequireAuth({ role, children }) {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) return <PageLoader label="Checking your session" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;

  if (role && user.role !== role) {
    // An administrator who lands on a citizen page is simply redirected home.
    return role === ROLES.CITIZEN ? <Navigate to={homePathFor(user)} replace /> : <Forbidden />;
  }
  return children;
}

/** Login / register: signed-in people are sent on to their own home instead. */
export function GuestOnly({ children }) {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) return <PageLoader label="Loading" />;
  if (user) return <Navigate to={location.state?.from?.pathname || homePathFor(user)} replace />;
  return children;
}
