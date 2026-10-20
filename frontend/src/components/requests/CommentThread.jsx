import { useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import * as requestsApi from "../../api/requests.js";
import { useToast } from "../../context/ToastContext.jsx";
import { formatDateTime } from "../../utils/format.js";
import { LIMITS } from "../../utils/validation.js";
import { Alert } from "../ui/Alert.jsx";
import { Button } from "../ui/Button.jsx";
import { TextAreaField } from "../ui/FormFields.jsx";

/** Updates and messages between the citizen and the service team. */
export function CommentThread({ reference, comments, isAdmin, onPosted }) {
  const toast = useToast();
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [posting, setPosting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const text = body.trim();
    if (!text) return setError("Please write a message first.");
    if (text.length > LIMITS.commentMax) return setError(`Messages can be at most ${LIMITS.commentMax} characters.`);

    setPosting(true);
    setError("");
    try {
      await requestsApi.addComment(reference, text);
      setBody("");
      toast.success(isAdmin ? "Update posted. The citizen will see it on their request." : "Message sent to the service team.");
      onPosted();
    } catch (apiError) {
      setError(apiError.fieldError("body") || apiError.detail);
    } finally {
      setPosting(false);
    }
  }

  return (
    <div>
      {comments.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-ink-2">
          <MessageSquare className="size-4" aria-hidden="true" />
          {isAdmin ? "No updates yet. Post one to keep the citizen informed." : "No messages yet. Updates from the service team will appear here."}
        </p>
      ) : (
        <ul className="space-y-3" aria-label="Messages">
          {comments.map((comment) => {
            const fromTeam = comment.author_role === "admin";
            return (
              <li key={comment.id} className={`rounded-xl border p-3.5 ${fromTeam ? "border-brand-200 bg-brand-50" : "border-line bg-white"}`}>
                <p className="flex flex-wrap items-center gap-x-2 text-sm">
                  <span className="font-semibold text-ink">{comment.author_name}</span>
                  {fromTeam && (
                    <span className="rounded-full bg-brand-700 px-2 py-0.5 text-xs font-semibold text-white">Service team</span>
                  )}
                  <time className="text-ink-3" dateTime={comment.created_at}>
                    {formatDateTime(comment.created_at)}
                  </time>
                </p>
                <p className="mt-1.5 whitespace-pre-line text-ink">{comment.body}</p>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-3">
        <TextAreaField
          label={isAdmin ? "Post an update for the citizen" : "Add a message for the service team"}
          rows={3}
          value={body}
          onChange={(event) => {
            setBody(event.target.value);
            if (error) setError("");
          }}
          error={error}
          counter={{ text: `${body.length}/${LIMITS.commentMax}`, over: body.length > LIMITS.commentMax }}
        />
        {isAdmin && (
          <Alert variant="info">Updates are visible to the citizen who submitted this request.</Alert>
        )}
        <Button type="submit" icon={Send} loading={posting} variant="secondary">
          {isAdmin ? "Post update" : "Send message"}
        </Button>
      </form>
    </div>
  );
}
