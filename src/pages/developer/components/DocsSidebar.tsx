import { useState } from "react";
import type { ReactNode } from "react";
import { FiChevronDown, FiExternalLink, FiFileText } from "react-icons/fi";
import { Link } from "react-router-dom";
import type { EndpointGroup } from "../docs-types";
import { slug } from "../docs-utils";

const gettingStarted = [
  ["introduction", "Introduction"],
  ["quickstart", "Quickstart"],
  ["explore-api", "Explore the API"],
  ["authentication", "Authentication"],
  ["api-keys", "API keys"],
] as const;

const guides = [
  ["pagination", "Cursor pagination"],
  ["filtering", "Filtering works"],
  ["errors", "Errors & rate limits"],
] as const;

export default function DocsSidebar({
  groups,
  activeId,
  open,
  onClose,
  docsJsonUrl,
}: {
  groups: EndpointGroup[];
  activeId: string;
  open: boolean;
  onClose: () => void;
  docsJsonUrl: string;
}) {
  const [expanded, setExpanded] = useState({ gettingStarted: true, guides: true, apiReference: true, resources: true });
  const linkClass = (id: string) => `devdocs-nav__link ${activeId === id ? "is-active" : ""}`;
  const sectionLinks = (items: readonly (readonly [string, string])[]) => items.map(([id, title]) => (
    <a key={id} className={linkClass(id)} href={`#${id}`} onClick={onClose}>{title}</a>
  ));
  const navGroup = (key: keyof typeof expanded, title: string, content: ReactNode) => (
    <section className="devdocs-nav__group" key={key}>
      <button type="button" className="devdocs-nav__toggle" aria-expanded={expanded[key]} aria-controls={`devdocs-nav-${key}`} onClick={() => setExpanded((current) => ({ ...current, [key]: !current[key] }))}>
        <span>{title}</span><FiChevronDown aria-hidden="true" />
      </button>
      <div id={`devdocs-nav-${key}`} className={`devdocs-nav__items ${expanded[key] ? "is-expanded" : ""}`} aria-hidden={!expanded[key]} inert={!expanded[key]}>
        <div className="devdocs-nav__items-inner">{content}</div>
      </div>
    </section>
  );

  return (
    <>
      {open && <button type="button" className="devdocs-sidebar__backdrop" onClick={onClose} aria-label="Close documentation navigation" />}
      <aside className={`devdocs-sidebar ${open ? "is-open" : ""}`} aria-label="Developer documentation navigation">
        <div className="devdocs-sidebar__mobile-head">
          <span>Documentation</span>
          <button type="button" className="devdocs-sidebar__close" onClick={onClose}>Close</button>
        </div>
        <nav className="devdocs-nav">
          <div className="devdocs-mobile-primary" aria-label="Primary navigation"><Link to="/projects" onClick={onClose}>Projects</Link><Link to="/shared-repository" onClick={onClose}>Shared library</Link><Link to="/repository-api-docs" onClick={onClose}>Developer API</Link></div>
          {navGroup("gettingStarted", "Getting started", sectionLinks(gettingStarted))}
          {navGroup("guides", "Guides", sectionLinks(guides))}
          {navGroup("apiReference", "API reference", <>
            {!groups.length && <span className="devdocs-nav__empty">Load the API contract to see endpoints.</span>}
            {groups.map((group) => {
              const id = `reference-${slug(group.name)}`;
              return <a key={group.name} className={linkClass(id)} href={`#${id}`} onClick={onClose}>{group.name}<span>{group.operations.length}</span></a>;
            })}
          </>)}
          {navGroup("resources", "Resources", <>
            <a className={`${linkClass("openapi-json")} devdocs-nav__link--resource`} href="#openapi-json" onClick={onClose}><FiFileText aria-hidden="true" />OpenAPI specification</a>
            <a className="devdocs-nav__link" href="/issue-reports" onClick={onClose}>Support & contact</a>
          </>)}
        </nav>
        <a className="devdocs-sidebar__contract" href={docsJsonUrl} target="_blank" rel="noreferrer">
          <span><strong>OpenAPI JSON</strong><small>Live backend contract</small></span><FiExternalLink aria-hidden="true" />
        </a>
      </aside>
    </>
  );
}
