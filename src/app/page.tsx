import { redirect } from "next/navigation";
import AdminDashboard from "./components/AdminDashboard";
import { isAdminAuthed } from "@/lib/adminAuth";

export default async function Home() {
  if (!(await isAdminAuthed())) {
    redirect("/login");
  }

  return <AdminDashboard />;
}