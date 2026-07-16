import { createClient } from 'npm:@supabase/supabase-js@2.110.6';

const MAX_STATE_BYTES = 1_500_000;

function corsHeaders(request: Request) {
  const configuredOrigins = (Deno.env.get('ALLOWED_ORIGIN') || '*').split(',').map((value) => value.trim());
  const requestOrigin = request.headers.get('origin') || '';
  const origin = configuredOrigins.includes('*') || configuredOrigins.includes(requestOrigin)
    ? (requestOrigin || '*')
    : configuredOrigins[0];
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  };
}

Deno.serve(async (request) => {
  const cors = corsHeaders(request);
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ code: 'not_configured', error: 'Supabase 同步服務尚未設定完成' }, 503, cors);
  }

  try {
    const rawBody = await request.text();
    if (rawBody.length > MAX_STATE_BYTES * 2) {
      return json({ code: 'payload_too_large', error: '同步資料超過大小限制' }, 413, cors);
    }
    const body = JSON.parse(rawBody);
    const action = String(body?.action || '');
    if (!['create', 'connect', 'save'].includes(action)) {
      return json({ code: 'invalid_action', error: '不支援的同步操作' }, 400, cors);
    }

    const workspaceCode = normalizeSyncCode(body?.workspaceCode);
    if (!/^[A-Z0-9]{24,64}$/.test(workspaceCode)) {
      return json({ code: 'invalid_code', error: '同步碼格式不正確' }, 400, cors);
    }

    const workspaceHash = await sha256(workspaceCode);
    const clientId = String(body?.clientId || '').slice(0, 100);
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    if (action === 'connect') {
      const { data, error } = await supabase
        .from('trip_sync_state')
        .select('state, updated_by, updated_at')
        .eq('workspace_hash', workspaceHash)
        .maybeSingle();
      if (error) return databaseError(error, cors);
      if (!data) return json({ code: 'workspace_not_found', error: '找不到這組家庭同步碼' }, 404, cors);
      return json({
        workspaceHash,
        state: data.state,
        updatedBy: data.updated_by,
        updatedAt: data.updated_at
      }, 200, cors);
    }

    const validationError = validateState(body?.state);
    if (validationError) return json({ code: 'invalid_state', error: validationError }, 400, cors);

    if (action === 'create') {
      const { data, error } = await supabase
        .from('trip_sync_state')
        .insert({ workspace_hash: workspaceHash, state: body.state, updated_by: clientId })
        .select('state, updated_by, updated_at')
        .single();
      if (error?.code === '23505') {
        return json({ code: 'workspace_exists', error: '同步碼已存在，請重新建立' }, 409, cors);
      }
      if (error) return databaseError(error, cors);
      return json({
        workspaceHash,
        state: data.state,
        updatedBy: data.updated_by,
        updatedAt: data.updated_at
      }, 201, cors);
    }

    const updatedAt = new Date().toISOString();
    const { data, error } = await supabase
      .from('trip_sync_state')
      .update({ state: body.state, updated_by: clientId, updated_at: updatedAt })
      .eq('workspace_hash', workspaceHash)
      .select('state, updated_by, updated_at')
      .maybeSingle();
    if (error) return databaseError(error, cors);
    if (!data) return json({ code: 'workspace_not_found', error: '家庭同步空間已不存在' }, 404, cors);
    return json({
      workspaceHash,
      state: data.state,
      updatedBy: data.updated_by,
      updatedAt: data.updated_at
    }, 200, cors);
  } catch (error) {
    const message = error instanceof SyntaxError
      ? '請求內容不是有效的 JSON'
      : (error instanceof Error ? error.message : '伺服器錯誤');
    return json({ code: 'server_error', error: message }, 500, cors);
  }
});

function validateState(state: unknown) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return '旅行資料格式不正確';
  const value = state as Record<string, unknown>;
  if (!value.trip || typeof value.trip !== 'object' || Array.isArray(value.trip)) return '缺少旅行設定';
  if (!Array.isArray(value.itinerary)) return '缺少行程資料';
  if (!Array.isArray(value.wishlist)) return '缺少願望清單';
  const size = new TextEncoder().encode(JSON.stringify(state)).byteLength;
  return size > MAX_STATE_BYTES ? '同步資料超過大小限制' : '';
}

function normalizeSyncCode(value: unknown) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function databaseError(error: { message?: string; code?: string }, cors: Record<string, string>) {
  console.error('trip-sync database error', error);
  return json({ code: 'database_error', error: 'Supabase 資料庫操作失敗' }, 500, cors);
}

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' }
  });
}
