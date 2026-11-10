import React, { useMemo } from "react";
import { FiMenu } from "react-icons/fi";
import { useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import type { RootState } from "../../redux/store";
import AdminNotification from "./AdminNotification";
import { getInitials } from "../../utils/getInitials";

interface AdminHeaderProps {
  onMenuClick?: () => void;
}

const AdminHeader: React.FC<AdminHeaderProps> = ({ onMenuClick }) => {
  const { user } = useSelector((state: RootState) => state.auth);
  const location = useLocation();

  const pageTitle = useMemo(() => {
    const titles: Record<string, string> = {
      "/admin": "Dashboard",
      "/admin/audit-logs": "Audit Logs",
      "/admin/projects": "SLR Projects",
      "/admin/users": "Users Management",
      "/admin/agents": "AI Agents",
      "/admin/repository-api": "Repository API Access",
      "/admin/templates": "Checklist Templates",
      "/admin/quality-criteria": "Quality Criteria",
      "/admin/master-sources": "Search Sources",
      "/admin/notifications": "Notifications",
      "/admin/analytics": "Analytics",
      "/admin/settings": "System Settings",
      "/admin/profile": "My Profile",
    };

    return titles[location.pathname] || "Dashboard";
  }, [location.pathname]);

  const compactPageTitle = useMemo(() => {
    const titles: Record<string, string> = {
      "/admin/users": "Users",
      "/admin/templates": "Templates",
      "/admin/quality-criteria": "Criteria",
      "/admin/master-sources": "Sources",
      "/admin/repository-api": "Repository API",
      "/admin/settings": "Settings",
    };

    return titles[location.pathname] || pageTitle;
  }, [location.pathname, pageTitle]);

  return (
    <header className="sticky top-0 z-20 flex h-[64px] shrink-0 items-center justify-between border-b border-border bg-white/95 px-4 backdrop-blur-sm sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3.5">
        <button
          onClick={onMenuClick}
          className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-text-secondary transition-colors hover:bg-primary-light hover:text-primary lg:hidden"
          aria-label="Toggle Menu"
        >
          <FiMenu className="h-[18px] w-[18px]" />
        </button>
        <div className="min-w-0">
          <p className="hidden text-[9px] font-bold uppercase tracking-[0.13em] text-text-muted sm:block">Admin workspace</p>
          <h2 aria-label={pageTitle} className="truncate text-[16px] font-bold tracking-[-0.02em] text-text-primary sm:mt-0.5 sm:text-[18px]">
            <span className="sm:hidden">{compactPageTitle}</span>
            <span className="hidden sm:inline">{pageTitle}</span>
          </h2>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2.5 sm:gap-4">
        <AdminNotification />

        <div className="mx-0.5 h-7 w-px bg-border"></div>

        <div className="flex items-center gap-2.5 rounded-lg py-1 pl-1 sm:gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-[12px] font-bold leading-tight text-text-primary">
              {user?.name || "Admin Account"}
            </p>
            <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              {user?.role || "Super Admin"}
            </p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
            {user?.name ? getInitials(user.name) : "A"}
          </div>
        </div>
      </div>
    </header>
  );
};

export default AdminHeader;
