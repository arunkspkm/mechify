import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen print:block">
      <div className="no-print overflow-visible">
        <Sidebar />
      </div>
      <main className="flex-1 overflow-auto bg-gray-50 p-6 print:p-0 print:bg-white print:overflow-visible">{children}</main>
    </div>
  );
}
