export default function LoadingOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#172B4D]/40 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 rounded-xl bg-white px-10 py-8 shadow-2xl">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#0052CC] border-t-transparent" />
        <p className="text-lg font-medium text-[#172B4D]">Analyzing...</p>
        <p className="text-sm text-[#5E6C84]">This takes 30-60 seconds</p>
      </div>
    </div>
  )
}
