import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getServiceSupabase } from "./supabase";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/calendar",
            "https://www.googleapis.com/auth/drive.file",
            "https://www.googleapis.com/auth/spreadsheets.readonly",
          ].join(" "),
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, profile }) {
      // Create or update user in database on sign-in using upsert
      const supabase = getServiceSupabase();

      const { error: upsertError } = await supabase
        .from("users")
        .upsert(
          {
            email: user.email,
            name: user.name,
            picture: (profile as { picture?: string })?.picture || user.image,
          },
          {
            onConflict: "email",
            ignoreDuplicates: false,
          }
        );

      if (upsertError) {
        console.error("Failed to upsert user in database:", upsertError);
        // Still allow sign-in - the household API has a fallback to create the user
      }

      return true;
    },
    async jwt({ token, account }) {
      // Persist the OAuth access_token and refresh_token to the token
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at! * 1000;
      }
      return token;
    },
    async session({ session, token }) {
      // Send properties to the client
      session.accessToken = token.accessToken as string;

      // Check if user has a household
      if (session.user?.email) {
        const supabase = getServiceSupabase();
        const { data: user } = await supabase
          .from("users")
          .select("household_id")
          .eq("email", session.user.email)
          .single();

        session.hasHousehold = !!user?.household_id;
      }

      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
};
