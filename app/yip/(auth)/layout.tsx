export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#FFF8F0] via-white to-[#F0FFF4] px-4 py-12">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
