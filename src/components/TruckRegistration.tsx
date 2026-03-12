import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Truck as TruckType } from '../types';
import { Truck, Plus, QrCode, Search, Download, Upload } from 'lucide-react';
import clsx from 'clsx';
import Papa from 'papaparse';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import QRCode from 'qrcode';

export default function TruckRegistration() {
  const [trucks, setTrucks] = useState<TruckType[]>([]);
  const [caneTypes, setCaneTypes] = useState<string[]>(['General', 'Hazardous', 'Fragile', 'Refrigerated']);
  const [formData, setFormData] = useState({
    plate_number: '',
    driver_name: '',
    company: '',
    vehicle_type: 'Trailer',
    load_type: 'General'
  });
  const [selectedTruck, setSelectedTruck] = useState<TruckType | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchTrucks = async () => {
    try {
      const res = await fetch('/api/trucks');
      const data = await res.json();
      setTrucks(data);
    } catch (err) {
      console.error('Failed to fetch trucks:', err);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      if (data.cane_types && data.cane_types.length > 0) {
        setCaneTypes(data.cane_types);
        setFormData(prev => ({ ...prev, load_type: data.cane_types[0] }));
      }
    } catch (err) {
      console.error('Failed to fetch config:', err);
    }
  };

  useEffect(() => {
    fetchTrucks();
    fetchConfig();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/trucks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('Truck registered successfully!');
        setFormData({
          plate_number: '',
          driver_name: '',
          company: '',
          vehicle_type: 'Trailer',
          load_type: 'General'
        });
        fetchTrucks();
        setSelectedTruck(data.truck);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to register truck');
    }
  };

  const filteredTrucks = trucks.filter(t => 
    t.plate_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.company.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const downloadQR = () => {
    const svg = document.getElementById('qr-code');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `QR_${selectedTruck?.plate_number}.png`;
      downloadLink.href = `${pngFile}`;
      downloadLink.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError('');
    setSuccess('');

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const trucksData = results.data.map((row: any) => ({
            plate_number: row.plate_number?.toUpperCase() || '',
            driver_name: row.driver_name || '',
            company: row.company || '',
            vehicle_type: row.vehicle_type || 'Trailer',
            load_type: row.load_type || 'General'
          })).filter(t => t.plate_number);

          if (trucksData.length === 0) {
            setError('No valid truck data found in CSV. Make sure column names match: plate_number, driver_name, company, vehicle_type, load_type');
            setIsUploading(false);
            return;
          }

          const res = await fetch('/api/trucks/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trucks: trucksData })
          });
          
          if (!res.ok) {
            const isJson = res.headers.get('content-type')?.includes('application/json');
            if (isJson) {
              const errorData = await res.json();
              throw new Error(errorData.message || 'Failed to bulk register trucks');
            } else {
              throw new Error(`Server error: ${res.status} ${res.statusText}`);
            }
          }

          const data = await res.json();
          
          if (data.success) {
            setSuccess(`Successfully registered ${data.count} trucks. Generating QR codes...`);
            fetchTrucks();
            
            // Generate ZIP with QR codes
            const zip = new JSZip();
            const qrFolder = zip.folder("QR_Codes");
            
            for (const truck of data.trucks) {
              try {
                const qrDataUrl = await QRCode.toDataURL(truck.id, {
                  width: 300,
                  margin: 2,
                  color: {
                    dark: '#000000',
                    light: '#ffffff'
                  }
                });
                
                // Remove the data:image/png;base64, part
                const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, "");
                qrFolder?.file(`QR_${truck.plate_number}.png`, base64Data, {base64: true});
              } catch (qrErr) {
                console.error(`Failed to generate QR for ${truck.plate_number}`, qrErr);
              }
            }
            
            const content = await zip.generateAsync({type: "blob"});
            saveAs(content, "Truck_QRCodes.zip");
            setSuccess(`Successfully registered ${data.count} trucks and downloaded QR codes.`);
          } else {
            setError(data.message || 'Failed to bulk register trucks');
          }
        } catch (err) {
          console.error(err);
          setError('An error occurred during bulk registration');
        } finally {
          setIsUploading(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      },
      error: (error) => {
        setError(`Failed to parse CSV: ${error.message}`);
        setIsUploading(false);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Truck Registration</h1>
        <div>
          <input 
            type="file" 
            accept=".csv" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 font-medium py-2 px-4 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {isUploading ? 'Uploading...' : 'Upload CSV'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Registration Form */}
        <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-indigo-600" />
            New Registration
          </h2>
          
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}
          {success && <div className="bg-emerald-50 text-emerald-600 p-3 rounded-lg mb-4 text-sm">{success}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Plate Number</label>
              <input
                type="text"
                required
                value={formData.plate_number}
                onChange={e => setFormData({...formData, plate_number: e.target.value.toUpperCase()})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none uppercase"
                placeholder="e.g. ABC-1234"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Driver Name</label>
              <input
                type="text"
                required
                value={formData.driver_name}
                onChange={e => setFormData({...formData, driver_name: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Company / Supplier</label>
              <input
                type="text"
                required
                value={formData.company}
                onChange={e => setFormData({...formData, company: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Vehicle Type</label>
                <select
                  value={formData.vehicle_type}
                  onChange={e => setFormData({...formData, vehicle_type: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option>Trailer</option>
                  <option>Lorry</option>
                  <option>Van</option>
                  <option>Tanker</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Load / Cane Type</label>
                <select
                  value={formData.load_type}
                  onChange={e => setFormData({...formData, load_type: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  {caneTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="submit"
              className="w-full bg-indigo-600 text-white font-medium py-2.5 rounded-lg hover:bg-indigo-700 transition-colors mt-4"
            >
              Register & Generate QR
            </button>
          </form>
        </div>

        {/* Truck List & QR Display */}
        <div className="lg:col-span-2 space-y-6">
          {selectedTruck && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-100 flex flex-col sm:flex-row items-center gap-8">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex-shrink-0">
                <QRCodeSVG 
                  id="qr-code"
                  value={selectedTruck.id} 
                  size={160}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-2xl font-bold text-slate-900 mb-2">{selectedTruck.plate_number}</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-slate-600 mb-6">
                  <div><span className="font-medium text-slate-900">Driver:</span> {selectedTruck.driver_name}</div>
                  <div><span className="font-medium text-slate-900">Company:</span> {selectedTruck.company}</div>
                  <div><span className="font-medium text-slate-900">Type:</span> {selectedTruck.vehicle_type}</div>
                  <div><span className="font-medium text-slate-900">Load:</span> {selectedTruck.load_type}</div>
                </div>
                <button
                  onClick={downloadQR}
                  className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  Download QR Code
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Truck className="w-5 h-5 text-slate-500" />
                Registered Trucks
              </h2>
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search plate or company..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 text-slate-500 text-xs uppercase tracking-wider">
                    <th className="px-6 py-3 font-medium">Plate Number</th>
                    <th className="px-6 py-3 font-medium">Company</th>
                    <th className="px-6 py-3 font-medium">Driver</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTrucks.map(truck => (
                    <tr key={truck.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900">{truck.plate_number}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{truck.company}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{truck.driver_name}</td>
                      <td className="px-6 py-4">
                        <span className={clsx(
                          "px-2.5 py-1 rounded-full text-xs font-medium capitalize",
                          truck.status === 'active' ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                        )}>
                          {truck.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setSelectedTruck(truck)}
                          className="text-indigo-600 hover:text-indigo-900 text-sm font-medium inline-flex items-center gap-1"
                        >
                          <QrCode className="w-4 h-4" />
                          View QR
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredTrucks.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                        No trucks found matching your search.
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
