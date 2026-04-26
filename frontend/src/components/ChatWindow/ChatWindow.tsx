import type { Contact, Message } from "../../types";
import ChatHeader from "./ChatHeader";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import TypingIndicator from "./TypingIndicator";

type Props = {
  contact: Contact;
  messages: Message[];
  onSend: (text: string) => void;
  onTyping?: (typing: boolean) => void;
  typingUsers?: string[];
  onBack?: () => void;
};

export default function ChatWindow({ contact, messages, onSend, onTyping, typingUsers = [], onBack }: Props) {
  return (
    <main className="flex-1 flex flex-col min-w-0 chat-bg">
      <ChatHeader contact={contact} onBack={onBack} />
      <MessageList messages={messages} />
      <TypingIndicator usernames={typingUsers} />
      <MessageInput onSend={onSend} onTyping={onTyping} />
    </main>
  );
}
