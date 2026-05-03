// app/page.tsx
export default function VotePage() {
  return (
    <div className="max-w-7xl mx-auto px-6 md:px-12">
      {/* HEADER: Siêu tối giản */}
      <header className="py-8 border-b border-black flex justify-between items-baseline">
        <div className="flex items-baseline gap-4">
          <span className="font-display font-black text-4xl">V.</span>
          <span className="font-mono text-xs tracking-[0.4em] uppercase">Votechain Protocol</span>
        </div>
        <div className="hidden md:flex gap-8 font-mono text-[10px] uppercase tracking-widest">
          <a href="#" className="hover:underline">Voter Area</a>
          <a href="#" className="hover:underline">Governance</a>
          <a href="#" className="hover:underline">Ledger</a>
        </div>
      </header>

      {/* HERO: Typography as Art */}
      <section className="py-24 md:py-40">
        <h1 className="font-display italic font-black text-7xl md:text-11xl leading-[0.8] tracking-tighter">
          The <br /> Choice.
        </h1>
        <div className="mt-16 grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          <div className="md:col-span-5 border-l-4 border-black pl-8">
            <p className="text-xl md:text-2xl leading-relaxed italic">
              "Your signature is the ultimate form of decentralized expression. 
              Choose the path of the protocol with absolute certainty."
            </p>
          </div>
          <div className="md:col-start-9 md:col-span-4 space-y-4">
            <div className="font-mono text-[10px] uppercase tracking-widest text-gray-400">Network Status</div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-black animate-pulse" />
              <span className="font-mono text-xs uppercase">Sepolia Testnet Connected</span>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <span className="font-mono text-[10px] text-gray-400">Wallet Address</span>
              <p className="font-mono text-xs break-all">0x283B...3AD50</p>
            </div>
          </div>
        </div>
      </section>

      {/* BALLOT: Candidate Grid */}
      <section className="py-20 border-t-8 border-black">
        <div className="flex justify-between items-end mb-12">
          <h2 className="font-display text-5xl font-bold">Active Candidates</h2>
          <span className="font-mono text-xs italic">Scroll to Explore ↓</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-t border-l border-black">
          {[
            { id: "01", name: "Michael Anderson", votes: 145 },
            { id: "02", name: "Christopher Walker", votes: 89 },
            { id: "03", name: "Daniel Thompson", votes: 210 },
            { id: "04", name: "James Carter", votes: 56 },
          ].map((c) => (
            <div key={c.id} className="card-monochrome group border-r border-b border-black">
              <div className="flex justify-between items-start">
                <span className="font-display text-7xl italic opacity-10 group-hover:opacity-20 transition-opacity">
                  {c.id}
                </span>
                <div className="text-right">
                  <p className="font-mono text-[10px] uppercase tracking-tighter opacity-60">Consensus Weight</p>
                  <p className="text-5xl font-display font-bold leading-none">{c.votes}</p>
                </div>
              </div>
              
              <h3 className="mt-20 text-3xl font-display font-black uppercase tracking-tight leading-none group-hover:italic transition-all">
                {c.name}
              </h3>
              
              <div className="mt-10 flex gap-4">
                <button className="flex-1 border border-black group-hover:border-white py-4 font-mono text-[10px] uppercase tracking-[0.2em] transition-none hover:bg-white hover:text-black">
                  Cast Ballot
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER: Inverted Contrast */}
      <footer className="mt-40 bg-black text-white py-32 px-12 relative overflow-hidden">
        {/* Lớp kẻ Grid cho Footer */}
        <div className="absolute inset-0 opacity-[0.05] bg-[linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] bg-[length:40px_40px]" />
        
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-24">
          <div>
            <h4 className="font-mono text-[10px] uppercase tracking-[0.5em] mb-8 opacity-50">Turnout</h4>
            <p className="text-8xl font-display font-black italic">84%</p>
          </div>
          <div>
            <h4 className="font-mono text-[10px] uppercase tracking-[0.5em] mb-8 opacity-50">Block</h4>
            <p className="text-8xl font-display font-black">#429</p>
          </div>
          <div className="flex flex-col justify-end">
            <button className="w-full bg-white text-black py-6 font-mono text-xs uppercase tracking-[0.3em] hover:invert transition-all">
              Sign Protocol Update
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}