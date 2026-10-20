import { useState } from "react";
import { ExternalLink, ImageOff } from "lucide-react";
import { requestImageUrl } from "../../api/requests.js";
import { Skeleton } from "../ui/Loading.jsx";

/** The photo attached to a request, streamed from the authenticated image endpoint. */
export function RequestImage({ reference }) {
  const [state, setState] = useState("loading"); // loading | ready | failed
  const url = requestImageUrl(reference);

  if (state === "failed") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-line bg-page p-4 text-sm text-ink-2" role="status">
        <ImageOff className="size-5 shrink-0" aria-hidden="true" />
        The photo couldn't be loaded right now.
      </div>
    );
  }

  return (
    <figure>
      <div className="relative overflow-hidden rounded-lg border border-line bg-page">
        {state === "loading" && <Skeleton className="h-56 w-full rounded-none" />}
        <img
          src={url}
          alt={`Photo submitted with request ${reference}`}
          loading="lazy"
          onLoad={() => setState("ready")}
          onError={() => setState("failed")}
          className={`max-h-96 w-full object-contain ${state === "ready" ? "" : "absolute inset-0 opacity-0"}`}
        />
      </div>
      <figcaption className="mt-2">
        <a
          href={url}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"
        >
          Open full size <ExternalLink className="size-3.5" aria-hidden="true" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </figcaption>
    </figure>
  );
}
