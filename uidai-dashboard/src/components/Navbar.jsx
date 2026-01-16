import { ShieldCheck } from "lucide-react";

export default function Navbar() {
  return (
    <nav className="bg-white border-b shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-3 flex justify-between items-center">
        <div className="flex items-center gap-2 text-primary font-bold text-lg">
          <ShieldCheck />
          UIDAI Analytics Dashboard
        </div>

        <div className="flex gap-6 text-sm font-medium">
          <a className="hover:text-primary" href="#">Dashboard</a>
          <a className="hover:text-primary" href="#">Insights</a>
          <a className="hover:text-primary" href="#">Forecast</a>
          <a className="hover:text-primary" href="#">Reports</a>
        </div>
      </div>
    </nav>
  );
}
