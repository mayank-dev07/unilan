import type { Contact, Message } from "../../types";
import ChatHeader from "./ChatHeader";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";

type Props = {
  contact: Contact;
  messages: Message[];
  onSend: (text: string) => void;
};

export default function ChatWindow({ contact, messages, onSend }: Props) {
  return (
    <main className="flex-1 flex flex-col min-w-0 paper-grid">
      <ChatHeader contact={contact} />
      <MessageList messages={messages} />
      <MessageInput onSend={onSend} />
    </main>
  );
}
