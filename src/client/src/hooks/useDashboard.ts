import { useEffect, useState } from 'react';
import type { DashboardState, GuidMap } from '../../../shared/types';

export function useDashboard() {
  const [state, setState] = useState<DashboardState | null>(null);
  const [maps, setMaps] = useState<{ de: GuidMap; en: GuidMap }>({ de: {}, en: {} });
  const [online, setOnline] = useState(false);

  useEffect(() => {
    let active = true;
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let receivedSocketState = false;
    fetch('/api/mappings').then((r) => r.json()).then((value) => { if (active) setMaps(value); }).catch(() => {});
    fetch('/api/state').then((r) => r.json()).then((value) => { if (active && !receivedSocketState) setState(value); }).catch(() => {});
    function connect() {
      if (!active) return;
      socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
      socket.onopen = () => { if (active) setOnline(true); };
      socket.onmessage = (event) => { if (active) { receivedSocketState = true; setState(JSON.parse(event.data)); } };
      socket.onclose = () => { if (active) { setOnline(false); retry = setTimeout(connect, 2000); } };
      socket.onerror = () => socket?.close();
    }
    connect();
    return () => { active = false; if (retry) clearTimeout(retry); socket?.close(); };
  }, []);

  return { state, maps, online };
}

export async function post<T>(path: string, value: unknown = {}): Promise<T> {
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data as T;
}
