import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";

const POSITION_KEY = "chatbot_panel_position";
const SIZE_KEY = "chatbot_panel_size";

const SUGGESTED_QUESTIONS = [
  "Summarize this chart for me.",
  "Is there a buy/sell signal right now?",
  "Explain the meaning of EMA 20.",
  "What is a gap up and why does it matter?",
  "Describe current support/resistance levels.",
  "What does the RSI say about this stock?",
];

export default function ChatbotPanel({
  user,
  open,
  setOpen,
  symbol,
  indicatorValues,
  selectedTime,
  selectedIndicators,
  credits,
  setCredits,
  botName,
  onOutOfCredits,
}) {
  // Declare hooks upfront
  const defaultWelcomeMsg = {
    role: "assistant",
    content:
      "Hi! Ask me anything about stocks, indicators, this chart, or finance concepts. I'm Maven.",
    timestamp: new Date().toISOString(),
  };

  const storageKey = user ? `chatbot_panel_history_${user.uid}` : "chatbot_panel_history_guest";

  const [messages, setMessages] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      return Array.isArray(saved) && saved.length ? saved : [defaultWelcomeMsg];
    } catch {
      return [defaultWelcomeMsg];
    }
  });

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [panelPos, setPanelPos] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(POSITION_KEY));
      return saved || { x: window.innerWidth - 420, y: window.innerHeight - 480 };
    } catch {
      return { x: window.innerWidth - 420, y: window.innerHeight - 480 };
    }
  });

  const [panelSize, setPanelSize] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SIZE_KEY));
      return saved || { width: 380, height: 430 };
    } catch {
      return { width: 380, height: 430 };
    }
  });

  const dragging = useRef(false);
  const resizing = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef(null);
  const chatEndRef = useRef(null);

  // Drag start handler
  const onDragStart = (e) => {
    dragging.current = true;
    dragOffset.current = {
      x: e.clientX - panelPos.x,
      y: e.clientY - panelPos.y,
    };
    document.body.style.userSelect = "none";
  };

  // Mouse move handler for drag or resize
  const onMouseMove = (e) => {
    if (dragging.current) {
      setPanelPos({
        x: Math.max(
          10,
          Math.min(e.clientX - dragOffset.current.x, window.innerWidth - panelSize.width - 10)
        ),
        y: Math.max(
          10,
          Math.min(e.clientY - dragOffset.current.y, window.innerHeight - 60)
        ),
      });
    }
    if (resizing.current) {
      const panelRect = panelRef.current.getBoundingClientRect();
      setPanelSize({
        width: Math.max(
          280,
          Math.min(e.clientX - panelRect.left, window.innerWidth - panelPos.x - 20)
        ),
        height: Math.max(
          350,
          Math.min(e.clientY - panelRect.top, window.innerHeight - panelPos.y - 20)
        ),
      });
    }
  };

  // Drag or resize end handler
  const onDragEnd = () => {
    if (dragging.current || resizing.current) {
      localStorage.setItem(POSITION_KEY, JSON.stringify(panelPos));
      localStorage.setItem(SIZE_KEY, JSON.stringify(panelSize));
    }
    dragging.current = false;
    resizing.current = false;
    document.body.style.userSelect = "";
  };

  // Resize start handler
  const onResizeStart = () => {
    resizing.current = true;
    document.body.style.userSelect = "none";
  };

  // Setup event listeners for drag and resize
  useEffect(() => {
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onDragEnd);

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onDragEnd);
    };
  });

  // Scroll to bottom on new messages or loading
  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Save chat history when messages change
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(messages.slice(-30)));
  }, [messages, storageKey]);

  // Clear chat history handler
  const clearChatHistory = () => {
    setMessages([{ ...defaultWelcomeMsg, timestamp: new Date().toISOString() }]);
    localStorage.removeItem(storageKey);
  };

  // Format timestamp as hh:mm
  const fmtTime = (iso) =>
    iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

  // Send chat message handler
  const sendMessage = async () => {
    if (!input.trim()) return;
    setLoading(true);

    const newMsg = { role: "user", content: input, timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, newMsg]);
    setInput("");

    try {
      // Replace with your deployed backend URL
      const res = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: input,
          symbol: symbol || "",
          indicator_values: indicatorValues || {},
          time_period: selectedTime || {},
          selected_indicators: selectedIndicators || [],
          uid: user?.uid || null,
        }),
      });
      const data = await res.json();
      // Append assistant response
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response, timestamp: new Date().toISOString() },
      ]);

      // Update credits dynamically
    if (typeof data.credits === "number") {
      setCredits(data.credits);
    }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, there was a problem contacting the AI assistant.",
          timestamp: new Date().toISOString(),
        },
      ]);
    }

    setLoading(false);
  };

  // Input key down handler (Shift+Enter for newline, Enter to send)
  const handleInputKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!loading) sendMessage();
    }
  };

  // Insert suggested question into input
  const insertSuggestion = (q) => setInput(q);

  // Render minimized button if chatbot is closed
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: "fixed",
          bottom: 28,
          right: 28,
          zIndex: 1001,
          background: "#3557d5",
          color: "#fff",
          border: "none",
          borderRadius: "50%",
          width: 62,
          height: 62,
          boxShadow: "0 2px 14px #3557d580",
          fontSize: 32,
          cursor: "pointer",
        }}
        title="Open Chat"
      >
        💬
      </button>
    );
  }

  // Render full chatbot panel
  return (
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        left: panelPos.x,
        top: panelPos.y,
        width: panelSize.width,
        height: panelSize.height,
        background: "#fff",
        border: "1.8px solid #bfc7d5",
        borderRadius: 14,
        boxShadow: "0 2px 16px #0002",
        zIndex: 1000,
        fontFamily: "sans-serif",
        display: "flex",
        flexDirection: "column",
        minWidth: 280,
        minHeight: 350,
        maxWidth: "99vw",
        maxHeight: "97vh",
        overflow: "hidden",
        transition: "box-shadow .13s",
      }}
    >
      {/* Header with drag handle, clear, minimize buttons */}
      <div
        style={{
          background: "#f6f8fc",
          cursor: "move",
          height: 35,
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 13px",
          fontWeight: 600,
          display: "flex",
          borderTopLeftRadius: 13,
          borderTopRightRadius: 13,
          userSelect: "none",
          borderBottom: "1px solid #e5e8ee",
          minHeight: 35,
        }}
        onMouseDown={onDragStart}
      >
        <span>
          <span role="img" aria-label="bot" style={{ fontSize: 17, marginRight: 8 }}>
            🤖
          </span>
          Maven AI Assistant
        </span>
        <span style={{ display: "flex", alignItems: "center" }}>
          <button
            onClick={clearChatHistory}
            style={{
              background: "transparent",
              border: "none",
              color: "#888",
              cursor: "pointer",
              fontSize: 14,
              padding: "2px 8px",
              borderRadius: 6,
              marginRight: 10,
              transition: "background-color 0.2s",
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#ebecf0")}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            title="Clear Chat History"
          >
            Clear Chat
          </button>
          <button
            onClick={() => setOpen(false)}
            style={{
              background: "transparent",
              border: "none",
              color: "#888",
              cursor: "pointer",
              fontSize: 21,
              fontWeight: "bold",
            }}
            title="Minimize Chat"
          >
            &minus;
          </button>
        </span>
      </div>

      {/* Messages area */}
      <div
        style={{ flex: 1, padding: 12, overflowY: "auto", background: "#fcfcfc" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              margin: "12px 0",
              display: "flex",
              flexDirection: msg.role === "user" ? "row-reverse" : "row",
              alignItems: "flex-end",
            }}
          >
            <div
              style={{
                background: msg.role === "assistant" ? "#f0f7fc" : "#ddf1cf",
                color: "#222",
                borderRadius: 12,
                padding: "10px 14px",
                maxWidth: 270,
                wordBreak: "break-word",
                boxShadow: "0 2px 6px #0001",
              }}
            >
              <strong style={{ color: "#4C489D", fontSize: 12 }}>
                {msg.role === "assistant" ? "AI" : "You"}
              </strong>
              <ReactMarkdown>{msg.content}</ReactMarkdown>
              <div style={{ textAlign: "right", fontSize: 11, color: "#888" }}>
                {fmtTime(msg.timestamp)}
              </div>
            </div>
          </div>
        ))}
        {loading && <div style={{ color: "#888", fontStyle: "italic" }}>AI is typing...</div>}
        <div ref={chatEndRef} />
      </div>

      {/* Suggested questions */}
      <div
        style={{
          padding: "4px 14px 0 14px",
          display: "flex",
          flexWrap: "wrap",
          gap: 7,
        }}
      >
        {SUGGESTED_QUESTIONS.map((q, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => insertSuggestion(q)}
            style={{
              background: "#eee",
              border: "none",
              borderRadius: 8,
              padding: "3px 10px",
              marginBottom: 3,
              color: "#333",
              fontSize: 13,
              cursor: "pointer",
            }}
            disabled={!!input}
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input area with resizing handle */}
      <div
        style={{
          display: "flex",
          borderTop: "1px solid #eee",
          padding: 10,
          background: "#fafbfc",
          position: "relative",
        }}
      >
        <textarea
          style={{
            flex: 1,
            border: "1px solid #ccc",
            borderRadius: 8,
            padding: 7,
            fontSize: 14,
            minHeight: 36,
            resize: "none",
            cursor: loading ? "not-allowed" : "text",
          }}
          value={input}
          disabled={loading}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="Ask about this stock or chart... (Shift+Enter for new line)"
        />
        <button
          onClick={sendMessage}
          style={{
            marginLeft: 7,
            padding: "8px 14px",
            fontSize: 15,
            background: "#5e73c0",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: loading || !input.trim() ? "not-allowed" : "pointer",
            fontWeight: "bold",
            height: 44,
          }}
          disabled={loading || !input.trim()}
        >
          Send
        </button>

        {/* Resize handle (bottom right corner) */}
        <div
          onMouseDown={onResizeStart}
          style={{
            width: 18,
            height: 18,
            position: "absolute",
            bottom: 4,
            right: 3,
            cursor: "nwse-resize",
            background:
              "linear-gradient(135deg, transparent 55%, #bfc7d5 60%, #bfc7d5 85%, transparent 90%)",
            borderRadius: 4,
            zIndex: 20,
            opacity: 0.5,
          }}
          title="Resize"
        />
      </div>
    </div>
  );
}