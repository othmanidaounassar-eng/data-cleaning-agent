"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bot,
  Send,
  Trash2,
  Loader2,
  Plus,
  Menu,
  X,
  Pencil,
  Check,
} from "lucide-react";
import { API_ENDPOINTS } from "@/lib/api";
import {
  ChatContext,
  ChatMessage,
  loadChatContext,
  suggestedPrompts,
} from "@/lib/chat";
import { useAppSettings } from "@/components/providers/app-providers";
import { authHeaders } from "@/lib/auth";

type SessionSummary = {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
};

// All API traffic goes through the same-origin /api proxy routes (see
// lib/api.ts); keep them consistent so chat never bypasses the proxy.
const API_BASE = "/api";

/* ─── Simple markdown renderer (no deps) ──────────────────────────── */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderMarkdown(text: string): string {
  // Escape ALL user/AI content first so nothing can be injected as HTML.
  // Markdown transforms are then applied on the escaped text, producing only
  // the safe tags we generate ourselves (no raw HTML ever reaches the DOM).
  let html = escapeHtml(text);

  // Code blocks: ```lang\n...\n```
  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (_, lang: string, code: string) => {
      // `code` is already HTML-escaped, so no further escaping is needed.
      return `<pre class="code-block" data-lang="${escapeHtml(lang)}"><code>${code}</code></pre>`;
    },
  );

  // Inline code: `...`
  html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

  // Bold: **...**
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Italic: *...*
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");

  // Unordered lists: lines starting with - or *
  html = html.replace(/^(?:[-*]) (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, (match) => {
    if (!match.startsWith("<ul>")) return `<ul>${match}</ul>`;
    return match;
  });

  // Line breaks
  html = html.replace(/\n/g, "<br>");

  return html;
}

/* ─── Code block with copy button ─────────────────────────────────── */

function MessageContent({ content }: { content: string }) {
  const { lang } = useAppSettings();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const pres =
      containerRef.current.querySelectorAll<HTMLElement>("pre.code-block");
    pres.forEach((pre) => {
      if (pre.querySelector(".copy-btn")) return;
      const btn = document.createElement("button");
      btn.className = "copy-btn";
      btn.textContent =
        lang === "ar" ? "نسخ" : lang === "fr" ? "Copier" : "Copy";
      btn.onclick = () => {
        const code = pre.querySelector("code");
        if (!code) return;
        navigator.clipboard.writeText(code.textContent ?? "");
        btn.textContent =
          lang === "ar" ? "تم النسخ" : lang === "fr" ? "Copié !" : "Copied!";
        setTimeout(() => {
          btn.textContent =
            lang === "ar" ? "نسخ" : lang === "fr" ? "Copier" : "Copy";
        }, 1500);
      };
      pre.style.position = "relative";
      pre.insertBefore(btn, pre.firstChild);
    });
  }, [content, lang]);

  return (
    <div
      ref={containerRef}
      className="msg-content"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
    />
  );
}

/* ─── Empty state ──────────────────────────────────────────────────── */

