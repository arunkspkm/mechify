import { prisma } from "@/lib/prisma";

/**
 * Create a notification for a specific user or broadcast to all owners/managers.
 */
export async function createNotification(params: {
  type: string;
  title: string;
  message: string;
  link?: string;
  recipientId?: string; // specific user
  recipientRole?: "OWNER" | "MANAGER" | "COUNTER_OPERATOR"; // all users with this role
}) {
  const { type, title, message, link, recipientId, recipientRole } = params;

  if (recipientId) {
    // Single recipient
    await prisma.notification.create({
      data: { recipientId, type, title, message, link },
    });
  } else if (recipientRole) {
    // All users with this role
    const users = await prisma.user.findMany({
      where: { role: recipientRole, active: true },
      select: { id: true },
    });
    for (const user of users) {
      await prisma.notification.create({
        data: { recipientId: user.id, type, title, message, link },
      });
    }
  } else {
    // Broadcast to all owners and managers
    const users = await prisma.user.findMany({
      where: { role: { in: ["OWNER", "MANAGER"] }, active: true },
      select: { id: true },
    });
    for (const user of users) {
      await prisma.notification.create({
        data: { recipientId: user.id, type, title, message, link },
      });
    }
  }
}

/**
 * Notify all owners when action needs approval
 */
export async function notifyOwners(type: string, title: string, message: string, link?: string) {
  await createNotification({ type, title, message, link, recipientRole: "OWNER" });
}

/**
 * Notify a specific user
 */
export async function notifyUser(userId: string, type: string, title: string, message: string, link?: string) {
  await createNotification({ type, title, message, link, recipientId: userId });
}
