import { useEffect, useId, useMemo, useRef } from "react";
import { CircleAlert, ImagePlus, Trash2 } from "lucide-react";
import { Button } from "../ui/Button.jsx";
import { IMAGE_ACCEPT, LIMITS } from "../../utils/validation.js";

const formatSize = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/**
 * Optional photo field with a live preview.
 * The file is validated here for instant feedback; the server validates it again
 * (type, size, real image content) before anything is stored.
 */
export function ImagePicker({ file, error, onChange }) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const inputRef = useRef(null);

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl]);

  function handleChange(event) {
    onChange(event.target.files?.[0] ?? null);
    event.target.value = ""; // allow choosing the same file again after removing it
  }

  return (
    <div>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-semibold text-ink">
        Photo <span className="font-normal text-ink-3">(optional)</span>
      </label>

      {file && previewUrl ? (
        <div className="flex items-start gap-4 rounded-lg border border-line-strong bg-white p-3">
          <img src={previewUrl} alt="Preview of the photo you selected" className="size-24 rounded-md border border-line object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{file.name}</p>
            <p className="text-sm text-ink-2">{formatSize(file.size)}</p>
            <Button variant="ghost" size="sm" icon={Trash2} className="-ml-3 mt-1" onClick={() => onChange(null)}>
              Remove photo
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={IMAGE_ACCEPT}
            onChange={handleChange}
            aria-describedby={[error ? errorId : null, hintId].filter(Boolean).join(" ")}
            aria-invalid={error ? "true" : undefined}
            className="sr-only"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            aria-describedby={hintId}
            className="flex w-full flex-col items-center gap-1 rounded-lg border-2 border-dashed border-line-strong bg-white px-4 py-6 text-center transition-colors hover:border-brand-500 hover:bg-brand-50"
          >
            <ImagePlus className="size-7 text-brand-700" aria-hidden="true" />
            <span className="font-semibold text-brand-700">Choose a photo</span>
            <span className="text-sm text-ink-2">or take one with your phone's camera</span>
          </button>
        </div>
      )}

      <p id={hintId} className="mt-1.5 text-sm text-ink-2">
        A clear photo helps the team find and fix the problem faster. JPEG, PNG or WebP, up to{" "}
        {LIMITS.imageMaxBytes / (1024 * 1024)} MB.
      </p>
      {error && (
        <p id={errorId} className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-danger-600">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
