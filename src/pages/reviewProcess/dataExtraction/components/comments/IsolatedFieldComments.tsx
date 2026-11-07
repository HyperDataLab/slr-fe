import { useEffect, useMemo, useRef, useState } from "react";
import { Send } from "lucide-react";
import { useSelector } from "react-redux";
import Button from "../../../../../components/ui/Button";
import type { RootState } from "../../../../../redux/store";
import type { ExtractionCommentDto } from "../../../../../types/dataExtraction";
import { getInitials } from "../../../../../utils/getInitials";

interface IsolatedFieldCommentsProps {
  comments: ExtractionCommentDto[];
  onAddComment: (content: string) => Promise<void>;
  isLoading: boolean;
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

export default function IsolatedFieldComments({
  comments,
  onAddComment,
  isLoading,
}: IsolatedFieldCommentsProps) {
  const currentUserId = useSelector(
    (state: RootState) => state.auth.user?.id ?? null,
  );
  const [draft, setDraft] = useState("");
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

  useEffect(() => {
    if (!commentsContainerRef.current) {
      return;
    }

    commentsContainerRef.current.scrollTo({
      top: commentsContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [orderedComments.length]);

  const canSend = draft.trim().length > 0 && !isLoading;

  const handleSend = async () => {
    const normalized = draft.trim();
    if (!normalized) {
      return;
    }

    await onAddComment(normalized);
    setDraft("");
  };

  return (
    <div className="flex h-full min-h-[65vh] flex-col">
      <div
        ref={commentsContainerRef}
        className="flex-1 space-y-3 overflow-y-auto pr-1"
      >
        {orderedComments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-bg-secondary p-4 text-sm text-text-secondary">
            No messages in this thread yet.
          </div>
        ) : (
          orderedComments.map((comment) => {
            const isCurrentUser =
              Boolean(currentUserId) && currentUserId === comment.userId;

            return (
              <div
                key={comment.id}
                className={
                  isCurrentUser ? "flex justify-end" : "flex justify-start"
                }
              >
                <div
                  className={
                    isCurrentUser
                      ? "max-w-[82%] rounded-xl border border-accent/30 bg-primary-light p-3"
                      : "max-w-[82%] rounded-xl border border-border bg-bg-secondary p-3"
                  }
                >
                  <div className="flex items-center gap-2">
                    <div className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-text-primary text-[10px] font-semibold text-white">
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
              </div>
            );
          })
        )}
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Reply
        </label>
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Type your message..."
            disabled={isLoading}
            rows={3}
            className="min-h-11 w-full resize-none rounded-xl border border-border bg-surface-white px-3 py-2 text-sm text-text-primary outline-none transition-colors placeholder:text-text-secondary focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-bg-secondary motion-reduce:transition-none"
          />
          <Button
            onClick={() => {
              void handleSend();
            }}
            isLoading={isLoading}
            disabled={!canSend}
            className="h-10 shrink-0 !rounded-xl !px-3"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
