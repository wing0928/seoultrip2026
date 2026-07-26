const MAX_IMAGES = 8;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const SOCIAL_NOISE = /^(?:\d{1,2}:\d{2}|讚|留言|分享|收藏|追蹤|追蹤中|查看全部|翻譯|更多|回覆|likes?|comments?|share|follow|following|view all|reels?|threads?|instagram)$/i;
const LABELLED_NAME = /(?:店名|店家|商店|品牌|門市|地點)\s*[:：]\s*(.+)$/i;

export async function extractPlacesFromScreenshots(files, { onProgress } = {}) {
  const images = Array.from(files || []).slice(0, MAX_IMAGES);
  if (!images.length) return [];
  const invalid = images.find((file) => !file.type.startsWith('image/') || file.size > MAX_IMAGE_BYTES);
  if (invalid) throw new Error('請選擇 12 MB 以下的 JPG、PNG 或 WebP 圖片');

  const { createWorker, PSM } = await import('tesseract.js');
  let currentImage = 0;
  const worker = await createWorker(['chi_tra', 'kor', 'eng'], 1, {
    logger(message) {
      const fraction = Number(message.progress || 0);
      onProgress?.({
        current: currentImage + 1,
        total: images.length,
        progress: Math.round(fraction * 100),
        status: message.status || '辨識中'
      });
    }
  });

  try {
    await worker.setParameters({
      preserve_interword_spaces: '1',
      tessedit_pageseg_mode: PSM.AUTO
    });
    const results = [];
    for (currentImage = 0; currentImage < images.length; currentImage += 1) {
      const file = images[currentImage];
      const { data } = await worker.recognize(file);
      const parsed = parseScreenshotText(data?.text || '', file.name);
      if (parsed) results.push(parsed);
    }
    return results;
  } finally {
    await worker.terminate();
  }
}

export function parseScreenshotText(text, filename = '') {
  const lines = String(text)
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(cleanLine)
    .filter(Boolean);
  if (!lines.length) return null;

  const labelled = lines
    .map((line) => line.match(LABELLED_NAME)?.[1]?.trim())
    .find(Boolean);
  const candidate = labelled || [...lines]
    .map((line, index) => ({ line, index, score: scoreNameLine(line, index) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)[0]?.line;
  if (!candidate) return null;

  const name = cleanCandidateName(candidate);
  if (!name) return null;
  const description = lines
    .filter((line) => line !== candidate && !isNoise(line))
    .filter((line) => line.length >= 6 && line.length <= 140)
    .slice(0, 3)
    .join('；')
    .slice(0, 360);

  return {
    name,
    description: description || `收藏貼文截圖：${filename || '未命名圖片'}`,
    rawText: lines.join('\n')
  };
}

export function screenshotPlacesToBulkText(items) {
  return items.map((item, index) => (
    `${index + 1}. ${item.name}\n${item.description}`
  )).join('\n\n\n');
}

function scoreNameLine(line, index) {
  if (isNoise(line)) return -100;
  const compactLength = line.replace(/\s/g, '').length;
  if (compactLength < 2 || compactLength > 45) return -60;

  let score = Math.max(0, 30 - index * 2);
  if (/[\u3400-\u9fff]/.test(line)) score += 35;
  if (/[가-힣]/.test(line)) score += 24;
  if (/[A-Za-z]{2,}/.test(line)) score += 8;
  if (compactLength <= 24) score += 16;
  if (/[。！？!?；;]/.test(line)) score -= 25;
  if (/\d{3,}|[#@]|https?:\/\//i.test(line)) score -= 35;
  if (/推薦|必買|穿搭|首爾|韓國|地址|價格|營業|交通|心得|分享/.test(line)) score -= 18;
  return score;
}

function cleanCandidateName(value) {
  return String(value)
    .replace(LABELLED_NAME, '$1')
    .replace(/^[\s#@|｜:：·•\-–]+/, '')
    .replace(/[\s#|｜:：·•\-–]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanLine(line) {
  return String(line)
    .replace(/[|｜]{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isNoise(line) {
  return SOCIAL_NOISE.test(line) ||
    /^https?:\/\//i.test(line) ||
    /^[@#][\w.]+$/i.test(line) ||
    /^[\d\s,.]+$/.test(line);
}
