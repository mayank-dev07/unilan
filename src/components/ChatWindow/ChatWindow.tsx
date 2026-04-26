import type { Contact, Message } from "../../types";
import ChatHeader from "./ChatHeader";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import Threads from "../reactbits/Threads";

type Props = {
  contact: Contact;
  messages: Message[];
  onSend: (text: string) => void;
};

export default function ChatWindow({ contact, messages, onSend }: Props) {
  return (
    <main className="relative flex-1 flex flex-col min-w-0 overflow-hidden">
      <div className="absolute inset-0 z-0">
        <Threads amplitude={1} distance={0} enableMouseInteraction />
      </div>
      <div className="relative z-10 flex flex-col h-full">
        <ChatHeader contact={contact} />
        <MessageList messages={messages} />
        <MessageInput onSend={onSend} />
      </div>
    </main>
  );
}
