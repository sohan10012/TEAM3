import {
  Clock,
  MessageSquare,
  Plus,
  Trash2,
  X,
} from "lucide-react";
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
}

export function ReasonXConversationHistory({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onClose,
}: ReasonXConversationHistoryProps) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-white animate-in fade-in slide-in-from-left-4 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 bg-slate-50/80">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-[#1D4ED8]" />
          <h3 className="font-semibold text-xs text-slate-900">Conversation History</h3>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onNew}
            className="flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-2xs font-semibold text-[#1D4ED8] hover:bg-blue-100 transition-colors"
          >
            <Plus className="h-3 w-3" />
            <span>New Chat</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {conversations.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            No previous conversations recorded in this project workspace.
          </div>
        ) : (
          conversations.map((c) => {
            const isActive = c.id === activeId;
            return (
              <div
                key={c.id}
                className={cn(
                  "group relative flex items-start justify-between rounded-xl border p-2.5 transition-all cursor-pointer",
                  isActive
                    ? "border-blue-500 bg-blue-50/50 shadow-xs ring-1 ring-blue-500/20"
                    : "border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50"
                )}
                onClick={() => {
                  onSelect(c.id);
                  onClose();
                }}
              >
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-xs text-slate-800 truncate">
                      {c.title || "Untitled Conversation"}
                    </span>
                    {c.page_context && (
                      <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[9px] font-mono shrink-0">
                        {c.page_context}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-2xs text-slate-500 truncate">{c.preview}</p>
                  <span className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                    <Clock className="h-2.5 w-2.5" />
                    <span>{new Date(c.updated_at).toLocaleDateString()} · {c.message_count} messages</span>
                  </span>
                </div>

                {/* Delete affordance */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm("Are you sure you want to delete this conversation?")) {
                      onDelete(c.id);
                    }
                  }}
                  title="Delete conversation"
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 transition-opacity"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
