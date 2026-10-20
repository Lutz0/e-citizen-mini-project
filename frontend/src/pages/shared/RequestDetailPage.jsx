import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { Calendar, Check, Copy, Gauge, Mail, MapPin, Phone, Tag, User } from "lucide-react";
import * as requestsApi from "../../api/requests.js";
import { ActivityTimeline } from "../../components/requests/ActivityTimeline.jsx";
import { CommentThread } from "../../components/requests/CommentThread.jsx";
import { RequestImage } from "../../components/requests/RequestImage.jsx";
import { StatusStepper } from "../../components/requests/StatusStepper.jsx";
import { StatusUpdatePanel } from "../../components/requests/StatusUpdatePanel.jsx";
import { Container, PageHeader } from "../../components/layout/Page.jsx";
import { Alert } from "../../components/ui/Alert.jsx";
import { CategoryLabel, SeverityBadge, StatusBadge } from "../../components/ui/Badges.jsx";
import { Button, ButtonLink } from "../../components/ui/Button.jsx";
import { Card, CardHeader } from "../../components/ui/Card.jsx";
import { PageLoader } from "../../components/ui/Loading.jsx";
import { ErrorState } from "../../components/ui/States.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useApi } from "../../hooks/useApi.js";
import { useDocumentTitle } from "../../hooks/useDocumentTitle.js";
import { formatDateTime } from "../../utils/format.js";

function CopyReference({ reference }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);
      toast.info("Reference number copied.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy automatically. Please select and copy the reference number.");
    }
  }

  return (
    <Button variant="ghost" size="sm" icon={copied ? Check : Copy} onClick={copy} aria-label={`Copy reference number ${reference}`}>
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

/** One row of a description list: `<div><dt>…</dt><dd>…</dd></div>` (the only structure <dl> allows). */
function Fact({ icon: Icon, label, children }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-3">
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-1 pl-6 text-ink">{children}</dd>
    </div>
  );
}

