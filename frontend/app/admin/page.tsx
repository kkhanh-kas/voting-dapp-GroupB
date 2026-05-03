'use client';
import React, { useState } from 'react';
import CandidateTable, { Candidate } from '../../components/CandidateTable';
import Spinner from '../../components/Spinner';
import Toast from '../../components/Toast';

export default function AdminPage() {
  const [candidates] = useState<Candidate[]>([]); // Giả lập data rỗng ban đầu
  const [newCandidateName, setNewCandidateName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [toastInfo, setToastInfo] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Time Picker States
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const handleAddCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCandidateName.trim()) return;

    // Confirm Dialog native
    if (!window.confirm(`Add candidate "${newCandidateName}" to the election?`)) return;

    setIsAdding(true);
    try {
      // TODO: Tích hợp contract.addCandidate() tại đây
      await new Promise(res => setTimeout(res, 1500));
      setToastInfo({ message: "Candidate added successfully!", type: 'success' });
      setNewCandidateName("");
    } catch (err) {
      setToastInfo({ message: "Error adding candidate.", type: 'error' });
    } finally {
      setIsAdding(false);
    }
  };

  const handleSetPeriod = (e: React.FormEvent) => {
    e.preventDefault();
    if (window.confirm("Update voting period?")) {
      // TODO: contract.setVotingPeriod()
      setToastInfo({ message: "Voting period updated!", type: 'success' });
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {toastInfo && <Toast message={toastInfo.message} type={toastInfo.type} onClose={() => setToastInfo(null)} />}

      <div className="border-b border-gray-800 pb-4">
        <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
        <p className="text-gray-400 mt-1">Manage election settings and candidates (Owner Only).</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Cột 1: Quản lý Candidate */}
        <div className="space-y-6">
          <div className="bg-[#161925] p-6 rounded-xl border border-gray-800 shadow-xl">
            <h3 className="text-xl font-bold text-white mb-4">Add New Candidate</h3>
            <form onSubmit={handleAddCandidate} className="flex gap-4">
              <input 
                type="text" 
                placeholder="Candidate Full Name" 
                className="flex-1 bg-[#1a1d2d] border border-gray-700 text-white rounded-lg p-3 outline-none focus:border-blue-500 transition-colors"
                value={newCandidateName}
                onChange={(e) => setNewCandidateName(e.target.value)}
                disabled={isAdding}
                required
              />
              <button 
                type="submit"
                disabled={isAdding || !newCandidateName}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold px-6 rounded-lg flex items-center transition-all min-w-[120px] justify-center"
              >
                {isAdding ? <Spinner size="sm" color="text-white" /> : 'Add'}
              </button>
            </form>
          </div>

          <div>
            <h3 className="text-xl font-bold text-white mb-4">Current Candidates</h3>
            <CandidateTable candidates={candidates} />
          </div>
        </div>

        {/* Cột 2: Cài đặt thời gian */}
        <div className="space-y-6">
          <div className="bg-[#161925] p-6 rounded-xl border border-gray-800 shadow-xl">
            <h3 className="text-xl font-bold text-white mb-4">Election Period</h3>
            <form onSubmit={handleSetPeriod} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Start Time</label>
                <input 
                  type="datetime-local" 
                  className="w-full bg-[#1a1d2d] border border-gray-700 text-white rounded-lg p-3 outline-none focus:border-blue-500 [color-scheme:dark]"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">End Time</label>
                <input 
                  type="datetime-local" 
                  className="w-full bg-[#1a1d2d] border border-gray-700 text-white rounded-lg p-3 outline-none focus:border-blue-500 [color-scheme:dark]"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-3 rounded-lg transition-all"
              >
                Save Timeline
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}