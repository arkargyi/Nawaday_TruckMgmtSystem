import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { QueueItem } from '../types';
import { Clock, Truck, CheckCircle, Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';

export default function LiveDashboard() {
  const [queues, setQueues] = useState<QueueItem[]>([]);
  const [analytics, setAnalytics] = useState({
    totalToday: 0,
    currentlyWaiting: 0,
    currentlyProcessing: 0,
    completedToday: 0,
    avgWaitTime: 0
  });

  const fetchData = async () => {
    try {
      const [queuesRes, analyticsRes] = await Promise.all([
        fetch('/api/queues'),
        fetch('/api/stats')
      ]);
      const queuesData = await queuesRes.json();
      const analyticsData = await analyticsRes.json();
      setQueues(queuesData);
      setAnalytics(analyticsData);
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

  const waitingQueues = queues.filter(q => q.status === 'waiting');
  const processingQueues = queues.filter(q => q.status === 'called' || q.status === 'processing');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Live Dashboard</h1>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="bg-blue-50 p-3 rounded-xl">
            <Truck className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <div className="text-sm font-medium text-slate-500">Total Today</div>
            <div className="text-2xl font-bold text-slate-900">{analytics.totalToday}</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="bg-amber-50 p-3 rounded-xl">
            <Clock className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <div className="text-sm font-medium text-slate-500">Currently Waiting</div>
            <div className="text-2xl font-bold text-slate-900">{analytics.currentlyWaiting}</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="bg-indigo-50 p-3 rounded-xl">
            <Activity className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <div className="text-sm font-medium text-slate-500">Processing</div>
            <div className="text-2xl font-bold text-slate-900">{analytics.currentlyProcessing}</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="bg-emerald-50 p-3 rounded-xl">
            <CheckCircle className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <div className="text-sm font-medium text-slate-500">Completed</div>
            <div className="text-2xl font-bold text-slate-900">{analytics.completedToday}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Processing / Called */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
          <div className="bg-indigo-50 px-6 py-4 border-b border-indigo-100">
            <h2 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Now Processing / Called
            </h2>
          </div>
          <div className="p-6 flex-1 overflow-y-auto">
            {processingQueues.length === 0 ? (
              <div className="text-center text-slate-500 py-8">No trucks currently processing</div>
            ) : (
              <div className="space-y-4">
                {processingQueues.map(queue => (
                  <div key={queue.id} className="border border-indigo-100 rounded-xl p-4 bg-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl font-bold text-slate-900">{queue.plate_number}</span>
                        <span className="bg-slate-100 text-slate-800 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase border border-slate-200">
                          R{queue.round_number} - {queue.queue_type} - #{queue.senior_number}
                        </span>
                        {queue.priority === 'vip' && (
                          <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full uppercase">VIP</span>
                        )}
                      </div>
                      <div className="text-sm text-slate-600">{queue.company} • {queue.vehicle_type}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-indigo-600 mb-1">
                        {queue.gate_name || 'Assigned Gate'}
                      </div>
                      <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 capitalize">
                        {queue.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Waiting Queue */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Waiting Queue
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {waitingQueues.length === 0 ? (
              <div className="text-center text-slate-500 py-8">Queue is empty</div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 text-slate-500 text-xs uppercase tracking-wider">
                    <th className="px-6 py-3 font-medium">Pos</th>
                    <th className="px-6 py-3 font-medium">Plate Number</th>
                    <th className="px-6 py-3 font-medium">Queue Info</th>
                    <th className="px-6 py-3 font-medium">Wait Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {waitingQueues.map((queue, index) => (
                    <tr key={queue.id} className={clsx(
                      "hover:bg-slate-50 transition-colors",
                      queue.priority === 'vip' ? "bg-amber-50/30" : ""
                    )}>
                      <td className="px-6 py-4">
                        <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold">
                          {index + 1}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          {queue.plate_number}
                          {queue.priority === 'vip' && (
                            <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">VIP</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500">{queue.company}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-slate-100 text-slate-800 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase border border-slate-200 block w-max mb-1">
                          R{queue.round_number} - #{queue.senior_number}
                        </span>
                        <div className="text-xs text-slate-500">{queue.queue_type}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {formatDistanceToNow(new Date(queue.entry_time))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
