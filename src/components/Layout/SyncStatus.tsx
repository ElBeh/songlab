import { useState, useRef, useEffect, useCallback } from 'react';
import { useSyncStore } from '../../stores/useSyncStore';
import type { SyncRole } from '../../../shared/syncProtocol';

interface SyncStatusProps {
  onConnect: (serverUrl: string, role: SyncRole, displayName: string) => void;
  onDisconnect: () => void;
}

export function SyncStatus({ onConnect, onDisconnect }: SyncStatusProps) {
  const status = useSyncStore((s) => s.status);
  const role = useSyncStore((s) => s.role);
  const peers = useSyncStore((s) => s.peers);
  const error = useSyncStore((s) => s.error);

  const [showPanel, setShowPanel] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedRole, setSelectedRole] = useState<SyncRole>('host');
  const panelRef = useRef<HTMLDivElement>(null);

  // Close panel on outside click
  useEffect(() => {
    if (!showPanel) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowPanel(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPanel]);

  // Auto-fill server URL for host (current origin)
  useEffect(() => {
    if (!serverUrl) {
      setServerUrl(window.location.origin);
    }
  }, [serverUrl]);

  const handleConnect = useCallback(() => {
    if (!serverUrl.trim() || !displayName.trim()) return;
    onConnect(serverUrl.trim(), selectedRole, displayName.trim());
    setShowPanel(false);
  }, [serverUrl, displayName, selectedRole, onConnect]);

  const handleDisconnect = useCallback(() => {
    onDisconnect();
    setShowPanel(false);
  }, [onDisconnect]);

  // Status dot color
  const dotColor =
    status === 'connected' ? '#22c55e' :
    status === 'connecting' ? '#eab308' :
    '#64748b';

  const peerCount = peers.length;

  return (
    <div className='relative' ref={panelRef}>
      {/* Status button */}
      <button
        onClick={() => setShowPanel((v) => !v)}
        className='flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800
                   hover:bg-slate-700 transition-colors font-mono text-xs'
        title={
          status === 'connected'
            ? `Connected as ${role} (${peerCount} peer${peerCount !== 1 ? 's' : ''})`
            : status === 'connecting'
              ? 'Connecting...'
              : 'Not connected – click to set up Band Sync'
        }
      >
        <span
          className='w-2 h-2 rounded-full'
          style={{ backgroundColor: dotColor }}
        />
        {status === 'connected' ? (
          <span className='text-slate-300'>
            {role === 'host' ? '📡' : '📱'} {peerCount}
          </span>
        ) : status === 'connecting' ? (
          <span className='text-yellow-400'>connecting…</span>
        ) : (
          <span className='text-slate-500'>Sync</span>
        )}
      </button>

      {/* Dropdown panel */}
      {showPanel && (
        <div className='absolute right-0 top-full mt-2 w-72 bg-slate-800 border border-slate-600
                        rounded-lg shadow-xl z-50 p-4 flex flex-col gap-3'>

          {status === 'connected' ? (
            // --- Connected view ---
            <>
              <div className='flex items-center justify-between'>
                <span className='text-xs font-mono text-slate-400 uppercase tracking-widest'>
                  Band Sync
                </span>
                <span className='text-xs font-mono px-2 py-0.5 rounded'
                  style={{
                    backgroundColor: role === 'host' ? '#312e81' : '#1e3a5f',
                    color: role === 'host' ? '#a5b4fc' : '#7dd3fc',
                  }}
                >
                  {role}
                </span>
              </div>

              {/* Peer list */}
              <div className='flex flex-col gap-1'>
                <span className='text-[10px] font-mono text-slate-500 uppercase'>
                  Connected ({peerCount})
                </span>
                {peers.map((p) => (
                  <div key={p.peerId} className='flex items-center gap-2 text-xs font-mono'>
                    <span className='w-1.5 h-1.5 rounded-full bg-green-500' />
                    <span className='text-slate-300 truncate'>{p.displayName}</span>
                    <span className='text-slate-600 text-[10px]'>{p.role}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={handleDisconnect}
                className='px-3 py-1.5 text-xs font-mono bg-red-900/50 text-red-300
                           hover:bg-red-900 rounded transition-colors'
              >
                Disconnect
              </button>
            </>
          ) : (
            // --- Disconnected view ---
            <>
              <span className='text-xs font-mono text-slate-400 uppercase tracking-widest'>
                Band Sync
              </span>

              {error && (
                <div className='text-xs font-mono text-red-400 bg-red-900/30 rounded px-2 py-1'>
                  {error}
                </div>
              )}

              <label className='flex flex-col gap-1'>
                <span className='text-[10px] font-mono text-slate-500 uppercase'>Name</span>
                <input
                  type='text'
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder='e.g. Guitar, Bass, Keys…'
                  className='bg-slate-900 text-slate-200 text-xs rounded px-2 py-1.5
                             border border-slate-600 focus:border-indigo-500 outline-none
                             font-mono'
                />
              </label>

              <label className='flex flex-col gap-1'>
                <span className='text-[10px] font-mono text-slate-500 uppercase'>Server URL</span>
                <input
                  type='text'
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder='http://192.168.1.x:3000'
                  className='bg-slate-900 text-slate-200 text-xs rounded px-2 py-1.5
                             border border-slate-600 focus:border-indigo-500 outline-none
                             font-mono'
                />
              </label>

              <div className='flex flex-col gap-1'>
                <span className='text-[10px] font-mono text-slate-500 uppercase'>Role</span>
                <div className='flex bg-slate-900 rounded-lg p-0.5 font-mono text-xs'>
                  {(['host', 'viewer'] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setSelectedRole(r)}
                      className='flex-1 px-3 py-1 rounded-md transition-colors capitalize'
                      style={{
                        backgroundColor: selectedRole === r ? '#6366f1' : 'transparent',
                        color: selectedRole === r ? '#fff' : '#64748b',
                      }}
                    >
                      {r === 'host' ? '📡 Host' : '📱 Viewer'}
                    </button>
                  ))}
                </div>
                <p className='text-[10px] font-mono text-slate-600'>
                  {selectedRole === 'host'
                    ? 'Controls playback & song selection'
                    : 'Follows the host, can edit tabs & markers'}
                </p>
              </div>

              <button
                onClick={handleConnect}
                disabled={!serverUrl.trim() || !displayName.trim() || status === 'connecting'}
                className='px-3 py-1.5 text-xs font-mono bg-indigo-600 text-white
                           hover:bg-indigo-500 rounded transition-colors
                           disabled:opacity-30 disabled:cursor-not-allowed'
              >
                {status === 'connecting' ? 'Connecting…' : 'Connect'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
