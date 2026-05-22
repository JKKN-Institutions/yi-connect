export default function Loading(): React.JSX.Element {
  return (
    <main className="min-h-screen bg-ivory flex items-center justify-center">
      <div className="text-center">
        <div className="h-2 w-40 rounded-full bg-navy/10 overflow-hidden">
          <div className="h-full w-1/3 bg-yi-gold animate-pulse" />
        </div>
        <div className="mt-4 text-[10px] font-semibold tracking-[0.3em] uppercase text-navy/40">
          Loading
        </div>
      </div>
    </main>
  );
}
