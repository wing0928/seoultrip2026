import { useCallback, useEffect, useRef, useState } from 'react';
import { enrichItinerary } from '../data/itinerary.js';
import { clearSyncCode, loadSyncCode, saveSyncCode } from '../utils/storage.js';
import {
  supabase,
  supabaseConfigured,
  supabasePublishableKey,
  supabaseSyncFunctionUrl
} from '../utils/supabase.js';

const SAVE_DELAY = 650;
const CLIENT_ID_KEY = 'seoul-trip-2026:sync-client-id';

export function useTripSync({ trip, itinerary, wishlist, setTrip, setItinerary, setWishlist }) {
  const initialCodeRef = useRef(loadSyncCode());
  const storedCode = initialCodeRef.current;
  const [syncCode, setSyncCode] = useState(storedCode);
  const [status, setStatus] = useState(() => {
    if (!supabaseConfigured) return 'not-configured';
    return storedCode ? 'connecting' : 'disconnected';
  });
  const [error, setError] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState('');

  const currentStateRef = useRef({ trip, itinerary, wishlist });
  currentStateRef.current = { trip, itinerary, wishlist };
  const channelRef = useRef(null);
  const connectedCodeRef = useRef('');
  const applyingRemoteRef = useRef(false);
  const readyRef = useRef(false);
  const mountedRef = useRef(true);
  const autoConnectStartedRef = useRef(false);
  const connectionAttemptRef = useRef(0);
  const saveTimerRef = useRef(null);
  const saveQueueRef = useRef(Promise.resolve());
  const clientIdRef = useRef(getClientId());

  const applyRemoteState = useCallback((state) => {
    if (!isTripState(state)) return;

    const normalized = {
      trip: state.trip,
      itinerary: enrichItinerary(state.itinerary),
      wishlist: state.wishlist
    };
    const current = currentStateRef.current;
    const tripChanged = fingerprint(current.trip) !== fingerprint(normalized.trip);
    const itineraryChanged = fingerprint(current.itinerary) !== fingerprint(normalized.itinerary);
    const wishlistChanged = fingerprint(current.wishlist) !== fingerprint(normalized.wishlist);

    if (!tripChanged && !itineraryChanged && !wishlistChanged) return;

    applyingRemoteRef.current = true;
    currentStateRef.current = normalized;
    if (tripChanged) setTrip(normalized.trip);
    if (itineraryChanged) setItinerary(normalized.itinerary);
    if (wishlistChanged) setWishlist(normalized.wishlist);
  }, [setItinerary, setTrip, setWishlist]);

  const stopChannel = useCallback(async () => {
    const channel = channelRef.current;
    channelRef.current = null;
    if (channel && supabase) await supabase.removeChannel(channel);
  }, []);

  const openChannel = useCallback(async (workspaceHash) => {
    if (!supabase) return;
    await stopChannel();

    const channel = supabase.channel(`trip-sync:${workspaceHash}`, {
      config: { broadcast: { ack: true, self: false } }
    });
    channelRef.current = channel;
    channel.on('broadcast', { event: 'state' }, (message) => {
      const payload = message?.payload;
      if (!payload?.state || payload.updatedBy === clientIdRef.current) return;
      applyRemoteState(payload.state);
      setLastSyncedAt(payload.updatedAt || new Date().toISOString());
      setError('');
      setStatus('synced');
    });

    await new Promise((resolve, reject) => {
      let settled = false;
      const timeout = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error('即時同步連線逾時'));
      }, 10000);

      channel.subscribe((nextStatus) => {
        if (nextStatus === 'SUBSCRIBED') {
          if (!settled) {
            settled = true;
            window.clearTimeout(timeout);
            resolve();
          }
          return;
        }
        if (!settled && ['CHANNEL_ERROR', 'TIMED_OUT'].includes(nextStatus)) {
          settled = true;
          window.clearTimeout(timeout);
          reject(new Error('無法建立即時同步連線'));
        }
      });
    });
  }, [applyRemoteState, stopChannel]);

  const connectWorkspace = useCallback(async (code, action) => {
    if (!supabaseConfigured || !supabaseSyncFunctionUrl) {
      const message = 'Supabase 尚未設定完成';
      setStatus('not-configured');
      setError(message);
      throw new Error(message);
    }

    const normalizedCode = normalizeSyncCode(code);
    if (!isValidSyncCode(normalizedCode)) {
      const message = '同步碼格式不正確';
      setError(message);
      throw new Error(message);
    }

    const attempt = connectionAttemptRef.current + 1;
    connectionAttemptRef.current = attempt;
    readyRef.current = false;
    window.clearTimeout(saveTimerRef.current);
    setStatus('connecting');
    setError('');

    try {
      const payload = await callSyncFunction({
        action,
        workspaceCode: normalizedCode,
        state: action === 'create' ? currentStateRef.current : undefined,
        clientId: clientIdRef.current
      });
      if (!mountedRef.current || attempt !== connectionAttemptRef.current) return payload;

      if (action === 'connect') applyRemoteState(payload.state);
      connectedCodeRef.current = normalizedCode;
      readyRef.current = true;
      saveSyncCode(normalizedCode);
      setSyncCode(normalizedCode);
      setLastSyncedAt(payload.updatedAt || new Date().toISOString());

      try {
        await openChannel(payload.workspaceHash);
        if (mountedRef.current && attempt === connectionAttemptRef.current) setStatus('synced');
      } catch (channelError) {
        if (mountedRef.current && attempt === connectionAttemptRef.current) {
          setStatus('error');
          setError(channelError instanceof Error ? channelError.message : '即時同步連線失敗');
        }
      }
      return payload;
    } catch (connectError) {
      if (mountedRef.current && attempt === connectionAttemptRef.current) {
        setStatus('error');
        setError(connectError instanceof Error ? connectError.message : 'Supabase 連線失敗');
      }
      throw connectError;
    }
  }, [applyRemoteState, openChannel]);

  const createWorkspace = useCallback(async () => {
    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const code = generateSyncCode();
        await connectWorkspace(code, 'create');
        return code;
      } catch (createError) {
        lastError = createError;
        if (createError?.code !== 'workspace_exists') throw createError;
      }
    }
    throw lastError || new Error('無法建立家庭同步空間');
  }, [connectWorkspace]);

  const joinWorkspace = useCallback((code) => connectWorkspace(code, 'connect'), [connectWorkspace]);

  const performSave = useCallback(async () => {
    const code = connectedCodeRef.current;
    if (!readyRef.current || !code) return;

    setStatus('saving');
    setError('');
    const state = currentStateRef.current;
    try {
      const payload = await callSyncFunction({
        action: 'save',
        workspaceCode: code,
        state,
        clientId: clientIdRef.current
      });
      if (!mountedRef.current || code !== connectedCodeRef.current) return;

      const updatedAt = payload.updatedAt || new Date().toISOString();
      setLastSyncedAt(updatedAt);
      setStatus('synced');
      const channel = channelRef.current;
      if (channel) {
        await channel.send({
          type: 'broadcast',
          event: 'state',
          payload: { state, updatedBy: clientIdRef.current, updatedAt }
        });
      }
    } catch (saveError) {
      if (mountedRef.current && code === connectedCodeRef.current) {
        setStatus('error');
        setError(saveError instanceof Error ? saveError.message : '資料同步失敗');
      }
      throw saveError;
    }
  }, []);

  const syncNow = useCallback(() => {
    const queued = saveQueueRef.current.catch(() => {}).then(performSave);
    saveQueueRef.current = queued;
    return queued;
  }, [performSave]);

  const disconnect = useCallback(async () => {
    connectionAttemptRef.current += 1;
    readyRef.current = false;
    connectedCodeRef.current = '';
    window.clearTimeout(saveTimerRef.current);
    await stopChannel();
    clearSyncCode();
    setSyncCode('');
    setError('');
    setLastSyncedAt('');
    setStatus(supabaseConfigured ? 'disconnected' : 'not-configured');
  }, [stopChannel]);

  useEffect(() => {
    if (!readyRef.current) return undefined;
    if (applyingRemoteRef.current) {
      applyingRemoteRef.current = false;
      return undefined;
    }

    setStatus('saving');
    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      syncNow().catch(() => {});
    }, SAVE_DELAY);
    return () => window.clearTimeout(saveTimerRef.current);
  }, [trip, itinerary, wishlist, syncNow]);

  useEffect(() => {
    if (!supabaseConfigured || !storedCode || autoConnectStartedRef.current) return;
    autoConnectStartedRef.current = true;
    joinWorkspace(storedCode).catch(() => {});
  }, [joinWorkspace, storedCode]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      window.clearTimeout(saveTimerRef.current);
      const channel = channelRef.current;
      channelRef.current = null;
      if (channel && supabase) supabase.removeChannel(channel);
    };
  }, []);

  return {
    configured: supabaseConfigured,
    syncCode,
    status,
    error,
    lastSyncedAt,
    createWorkspace,
    joinWorkspace,
    disconnect,
    syncNow
  };
}

