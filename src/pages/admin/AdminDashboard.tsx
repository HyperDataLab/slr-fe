import React, { useEffect, useLayoutEffect, useState } from "react";
import Sidebar, { type SidebarItem } from "../../components/ui/Sidebar";
import AdminHeader from "../../components/admin/AdminHeader";
import Drawer from "../../components/ui/Drawer";
import SystemSignature from "../../components/logo/SystemSignature";
import {
  FiGrid,
  FiUsers,
  FiSettings,
  FiLogOut,
  FiHome,
  FiDatabase,
  FiFileText,
  FiUser,
  FiCpu,
  FiClipboard,
  FiBell,
  FiKey,
  FiArchive,
  FiAlertCircle,
  FiChevronDown,
} from "react-icons/fi";
import { SiTask } from "react-icons/si";
import { MdChecklist } from "react-icons/md";
import { useDispatch } from "react-redux";
import { useLocation, useNavigate, Outlet } from "react-router-dom";
import { logout } from "../../redux/slices/authSlice";
import SectionGuard from "../../components/auth/SectionGuard";

const AdminDashboard: React.FC = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedMobileGroups, setExpandedMobileGroups] = useState<Record<string, boolean>>({});

  useLayoutEffect(() => {
    document.body.classList.add("admin-density");
    return () => document.body.classList.remove("admin-density");
  }, []);

  const handleLogout = () => {
    dispatch(logout());
    navigate("/auth/signin");
  };

  const handleSwitchHome = () => {
    navigate("/");
  };

  const menuItems: SidebarItem[] = [
    { icon: FiGrid, label: "Overview", path: "/admin", group: "Main" },
    { icon: SiTask, label: "SLR Projects", path: "/admin/projects", group: "Main" },
    {
      icon: FiDatabase,
      label: "Search Sources",
      path: "/admin/master-sources",
      group: "Main",
    },
    { icon: FiUsers, label: "Users Management", path: "/admin/users", group: "Management" },
    { icon: FiCpu, label: "AI Agents", path: "/admin/agents", group: "Management" },
    { icon: FiKey, label: "Repository API", path: "/admin/repository-api", group: "Management" },
    { icon: FiArchive, label: "Paper Files", path: "/admin/paper-files", group: "Management" },
    { icon: FiAlertCircle, label: "Issue Reports", path: "/admin/issue-reports", group: "Management" },
    {
      icon: MdChecklist,
      label: "Checklist Templates",
      path: "/admin/templates",
      group: "Management",
    },
    {
      icon: FiClipboard,
      label: "QA Criteria",
      path: "/admin/quality-criteria",
      group: "Management",
    },
    { icon: FiFileText, label: "Audit Logs", path: "/admin/audit-logs", group: "System" },
    { icon: FiBell, label: "Notifications", path: "/admin/notifications", group: "System" },
    { icon: FiSettings, label: "System Settings", path: "/admin/settings", group: "System" },
  ];

  const menuSections = menuItems.reduce<Array<{ group: string; items: SidebarItem[] }>>((sections, item) => {
    const group = item.group ?? "";
    let section = sections.find((candidate) => candidate.group === group);
    if (!section) {
      section = { group, items: [] };
      sections.push(section);
    }
    section.items.push(item);
    return sections;
  }, []);
  const activeMobileGroup = menuItems.find((item) =>
    item.group && !item.onClick && (
      location.pathname === item.path ||
      (item.path !== "/admin" && location.pathname.startsWith(`${item.path}/`))
    ),
  )?.group;

  useEffect(() => {
    if (activeMobileGroup) {
      setExpandedMobileGroups((current) => current[activeMobileGroup] ? current : { ...current, [activeMobileGroup]: true });
    }
  }, [activeMobileGroup]);

  const footerItems: SidebarItem[] = [
    {
      icon: FiHome,
      label: "Client Home",
      path: "/",
      onClick: handleSwitchHome,
    },
    {
      icon: FiUser,
      label: "My Profile",
      path: "/admin/profile",
    },
    {
      icon: FiLogOut,
      label: "Sign out",
      path: "",
      onClick: handleLogout,
    },
  ];

  return (
    <SectionGuard section="admin">
      <div className="relative flex h-dvh overflow-hidden bg-bg-primary">
        {/* Mobile Sidebar (Drawer) */}
        <Drawer
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          side="left"
          maxWidth="max-w-[280px]"
          title={<SystemSignature className="mb-0" logoClassName="h-8" />}
        >
          <div className="flex flex-col h-full -mx-6 -my-8">
            <nav aria-label="Admin navigation" className="custom-scrollbar flex-1 space-y-2 overflow-y-auto px-4 py-5">
              {menuSections.map((section) => (
                <div key={section.group || "ungrouped"}>
                  {section.group && (
                    <button
                      type="button"
                      aria-expanded={Boolean(expandedMobileGroups[section.group])}
                      onClick={() => setExpandedMobileGroups((current) => ({ ...current, [section.group]: !current[section.group] }))}
                      className="flex min-h-10 w-full items-center justify-between rounded-lg px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted hover:bg-surface-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <span>{section.group}</span>
                      <FiChevronDown aria-hidden="true" className={`h-3.5 w-3.5 transition-transform motion-reduce:transition-none ${expandedMobileGroups[section.group] ? "rotate-180" : ""}`} />
                    </button>
                  )}
                  {(!section.group || expandedMobileGroups[section.group]) && section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    onClick={() => {
                      if (item.onClick) item.onClick();
                      else navigate(item.path);
                      setIsMobileMenuOpen(false);
                    }}
                    type="button"
                    className="flex min-h-11 w-full items-center gap-3 rounded-xl py-3 pl-5 pr-3 text-left text-[12px] font-semibold text-text-secondary transition-colors hover:bg-primary-light hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
                  >
                    <Icon className="h-[18px] w-[18px] opacity-70" />
                    {item.label}
                  </button>
                );
                  })}
                </div>
              ))}
            </nav>
            <div className="space-y-1 border-t border-border p-4">
              {footerItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      if (item.onClick) item.onClick();
                      else navigate(item.path);
                      setIsMobileMenuOpen(false);
                    }}
                    className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[12px] font-semibold text-text-secondary transition-colors motion-reduce:transition-none hover:bg-surface-white hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Icon className="h-[18px] w-[18px] opacity-70" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </Drawer>

        {/* Desktop Sidebar */}
        <Sidebar
          className="hidden lg:flex"
          items={menuItems}
          footerItems={footerItems}
          isCollapsed={isSidebarCollapsed}
          onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Top Navbar */}
          <AdminHeader onMenuClick={() => setIsMobileMenuOpen(true)} />

          {/* Dynamic Content */}
          <main className="custom-scrollbar flex-1 overflow-y-auto px-5 py-7 sm:px-7 lg:px-8 lg:py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </SectionGuard>
  );
};

export default AdminDashboard;
