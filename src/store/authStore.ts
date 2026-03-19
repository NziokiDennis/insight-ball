import { create } from "zustand";
import type { AuthState, User } from "@/types";
import { apiClient } from "@/api/client";

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: false,

  setUser: (user: User | null, token: string | null) => {
    set({ user, accessToken: token, isAuthenticated: !!user });
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const res = await apiClient.post("/api/v1/auth/login", { email, password });
      const { access_token, user } = res.data;
      set({ user, accessToken: access_token, isAuthenticated: true, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  register: async (email: string, password: string, username?: string) => {
    set({ isLoading: true });
    try {
      const res = await apiClient.post("/api/v1/auth/register", { email, password, username });
      const { access_token, user } = res.data;
      set({ user, accessToken: access_token, isAuthenticated: true, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  logout: () => {
    apiClient.post("/api/v1/auth/logout").catch(() => {});
    set({ user: null, accessToken: null, isAuthenticated: false });
  },
}));
