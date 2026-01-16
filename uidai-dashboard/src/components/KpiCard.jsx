export default function KpiCard({ title, value, color, icon }) {
  return (
    <div
      className="relative overflow-hidden bg-white rounded-xl p-6 shadow-sm border hover:shadow-md transition-all duration-300 transform hover:-translate-y-0.5"
      style={{ borderColor: "#E5E7EB" }}
    >
      <div
        className="absolute left-0 top-0 h-full w-[4px]"
        style={{
          background: color,
        }}
      />
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs text-gray-700 uppercase tracking-wide font-extrabold mb-3">{title}</p>
          <h2 className="text-3xl font-extrabold" style={{ color }}>
            {value}
          </h2>
        </div>
        {icon && (
          <div 
            className="rounded-full p-3"
            style={{ backgroundColor: "#F3F4F6" }}
          >
            <div style={{ color }} className="opacity-80">
              {icon}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
