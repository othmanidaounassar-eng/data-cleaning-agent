import { Sidebar } from "@/components/dashboard/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-base-950">
      <Sidebar />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
