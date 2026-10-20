import { API_BASE, request } from "./client.js";

export const listRequests = (params, signal) => request("/requests/", { params, signal });

export const getRequest = (reference, signal) => request(`/requests/${encodeURIComponent(reference)}/`, { signal });

/** Creates a request. Always multipart so an optional photo can ride along. */
export function createRequest({ category, location, description, severity, image }) {
  const formData = new FormData();
  formData.append("category", category);
  formData.append("location", location);
  formData.append("description", description);
  formData.append("severity", severity);
  if (image) formData.append("image", image);
  return request("/requests/", { method: "POST", formData });
}

export const changeStatus = (reference, { status, note }) =>
  request(`/requests/${encodeURIComponent(reference)}/status/`, { method: "POST", json: { status, note } });

export const addComment = (reference, body) =>
  request(`/requests/${encodeURIComponent(reference)}/comments/`, { method: "POST", json: { body } });

/** Photos are served by an authenticated endpoint; the session cookie authorises the <img> request. */
export const requestImageUrl = (reference) => `${API_BASE}/requests/${encodeURIComponent(reference)}/image/`;
