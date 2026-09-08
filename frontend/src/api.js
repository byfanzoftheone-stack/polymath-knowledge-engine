const rawBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const API_BASE_URL = rawBaseUrl || '';

export async function listLessons() {
  const response = await fetch(`${API_BASE_URL}/api/lessons`);
  return response.json();
}

export async function listSessions() {
  const response = await fetch(`${API_BASE_URL}/api/sessions`);
  return response.json();
}

export async function startSession(payload) {
  const response = await fetch(`${API_BASE_URL}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  return response.json();
}

export async function submitRelayCommand(payload) {
  const response = await fetch(`${API_BASE_URL}/api/relay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  return response.json();
}

export function resolveWebSocketUrl() {
  if (rawBaseUrl) {
    const url = new URL(rawBaseUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return url.toString().replace(/\/$/, '');
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
}
