import { useState } from "react";
import { ArrowRight, CircleCheck, Lock } from "lucide-react";
import * as requestsApi from "../../api/requests.js";
import { useToast } from "../../context/ToastContext.jsx";
import { statusLabel } from "../../utils/constants.js";
import { LIMITS } from "../../utils/validation.js";
import { Alert } from "../ui/Alert.jsx";
import { StatusBadge } from "../ui/Badges.jsx";
import { TextAreaField } from "../ui/FormFields.jsx";
import { ConfirmDialog } from "../ui/Modal.jsx";
import { Button } from "../ui/Button.jsx";

const ACTION_COPY = {
  in_progress: { button: "Start work — mark In Progress", confirm: "Mark as In Progress", note: "Optional message to the citizen, e.g. when the crew will visit." },
  resolved: { button: "Mark as Resolved", confirm: "Mark as Resolved", note: "Optional message to the citizen, e.g. what was done." },
};

/**
 * Administrator control for moving a request along its lifecycle.
 * The API only ever offers the single legal next status, and it re-checks the
 * transition on the server - this panel just makes the right action obvious.
 */
export function StatusUpdatePanel({ request, onUpdated }) {
  const toast = useToast();
  const next = request.allowed_next_statuses[0]; // lifecycle is linear: at most one legal next step
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function close() {
    if (saving) return;
    setOpen(false);
    setError("");
  }

  async function confirm() {
    if (note.length > LIMITS.noteMax) return setError(`The note can be at most ${LIMITS.noteMax} characters.`);
    setSaving(true);
    setError("");
    try {
      const updated = await requestsApi.changeStatus(request.reference, { status: next.value, note: note.trim() });
      setOpen(false);
      setNote("");
      toast.success(`${request.reference} is now ${statusLabel(updated.status)}. The citizen has been notified by email.`);
      onUpdated(updated);
    } catch (apiError) {
      // e.g. another administrator already moved it: show the server's explanation and refresh.
      setError(apiError.fieldError("status") || apiError.fieldError("note") || apiError.detail);
      if (apiError.status === 400) onUpdated();
    } finally {
      setSaving(false);
    }
  }

  if (!next) {
    return (
      <div className="flex items-start gap-3 rounded-lg bg-resolved-50 p-3.5 text-sm text-resolved-700">
        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p>
          <span className="font-semibold">This request is resolved.</span> Resolved requests are final and can't be changed.
        </p>
      </div>
    );
  }

  const copy = ACTION_COPY[next.value];
  return (
    <div>
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2.5 text-sm">
        <dt className="text-ink-2">Current status</dt>
        <dd>
          <StatusBadge status={request.status} />
        </dd>
        <dt className="flex items-center gap-1.5 text-ink-2">
          Next step <ArrowRight className="size-3.5 text-ink-3" aria-hidden="true" />
        </dt>
        <dd>
          <StatusBadge status={next.value} />
        </dd>
      </dl>
      <Button className="mt-4 w-full" icon={CircleCheck} onClick={() => setOpen(true)}>
        {copy.button}
      </Button>
      <p className="mt-2 text-xs text-ink-3">
        Requests move forward one step at a time: Pending → In Progress → Resolved. Every change is recorded.
      </p>

      <ConfirmDialog
        open={open}
        title={`${copy.confirm}?`}
        description={`${request.reference} will change from ${statusLabel(request.status)} to ${next.label}. The citizen will be emailed, and this can't be undone.`}
        confirmLabel={copy.confirm}
        loading={saving}
        onConfirm={confirm}
        onCancel={close}
      >
        <div className="space-y-4">
          {error && <Alert variant="error">{error}</Alert>}
          <TextAreaField
            label="Note to the citizen"
            optional
            rows={3}
            hint={copy.note}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            counter={{ text: `${note.length}/${LIMITS.noteMax}`, over: note.length > LIMITS.noteMax }}
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}
