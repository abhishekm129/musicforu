import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET } from "../src/app/api/youtube/route";

function request(url: string) {
  return new NextRequest(
    `http://localhost:3000/api/youtube?url=${encodeURIComponent(url)}`,
  );
}

test("metadata route rejects invalid input before any upstream request", async (context) => {
  const mock = context.mock.method(globalThis, "fetch", async () => {
    throw new Error("Must not fetch");
  });
  for (const url of [
    "bad",
    "https://evil.com/watch?v=5NV6Rdv1a3I",
    "x".repeat(2049),
  ]) {
    const response = await GET(request(url));
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /valid YouTube/);
  }
  assert.equal(mock.mock.callCount(), 0);
});

test("metadata route fetches only canonical YouTube URLs and returns bounded metadata", async (context) => {
  const mock = context.mock.method(globalThis, "fetch", async () =>
    Response.json({
      title: "t".repeat(400),
      author_name: "a".repeat(250),
      html: "untrusted HTML",
    }),
  );
  const response = await GET(request("https://youtu.be/5NV6Rdv1a3I?t=20"));
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.videoId, "5NV6Rdv1a3I");
  assert.equal(data.title.length, 300);
  assert.equal(data.artist.length, 200);
  assert.equal(data.html, undefined);
  assert.match(
    String(mock.mock.calls[0].arguments[0]),
    /^https:\/\/www.youtube.com\/oembed\?url=/,
  );
});

test("metadata route reports unavailable videos and upstream failures", async (context) => {
  const mock = context.mock.method(
    globalThis,
    "fetch",
    async () => new Response(null, { status: 404 }),
  );
  assert.equal((await GET(request("5NV6Rdv1a3I"))).status, 422);
  mock.mock.mockImplementation(async () => {
    throw new Error("Network unavailable");
  });
  const failure = await GET(request("5NV6Rdv1a3I"));
  assert.equal(failure.status, 502);
  assert.match((await failure.json()).error, /manually/);
  mock.mock.mockImplementation(async () => Response.json({ title: 123 }));
  assert.equal((await GET(request("5NV6Rdv1a3I"))).status, 502);
});
