import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listCalendars } from "@/lib/google";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email || !session.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const calendars = await listCalendars(session.accessToken);

    // Format calendars for the frontend
    const formattedCalendars = calendars.map((cal) => ({
      id: cal.id,
      summary: cal.summary,
      description: cal.description,
      primary: cal.primary || false,
      backgroundColor: cal.backgroundColor,
      accessRole: cal.accessRole,
    }));

    return NextResponse.json({ calendars: formattedCalendars });
  } catch (error) {
    console.error("Failed to list calendars:", error);
    return NextResponse.json(
      { error: "Failed to fetch calendars. Please try signing out and back in." },
      { status: 500 }
    );
  }
}
