import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import type { IconType } from "react-icons";
import { FiChevronDown, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { cn } from "../../utils/cn";

export interface SidebarItem {
  icon: IconType;
  label: string;
  path: string;
  group?: string;
  onClick?: () => void;
}

interface SidebarProps {
  items: SidebarItem[];
  footerItems?: SidebarItem[];
  isCollapsed: boolean;
  onToggle: () => void;
  className?: string;
  brandPath?: string;
  brandLabel?: string;
  navigationLabel?: string;
  showBrand?: boolean;
  showToggle?: boolean;
  onNavigate?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ items, footerItems, isCollapsed, onToggle, className, brandPath = "/admin", brandLabel = "SLRS Admin overview", navigationLabel = "Admin navigation", showBrand = true, showToggle = true, onNavigate }) => {
  const location = useLocation();
  const sections = useMemo(() => {
    const result: Array<{ name: string; items: SidebarItem[] }> = [];
    for (const item of items) {
      const name = item.group ?? "";
      let section = result.find((candidate) => candidate.name === name);
      if (!section) {
        section = { name, items: [] };
        result.push(section);
      }
      section.items.push(item);
    }
    return result;
  }, [items]);

  const activeGroup = sections.find((section) =>
    section.name && section.items.some((item) =>
      !item.onClick && (
        location.pathname === item.path ||
        (item.path !== "/admin" && location.pathname.startsWith(`${item.path}/`))
      ),
    ),
  )?.name;
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(sections.filter((section) => section.name).map((section) => [section.name, section.name === activeGroup])),
  );

  useEffect(() => {
    if (activeGroup) {
      setExpandedGroups((current) => current[activeGroup] ? current : { ...current, [activeGroup]: true });
    }
  }, [activeGroup]);

  const renderItem = (item: SidebarItem) => {
    const isActive = !item.onClick && (
      location.pathname === item.path ||
      (item.path !== "/admin" && location.pathname.startsWith(`${item.path}/`))
    );
    const commonClasses = cn(
      "group relative flex min-h-10 w-full items-center gap-2.5 overflow-hidden rounded-lg py-1.5 pl-4 pr-2.5 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary motion-reduce:transition-none",
      isCollapsed && "justify-center gap-0 px-2",
      isActive
        ? "bg-primary-light text-accent"
        : "text-text-secondary hover:bg-surface-white hover:text-text-primary",
    );

    const content = (
      <>
        <item.icon className={cn("h-[18px] w-[18px] shrink-0", isActive ? "text-accent" : "text-text-muted group-hover:text-primary-hover")} />
        <span className={cn("truncate text-[12px] font-semibold transition-[opacity,width] duration-200 motion-reduce:transition-none", isCollapsed ? "invisible w-0 opacity-0" : "visible w-auto opacity-100")}>
          {item.label}
        </span>
      </>
    );

    const itemNode = item.onClick ? (
      <button key={item.label} type="button" onClick={() => { item.onClick?.(); onNavigate?.(); }} title={isCollapsed ? item.label : undefined} aria-label={item.label} className={commonClasses}>
        {content}
      </button>
    ) : (
      <Link key={item.path} to={item.path} onClick={onNavigate} title={isCollapsed ? item.label : undefined} aria-label={item.label} aria-current={isActive ? "page" : undefined} className={commonClasses}>
        {content}
      </Link>
    );

    return itemNode;
  };

  return (
    <aside className={cn("relative z-30 flex shrink-0 flex-col border-r border-border bg-bg-secondary transition-[width] duration-200 ease-out motion-reduce:transition-none", isCollapsed ? "w-16" : "w-[216px]", className)}>
      {showBrand && (<div className="flex h-[64px] shrink-0 items-center justify-center border-b border-border px-2">
        <Link to={brandPath} className="flex min-h-10 w-full min-w-0 items-center justify-center overflow-hidden" aria-label={brandLabel}>
          <img
            src={isCollapsed ? "/brand/logo-mark.png" : "/brand/logo-horizontal.png"}
            alt="SLRS"
            className="block h-8 max-w-full w-auto select-none object-contain object-left"
            draggable={false}
          />
        </Link>
      </div>)}

      {showToggle && (<button
        type="button"
        onClick={onToggle}
        aria-expanded={!isCollapsed}
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute -right-4 top-[44px] z-[120] flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface-white text-text-secondary shadow-sm transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transition-none"
      >
        {isCollapsed ? <FiChevronRight size={12} /> : <FiChevronLeft size={12} />}
      </button>)}

      <nav aria-label={navigationLabel} className={cn("custom-scrollbar flex-1 overflow-y-auto py-3", isCollapsed ? "space-y-0.5 px-2.5" : "space-y-0.5 px-3")}>
        {sections.map((section, index) => {
          if (!section.name) {
            return section.items.map((item) => renderItem(item));
          }

          const isExpanded = Boolean(expandedGroups[section.name]);
          return (
            <div key={section.name}>
              <button
                type="button"
                aria-label={`${isExpanded ? "Thu g\u1ECDn" : "M\u1EDF r\u1ED9ng"} nh\u00F3m ${section.name}`}
                aria-expanded={isExpanded}
                title={isCollapsed ? section.name : undefined}
                onClick={() => setExpandedGroups((current) => ({ ...current, [section.name]: !current[section.name] }))}
                className={cn(
                  "flex min-h-9 w-full items-center justify-between rounded-lg px-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted transition-colors hover:bg-surface-white hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary motion-reduce:transition-none",
                  isCollapsed && "justify-center px-0",
                  index > 0 && "mt-2",
                )}
              >
                {!isCollapsed && <span>{section.name}</span>}
                <FiChevronDown aria-hidden="true" className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-150 motion-reduce:transition-none", isExpanded && "rotate-180")} />
              </button>
              {isExpanded && <div className="space-y-0.5">{section.items.map((item) => renderItem(item))}</div>}
            </div>
          );
        })}
      </nav>

      {footerItems && footerItems.length > 0 && (
        <div className={cn("shrink-0 border-t border-border py-2", isCollapsed ? "space-y-0.5 px-2.5" : "space-y-0.5 px-3")}>
          {footerItems.map(renderItem)}
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
