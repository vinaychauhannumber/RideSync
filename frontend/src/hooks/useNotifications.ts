import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { Notification } from "../types";

export const useNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
      setUnreadCount((data || []).filter((n) => !n.is_read).length);
    } catch (err) {
      console.error("Error fetching notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  const markAllAsRead = async () => {
    if (!user || notifications.length === 0) return;
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (error) throw error;
      
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Error marking notifications as read:", err);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId);

      if (error) throw error;

      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  const createNotification = async (
    targetUserId: string,
    type: string,
    title: string,
    content: string,
    linkId?: string
  ) => {
    try {
      const { error } = await supabase.from("notifications").insert({
        user_id: targetUserId,
        type,
        title,
        content,
        link_id: linkId || null,
        is_read: false,
      });

      if (error) throw error;
    } catch (err) {
      console.error("Error creating notification:", err);
    }
  };

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    fetchNotifications();

    // Subscribe to notifications table
    // Subscribe to notifications table with a unique channel name per hook instance
    const channelId = `notifications_${user.id}_${Math.random().toString(36).slice(2, 9)}`;
    const subscription = supabase
      .channel(channelId)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newNotif = payload.new as Notification;
            setNotifications((prev) => {
              const updated = [newNotif, ...prev];
              setUnreadCount(updated.filter((n) => !n.is_read).length);
              return updated;
            });
          } else if (payload.eventType === "UPDATE") {
            const updatedNotif = payload.new as Notification;
            setNotifications((prev) => {
              const updated = prev.map((n) => (n.id === updatedNotif.id ? updatedNotif : n));
              setUnreadCount(updated.filter((n) => !n.is_read).length);
              return updated;
            });
          } else if (payload.eventType === "DELETE") {
            const deletedNotif = payload.old as Notification;
            setNotifications((prev) => {
              const updated = prev.filter((n) => n.id !== deletedNotif.id);
              setUnreadCount(updated.filter((n) => !n.is_read).length);
              return updated;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user]);

  return {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAllAsRead,
    markAsRead,
    createNotification,
  };
};
