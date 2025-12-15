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
      // Create or update user in database on sign-in
      const supabase = getServiceSupabase();

      const { data: existingUser, error: selectError } = await supabase
        .from("users")
        .select("id, household_id")
        .eq("email", user.email)
        .single();

      // PGRST116 means no rows found, which is expected for new users
      if (selectError && selectError.code !== "PGRST116") {
        console.error("Error checking for existing user:", selectError);
      }

      if (!existingUser) {
        // Create new user
        const { error: insertError } = await supabase.from("users").insert({
          email: user.email,
          name: user.name,
          picture: (profile as { picture?: string })?.picture || user.image,
        });

        if (insertError) {
          console.error("Failed to create user in database:", insertError);
          // Still allow sign-in, but log the error
          // The user can try again and hopefully the insert will succeed
        }
      } else {
        // Update existing user's profile
        const { error: updateError } = await supabase
          .from("users")
          .update({
            name: user.name,
            picture: (profile as { picture?: string })?.picture || user.image,
          })
          .eq("email", user.email);

        if (updateError) {
          console.error("Failed to update user in database:", updateError);
        }
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
