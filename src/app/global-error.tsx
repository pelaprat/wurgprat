"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-4">
          <h2 className="text-xl font-semibold">Something went wrong</h2>
          <p className="text-gray-600">{error.message}</p>
          <button
            onClick={reset}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
