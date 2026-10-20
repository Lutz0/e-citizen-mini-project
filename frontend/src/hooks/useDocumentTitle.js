import { useEffect } from "react";

const APP_NAME = "Public Service Requests";

/** Sets a descriptive <title> per page (also what screen readers announce on navigation). */
export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
  }, [title]);
}