function EmptyState({ onSend }: { onSend: (text: string) => void }) {
  const { t, lang } = useAppSettings();
  return (
    <div className="flex flex-col items-center justify-center h-full select-none px-4">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#4f7cff] to-[#8b5cf6] flex items-center justify-center shadow-2xl shadow-blue-500/30 mb-6">
        <Bot className="w-10 h-10 text-white" />
      </div>
      <h2 className="text-2xl font-bold mb-2">{t("chat.welcome")}</h2>
      <p className="text-white/50 text-sm mb-8">{t("chat.welcomeDesc")}</p>
      <div className="flex flex-wrap justify-center gap-2 max-w-lg">
        {suggestedPrompts(lang).map((prompt) => (
          <button
            key={prompt}
            onClick={() => onSend(prompt)}
            className="border border-white/15 text-white/70 hover:border-[#4f7cff]/50 hover:text-[#4f7cff] hover:bg-[#4f7cff]/5 px-4 py-2 rounded-full text-sm transition"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Sidebar conversation item ────────────────────────────────────── */

function ConversationItem({
  session,
  isActive,
  onSelect,
  onDelete,
  onRename,
  _lang,
  t,
}: {
  session: SessionSummary;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (newTitle: string) => void;
  _lang: string;
  t: (key: string) => string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commitRename = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== session.title) {
      onRename(trimmed);
    } else {
      setDraft(session.title);
    }
    setEditing(false);
  };

  return (
    <div
      className={`group flex items-center gap-2 rounded-xl px-3 py-2.5 cursor-pointer text-sm transition ${
        isActive
          ? "bg-[#4f7cff]/10 text-white"
          : "text-white/60 hover:bg-white/5"
      }`}
      onClick={() => {
        if (!editing) onSelect();
      }}
    >
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") {
              setDraft(session.title);
              setEditing(false);
            }
          }}
          onClick={(e) => e.stopPropagation()}
          placeholder={t("chat.renamePlaceholder")}
          className="flex-1 bg-white/[0.06] border border-white/15 rounded-lg px-2 py-1 text-sm text-white outline-none focus:border-[#4f7cff]/50 min-w-0"
        />
      ) : (
        <span className="flex-1 truncate min-w-0">
          {session.title || t("chat.defaultTitle")}
        </span>
      )}

      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition">
        {!editing && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDraft(session.title);
              setEditing(true);
            }}
            title={t("chat.rename")}
            className="text-white/40 hover:text-white/70 transition p-0.5"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
        {editing && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              commitRename();
            }}
            className="text-emerald-400 hover:text-emerald-300 transition p-0.5"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title={t("chat.deleteConversation")}
          className="text-white/40 hover:text-red-500 transition p-0.5"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ─── Main page ────────────────────────────────────────────────────── */

