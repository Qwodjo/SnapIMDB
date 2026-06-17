import { useState } from "react"
import axios from "axios"
import {
  Upload, Loader2, BarChart3, TrendingUp,
  AlertTriangle, CheckCircle2, XCircle, Info
} from "lucide-react"

const API = import.meta.env.VITE_API_URL || "https://snapimdb-api.onrender.com";

const COLUMN_LABELS = {
  item_name: "Item Name",
  barcode: "Barcode",
  manufacturer: "Manufacturer",
  brand: "Brand",
  weight: "Weight",
  pagkaging_type: "Packaging Type",
  country: "Country",
  variant: "Variant",
  type: "Type",
  fragrance_flavor: "Flavor / Fragrance",
  promotion: "Promotion",
  addons: "Addons",
  tagline: "Tagline",
}

// ── Accuracy bar ──────────────────────────────────────────────────────────────

function AccuracyBar({ label, value, rank }) {
  const pct = Math.round(value * 100)
  const barColor =
    pct >= 80 ? "bg-green-500" :
      pct >= 60 ? "bg-yellow-500" :
        pct >= 40 ? "bg-orange-500" : "bg-red-500"

  const textColor =
    pct >= 80 ? "text-green-400" :
      pct >= 60 ? "text-yellow-400" :
        pct >= 40 ? "text-orange-400" : "text-red-400"

  const icon =
    pct >= 80 ? <CheckCircle2 size={13} className="text-green-400 shrink-0" /> :
      pct >= 60 ? <AlertTriangle size={13} className="text-yellow-400 shrink-0" /> :
        <XCircle size={13} className="text-red-400 shrink-0" />

  return (
    <div className="flex items-center gap-3 group">
      <span className="text-xs text-gray-500 w-5 text-right shrink-0">{rank}</span>
      {icon}
      <span className="text-xs text-gray-500 w-36 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
        <div
          className={`${barColor} h-2.5 rounded-full transition-all duration-700 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs font-mono font-semibold w-10 text-right shrink-0 ${textColor}`}>
        {pct}%
      </span>
    </div>
  )
}

// ── Score card ────────────────────────────────────────────────────────────────

