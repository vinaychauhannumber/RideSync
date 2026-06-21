import { create } from "zustand";
import toast from "react-hot-toast";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,
  messageChannel: null,

  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const authUser = useAuthStore.getState().authUser;
      if (!authUser) return;

      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*")
        .neq("id", authUser.id);

      if (error) throw error;

      const mappedUsers = profiles.map((p) => ({ ...p, _id: p.id }));
      set({ users: mappedUsers });
    } catch (error) {
      toast.error(error.message || "Failed to load users");
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessages: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const authUser = useAuthStore.getState().authUser;
      if (!authUser) return;

      const { data: messages, error } = await supabase
        .from("messages")
        .select("*")
        .or(`and(senderId.eq.${authUser.id},receiverId.eq.${userId}),and(senderId.eq.${userId},receiverId.eq.${authUser.id})`)
        .order("createdAt", { ascending: true });

      if (error) throw error;

      const mappedMessages = messages.map((m) => ({ ...m, _id: m.id }));
      set({ messages: mappedMessages });
    } catch (error) {
      toast.error(error.message || "Failed to get messages");
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendMessage: async (messageData) => {
    const { selectedUser, messages } = get();
    const authUser = useAuthStore.getState().authUser;
    if (!authUser || !selectedUser) return;

    try {
      const { text, image } = messageData;
      let imageUrl = image;

      if (image && image.startsWith("data:image")) {
        const fileExt = image.split(";")[0].split("/")[1];
        const filePath = `${authUser.id}/chat-${Date.now()}.${fileExt}`;

        const res = await fetch(image);
        const blob = await res.blob();

        const { error: uploadError } = await supabase.storage
          .from("chat-assets")
          .upload(filePath, blob, {
            contentType: blob.type,
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("chat-assets")
          .getPublicUrl(filePath);

        imageUrl = urlData.publicUrl;
      }

      const { data: newMessage, error } = await supabase
        .from("messages")
        .insert({
          senderId: authUser.id,
          receiverId: selectedUser.id,
          text: text || null,
          image: imageUrl || null,
        })
        .select()
        .single();

      if (error) throw error;

      const mappedMessage = { ...newMessage, _id: newMessage.id };
      set({ messages: [...messages, mappedMessage] });
    } catch (error) {
      toast.error(error.message || "Failed to send message");
    }
  },

  subscribeToMessages: () => {
    const { selectedUser } = get();
    if (!selectedUser) return;

    const authUser = useAuthStore.getState().authUser;
    if (!authUser) return;

    if (get().messageChannel) {
      get().messageChannel.unsubscribe();
    }

    const channel = supabase
      .channel(`chat-channel-${selectedUser.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `receiverId=eq.${authUser.id}`,
        },
        (payload) => {
          const newMessage = payload.new;
          if (newMessage.senderId === selectedUser.id) {
            const mappedMessage = { ...newMessage, _id: newMessage.id };
            set({
              messages: [...get().messages, mappedMessage],
            });
          }
        }
      )
      .subscribe();

    set({ messageChannel: channel });
  },

  unsubscribeFromMessages: () => {
    const channel = get().messageChannel;
    if (channel) {
      channel.unsubscribe();
      set({ messageChannel: null });
    }
  },

  setSelectedUser: (selectedUser) => set({ selectedUser }),
}));
