import { useEffect, useRef, useState } from 'react';
import {
  CircleCheck,
  Cloud,
  Copy,
  Download,
  Link2,
  RefreshCw,
  RotateCcw,
  Save,
  Share2,
  Unplug,
  Upload,
  X
} from 'lucide-react';
import InfoCard from '../components/InfoCard.jsx';
import { backupSummary, parseBackup, serializeBackup } from '../utils/backup.js';
import { createSyncInviteUrl, formatSyncCode } from '../hooks/useTripSync.js';
import { deriveTripDuration } from '../utils/tripTime.js';

const basicFields = [
  ['tripName', '旅行名稱'],
  ['dates', '日期']
];

const hotelFields = [
  ['hotelName', '住宿名稱'],
  ['hotelAddress', '住宿地址'],
  ['hotelMapUrl', '住宿 Naver Map 連結']
];

const flightFields = [
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

export default function SettingsPage({
  trip,
  setTrip,
  itinerary,
  setItinerary,
  wishlist,
  setWishlist,
  sync
}) {
  const [draft, setDraft] = useState(trip);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [inviteStatus, setInviteStatus] = useState('');
  const [backupStatus, setBackupStatus] = useState('');
  const [restorePreview, setRestorePreview] = useState(null);
  const importInputRef = useRef(null);
  const busy = ['connecting', 'saving'].includes(sync.status);

  useEffect(() => {
    if (!dirty) setDraft(trip);
  }, [dirty, trip]);

  useEffect(() => {
    if (!saved) return undefined;
    const timer = window.setTimeout(() => setSaved(false), 2200);
    return () => window.clearTimeout(timer);
  }, [saved]);

  function updateDraft(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setSaved(false);
  }

  function saveTrip(event) {
    event.preventDefault();
    const next = {
      ...draft,
      nights: deriveTripDuration(draft.dates, draft.nights || trip.nights)
    };
    setTrip(next);
    setDraft(next);
    setDirty(false);
    setSaved(true);
  }

  function cancelTripChanges() {
    setDraft(trip);
    setDirty(false);
    setSaved(false);
  }

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
          title: `${trip.tripName} 家庭同步`,
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

  function exportBackup() {
    const contents = serializeBackup({ trip, itinerary, wishlist });
    const blob = new Blob([contents], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `seoul-trip-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setBackupStatus('備份檔已下載');
    window.setTimeout(() => setBackupStatus(''), 2200);
  }

  async function handleImportFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 5_000_000) {
      setBackupStatus('備份檔超過 5 MB，請確認檔案是否正確');
      return;
    }

    try {
      const parsed = parseBackup(await file.text());
      setRestorePreview({ data: parsed, summary: backupSummary(parsed) });
      setBackupStatus('');
    } catch (error) {
      setBackupStatus(error instanceof Error ? error.message : '無法讀取備份檔');
    }
  }

  function confirmRestore() {
    if (!restorePreview) return;
    const restored = restorePreview.data;
    setTrip(restored.trip);
    setItinerary(restored.itinerary);
    setWishlist(restored.wishlist);
    setDraft(restored.trip);
    setDirty(false);
    setRestorePreview(null);
    setBackupStatus('備份已還原並儲存');
    window.setTimeout(() => setBackupStatus(''), 2600);
  }

  return (
    <div className="stack settings-page">
      <form className="settings-form" onSubmit={saveTrip}>
        <InfoCard title="旅行基本資料">
          <div className="form-grid single">
            {basicFields.map(([key, label]) => (
              <label key={key}>
                {label}
                <input value={draft[key] || ''} onChange={(event) => updateDraft(key, event.target.value)} />
              </label>
            ))}
          </div>
          <p className="derived-value">行程長度會依日期自動計算：<strong>{deriveTripDuration(draft.dates, draft.nights)}</strong></p>
        </InfoCard>

        <InfoCard title="住宿資訊">
          <div className="form-grid single">
            {hotelFields.map(([key, label]) => (
              <label key={key}>
                {label}
                <input value={draft[key] || ''} onChange={(event) => updateDraft(key, event.target.value)} />
              </label>
            ))}
          </div>
        </InfoCard>

        <InfoCard title="航班資訊">
          <div className="form-grid single">
            {flightFields.map(([key, label]) => (
              <label key={key}>
                {label}
                <textarea value={draft[key] || ''} onChange={(event) => updateDraft(key, event.target.value)} />
              </label>
            ))}
          </div>
        </InfoCard>

        <div className={`settings-save-bar ${dirty ? 'dirty' : ''}`}>
          <div>
            {saved ? (
              <span className="settings-saved" role="status"><CircleCheck size={19} /> 已儲存旅行資料</span>
            ) : (
              <span>{dirty ? '有尚未儲存的修改' : '旅行資料沒有未儲存修改'}</span>
            )}
          </div>
          <div>
            <button type="button" className="wide-button secondary" onClick={cancelTripChanges} disabled={!dirty}>
              <RotateCcw size={17} />
              取消
            </button>
            <button type="submit" className="wide-button" disabled={!dirty}>
              <Save size={17} />
              儲存
            </button>
          </div>
        </div>
      </form>

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
            {copied && <p className="sync-confirmation"><CircleCheck size={16} /> 已複製同步碼</p>}
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

      <InfoCard title="資料備份">
        <p className="soft-text">備份包含旅行設定、行程與願望清單。匯入前會先顯示內容摘要，不會直接覆蓋。</p>
        <div className="backup-actions">
          <button type="button" className="wide-button secondary" onClick={exportBackup}>
            <Download size={18} />
            匯出備份
          </button>
          <button type="button" className="wide-button secondary" onClick={() => importInputRef.current?.click()}>
            <Upload size={18} />
            匯入備份
          </button>
          <input
            ref={importInputRef}
            className="visually-hidden"
            type="file"
            accept="application/json,.json"
            onChange={handleImportFile}
          />
        </div>
        {backupStatus && (
          <p className={backupStatus.includes('已') ? 'sync-confirmation' : 'sync-error'} role="status">
            {backupStatus.includes('已') && <CircleCheck size={16} />}
            {backupStatus}
          </p>
        )}
      </InfoCard>

      {restorePreview && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setRestorePreview(null)}>
          <section className="bulk-dialog restore-dialog" role="dialog" aria-modal="true" aria-labelledby="restore-title">
            <div className="dialog-head">
              <div>
                <p className="eyebrow">Restore preview</p>
                <h2 id="restore-title">確認還原備份</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setRestorePreview(null)} aria-label="關閉還原預覽">
                <X size={20} />
              </button>
            </div>
            <dl className="restore-summary">
              <div><dt>旅行名稱</dt><dd>{restorePreview.summary.tripName}</dd></div>
              <div><dt>日期</dt><dd>{restorePreview.summary.dates}</dd></div>
              <div><dt>行程</dt><dd>{restorePreview.summary.days} 天、{restorePreview.summary.stops} 個地點</dd></div>
              <div><dt>願望清單</dt><dd>{restorePreview.summary.wishlist} 個地點</dd></div>
            </dl>
            <p className="restore-warning">確認後會以這份備份取代目前裝置上的旅行資料，並依現有同步設定更新。</p>
            <div className="dialog-actions">
              <button type="button" className="wide-button secondary" onClick={() => setRestorePreview(null)}>取消</button>
              <button type="button" className="wide-button" onClick={confirmRestore}><Upload size={18} /> 確認還原</button>
            </div>
          </section>
        </div>
      )}
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
