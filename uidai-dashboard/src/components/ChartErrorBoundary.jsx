import { Component } from "react";

export default class ChartErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // eslint-disable-next-line no-console
    console.error("Chart crashed:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const title = this.props.title || "Chart failed";
      const message = this.state.error?.message || String(this.state.error);

      return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 bg-white text-[color:var(--brand)] font-extrabold border-b border-gray-200">
            {title}
          </div>
          <div className="p-4">
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {message}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
