'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl';
import { ChevronDown, Info, Layers3, LocateFixed, Menu, PanelLeftClose, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

type ViewMode = 'proposed' | 'operative';
type Selection = { category: string; layer: string; lng: number; lat: number } | null;

const zoneColours: Record<string, string> = {
  'Residential - Large Lot Zone': '#e8e492', 'Residential - Single House Zone': '#efe7cf',
  'Residential - Mixed Housing Suburban Zone': '#f7cf59', 'Residential - Mixed Housing Urban Zone': '#f0a365',
  'Residential - Terrace Housing and Apartment Building Zone': '#de6f21', 'Residential - Rural and Coastal Settlement Zone': '#d7dca4',
  Road: '#d9d7d1', Water: '#b7d8df',
};

const zoneExpression: any[] = ['match', ['get', 'category'], ...Object.entries(zoneColours).flat(),
  'Business - City Centre Zone', '#ca4c88', 'Business - Metropolitan Centre Zone', '#d65c9a',
  'Business - Town Centre Zone', '#e371aa', 'Business - Local Centre Zone', '#ec8dbb',
  'Business - Neighbourhood Centre Zone', '#f3aacb', 'Business - Mixed Use Zone', '#e890b7',
  'Business - General Business Zone', '#dda0bd', 'Business - Business Park Zone', '#c59cae',
  'Business - Light Industry Zone', '#b98ea2', 'Business - Heavy Industry Zone', '#8f7180',
  'Rural - Rural Production Zone', '#9eb290', 'Open Space - Civic Spaces Zone', '#9bcaa2',
  'Open Space - Community Zone', '#9bcaa2', 'Open Space - Conservation Zone', '#79ae84',
  'Open Space - Informal Recreation Zone', '#8fc795', 'Open Space - Sport and Active Recreation Zone', '#70b57f', '#b7b6ae'];

const overlays = [
  { id: 'walkable', label: 'Walkable catchments', url: '/data/walkable-catchments.geojson', colour: '#2563eb' },
  { id: 'transport', label: 'Frequent transport corridor', url: '/data/frequent-transport.geojson', colour: '#7c3aed' },
  { id: 'height', label: 'Height variation controls', url: '/data/pc120-height.geojson', colour: '#db2777' },
  { id: 'withdrawal', label: 'Withdrawal area', url: '/data/withdrawal-area.geojson', colour: '#111827' },
];
const places = [['Central Auckland', 174.7645, -36.8509, 12], ['Albany', 174.6985, -36.7278, 12.5], ['Henderson', 174.6311, -36.881, 12.5], ['Manukau', 174.879, -36.993, 12.5], ['Papakura', 174.9439, -37.0657, 12.5]] as const;
const categoryLabel = (value: string) => value.replace('Residential - ', '').replace('Business - ', '').replace(' Zone', '');

export default function PC120Map() {
  const container = useRef<HTMLDivElement>(null); const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false); const [mode, setMode] = useState<ViewMode>('proposed');
  const [activeOverlays, setActiveOverlays] = useState<Record<string, boolean>>({}); const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selection, setSelection] = useState<Selection>(null); const [placeOpen, setPlaceOpen] = useState(false);

  useEffect(() => {
    if (!container.current || mapRef.current) return; let disposed = false;
    import('maplibre-gl').then(({ default: maplibregl }) => {
      if (disposed || !container.current) return;
      const map = new maplibregl.Map({ container: container.current, style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json', center: [174.76, -36.91], zoom: 9.4, minZoom: 7, maxZoom: 18, attributionControl: false });
      mapRef.current = map; map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
      map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: 'Auckland Council data' }));
      map.on('load', () => {
        ([['operative', '/data/operative-zoning.geojson'], ['proposed', '/data/pc120-zoning.geojson']] as const).forEach(([id, url]) => {
          map.addSource(`${id}-source`, { type: 'geojson', data: url });
          map.addLayer({ id: `${id}-fill`, type: 'fill', source: `${id}-source`, paint: { 'fill-color': zoneExpression as never, 'fill-opacity': id === 'proposed' ? 0.78 : 0.62 }, layout: { visibility: id === 'proposed' ? 'visible' : 'none' } });
          map.addLayer({ id: `${id}-line`, type: 'line', source: `${id}-source`, paint: { 'line-color': '#5f5b52', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.25, 15, 1.1], 'line-opacity': 0.52 }, layout: { visibility: id === 'proposed' ? 'visible' : 'none' } });
        });
        overlays.forEach((item) => {
          map.addSource(`${item.id}-source`, { type: 'geojson', data: item.url });
          map.addLayer({ id: `${item.id}-fill`, type: 'fill', source: `${item.id}-source`, paint: { 'fill-color': item.colour, 'fill-opacity': 0.18 }, layout: { visibility: 'none' } });
          map.addLayer({ id: `${item.id}-line`, type: 'line', source: `${item.id}-source`, paint: { 'line-color': item.colour, 'line-width': 1.4, 'line-opacity': 0.9 }, layout: { visibility: 'none' } });
        });
        const selectable = ['proposed-fill', 'operative-fill', ...overlays.map((item) => `${item.id}-fill`)];
        map.on('mousemove', selectable, () => { map.getCanvas().style.cursor = 'pointer'; }); map.on('mouseleave', selectable, () => { map.getCanvas().style.cursor = ''; });
        map.on('click', (event: MapMouseEvent) => { const visible = selectable.filter((id) => map.getLayer(id) && map.getLayoutProperty(id, 'visibility') !== 'none'); const feature = map.queryRenderedFeatures(event.point, { layers: visible })[0]; if (!feature) { setSelection(null); return; } setSelection({ category: String(feature.properties?.category ?? 'Mapped area'), layer: feature.layer.id, lng: event.lngLat.lng, lat: event.lngLat.lat }); });
        setReady(true);
      });
    });
    return () => { disposed = true; mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => { const map = mapRef.current; if (!map || !ready) return; (['proposed', 'operative'] as const).forEach((id) => { const visibility = id === mode ? 'visible' : 'none'; map.setLayoutProperty(`${id}-fill`, 'visibility', visibility); map.setLayoutProperty(`${id}-line`, 'visibility', visibility); }); setSelection(null); }, [mode, ready]);
  const toggleOverlay = (id: string, checked: boolean) => { setActiveOverlays((current) => ({ ...current, [id]: checked })); const map = mapRef.current; if (!map || !ready) return; map.setLayoutProperty(`${id}-fill`, 'visibility', checked ? 'visible' : 'none'); map.setLayoutProperty(`${id}-line`, 'visibility', checked ? 'visible' : 'none'); };
  const resetMap = () => mapRef.current?.flyTo({ center: [174.76, -36.91], zoom: 9.4, essential: true });

  return <main className="viewer-shell">
    <div ref={container} className="map-canvas" aria-label="Interactive Auckland PC120 zoning map" />
    <header className="topbar"><div className="brand-mark">120</div><div className="brand-copy"><h1>PC120 Viewer</h1><p>Auckland’s proposed housing plan</p></div><div className="topbar-actions"><span className={`status-dot ${ready ? 'is-ready' : ''}`} /><span className="status-text">{ready ? 'Map ready' : 'Loading layers…'}</span><Button variant="outline" size="icon" aria-label="Reset map view" onClick={resetMap}><RotateCcw /></Button><Button variant="outline" size="icon" className="mobile-menu" aria-label="Open map controls" onClick={() => setSidebarOpen(true)}><Menu /></Button></div></header>
    <aside className={`control-panel ${sidebarOpen ? 'is-open' : ''}`}>
      <div className="panel-heading"><div><span className="eyebrow">Explore the proposal</span><h2>Planning layers</h2></div><Button variant="ghost" size="icon" aria-label="Close controls" onClick={() => setSidebarOpen(false)}><PanelLeftClose /></Button></div>
      <section className="control-section"><label className="control-label">Plan view</label><div className="segmented" role="group" aria-label="Plan view"><button className={mode === 'proposed' ? 'active' : ''} onClick={() => setMode('proposed')}>PC120 proposed</button><button className={mode === 'operative' ? 'active' : ''} onClick={() => setMode('operative')}>Current plan</button></div><p className="section-note">Switch between proposed PC120 zoning and the operative Unitary Plan.</p></section>
      <section className="control-section"><label className="control-label">Jump to an area</label><button className="place-select" onClick={() => setPlaceOpen((value) => !value)}><span><LocateFixed /> Choose a centre</span><ChevronDown className={placeOpen ? 'rotate' : ''} /></button>{placeOpen && <div className="place-menu">{places.map(([name, lng, lat, zoom]) => <button key={name} onClick={() => { mapRef.current?.flyTo({ center: [lng, lat], zoom, essential: true }); setPlaceOpen(false); }}>{name}</button>)}</div>}</section>
      <section className="control-section"><label className="control-label">Context layers</label><div className="layer-list">{overlays.map((item) => <label className="layer-row" key={item.id}><span className="layer-swatch" style={{ backgroundColor: item.colour }} /><span>{item.label}</span><Switch checked={Boolean(activeOverlays[item.id])} onCheckedChange={(checked) => toggleOverlay(item.id, checked)} /></label>)}</div></section>
      <section className="control-section legend-section"><label className="control-label">Residential zoning</label>{Object.entries(zoneColours).slice(0, 6).map(([label, colour]) => <div className="legend-row" key={label}><span style={{ backgroundColor: colour }} /><p>{categoryLabel(label)}</p></div>)}<div className="legend-row"><span style={{ backgroundColor: '#e371aa' }} /><p>Business zones</p></div><div className="legend-row"><span style={{ backgroundColor: '#79ae84' }} /><p>Open space and rural</p></div></section>
      <footer className="panel-footer"><Info /> Planning data supplied by Auckland Council. This viewer is informational and not a legal planning document.</footer>
    </aside>
    {!sidebarOpen && <Button className="open-panel" onClick={() => setSidebarOpen(true)}><Layers3 /> Layers</Button>}
    <div className="map-key"><span className="key-dot" />{mode === 'proposed' ? 'PC120 proposed zoning' : 'Operative Unitary Plan'}</div>
    {selection && <article className="selection-card"><Button variant="ghost" size="icon-sm" className="selection-close" aria-label="Close details" onClick={() => setSelection(null)}><X /></Button><span className="eyebrow">Selected location</span><h3>{categoryLabel(selection.category)}</h3><p>{selection.layer.includes('height') ? 'Height variation control' : selection.layer.includes('fill') ? 'Zoning classification' : 'Planning overlay'}</p><small>{selection.lat.toFixed(5)}, {selection.lng.toFixed(5)}</small></article>}
  </main>;
}
