import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export const useInboxUnreadCount = () => {
  const { user } = useAuth();
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  const fetchUnreadCount = async () => {
    if (!user) {
      setUnreadChatCount(0);
      return;
    }
    try {
      // 1. Fetch conversations the user belongs to
      const { data: convos } = await supabase
        .from("conversations")
        .select("id")
        .or(`driver_id.eq.${user.id},passenger_id.eq.${user.id}`);

      if (!convos || convos.length === 0) {
        setUnreadChatCount(0);
        return;
      }

      const convoIds = convos.map((c) => c.id);

      // 2. Fetch count of messages in those conversations where sender isn't user and read_status is not 'read'
      const { count, error } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .in("conversation_id", convoIds)
        .neq("sender_id", user.id)
        .neq("read_status", "read");

      if (error) throw error;
      setUnreadChatCount(count || 0);
    } catch (err) {
      console.error("Error fetching unread chat count:", err);
    }
  };

  useEffect(() => {
    if (!user) return;

    fetchUnreadCount();

    // Subscribe to messages changes to update unread count in real-time
    const uniqueChannelName = `unread_chat_count_realtime_${user.id}_${Math.random().toString(36).slice(2, 9)}`;
    const subscription = supabase
      .channel(uniqueChannelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages"
        },
        () => {
          fetchUnreadCount();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversations"
        },
        (payload) => {
          // If user is added to a new conversation, recalculate
          if (payload.new.driver_id === user.id || payload.new.passenger_id === user.id) {
            fetchUnreadCount();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user]);

  return { unreadChatCount, refreshCount: fetchUnreadCount };
};
