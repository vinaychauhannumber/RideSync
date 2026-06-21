import { create } from "zustand";
import toast from "react-hot-toast";
import { supabase } from "../lib/supabase";

export const useAuthStore = create((set, get) => ({
  authUser: null,
  isSigningUp: false,
  isLoggingIn: false,
  isUpdatingProfile: false,
  isCheckingAuth: true,
  onlineUsers: [],
  socket: null, // Keep socket reference (will map to supabase channel) for compatibility

  checkAuth: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();

        if (profile) {
          const mappedUser = { ...profile, _id: profile.id };
          set({ authUser: mappedUser });
          get().connectSocket();
        } else {
          set({ authUser: null });
        }
      } else {
        set({ authUser: null });
      }
    } catch (error) {
      console.log("Error in checkAuth:", error);
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      const { email, password, fullName } = data;
      const { data: authData, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            fullName,
          },
        },
      });

      if (error) throw error;

      if (authData.user) {
        // Wait a brief moment to allow trigger to run in Supabase, then fetch the profile
        let profile = null;
        let retries = 5;
        while (retries > 0 && !profile) {
          const { data: p } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", authData.user.id)
            .single();
          if (p) {
            profile = p;
          } else {
            await new Promise((resolve) => setTimeout(resolve, 300));
            retries--;
          }
        }

        if (!profile) {
          // Fallback: manually insert profile if trigger failed/delayed
          const { data: newProfile, error: profileError } = await supabase
            .from("profiles")
            .insert({
              id: authData.user.id,
              email,
              fullName,
              profilePic: "",
            })
            .select()
            .single();
          if (profileError) throw profileError;
          profile = newProfile;
        }

        const mappedUser = { ...profile, _id: profile.id };
        set({ authUser: mappedUser });
        toast.success("Account created successfully");
        get().connectSocket();
      }
    } catch (error) {
      toast.error(error.message || "An error occurred during signup");
    } finally {
      set({ isSigningUp: false });
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      const { email, password } = data;
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (authData.user) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", authData.user.id)
          .single();

        if (profileError) throw profileError;

        const mappedUser = { ...profile, _id: profile.id };
        set({ authUser: mappedUser });
        toast.success("Logged in successfully");
        get().connectSocket();
      }
    } catch (error) {
      toast.error(error.message || "Invalid credentials");
    } finally {
      set({ isLoggingIn: false });
    }
  },

  logout: async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      set({ authUser: null });
      toast.success("Logged out successfully");
      get().disconnectSocket();
    } catch (error) {
      toast.error(error.message || "Error logging out");
    }
  },

  updateProfile: async (data) => {
    set({ isUpdatingProfile: true });
    try {
      const { profilePic } = data;
      const authUser = get().authUser;
      if (!authUser) throw new Error("Not authenticated");

      let imageUrl = profilePic;

      // Check if profilePic is base64 string
      if (profilePic && profilePic.startsWith("data:image")) {
        const fileExt = profilePic.split(";")[0].split("/")[1];
        const filePath = `${authUser.id}/avatar-${Date.now()}.${fileExt}`;

        const res = await fetch(profilePic);
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

      const { data: updatedProfile, error: updateError } = await supabase
        .from("profiles")
        .update({ profilePic: imageUrl, updatedAt: new Date().toISOString() })
        .eq("id", authUser.id)
        .select()
        .single();

      if (updateError) throw updateError;

      const mappedUser = { ...updatedProfile, _id: updatedProfile.id };
      set({ authUser: mappedUser });
      toast.success("Profile updated successfully");
    } catch (error) {
      console.log("error in update profile:", error);
      toast.error(error.message || "Failed to update profile");
    } finally {
      set({ isUpdatingProfile: false });
    }
  },

  connectSocket: () => {
    const { authUser } = get();
    if (!authUser || get().socket) return;

    // Track online users using Supabase Presence
    const channel = supabase.channel("online-users", {
      config: {
        presence: {
          key: authUser.id,
        },
      },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const onlineIds = Object.keys(state);
        set({ onlineUsers: onlineIds });
      });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ online_at: new Date().toISOString() });
      }
    });

    set({ socket: channel });
  },

  disconnectSocket: () => {
    const socket = get().socket;
    if (socket) {
      socket.unsubscribe();
      set({ socket: null });
    }
  },
}));
