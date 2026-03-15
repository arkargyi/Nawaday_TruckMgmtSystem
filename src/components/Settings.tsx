import { useState, useEffect } from 'react';
import { Save, Plus, Trash2, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';

export default function Settings() {
  const [caneTypes, setCaneTypes] = useState<string[]>([]);
  const [priorityRules, setPriorityRules] = useState<{ high_priority_types: string[] }>({ high_priority_types: [] });
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [newCaneType, setNewCaneType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      if (data.cane_types) setCaneTypes(data.cane_types);
      if (data.priority_rules) setPriorityRules(data.priority_rules);
      if (data.current_round_number) setCurrentRound(parseInt(data.current_round_number, 10));
    } catch (err) {
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cane_types: caneTypes,
          priority_rules: priorityRules
        })
      });
      
      if (res.ok) {
        setSuccess('Settings saved successfully');
      } else {
        setError('Failed to save settings');
      }
    } catch (err) {
      setError('Failed to save settings');
    }
  };

  const addCaneType = () => {
    if (newCaneType && !caneTypes.includes(newCaneType)) {
      setCaneTypes([...caneTypes, newCaneType]);
      setNewCaneType('');
    }
  };

  const removeCaneType = (type: string) => {
    setCaneTypes(caneTypes.filter(t => t !== type));
    setPriorityRules(prev => ({
      ...prev,
      high_priority_types: prev.high_priority_types.filter(t => t !== type)
    }));
  };

  const togglePriority = (type: string) => {
    setPriorityRules(prev => {
      const isHigh = prev.high_priority_types.includes(type);
      return {
        ...prev,
        high_priority_types: isHigh
          ? prev.high_priority_types.filter(t => t !== type)
          : [...prev.high_priority_types, type]
      };
    });
  };

  const handleNextRoundClick = () => {
    setShowConfirmModal(true);
  };

  const confirmNextRound = async () => {
    setShowConfirmModal(false);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/round/next', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setCurrentRound(data.current_round_number);
        setSuccess(`Successfully started Round ${data.current_round_number}`);
      } else {
        setError(data.message || 'Failed to start next round');
      }
    } catch (err) {
      setError('Failed to start next round');
    }
  };

  if (loading) return <div className="p-8 text-center">Loading settings...</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">System Settings</h2>
          <button
            onClick={handleSave}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm mb-6 flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-md text-sm mb-6 flex items-center">
            <CheckCircle className="w-5 h-5 mr-2" />
            {success}
          </div>
        )}

        {showConfirmModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Start Next Round?</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to start a new round? This will reset the senior numbers for all queue types back to 1.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmNextRound}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-8">
          {/* Round Management */}
          <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Round Management</h3>
            <p className="text-sm text-gray-500 mb-4">
              The current active round is <span className="font-bold text-indigo-600 text-lg">Round {currentRound}</span>. 
              Starting a new round will reset the Senior Numbers for all queue types back to 1.
            </p>
            <button
              onClick={handleNextRoundClick}
              className="flex items-center px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Start Next Round (Round {currentRound + 1})
            </button>
          </div>

          {/* Cane Types Management */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Cane Types & Priority Rules</h3>
            <p className="text-sm text-gray-500 mb-4">
              Manage available cane types and select which ones should automatically receive 
              <span className="font-bold text-red-600 mx-1">High Priority</span> 
              status upon gate entry.
            </p>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newCaneType}
                onChange={(e) => setNewCaneType(e.target.value)}
                placeholder="Enter new cane type..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                onKeyDown={(e) => e.key === 'Enter' && addCaneType()}
              />
              <button
                onClick={addCaneType}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add
              </button>
            </div>

            <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cane Type Name</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">High Priority?</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {caneTypes.map((type) => (
                    <tr key={type}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{type}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <input
                          type="checkbox"
                          checked={priorityRules.high_priority_types.includes(type)}
                          onChange={() => togglePriority(type)}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => removeCaneType(type)}
                          className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {caneTypes.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-4 text-center text-gray-500 text-sm">
                        No cane types defined. Add one above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
