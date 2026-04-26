import {
  Client,
  cacheExchange,
  fetchExchange,
  subscriptionExchange,
} from "urql";
import { createClient as createWSClient } from "graphql-ws";

// Hasura endpoints. When unset, fall back to a clearly-bogus URL so urql's
// constructor doesn't throw at module load. The subscription will fail to
// connect and useChat will surface the error, but the app stays renderable.
const HTTP_URL = import.meta.env.VITE_HASURA_URL || "http://localhost:9999/_unconfigured";
const WS_URL = import.meta.env.VITE_HASURA_WS_URL || "";

export const gqlConfigured = !!import.meta.env.VITE_HASURA_URL;

let currentToken: string | null = null;
export function setGqlToken(t: string | null) {
  currentToken = t;
}

const wsClient = WS_URL
  ? createWSClient({
      url: WS_URL,
      // graphql-ws's connectionParams runs on every (re)connect, so the latest
      // token from `setGqlToken` is always used.
      connectionParams: () => ({
        headers: currentToken
          ? { Authorization: `Bearer ${currentToken}` }
          : {},
      }),
      // Reconnect with backoff on token swap / network drop.
      shouldRetry: () => true,
      retryAttempts: 10,
    })
  : null;

export const gqlClient: Client = new Client({
  url: HTTP_URL,
  exchanges: [
    cacheExchange,
    ...(wsClient
      ? [
          subscriptionExchange({
            forwardSubscription(operation) {
              return {
                subscribe: (sink) => {
                  const dispose = wsClient.subscribe(
                    {
                      ...operation,
                      query: operation.query ?? "",
                    },
                    sink,
                  );
                  return { unsubscribe: dispose };
                },
              };
            },
          }),
        ]
      : []),
    fetchExchange,
  ],
  fetchOptions: () => {
    const headers: Record<string, string> = {};
    if (currentToken) headers.Authorization = `Bearer ${currentToken}`;
    return { headers };
  },
});
