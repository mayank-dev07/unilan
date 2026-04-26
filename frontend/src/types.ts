export type Message = {
  id: string;
  contactId: string;
  text: string;
  time: string;
  fromMe: boolean;
  status?: "sent" | "delivered" | "read";
};

export type Contact = {
  id: string;
  name: string;
  avatar: string;
  lastSeen: string;
  online?: boolean;
  unread?: number;
};
