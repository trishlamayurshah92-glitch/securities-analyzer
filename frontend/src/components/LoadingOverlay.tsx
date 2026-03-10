export default function LoadingOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 rounded-xl bg-gray-900 px-10 py-8 shadow-2xl">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-400 border-t-transparent" />
        <p className="text-lg font-medium text-gray-200">Analyzing...</p>
        <p className="text-sm text-gray-400">This takes 30-60 seconds</p>
      </div>
    </div>
  )
}
