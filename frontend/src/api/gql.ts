import {
  Client,
  cacheExchange,
  fetchExchange,
  subscriptionExchange,
} from "urql";
import { createClient as createWSClient } from "graphql-ws";

const HTTP_URL = import.meta.env.VITE_HASURA_URL ?? "";
const WS_URL = import.meta.env.VITE_HASURA_WS_URL ?? "";

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

export const gqlClient = new Client({
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
