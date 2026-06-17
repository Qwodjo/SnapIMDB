import { useState, useRef, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import axios from "axios"
import {
  Upload, Camera, X, Loader2, AlertTriangle,
  CheckCircle2, Package, ZapOff, Zap
} from "lucide-react"

const API = "http://localhost:8000"

export default function UploadZone({ records, setRecords, loading, setLoading }) {
  const [mode, setMode]           = useState("upload")
  const [queued, setQueued]       = useState([])
  const [error, setError]         = useState("")
  const [progress, setProgress]   = useState("")
  const [cameraActive, setCameraActive] = useState(false)
  const videoRef  = useRef(null)
  const streamRef = useRef(null)

  // Dropzone
  const onDrop = useCallback(accepted => {
    const items = accepted.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      productGroup: file.name.split("_")[0] || file.name.replace(/\.[^.]+$/, ""),
    }))
    setQueued(prev => [...prev, ...items])
    setError("")
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp"] },
    multiple: true,
  })

  const removeQueued = idx => setQueued(prev => prev.filter((_, i) => i !== idx))
  const clearAll     = () => setQueued([])

  // Camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: 1280, height: 720 }
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setCameraActive(true)
      setError("")
    } catch {
      setError("Camera access denied. Please allow camera permissions and try again.")
    }
  }

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setCameraActive(false)
  }

  const capturePhoto = () => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement("canvas")
    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext("2d").drawImage(video, 0, 0)
    canvas.toBlob(blob => {
      if (!blob) return
      const ts   = Date.now()
      const file = new File([blob], `capture_${ts}.jpg`, { type: "image/jpeg" })
      setQueued(prev => [...prev, {
        file,
        preview: URL.createObjectURL(blob),
        productGroup: `capture_${ts}`,
      }])
    }, "image/jpeg", 0.92)
  }

  // Extract
  const handleExtract = async () => {
    if (!queued.length) return
    setLoading(true)
    setError("")

    // Group by product prefix
    const groups = {}
    queued.forEach(item => {
      const g = item.productGroup
      if (!groups[g]) groups[g] = []
      groups[g].push(item.file)
    })

    const groupEntries = Object.entries(groups)
    const newRecords   = []

    for (let i = 0; i < groupEntries.length; i++) {
      const [prefix, files] = groupEntries[i]
      setProgress(`Extracting product ${i + 1} of ${groupEntries.length}: ${prefix}…`)

      try {
        const form = new FormData()
        files.forEach(f => form.append("files", f))

        const { data } = await axios.post(`${API}/extract`, form, {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 120000,
        })

        newRecords.push({ ...data, _id: prefix })
      } catch (err) {
        const msg = err.response?.data?.detail || err.message || "Unknown error"
        setError(`Failed on ${prefix}: ${msg}`)
      }
    }

    if (newRecords.length > 0) {
      setRecords(prev => [...prev, ...newRecords])
      setQueued([])
    }

    setProgress("")
    setLoading(false)
  }

  // Batch extract (all at once via /batch-extract)
  const handleBatchExtract = async () => {
    if (!queued.length) return
    setLoading(true)
    setError("")
    setProgress("Sending all images to batch pipeline…")

    try {
      const form = new FormData()
      queued.forEach(item => form.append("files", item.file))

      const { data } = await axios.post(`${API}/batch-extract`, form, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 300000,
      })

      setRecords(prev => [...prev, ...data.records])
      setQueued([])

      const summary = []
      if (data.duplicates_found > 0)
        summary.push(`${data.duplicates_found} duplicate(s) flagged`)
      if (data.conflicts_found > 0)
        summary.push(`${data.conflicts_found} conflict(s) detected`)
      if (summary.length)
        setError(`Done - ${summary.join(", ")}`)

    } catch (err) {
      const msg = err.response?.data?.detail || err.message || "Unknown error"
      setError(`Batch extraction failed: ${msg}`)
    }

    setProgress("")
    setLoading(false)
  }

  // Grouped view
  const groupedQueued = queued.reduce((acc, item, idx) => {
    const g = item.productGroup
    if (!acc[g]) acc[g] = []
    acc[g].push({ ...item, idx })
    return acc
  }, {})

  const productCount = Object.keys(groupedQueued).length

  return (
    <div className="space-y-6">

      {/* Mode toggle */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => { setMode("upload"); stopCamera() }}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === "upload"
              ? "bg-blue-600 text-white"
              : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          <Upload size={15} /> Upload files
        </button>
        <button
          onClick={() => { setMode("camera"); startCamera() }}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === "camera"
              ? "bg-blue-600 text-white"
              : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          <Camera size={15} /> Live camera
        </button>
      </div>

      {/* Upload dropzone */}
      {mode === "upload" && (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-3xl p-8 sm:p-14 text-center cursor-pointer transition-all duration-300 ${
            isDragActive
              ? "border-blue-500 bg-blue-50/50 scale-[1.02] shadow-xl shadow-blue-500/10"
              : "border-gray-300 hover:border-blue-400 bg-white hover:bg-blue-50/30 hover:shadow-lg hover:shadow-blue-900/5 hover:-translate-y-0.5"
          }`}
        >
          <input {...getInputProps()} />
          <Upload size={44} className={`mx-auto mb-4 ${isDragActive ? "text-blue-500" : "text-gray-400"}`} />
          <p className="text-gray-900 font-semibold text-base sm:text-lg">
            {isDragActive ? "Drop images here…" : "Upload Product Photos for Digitization"}
          </p>
          <p className="text-gray-500 text-xs sm:text-sm mt-2 max-w-md mx-auto px-4">
            Upload multiple angles of the same product. Files sharing a prefix
            (e.g. <span className="font-mono text-gray-600 font-medium">SKU1234_*</span>)
            will be combined into a single, highly-detailed product record.
          </p>
          <p className="text-gray-400 text-xs mt-3 font-medium tracking-wide">JPG · PNG · WEBP supported</p>
        </div>
      )}

      {/* Camera view */}
      {mode === "camera" && (
        <div className="bg-white rounded-2xl overflow-hidden border border-gray-200">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full max-h-80 object-cover bg-black"
          />
          <div className="p-4 flex flex-wrap gap-2 sm:gap-3 justify-center items-center">
            <button
              onClick={capturePhoto}
              disabled={!cameraActive}
              className="flex-1 sm:flex-none justify-center bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 text-white px-6 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-95"
            >
              <Camera size={16} /> Capture
            </button>
            <button
              onClick={stopCamera}
              className="flex-1 sm:flex-none justify-center bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              Stop
            </button>
            {!cameraActive && (
              <button
                onClick={startCamera}
                className="flex-1 sm:flex-none justify-center bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                Start camera
              </button>
            )}
          </div>
        </div>
      )}

      {/* Queued files */}
      {queued.length > 0 && (
        <div className="space-y-4">

          {/* Queue header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <p className="text-sm text-gray-500">
              <span className="font-semibold text-gray-900">{queued.length}</span> image{queued.length > 1 ? "s" : ""} queued
              across <span className="font-semibold text-gray-900">{productCount}</span> product{productCount > 1 ? "s" : ""}
            </p>
            <button
              onClick={clearAll}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Clear all
            </button>
          </div>

          {/* Product groups */}
          {Object.entries(groupedQueued).map(([group, items]) => (
            <div key={group} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg hover:shadow-blue-900/5 hover:-translate-y-1 transition-all duration-300 overflow-hidden group/card">
              <div className="px-4 py-3 bg-gray-50/80 border-b border-gray-100 flex items-center gap-2">
                <Package size={14} className="text-blue-600 shrink-0" />
                <span className="text-xs font-mono text-blue-800 font-semibold">{group}</span>
                <span className="text-xs text-gray-500 ml-1">
                  {items.length} angle{items.length > 1 ? "s" : ""} →
                  {items.length > 1
                    ? ` will fuse ${items.length} images for best accuracy`
                    : " single image extraction"}
                </span>
              </div>
              <div className="p-3 flex gap-2 flex-wrap">
                {items.map(item => (
                  <div key={item.idx} className="relative group">
                    <img
                      src={item.preview}
                      alt=""
                      className="w-20 h-20 object-cover rounded-lg border border-gray-200 shadow-sm"
                    />
                    <button
                      onClick={() => removeQueued(item.idx)}
                      className="absolute -top-1.5 -right-1.5 bg-red-600 hover:bg-red-500 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={10} className="text-white" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Extract buttons */}
          <div className="flex flex-col md:flex-row gap-3">
            {/* Per-product sequential */}
            <button
              onClick={handleExtract}
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white py-3.5 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-[1.01] active:scale-95 text-sm"
            >
              {loading && progress ? (
                <>
                  <Loader2 size={17} className="animate-spin" />
                  {progress}
                </>
              ) : (
                <>
                  <Zap size={17} />
                  Extract {productCount} product{productCount > 1 ? "s" : ""} (with progress)
                </>
              )}
            </button>

            {/* Full batch */}
            {productCount > 1 && (
              <button
                onClick={handleBatchExtract}
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 text-white py-3.5 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/30 hover:scale-[1.01] active:scale-95 text-sm"
              >
                {loading ? (
                  <>
                    <Loader2 size={17} className="animate-spin" />
                    {progress || "Processing batch…"}
                  </>
                ) : (
                  <>
                    <ZapOff size={17} />
                    Batch extract all at once
                  </>
                )}
              </button>
            )}
          </div>

        </div>
      )}

      {/* Error / success message */}
      {error && (
        <div className={`flex items-start gap-3 rounded-xl p-4 border ${
          error.startsWith("Done - ")
            ? "bg-green-50 border-green-200 text-green-800"
            : "bg-red-50 border-red-200 text-red-800"
        }`}>
          <AlertTriangle size={17} className="mt-0.5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

    </div>
  )
}