export default function RequestDetailPage() {
  const { reference } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  // The "request submitted" banner belongs to the moment of submission only. Remember which
  // reference was just created, then clear the history state so a reload (or coming back
  // later, after the status has moved on) doesn't show a stale banner.
  const [justCreatedReference] = useState(location.state?.justCreated ?? null);
  useEffect(() => {
    if (location.state?.justCreated) navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location, navigate]);

  const query = useApi((signal) => requestsApi.getRequest(reference, signal), reference);
  const { data: request, error, loading, refreshing, reload } = query;

  useDocumentTitle(request ? `Request ${request.reference}` : "Request");
  const back = isAdmin ? { to: "/admin", label: "Back to dashboard" } : { to: "/requests", label: "Back to my requests" };

  if (loading) {
    return (
      <Container className="py-8">
        <PageLoader label="Loading request" />
      </Container>
    );
  }

  if (error && !request) {
    const notFound = error.status === 404;
    return (
      <Container narrow className="py-12">
        <ErrorState
          error={
            notFound
              ? { detail: "We couldn't find a request with that reference number. Check it and try again." }
              : error
          }
          title={notFound ? "Request not found" : "We couldn't load this request"}
          onRetry={notFound ? undefined : reload}
        />
        <div className="text-center">
          <ButtonLink to={back.to} variant="secondary">
            {back.label}
          </ButtonLink>
        </div>
      </Container>
    );
  }

  const justCreated = justCreatedReference === request.reference;

  return (
    <Container className="py-8">
      <PageHeader
        back={back}
        title={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono text-2xl sm:text-3xl">{request.reference}</span>
            <StatusBadge status={request.status} className="text-sm" />
          </span>
        }
        description={undefined}
        actions={<CopyReference reference={request.reference} />}
      />

      {justCreated && (
        <Alert variant="success" title="Your request has been submitted" className="mb-6">
          Your reference number is <strong className="font-mono">{request.reference}</strong>. Keep it handy — you can use it to
          follow up, and we'll email you when the status changes.
        </Alert>
      )}
      {error && (
        <Alert variant="error" className="mb-6" action={<Button size="sm" variant="secondary" onClick={reload}>Retry</Button>}>
          {error.detail}
        </Alert>
      )}

      <div className={`grid gap-6 lg:grid-cols-[1fr_20rem] ${refreshing ? "opacity-70" : ""}`} aria-busy={refreshing || undefined}>
        <aside className="space-y-6 lg:col-start-2 lg:row-start-1" aria-label="Request actions">
          {isAdmin ? (
            <>
              <Card as="section" aria-labelledby="status-heading">
                <CardHeader id="status-heading" title="Update status" />
                <div className="p-5">
                  <StatusUpdatePanel request={request} onUpdated={reload} />
                </div>
              </Card>
              <Card as="section" aria-labelledby="citizen-heading">
                <CardHeader id="citizen-heading" title="Submitted by" />
                <dl className="space-y-3 p-5 text-sm">
                  <Fact icon={User} label="Name">{request.citizen.full_name}</Fact>
                  <Fact icon={Mail} label="Email">
                    <a className="break-all text-brand-700 hover:underline" href={`mailto:${request.citizen.email}`}>
                      {request.citizen.email}
                    </a>
                  </Fact>
                  <Fact icon={Phone} label="Phone">{request.citizen.phone_number || "Not provided"}</Fact>
                </dl>
              </Card>
            </>
          ) : (
            <Card as="section" aria-labelledby="next-heading">
              <CardHeader id="next-heading" title="What happens next" />
              <div className="space-y-3 p-5 text-sm text-ink-2">
                {request.status === "pending" && <p>Your request has been received and is waiting to be picked up by the service team.</p>}
                {request.status === "in_progress" && <p>The service team is working on your request. We'll email you as soon as it's resolved.</p>}
                {request.status === "resolved" && <p>This request has been resolved. Thank you for helping improve your community.</p>}
                <p>You can add a message below if you have more information to share.</p>
              </div>
            </Card>
          )}
        </aside>
        <div className="min-w-0 space-y-6 lg:col-start-1 lg:row-start-1">
          <Card as="section" aria-label="Progress">
            <div className="p-5">
              <StatusStepper request={request} />
            </div>
          </Card>

          <Card as="section" aria-labelledby="details-heading">
            <CardHeader id="details-heading" title="Request details" />
            <div className="space-y-5 p-5">
              <dl className="grid gap-4 sm:grid-cols-2">
                <Fact icon={MapPin} label="Location">{request.location}</Fact>
                <Fact icon={Calendar} label="Submitted">
                  <time dateTime={request.created_at}>{formatDateTime(request.created_at)}</time>
                </Fact>
                <Fact icon={Tag} label="Category">
                  <CategoryLabel category={request.category} />
                </Fact>
                <Fact icon={Gauge} label="Severity">
                  <SeverityBadge severity={request.severity} />
                </Fact>
              </dl>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-3">Description</h3>
                <p className="mt-1 whitespace-pre-line text-ink">{request.description}</p>
              </div>
              {request.has_image && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">Photo</h3>
                  <RequestImage reference={request.reference} />
                </div>
              )}
            </div>
          </Card>

          <Card as="section" aria-labelledby="updates-heading">
            <CardHeader
              id="updates-heading"
              title={isAdmin ? "Updates & messages" : "Messages from the service team"}
              description={`${request.comments.length} ${request.comments.length === 1 ? "message" : "messages"}`}
            />
            <div className="p-5">
              <CommentThread reference={request.reference} comments={request.comments} isAdmin={isAdmin} onPosted={reload} />
            </div>
          </Card>

          <Card as="section" aria-labelledby="history-heading">
            <CardHeader id="history-heading" title="History" description="Every status change, who made it and when" />
            <div className="p-5">
              <ActivityTimeline changes={request.status_changes} />
            </div>
          </Card>
        </div>

      </div>
    </Container>
  );
}
