"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

interface NotificationData {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export function NotificationPanel() {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [open, setOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!session?.user?.id) return;
    function fetchNotifications() {
      fetch("/api/notifications")
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => {
          if (json?.data) setNotifications(json.data);
        })
        .catch(() => {});
    }
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [session?.user?.id]);

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "markAllRead" }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  async function markRead(id: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "markRead", notificationId: id }),
    });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }

  // Listen for bell click event from sidebar
  useEffect(() => {
    function handleBellClick() {
      setOpen((prev) => !prev);
    }
    window.addEventListener("toggle-notifications", handleBellClick);
    return () =>
      window.removeEventListener("toggle-notifications", handleBellClick);
  }, []);

  // Expose unread count to sidebar bell badge
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("notification-count", { detail: unreadCount })
    );
  }, [unreadCount]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[9998]"
        onClick={() => setOpen(false)}
      />
      <div
        className="fixed z-[9999] w-80 max-h-96 overflow-auto bg-white border rounded-lg shadow-xl"
        style={{ top: "4rem", left: "16.5rem" }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="text-sm font-semibold text-gray-900">
            Notifications
          </span>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="text-xs text-blue-600 hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>
        {notifications.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            No notifications
          </p>
        ) : (
          notifications.slice(0, 15).map((n) => (
            <div
              key={n.id}
              className={`px-4 py-3 border-b last:border-b-0 cursor-pointer hover:bg-gray-50 ${!n.read ? "bg-blue-50" : ""}`}
              onClick={() => {
                markRead(n.id);
                setOpen(false);
                if (n.link) window.location.href = n.link;
              }}
            >
              <div className="flex items-start gap-2">
                {!n.read && (
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                )}
                <div className={!n.read ? "" : "ml-4"}>
                  <p
                    className={`text-sm leading-snug ${!n.read ? "font-semibold text-gray-900" : "font-medium text-gray-700"}`}
                  >
                    {n.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-snug">
                    {n.message}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(n.createdAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
