import React from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { FiBookOpen, FiLayers, FiLogOut, FiUser } from "react-icons/fi";
import Sidebar, { type SidebarItem } from "../ui/Sidebar";
import Drawer from "../ui/Drawer";
import SystemSignature from "../logo/SystemSignature";
import { logout } from "../../redux/slices/authSlice";
import { clearCurrentProject } from "../../redux/slices/projectSlice";

interface ClientWorkspaceSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

const items: SidebarItem[] = [
  { icon: FiLayers, label: "Projects", path: "/projects" },
  { icon: FiBookOpen, label: "Shared library", path: "/shared-repository" },
];

const ClientWorkspaceSidebar: React.FC<ClientWorkspaceSidebarProps> = ({
  isCollapsed,
  onToggle,
  isMobileOpen,
  onMobileClose,
}) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const footerItems: SidebarItem[] = [
    { icon: FiUser, label: "My Profile", path: "/profile" },
    {
      icon: FiLogOut,
      label: "Sign out",
      path: "",
      onClick: () => {
        dispatch(logout());
        dispatch(clearCurrentProject());
        navigate("/auth/signin");
      },
    },
  ];

  return (
    <>
      <Sidebar
        items={items}
        footerItems={footerItems}
        isCollapsed={isCollapsed}
        onToggle={onToggle}
        brandPath="/projects"
        brandLabel="SLRS projects"
        navigationLabel="Client navigation"
        className="fixed inset-y-0 left-0 z-[110] hidden h-dvh lg:flex"
      />
      <Drawer
        isOpen={isMobileOpen}
        onClose={onMobileClose}
        side="left"
        maxWidth="max-w-[280px]"
        title={<SystemSignature className="mb-0" logoClassName="h-8" />}
        contentClassName="overflow-hidden p-0"
      >
        <Sidebar
          items={items}
          footerItems={footerItems}
          isCollapsed={false}
          onToggle={() => undefined}
          onNavigate={onMobileClose}
          showBrand={false}
          showToggle={false}
          brandPath="/projects"
          brandLabel="SLRS projects"
          navigationLabel="Client navigation"
          className="h-full w-[216px] border-0"
        />
      </Drawer>
    </>
  );
};

export default ClientWorkspaceSidebar;