import { TrendingUp, Award, Lightbulb } from "lucide-react";

export default function InsightPanel({ data }) {
  if (!data || data.length === 0) return null;

  // Calculate insights
  const stateData = data.reduce((acc, row) => {
    acc[row.state] = (acc[row.state] || 0) + row.total_enrolments;
    return acc;
  }, {});

  const topStates = Object.entries(stateData)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3);

  const totalEnrollments = data.reduce((sum, row) => sum + row.total_enrolments, 0);
  const top3Percentage = ((topStates.reduce((sum, [, val]) => sum + val, 0) / totalEnrollments) * 100).toFixed(1);

  return (
    <div className="bg-gradient-to-br from-white to-blue-50 p-6 rounded-xl shadow-lg border-l-4 border-primary">
      <div className="flex items-center gap-3 mb-5">
        <div className="bg-primary bg-opacity-10 rounded-lg p-2">
          <TrendingUp className="w-5 h-5 text-primary" />
        </div>
        <h3 className="font-bold text-xl text-primary">Key Insights</h3>
      </div>
      
      <div className="space-y-4 text-sm">
        <div className="p-4 bg-white rounded-lg shadow-sm border border-blue-100">
          <div className="flex items-center gap-2 mb-3">
            <Award className="w-5 h-5 text-primary" />
            <p className="font-bold text-primary">Top 3 States</p>
          </div>
          {topStates.map(([state, val], idx) => (
            <p key={idx} className="text-gray-700 font-medium py-1">
              {idx + 1}. {state}: <span className="text-primary font-bold">{val.toLocaleString()}</span>
            </p>
          ))}
          <p className="mt-3 pt-3 border-t text-xs text-gray-600 font-semibold">
            📌 Contribute {top3Percentage}% of total enrollments
          </p>
        </div>

        <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg shadow-sm border border-orange-200">
            <p className="font-bold text-orange-700 mb-2">Total Records</p>
            <p className="text-gray-800 font-bold text-lg">{data.length.toLocaleString()} filtered rows</p>
        </div>
      </div>

      <div className="mt-4 bg-gradient-to-br from-blue-100 to-blue-50 p-4 rounded-lg shadow-sm border border-blue-200">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="w-5 h-5 text-primary" />
          <p className="font-bold text-primary">Recommendations</p>
        </div>
        <ul className="space-y-2 text-gray-700 text-xs">
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold">•</span>
            <span>Focus on underperforming districts</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold">•</span>
            <span>Deploy mobile units in rural areas</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold">•</span>
            <span>Increase awareness campaigns</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
