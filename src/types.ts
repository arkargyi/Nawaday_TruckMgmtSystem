export interface User {
  id: string;
  username: string;
  role: 'admin' | 'security' | 'operator' | 'viewer';
}

export interface Truck {
  id: string;
  plate_number: string;
  driver_name: string;
  company: string;
  vehicle_type: string;
  load_type: string;
  status: 'active' | 'blacklisted';
  created_at: string;
}

export interface Gate {
  id: string;
  name: string;
  type: 'entry' | 'exit' | 'loading';
}

export interface QueueItem {
  id: string;
  truck_id: string;
  gate_id: string | null;
  queue_type: string;
  round_number: number;
  senior_number: number;
  priority: 'normal' | 'vip';
  status: 'waiting' | 'called' | 'processing' | 'completed';
  entry_time: string;
  call_time: string | null;
  process_time: string | null;
  exit_time: string | null;
  // Joined fields
  plate_number: string;
  driver_name: string;
  company: string;
  vehicle_type: string;
  load_type: string;
  gate_name: string | null;
}
