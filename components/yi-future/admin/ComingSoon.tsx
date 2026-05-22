export function ComingSoon({
  title,
  pitch,
}: {
  title: string;
  pitch: string;
}) {
  return (
    <div className="bg-white border border-navy/10 rounded-lg p-10 text-center">
      <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-yi-gold/15 text-yi-gold text-2xl">
        ⚡
      </div>
      <h2 className="mt-4 text-2xl font-bold text-navy">{title}</h2>
      <p className="mt-2 text-sm text-navy/60 max-w-md mx-auto">{pitch}</p>
      <p className="mt-6 text-[10px] font-semibold uppercase tracking-widest text-yi-gold">
        Coming soon
      </p>
    </div>
  );
}
