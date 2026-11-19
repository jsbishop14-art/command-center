import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";

export default function Index() {
  redirect(currentUser() ? "/home" : "/signin");
}
