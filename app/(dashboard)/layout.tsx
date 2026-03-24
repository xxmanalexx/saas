import DashboardSidebar from "@/components/dashboard/DashboardSidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <DashboardSidebar />
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
