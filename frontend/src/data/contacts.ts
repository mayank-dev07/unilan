import type { Contact, Message } from "../types";

export const contacts: Contact[] = [
  {
    id: "c1",
    name: "Riya Sharma",
    avatar: "https://i.pravatar.cc/120?img=47",
    lastSeen: "online",
    online: true,
    unread: 2,
  },
  {
    id: "c2",
    name: "Aman (Work)",
    avatar: "https://i.pravatar.cc/120?img=12",
    lastSeen: "last seen today at 3:55 PM",
  },
  {
    id: "c3",
    name: "Mom",
    avatar: "https://i.pravatar.cc/120?img=32",
    lastSeen: "last seen yesterday at 9:14 PM",
  },
  {
    id: "c4",
    name: "Design Team",
    avatar: "https://i.pravatar.cc/120?img=15",
    lastSeen: "5 members",
    unread: 4,
  },
  {
    id: "c5",
    name: "Dad",
    avatar: "https://i.pravatar.cc/120?img=68",
    lastSeen: "last seen Tue at 7:02 PM",
  },
  {
    id: "c6",
    name: "Saurabh",
    avatar: "https://i.pravatar.cc/120?img=51",
    lastSeen: "last seen Mon at 11:40 AM",
  },
  {
    id: "c7",
    name: "Trip 2026",
    avatar: "https://i.pravatar.cc/120?img=20",
    lastSeen: "8 members",
  },
  {
    id: "c8",
    name: "Pooja",
    avatar: "https://i.pravatar.cc/120?img=45",
    lastSeen: "online",
    online: true,
  },
];

export const messages: Message[] = [
  // Riya
  { id: "m1", contactId: "c1", text: "Hey! are you free tonight?", time: "4:10 PM", fromMe: false },
  { id: "m2", contactId: "c1", text: "yeah, around 8 works", time: "4:11 PM", fromMe: true, status: "read" },
  { id: "m3", contactId: "c1", text: "perfect, see you then 🎉", time: "4:12 PM", fromMe: false },
  { id: "m4", contactId: "c1", text: "should I book the table?", time: "4:12 PM", fromMe: false },

  // Aman
  { id: "m5", contactId: "c2", text: "did the deploy go through?", time: "3:50 PM", fromMe: false },
  { id: "m6", contactId: "c2", text: "yes, prod is green ✅", time: "3:54 PM", fromMe: true, status: "read" },
  { id: "m7", contactId: "c2", text: "on my way", time: "3:55 PM", fromMe: true, status: "delivered" },

  // Mom
  { id: "m8", contactId: "c3", text: "Beta, did you eat?", time: "9:00 PM", fromMe: false },
  { id: "m9", contactId: "c3", text: "haan maa, just had dinner", time: "9:10 PM", fromMe: true, status: "read" },
  { id: "m10", contactId: "c3", text: "Call me when you reach", time: "9:14 PM", fromMe: false },

  // Design team
  { id: "m11", contactId: "c4", text: "Karan: pushed the figma file", time: "Wed", fromMe: false },
  { id: "m12", contactId: "c4", text: "thanks, will review tonight", time: "Wed", fromMe: true, status: "read" },

  // Dad
  { id: "m13", contactId: "c5", text: "Sent you the docs over email", time: "Tue", fromMe: false },

  // Saurabh
  { id: "m14", contactId: "c6", text: "thanks for the help!", time: "Mon", fromMe: true, status: "sent" },

  // Trip 2026
  { id: "m15", contactId: "c7", text: "Pooja: booked the cab for 6am", time: "29/03", fromMe: false },

  // Pooja
  { id: "m16", contactId: "c8", text: "see you tomorrow!", time: "10:02 AM", fromMe: false },
];
