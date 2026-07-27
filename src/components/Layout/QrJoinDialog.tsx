import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { useToastStore } from '../../stores/useToastStore';

interface QrJoinDialogProps {
  /** Base URL of the connected sync server (used to fetch its LAN addresses) */
  serverUrl: string;
  onClose: () => void;
}

/**
 * Shows a QR code with the sync server's LAN address so band members
 * can join Band Sync by scanning instead of typing the IP.
 */
export function QrJoinDialog({ serverUrl, onClose }: QrJoinDialogProps) {
  const [addresses, setAddresses] = useState<string[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const addToast = useToastStore((state) => state.addToast);

  // Fetch the server's LAN addresses
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${serverUrl.replace(/\/$/, '')}/api/server-info`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const info: { addresses: string[] } = await response.json();
        if (cancelled) return;
        setAddresses(info.addresses);
        setSelectedAddress(info.addresses[0] ?? null);
      } catch (error) {
        console.error('Failed to fetch server info:', error);
        if (!cancelled) {
          addToast('Could not fetch server address', 'error');
          onClose();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [serverUrl, addToast, onClose]);

  // The QR code encodes a join link so scanning starts the viewer join flow directly
  const joinUrl = selectedAddress ? `${selectedAddress}/?join=viewer` : null;

  // Render the QR code for the join link
  useEffect(() => {
    if (!joinUrl) return;
    let cancelled = false;
    QRCode.toDataURL(joinUrl, { width: 240, margin: 1 })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch((error) => {
        console.error('Failed to render QR code:', error);
        if (!cancelled) addToast('Could not render QR code', 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [joinUrl, addToast]);

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'
      onClick={onClose}
    >
      <div
        className='bg-slate-800 border border-slate-700 rounded-xl p-6 w-80
                   flex flex-col gap-4 shadow-2xl'
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className='text-sm font-mono font-bold text-slate-200'>Join Band Sync</h2>

        {loading && (
          <p className='text-xs font-mono text-slate-400'>Loading server address...</p>
        )}

        {!loading && !selectedAddress && (
          <p className='text-xs font-mono text-slate-400'>
            No network address found. Is the server connected to your local network?
          </p>
        )}

        {selectedAddress && (
          <>
            <p className='text-xs font-mono text-slate-400'>
              Scan with a phone camera to join as viewer, or open the link in a browser on the same network.
            </p>

            {qrDataUrl && (
              <div className='bg-white rounded p-2 self-center'>
                <img src={qrDataUrl} alt={`QR code for ${joinUrl}`} width={240} height={240} />
              </div>
            )}

            {addresses.length > 1 ? (
              <select
                value={selectedAddress}
                onChange={(e) => setSelectedAddress(e.target.value)}
                aria-label='Select network address'
                className='bg-slate-900 text-slate-200 text-xs font-mono rounded px-2 py-1.5
                           border border-slate-600 focus:border-indigo-500 outline-none'
              >
                {addresses.map((addr) => (
                  <option key={addr} value={addr}>{addr}</option>
                ))}
              </select>
            ) : (
              <p className='text-xs font-mono text-slate-300 text-center select-all'>
                {joinUrl}
              </p>
            )}
          </>
        )}

        <button
          onClick={onClose}
          className='px-3 py-1.5 text-xs font-mono rounded transition-colors
                     bg-slate-700 hover:bg-slate-600 text-slate-300'
        >
          Close
        </button>
      </div>
    </div>
  );
}