import { Fragment, useState } from "react";
import { Highlight, type Language, type PrismTheme } from "prism-react-renderer";
import Prism from "prismjs";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-json";
import "prismjs/components/prism-python";
import "prismjs/components/prism-typescript";
import { FiCheck, FiCopy } from "react-icons/fi";

const codeTheme: PrismTheme = {
  plain: { color: "var(--docs-code-text)", backgroundColor: "transparent" },
  styles: [
    { types: ["comment", "prolog", "doctype", "cdata"], style: { color: "var(--docs-code-muted)", fontStyle: "italic" } },
    { types: ["punctuation"], style: { color: "var(--docs-code-punctuation)" } },
    { types: ["property", "tag", "boolean", "number", "constant", "symbol", "deleted", "selector", "attr-name"], style: { color: "var(--docs-code-key)" } },
    { types: ["string", "char", "builtin", "inserted", "attr-value", "template-string"], style: { color: "var(--docs-code-string)" } },
    { types: ["operator", "entity", "url"], style: { color: "var(--docs-code-operator)" } },
    { types: ["keyword", "atrule", "function", "class-name"], style: { color: "var(--docs-code-keyword)", fontWeight: "600" } },
  ],
};

export default function DocsCodeBlock({
  code,
  language = "text",
  label,
  compact = false,
}: {
  code: string;
  language?: string;
  label?: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const highlightLanguage = language === "curl" ? "bash" : language;
  const hasGrammar = language !== "text" && Boolean(Prism.languages[highlightLanguage]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={`devdocs-code ${compact ? "devdocs-code--compact" : ""}`}>
      {(label || language !== "text") && (
        <div className="devdocs-code__toolbar">
          <span>{label || language}</span>
          <button type="button" onClick={() => void copy()} className="devdocs-code__copy" aria-label={copied ? "Code copied" : "Copy code"}>
            {copied ? <FiCheck aria-hidden="true" /> : <FiCopy aria-hidden="true" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
      )}
      {hasGrammar ? (
        <Highlight prism={Prism} theme={codeTheme} language={highlightLanguage as Language} code={code}>
          {({ className, style, tokens, getTokenProps }) => (
            <pre className={`devdocs-code__pre ${className}`} style={style} tabIndex={0} aria-label={`${language} code example`}>
              <code>{tokens.map((line, lineIndex) => (
                <Fragment key={lineIndex}>
                  {line.map((token, tokenIndex) => <span key={tokenIndex} {...getTokenProps({ token })} />)}
                  {lineIndex < tokens.length - 1 ? "\n" : null}
                </Fragment>
              ))}</code>
            </pre>
          )}
        </Highlight>
      ) : (
        <pre className="devdocs-code__pre" tabIndex={0} aria-label={`${language} code example`}><code>{code}</code></pre>
      )}
      {!label && language === "text" && (
        <button type="button" onClick={() => void copy()} className="devdocs-code__copy devdocs-code__copy--floating" aria-label={copied ? "Code copied" : "Copy code"}>
          {copied ? <FiCheck aria-hidden="true" /> : <FiCopy aria-hidden="true" />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      )}
    </div>
  );
}
