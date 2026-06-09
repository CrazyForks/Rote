#!/usr/bin/env bun

const host = "127.0.0.1";
const port = Number(process.env.ROTE_LOCAL_AI_BRIDGE_PORT || 11435);
const upstream = (
  process.env.ROTE_LOCAL_AI_UPSTREAM || "http://127.0.0.1:8080"
).replace(/\/+$/, "");
const bridgeToken = process.env.ROTE_LOCAL_AI_TOKEN || crypto.randomUUID();
const upstreamToken = process.env.ROTE_LOCAL_AI_UPSTREAM_TOKEN || "";
const allowedOrigins = new Set(
  (
    process.env.ROTE_ALLOWED_ORIGINS ||
    "http://localhost:3001,http://localhost:18001"
  )
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean),
);
const allowedPaths = new Set(["/v1/models", "/v1/chat/completions"]);

function corsHeaders(origin: string | null): Headers {
  const headers = new Headers({
    Vary: "Origin",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Private-Network": "true",
    "Access-Control-Max-Age": "600",
  });
  if (origin && allowedOrigins.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  return headers;
}

function jsonResponse(status: number, body: unknown, origin: string | null) {
  const headers = corsHeaders(origin);
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), { status, headers });
}

function isAuthorized(request: Request): boolean {
  return request.headers.get("authorization") === `Bearer ${bridgeToken}`;
}

function isAllowedOrigin(origin: string | null): boolean {
  return !origin || allowedOrigins.has(origin);
}

const server = Bun.serve({
  hostname: host,
  port,
  async fetch(request) {
    const url = new URL(request.url);
    const origin = request.headers.get("origin")?.replace(/\/+$/, "") || null;

    if (!isAllowedOrigin(origin)) {
      return jsonResponse(
        403,
        { message: "Origin is not allowed by the Rote local AI bridge" },
        null,
      );
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (!isAuthorized(request)) {
      return jsonResponse(
        401,
        { message: "Invalid local AI bridge token" },
        origin,
      );
    }

    if (url.pathname === "/health" && request.method === "GET") {
      try {
        const headers = upstreamToken
          ? { Authorization: `Bearer ${upstreamToken}` }
          : undefined;
        const response = await fetch(`${upstream}/v1/models`, { headers });
        return jsonResponse(
          response.ok ? 200 : 502,
          {
            ok: response.ok,
            upstream,
            upstreamStatus: response.status,
          },
          origin,
        );
      } catch (error: any) {
        return jsonResponse(
          502,
          {
            ok: false,
            upstream,
            message: error?.message || "Unable to reach llama-server",
          },
          origin,
        );
      }
    }

    if (!allowedPaths.has(url.pathname)) {
      return jsonResponse(
        404,
        { message: "Local AI bridge endpoint not found" },
        origin,
      );
    }

    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.delete("origin");
    headers.delete("authorization");
    if (upstreamToken) headers.set("Authorization", `Bearer ${upstreamToken}`);

    try {
      const response = await fetch(`${upstream}${url.pathname}${url.search}`, {
        method: request.method,
        headers,
        body:
          request.method === "GET" || request.method === "HEAD"
            ? undefined
            : request.body,
      });
      const responseHeaders = new Headers(response.headers);
      corsHeaders(origin).forEach((value, key) =>
        responseHeaders.set(key, value),
      );
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (error: any) {
      return jsonResponse(
        502,
        { message: error?.message || "Unable to reach llama-server" },
        origin,
      );
    }
  },
});

console.log(`Rote local AI bridge listening on ${server.url}`);
console.log(`Upstream llama-server: ${upstream}`);
console.log(`Allowed Rote origins: ${Array.from(allowedOrigins).join(", ")}`);
console.log(`Bridge token: ${bridgeToken}`);
