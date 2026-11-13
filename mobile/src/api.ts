// mobile/src/api.ts
import { Platform } from "react-native";

// For a physical phone, use the Mac's current Wi-Fi address here.
const PHONE_API_URL = "http://192.168.0.83:3000";
export const API_URL = Platform.OS === "web" ? "http://localhost:3000" : PHONE_API_URL;

export interface Workspace {
  id: string;
  name: string;
  memberIds: string[];
}

export interface Expense {
  id: string;
  payerId: string;
  amountCents: number;
  participantIds: string[];
  description?: string;
  category?: string;
  date?: string;
  note?: string;
}

const TIMEOUT_MS = 10000;

export async function apiRequest<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers, signal: controller.signal });
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new Error(`No response from ${API_URL} after 10 seconds. Check the phone and Mac are on the same Wi-Fi and the API is running.`);
    }
    throw new Error(`Could not reach ${API_URL}: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return body as T;
}

export async function login(email: string, password: string): Promise<string> {
  const body = await apiRequest<{ token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return body.token;
}

export async function register(email: string, password: string): Promise<void> {
  await apiRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function createWorkspace(
  token: string,
  name: string,
  memberIds: string[],
  yourMemberId: string
): Promise<Workspace> {
  return apiRequest<Workspace>(
    "/workspaces",
    { method: "POST", body: JSON.stringify({ name, memberIds, yourMemberId }) },
    token
  );
}

export async function getMyWorkspaces(token: string): Promise<Workspace[]> {
  const body = await apiRequest<{ workspaces: Workspace[] }>("/workspaces", {}, token);
  return body.workspaces;
}

export async function getWorkspaceExpenses(token: string, workspaceId: string): Promise<Expense[]> {
  const body = await apiRequest<{ expenses: Expense[] }>(
    `/workspaces/${encodeURIComponent(workspaceId)}/expenses`,
    {},
    token
  );
  return body.expenses;
}

export async function getWorkspaceCategories(token: string, workspaceId: string): Promise<string[]> {
  const body = await apiRequest<{ categories: string[] }>(
    `/workspaces/${encodeURIComponent(workspaceId)}/categories`,
    {},
    token
  );
  return body.categories;
}

export async function createWorkspaceCategory(
  token: string,
  workspaceId: string,
  name: string
): Promise<string> {
  const body = await apiRequest<{ category: string }>(
    `/workspaces/${encodeURIComponent(workspaceId)}/categories`,
    { method: "POST", body: JSON.stringify({ name }) },
    token
  );
  return body.category;
}

export function addWorkspaceExpense(
  token: string,
  workspaceId: string,
  expense: Omit<Expense, "id" | "description" | "category" | "date" | "note"> & {
    category: string;
    date: string;
    note?: string;
  }
): Promise<Expense> {
  return apiRequest<Expense>(
    `/workspaces/${encodeURIComponent(workspaceId)}/expenses`,
    { method: "POST", body: JSON.stringify(expense) },
    token
  );
}
