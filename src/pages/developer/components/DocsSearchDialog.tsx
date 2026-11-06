import { useEffect, useMemo, useState } from "react";
import { FiArrowDown, FiArrowUp, FiCornerDownLeft, FiSearch, FiX } from "react-icons/fi";
import Input from "../../../components/ui/Input";

export type DocsSearchResult = {
  id: string;
  title: string;
  description: string;
  group: string;
  keywords?: string;
};

function highlight(text: string, query: string) {
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index < 0 || !query) return text;
  return <>{text.slice(0, index)}<mark className="devdocs-search__match">{text.slice(index, index + query.length)}</mark>{text.slice(index + query.length)}</>;
}

export default function DocsSearchDialog({
  open,
  onClose,
  entries,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  entries: DocsSearchResult[];
  onSelect: (entry: DocsSearchResult) => void;
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return entries.slice(0, 8);
    return entries
      .map((entry, index) => {
        const title = entry.title.toLowerCase();
        const description = entry.description.toLowerCase();
        const keywords = (entry.keywords || "").toLowerCase();
        const score = title === term ? 4 : title.startsWith(term) ? 3 : title.includes(term) ? 2 : description.includes(term) ? 1 : keywords.includes(term) ? 0 : -1;
        return { entry, index, score };
      })
      .filter((result) => result.score >= 0)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, 20)
      .map((result) => result.entry);
  }, [entries, query]);
  const groups = useMemo(() => [...new Set(results.map((result) => result.group))], [results]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, Math.max(0, results.length - 1)));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) => Math.max(0, index - 1));
      }
      if (event.key === "Enter" && results[activeIndex]) {
        event.preventDefault();
        onSelect(results[activeIndex]);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
    };
  }, [activeIndex, onClose, onSelect, open, results]);

  useEffect(() => setActiveIndex(0), [query]);
  if (!open) return null;

  let index = -1;
  return (
    <div className="devdocs-search__backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label="Search developer documentation" className="devdocs-search">
        <div className="devdocs-search__input-row">
          <div className="devdocs-search__field">
            <FiSearch aria-hidden="true" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search docs, endpoints, parameters…" aria-label="Search documentation" className="devdocs-search__field-input" />
          </div>
          <button type="button" className="devdocs-icon-button" onClick={onClose} aria-label="Close search"><FiX /></button>
        </div>
        <div className="devdocs-search__results" role="listbox" aria-label="Documentation results">
          {results.length ? groups.map((group) => (
            <div key={group}>
              <p className="devdocs-search__group">{group}</p>
              {results.filter((result) => result.group === group).map((result) => {
                index += 1;
                const resultIndex = index;
                return (
                  <button
                    type="button"
                    role="option"
                    aria-selected={activeIndex === resultIndex}
                    key={result.id}
                    className={`devdocs-search__result ${activeIndex === resultIndex ? "is-active" : ""}`}
                    onMouseEnter={() => setActiveIndex(resultIndex)}
                    onClick={() => onSelect(result)}
                  >
                    <span><strong>{highlight(result.title, query)}</strong><small>{highlight(result.description, query)}</small></span>
                    <FiCornerDownLeft aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          )) : <p className="devdocs-search__empty">No matching documentation or endpoints.</p>}
        </div>
        <div className="devdocs-search__footer"><span><kbd><FiArrowUp /></kbd><kbd><FiArrowDown /></kbd> to navigate</span><span><kbd><FiCornerDownLeft /></kbd> to open</span><span>Search is based on the current OpenAPI contract</span></div>
      </section>
    </div>
  );
}
