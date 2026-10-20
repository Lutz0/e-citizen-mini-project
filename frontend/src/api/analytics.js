import { request } from "./client.js";

export const getSummary = ({ days = 30 } = {}, signal) => request("/analytics/summary/", { params: { days }, signal });
