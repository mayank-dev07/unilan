import { useMemo } from "react";
import { useSubscription } from "urql";
import { useAuth } from "../auth/AuthContext";

const USERS_SUB = /* GraphQL */ `
  subscription Users {
    users(order_by: { username: asc }) {
      id
      username
      picture
      created_at
    }
  }
`;

export type DirectoryUser = {
  id: string;
  username: string;
  picture: string | null;
  created_at: string;
};

export function useUsers() {
  const { user, token } = useAuth();
  const [{ data, error, fetching }] = useSubscription<{ users: DirectoryUser[] }>(
    { query: USERS_SUB, pause: !user || !token },
  );

  const users = useMemo(
    () => (data?.users ?? []).filter((u) => u.id !== user?.id),
    [data, user?.id],
  );

  return { users, error: error?.message ?? null, loading: fetching };
}
