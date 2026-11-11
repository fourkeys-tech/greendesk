"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/auth";
import { execute } from "@/lib/db";

export async function markNotificationAsReadAction(notificationId: string) {
  const session = await getCurrentSession();
  if (!session) return { error: "Unauthorized" };

  try {
    await execute(
      `UPDATE "Notification"
       SET "isRead" = true
       WHERE "id" = $1 AND "recipientId" = $2`,
      [notificationId, session.id]
    );

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
    await execute(
      `UPDATE "Notification"
       SET "isRead" = true
       WHERE "recipientId" = $1 AND "isRead" = false`,
      [session.id]
    );

    revalidatePath("/dashboard/notifikasi");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal memperbarui notifikasi." };
  }
}
