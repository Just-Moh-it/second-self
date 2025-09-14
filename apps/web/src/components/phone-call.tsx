import { useEffect, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type Message = {
  id: number;
  content: string;
  sender: "user" | "assistant";
};

export function PhoneCall() {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    const newMessages = [
      { id: 1, content: "Hello, how are you?", sender: "user" },
      { id: 2, content: "I'm good, thank you!", sender: "assistant" },
    ];

    const interval = setInterval(() => {
      setMessages(
        (prevMessages) => [...prevMessages, ...newMessages] as Message[]
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <Accordion type="single" collapsible defaultValue="phone-call">
        <AccordionItem value="phone-call">
          <AccordionTrigger className="group">
            <div className="flex gap-2">
              <button className="px-3 py-1.5 rounded-md text-sm border border-gray-200 bg-white">
                Disconnect call
              </button>
              <button className="px-3 py-1.5 rounded-md text-sm border border-emerald-200 bg-emerald-50 text-emerald-700">
                Take over
              </button>
            </div>
          </AccordionTrigger>

          <AccordionContent className="group">
            <div className="flex flex-col gap-2">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`${message.sender === "user" ? "bg-gray-200" : "bg-gray-100"} p-2 rounded-md`}
                >
                  {message.content}
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </>
  );
}
