import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/notifications — Get notifications for current user
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "true";

  try {
    // Cleanup: delete read notifications > 7 days, all notifications > 30 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await prisma.notification.deleteMany({
      where: {
        recipientId: session.user.id,
        OR: [
          { read: true, createdAt: { lt: sevenDaysAgo } },
          { createdAt: { lt: thirtyDaysAgo } },
        ],
      },
    });

    const where: Record<string, unknown> = {
      recipientId: session.user.id,
    };
    if (unreadOnly) where.read = false;

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.notification.count({
        where: { recipientId: session.user.id, read: false },
      }),
    ]);

    return NextResponse.json({ data: notifications, unreadCount });
  } catch (err) {
    console.error("Notifications error:", err);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}

// PATCH /api/notifications — Mark notifications as read
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { action, notificationId } = body;

  try {
    if (action === "markAllRead") {
      await prisma.notification.updateMany({
        where: { recipientId: session.user.id, read: false },
        data: { read: true },
      });
      return NextResponse.json({ message: "All marked as read" });
    }

    if (action === "markRead" && notificationId) {
      await prisma.notification.update({
        where: { id: notificationId },
        data: { read: true },
      });
      return NextResponse.json({ message: "Marked as read" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("Notification update error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
