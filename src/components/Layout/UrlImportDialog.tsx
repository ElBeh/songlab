import { useState, useEffect } from 'react';
import { importSetlistFromUrl } from '../../services/exportService';
import { getConfig, setConfig } from '../../services/db';
import { useSyncStore } from '../../stores/useSyncStore';
import { useToastStore } from '../../stores/useToastStore';
import type { SongData } from '../../types';

interface UrlImportDialogProps {
  onClose: () => void;
  onImported: (songs: SongData[]) => void;
}

const CONFIG_KEY_SERVER_URL = 'importServerUrl';
const CONFIG_KEY_SETLIST_URL = 'importSetlistUrl';

export function UrlImportDialog({ onClose, onImported }: UrlImportDialogProps) {
  const syncServerUrl = useSyncStore((state) => state.serverUrl);
  const syncStatus = useSyncStore((state) => state.status);
  const addToast = useToastStore((state) => state.addToast);

  const [serverUrl, setServerUrl] = useState('');
  const [setlistUrl, setSetlistUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load saved URLs from config on mount
  useEffect(() => {
    const loadConfig = async () => {
      const savedServer = await getConfig<string>(CONFIG_KEY_SERVER_URL);
      const savedSetlist = await getConfig<string>(CONFIG_KEY_SETLIST_URL);

      // Pre-fill server URL: prefer active sync connection, then saved config, then default
      if (syncStatus === 'connected' && syncServerUrl) {
        setServerUrl(syncServerUrl);
      } else if (savedServer) {
        setServerUrl(savedServer);
      } else {
        setServerUrl('http://0.0.0.0:3000');
      }

      if (savedSetlist) {
        setSetlistUrl(savedSetlist);
      }
    };
    loadConfig();
  }, [syncServerUrl, syncStatus]);

  const isValid = serverUrl.trim().length > 0 && setlistUrl.trim().length > 0;

  const handleImport = async () => {
    if (!isValid || loading) return;
    setError(null);
    setLoading(true);

    try {
      // Save URLs for next time
      await setConfig(CONFIG_KEY_SERVER_URL, serverUrl.trim());
      await setConfig(CONFIG_KEY_SETLIST_URL, setlistUrl.trim());

      const songs = await importSetlistFromUrl(serverUrl.trim(), setlistUrl.trim());

      if (songs.length === 0) {
        setError('Setlist contained no songs');
        setLoading(false);
        return;
      }

      addToast(`Imported ${songs.length} song(s) from URL`, 'success');
      onImported(songs);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed';
      console.error('URL import failed:', err);
      setError(message);
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && isValid && !loading) handleImport();
  };

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className='bg-slate-800 border border-slate-600 rounded-lg shadow-xl p-5 w-96
                   flex flex-col gap-4'
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className='text-sm font-semibold text-slate-200'>Import Setlist from URL</h2>

        {/* Server URL */}
        <label className='flex flex-col gap-1'>
          <span className='text-xs text-slate-400 font-mono'>Server URL</span>
          <input
            type='text'
            placeholder='http://192.168.1.50:3000'
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            disabled={loading}
            autoFocus
            className='bg-slate-900 text-slate-200 text-xs rounded px-2 py-1.5
                       border border-slate-600 focus:border-indigo-500
                       outline-none font-mono w-full disabled:opacity-50'
          />
          {syncStatus === 'connected' && syncServerUrl && (
            <span className='text-[10px] text-green-400 font-mono'>
              Band Sync connected
            </span>
          )}
        </label>

        {/* Setlist URL */}
        <label className='flex flex-col gap-1'>
          <span className='text-xs text-slate-400 font-mono'>Setlist URL (direct download link)</span>
          <input
            type='text'
            placeholder='https://www.dropbox.com/...'
            value={setlistUrl}
            onChange={(e) => setSetlistUrl(e.target.value)}
            disabled={loading}
            className='bg-slate-900 text-slate-200 text-xs rounded px-2 py-1.5
                       border border-slate-600 focus:border-indigo-500
                       outline-none font-mono w-full disabled:opacity-50'
          />
          <span className='text-[10px] text-slate-500 font-mono leading-relaxed'>
            Dropbox and Google Drive sharing links are auto-converted.
            For OneDrive, use the direct download URL (browser download link).
          </span>
        </label>

        {/* Error message */}
        {error && (
          <p className='text-xs text-red-400 font-mono'>{error}</p>
        )}

        {/* Actions */}
        <div className='flex justify-end gap-2'>
          <button
            onClick={onClose}
            disabled={loading}
            className='px-3 py-1.5 text-xs font-mono text-slate-400
                       hover:text-slate-200 transition-colors
                       disabled:opacity-50'
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!isValid || loading}
            className='px-3 py-1.5 text-xs font-mono bg-indigo-600
                       hover:bg-indigo-500 text-white rounded transition-colors
                       disabled:opacity-30 disabled:cursor-not-allowed'
          >
            {loading ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}