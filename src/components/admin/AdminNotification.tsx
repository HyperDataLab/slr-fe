import React, { useState, useRef, useEffect } from "react";
import { FiBell } from "react-icons/fi";
import { useUnreadCount } from "../../hooks/useNotifications";
import NotificationDropdown from "../layout/NotificationDropdown";

const AdminNotification: React.FC = () => {
  const [showNotifications, setShowNotifications] = useState(false);
  const { unreadCount } = useUnreadCount();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowNotifications(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowNotifications(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-expanded={showNotifications}
        onClick={() => setShowNotifications(!showNotifications)}
        aria-controls="notifications-popover"
        className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${
          showNotifications
            ? "bg-primary-light text-accent"
            : "text-text-secondary hover:bg-primary-light hover:text-accent"
        }`}
      >
        <FiBell size={17} />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-primary px-1 text-[9px] font-bold leading-none text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {showNotifications && (
        <NotificationDropdown
          disableNavigation
          activityPath="/admin/notifications"
          onClose={() => setShowNotifications(false)}
        />
      )}
    </div>
  );
};

export default AdminNotification;
