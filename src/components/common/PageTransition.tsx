import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useLocation, useOutlet } from "react-router-dom";

const STAGGER_INTERVAL_MS = 50;
const MAX_STAGGER_DELAY_MS = 200;
const MAX_STAGGERED_GROUPS = 8;

interface PageTransitionProps {
  children?: ReactNode;
  className?: string;
  stagger?: boolean;
  transitionKey?: string;
  skipInitialAnimation?: boolean;
}

function visibleChildren(element: HTMLElement): HTMLElement[] {
  return Array.from(element.children).filter((child): child is HTMLElement => {
    if (!(child instanceof HTMLElement) || child.hasAttribute("data-page-transition-ignore")) {
      return false;
    }

    const style = window.getComputedStyle(child);
    return child.getAttribute("aria-hidden") !== "true" && style.display !== "none" && style.visibility !== "hidden";
  });
}

function hasOwnMotion(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  return style.animationName !== "none"
    || (element.style.transform !== "" && element.style.transform !== "none")
    || element.style.opacity !== "";
}

function containsFixedContent(element: HTMLElement): boolean {
  return element.matches(".fixed, [style*='position: fixed']")
    || Boolean(element.querySelector(".fixed, [style*='position: fixed']"));
}

function getTransitionTargets(root: HTMLElement, stagger: boolean): HTMLElement[] {
  const singleTarget = visibleChildren(root).find((child) => child.hasAttribute("data-page-transition-single"));
  if (singleTarget) return [singleTarget];
  if (!stagger) return visibleChildren(root);

  let container = root;
  let groups = visibleChildren(container);

  while (groups.length === 1) {
    const nestedGroups = visibleChildren(groups[0]);
    if (nestedGroups.length < 2 || nestedGroups.length > MAX_STAGGERED_GROUPS) break;
    container = groups[0];
    groups = nestedGroups;
  }

  if (groups.length === 0) return [];
  if (groups.length > MAX_STAGGERED_GROUPS) return [container];
  return groups;
}

export default function PageTransition({
  children,
  className = "",
  stagger = true,
  transitionKey,
  skipInitialAnimation = false,
}: PageTransitionProps) {
  const { pathname } = useLocation();
  const outlet = useOutlet();
  const contentRef = useRef<HTMLDivElement>(null);
  const lastTransitionKey = useRef(`${pathname}::${transitionKey ?? ""}`);

  useLayoutEffect(() => {
    const currentTransitionKey = `${pathname}::${transitionKey ?? ""}`;
    const isInitialTransition = lastTransitionKey.current === currentTransitionKey;
    lastTransitionKey.current = currentTransitionKey;
    if (skipInitialAnimation && isInitialTransition) return;

    const root = contentRef.current;
    if (!root) return;

    const targets = getTransitionTargets(root, stagger)
      .filter((target) => !hasOwnMotion(target) && !containsFixedContent(target));

    const cleanups = targets.map((target, index) => {
      const delay = Math.min(index * STAGGER_INTERVAL_MS, MAX_STAGGER_DELAY_MS);
      target.style.setProperty("--page-transition-delay", `${delay}ms`);
      target.classList.add("page-transition-item");

      const handleAnimationEnd = (event: AnimationEvent) => {
        if (event.target !== target) return;
        target.classList.remove("page-transition-item");
        target.style.removeProperty("--page-transition-delay");
        target.removeEventListener("animationend", handleAnimationEnd);
        target.removeEventListener("animationcancel", handleAnimationEnd);
      };

      target.addEventListener("animationend", handleAnimationEnd);
      target.addEventListener("animationcancel", handleAnimationEnd);
      return () => {
        target.removeEventListener("animationend", handleAnimationEnd);
        target.removeEventListener("animationcancel", handleAnimationEnd);
        target.classList.remove("page-transition-item");
        target.style.removeProperty("--page-transition-delay");
      };
    });

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [pathname, skipInitialAnimation, stagger, transitionKey]);

  return (
    <div
      key={pathname}
      ref={contentRef}
      className={`page-transition-host ${className}`.trim()}
    >
      {children === undefined ? outlet : children}
    </div>
  );
}
