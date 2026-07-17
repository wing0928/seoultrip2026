import { useState } from 'react';
import { Cloud, Copy, Link2, RefreshCw, Share2, Unplug } from 'lucide-react';
import InfoCard from '../components/InfoCard.jsx';
import { createSyncInviteUrl, formatSyncCode } from '../hooks/useTripSync.js';

const fields = [
  ['tripName', '旅行名稱'],
  ['dates', '日期'],
  ['hotelName', '住宿名稱'],
  ['hotelAddress', '住宿地址'],
  ['hotelMapUrl', '住宿 Naver Map 連結'],
  ['outboundFlight', '去程航班'],
  ['returnFlight', '回程航班'],
  ['arrivalAirport', '抵達機場'],
  ['departureAirport', '離開機場']
];

const statusLabels = {
  'not-configured': '尚未設定 Supabase',
  disconnected: '尚未連線',
  connecting: '連線中',
  saving: '同步中',
  synced: '已同步',
  error: '同步異常'
};

export default function SettingsPage({ trip, setTrip, sync }) {
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [inviteStatus, setInviteStatus] = useState('');
  const busy = ['connecting', 'saving'].includes(sync.status);

  async function handleCreate() {
    try {
      await sync.createWorkspace();
    } catch {
      // The hook exposes the error next to the control that caused it.
    }
  }

  async function handleJoin(event) {
    event.preventDefault();
    try {
      await sync.joinWorkspace(joinCode);
      setJoinCode('');
    } catch {
      // The hook exposes the error next to the control that caused it.
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(formatSyncCode(sync.syncCode));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  async function handleShareInvite() {
    const url = createSyncInviteUrl(sync.syncCode);
    if (!url) return;

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Seoul Trip 2026 家庭同步',
          text: '開啟連結，加入同一份首爾旅遊清單。',
          url
        });
        setInviteStatus('已開啟分享選單');
      } else {
        await navigator.clipboard.writeText(url);
        setInviteStatus('已複製手機同步連結');
      }
      window.setTimeout(() => setInviteStatus(''), 2200);
    } catch (shareError) {
      if (shareError?.name !== 'AbortError') setInviteStatus('無法分享，請改用上方同步碼');
    }
  }

  return (
    <div className="stack">
      <InfoCard title="家庭同步" className="sync-card">
        <p className="soft-text sync-intro">電腦先建立同步空間，現有資料會立即上傳；手機再輸入同一組同步碼即可共用資料。</p>

        <div className="sync-status" data-status={sync.status}>
          <span className="sync-status-dot" aria-hidden="true" />
          <div className="sync-status-copy">
            <strong>{statusLabels[sync.status] || '等待連線'}</strong>
            <small>
              {sync.lastSyncedAt
                ? `最後同步 ${formatSyncTime(sync.lastSyncedAt)}`
                : '資料仍會保存在這台裝置的離線快取'}
            </small>
          </div>
          <Cloud size={20} aria-hidden="true" />
        </div>

        {!sync.configured && (
          <p className="sync-error">請先在環境變數設定 Supabase Project URL 與 Publishable Key。</p>
        )}

        {sync.configured && !sync.syncCode && (
          <div className="sync-setup">
            <button type="button" className="wide-button" onClick={handleCreate} disabled={busy}>
              <Cloud size={18} />
              {sync.status === 'connecting' ? '正在建立' : '建立家庭同步'}
            </button>
            <div className="sync-divider"><span>手機或其他裝置</span></div>
            <form className="sync-join-grid" onSubmit={handleJoin}>
              <label>
                家庭同步碼
                <input
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value)}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  autoComplete="off"
                  spellCheck="false"
                />
              </label>
              <button type="submit" className="wide-button secondary" disabled={busy || !joinCode.trim()}>
                <Link2 size={18} />
                加入同步
              </button>
            </form>
          </div>
        )}

        {sync.configured && sync.syncCode && (
          <div className="sync-connected">
            <label className="sync-code-field">
              家庭同步碼
              <div className="sync-code-row">
                <input value={formatSyncCode(sync.syncCode)} readOnly aria-label="家庭同步碼" />
                <button type="button" className="icon-button" onClick={handleCopy} title="複製家庭同步碼">
                  <Copy size={18} />
                </button>
              </div>
            </label>
            {copied && <p className="sync-confirmation">已複製同步碼</p>}
            <button type="button" className="wide-button sync-share-button" onClick={handleShareInvite} disabled={busy}>
              <Share2 size={18} />
              分享同步連結
            </button>
            {inviteStatus && <p className="sync-confirmation" role="status">{inviteStatus}</p>}
            <div className="sync-actions">
              <button type="button" className="wide-button secondary" onClick={() => sync.syncNow().catch(() => {})} disabled={busy}>
                <RefreshCw size={18} />
                立即同步
              </button>
              <button type="button" className="wide-button danger" onClick={sync.disconnect} disabled={busy}>
                <Unplug size={18} />
                停止此裝置同步
              </button>
            </div>
          </div>
        )}

        {sync.error && <p className="sync-error" role="alert">{sync.error}</p>}
      </InfoCard>

      <InfoCard title="旅行基本資料">
        <div className="form-grid single">
          {fields.map(([key, label]) => (
            <label key={key}>
              {label}
              <input value={trip[key] || ''} onChange={(e) => setTrip((current) => ({ ...current, [key]: e.target.value }))} />
            </label>
          ))}
        </div>
        <p className="soft-text">修改後會先保存在此裝置；連上家庭同步後，也會自動更新到其他裝置。</p>
      </InfoCard>
    </div>
  );
}

function formatSyncTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '剛剛';
  return new Intl.DateTimeFormat('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}
