"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type LayoutProps = {
  children: React.ReactNode;
};

export default function Layout({ children }: LayoutProps) {
  const [wallet, setWallet] = useState<string>("Not Connected");

  // connect MetaMask
  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask");
      return;
    }

    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });

    setWallet(accounts[0]);
  };

  useEffect(() => {
    const checkWallet = async () => {
      if (window.ethereum) {
        const accounts = await window.ethereum.request({
          method: "eth_accounts",
        });

        if (accounts.length > 0) {
          setWallet(accounts[0]);
        }
      }
    };

    checkWallet();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* HEADER */}
      <header className="bg-blue-600 text-white px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">🗳 Voting DApp</h1>

        <div className="flex items-center gap-4">
          <span className="text-sm bg-blue-800 px-3 py-1 rounded">
            {wallet === "Not Connected"
              ? wallet
              : `${wallet.slice(0, 6)}...${wallet.slice(-4)}`}
          </span>

          <button
            onClick={connectWallet}
            className="bg-white text-blue-600 px-3 py-1 rounded hover:bg-gray-200"
          >
            {wallet === "Not Connected" ? "Connect Wallet" : "Connected"}
          </button>
        </div>
      </header>

      {/* NAVBAR */}
      <nav className="bg-white shadow px-6 py-3 flex gap-6">
        <Link href="/" className="hover:text-blue-600">
          Voter Page
        </Link>
        <Link href="/admin" className="hover:text-blue-600">
          Admin Page
        </Link>
      </nav>

      {/* CONTENT */}
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
