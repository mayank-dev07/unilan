export type Message = {
  id: string;
  contactId: string; // conversation_id
  text: string;       // primary display (UNI LAN once we wire backend)
  time: string;
  fromMe: boolean;
  status?: "sent" | "delivered" | "read";

  // backend-sourced fields (optional so seed data still type-checks during dev)
  unilan?: string;
  display?: string;     // text in viewer's language (their script)
  original?: string;    // sender's raw text
  senderUsername?: string;
  senderLang?: string;
  viewerLang?: string;

  // optional Cloudinary media on this message
  mediaUrl?: string;
  mediaType?: "image" | "video";
};

export type Contact = {
  id: string;          // conversation_id
  name: string;        // other user's username for 1-1 chats
  avatar?: string | null;  // URL of uploaded picture, if any (else letter avatar)
  lastSeen: string;
  online?: boolean;
  unread?: number;
};
