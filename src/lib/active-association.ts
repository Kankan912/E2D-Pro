const STORAGE_KEY = 'e2d_active_association';
let activeId: string | null = null;
const listeners = new Set<() => void>();

function init() {
  try { activeId = localStorage.getItem(STORAGE_KEY); } catch { /* SSR */ }
}
init();

export function getActiveAssociationId(): string | null { return activeId; }

export function setActiveAssociationId(id: string | null) {
  activeId = id;
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
  listeners.forEach(l => l());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
