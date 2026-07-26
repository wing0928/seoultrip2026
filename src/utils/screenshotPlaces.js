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
      results.push(...parseScreenshotPlaces(data?.text || '', file.name));
    }
    return results;
  } finally {
    await worker.terminate();
  }
}

export function parseScreenshotText(text, filename = '') {
  return parseScreenshotPlaces(text, filename)[0] || null;
}

export function parseScreenshotPlaces(text, filename = '') {
  const lines = String(text)
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(cleanLine)
    .filter(Boolean);
  if (!lines.length) return [];

  const groups = splitScreenshotEntries(lines);
  if (groups.length) {
    const firstHeaderIndex = lines.indexOf(groups[0][0]);
    const sharedContext = lines.slice(0, firstHeaderIndex).filter((line) => !isNoise(line)).slice(-1);
    return groups.map((group) => parseStructuredEntry(group, filename, sharedContext)).filter(Boolean);
  }

  const instagramEntries = parseInstagramEntries(lines, filename);
  if (instagramEntries.length) return instagramEntries;

  const labelled = lines
    .map((line) => line.match(LABELLED_NAME)?.[1]?.trim())
    .find(Boolean);
  const candidate = labelled || [...lines]
    .map((line, index) => ({ line, index, score: scoreNameLine(line, index) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)[0]?.line;
  if (!candidate) return [];

  const name = cleanCandidateName(candidate);
  if (!name) return [];
  const description = lines
    .filter((line) => line !== candidate && !isNoise(line))
    .filter((line) => line.length >= 6 && line.length <= 140)
    .slice(0, 3)
    .join('；')
    .slice(0, 360);

  return [{
    name,
    description: description || `收藏貼文截圖：${filename || '未命名圖片'}`,
    rawText: lines.join('\n')
  }];
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

function splitScreenshotEntries(lines) {
  const headers = [];
  lines.forEach((line, index) => {
    const nextLine = lines[index + 1] || '';
    if (isNumberedEmojiLine(line) || (isAddressLine(nextLine) && isLikelyHeader(line))) {
      headers.push(index);
    }
  });
  const uniqueHeaders = [...new Set(headers)].sort((left, right) => left - right);
  if (!uniqueHeaders.length) return [];

  return uniqueHeaders.map((start, index) => (
    lines.slice(start, uniqueHeaders[index + 1] ?? lines.length)
  )).filter((group) => group.length);
}

function parseStructuredEntry(lines, filename, sharedContext = []) {
  const rawHeader = lines[0] || '';
  const name = cleanStructuredName(rawHeader);
  if (!name) return null;

  const description = lines
    .slice(1)
    .concat(sharedContext)
    .map(cleanDetailLine)
    .filter((line) => line && !isNoise(line))
    .slice(0, 4)
    .join('；')
    .slice(0, 360);

  return {
    name,
    description: description || `收藏貼文截圖：${filename || '未命名圖片'}`,
    rawText: lines.join('\n')
  };
}

function cleanStructuredName(value) {
  let name = String(value)
    .replace(NUMBERED_EMOJI_PREFIX, '')
    .replace(/^.{0,6}[*#]\s*/u, '')
    .trim();
  const alias = name.match(/\(([^)]+)\)\s*$/)?.[1]?.trim() || '';
  const base = name.replace(/\([^)]+\)\s*$/, '').trim();
  if (alias && !/[A-Za-z\u3400-\u9fff가-힣]/.test(base)) name = alias;
  else if (alias && /^\d+$/.test(alias)) name = base;
  return cleanCandidateName(name);
}

function cleanDetailLine(value) {
  return String(value)
    .replace(/^[:：]\s*/, '')
    .replace(/^(?:📍|☎️?|[후투])\s*(?=서울|Seoul|\d{2,4}-)/i, '')
    .replace(/^f(?:i|l){1,3}\s*(?=\d{2,4}-)/i, '')
    .trim();
}

const NUMBERED_EMOJI_PREFIX = /^\s*(?:(?:[0-9]\uFE0F?\u20E3)|🔟|[①②③④⑤⑥⑦⑧⑨⑩❶❷❸❹❺❻❼❽❾❿]|\d+[.)、．])\s*/u;

function isNumberedEmojiLine(line) {
  return NUMBERED_EMOJI_PREFIX.test(line);
}

function isAddressLine(line) {
  return /(?:서울|Seoul).*(?:\d|로|길|구|동)/i.test(line);
}

function isLikelyHeader(line) {
  if (!line || isNoise(line) || isAddressLine(line)) return false;
  if (line.length > 80 || /https?:\/\//i.test(line)) return false;
  return /[A-Za-z\u3400-\u9fff가-힣]/.test(line);
}

function parseInstagramEntries(lines, filename) {
  const candidates = [];
  lines.forEach((line, lineIndex) => {
    extractInstagramHandles(line).forEach((handle) => {
      candidates.push({ handle, lineIndex });
    });
  });
  const uniqueCandidates = candidates.filter((candidate, index) => (
    candidates.findIndex((item) => item.handle === candidate.handle) === index
  ));
  if (!uniqueCandidates.length) return [];
  if (uniqueCandidates.length === 1 && !hasPlaceContext(lines, uniqueCandidates[0].lineIndex)) return [];

  const tagLineIndexes = new Set(uniqueCandidates.map((candidate) => candidate.lineIndex));
  return uniqueCandidates.map(({ handle, lineIndex }) => {
    const context = instagramContext(lines, lineIndex, tagLineIndexes);
    return {
      name: instagramHandleName(handle),
      instagramHandle: `@${handle}`,
      description: [`Instagram：@${handle}`, ...context].join('；').slice(0, 360) ||
        `收藏貼文截圖：${filename || '未命名圖片'}`,
      rawText: context.join('\n')
    };
  });
}

function extractInstagramHandles(line) {
  const handles = [...String(line).matchAll(/@([a-z0-9][a-z0-9._]{1,29})/gi)]
    .map((match) => trimInstagramHandle(match[1]));
  if (/(?:店|品牌|咖啡|美術館|餐廳|文具|服飾|男女裝|好逛)/.test(line)) {
    for (const match of String(line).matchAll(/\bG([a-z][a-z0-9._]{3,29})\b/g)) {
      handles.push(trimInstagramHandle(match[1]));
    }
  }
  return [...new Set(handles.filter(Boolean))];
}

function trimInstagramHandle(handle) {
  return String(handle).toLowerCase().replace(/[._]+$/g, '');
}

function instagramHandleName(handle) {
  return String(handle)
    .replace(/^shop[._-]+/, '')
    .replace(/(?:[._-]+official|[._-]+seoul[._-]+store|[._-]+store[._-]+seoul|[._-]+kr)$/g, '')
    .replace(/[._]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || handle;
}

function instagramContext(lines, lineIndex, tagLineIndexes) {
  const context = [];
  const previous = lines[lineIndex - 1] || '';
  if (previous && !tagLineIndexes.has(lineIndex - 1) && !isNoise(previous)) context.push(previous);

  const current = stripInstagramHandles(lines[lineIndex] || '');
  if (current && !isNoise(current)) context.push(current);

  for (let index = lineIndex + 1; index < lines.length && context.length < 4; index += 1) {
    if (tagLineIndexes.has(index)) break;
    const line = stripInstagramHandles(lines[index]);
    if (line && !isNoise(line)) context.push(line);
  }
  return [...new Set(context)];
}

function stripInstagramHandles(line) {
  return String(line)
    .replace(/@[a-z0-9][a-z0-9._]{1,29}/gi, ' ')
    .replace(/\bG[a-z][a-z0-9._]{3,29}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasPlaceContext(lines, lineIndex) {
  const nearby = lines.slice(Math.max(0, lineIndex - 2), lineIndex + 3).join(' ');
  return /店|品牌|咖啡|美術館|餐廳|文具|服飾|男女裝|市場|好逛|釜飯|工藝/.test(nearby);
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
