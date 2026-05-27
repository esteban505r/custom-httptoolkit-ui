---
name: list-project-endpoints
description: >-
  Scans a codebase for important HTTP API endpoints (REST routes, RPC handlers,
  framework routers, server handlers) and writes a JSON file compatible with
  HTTP Toolkit’s “Import endpoint list file”, optionally including static
  `response` payloads so saving the import creates mock rules for simulation.
  Use when the user wants an API route inventory, mockable stubs, endpoint
  documentation extract, or httptoolkitEndpoints / endpoint list import.
---

# List project endpoints (HTTP Toolkit)

## Goal

Produce **`httptoolkit-endpoints.json`** (or another name the user prefers) in the **project root** or next to the service, so it can be imported via **Settings → API Settings → Import endpoint list file** in [custom-httptoolkit-ui](https://github.com/httptoolkit/httptoolkit-ui) (or this fork).

## Output format (required)

Single JSON object:

| Field | Required | Notes |
|-------|----------|--------|
| `httptoolkitEndpoints` | Yes | Must be `"1"` (string) or `1` |
| `baseUrl` | Yes | Default base URL (shown in UI). Final matching URL for mocks uses the base URL the user confirms when saving. |
| `endpoints` | Yes | Non-empty array of endpoint objects (see below) |
| `title` | No | Shown as spec title in UI; mock rule group becomes `"<title> mocks"` |
| `version` | No | Info version string |

### Each `endpoints[]` entry

| Field | Required | Notes |
|-------|----------|--------|
| `method` | Yes | `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`, `TRACE` (any casing) |
| `path` | Yes | Path template; leading `/` optional. Use `{id}` segments if the app does (OpenAPI-style). |
| `summary` | No | Short description; used in generated OpenAPI |
| `response` | No | If present, **saving** the imported API adds an HTTP **mock rule** (fixed response) for this method + full URL (`base URL` from the form + `path`). Omit for documentation-only operations. |

### `response` object (for simulation)

| Field | Required | Notes |
|-------|----------|--------|
| `status` | No | HTTP status (integer 100–999). Default `200`. |
| `statusMessage` | No | Status line text; sensible default from status if omitted |
| `headers` | No | String map of response headers (e.g. `content-type`) |
| `json` | No | If set, body is JSON (`JSON.stringify` for objects). Sets `Content-Type: application/json; charset=utf-8` unless `headers` already define `content-type`. |
| `body` | No | Raw UTF-8 body; ignored if `json` is set |

Provide **`json` OR `body`** (or neither for an empty body).

## What to include

Prioritize endpoints that matter for debugging or contract understanding:

- Public HTTP routes (Express/Fastify/Hono/Nest, Rails routes, Django URLs, Spring `@RequestMapping`, Go `http.Handle`, etc.)
- API gateway or BFF route tables
- GraphQL: optionally add `POST /graphql` with a `response` if the user wants to simulate it
- Webhooks and health checks if the user cares about them

When the user wants **simulation**, add realistic `response` bodies (often `json`) for the routes they need to stub. De-duplicate identical method + path.

## Workflow

1. Identify stack (language, framework, router module).
2. Search the repo using framework-appropriate patterns (route definitions, decorators, OpenAPI annotations, `routes.ts`, etc.).
3. If an **OpenAPI/Swagger** file already exists and is authoritative, say so—the user can load that directly in HTTP Toolkit; still offer an endpoint list if they want mocks without a full spec.
4. Write the JSON file with valid syntax; ensure `endpoints.length >= 1`.
5. Tell the user: **Import endpoint list file** → adjust base URL if needed → **Save**. If any entry has `response`, a new rule group with **fixed response** steps is added automatically (above default passthrough).

## Example (with mocks)

```json
{
  "httptoolkitEndpoints": "1",
  "title": "Checkout service",
  "version": "1.0.0",
  "baseUrl": "http://localhost:8080",
  "endpoints": [
    {
      "method": "GET",
      "path": "/health",
      "summary": "Liveness",
      "response": { "status": 200, "json": { "status": "ok" } }
    },
    {
      "method": "POST",
      "path": "/v1/orders",
      "summary": "Create order",
      "response": {
        "status": 201,
        "json": { "id": "ord_123", "state": "pending" }
      }
    },
    {
      "method": "GET",
      "path": "/v1/orders/{id}",
      "summary": "Get order",
      "response": {
        "status": 200,
        "json": { "id": "ord_123", "state": "shipped" }
      }
    }
  ]
}
```

## Global use (optional)

To use this skill in **any** repository, copy the folder to `~/.cursor/skills/list-project-endpoints/` (same `SKILL.md` inside).
