import { useState } from "react"
import { Database, Upload, BarChart3, Info } from "lucide-react"
import UploadZone from "./components/UploadZone"
import ResultsTable from "./components/ResultsTable"
import EvalDashboard from "./components/EvalDashboard"

const TABS = [
  { id: "upload", label: "Upload & Extract", icon: Upload },
  { id: "eval", label: "Catalog Audit", icon: BarChart3 },
]

export default function App() {
  const [activeTab, setActiveTab] = useState("upload")
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/40 text-gray-900 flex flex-col">

      {/* ── Header ── */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200/80 shrink-0 shadow-sm shadow-blue-900/5 sticky top-0 z-50">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-0 text-center sm:text-left">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl">
              <Database size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
                SnapIMDB
              </h1>
              <p className="text-xs text-gray-500 leading-none mt-0.5">
                AI-Driven Image-to-Item Master Data Tool
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {records.length > 0 && (
              <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-full">
                {records.length} product{records.length > 1 ? "s" : ""} extracted
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ── Tabs ── */}
      <div className="bg-white border-b border-gray-200 shrink-0">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 overflow-x-auto">
          <nav className="flex gap-1 min-w-max">
            {TABS.map(tab => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3.5 text-sm font-semibold border-b-2 transition-all duration-300 ${active
                    ? "border-blue-600 text-blue-600 shadow-[0_1px_0_0_#2563eb]"
                    : "border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300"
                    }`}
                >
                  <Icon size={15} />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* ── Main content ── */}
      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">

        {activeTab === "upload" && (
          <div className="space-y-8">
            <UploadZone
              records={records}
              setRecords={setRecords}
              loading={loading}
              setLoading={setLoading}
            />

            {records.length > 0 && (
              <ResultsTable
                records={records}
                setRecords={setRecords}
              />
            )}
          </div>
        )}

        {activeTab === "eval" && (
          <EvalDashboard records={records} />
        )}

      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-200 bg-white shrink-0">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-3 text-center md:text-left">
          <p className="text-xs text-gray-500 font-medium">
            © 2026 SnapIMDB. All rights reserved.
          </p>
          <div className="flex gap-4">
            <span className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer transition-colors">Privacy Policy</span>
            <span className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer transition-colors">Terms of Service</span>
          </div>
        </div>
      </footer>

    </div>
  )
}