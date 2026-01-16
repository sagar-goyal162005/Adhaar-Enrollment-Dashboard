import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

const rootEl = document.getElementById('root')

// Ensure user never sees a fully blank screen
if (rootEl && rootEl.childNodes.length === 0) {
  rootEl.innerHTML = '<div style="padding:24px;font-family:system-ui">Loading dashboard…</div>'
}

try {
  createRoot(rootEl).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
} catch (e) {
  // If something fails before React mounts
  // eslint-disable-next-line no-console
  console.error('Failed to bootstrap React:', e)
  if (rootEl) {
    rootEl.innerHTML = `<div style="min-height:100vh;background:#f4f1e8;padding:24px">
      <div style="max-width:820px;margin:40px auto;background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:24px">
        <h1 style="font-size:22px;font-weight:800;margin:0 0 8px">Failed to start UI</h1>
        <pre style="white-space:pre-wrap;background:#0b1020;color:#e5e7eb;padding:16px;border-radius:12px;overflow:auto">${String(e?.message || e)}</pre>
      </div>
    </div>`
  }
}
