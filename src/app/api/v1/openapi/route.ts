import { NextResponse } from "next/server";

/** GET /api/v1/openapi – OpenAPI 3.0-dokumentation för API:t. */

const paginationParams = [
  { name: "page", in: "query", schema: { type: "integer", default: 1 } },
  { name: "per_page", in: "query", schema: { type: "integer", default: 25, maximum: 100 } },
];

const errorResponse = {
  description: "Fel",
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              details: {},
            },
          },
        },
      },
    },
  },
};

const spec = {
  openapi: "3.0.3",
  info: {
    title: "Östgöta El Teknik Fastighets-API",
    version: "1.0.0",
    description:
      "REST API för externa system (bokföring m.m.). Autentisering via API-nyckel som Bearer-token. " +
      "Muterande anrop stöder Idempotency-Key-header. Alla svar innehåller X-Request-Id och X-Correlation-Id.",
  },
  servers: [{ url: "/api/v1" }],
  components: {
    securitySchemes: {
      apiKey: { type: "http", scheme: "bearer", description: "API-nyckel som Bearer-token." },
    },
    parameters: {
      idempotencyKey: {
        name: "Idempotency-Key",
        in: "header",
        schema: { type: "string" },
        description: "Gör muterande anrop idempotenta. Samma nyckel + samma body ⇒ samma svar.",
      },
    },
  },
  security: [{ apiKey: [] }],
  paths: {
    "/customers": {
      get: {
        summary: "Lista kunder",
        parameters: [
          ...paginationParams,
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "email", in: "query", schema: { type: "string" } },
          { name: "external_id", in: "query", schema: { type: "string" } },
          { name: "updated_since", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "sort", in: "query", schema: { type: "string", enum: ["created_at", "-created_at", "last_name"] } },
        ],
        responses: { "200": { description: "Paginared lista av kunder" }, "401": errorResponse },
      },
      post: {
        summary: "Skapa kund (dubblettskyddad)",
        description:
          "Om external_system + external_customer_id eller e-post redan finns återanvänds den befintliga personen.",
        parameters: [{ $ref: "#/components/parameters/idempotencyKey" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["first_name", "last_name"],
                properties: {
                  first_name: { type: "string" },
                  last_name: { type: "string" },
                  email: { type: "string", format: "email" },
                  phone: { type: "string" },
                  external_system: { type: "string" },
                  external_customer_id: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Skapad" }, "200": { description: "Befintlig återanvänd" }, "422": errorResponse },
      },
    },
    "/customers/{id}": {
      get: {
        summary: "Hämta kund",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Kund" }, "404": errorResponse },
      },
      patch: {
        summary: "Uppdatera kund",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Uppdaterad" }, "404": errorResponse },
      },
    },
    "/tenants": {
      get: {
        summary: "Lista hyresgäster",
        parameters: [...paginationParams, { name: "active", in: "query", schema: { type: "boolean" } }],
        responses: { "200": { description: "Paginared lista" } },
      },
    },
    "/invoices": {
      get: {
        summary: "Lista fakturor",
        parameters: [
          ...paginationParams,
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "person_id", in: "query", schema: { type: "string" } },
          { name: "contract_id", in: "query", schema: { type: "string" } },
          { name: "due_from", in: "query", schema: { type: "string", format: "date" } },
          { name: "due_to", in: "query", schema: { type: "string", format: "date" } },
        ],
        responses: { "200": { description: "Paginared lista" } },
      },
    },
    "/invoices/{id}": {
      get: {
        summary: "Hämta faktura med rader",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Faktura" }, "404": errorResponse },
      },
    },
    "/invoices/sync": {
      post: {
        summary: "Pusha fakturor från bokföringssystem (idempotent)",
        description:
          "Fakturor identifieras med (external_system, external_id). Befintliga uppdateras, nya skapas. " +
          "Fakturor utan matchad kund hamnar i granskningskön. Dubbletter skapas aldrig.",
        parameters: [{ $ref: "#/components/parameters/idempotencyKey" }],
        responses: { "200": { description: "Resultat per faktura" }, "422": errorResponse },
      },
    },
    "/payments": {
      get: { summary: "Lista betalningar", parameters: paginationParams, responses: { "200": { description: "Lista" } } },
    },
    "/payments/sync": {
      post: {
        summary: "Pusha betalningar (idempotent per externt betalnings-ID)",
        parameters: [{ $ref: "#/components/parameters/idempotencyKey" }],
        responses: { "200": { description: "Resultat per betalning" } },
      },
    },
    "/contracts": {
      get: {
        summary: "Lista avtal",
        parameters: [
          ...paginationParams,
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "unit_id", in: "query", schema: { type: "string" } },
          { name: "person_id", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "Lista" } },
      },
    },
    "/units": {
      get: {
        summary: "Lista objekt",
        parameters: [
          ...paginationParams,
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "type", in: "query", schema: { type: "string" } },
          { name: "city", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "Lista" } },
      },
    },
    "/properties": { get: { summary: "Lista fastigheter", parameters: paginationParams, responses: { "200": { description: "Lista" } } } },
    "/buildings": { get: { summary: "Lista byggnader", parameters: paginationParams, responses: { "200": { description: "Lista" } } } },
    "/listings": { get: { summary: "Lista annonser", parameters: paginationParams, responses: { "200": { description: "Lista" } } } },
    "/applications": { get: { summary: "Lista ansökningar", parameters: paginationParams, responses: { "200": { description: "Lista" } } } },
    "/maintenance-requests": {
      get: { summary: "Lista felanmälningar", parameters: paginationParams, responses: { "200": { description: "Lista" } } },
      post: {
        summary: "Skapa felanmälan",
        parameters: [{ $ref: "#/components/parameters/idempotencyKey" }],
        responses: { "201": { description: "Skapad" } },
      },
    },
    "/webhook-subscriptions": {
      get: { summary: "Lista webhook-prenumerationer", responses: { "200": { description: "Lista" } } },
      post: {
        summary: "Skapa webhook-prenumeration",
        description: "Svaret innehåller `secret` (visas endast en gång) för HMAC-verifiering av leveranser.",
        responses: { "201": { description: "Skapad" } },
      },
    },
    "/webhook-subscriptions/{id}": {
      delete: {
        summary: "Ta bort webhook-prenumeration",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Borttagen" }, "404": errorResponse },
      },
    },
  },
};

export async function GET() {
  return NextResponse.json(spec);
}
