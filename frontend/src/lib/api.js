import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

const TOKEN_KEY = "bt_auth_token";
export function setAuthToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
}
export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
}
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function formatApiErrorDetail(detail) {
  if (detail == null) return "Hiba történt. Próbáld újra.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export const CURRENCY_SYMBOLS = { HUF: "Ft", EUR: "€", USD: "$", GBP: "£" };

export function fmtMoney(value, currency = "HUF") {
  const n = Number(value || 0);
  const sym = CURRENCY_SYMBOLS[currency] || "";
  const isHuf = currency === "HUF";
  const opts = isHuf && Number.isInteger(n)
    ? { maximumFractionDigits: 0 }
    : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  const formatted = new Intl.NumberFormat("hu-HU", opts).format(n);
  return isHuf ? `${formatted} ${sym}` : `${sym}${formatted}`;
}

export function fmtPct(value) {
  const n = Number(value || 0);
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
}
