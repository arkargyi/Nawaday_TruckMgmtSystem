import React, { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Truck as TruckType } from '../types';
import { LogOut, QrCode, AlertCircle, CheckCircle } from 'lucide-react';

export default function ExitControl() {
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [truckDetails, setTruckDetails] = useState<TruckType | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;

    if (isScanning) {
      // Small delay to ensure the DOM element is ready
      const timer = setTimeout(() => {
        if (!document.getElementById('reader')) return;
        
        scanner = new Html5QrcodeScanner(
          "reader",
          { fps: 10, qrbox: { width: 250, height: 250 } },
          /* verbose= */ false
        );
        scannerRef.current = scanner;
        scanner.render(onScanSuccess, onScanFailure);
      }, 100);

      return () => {
        clearTimeout(timer);
        if (scanner) {
          scanner.clear().catch(error => {
            console.error("Failed to clear html5QrcodeScanner. ", error);
          });
          scannerRef.current = null;
        }
      };
    }
  }, [isScanning]);

  const pauseScanner = () => {
    if (scannerRef.current) {
      try {
        scannerRef.current.pause(true);
      } catch (e: any) {
        if (e?.message?.includes('is not scanning') || e?.message?.includes('Cannot pause')) {
          return;
        }
        console.warn('Could not pause scanner', e);
      }
    }
  };

  const resumeScanner = () => {
    if (scannerRef.current) {
      try {
        scannerRef.current.resume();
      } catch (e: any) {
        if (e?.message?.includes('is not paused') || e?.message?.includes('Cannot resume')) {
          return;
        }
        console.warn('Could not resume scanner', e);
      }
    }
  };

  const onScanSuccess = async (decodedText: string) => {
    if (scanResult === decodedText) return; // Prevent duplicate scans
    setScanResult(decodedText);
    setError('');
    setSuccess('');
    
    pauseScanner();

    try {
      const res = await fetch(`/api/trucks/${decodedText}`);
      if (res.ok) {
        const truck = await res.json();
        setTruckDetails(truck);
      } else {
        setError('Invalid QR Code or Truck not found.');
        resumeScanner();
      }
    } catch (err) {
      setError('Failed to fetch truck details.');
      resumeScanner();
    }
  };

  const onScanFailure = (error: any) => {
    // handle scan failure, usually better to ignore and keep scanning
  };

  const handleManualEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanResult) return;
    onScanSuccess(scanResult);
  };

  const handleExitQueue = async () => {
    if (!truckDetails) return;
    setError('');
    setSuccess('');

    const payload = { truck_id: truckDetails.id };

    if (!navigator.onLine) {
      // Offline cache
      const offlineExitQueue = JSON.parse(localStorage.getItem('offline_exit_queue') || '[]');
      offlineExitQueue.push(payload);
      localStorage.setItem('offline_exit_queue', JSON.stringify(offlineExitQueue));
      setSuccess(`[OFFLINE] Truck ${truckDetails.plate_number} exit saved locally. Will sync when online.`);
      setTruckDetails(null);
      setScanResult(null);
      resumeScanner();
      return;
    }

    try {
      const res = await fetch('/api/queues/exit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (data.success) {
        setSuccess(`Truck ${truckDetails.plate_number} exited successfully!`);
        setTruckDetails(null);
        setScanResult(null);
        resumeScanner();
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to process truck exit.');
    }
  };

  // Auto sync when online
  useEffect(() => {
    const handleOnline = async () => {
      const offlineExitQueue = JSON.parse(localStorage.getItem('offline_exit_queue') || '[]');
      if (offlineExitQueue.length > 0) {
        for (const payload of offlineExitQueue) {
          try {
            await fetch('/api/queues/exit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
          } catch (e) {
            console.error('Failed to sync offline exit payload', payload);
          }
        }
        localStorage.removeItem('offline_exit_queue');
        alert(`Synced ${offlineExitQueue.length} offline exits to the server.`);
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  const resetScan = () => {
    setTruckDetails(null);
    setScanResult(null);
    setError('');
    setSuccess('');
    resumeScanner();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <LogOut className="w-6 h-6 text-indigo-600" />
          Exit Control
        </h1>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className={isScanning ? "hidden" : "block"}>
          <div className="text-center py-12">
            <div className="bg-indigo-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <QrCode className="w-10 h-10 text-indigo-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Ready to Scan Exit</h2>
            <p className="text-slate-500 mb-6">Click below to start the camera and scan truck QR codes for exit.</p>
            <button
              onClick={() => setIsScanning(true)}
              className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-sm"
            >
              Start Scanner
            </button>
          </div>
        </div>

        <div className={!isScanning ? "hidden" : "block"}>
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-900">Scanner Active</h2>
              <button
                onClick={() => {
                  setIsScanning(false);
                  setTruckDetails(null);
                  setScanResult(null);
                  setError('');
                  setSuccess('');
                }}
                className="text-slate-500 hover:text-slate-700 text-sm font-medium"
              >
                Stop Scanner
              </button>
            </div>
            
            <div id="reader" className="w-full max-w-md mx-auto overflow-hidden rounded-xl border-2 border-indigo-100"></div>

            <div className="max-w-md mx-auto">
              <div className="relative flex items-center py-4">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink-0 mx-4 text-slate-400 text-sm">Or enter manually</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>
              
              <form onSubmit={handleManualEntry} className="flex gap-2">
                <input
                  type="text"
                  value={scanResult || ''}
                  onChange={e => setScanResult(e.target.value)}
                  placeholder="Enter Truck ID..."
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <button
                  type="submit"
                  className="bg-slate-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-800 transition-colors"
                >
                  Verify
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-red-800">Scan Error</h3>
            <p className="text-sm text-red-600 mt-1">{error}</p>
            {isScanning && (
              <button onClick={resetScan} className="mt-2 text-sm font-medium text-red-700 hover:text-red-900 underline">
                Scan Again
              </button>
            )}
          </div>
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-emerald-800">Success</h3>
            <p className="text-sm text-emerald-600 mt-1">{success}</p>
            {isScanning && (
              <button onClick={resetScan} className="mt-2 text-sm font-medium text-emerald-700 hover:text-emerald-900 underline">
                Scan Next Truck
              </button>
            )}
          </div>
        </div>
      )}

      {truckDetails && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-200 animate-in fade-in slide-in-from-bottom-4">
          <h2 className="text-xl font-bold text-slate-900 mb-4 border-b border-slate-100 pb-4">Verify Exit Details</h2>
          
          <div className="grid grid-cols-2 gap-y-4 gap-x-6 mb-6">
            <div>
              <div className="text-sm text-slate-500 mb-1">Plate Number</div>
              <div className="text-2xl font-bold text-slate-900">{truckDetails.plate_number}</div>
            </div>
            <div>
              <div className="text-sm text-slate-500 mb-1">Company</div>
              <div className="text-lg font-medium text-slate-900">{truckDetails.company}</div>
            </div>
            <div>
              <div className="text-sm text-slate-500 mb-1">Driver</div>
              <div className="text-base font-medium text-slate-900">{truckDetails.driver_name}</div>
            </div>
            <div>
              <div className="text-sm text-slate-500 mb-1">Vehicle / Load</div>
              <div className="text-base font-medium text-slate-900">{truckDetails.vehicle_type} • {truckDetails.load_type}</div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleExitQueue}
              className="flex-1 bg-indigo-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-sm"
            >
              Confirm Exit & Close Session
            </button>
            <button
              onClick={resetScan}
              className="px-6 py-3 rounded-xl font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
