import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-start">
      <header className="w-full h-20 mt-8 rounded-3xl bg-gray-200 flex items-center justify-between shadow px-8">
        <Image
          src="/public/unnamed.png"
          alt="Logo"
          width={48}
          height={48}
          className="rounded-full"
        />
        <h1 className="text-xl font-bold text-gray-800">Affix</h1>
        <div style={{ width: 48 }} /> {/* 22 */}
      </header>
    </div>
  );
}
