export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

export function LoadingButton() {
  return (
    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
  );
}