function ScoreCard({ label, value, sub, color }) {
  return (
    <div className="bg-white/80 backdrop-blur-sm border border-gray-200/80 shadow-sm hover:shadow-lg hover:shadow-blue-900/5 hover:-translate-y-1 transition-all duration-300 rounded-2xl p-5">
      <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function EvalDashboard({ records }) {
  const [gtFile, setGtFile] = useState(null)
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleFileChange = e => {
    const file = e.target.files[0]
    if (file) {
      setGtFile(file)
      setResults(null)
      setError("")
    }
  }

  const runEval = async () => {
    if (!gtFile || !records.length) return
    setLoading(true)
    setError("")

    try {
      const form = new FormData()
      form.append("ground_truth_file", gtFile)
      form.append("predictions", JSON.stringify(records))

      const { data } = await axios.post(`${API}/evaluate-file`, form, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 60000,
      })

      setResults(data)
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || "Unknown error"
      setError(`Evaluation failed: ${msg}`)
    }

    setLoading(false)
  }

  // Sort columns by accuracy ascending (weakest first — most useful for debugging)
  const sortedColumns = results
    ? Object.entries(results.per_column).sort((a, b) => a[1] - b[1])
    : []

  const overallPct = results ? Math.round(results.overall * 100) : null
  const overallColor =
    overallPct == null ? "text-gray-600" :
      overallPct >= 80 ? "text-green-400" :
        overallPct >= 60 ? "text-yellow-400" : "text-red-400"

  const strongFields = results
    ? Object.entries(results.per_column).filter(([, v]) => v >= 0.8).length
    : 0
  const weakFields = results
    ? Object.entries(results.per_column).filter(([, v]) => v < 0.6).length
    : 0

  return (
    <div className="space-y-8">

      {/* ── Header ── */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 size={20} className="text-blue-600" />
          Data Quality & Audit Report
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Upload your existing master data file (Excel/CSV) to audit the newly digitized records.
        </p>
      </div>

      {/* ── Info banner ── */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-3 flex items-start gap-3">
        <Info size={15} className="text-blue-600 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-800 leading-relaxed">
          The system automatically cross-references your uploaded legacy data against the newly extracted physical items.
          It matches records by position, flags discrepancies case-insensitively, and reports overall accuracy so you can ensure your catalog is 100% accurate before exporting.
        </p>
      </div>

      {/* ── Score cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <ScoreCard
          label="Predictions loaded"
          value={records.length}
          sub="products extracted"
          color="text-gray-900"
        />
        <ScoreCard
          label="Overall accuracy"
          value={overallPct != null ? `${overallPct}%` : "—"}
          sub={results ? `${results.records_compared} records compared` : "run eval to see"}
          color={overallColor}
        />
        <ScoreCard
          label="Strong fields"
          value={results ? strongFields : "—"}
          sub="≥ 80% accuracy"
          color="text-green-400"
        />
        <ScoreCard
          label="Weak fields"
          value={results ? weakFields : "—"}
          sub="< 60% accuracy"
          color="text-red-400"
        />
      </div>

      {/* ── Upload + run ── */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">
          Upload Existing Master Data
        </h3>

        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <label className={`flex-1 sm:flex-none flex items-center justify-center gap-2 cursor-pointer border px-4 py-2.5 rounded-xl text-sm transition-colors ${gtFile
            ? "bg-blue-50 border-blue-200 text-blue-700"
            : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`}>
            <Upload size={15} />
            {gtFile ? gtFile.name : "Choose Excel or CSV file"}
            <input
              type="file"
              accept=".xlsx,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          <button
            onClick={runEval}
            disabled={!gtFile || !records.length || loading}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-2xl text-sm font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-95"
          >
            {loading
              ? <><Loader2 size={15} className="animate-spin" /> Running evaluation…</>
              : <><TrendingUp size={15} /> Run evaluation</>
            }
          </button>
        </div>

        {/* Warnings */}
        {!records.length && (
          <p className="text-xs text-yellow-500 flex items-center gap-1.5">
            <AlertTriangle size={12} />
            No predictions loaded — go to the Upload tab and extract products first.
          </p>
        )}
        {records.length > 0 && !gtFile && (
          <p className="text-xs text-gray-500 flex items-center gap-1.5">
            <Info size={12} />
            {records.length} product{records.length > 1 ? "s" : ""} ready.
            Upload your master data file to run the audit.
          </p>
        )}
        {error && (
          <p className="text-xs text-red-400 flex items-center gap-1.5">
            <XCircle size={12} />
            {error}
          </p>
        )}
      </div>

      {/* ── Per-column accuracy bars ── */}
      {results && (
        <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              Per-column accuracy
              <span className="text-xs text-gray-500 font-normal ml-2">
                (sorted weakest → strongest)
              </span>
            </h3>
            <span className={`text-sm font-bold ${overallColor}`}>
              Overall: {overallPct}%
            </span>
          </div>

          <div className="space-y-2.5">
            {sortedColumns.map(([key, val], idx) => (
              <AccuracyBar
                key={key}
                rank={idx + 1}
                label={COLUMN_LABELS[key] || key}
                value={val}
              />
            ))}
          </div>

          {/* Overall bar */}
          <div className="pt-3 border-t border-gray-100">
            <AccuracyBar
              rank="Σ"
              label="Overall average"
              value={results.overall}
            />
          </div>
        </div>
      )}

      {/* ── Improvement tips ── */}
      {results && weakFields > 0 && (
        <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-6 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <AlertTriangle size={15} className="text-yellow-500" />
            Fields to improve
          </h3>
          <ul className="space-y-2">
            {sortedColumns
              .filter(([, v]) => v < 0.6)
              .map(([key, val]) => (
                <li key={key} className="flex items-start gap-2 text-xs text-gray-600">
                  <span className="text-red-500 font-mono shrink-0 mt-0.5">
                    {Math.round(val * 100)}%
                  </span>
                  <span>
                    <span className="text-gray-900 font-medium">{COLUMN_LABELS[key]}</span>
                    {" — "}
                    {key === "barcode" && "Check image resolution. Barcode may be blurry or partially occluded."}
                    {key === "country" && "Try adding more country examples to the extraction prompt."}
                    {key === "item_name" && "Item name reconstruction depends on other fields being accurate first."}
                    {key === "packaging_type" && "Add more packaging variants to the normalization lookup table."}
                    {key === "manufacturer" && "Manufacturer is often not printed — may need brand→manufacturer mapping."}
                    {key === "variant" && "Variant is often absent — check if ground truth has many empty values too."}
                    {key === "fragrance_flavor" && "Flavor may not apply to all products — empty is valid."}
                    {key === "promotion" && "Promotions vary per batch — may not be visible on all images."}
                    {key === "tagline" && "Taglines are small text — image resolution may be limiting extraction."}
                    {key === "addons" && "Addons are rare — empty is valid for most products."}
                    {key === "weight" && "Check weight format — should be 250G, 500 ML, 1.5 KG."}
                    {key === "brand" && "Brand should be clearly visible — check image quality."}
                    {key === "type" && "Type can be inferred from item name if not explicitly stated."}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* ── Empty state ── */}
      {!results && (
        <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-8 text-center">
          <BarChart3 size={40} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-900 font-medium">No audit results yet</p>
          <p className="text-gray-500 text-sm mt-2 max-w-sm mx-auto">
            Extract products from the Upload tab, then upload your existing master data
            file here to audit catalog accuracy.
          </p>
        </div>
      )}

    </div>
  )
}