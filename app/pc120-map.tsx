'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';
import type { GeoJSONSource, Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl';
import { ChevronDown, Info, Layers3, LocateFixed, Menu, PanelLeftClose, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

type ViewMode = 'proposed' | 'operative' | 'overlay' | 'overlayPlus';
type Selection = { category: string; layer: string; lng: number; lat: number } | null;
type ViewSnapshot = { mode: ViewMode; activeOverlays: Record<string, boolean>; colourBusinessZones: boolean; showEstimatedStoreys: boolean };

const zoneColours: Record<string, string> = {
  'Residential - Large Lot Zone': '#ffffa1', 'Residential - Single House Zone': '#f2ebd4',
  'Residential - Mixed Housing Suburban Zone': '#ffdb6e', 'Residential - Mixed Housing Urban Zone': '#f5b885',
  'Residential - Terrace Housing and Apartment Building Zone': '#eb7d17', 'Residential - Rural and Coastal Settlement Zone': '#eadac9',
  Road: '#ffffff', Water: '#e0ffff',
};

const zoneExpression: any[] = ['match', ['get', 'category'], ...Object.entries(zoneColours).flat(),
  'Business - City Centre Zone', '#d44a75', 'Business - Metropolitan Centre Zone', '#e44c82',
  'Business - Town Centre Zone', '#fc5c94', 'Business - Local Centre Zone', '#ff6edf',
  'Business - Neighbourhood Centre Zone', '#ff99b0', 'Business - Mixed Use Zone', '#deb5f5',
  'Business - General Business Zone', '#c69fe5', 'Business - Business Park Zone', '#a194d4',
  'Business - Light Industry Zone', '#ca52f5', 'Business - Heavy Industry Zone', '#8f3d9c',
  'Rural - Rural Production Zone', '#d9ccc9', 'Open Space - Civic Spaces Zone', '#66cdab',
  'Open Space - Community Zone', '#b3ea00', 'Open Space - Conservation Zone', '#52b529',
  'Open Space - Informal Recreation Zone', '#8cbf78', 'Open Space - Sport and Active Recreation Zone', '#d3ffbe', '#b2b2b2'];

const dataUrl = (filename: string) => {
  const relative = `${import.meta.env.BASE_URL}data/${filename}`;
  return typeof window === 'undefined' ? relative : new URL(relative, window.location.href).href;
};
const publicUrl = (filename: string) => {
  const relative = `${import.meta.env.BASE_URL}${filename}`;
  return typeof window === 'undefined' ? relative : new URL(relative, window.location.href).href;
};
const emptyGeoJSON = { type: 'FeatureCollection', features: [] } as const;
const baseStyle = {
  version: 8,
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#eef1ed' } }],
} as const;
const loadGeoJSON = async (map: MapLibreMap, sourceId: string, url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`);
  const data = await response.json();
  (map.getSource(`${sourceId}-source`) as GeoJSONSource).setData(data);
};
const overlays = [
  { id: 'walkable', label: 'Walkable catchments', url: dataUrl('walkable-catchments.geojson'), colour: '#2563eb' },
  { id: 'transport', label: 'Frequent transport corridor', url: dataUrl('frequent-transport.geojson'), colour: '#7c3aed' },
  { id: 'height', label: 'Height variation controls', url: dataUrl('pc120-height.geojson'), colour: '#db2777' },
  { id: 'withdrawal', label: 'Withdrawal area', url: dataUrl('withdrawal-area.geojson'), colour: '#111827' },
];
const places = [['Central Auckland', 174.7645, -36.8509, 12], ['Albany', 174.6985, -36.7278, 12.5], ['Henderson', 174.6311, -36.881, 12.5], ['Manukau', 174.879, -36.993, 12.5], ['Papakura', 174.9439, -37.0657, 12.5]] as const;
const categoryLabel = (value: string) => value.replace('Residential - ', '').replace('Business - ', '').replace(' Zone', '');
const storeyValues = ['22m', '22m*', '27m', '27m*', '34.5m', '34.5m*', '50m', '50m*'];
const estimatedHeightValues = ['7m', '8m', '9m', '13m', '13m*', '15m', '16m*', '18m', '18m*', '19.5m', '19.5m*', '21m', '21m*', '22.5m', '22.5m*', '24m*', '25m', '30m', '32.5m', '32.5m*', '48.5m', '75m'];
const allHeightValues = [...storeyValues, ...estimatedHeightValues];
const businessZones = [
  'Business - City Centre Zone', 'Business - Metropolitan Centre Zone', 'Business - Town Centre Zone',
  'Business - Local Centre Zone', 'Business - Neighbourhood Centre Zone', 'Business - Mixed Use Zone',
  'Business - General Business Zone', 'Business - Business Park Zone', 'Business - Light Industry Zone',
  'Business - Heavy Industry Zone',
];
const storeyColours = (tenStorey: string, fifteenStorey: string): any[] => ['match', ['get', 'category'],
  ['7m', '8m', '9m'], '#f2ebd4', ['13m', '13m*'], '#ffdb6e', ['15m', '16m*'], '#f5b885',
  ['18m', '18m*', '19.5m', '19.5m*'], '#f09a4c', ['21m', '21m*', '22m', '22m*', '22.5m', '22.5m*'], '#eb7d17',
  ['24m*', '25m'], '#e36417', ['27m', '27m*'], '#d94b16', ['30m', '32.5m', '32.5m*'], '#cf4311',
  ['34.5m', '34.5m*'], tenStorey, ['48.5m', '50m', '50m*'], fifteenStorey, ['75m'], '#9f1207', 'rgba(0,0,0,0)'];
const storeyLabel = (height: string) => {
  const clean = height.replace('*', '');
  const storeys: Record<string, number> = { '7m': 2, '8m': 2, '9m': 2, '13m': 3, '15m': 4, '16m': 4, '18m': 5, '19.5m': 5, '21m': 6, '22m': 6, '22.5m': 6, '24m': 7, '25m': 7, '27m': 8, '30m': 9, '32.5m': 9, '34.5m': 10, '48.5m': 15, '50m': 15, '75m': 23 };
  return storeys[clean] ? `${storeys[clean]} storeys${storeyValues.includes(height) ? '' : ' (estimate)'} — ${clean}` : height;
};

export default function PC120Map() {
  const container = useRef<HTMLDivElement>(null); const mapRef = useRef<MapLibreMap | null>(null);
  const loadedSources = useRef(new Set<string>());
  const [ready, setReady] = useState(false); const [mode, setMode] = useState<ViewMode>('proposed');
  const [activeOverlays, setActiveOverlays] = useState<Record<string, boolean>>({}); const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selection, setSelection] = useState<Selection>(null); const [placeOpen, setPlaceOpen] = useState(false);
  const [tenStoreyColour, setTenStoreyColour] = useState('#c63d0c'); const [fifteenStoreyColour, setFifteenStoreyColour] = useState('#dd1d08');
  const [colourBusinessZones, setColourBusinessZones] = useState(true);
  const [showEstimatedStoreys, setShowEstimatedStoreys] = useState(false);
  const [mapError, setMapError] = useState('');
  const viewStateRef = useRef<ViewSnapshot>({ mode: 'proposed', activeOverlays: {}, colourBusinessZones: true, showEstimatedStoreys: false });
  const viewHistoryRef = useRef<[ViewSnapshot, ViewSnapshot] | null>(null);

  const applySnapshot = (snapshot: ViewSnapshot) => {
    const copy = { ...snapshot, activeOverlays: { ...snapshot.activeOverlays } };
    viewStateRef.current = copy;
    setMode(copy.mode); setActiveOverlays(copy.activeOverlays);
    setColourBusinessZones(copy.colourBusinessZones); setShowEstimatedStoreys(copy.showEstimatedStoreys);
  };
  const commitView = (changes: Partial<ViewSnapshot>) => {
    const current = viewStateRef.current;
    const next = { ...current, ...changes, activeOverlays: changes.activeOverlays ? { ...changes.activeOverlays } : { ...current.activeOverlays } };
    if (JSON.stringify(current) === JSON.stringify(next)) return;
    viewHistoryRef.current = [{ ...current, activeOverlays: { ...current.activeOverlays } }, next];
    applySnapshot(next);
  };

  useEffect(() => {
    if (!container.current || mapRef.current) return; let disposed = false;
    import('maplibre-gl').then((maplibregl) => {
      if (disposed || !container.current) return;
      maplibregl.setWorkerUrl(publicUrl('vendor/maplibre-gl-worker.mjs'));
      const map = new maplibregl.Map({ container: container.current, style: baseStyle as never, center: [174.76, -36.91], zoom: 9.4, minZoom: 7, maxZoom: 18, attributionControl: false });
      mapRef.current = map; map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
      map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: 'Auckland Council data' }));
      map.on('error', (event) => {
        const message = event.error?.message || 'Unknown map loading error';
        console.error('PC120 map error:', message, event);
        setMapError(message);
      });
      map.on('load', () => {
        ([['operative', dataUrl('operative-zoning.geojson')], ['proposed', dataUrl('pc120-zoning.geojson')]] as const).forEach(([id, url]) => {
          map.addSource(`${id}-source`, { type: 'geojson', data: emptyGeoJSON });
          map.addLayer({ id: `${id}-fill`, type: 'fill', source: `${id}-source`, paint: { 'fill-color': zoneExpression as never, 'fill-opacity': 1 }, layout: { visibility: id === 'proposed' ? 'visible' : 'none' } });
          map.addLayer({ id: `${id}-line`, type: 'line', source: `${id}-source`, paint: { 'line-color': '#767676', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.2, 15, 0.9], 'line-opacity': 0.42 }, layout: { visibility: id === 'proposed' ? 'visible' : 'none' } });
        });
        overlays.forEach((item) => {
          map.addSource(`${item.id}-source`, { type: 'geojson', data: emptyGeoJSON });
          const isHeight = item.id === 'height';
          const filter = isHeight ? ['in', ['get', 'category'], ['literal', storeyValues]] as never : undefined;
          map.addLayer({ id: `${item.id}-fill`, type: 'fill', source: `${item.id}-source`, ...(filter ? { filter } : {}), paint: { 'fill-color': isHeight ? storeyColours(tenStoreyColour, fifteenStoreyColour) as never : item.colour, 'fill-opacity': isHeight ? 1 : 0.18 }, layout: { visibility: 'none' } });
          map.addLayer({ id: `${item.id}-line`, type: 'line', source: `${item.id}-source`, ...(filter ? { filter } : {}), paint: { 'line-color': isHeight ? storeyColours(tenStoreyColour, fifteenStoreyColour) as never : item.colour, 'line-width': isHeight ? 1.8 : 1.4, 'line-opacity': 0.9 }, layout: { visibility: 'none' } });
          if (isHeight) {
            const businessFilter = ['in', ['get', 'category'], ['literal', businessZones]] as never;
            map.addLayer({ id: 'business-restore-fill', type: 'fill', source: 'proposed-source', filter: businessFilter, paint: { 'fill-color': zoneExpression as never, 'fill-opacity': 1 }, layout: { visibility: 'none' } });
            map.addLayer({ id: 'business-restore-line', type: 'line', source: 'proposed-source', filter: businessFilter, paint: { 'line-color': '#767676', 'line-width': 0.8, 'line-opacity': 0.32 }, layout: { visibility: 'none' } });
          }
        });
        const selectable = ['proposed-fill', 'operative-fill', ...overlays.map((item) => `${item.id}-fill`)];
        map.on('mousemove', selectable, () => { map.getCanvas().style.cursor = 'pointer'; }); map.on('mouseleave', selectable, () => { map.getCanvas().style.cursor = ''; });
        map.on('click', (event: MapMouseEvent) => { const visible = selectable.filter((id) => map.getLayer(id) && map.getLayoutProperty(id, 'visibility') !== 'none'); const feature = map.queryRenderedFeatures(event.point, { layers: visible })[0]; if (!feature) { setSelection(null); return; } setSelection({ category: String(feature.properties?.category ?? 'Mapped area'), layer: feature.layer.id, lng: event.lngLat.lng, lat: event.lngLat.lat }); });
        loadGeoJSON(map, 'proposed', dataUrl('pc120-zoning.geojson'))
          .then(() => { loadedSources.current.add('proposed'); setReady(true); })
          .catch((error: Error) => { console.error('PC120 zoning load error:', error); setMapError(error.message); });
      });
    });
    return () => { disposed = true; mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current; if (!map || !ready) return;
    const proposedVisible = mode === 'proposed' || mode === 'overlay' || mode === 'overlayPlus';
    const operativeVisible = mode === 'operative' || mode === 'overlay' || mode === 'overlayPlus';
    if (operativeVisible && !loadedSources.current.has('operative')) {
      loadedSources.current.add('operative');
      loadGeoJSON(map, 'operative', dataUrl('operative-zoning.geojson')).catch((error: Error) => {
        loadedSources.current.delete('operative'); setMapError(error.message);
      });
    }
    map.setLayoutProperty('proposed-fill', 'visibility', proposedVisible ? 'visible' : 'none');
    map.setLayoutProperty('proposed-line', 'visibility', proposedVisible ? 'visible' : 'none');
    map.setLayoutProperty('operative-fill', 'visibility', operativeVisible ? 'visible' : 'none');
    map.setLayoutProperty('operative-line', 'visibility', operativeVisible ? 'visible' : 'none');
    map.setPaintProperty('proposed-fill', 'fill-opacity', 1);
    map.setPaintProperty('operative-fill', 'fill-opacity', 1);
    map.setPaintProperty('proposed-line', 'line-color', '#767676');
    map.setPaintProperty('proposed-line', 'line-opacity', 0.32);
    map.setPaintProperty('operative-line', 'line-opacity', 0.32);
    setSelection(null);
  }, [mode, ready]);
  useEffect(() => {
    const map = mapRef.current; if (!map || !ready) return;
    const expression = storeyColours(tenStoreyColour, fifteenStoreyColour) as never;
    map.setPaintProperty('height-fill', 'fill-color', expression);
    map.setPaintProperty('height-line', 'line-color', expression);
  }, [tenStoreyColour, fifteenStoreyColour, ready]);
  useEffect(() => {
    const map = mapRef.current; if (!map || !ready) return;
    const values = showEstimatedStoreys ? allHeightValues : storeyValues;
    const filter = ['in', ['get', 'category'], ['literal', values]] as never;
    map.setFilter('height-fill', filter);
    map.setFilter('height-line', filter);
  }, [showEstimatedStoreys, ready]);
  useEffect(() => {
    const map = mapRef.current; if (!map || !ready) return;
    const restore = Boolean(activeOverlays.height) && !colourBusinessZones;
    map.setLayoutProperty('business-restore-fill', 'visibility', restore ? 'visible' : 'none');
    map.setLayoutProperty('business-restore-line', 'visibility', restore ? 'visible' : 'none');
  }, [colourBusinessZones, activeOverlays.height, ready]);
  useEffect(() => {
    const map = mapRef.current; if (!map || !ready) return;
    overlays.forEach((overlay) => {
      const checked = Boolean(activeOverlays[overlay.id]);
      if (checked && !loadedSources.current.has(overlay.id)) {
        loadedSources.current.add(overlay.id);
        loadGeoJSON(map, overlay.id, overlay.url).catch((error: Error) => {
          loadedSources.current.delete(overlay.id); setMapError(error.message);
        });
      }
      map.setLayoutProperty(`${overlay.id}-fill`, 'visibility', checked ? 'visible' : 'none');
      map.setLayoutProperty(`${overlay.id}-line`, 'visibility', checked ? 'visible' : 'none');
    });
  }, [activeOverlays, ready]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.code !== 'Space' || event.repeat || target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target?.tagName ?? '')) return;
      const history = viewHistoryRef.current; if (!history) return;
      event.preventDefault();
      const [previous, current] = history;
      viewHistoryRef.current = [current, previous];
      applySnapshot(previous);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
  const toggleOverlay = (id: string, checked: boolean) => commitView({ activeOverlays: { ...viewStateRef.current.activeOverlays, [id]: checked } });
  const chooseMode = (nextMode: ViewMode) => {
    if (nextMode === 'overlayPlus') {
      commitView({ mode: nextMode, activeOverlays: { ...viewStateRef.current.activeOverlays, height: true }, colourBusinessZones: true, showEstimatedStoreys: true });
    } else commitView({ mode: nextMode });
  };
  const resetMap = () => mapRef.current?.flyTo({ center: [174.76, -36.91], zoom: 9.4, essential: true });

  return <main className="viewer-shell">
    <div ref={container} className="map-canvas" aria-label="Interactive Auckland PC120 zoning map" />
    <header className="topbar"><div className="brand-mark">120</div><div className="brand-copy"><h1>PC120 Viewer</h1><p>Auckland’s proposed housing plan</p></div><div className="topbar-actions"><span className={`status-dot ${ready ? 'is-ready' : mapError ? 'is-error' : ''}`} /><span className="status-text">{ready ? 'Map ready' : mapError ? `Map error: ${mapError}` : 'Loading basemap…'}</span><Button variant="outline" size="icon" aria-label="Reset map view" onClick={resetMap}><RotateCcw /></Button><Button variant="outline" size="icon" className="mobile-menu" aria-label="Open map controls" onClick={() => setSidebarOpen(true)}><Menu /></Button></div></header>
    <aside className={`control-panel ${sidebarOpen ? 'is-open' : ''}`}>
      <div className="panel-heading"><div><span className="eyebrow">Explore the proposal</span><h2>Planning layers</h2></div><Button variant="ghost" size="icon" aria-label="Close controls" onClick={() => setSidebarOpen(false)}><PanelLeftClose /></Button></div>
      <section className="control-section"><label className="control-label">Plan view</label><div className="segmented segmented-four" role="group" aria-label="Plan view"><button className={mode === 'proposed' ? 'active' : ''} onClick={() => chooseMode('proposed')}>PC120</button><button className={mode === 'operative' ? 'active' : ''} onClick={() => chooseMode('operative')}>Current</button><button className={mode === 'overlay' ? 'active' : ''} onClick={() => chooseMode('overlay')}>Overlay</button><button className={mode === 'overlayPlus' ? 'active' : ''} onClick={() => chooseMode('overlayPlus')}>Overlay+</button></div><p className="section-note">Overlay+ enables height estimates and Business-zone colouring. Press <kbd>Space</kbd> to swap the last two complete views.</p></section>
      <section className="control-section"><label className="control-label">Jump to an area</label><button className="place-select" onClick={() => setPlaceOpen((value) => !value)}><span><LocateFixed /> Choose a centre</span><ChevronDown className={placeOpen ? 'rotate' : ''} /></button>{placeOpen && <div className="place-menu">{places.map(([name, lng, lat, zoom]) => <button key={name} onClick={() => { mapRef.current?.flyTo({ center: [lng, lat], zoom, essential: true }); setPlaceOpen(false); }}>{name}</button>)}</div>}</section>
      <section className="control-section"><label className="control-label">Context layers</label><div className="layer-list">{overlays.map((item) => <label className="layer-row" key={item.id}><span className="layer-swatch" style={{ backgroundColor: item.id === 'height' ? tenStoreyColour : item.colour }} /><span>{item.label}</span><Switch checked={Boolean(activeOverlays[item.id])} onCheckedChange={(checked) => toggleOverlay(item.id, checked)} /></label>)}</div>{activeOverlays.height && <div className="storey-controls"><div className="storey-key"><span style={{ backgroundColor: '#eb7d17' }} /><b>6 storeys</b><small>22m / 22m*</small></div><div className="storey-key"><span style={{ backgroundColor: '#d94b16' }} /><b>8 storeys</b><small>27m / 27m*</small></div><label className="storey-key editable"><input type="color" value={tenStoreyColour} onChange={(event) => setTenStoreyColour(event.target.value)} aria-label="10-storey colour" /><b>10 storeys</b><small>34.5m / 34.5m*</small></label><label className="storey-key editable"><input type="color" value={fifteenStoreyColour} onChange={(event) => setFifteenStoreyColour(event.target.value)} aria-label="15-storey colour" /><b>15 storeys</b><small>50m / 50m*</small></label><label className="layer-row estimate-colour-toggle"><span className="layer-swatch estimate-swatch" /><span>Height variation control storey estimate colours</span><Switch checked={showEstimatedStoreys} onCheckedChange={(checked) => commitView({ showEstimatedStoreys: checked })} /></label>{showEstimatedStoreys && <p className="estimate-note">Indicative estimates: 2 storeys at 7–9m, 3 at 13m, 4 at 15–16m, 5 at 18–19.5m, 6 at 21–22.5m, 7 at 24–25m, 9 at 30–32.5m, 15 at 48.5m, and 23 at 75m.</p>}<label className="layer-row business-colour-toggle"><span className="layer-swatch business-swatch" /><span>Colour Business zones</span><Switch checked={colourBusinessZones} onCheckedChange={(checked) => commitView({ colourBusinessZones: checked })} /></label></div>}</section>
      <section className="control-section legend-section"><label className="control-label">Original plan colours</label>{Object.entries(zoneColours).slice(0, 6).map(([label, colour]) => <div className="legend-row" key={label}><span style={{ backgroundColor: colour }} /><p>{categoryLabel(label)}</p></div>)}<div className="legend-row"><span style={{ backgroundColor: '#fc5c94' }} /><p>Business zones</p></div><div className="legend-row"><span style={{ backgroundColor: '#52b529' }} /><p>Open space and rural</p></div></section>
      <footer className="panel-footer"><Info /> Planning data supplied by Auckland Council. This viewer is informational and not a legal planning document.</footer>
    </aside>
    {!sidebarOpen && <Button className="open-panel" onClick={() => setSidebarOpen(true)}><Layers3 /> Layers</Button>}
    <div className="map-key">{mode === 'overlay' || mode === 'overlayPlus' ? <><span className="key-dot current-dot" />Current plan <span className="key-dot" />PC120 above</> : <><span className={`key-dot ${mode === 'operative' ? 'current-dot' : ''}`} />{mode === 'proposed' ? 'PC120 proposed zoning' : 'Operative Unitary Plan'}</>}</div>
    {selection && <article className="selection-card"><Button variant="ghost" size="icon-sm" className="selection-close" aria-label="Close details" onClick={() => setSelection(null)}><X /></Button><span className="eyebrow">Selected location</span><h3>{selection.layer.includes('height') ? storeyLabel(selection.category) : categoryLabel(selection.category)}</h3><p>{selection.layer.includes('height') ? 'PC120 height variation control' : selection.layer.includes('fill') ? 'Zoning classification' : 'Planning overlay'}</p><small>{selection.lat.toFixed(5)}, {selection.lng.toFixed(5)}</small></article>}
  </main>;
}
