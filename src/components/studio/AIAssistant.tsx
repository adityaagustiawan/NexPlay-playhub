// AIAssistant.tsx — BlenderGPT-inspired AI assistant panel for NexPlay Studio.
// Provides a chat interface that can generate code, suggest changes, or answer
// questions about the game. Works with OpenAI-compatible APIs (including free
// endpoints).
import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, Send, Trash2 } from "lucide-react";

export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface Props {
  config: any;
  onApplyCode?: (code: string) => void;
}

export function AIAssistant({ config, onApplyCode }: Props) {
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      role: "assistant",
      content:
        "Hi! I'm your Blender-style AI assistant. I can help you create, modify, and debug your game. Tell me what you'd like to do - for example, 'add 5 more collectibles' or 'make the player faster'.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("nexstudio_ai_key") || "");
  const [apiBase, setApiBase] = useState(() => localStorage.getItem("nexstudio_ai_base") || "https://api.openai.com/v1");
  const [model, setModel] = useState(() => localStorage.getItem("nexstudio_ai_model") || "gpt-3.5-turbo");
  const [mode, setMode] = useState<"chat" | "generate" | "edit">("generate");
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    localStorage.setItem("nexstudio_ai_key", apiKey);
    localStorage.setItem("nexstudio_ai_base", apiBase);
    localStorage.setItem("nexstudio_ai_model", model);
  }, [apiKey, apiBase, model]);

  const systemPrompt = `You are an AI assistant for NexPlay Studio, a Blender-style 2D/3D game editor.
Your job is to help the user create, modify, and describe game objects and scenes by generating Python-like or executable instructions, but also respond clearly in natural language.
${mode === "generate" ? "- Focus on generating objects/scenes based on description. Be concrete and actionable." : mode === "edit" ? "- Focus on editing/modifying existing elements." : "- General chat about the editor and game design."}

Current game config: ${JSON.stringify(config, null, 2)}

Respond in clear markdown. When you generate code to modify the scene, wrap it in \`\`\`javascript\`\`\` or \`\`\`typescript\`\`\` so it can be applied.`;

  const welcomeMsg =
    mode === "generate"
      ? "Describe what you want to create (e.g., 'create a spinning cube', 'make a 2D platformer level')."
      : mode === "edit"
      ? "Tell me what to change (e.g., 'make player faster', 'add more collectibles')."
      : "Ask anything about NexPlay Studio or your game.";

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user" as const, content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch(`${apiBase}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            ...messages.slice(-10), // Keep last 10 messages for context
            userMsg,
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const assistantMsg = {
        role: "assistant" as const,
        content: data.choices?.[0]?.message?.content || "I couldn't generate a response.",
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      console.error("AI error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${error instanceof Error ? error.message : "Failed to get response"}. You can try using a free API endpoint or check your settings.`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([{ role: "assistant", content: welcomeMsg }]);
  };

  const extractCode = (content: string) => {
    const codeBlockRegex = /```(?:javascript|typescript|js|ts)\n?([\s\S]*?)```/;
    const match = content.match(codeBlockRegex);
    return match ? match[1].trim() : null;
  };

  const handleApplyCode = (content: string) => {
    const code = extractCode(content);
    if (code && onApplyCode) {
      onApplyCode(code);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#282828] text-[11px] text-[#d0d0d0]">
      <div className="flex h-7 shrink-0 items-center justify-between border-b border-[#1d1d1d] bg-[#303030] px-3">
        <div className="flex items-center gap-2">
          <Bot className="h-3.5 w-3.5" />
          <span className="font-heading uppercase tracking-wide text-[#b8b8b8]">AI Assistant</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-1 rounded-[3px] border border-[#4a4a4a] bg-[#1d1d1d] p-0.5">
            {["generate", "edit", "chat"].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m as any)}
                className={`rounded-[2px] px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${
                  mode === m ? "bg-[#4772b3] text-white" : "text-[#b0b0b0] hover:bg-[#3a3a3a]"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="rounded-[3px] px-1.5 py-0.5 text-[10px] text-[#b0b0b0] hover:bg-[#3a3a3a]"
          >
            Settings
          </button>
          <button
            type="button"
            onClick={clearChat}
            className="rounded-[3px] p-1 text-[#b0b0b0] hover:bg-[#3a3a3a]"
            title="Clear chat"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="flex flex-col gap-1.5 border-b border-[#1d1d1d] bg-[#2b2b2b] p-2">
          <div>
            <div className="mb-0.5 text-[10px] uppercase text-[#8f8f8f]">API Base URL</div>
            <input
              value={apiBase}
              onChange={(e) => setApiBase(e.target.value)}
              placeholder="https://api.openai.com/v1 or free endpoint"
              className="h-6 w-full rounded-[3px] border border-[#4a4a4a] bg-[#1d1d1d] px-1.5 text-[11px] outline-none focus:border-[#4772b3]"
            />
          </div>
          <div>
            <div className="mb-0.5 text-[10px] uppercase text-[#8f8f8f]">Model</div>
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="gpt-3.5-turbo, llama-3.1-8b-instant, etc."
              className="h-6 w-full rounded-[3px] border border-[#4a4a4a] bg-[#1d1d1d] px-1.5 text-[11px] outline-none focus:border-[#4772b3]"
            />
          </div>
          <div>
            <div className="mb-0.5 text-[10px] uppercase text-[#8f8f8f]">API Key (optional for some free endpoints)</div>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="h-6 w-full rounded-[3px] border border-[#4a4a4a] bg-[#1d1d1d] px-1.5 text-[11px] outline-none focus:border-[#4772b3]"
            />
          </div>
          <div className="text-[10px] text-[#8f8f8f]">
            Tip: Try free endpoints like Groq (api.groq.com/v1), Cerebras (api.cerebras.ai/v1), or OpenRouter (openrouter.ai/api/v1)
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <div className="flex flex-col gap-2">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-[4px] px-2 py-1.5 ${
                  msg.role === "user"
                    ? "bg-[#4772b3] text-white"
                    : "bg-[#3a3a3a] text-[#d0d0d0]"
                }`}
              >
                <div className="text-[11px] leading-relaxed">
                  {msg.content}
                </div>
                {msg.role === "assistant" && extractCode(msg.content) && (
                  <button
                    type="button"
                    onClick={() => handleApplyCode(msg.content)}
                    className="mt-1.5 rounded-[3px] bg-[#2b2b2b] px-1.5 py-0.5 text-[10px] hover:bg-[#1d1d1d]"
                  >
                    Apply Code
                  </button>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-[4px] bg-[#3a3a3a] px-2 py-1.5 text-[#d0d0d0]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="flex gap-1 border-t border-[#1d1d1d] bg-[#2b2b2b] p-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Ask AI to help with your game..."
          disabled={loading}
          className="h-7 flex-1 rounded-[3px] border border-[#4a4a4a] bg-[#1d1d1d] px-2 text-[11px] outline-none focus:border-[#4772b3] disabled:opacity-50"
        />
        <button
          type="button"
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="flex h-7 w-7 items-center justify-center rounded-[3px] bg-[#4772b3] text-white hover:bg-[#5a85c6] disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
