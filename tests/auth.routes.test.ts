// api/src/auth.routes.test.ts
import { describe, expect, it, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../api/src/server";
import { MemoryStore } from "../api/src/memoryStore";

async function registerAndLogin(app: ReturnType<typeof createApp>, email: string) {
  await request(app)
    .post("/auth/register")
    .send({ email, password: "password123" });
  const login = await request(app)
    .post("/auth/login")
    .send({ email, password: "password123" });
  return login.body.token as string;
}

describe("registration and login", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp(new MemoryStore());
  });

  it("registers a user and never returns the password", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ email: "anna@example.com", password: "password123" });
    expect(res.status).toBe(201);
    expect(res.body.email).toBe("anna@example.com");
    expect(JSON.stringify(res.body)).not.toContain("password123");
  });

  it("lowercases and trims the email", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ email: "  Anna@Example.com ", password: "password123" });
    expect(res.body.email).toBe("anna@example.com");
  });

  it("rejects a duplicate email", async () => {
    await request(app).post("/auth/register").send({ email: "a@example.com", password: "password123" });
    const res = await request(app)
      .post("/auth/register")
      .send({ email: "a@example.com", password: "password123" });
    expect(res.status).toBe(409);
  });

  it("rejects a short password", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ email: "a@example.com", password: "short" });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid email", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ email: "not-an-email", password: "password123" });
    expect(res.status).toBe(400);
  });

  it("logs in with the right password and returns a token", async () => {
    await request(app).post("/auth/register").send({ email: "a@example.com", password: "password123" });
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "a@example.com", password: "password123" });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
  });

  it("returns the same error for a wrong password and an unknown email", async () => {
    await request(app).post("/auth/register").send({ email: "a@example.com", password: "password123" });

    const wrongPassword = await request(app)
      .post("/auth/login")
      .send({ email: "a@example.com", password: "wrongpassword" });
    const unknownEmail = await request(app)
      .post("/auth/login")
      .send({ email: "nobody@example.com", password: "password123" });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error).toBe(unknownEmail.body.error);
  });
});

describe("workspace access", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp(new MemoryStore());
  });

  it("rejects workspace requests without a token", async () => {
    const res = await request(app).post("/workspaces").send({ name: "Trip", memberIds: ["anna"], yourMemberId: "anna" });
    expect(res.status).toBe(401);
  });

  it("rejects an invalid token", async () => {
    const res = await request(app)
      .post("/workspaces")
      .set("Authorization", "Bearer not-a-real-token")
      .send({ name: "Trip", memberIds: ["anna"], yourMemberId: "anna" });
    expect(res.status).toBe(401);
  });

  it("lets the creator read their workspace", async () => {
    const token = await registerAndLogin(app, "anna@example.com");
    const created = await request(app)
      .post("/workspaces")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Trip", memberIds: ["anna", "ben"], yourMemberId: "anna" });
    expect(created.status).toBe(201);

    const res = await request(app)
      .get(`/workspaces/${created.body.id}/balances`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it("blocks a signed-in user who is not a member of the workspace", async () => {
    const annaToken = await registerAndLogin(app, "anna@example.com");
    const benToken = await registerAndLogin(app, "ben@example.com");

    const created = await request(app)
      .post("/workspaces")
      .set("Authorization", `Bearer ${annaToken}`)
      .send({ name: "Trip", memberIds: ["anna", "ben"], yourMemberId: "anna" });

    const res = await request(app)
      .get(`/workspaces/${created.body.id}/balances`)
      .set("Authorization", `Bearer ${benToken}`);
    expect(res.status).toBe(403);
  });

  it("rejects creating a workspace when yourMemberId is not one of the members", async () => {
    const token = await registerAndLogin(app, "anna@example.com");
    const res = await request(app)
      .post("/workspaces")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Trip", memberIds: ["anna", "ben"], yourMemberId: "cara" });
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown workspace even when signed in", async () => {
    const token = await registerAndLogin(app, "anna@example.com");
    const res = await request(app)
      .get("/workspaces/does-not-exist/balances")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});