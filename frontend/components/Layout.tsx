import React from "react";

export default function Layout({ children }: { children: React.ReactNode }) {
 return (
    <div className="min-h-screen bg-gray-50">

      {/* HEADER */}
      <header className="bg-blue-600 text-white p-4 flex justify-between">
        <h1 className="font-bold">🗳 Voting DApp</h1>
        <span className="text-sm">
          Wallet: 0x1234...abcd
        </span>
      </header>

      {/* NAVBAR */}
      <nav className="bg-blue-500 text-white flex gap-4 px-4 py-2">
        <a href="/" className="hover:underline">Voter</a>
        <a href="/admin" className="hover:underline">Admin</a>
      </nav>

      {/* CONTENT */}
      <main className="max-w-5xl mx-auto p-4">
        {children}
      </main>

    </div>
  );
}
