import { useEffect, useId, useMemo, useRef, useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import Button from "../../../../../components/ui/Button";
import Drawer from "../../../../../components/ui/Drawer";
import type { ExtractionCommentDto } from "../../../../../types/dataExtraction";
import { getInitials } from "../../../../../utils/getInitials";

interface FieldCommentsProps {
  title: string;
  comments: ExtractionCommentDto[];
  onSendComment: (content: string) => Promise<void>;
  isSending?: boolean;
  disabled?: boolean;
  currentUserId?: string | null;
}

function formatCommentTime(value: string): string {
  const timestamp = new Date(value);

  if (Number.isNaN(timestamp.getTime())) {
    return "Just now";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

export default function FieldComments({
  title,
  comments,
  onSendComment,
  isSending = false,
  disabled = false,
  currentUserId = null,
}: FieldCommentsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const inputId = useId();
  const commentsContainerRef = useRef<HTMLDivElement | null>(null);

  const orderedComments = useMemo(
    () =>
      [...comments].sort(
        (left, right) =>
          new Date(left.createdAt).getTime() -
          new Date(right.createdAt).getTime(),
      ),
    [comments],
  );

  const commentCount = comments.length;
  const canSend = draft.trim().length > 0 && !disabled && !isSending;

  useEffect(() => {
    if (!isOpen || !commentsContainerRef.current) {
      return;
    }

    commentsContainerRef.current.scrollTo({
      top: commentsContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [isOpen, orderedComments.length]);

  const handleSend = async () => {
    const normalizedContent = draft.trim();
    if (!normalizedContent) {
      return;
    }

    await onSendComment(normalizedContent);
    setDraft("");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="relative inline-flex h-11 min-w-11 items-center justify-center rounded-full border border-border bg-surface-white px-2 text-text-secondary transition-colors hover:border-accent/30 hover:bg-primary-light hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        aria-label={`Open comments for ${title}`}
        title="Comments"
      >
        <MessageSquare className="h-4 w-4" />
        {commentCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
            {commentCount > 99 ? "99+" : commentCount}
          </span>
        ) : null}
      </button>

      <Drawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={<div className="pr-8">Comments - {title}</div>}
        side="right"
        maxWidth="max-w-xl"
      >
        <div className="flex h-full min-h-[65vh] flex-col">
          <div
            ref={commentsContainerRef}
            className="flex-1 space-y-3 overflow-y-auto pr-1"
          >
            {orderedComments.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-bg-secondary p-4 text-sm text-text-secondary">
                No comments yet. Start the thread for this field.
              </div>
            ) : (
              orderedComments.map((comment) => {
                const isCurrentUser =
                  Boolean(currentUserId) && currentUserId === comment.userId;

                return (
                  <div
                    key={comment.id}
                    className={
                      isCurrentUser
                        ? "ml-10 rounded-xl border border-accent/30 bg-primary-light p-3"
                        : "mr-10 rounded-xl border border-border bg-surface-white p-3"
                    }
                  >
                    <div className="flex items-center gap-2">
                      <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-text-primary text-[11px] font-semibold text-white">
                        {getInitials(comment.userName)}
                      </div>
                      <p className="text-xs font-semibold text-text-primary">
                        {comment.userName}
                      </p>
                      <span className="text-[11px] text-text-secondary">
                        {formatCommentTime(comment.createdAt)}
                      </span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text-primary">
                      {comment.content}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-4 border-t border-border pt-4">
            <label
              htmlFor={inputId}
              className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-secondary"
            >
              Add reply
            </label>
            <div className="flex items-end gap-2">
              <textarea
                id={inputId}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Type your message..."
                disabled={disabled || isSending}
                rows={3}
                className="min-h-11 w-full resize-none rounded-xl border border-border bg-surface-white px-3 py-2 text-sm text-text-primary outline-none transition-colors placeholder:text-text-secondary focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-bg-secondary motion-reduce:transition-none"
              />
              <Button
                onClick={() => {
                  void handleSend();
                }}
                isLoading={isSending}
                disabled={!canSend}
                className="min-h-11 shrink-0 !rounded-xl !px-3"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </Drawer>
    </>
  );
}
