import { useState } from "react"
import axios from "axios"
import {
  Download, Edit3, Check, X, Trash2,
  AlertTriangle, Loader2, Copy, CheckCheck
} from "lucide-react"

const API = "http://localhost:8000"

const COLUMNS = [
  { key: "item_name",        label: "ITEM NAME",      width: "min-w-[260px]" },
  { key: "barcode",          label: "BARCODE",         width: "min-w-[150px]" },
  { key: "manufacturer",     label: "MANUFACTURER",    width: "min-w-[160px]" },
  { key: "brand",            label: "BRAND",           width: "min-w-[120px]" },
  { key: "weight",           label: "WEIGHT",          width: "min-w-[100px]" },
  { key: "packaging_type",   label: "PACKAGING",       width: "min-w-[140px]" },
  { key: "country",          label: "COUNTRY",         width: "min-w-[120px]" },
  { key: "variant",          label: "VARIANT",         width: "min-w-[110px]" },
  { key: "type",             label: "TYPE",            width: "min-w-[130px]" },
  { key: "fragrance_flavor", label: "FLAVOR",          width: "min-w-[110px]" },
  { key: "promotion",        label: "PROMO",           width: "min-w-[120px]" },
  { key: "addons",           label: "ADDONS",          width: "min-w-[120px]" },
  { key: "tagline",          label: "TAGLINE",         width: "min-w-[160px]" },
]

// ── Confidence helpers ────────────────────────────────────────────────────────

function cellBg(conf, value) {
  if (!value) return "bg-gray-50 border-gray-200 text-gray-500"
  if (conf >= 0.75) return "bg-green-50 border-green-200 text-green-800"
  if (conf >= 0.50) return "bg-yellow-50 border-yellow-200 text-yellow-800"
  return "bg-red-50 border-red-200 text-red-800"
}

function dotColor(conf, value) {
  if (!value) return "bg-gray-600"
  if (conf >= 0.75) return "bg-green-400"
  if (conf >= 0.50) return "bg-yellow-400"
  return "bg-red-400"
}

function confLabel(conf) {
  if (conf >= 0.75) return `${Math.round(conf * 100)}% — high confidence`
  if (conf >= 0.50) return `${Math.round(conf * 100)}% — uncertain, review recommended`
  return `${Math.round(conf * 100)}% — low confidence, likely needs correction`
}

// ── Editable cell ─────────────────────────────────────────────────────────────

