import {
  AlertCircle,
  Clock,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/utils/format";

export interface ConversationSummary {
  id: number;
  title: string;
  page_context?: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  preview: string;
}

interface ReasonXConversationHistoryProps {
  conversations: ConversationSummary[];
  activeId: number | null;
  onSelect: (id: number) => void;
  onNew: () => void;
  onDelete: (id: number) => void;
  onClose: () => void;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

function formatConversationDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 1) {
      const diffMins = Math.max(1, Math.floor(diffMs / (1000 * 60)));
      return `${diffMins}m ago`;
    }
    if (diffHours < 24) {
      return `${Math.floor(diffHours)}h ago`;
    }
    if (diffHours < 48) {
      return "Yesterday";
    }
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  } catch {
    return dateStr;
  }
}

export function ReasonXConversationHistory({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onClose,
  isLoading = false,
  isError = false,
  onRetry,
}: ReasonXConversationHistoryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(
      (c) =>
        c.title?.toLowerCase().includes(q) ||
        c.preview?.toLowerCase().includes(q)
    );
  }, [conversations, searchQuery]);

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-white animate-in fade-in slide-in-from-left-4 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 bg-slate-50">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-slate-700" />
          <h3 className="font-semibold text-xs text-slate-900">
            Conversation History
          </h3>
          {conversations.length > 0 && (
            <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-medium text-slate-700">
              {conversations.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onNew}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Chat</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close history"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Search Input Filter */}
      {conversations.length > 0 && (
        <div className="border-b border-slate-100 p-2.5">
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Body: Loading, Error, Empty, or List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-400 space-y-2">
            <RefreshCw className="h-5 w-5 animate-spin mx-auto text-slate-400" />
            <p>Loading conversation history...</p>
          </div>
        ) : isError ? (
          <div className="py-10 text-center px-4 space-y-3">
            <AlertCircle className="h-6 w-6 text-rose-500 mx-auto" />
            <div>
              <p className="text-xs font-semibold text-slate-800">
                Unable to load conversations
              </p>
              <p className="mt-0.5 text-2xs text-slate-500">
                An error occurred while communicating with the server.
              </p>
            </div>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Try again</span>
              </button>
            )}
          </div>
        ) : conversations.length === 0 ? (
          <div className="py-16 text-center px-4 space-y-1.5">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
              <MessageSquare className="h-5 w-5" />
            </div>
            <h4 className="text-sm font-semibold text-slate-800 pt-1">
              No previous conversations
            </h4>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Your conversations will appear here when you start using ReasonX.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400">
            No conversations matched "{searchQuery}".
          </div>
        ) : (
          filtered.map((c) => {
            const isActive = c.id === activeId;
            const isConfirmingDelete = deletingId === c.id;

            return (
              <div
                key={c.id}
                className={cn(
                  "group relative flex items-start justify-between rounded-xl border p-2.5 transition-all cursor-pointer",
                  isActive
                    ? "border-blue-500 bg-blue-50/40 shadow-xs ring-1 ring-blue-500/20"
                    : "border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/60"
                )}
                onClick={() => {
                  if (isConfirmingDelete) return;
                  onSelect(c.id);
                  onClose();
                }}
              >
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-xs text-slate-900 truncate">
                      {c.title || "Untitled Conversation"}
                    </span>
                    {isActive && (
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-600 shrink-0" />
                    )}
                  </div>
                  {c.preview && (
                    <p className="mt-0.5 text-2xs text-slate-500 truncate leading-relaxed">
                      {c.preview}
                    </p>
                  )}
                  <span className="mt-1 flex items-center gap-2 text-[10px] text-slate-400 font-normal">
                    <span className="flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      <span>{formatConversationDate(c.updated_at)}</span>
                    </span>
                    <span>·</span>
                    <span>
                      {c.message_count}{" "}
                      {c.message_count === 1 ? "message" : "messages"}
                    </span>
                  </span>
                </div>

                {/* Delete affordance with confirmation */}
                <div
                  className="shrink-0 pt-0.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  {isConfirmingDelete ? (
                    <div className="flex items-center gap-1 bg-white border border-rose-200 rounded-lg p-1 shadow-sm">
                      <button
                        type="button"
                        onClick={() => {
                          onDelete(c.id);
                          setDeletingId(null);
                        }}
                        className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-colors"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingId(null)}
                        className="rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-slate-100"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeletingId(c.id)}
                      title="Delete conversation"
                      aria-label="Delete conversation"
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
