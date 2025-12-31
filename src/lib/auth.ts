import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getServiceSupabase } from "./supabase";

/**
 * Refresh an expired access token using the refresh token
 */
async function refreshAccessToken(token: {
  refreshToken?: string;
  accessToken?: string;
  accessTokenExpires?: number;
}): Promise<{
  accessToken: string;
  accessTokenExpires: number;
  refreshToken: string;
  error?: string;
}> {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken!,
      }),
    });

    const refreshedTokens = await response.json();

    if (!response.ok) {
      throw refreshedTokens;
    }

    return {
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      // Fall back to old refresh token if a new one wasn't provided
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken!,
    };
  } catch (error) {
    console.error("Error refreshing access token:", error);
    return {
      accessToken: token.accessToken ?? "",
      accessTokenExpires: token.accessTokenExpires ?? 0,
      refreshToken: token.refreshToken ?? "",
      error: "RefreshAccessTokenError",
    };
  }
}

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
      // Initial sign in - persist OAuth tokens
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at! * 1000;
        return token;
      }

      // Return previous token if the access token has not expired yet
      // Add 5 minute buffer to refresh before actual expiry
      if (
        token.accessTokenExpires &&
        Date.now() < (token.accessTokenExpires as number) - 5 * 60 * 1000
      ) {
        return token;
      }

      // Access token has expired, try to refresh it
      if (token.refreshToken) {
        const refreshedTokens = await refreshAccessToken({
          refreshToken: token.refreshToken as string,
          accessToken: token.accessToken as string,
          accessTokenExpires: token.accessTokenExpires as number,
        });

        if (!refreshedTokens.error) {
          token.accessToken = refreshedTokens.accessToken;
          token.accessTokenExpires = refreshedTokens.accessTokenExpires;
          token.refreshToken = refreshedTokens.refreshToken;
        } else {
          token.error = refreshedTokens.error;
        }
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
