export const minimalValidRegistryJson = `{
  "version": "1.0",
  "environments": {
    "dev": "http://localhost:3000",
    "staging": "https://staging.example.com"
  },
  "services": [
    {
      "id": "payments",
      "team": "Billing",
      "base_path": "/api/v1",
      "status": "stable",
      "endpoints": [
        {
          "id": "list-payments",
          "method": "GET",
          "path": "/payments"
        },
        {
          "id": "get-payment",
          "method": "GET",
          "path": "/payments/:id"
        }
      ]
    }
  ]
}`;

export const duplicateEndpointIdsJson = `{
  "version": "1.0",
  "environments": { "dev": "http://localhost" },
  "services": [
    {
      "id": "svc",
      "team": "T",
      "base_path": "/a",
      "status": "stable",
      "endpoints": [
        { "id": "dup", "method": "GET", "path": "/one" },
        { "id": "dup", "method": "GET", "path": "/two" }
      ]
    }
  ]
}`;

export const badEndpointSkippedJson = `{
  "version": "1.0",
  "environments": { "dev": "http://localhost" },
  "services": [
    {
      "id": "svc",
      "team": "T",
      "base_path": "/a",
      "status": "stable",
      "endpoints": [
        { "id": "ok", "method": "GET", "path": "/ok" },
        { "id": "bad-method", "method": "BOGUS", "path": "/x" },
        { "id": "bad-path", "method": "GET", "path": "no-leading-slash" }
      ]
    }
  ]
}`;

export const twoServicesSpecificityJson = `{
  "version": "1.0",
  "environments": { "dev": "http://localhost" },
  "services": [
    {
      "id": "api",
      "team": "T",
      "base_path": "/v1",
      "status": "stable",
      "endpoints": [
        { "id": "wild", "method": "GET", "path": "/users/:id" },
        { "id": "literal", "method": "GET", "path": "/users/me" }
      ]
    }
  ]
}`;
