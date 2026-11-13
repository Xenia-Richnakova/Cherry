// api/src/testHelpers.ts
import request from "supertest";
import { createApp } from "./server";

type App = ReturnType<typeof createApp>;

// Registers a user and returns a signed-in token.
export async function registerAndLogin(app: App, email: string): Promise<string> {
  await request(app).post("/auth/register").send({ email, password: "password123" });
  const login = await request(app).post("/auth/login").send({ email, password: "password123" });
  return login.body.token as string;
}

// Creates a workspace as the given user and returns its id.
export async function createWorkspace(
  app: App,
  token: string,
  name: string,
  memberIds: string[],
  yourMemberId: string
): Promise<string> {
  const res = await request(app)
    .post("/workspaces")
    .set("Authorization", `Bearer ${token}`)
    .send({ name, memberIds, yourMemberId });
  return res.body.id as string;
}