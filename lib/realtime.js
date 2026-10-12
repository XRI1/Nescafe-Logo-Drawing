const encoder = new TextEncoder();
const globalForRealtime = globalThis;
const hub = globalForRealtime.__nescafeRealtimeHub || { listeners: new Set() };
globalForRealtime.__nescafeRealtimeHub = hub;

export function subscribeToDesigns(listener) {
  hub.listeners.add(listener);
  return () => hub.listeners.delete(listener);
}

export function publishDesign(design) {
  const payload = encoder.encode(`event: design.created\ndata: ${JSON.stringify(design)}\n\n`);
  for (const listener of hub.listeners) {
    try { listener(payload); } catch { hub.listeners.delete(listener); }
  }
}

export { encoder };
