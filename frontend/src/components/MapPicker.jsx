import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function ClickHandler({ onPick }) {
  useMapEvents({ click: e => onPick({ latitude: e.latlng.lat, longitude: e.latlng.lng }) });
  return null;
}

function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], 17, { duration: 1 });
  }, [target]);
  return null;
}

export function MapPicker({ coords, onChange, searchHint = '' }) {
  const [search, setSearch] = useState(searchHint);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [flyTarget, setFlyTarget] = useState(null);

  const defaultCenter = coords
    ? [coords.latitude, coords.longitude]
    : [6.5244, 3.3792];

  const handleSearch = async e => {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    setSearching(true);
    setSearchError('');
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
        { headers: { 'User-Agent': 'AttendanceSaaS/1.0' } }
      );
      const data = await res.json();
      if (!data.length) {
        setSearchError('Address not found — try a more specific address.');
      } else {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        setFlyTarget({ lat, lng });
        onChange({ latitude: lat, longitude: lng });
      }
    } catch {
      setSearchError('Search failed — check your internet connection.');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-3">
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Search address to navigate…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <Button type="submit" variant="outline" disabled={searching} className="shrink-0">
          {searching ? <Spinner /> : 'Search'}
        </Button>
      </form>

      {searchError && <p className="text-xs text-destructive">{searchError}</p>}

      <p className="text-xs text-muted-foreground">
        Search for the address above, then click on the map to fine-tune the pin position.
      </p>

      <div className="rounded-lg overflow-hidden border" style={{ height: 320 }}>
        <MapContainer
          center={defaultCenter}
          zoom={coords ? 17 : 13}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onPick={onChange} />
          <FlyTo target={flyTarget} />
          {coords && <Marker position={[coords.latitude, coords.longitude]} />}
        </MapContainer>
      </div>

      {coords ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-0.5">
          <p className="text-xs font-semibold text-green-800">Location pinned</p>
          <p className="text-xs text-green-700 font-mono">Lat: {coords.latitude.toFixed(6)}</p>
          <p className="text-xs text-green-700 font-mono">Lng: {coords.longitude.toFixed(6)}</p>
        </div>
      ) : (
        <div className="bg-muted rounded-lg p-3 text-xs text-muted-foreground text-center">
          No pin placed yet — click the map or search an address
        </div>
      )}
    </div>
  );
}
