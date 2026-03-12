import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { QueueItem, Gate } from '../types';
import { ListOrdered, Play, CheckCircle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';

export default function QueueManagement() {
  const [queues, setQueues] = useState<QueueItem[]>([]);
  const [gates, setGates] = useState<Gate[]>([]);
  const [selectedGate, setSelectedGate] = useState<string>('');

  const fetchData = async () => {
    try {
      const [queuesRes, gatesRes] = await Promise.all([
        fetch('/api/queues'),
        fetch('/api/gates')
      ]);
      const queuesData = await queuesRes.json();
      const gatesData = await gatesRes.json();
      setQueues(queuesData);
      setGates(gatesData.filter((g: Gate) => g.type === 'loading'));
      if (gatesData.length > 0 && !selectedGate) {
        setSelectedGate(gatesData.find((g: Gate) => g.type === 'loading')?.id || '');
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  };

  useEffect(() => {
    fetchData();
    const socket = io();
    socket.on('queue_updated', fetchData);
    return () => {
      socket.disconnect();
    };
  }, []);

  const updateStatus = async (id: string, status: string) => {
    if (status === 'called' && !selectedGate) {
      alert('Please select a gate first');
      return;
    }

    try {
      await fetch(`/api/queues/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, gate_id: selectedGate })
      });
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const waitingQueues = queues.filter(q => q.status === 'waiting');
  const activeQueues = queues.filter(q => q.status === 'called' || q.status === 'processing');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <ListOrdered className="w-6 h-6 text-indigo-600" />
          Queue Management
        </h1>
        
        <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
          <label className="text-sm font-medium text-slate-600 pl-2">Assign to Gate:</label>
          <select
            value={selectedGate}
            onChange={(e) => setSelectedGate(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            {gates.map(gate => (
              <option key={gate.id} value={gate.id}>{gate.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Waiting Queue */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Waiting Queue
            </h2>
            <span className="bg-slate-200 text-slate-700 text-xs font-bold px-2.5 py-1 rounded-full">
              {waitingQueues.length} Trucks
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {waitingQueues.length === 0 ? (
              <div className="text-center text-slate-500 py-12">Queue is empty</div>
            ) : (
              <div className="space-y-3">
                {waitingQueues.map((queue, index) => (
                  <div key={queue.id} className={clsx(
                    "border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all",
                    queue.priority === 'vip' ? "border-amber-200 bg-amber-50/30" : "border-slate-200 hover:border-indigo-300"
                  )}>
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-sm font-bold flex-shrink-0 mt-1">
                        {index + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg font-bold text-slate-900">{queue.plate_number}</span>
                          <span className="bg-slate-100 text-slate-800 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase border border-slate-200">
                            R{queue.round_number} - {queue.queue_type} - #{queue.senior_number}
                          </span>
                          {queue.priority === 'vip' && (
                            <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">VIP</span>
                          )}
                        </div>
                        <div className="text-sm text-slate-600 mb-1">{queue.company} • {queue.driver_name}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Waiting for {formatDistanceToNow(new Date(queue.entry_time))}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => updateStatus(queue.id, 'called')}
                      className="w-full sm:w-auto bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm flex items-center justify-center gap-2"
                    >
                      Call Next
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Active Processing */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
          <div className="bg-indigo-50 px-6 py-4 border-b border-indigo-100 flex justify-between items-center">
            <h2 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
              <Play className="w-5 h-5" />
              Active Processing
            </h2>
            <span className="bg-indigo-200 text-indigo-800 text-xs font-bold px-2.5 py-1 rounded-full">
              {activeQueues.length} Trucks
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {activeQueues.length === 0 ? (
              <div className="text-center text-slate-500 py-12">No trucks currently processing</div>
            ) : (
              <div className="space-y-3">
                {activeQueues.map(queue => (
                  <div key={queue.id} className="border border-indigo-100 rounded-xl p-4 bg-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg font-bold text-slate-900">{queue.plate_number}</span>
                        <span className={clsx(
                          "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase",
                          queue.status === 'called' ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                        )}>
                          {queue.status}
                        </span>
                      </div>
                      <div className="text-sm text-slate-600 mb-1">{queue.company}</div>
                      <div className="text-xs font-medium text-indigo-600 bg-indigo-50 inline-block px-2 py-1 rounded-md">
                        {queue.gate_name}
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2 w-full sm:w-auto">
                      {queue.status === 'called' && (
                        <button
                          onClick={() => updateStatus(queue.id, 'processing')}
                          className="w-full bg-amber-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-amber-600 transition-colors shadow-sm flex items-center justify-center gap-2 text-sm"
                        >
                          <Play className="w-4 h-4" />
                          Start Processing
                        </button>
                      )}
                      {queue.status === 'processing' && (
                        <button
                          onClick={() => updateStatus(queue.id, 'completed')}
                          className="w-full bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 transition-colors shadow-sm flex items-center justify-center gap-2 text-sm"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Mark Completed
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
