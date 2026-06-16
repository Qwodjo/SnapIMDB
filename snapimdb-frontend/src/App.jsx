import { useState } from "react"
import { Database, Upload, BarChart3, Info } from "lucide-react"
import UploadZone from "./components/UploadZone"
import ResultsTable from "./components/ResultsTable"
import EvalDashboard from "./components/EvalDashboard"

const TABS = [
  { id: "upload", label: "Upload & Extract", icon: Upload },
  { id: "eval",   label: "Eval Dashboard",   icon: BarChart3 },
]

export default function App() {
  const [activeTab, setActiveTab]   = useState("upload")
  const [records, setRecords]       = useState([])
  const [loading, setLoading]       = useState(false)

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">

      {/* ── Header ── */}
      <header className="bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="max-w-screen-xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl">
              <Database size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                SnapIMDB
              </h1>
              <p className="text-xs text-gray-400 leading-none mt-0.5">
                AI-Driven Image-to-Item Master Data Tool
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {records.length > 0 && (
              <span className="text-xs bg-blue-900/50 text-blue-300 border border-blue-800 px-3 py-1 rounded-full">
                {records.length} product{records.length > 1 ? "s" : ""} extracted
              </span>
            )}
            <span className="text-xs text-gray-500 bg-gray-800 px-3 py-1.5 rounded-full">
              GDSS-Maverick Hackathon 2025
            </span>
          </div>
        </div>
      </header>

      {/* ── Tabs ── */}
      <div className="bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="max-w-screen-xl mx-auto px-6">
          <nav className="flex gap-1">
            {TABS.map(tab => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    active
                      ? "border-blue-500 text-blue-400"
                      : "border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-600"
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
      <main className="flex-1 max-w-screen-xl mx-auto w-full px-6 py-8">

        {activeTab === "upload" && (
          <div className="space-y-8">
            {/* Pipeline explanation banner */}
            <div className="bg-blue-950/30 border border-blue-900/50 rounded-xl px-5 py-3 flex items-start gap-3">
              <Info size={16} className="text-blue-400 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-300 leading-relaxed">
                <span className="font-semibold text-blue-200">How it works: </span>
                Upload 1–8 images of the same product (or mix multiple products) →
                Gemini 2.5 Flash extracts all 13 IMDB fields from each image →
                Confidence-weighted fusion picks the best value per field →
                A critic AI reviews for inconsistencies →
                Review the color-coded table and edit any cell → Export predictions.xlsx
              </p>
            </div>

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
      <footer className="border-t border-gray-800 bg-gray-900 shrink-0">
        <div className="max-w-screen-xl mx-auto px-6 py-3 flex items-center justify-between">
          <p className="text-xs text-gray-600">
            SnapIMDB · Multi-image fusion · Two-pass critic · Confidence scoring · Duplicate detection
          </p>
          <p className="text-xs text-gray-600">
            Gemini 2.5 Flash · FastAPI · React
          </p>
        </div>
      </footer>

    </div>
  )
}