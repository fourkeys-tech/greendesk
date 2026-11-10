"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function markNotificationAsReadAction(notificationId: string) {
  const session = await getCurrentSession();
  if (!session) return { error: "Unauthorized" };

  try {
    await prisma.notification.updateMany({
      where: {
        id: notificationId,
        recipientId: session.id,
      },
      data: { isRead: true },
    });

    revalidatePath("/dashboard/notifikasi");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal memperbarui notifikasi." };
  }
}

export async function markAllNotificationsAsReadAction() {
  const session = await getCurrentSession();
  if (!session) return { error: "Unauthorized" };

  try {
    await prisma.notification.updateMany({
      where: {
        recipientId: session.id,
        isRead: false,
      },
      data: { isRead: true },
    });

    revalidatePath("/dashboard/notifikasi");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal memperbarui notifikasi." };
  }
}
