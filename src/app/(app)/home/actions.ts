"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { setHomeLayout, HOME_PANELS, type HomePanelKey } from "@/lib/prefs";

// Save the Home panel order and collapsed set for the current user (spec check 1). Validated
// against the known panel keys; unknown values are dropped by setHomeLayout.
export async function saveHomeLayoutAction(order: string[], collapsed: string[]): Promise<void> {
  const user = currentUser();
  if (!user) return;
  const keep = (v: string): v is HomePanelKey => (HOME_PANELS as readonly string[]).includes(v);
  setHomeLayout(user.id, {
    order: order.filter(keep),
    collapsed: collapsed.filter(keep),
  });
  revalidatePath("/home");
}
