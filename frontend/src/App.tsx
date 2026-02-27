import { useCallback, useEffect, useRef, useState } from "react";

type Role = "user" | "assistant";
interface ChatMessage {
  role: Role;
  content: string;
}

interface ApiResponse {
  response: string;
}

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const sendMessage = useCallback(
    async (text?: string) => {
      const content = (text ?? input).trim();
      if (!content || loading) return;

      setErrorMsg(null);
      setLoading(true);

      const userMessage: ChatMessage = { role: "user", content };
      const nextMessages = [...messages, userMessage];
      setMessages(nextMessages);
      setInput("");

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: nextMessages }),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`API error (${res.status}): ${text}`);
        }

        const data = (await res.json()) as ApiResponse;

        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: data.response ?? "(No response)",
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "Unknown error calling /api/chat";
        setErrorMsg(msg);

        // Optional: append an assistant error message to the chat
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Sorry—something went wrong." },
        ]);
      } finally {
        setLoading(false);
        // Return focus to input for quick follow-up
        inputRef.current?.focus();
      }
    },
    [input, loading, messages],
  );

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>Virtual Mark</h1>
        <p style={styles.subtitle}>
          Ask about Mark’s experience, leadership, and projects.
        </p>
      </div>

      <div style={styles.chat} aria-live="polite" aria-busy={loading}>
        {messages.map((m, i) => (
          <MessageBubble key={i} role={m.role} content={m.content} />
        ))}
        <div ref={chatEndRef} />
      </div>

      <form
        style={styles.inputBar}
        onSubmit={(e) => {
          e.preventDefault();
          void sendMessage();
        }}
      >
        <input
          ref={inputRef}
          type="text"
          placeholder={loading ? "Waiting for reply…" : "Ask Virtual Mark…"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          aria-label="Type your question"
          style={styles.input}
        />
        <button
          type="submit"
          disabled={loading || input.trim().length === 0}
          style={styles.button}
        >
          {loading ? "Sending…" : "Send"}
        </button>
      </form>

      {errorMsg && (
        <div role="alert" style={styles.error}>
          {errorMsg}
        </div>
      )}
    </div>
  );
}

function MessageBubble(props: ChatMessage) {
  const isUser = props.role === "user";
  return (
    <div
      style={{
        ...styles.bubble,
        ...(isUser ? styles.userBubble : styles.assistantBubble),
      }}
    >
      <div style={styles.bubbleHeader}>
        <strong>{isUser ? "You" : "Mark"}</strong>
      </div>
      <div>{props.content}</div>
    </div>
  );
}

// --- quick inline styles for a clean starter UI ---
const styles: Record<string, React.CSSProperties> = {
  page: {
    margin: "0 auto",
    maxWidth: 900,
    padding: "24px 16px 32px",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
    color: "#0f172a",
    display: "flex",
    flexDirection: "column",
    minHeight: "100vh",
  },
  header: { marginBottom: 12 },
  title: { margin: 0, fontSize: 28 },
  subtitle: { marginTop: 4, color: "#334155" },
  chat: {
    flex: 1,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    padding: 16,
    overflowY: "auto",
  },
  bubble: {
    borderRadius: 10,
    padding: "10px 12px",
    marginBottom: 10,
    whiteSpace: "pre-wrap",
    lineHeight: 1.4,
    boxShadow: "0 1px 1px rgba(0,0,0,0.03)",
  },
  userBubble: {
    background: "#e2e8f0",
    alignSelf: "flex-end",
  },
  assistantBubble: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },
  bubbleHeader: {
    fontSize: 12,
    color: "#475569",
    marginBottom: 6,
  },
  inputBar: {
    display: "flex",
    gap: 8,
    marginTop: 12,
  },
  input: {
    flex: 1,
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    padding: "12px 14px",
    fontSize: 16,
    outline: "none",
  },
  button: {
    borderRadius: 8,
    padding: "0 16px",
    border: "1px solid #0ea5e9",
    background: "#0ea5e9",
    color: "white",
    fontWeight: 600,
    cursor: "pointer",
  },
  error: {
    marginTop: 10,
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    padding: "8px 12px",
    borderRadius: 8,
    fontSize: 14,
  },
};
