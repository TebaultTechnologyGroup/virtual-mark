import { useCallback, useEffect, useRef, useState } from "react";

// Use the filename of your uploaded photo
const markPhoto = "/public/mark_tebault.png";

type Role = "user" | "assistant";
interface ChatMessage {
  role: Role;
  content: string;
}

interface ApiResponse {
  response: string;
}

const bio = `
  Senior operations, delivery, and program leader with 20+ years of experience driving 
  operational efficiency and enterprise delivery across SaaS and technology environments. 
  Expert in scaling PMOs, unifying workflows, and leading cross-functional teams to 
  deliver predictable outcomes.
`;

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Handle responsiveness
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.response ?? "(No response)" },
        ]);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Unknown error");
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Sorry—something went wrong." },
        ]);
      } finally {
        setLoading(false);
        inputRef.current?.focus();
      }
    },
    [input, loading, messages],
  );

  return (
    <div style={styles.page}>
      <div
        style={{
          ...styles.container,
          flexDirection: isMobile ? "column" : "row",
          height: isMobile ? "auto" : "85vh",
          margin: isMobile ? "10px" : "0",
        }}
      >
        {/* Left Side: Profile & Bio */}
        <div
          style={{
            ...styles.profilePanel,
            flex: isMobile ? "none" : "0 0 350px",
            borderRight: isMobile ? "none" : "1px solid #e2e8f0",
            borderBottom: isMobile ? "1px solid #e2e8f0" : "none",
          }}
        >
          <img src={markPhoto} alt="Mark Tebault" style={styles.profileImage} />
          <h1 style={styles.title}>Mark Tebault</h1>
          <p style={styles.subtitle}>Senior Operations & Program Leader</p>
          <div style={styles.bio}>
            <p>{bio}</p>
          </div>
          <a
            href="mailto:mark_tebault@bellsouth.net"
            style={styles.contactButton}
          >
            Contact Mark
          </a>
        </div>

        {/* Right Side: Chat Interface */}
        <div style={styles.chatPanel}>
          <div style={styles.chatHeader}>
            <h2 style={styles.chatTitle}>Virtual Interview</h2>
            <p style={styles.chatSubtitle}>
              Ask about Mark’s experience, leadership, and projects.
            </p>
          </div>

          <div style={styles.chat} aria-live="polite">
            {messages.length === 0 && (
              <div style={styles.welcomeMessage}>
                👋 Hello! I'm "Virtual Mark." Ask me anything about my
                professional background.
              </div>
            )}
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
              placeholder={loading ? "Thinking..." : "Type your question..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              style={styles.input}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              style={styles.button}
            >
              {loading ? "..." : "Ask"}
            </button>
          </form>

          {errorMsg && <div style={styles.error}>{errorMsg}</div>}
        </div>
      </div>
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
        <strong>{isUser ? "You" : "Virtual Mark"}</strong>
      </div>
      <div style={{ whiteSpace: "pre-wrap" }}>{props.content}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    minWidth: "100vw",
    background: "#f1f5f9",
    fontFamily: "Inter, system-ui, sans-serif",
    margin: 0,
  },
  container: {
    display: "flex",
    width: "100%",
    maxWidth: "1100px",
    background: "#ffffff",
    borderRadius: "16px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
    overflow: "hidden",
  },
  profilePanel: {
    padding: "40px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    background: "#ffffff",
  },
  profileImage: {
    width: "140px",
    height: "140px",
    borderRadius: "50%",
    objectFit: "cover",
    marginBottom: "20px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
  },
  title: {
    fontSize: "28px",
    fontWeight: 800,
    margin: "0 0 8px 0",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: "16px",
    color: "#64748b",
    margin: "0 0 24px 0",
    fontWeight: 500,
  },
  bio: {
    fontSize: "14px",
    color: "#475569",
    lineHeight: 1.6,
    textAlign: "left",
  },
  contactButton: {
    marginTop: "24px",
    padding: "12px 24px",
    background: "#0f172a",
    color: "#ffffff",
    textDecoration: "none",
    borderRadius: "8px",
    fontWeight: 600,
  },
  chatPanel: {
    flex: 1,
    padding: "32px",
    display: "flex",
    flexDirection: "column",
    background: "#f8fafc",
  },
  chatHeader: {
    marginBottom: "20px",
    borderBottom: "1px solid #e2e8f0",
    paddingBottom: "10px",
  },
  chatTitle: { fontSize: "20px", fontWeight: 700, margin: 0 },
  chatSubtitle: { fontSize: "14px", color: "#64748b" },
  chat: {
    flex: 1,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  welcomeMessage: {
    textAlign: "center",
    color: "#94a3b8",
    fontSize: "15px",
    marginTop: "40px",
  },
  bubble: {
    maxWidth: "80%",
    borderRadius: "12px",
    padding: "12px 16px",
    fontSize: "15px",
  },
  userBubble: {
    background: "#3b82f6",
    color: "#ffffff",
    alignSelf: "flex-end",
  },
  assistantBubble: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    alignSelf: "flex-start",
    color: "#1e293b",
  },
  bubbleHeader: { fontSize: "12px", opacity: 0.7, marginBottom: "4px" },
  inputBar: { display: "flex", gap: "10px", marginTop: "20px" },
  input: {
    flex: 1,
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    outline: "none",
  },
  button: {
    padding: "0 24px",
    background: "#3b82f6",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: 600,
  },
  error: {
    marginTop: "10px",
    color: "#ef4444",
    fontSize: "14px",
    textAlign: "center",
  },
};
