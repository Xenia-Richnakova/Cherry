// api/src/members.test.ts
import { describe, expect, it, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../api/src/server";
import { MemoryStore } from "../api/src/memoryStore";

describe("member validation on creation", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp(new MemoryStore());
  });

  it("rejects duplicate members that differ only by surrounding spaces", async () => {
    const res = await request(app)
      .post("/workspaces")
      .send({ name: "Trip", memberIds: ["anna", " anna "] });
    expect(res.status).toBe(400);
  });

  it("rejects a blank member name", async () => {
    const res = await request(app)
      .post("/workspaces")
      .send({ name: "Trip", memberIds: ["anna", "   "] });
    expect(res.status).toBe(400);
  });

  it("trims member names when a workspace is created", async () => {
    const res = await request(app)
      .post("/workspaces")
      .send({ name: "Trip", memberIds: [" anna ", "ben"] });
    expect(res.status).toBe(201);
    expect(res.body.memberIds).toEqual(["anna", "ben"]);
  });
});

describe("shadow members", () => {
  let app: ReturnType<typeof createApp>;
  let workspaceId: string;

  beforeEach(async () => {
    app = createApp(new MemoryStore());
    const created = await request(app)
      .post("/workspaces")
      .send({ name: "Trip", memberIds: ["anna", "ben"] });
    workspaceId = created.body.id;
  });

  it("adds a shadow member to an existing workspace", async () => {
    const res = await request(app)
      .post(`/workspaces/${workspaceId}/members`)
      .send({ name: "Cara" });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ memberId: "Cara", name: "Cara" });

    const ws = await request(app).get(`/workspaces/${workspaceId}/balances`);
    expect(ws.body.balances.map((b: { memberId: string }) => b.memberId)).toContain("Cara");
  });

  it("lets a shadow member take part in an expense", async () => {
    await request(app)
      .post(`/workspaces/${workspaceId}/members`)
      .send({ name: "Cara" });

    const expense = await request(app)
      .post(`/workspaces/${workspaceId}/expenses`)
      .send({ payerId: "anna", amountCents: 3000, participantIds: ["anna", "ben", "Cara"] });
    expect(expense.status).toBe(201);
  });

  it("returns 409 when the member already exists", async () => {
    const res = await request(app)
      .post(`/workspaces/${workspaceId}/members`)
      .send({ name: "anna" });
    expect(res.status).toBe(409);
  });

  it("treats a name with extra spaces as the same member", async () => {
    const res = await request(app)
      .post(`/workspaces/${workspaceId}/members`)
      .send({ name: "  ben  " });
    expect(res.status).toBe(409);
  });

  it("rejects a blank name", async () => {
    const res = await request(app)
      .post(`/workspaces/${workspaceId}/members`)
      .send({ name: "   " });
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown workspace", async () => {
    const res = await request(app)
      .post("/workspaces/does-not-exist/members")
      .send({ name: "Cara" });
    expect(res.status).toBe(404);
  });
});