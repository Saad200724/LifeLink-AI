import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useUser } from "@/contexts/UserContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Brain, Send, User, Loader2 } from "lucide-react";
import type { TriageResponse } from "@shared/schema";
import { cn } from "@/lib/utils";
import { Bot, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
  timestamp: Date;
  urgencyScore?: number;
  medicalFlags?: string[];
  firstAid?: string[];
}

interface AIChatProps {
  messages?: Message[];
  onSendMessage?: (message: string) => void;
}

export default function AIChat({ messages: initialMessages, onSendMessage }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages || []);
  const [input, setInput] = useState("");
  const { user } = useUser();
  const isLoading = false; // Placeholder for actual loading state
  const messagesEndRef = null; // Placeholder for actual ref

  const triageMutation = useMutation({
    mutationFn: async (symptoms: string) => {
      const res = await apiRequest("POST", "/api/triage", { symptoms });
      return await res.json() as TriageResponse;
    },
    onSuccess: (data, symptoms) => {
      const firstAidText = data.first_aid?.join("\n• ") || "No specific first aid recommended";
      const flagsText = data.medical_flags?.length > 0
        ? `\n\n⚠️ Medical Flags: ${data.medical_flags.join(", ")}`
        : "";

      const aiResponse: Message = {
        id: Date.now().toString(),
        role: "ai",
        content: `${data.summary_for_rescue_en}\n\nFirst Aid:\n• ${firstAidText}${flagsText}`,
        timestamp: new Date(),
        urgencyScore: data.urgency_score,
        medicalFlags: data.medical_flags,
        firstAid: data.first_aid,
      };
      setMessages((prev) => [...prev, aiResponse]);
    },
    onError: () => {
      const errorResponse: Message = {
        id: Date.now().toString(),
        role: "ai",
        content: "I apologize, but I'm having trouble analyzing your symptoms right now. If this is an emergency, please call your local emergency number immediately (999).",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorResponse]);
    },
  });

  const handleSend = () => {
    if (!input.trim() || !user) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages([...messages, userMessage]);
    onSendMessage?.(input);
    const symptoms = input;
    setInput("");

    triageMutation.mutate(symptoms);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend();
  };


  return (
    <Card className="h-[600px] flex flex-col bg-gray-900/50 border-gray-800 backdrop-blur-sm shadow-xl">
      <CardHeader className="border-b border-gray-800">
        <CardTitle className="flex items-center gap-2 text-white">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <MessageSquare className="h-5 w-5 text-white" />
          </div>
          Chat with AI Doctor
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-3",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === "ai" && (
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center flex-shrink-0 border border-purple-500/30">
                    <Brain className="h-5 w-5 text-purple-400" />
                  </div>
                )}
                <div
                  className={cn(
                    "rounded-lg px-4 py-2 max-w-[80%]",
                    msg.role === "user"
                      ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                      : "bg-gray-800 text-gray-100 border border-gray-700"
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  {msg.urgencyScore !== undefined && (
                    <div className="mt-2">
                      <Badge variant="outline" className="text-xs">
                        Urgency: {msg.urgencyScore}/10
                      </Badge>
                    </div>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                    <User className="h-5 w-5 text-white" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center flex-shrink-0 border border-purple-500/30">
                  <Brain className="h-5 w-5 text-purple-400" />
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-gray-800 bg-gray-900/50">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe your symptoms..."
              disabled={triageMutation.isPending}
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-purple-500"
            />
            <Button
              onClick={handleSend}
              size="icon"
              className="h-[80px] bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
              disabled={triageMutation.isPending}
              data-testid="button-send-message"
            >
              {triageMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}