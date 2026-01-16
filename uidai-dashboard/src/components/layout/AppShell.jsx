import { useMemo, useState } from "react";
import { FileText, LayoutDashboard, LineChart, TrendingUp } from "lucide-react";

function NavItem({ active, icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[color:var(--brand)]/25",
        active
          ? "bg-[color:var(--brand)] text-white shadow-sm"
          : "text-[color:var(--text)] hover:bg-black/5",
      ].join(" ")}
    >
      <span
        className={
          active ? "text-white" : "text-[color:var(--muted)] group-hover:text-[color:var(--brand)]"
        }
      >
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}

export default function AppShell({
  sidebar,
  children,
  title = "UIDAI Analytics Dashboard",
  activeTab,
  onTabChange,
}) {
  const [uncontrolledTab, setUncontrolledTab] = useState("Dashboard");
  const currentTab = activeTab ?? uncontrolledTab;
  const setTab = onTabChange ?? setUncontrolledTab;

  const navItems = useMemo(
    () => [
      { label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
      { label: "Summary", icon: <TrendingUp className="w-4 h-4" /> },
      { label: "Forecast", icon: <LineChart className="w-4 h-4" /> },
      { label: "Cleaning Report", icon: <FileText className="w-4 h-4" /> },
    ],
    [],
  );

  return (
    <div className="min-h-screen bg-[color:var(--app-bg)]">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="w-[300px] bg-[color:var(--sidebar)] border-r border-[color:var(--sidebar-border)] flex flex-col">
          <div className="px-4 py-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-[color:var(--brand)] text-white flex items-center justify-center font-extrabold">
                ID
              </div>
              <div className="min-w-0">
                <div className="text-sm font-extrabold tracking-wide text-[color:var(--text)] truncate">
                  {title}
                </div>
                <div className="text-xs text-[color:var(--muted)] truncate">Aadhaar Enrollment Analytics</div>
              </div>
            </div>
          </div>

          <nav className="px-3 pb-3 space-y-1">
            {navItems.map((item) => (
              <NavItem
                key={item.label}
                active={currentTab === item.label}
                icon={item.icon}
                label={item.label}
                onClick={() => setTab(item.label)}
              />
            ))}
          </nav>

          <div className="px-3 pb-3">
            <div className="border-t border-[color:var(--sidebar-border)] pt-3" />
          </div>

          {/* Sidebar page content (filters etc.) */}
          <div className="px-3 pb-4 overflow-auto flex-1">{sidebar}</div>
        </aside>

        {/* Main */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Topbar */}
          <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm">
            <div className="min-w-0">
              <div className="text-sm text-[color:var(--muted)]">{currentTab}</div>
              <div className="text-lg font-extrabold text-[color:var(--brand)] truncate">Aadhaar Enrollment Dashboard</div>
            </div>

            <div className="flex items-center gap-3">
              <img
                src="/OIP.webp"
                alt="Aadhaar logo"
                className="h-10 w-auto object-contain"
                loading="eager"
                onError={(e) => {
                  // If the file isn't present in /public, fall back to the default Vite icon
                  // eslint-disable-next-line no-param-reassign
                  e.currentTarget.src = "/vite.svg";
                }}
              />
            </div>
          </header>

          <div className="p-6 overflow-auto flex-1">{children}</div>
        </main>
      </div>
    </div>
  );
}
