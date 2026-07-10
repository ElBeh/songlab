import { useSongStore } from '../stores/useSongStore';
import { useTabStore } from '../stores/useTabStore';
import type { SectionMarker } from '../types';

interface MarkerTrackerResult {
  selectedMarker: SectionMarker | null;
  selectedMarkerEnd: number;
}

/**
 * Derives the currently active marker from playback position and manual selection.
 * Also provides the end time of the selected marker (= start of next marker or song end).
 */
export function useActiveMarkerTracker(
  currentTime: number,
  duration: number,
): MarkerTrackerResult {
  // Subscribe to the underlying state (not the stable getter function),
  // so the hook re-renders when markers or the active song change.
  const markersBySong = useSongStore((state) => state.markersBySong);
  const activeSongId = useSongStore((state) => state.activeSongId);
  const activeMarkerId = useTabStore((state) => state.activeMarkerId);

  const markers = activeSongId ? (markersBySong[activeSongId] ?? []) : [];
  const sortedMarkers = [...markers].sort((a, b) => a.startTime - b.startTime);

  // Marker whose startTime is closest to (but not after) the current playhead
  const timeBasedMarker =
    [...sortedMarkers].reverse().find((m) => m.startTime <= currentTime + 0.1) ?? null;

  // Manual selection takes precedence, falls back to time-based
  const selectedMarker = activeMarkerId
    ? markers.find((m) => m.id === activeMarkerId) ?? timeBasedMarker
    : timeBasedMarker;

  const selectedMarkerEnd = selectedMarker
    ? (sortedMarkers.find((m) => m.startTime > selectedMarker.startTime)?.startTime ?? duration)
    : duration;

  return { selectedMarker, selectedMarkerEnd };
}