export function normalizeSyncCode(code) {
  return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function formatSyncCode(code) {
  return normalizeSyncCode(code).replace(/(.{4})(?=.)/g, '$1-');
}

function generateSyncCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function isValidSyncCode(code) {
  return /^[A-Z0-9]{24,64}$/.test(code);
}

function getClientId() {
  let clientId = sessionStorage.getItem(CLIENT_ID_KEY);
  if (!clientId) {
    clientId = crypto.randomUUID();
    sessionStorage.setItem(CLIENT_ID_KEY, clientId);
  }
  return clientId;
}

function isTripState(state) {
  return Boolean(
    state &&
    typeof state === 'object' &&
    state.trip &&
    typeof state.trip === 'object' &&
    Array.isArray(state.itinerary) &&
    Array.isArray(state.wishlist)
  );
}

function fingerprint(value) {
  return JSON.stringify(value);
}

async function callSyncFunction(body) {
  let response;
  try {
    response = await fetch(supabaseSyncFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabasePublishableKey
      },
      body: JSON.stringify(body)
    });
  } catch {
    throw new Error('無法連線到家庭同步服務，請確認 trip-sync 已部署');
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || '家庭同步服務無法連線');
    error.code = payload.code || 'sync_failed';
    throw error;
  }
  if (!payload.workspaceHash || !isTripState(payload.state)) {
    throw new Error('Supabase 回傳的資料格式不正確');
  }
  return payload;
}