export default function ChatPage() {
  const { t, lang } = useAppSettings();
  const isRtl = lang === "ar";

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [context, setContext] = useState<ChatContext | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setContext(loadChatContext());
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  /* ── Sessions API ─────────────────────────────────────────────────── */

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/chat/sessions`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch {
      // ignore
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const loadConversation = useCallback(
    async (id: string) => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_BASE}/chat/sessions/${id}`, {
          headers: authHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          const msgs: ChatMessage[] = (data.messages || []).map(
            (m: { role: string; content: string }) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            }),
          );
          setMessages(msgs);
          setSessionId(id);
        } else if (res.status === 404) {
          setMessages([]);
          setSessionId(null);
          loadSessions();
        }
      } catch {
        setError(t("chat.connFailed"));
      } finally {
        setLoading(false);
      }
    },
    [loadSessions, t],
  );

  /* Auto-restore most recent conversation after reload */
  useEffect(() => {
    if (!sessionsLoading && sessionId === null && messages.length === 0) {
      const latest = sessions[0];
      if (latest) loadConversation(latest.id);
    }
  }, [sessionsLoading, sessions, sessionId, messages.length, loadConversation]);

  /* ── Conversation actions ─────────────────────────────────────────── */

  const newConversation = async () => {
    setError("");
    try {
      const res = await fetch(`${API_BASE}/chat/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ title: t("chat.defaultTitle") }),
      });
      if (res.ok) {
        const data = await res.json();
        const session = data.session;
        setSessionId(session.id);
        setMessages([]);
        await loadSessions();
        // On mobile, close sidebar after creating
        if (window.innerWidth < 768) setSidebarOpen(false);
      }
    } catch {
      setError(t("chat.connFailed"));
    }
  };

  const deleteConversation = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/chat/sessions/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (res.ok) {
        if (sessionId === id) {
          setSessionId(null);
          setMessages([]);
        }
        await loadSessions();
      }
    } catch {
      setError(t("chat.connFailed"));
    }
  };

  const renameConversation = async (id: string, newTitle: string) => {
    try {
      const res = await fetch(`${API_BASE}/chat/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ title: newTitle }),
      });
      if (res.ok) {
        await loadSessions();
      }
    } catch {
      setError(t("chat.connFailed"));
    }
  };

  const autoRenameConversation = useCallback(
    async (id: string, firstMessage: string) => {
      const short =
        firstMessage.length > 40
          ? firstMessage.substring(0, 40) + "…"
          : firstMessage;
      await renameConversation(id, short);
    },
    [],
  );

  /* ── Send message ─────────────────────────────────────────────────── */

  const sendMessage = async (text: string) => {
    const content = text.trim();
    if (!content || loading) return;

    let currentSessionId = sessionId;

    // Auto-create session if none selected
    if (!currentSessionId) {
      try {
        const res = await fetch(`${API_BASE}/chat/sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ title: t("chat.defaultTitle") }),
        });
        if (res.ok) {
          const data = await res.json();
          currentSessionId = data.session.id;
          setSessionId(currentSessionId);
          await loadSessions();
        }
      } catch {
        // proceed without session
      }
    }

    const history: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(history);
    setInput("");
    setError("");
    setLoading(true);

    try {
      const response = await fetch(API_ENDPOINTS.CHAT, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          messages: history,
          context,
          session_id: currentSessionId,
          language: lang,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.detail || data.error || t("chat.error"));
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply || t("chat.noReply") },
        ]);
        if (data.session_id) {
          setSessionId(data.session_id);
          currentSessionId = data.session_id;
        }
        loadSessions();

        // Auto-rename if this is the first user message in the conversation
        if (currentSessionId && messages.length === 0) {
          autoRenameConversation(currentSessionId, content);
        }
      }
    } catch (err) {
      console.error("Chat request failed:", err);
      setError(t("chat.connFailed"));
    } finally {
      setLoading(false);
    }
  };

  /* ── Keyboard handler ─────────────────────────────────────────────── */

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  /* ── Auto-resize textarea ─────────────────────────────────────────── */

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }, [input]);

  /* ── Current session title ────────────────────────────────────────── */

  const currentSession = sessions.find((s) => s.id === sessionId);
  const currentTitle = currentSession?.title ?? t("chat.title");

  /* ── Render ───────────────────────────────────────────────────────── */

  return (
    <div
      className="flex h-full min-h-[calc(100vh-73px)] overflow-hidden rounded-2xl border border-white/10 bg-[var(--bg)]"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* ── Mobile sidebar overlay ─────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ────────────────────────────────────────────────── */}
      <aside
        className={`fixed md:static inset-y-0 z-50 w-72 flex flex-col bg-[var(--bg)] border-r border-white/10 transition-transform duration-200 ease-in-out
          ${sidebarOpen ? "translate-x-0" : isRtl ? "translate-x-full" : "-translate-x-full"}
          md:translate-x-0`}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <span className="text-sm font-semibold text-white/70">
            {t("chat.conversations")}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={newConversation}
              className="p-1.5 rounded-lg hover:bg-white/5 text-white/50 hover:text-[#4f7cff] transition"
              title={t("chat.newChat")}
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/5 text-white/50 md:hidden transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          {sessionsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-[#4f7cff]" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-white/30 text-center py-8">—</p>
          ) : (
            sessions.map((s) => (
              <ConversationItem
                key={s.id}
                session={s}
                isActive={sessionId === s.id}
                onSelect={() => {
                  loadConversation(s.id);
                  if (window.innerWidth < 768) setSidebarOpen(false);
                }}
                onDelete={() => deleteConversation(s.id)}
                onRename={(title) => renameConversation(s.id, title)}
                _lang={lang}
                t={t}
              />
            ))
          )}
        </div>
      </aside>

      {/* ── Main chat area ─────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Minimal header */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-white/10 shrink-0">
          <button
            onClick={() => setSidebarOpen((prev) => !prev)}
            className="p-1.5 rounded-lg hover:bg-white/5 text-white/60 transition"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-sm font-medium text-white/80 truncate">
            {currentTitle}
          </span>
        </header>

        {/* Messages */}
        <main className="flex-1 overflow-y-auto">
          {messages.length === 0 && !loading ? (
            <EmptyState onSend={sendMessage} />
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
              {messages.map((msg, index) => {
                const isUser = msg.role === "user";
                return (
                  <div
                    key={index}
                    className={`flex ${isUser ? (isRtl ? "justify-start" : "justify-end") : isRtl ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      dir="auto"
                      className={`max-w-[85%] md:max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed break-words ${
                        isUser
                          ? "bg-gradient-to-br from-[#4f7cff] to-[#8b5cf6] text-white rounded-br-md shadow-lg shadow-blue-500/15"
                          : "bg-white/[0.04] text-white/85 rounded-bl-md"
                      }`}
                    >
                      {isUser ? (
                        <span className="whitespace-pre-wrap">
                          {msg.content}
                        </span>
                      ) : (
                        <MessageContent content={msg.content} />
                      )}
                    </div>
                  </div>
                );
              })}

              {loading && (
                <div
                  className={`flex ${isRtl ? "justify-end" : "justify-start"}`}
                >
                  <div className="bg-white/[0.04] px-4 py-3 rounded-2xl rounded-bl-md flex items-center gap-2 text-white/60 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin text-[#4f7cff]" />
                    {t("chat.typing")}
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl text-center">
                  {error}
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          )}
        </main>

        {/* Input area */}
        <footer className="px-4 py-4 border-t border-white/10 shrink-0">
          <form
            className="max-w-3xl mx-auto flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("chat.placeholder")}
              disabled={loading}
              rows={1}
              className={`flex-1 bg-white/[0.04] border border-white/15 rounded-xl px-4 py-3 placeholder:text-white/30 outline-none focus:border-[#4f7cff]/50 transition resize-none text-sm leading-relaxed disabled:opacity-50 ${isRtl ? "text-right" : "text-left"}`}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="shrink-0 bg-gradient-to-br from-[#4f7cff] to-[#8b5cf6] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-white p-3 rounded-xl transition shadow-lg shadow-blue-500/20"
              aria-label={t("chat.send")}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isRtl ? (
                <Send className="w-5 h-5 rotate-180" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </form>
        </footer>
      </div>

      {/* ── Scoped styles for markdown ─────────────────────────────── */}
      <style jsx>{`
        :global(.msg-content) {
          word-break: break-word;
        }
        :global(.msg-content strong) {
          font-weight: 600;
          color: white;
        }
        :global(.msg-content em) {
          font-style: italic;
          opacity: 0.9;
        }
        :global(.msg-content .inline-code) {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          padding: 1px 5px;
          font-size: 0.85em;
          font-family: "Fira Code", "Cascadia Code", "JetBrains Mono", monospace;
        }
        :global(.msg-content pre.code-block) {
          background: rgba(0, 0, 0, 0.35);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          padding: 14px 16px;
          margin: 8px 0;
          overflow-x: auto;
          position: relative;
        }
        :global(.msg-content pre.code-block code) {
          font-family: "Fira Code", "Cascadia Code", "JetBrains Mono", monospace;
          font-size: 0.82em;
          line-height: 1.5;
          color: rgba(255, 255, 255, 0.85);
        }
        :global(.msg-content pre.code-block .copy-btn) {
          position: absolute;
          top: 8px;
          right: 8px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 6px;
          color: rgba(255, 255, 255, 0.5);
          font-size: 11px;
          padding: 2px 8px;
          cursor: pointer;
          transition: all 0.15s;
        }
        :global(.msg-content pre.code-block .copy-btn:hover) {
          background: rgba(255, 255, 255, 0.15);
          color: white;
        }
        :global(.msg-content ul) {
          margin: 6px 0;
          padding-inline-start: 18px;
          list-style: disc;
        }
        :global(.msg-content li) {
          margin: 2px 0;
          line-height: 1.6;
        }
        :global(.msg-content br + ul) {
          margin-top: 0;
        }
      `}</style>
    </div>
  );
}