function EditableCell({ field, fieldKey, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(field.value)

  const commit = async () => {
    let normalized = draft
    try {
      const { data } = await axios.post(`${API}/normalize-field`, {
        field: fieldKey,
        value: draft,
      })
      normalized = data.normalized || draft
    } catch {
      // Use raw value if normalization fails
    }
    onSave(normalized)
    setEditing(false)
  }

  const cancel = () => {
    setDraft(field.value)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1 min-w-0 w-full">
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter")  commit()
            if (e.key === "Escape") cancel()
          }}
          className="flex-1 min-w-0 bg-white border border-blue-500 rounded px-2 py-1 text-xs text-gray-900 outline-none focus:ring-1 focus:ring-blue-400"
        />
        <button
          onClick={commit}
          className="text-green-400 hover:text-green-300 shrink-0 p-0.5"
        >
          <Check size={13} />
        </button>
        <button
          onClick={cancel}
          className="text-gray-500 hover:text-gray-300 shrink-0 p-0.5"
        >
          <X size={13} />
        </button>
      </div>
    )
  }

  return (
    <div
      onClick={() => { setEditing(true); setDraft(field.value) }}
      title={confLabel(field.confidence)}
      className={`group flex items-center gap-1.5 px-2 py-1.5 rounded border cursor-pointer
        hover:border-blue-500/70 transition-colors w-full ${cellBg(field.confidence, field.value)}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor(field.confidence, field.value)}`} />
      <span className="text-xs truncate flex-1 leading-tight">
        {field.value || <span className="text-gray-600 italic text-xs">empty</span>}
      </span>
      <Edit3 size={10} className="opacity-0 group-hover:opacity-50 shrink-0 transition-opacity" />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ResultsTable({ records, setRecords }) {
  const [exporting, setExporting]   = useState(false)
  const [copied, setCopied]         = useState(false)
  const [clearConfirm, setClearConfirm] = useState(false)

  // Update a single field value
  const updateField = (recIdx, fieldKey, newValue) => {
    setRecords(prev => prev.map((rec, i) => {
      if (i !== recIdx) return rec
      return {
        ...rec,
        [fieldKey]: {
          ...rec[fieldKey],
          value: newValue,
          confidence: 1.0,  // User-edited = full confidence
        },
      }
    }))
  }

  const deleteRecord = idx => {
    setRecords(prev => prev.filter((_, i) => i !== idx))
  }

  const clearAll = () => {
    setRecords([])
    setClearConfirm(false)
  }

  // Export to Excel
  const handleExport = async () => {
    setExporting(true)
    try {
      const resp = await axios.post(`${API}/export`, records, {
        responseType: "blob",
        headers: { "Content-Type": "application/json" },
      })
      const url = URL.createObjectURL(new Blob([resp.data]))
      const a   = document.createElement("a")
      a.href     = url
      a.download = "predictions.xlsx"
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert("Export failed: " + (err.response?.data?.detail || err.message))
    }
    setExporting(false)
  }

  // Copy summary to clipboard
  const handleCopySummary = () => {
    const lines = records.map((rec, i) => {
      const brand = rec.brand?.value || ""
      const name  = rec.item_name?.value || ""
      const bc    = rec.barcode?.value || ""
      return `${i + 1}. ${name} | ${brand} | ${bc}`
    })
    navigator.clipboard.writeText(lines.join("\n"))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  let greenCount = 0, yellowCount = 0, redCount = 0, emptyCount = 0
  records.forEach(rec => {
    COLUMNS.forEach(col => {
      const f = rec[col.key]
      if (!f || !f.value) { emptyCount++; return }
      if (f.confidence >= 0.75) greenCount++
      else if (f.confidence >= 0.50) yellowCount++
      else redCount++
    })
  })

  const totalFields   = records.length * COLUMNS.length
  const filledFields  = totalFields - emptyCount
  const fillRate      = totalFields > 0 ? Math.round(filledFields / totalFields * 100) : 0
  const dupCount      = records.filter(r => r.is_duplicate).length
  const conflictCount = records.filter(r => r.has_conflicts).length

  return (
    <div className="space-y-5">

      {/* ── Stats bar ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Products",   value: records.length,  color: "text-white" },
          { label: "Fill rate",  value: `${fillRate}%`,  color: "text-blue-300" },
          { label: "High conf",  value: greenCount,       color: "text-green-400" },
          { label: "Uncertain",  value: yellowCount,      color: "text-yellow-400" },
          { label: "Flagged",    value: redCount,         color: "text-red-400" },
        ].map(s => (
          <div key={s.label} className="bg-white/80 backdrop-blur-sm border border-gray-200/80 rounded-2xl px-5 py-4 shadow-sm hover:shadow-lg hover:shadow-blue-900/5 hover:-translate-y-1 transition-all duration-300">
            <p className="text-xs text-gray-500 font-medium">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 text-gray-900`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Duplicate / conflict alerts */}
      {dupCount > 0 && (
        <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-4 py-2.5">
          <AlertTriangle size={15} className="text-orange-500 shrink-0" />
          <p className="text-sm text-orange-800">
            <span className="font-semibold">{dupCount} duplicate record{dupCount > 1 ? "s" : ""}</span> detected
            — marked in the table below. Review before exporting.
          </p>
        </div>
      )}
      {conflictCount > 0 && (
        <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2.5">
          <AlertTriangle size={15} className="text-yellow-500 shrink-0" />
          <p className="text-sm text-yellow-800">
            <span className="font-semibold">{conflictCount} record{conflictCount > 1 ? "s" : ""}</span> have
            critic-flagged inconsistencies — see notes in the table.
          </p>
        </div>
      )}

      {/* ── Action bar ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleCopySummary}
            className="flex items-center gap-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg text-xs transition-colors"
          >
            {copied ? <CheckCheck size={14} className="text-green-400" /> : <Copy size={14} />}
            {copied ? "Copied!" : "Copy summary"}
          </button>
          {clearConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Clear all records?</span>
              <button onClick={clearAll} className="text-xs text-red-400 hover:text-red-300 font-medium">Yes, clear</button>
              <button onClick={() => setClearConfirm(false)} className="text-xs text-gray-500 hover:text-gray-300">Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => setClearConfirm(true)}
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        <button
          onClick={handleExport}
          disabled={exporting}
          className="w-full sm:w-auto flex justify-center items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-white px-6 py-2.5 rounded-2xl text-sm font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-teal-500/30 hover:scale-[1.02] active:scale-95"
        >
          {exporting
            ? <><Loader2 size={16} className="animate-spin" /> Exporting…</>
            : <><Download size={16} /> Export predictions.xlsx</>
          }
        </button>
      </div>

      {/* ── Table ── */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200/80 shadow-md shadow-blue-900/5 bg-white/80 backdrop-blur-sm">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gradient-to-r from-gray-50 to-slate-50 border-b border-gray-200/80">
              <th className="px-3 py-3 text-left text-xs text-gray-500 font-medium w-10 shrink-0">#</th>
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  className={`px-2 py-3 text-left text-xs text-gray-600 font-semibold tracking-wide ${col.width}`}
                >
                  {col.label}
                </th>
              ))}
              <th className="px-3 py-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {records.map((rec, recIdx) => (
              <>
                <tr
                  key={`row-${recIdx}`}
                  className={`border-b border-gray-100 transition-colors ${
                    rec.is_duplicate
                      ? "bg-orange-50 hover:bg-orange-100"
                      : "hover:bg-gray-50"
                  }`}
                >
                  {/* Row number */}
                  <td className="px-3 py-2 text-xs text-gray-600 shrink-0">
                    {rec.is_duplicate
                      ? <span title="Duplicate detected">⚠</span>
                      : recIdx + 1
                    }
                  </td>

                  {/* Data cells */}
                  {COLUMNS.map(col => (
                    <td key={col.key} className="px-2 py-1.5">
                      <EditableCell
                        field={rec[col.key] || { value: "", confidence: 0 }}
                        fieldKey={col.key}
                        onSave={val => updateField(recIdx, col.key, val)}
                      />
                    </td>
                  ))}

                  {/* Delete */}
                  <td className="px-3 py-2">
                    <button
                      onClick={() => deleteRecord(recIdx)}
                      className="text-gray-700 hover:text-red-400 transition-colors"
                      title="Delete record"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>

                {/* Duplicate note row */}
                {rec.is_duplicate && (
                  <tr key={`dup-${recIdx}`} className="border-b border-gray-100 bg-orange-50/50">
                    <td colSpan={COLUMNS.length + 2} className="px-4 py-1.5">
                      <span className="text-xs text-orange-600 flex items-center gap-1.5">
                        <AlertTriangle size={11} />
                        Duplicate of product: <span className="font-mono font-medium">{rec.duplicate_of}</span>
                      </span>
                    </td>
                  </tr>
                )}

                {/* Conflict note row */}
                {rec.has_conflicts && rec.conflict_notes && (
                  <tr key={`conf-${recIdx}`} className="border-b border-gray-100 bg-yellow-50/50">
                    <td colSpan={COLUMNS.length + 2} className="px-4 py-1.5">
                      <span className="text-xs text-yellow-600 flex items-center gap-1.5">
                        <AlertTriangle size={11} />
                        Critic note: {rec.conflict_notes}
                      </span>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-600">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-400" /> ≥75% high confidence
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-yellow-400" /> 50–74% uncertain
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-400" /> &lt;50% flagged
        </span>
        <span className="text-gray-700">· Click any cell to edit · Enter to save · Esc to cancel</span>
      </div>

    </div>
  )
}