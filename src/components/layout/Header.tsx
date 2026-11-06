import { useState, useRef, useEffect } from "react";
import {
  FiBell,
  FiMenu,
  FiX,
  FiLayers,
  FiBookOpen,
  FiUser,
  FiKey,
  FiLogOut,
  FiShield,
} from "react-icons/fi";
import SystemSignature from "../logo/SystemSignature";
import NotificationDropdown from "./NotificationDropdown";
import { Link, useLocation, useNavigate } from "react-router";
import Drawer from "../ui/Drawer";
import { useSelector, useDispatch } from "react-redux";
import type { RootState } from "../../redux/store";
import { logout } from "../../redux/slices/authSlice";
import { clearCurrentProject } from "../../redux/slices/projectSlice";
import Button from "../ui/Button";
import { toastWarning } from "../../utils/toast";
import { useUnreadCount } from "../../hooks/useNotifications";

interface HeaderProps {
  onMenuClick?: () => void;
  isSidebarOpen?: boolean;
  hideAccountMenu?: boolean;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick, isSidebarOpen = false, hideAccountMenu = false }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const landingTopRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { isAuthenticated, user } = useSelector(
    (state: RootState) => state.auth,
  );
  const { unreadCount } = useUnreadCount();

  useEffect(() => {
    const sentinel = landingTopRef.current;
    const header = headerRef.current;
    if (location.pathname !== "/" || !sentinel || !header || typeof IntersectionObserver === "undefined") {
      header?.removeAttribute("data-scrolled");
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry) header.toggleAttribute("data-scrolled", !entry.isIntersecting);
    }, { threshold: 0 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [location.pathname]);

  const handleLogout = () => {
    dispatch(logout());
    dispatch(clearCurrentProject());
    navigate("/auth/signin");
  };

  const handleSwitchAdmin = () => {
    navigate("/admin");
  };

  const getUserInitials = (name: string) => {
    return name ? name.trim().charAt(0).toUpperCase() : "";
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        notificationRef.current &&
        !notificationRef.current.contains(target)
      ) {
        setShowNotifications(false);
      }
      if (
        userDropdownRef.current &&
        !userDropdownRef.current.contains(target)
      ) {
        setShowUserDropdown(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowNotifications(false);
        setShowUserDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Close mobile menu and dropdowns on route change
  useEffect(() => {
    setIsMenuOpen(false);
    setShowNotifications(false);
    setShowUserDropdown(false);
  }, [location.pathname]);

  const navLinks = location.pathname === "/"
    ? [
        { name: "Projects", path: "/projects", icon: FiLayers },
        { name: "Developer API", path: "/repository-api-docs", icon: FiBookOpen },
        { name: "Workflow", path: "/#workflow", icon: FiLayers },
        { name: "Features", path: "/#features", icon: FiLayers },
        { name: "About", path: "/#about", icon: FiLayers },
      ]
    : [{ name: "Projects", path: "/projects", icon: FiLayers }, { name: "Shared library", path: "/shared-repository", icon: FiBookOpen }, { name: "Developer API", path: "/repository-api-docs", icon: FiBookOpen }];

  const handleHeaderInteraction = (
    e: React.MouseEvent | React.KeyboardEvent,
  ) => {
    if (user?.role !== "Admin") return;

    const target = e.target as HTMLElement;
    const button = target.closest("button");
    const isLink = target.closest("a");

    // Allow Admin Console button
    const isAdminConsole = button?.textContent?.includes("Admin Console");
    // Allow Mobile Menu toggle
    const isMenuToggle = button?.getAttribute("aria-label") === "Toggle Menu";
    // Allow standard navigation links
    if (isLink || isAdminConsole || isMenuToggle) return;

    // Block other interactive elements (Notifications, Profile dropdown, etc.)
    const isNotificationAction = target.closest("[data-notification-controls]");
    if (isNotificationAction) return;

    const isForbiddenAction =
      button || target.closest("input, select, textarea");
    if (isForbiddenAction) {
      e.preventDefault();
      e.stopPropagation();
      toastWarning(
        "Read-only Mode",
        "Only client can perform actions on these components.",
      );
    }
  };

  return (
    <>
      {location.pathname === "/" && <div ref={landingTopRef} aria-hidden="true" className="pointer-events-none -mb-px h-px" />}
      <header
        ref={headerRef}
        className="sticky top-0 z-(--z-index-header) h-16 border-b border-border bg-surface-white transition-[box-shadow] duration-200 data-[scrolled]:shadow-[0_2px_8px_rgba(18,35,49,0.06)]"
        onClickCapture={handleHeaderInteraction}
        onKeyDownCapture={handleHeaderInteraction}
      >
        <div className="mx-auto h-full w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-full">
            {/* Left Side: Logo & Desktop Nav */}
            <div className="flex items-center gap-2 lg:gap-8 xl:gap-12">
              {/* Mobile Menu Toggle */}
              <button
                type="button"
                onClick={() => onMenuClick ? onMenuClick() : setIsMenuOpen(!isMenuOpen)}
                className="-ml-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transition-none lg:hidden"
                aria-label="Toggle Menu"
                aria-expanded={onMenuClick ? isSidebarOpen : isMenuOpen}
              >
                {(onMenuClick ? isSidebarOpen : isMenuOpen) ? (
                  <FiX className="w-5 h-5" />
                ) : (
                  <FiMenu className="w-5 h-5" />
                )}
              </button>

              <Link to="/" className={`group flex min-h-11 shrink-0 items-center gap-2 ${onMenuClick ? "hidden" : ""}`}>
                <SystemSignature className="mb-0" />
              </Link>

              {onMenuClick && <span className="truncate text-sm font-semibold text-text-primary">{location.pathname.startsWith("/shared-repository") ? "Shared library" : location.pathname.startsWith("/profile") ? "My Profile" : location.pathname === "/issue-reports" ? "Report" : "Projects"}</span>}
              {/* Desktop Navigation */}
              <nav aria-label="Primary navigation" className={onMenuClick ? "hidden" : "hidden items-center gap-1 lg:flex"}>
                {navLinks.map((link) => {
                  const isActive = link.path.startsWith("/#")
                    ? location.hash === link.path.slice(1)
                    : location.pathname.startsWith(link.path);
                  const className = `relative inline-flex min-h-11 items-center px-3 text-sm font-medium normal-case tracking-normal whitespace-nowrap transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary after:transition-transform after:duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:after:transition-none ${isActive ? "text-primary after:scale-x-100" : "text-text-secondary after:scale-x-0 hover:text-text-primary hover:after:scale-x-100"}`;
                  return location.pathname === "/" && link.path.startsWith("/#") ? (
                    <a key={link.name} href={link.path.slice(1)} className={className}>{link.name}</a>
                  ) : (
                    <Link key={link.name} to={link.path} className={className}>{link.name}</Link>
                  );
                })}
              </nav>
            </div>

            {/* Right Side: Actions & User Profile */}
            <div className="flex items-center gap-2 sm:gap-4">
              {isAuthenticated ? (
                <>
                  {/* Notification Area */}
                  <div className="relative" ref={notificationRef} data-notification-controls>
                    <button
                      type="button"
                      onClick={() => setShowNotifications(!showNotifications)}
                      aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
                      aria-expanded={showNotifications}
                      aria-controls="notifications-popover"
                      className={`relative flex min-h-11 min-w-11 items-center justify-center rounded-xl transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transition-none ${
                        showNotifications
                          ? "bg-primary-light text-primary"
                          : "text-text-secondary hover:bg-bg-secondary hover:text-primary"
                      }`}
                    >
                      <FiBell className="h-[18px] w-[18px]" />
                      {/* Badge */}
                      {unreadCount > 0 && (
                        <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-primary px-1 text-[9px] font-bold leading-none text-white">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}
                    </button>

                    {/* Dropdown */}
                    {showNotifications && (
                      <NotificationDropdown onClose={() => setShowNotifications(false)} />
                    )}
                  </div>

                  {/* Admin Dashboard Access */}
                  {user?.role === "Admin" && (
                    <Button
                      onClick={handleSwitchAdmin}
                      size="sm"
                      variant="primary"
                      className="min-h-11 min-w-11 px-3 sm:px-4"
                    >
                      <FiShield className="w-4 h-4" />
                      <span className="hidden sm:inline">Admin Console</span>
                    </Button>
                  )}

{hideAccountMenu && (
  <>
    <div className="mx-0.5 hidden h-7 w-px bg-border sm:block"></div>
    <div className="flex min-w-0 items-center gap-2.5 py-1 pl-2">
      <div className="hidden min-w-0 text-right sm:block">
        <p className="max-w-40 truncate text-[12px] font-bold leading-tight text-text-primary">{user?.name || "User"}</p>
        <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-text-muted">{user?.role || "User"}</p>
      </div>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
        {user?.name ? getUserInitials(user.name) : "U"}
      </div>
    </div>
  </>
)}{!hideAccountMenu && (
                  <>
                  {/* Desktop Separator */}
                  <div className="mx-0.5 hidden h-7 w-px bg-border sm:block"></div>

                  {/* User Profile Dropdown */}
                  <div className="relative" ref={userDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setShowUserDropdown(!showUserDropdown)}
                      aria-expanded={showUserDropdown}
                      aria-controls="header-user-menu"
                      className={`group flex min-h-11 min-w-11 items-center gap-2.5 rounded-xl py-1 pl-2 pr-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transition-none ${
                        showUserDropdown
                          ? "bg-bg-secondary"
                          : "hover:bg-bg-secondary"
                      }`}
                    >
                      <div className="hidden lg:block text-right">
                        <p className="text-[12px] font-bold leading-tight text-text-primary">
                          {user?.name || "User"}
                        </p>
                        <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                          {user?.role || "User"}
                        </p>
                      </div>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
                        {user?.name ? getUserInitials(user.name) : "U"}
                      </div>
                    </button>

                    {/* Profile Dropdown Menu */}
                    {showUserDropdown && (
                      <div id="header-user-menu" className="header-account-menu-enter absolute right-0 z-(--z-index-dropdown) mt-3 w-[248px] rounded-xl border border-border/80 bg-surface-white p-1.5 shadow-[0_12px_28px_-10px_rgba(18,35,49,0.22)]">
                        <div className="flex items-center gap-3 px-3 py-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
                            {user?.name ? getUserInitials(user.name) : "U"}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[12px] font-bold text-text-primary">
                              {user?.name || "User"}
                            </p>
                            <p className="mt-0.5 truncate text-[9px] font-semibold uppercase tracking-[0.13em] text-text-muted">
                              {user?.role || "User"}
                            </p>
                          </div>
                        </div>

                        <div className="mx-2 h-px bg-bg-secondary" />

                        <Link
                          to="/profile"
                          onClick={() => setShowUserDropdown(false)}
                          className="mt-1 flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-text-secondary transition-colors hover:bg-primary-light hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
                        >
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-light text-accent"><FiUser className="h-4 w-4" /></span>
                          <span>
                            <span className="block text-[11px] font-bold">Profile</span>
                            <span className="mt-0.5 block text-[9px] text-text-muted">View your account</span>
                          </span>
                        </Link>

                        <Link
                          to="/profile/api-keys"
                          onClick={() => setShowUserDropdown(false)}
                          className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-text-secondary transition-colors hover:bg-primary-light hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
                        >
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-light text-accent"><FiKey className="h-4 w-4" /></span>
                          <span>
                            <span className="block text-[11px] font-bold">API Keys</span>
                            <span className="mt-0.5 block text-[9px] text-text-muted">Manage API access</span>
                          </span>
                        </Link>

                        <button
                          onClick={() => {
                            setShowUserDropdown(false);
                            handleLogout();
                          }}
                          type="button"
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-error transition-colors hover:bg-error/5 hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error"
                        >
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FBF0EF] text-[#A65A56]"><FiLogOut className="h-4 w-4" /></span>
                          <span>
                            <span className="block text-left text-[11px] font-bold">Sign out</span>
                            <span className="mt-0.5 block text-left text-[9px] text-[#A17D7A]">End your current session</span>
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                  </>
)}
                </>
              ) : (
                <div className="flex items-center gap-2.5 sm:gap-3">
                  {location.pathname === "/" && (
                    <Link to="/auth/signin" className="hidden min-h-11 sm:inline-flex">
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-11 px-6"
                      >
                        Get Started
                      </Button>
                    </Link>
                  )}
                  <Link to="/auth/signin">
                    <Button
                      variant="primary"
                      size="sm"
                      className="min-h-11 px-6"
                    >
                      Sign In
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {!onMenuClick && <Drawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        side="left"
        maxWidth="max-w-[85%] sm:max-w-sm lg:hidden"
        title={
          <Link to="/" onClick={() => setIsMenuOpen(false)}>
            <SystemSignature className="mb-0" logoClassName="h-8" />
          </Link>
        }
        footer={
          <p className="text-[10px] text-text-secondary text-center uppercase tracking-widest leading-loose">
            SLRS
            <br />
            v1.0.2 \u2022 2026
          </p>
        }
      >
        <p className="text-[11px] text-text-secondary uppercase tracking-[0.2em] mb-6">
          Navigation
        </p>
        <nav className="space-y-1">
          {navLinks.map((link) => {
            const className = "flex min-h-11 items-center gap-4 rounded-lg p-3 text-[11px] font-medium uppercase tracking-[0.2em] text-text-primary transition-colors hover:bg-bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none";
            const content = <><link.icon className="w-4 h-4 opacity-50" />{link.name}</>;
            return location.pathname === "/" && link.path.startsWith("/#") ? (
              <a key={link.name} href={link.path.slice(1)} onClick={() => setIsMenuOpen(false)} className={className}>{content}</a>
            ) : (
              <Link key={link.name} to={link.path} className={className}>{content}</Link>
            );
          })}
        </nav>

        <div className="mt-12">
          {user?.role === "Admin" && (
            <div className="mb-6">
              <p className="text-[11px] text-text-secondary uppercase tracking-[0.2em] mb-4">
                Management
              </p>
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  handleSwitchAdmin();
                }}
                type="button"
                className="flex min-h-11 w-full items-center gap-4 rounded-xl bg-text-primary p-3 text-bg-primary transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none"
              >
                <FiShield className="w-4 h-4" />
                <span className="text-[12px] font-medium uppercase tracking-[0.15em]">
                  Admin Dashboard
                </span>
              </button>
            </div>
          )}
          <p className="text-[11px] text-text-secondary uppercase tracking-[0.2em] mb-4">
            Account
          </p>
          {isAuthenticated ? (
            <>
              <div className="flex items-center gap-3 p-3 bg-bg-secondary rounded-xl">
                <div className="h-10 w-10 bg-accent text-bg-primary rounded-full flex items-center justify-center font-medium text-base">
                  {user?.name ? getUserInitials(user.name) : "U"}
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {user?.name || "User"}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-text-secondary">
                    {user?.role || "User"}
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                type="button"
                className="mt-3 flex min-h-11 w-full items-center gap-3 rounded-lg p-3 text-sm text-accent transition-colors hover:bg-bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
              >
                <FiLogOut className="w-4 h-4" />
                Sign Out
              </button>
            </>
          ) : (
            <Link to="/auth/signin" onClick={() => setIsMenuOpen(false)}>
              <Button className="w-full">Sign In</Button>
            </Link>
          )}
        </div>
      </Drawer>}
    </>
  );
};

export default Header;
