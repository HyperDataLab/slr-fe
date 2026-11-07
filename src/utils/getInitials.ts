/** Return consistent initials for display names and usernames. */
export function getInitials(value?: string | null): string {
  const normalized = (value ?? "").replace(/\([^)]*\)/g, " ").trim();
  const parts = normalized
    .split(/[\s._-]+/)
    .map((part) => part.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((part) => /\p{L}/u.test(part));

  if (parts.length === 0) return "?";
  if (parts.length === 1) return Array.from(parts[0]).slice(0, 2).join("").toLocaleUpperCase();

  return `${Array.from(parts[0])[0]}${Array.from(parts[parts.length - 1])[0]}`.toLocaleUpperCase();
}
