// mobile/src/api.ts
// Change this to your Mac's address on the Wi-Fi network.
//export const API_URL = "http://192.168.0.83:3000";
export const API_URL = "http://localhost:3000";
console.log("sending to", API_URL)

export interface Workspace {
  id: string;
  name: string;
  memberIds: string[];
}

const TIMEOUT_MS = 10000;

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
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
  const body = await request<{ token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return body.token;
}

export async function register(email: string, password: string): Promise<void> {
  await request("/auth/register", {
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
  return request<Workspace>(
    "/workspaces",
    { method: "POST", body: JSON.stringify({ name, memberIds, yourMemberId }) },
    token
  );
}