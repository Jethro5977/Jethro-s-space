import { createCardRenderer } from '@card-builder/renderer';
import { setState, normalizeState, getData } from '../src/state.js';
import { drawCardToCanvas } from '../src/export-canvas.js';
import { saveToLibrary } from '../src/library.js';
import { showToast } from '../src/utils.js';
import { NBA_PLAYERS_DB } from '../src/constants.js';
import { CardScanAdapter, checkPhotoQuality } from './card-scan-adapter.js';
import { MockScanService } from './mock-scan-service.js';

const $ = (id) => document.getElementById(id);
const photos = {};
const revisions = { front: 0, back: 0, label: 0 };
const form = $('identityForm');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
let renderer = null, bridge = null, cardState = null, busy = false;
let registry = NBA_PLAYERS_DB.map(p => ({ name: p.name, displayName: p.name, team: p.abbr, teamName: p.team, jerseyNumber: p.number, positionCode: p.position }));

function showStep(step) {
  if (step !== 4) { renderer?.destroy(); renderer = null; }
  document.querySelectorAll('[data-step]').forEach(el => { el.hidden = Number(el.dataset.step) !== step; });
  document.querySelectorAll('.scan-steps li').forEach((el, i) => {
    if (i + 1 === step) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current');
  });
  $(`step${step}-title`).focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: motion.matches ? 'instant' : 'smooth' });
}

function syncUploadState() {
  $('toQuality').disabled = !photos.front || Object.values(revisions).some(v => v < 0);
  $('gradeFields').hidden = !photos.label;
  $('gradeFields').disabled = !photos.label;
}

for (const [side, title] of [['front', '正面照片 · 必填'], ['back', '背面照片 · 选填'], ['label', '评级标签照片 · 选填']]) {
  const box = document.createElement('div');
  box.className = 'scan-upload';
  box.innerHTML = `<label for="upload-${side}"><span class="scan-camera">＋</span><strong>${title}</strong><small>拖拽照片到此处，或点击上传</small><img hidden alt="${title}预览"></label><input type="file" id="upload-${side}" accept="image/jpeg,image/png,image/webp" aria-label="${title}"><small class="scan-file-info"></small><button type="button" class="btn-action btn-secondary" hidden>移除照片</button>`;
  $('uploadGrid').append(box);
  const input = box.querySelector('input'), preview = box.querySelector('img'), remove = box.querySelector('button');
  const info = box.querySelector('.scan-file-info');
  async function upload(file) {
    if (!file) return;
    const revision = Math.abs(revisions[side]) + 1;
    revisions[side] = -revision;
    syncUploadState();
    let objectUrl;
    try {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('请选择 JPG、PNG 或 WEBP 图片');
      objectUrl = URL.createObjectURL(file);
      const image = new Image(); image.src = objectUrl; await image.decode();
      // Persist a bounded local copy: blob URLs cannot survive navigation or reload.
      const scale = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
      if (Math.abs(revisions[side]) !== revision) { URL.revokeObjectURL(objectUrl); return; }
      if (photos[side]) URL.revokeObjectURL(photos[side].objectUrl);
      photos[side] = { objectUrl, dataUrl, width: image.naturalWidth, height: image.naturalHeight, size: file.size };
      preview.src = objectUrl; preview.hidden = false; remove.hidden = false;
      box.querySelector('.scan-camera').hidden = true;
      info.textContent = `${file.name} · ${image.naturalWidth} × ${image.naturalHeight} · ${(file.size / 1024 / 1024).toFixed(1)} MB`;
    } catch (error) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      showToast(error.message || '无法读取图片，请重新选择', 'error');
    } finally {
      if (Math.abs(revisions[side]) === revision) revisions[side] = revision;
      input.value = ''; syncUploadState();
    }
  }
  input.addEventListener('change', () => upload(input.files[0]));
  box.addEventListener('dragover', e => { e.preventDefault(); box.classList.add('dragging'); });
  box.addEventListener('dragleave', () => box.classList.remove('dragging'));
  box.addEventListener('drop', e => { e.preventDefault(); box.classList.remove('dragging'); upload(e.dataTransfer.files[0]); });
  remove.addEventListener('click', () => {
    revisions[side] = Math.abs(revisions[side]) + 1;
    if (photos[side]) URL.revokeObjectURL(photos[side].objectUrl);
    delete photos[side]; preview.removeAttribute('src'); preview.hidden = true; remove.hidden = true;
    box.querySelector('.scan-camera').hidden = false; info.textContent = ''; syncUploadState();
  });
}

const qualityCopy = {
  'low-resolution': '照片分辨率较低，可能影响卡牌细节',
  'large-file': '文件较大，建议压缩后重新上传',
  'aspect-ratio': '照片比例与标准卡牌不符，请检查裁剪'
};
$('toQuality').addEventListener('click', () => {
  $('qualityImage').src = photos.front.objectUrl;
  const quality = checkPhotoQuality(photos.front);
  $('qualityList').replaceChildren(...(quality.issues.length ? quality.issues : ['ok']).map(issue => {
    const li = document.createElement('li'); li.className = issue === 'ok' ? '' : 'warning';
    li.textContent = issue === 'ok' ? '✓ 照片基础质量良好' : `△ ${qualityCopy[issue]}`; return li;
  }));
  showStep(2);
});
$('toIdentity').addEventListener('click', () => showStep(3));
document.querySelectorAll('[data-back]').forEach(button => button.addEventListener('click', () => { if (!busy) showStep(Number(button.dataset.back)); }));

function populatePlayers() {
  $('players').replaceChildren(...registry.map(player => {
    const option = document.createElement('option'); option.value = player.displayName || player.name; return option;
  }));
}
populatePlayers();
// Static, same-origin reference data only. Uploaded images never leave the browser.
fetch('../data/player-registry.json').then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(data => { registry = Object.values(data); populatePlayers(); }).catch(() => {});
$('scanPlayer').addEventListener('input', () => {
  const name = $('scanPlayer').value.trim().toLowerCase();
  const p = registry.find(p => [p.name, p.displayName, ...(p.aliases || [])].some(n => n?.toLowerCase() === name));
  if (!p) return;
  form.elements.team.value = p.teamName || p.team || '';
  form.elements.teamAbbr.value = p.team || '';
  form.elements.jerseyNumber.value = p.jerseyNumber || '';
  form.elements.position.value = p.positionCode || p.position || '';
});
for (const [select, custom] of [['brand', 'customBrand'], ['parallel', 'customParallel'], ['gradeAgency', 'customAgency']]) {
  form.elements[select].addEventListener('change', () => {
    const other = form.elements[select].value === 'other'; form.elements[custom].hidden = !other; form.elements[custom].required = other;
  });
}

async function renderSide(side, width, height) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  if (side === 'back' && cardState._scanResult.sourceImages.back?.dataUrl) {
    const image = new Image(); image.src = cardState._scanResult.sourceImages.back.dataUrl; await image.decode();
    canvas.getContext('2d').drawImage(image, 0, 0, width, height);
  } else await drawCardToCanvas(canvas.getContext('2d'), getData(), side, 0, 0, width, height);
  return canvas;
}

function createPreview() {
  renderer?.destroy();
  const view = { rotX: 0, rotY: 0, viewScale: 1, motionOn: false };
  bridge = {
    getState: () => ({ ...getData(), motionOn: false, view: { ...view } }),
    setView: update => Object.assign(view, update, { motionOn: false }),
    flip: () => { view.rotY += 180; },
    renderCardCanvas: renderSide
  };
  renderer = createCardRenderer({ host: $('scanThreeHost'), canvas: $('scanThreeCanvas'), status: $('threeStatus'), bridge, autoListen: false });
}

form.addEventListener('submit', async event => {
  event.preventDefault(); if (busy || !photos.front) return;
  if (!$('scanPlayer').value.trim()) { $('scanPlayer').setCustomValidity('请填写球员姓名'); $('scanPlayer').reportValidity(); return; }
  busy = true; $('generateCard').disabled = true;
  try {
    const fields = Object.fromEntries(new FormData(form));
    for (const [key, custom] of [['brand', 'customBrand'], ['parallel', 'customParallel'], ['gradeAgency', 'customAgency']]) if (fields[key] === 'other') fields[key] = fields[custom].trim();
    const images = Object.fromEntries(Object.entries(photos).map(([side, photo]) => [side, { dataUrl: photo.dataUrl, width: photo.width, height: photo.height }]));
    const ratio = photos.front.width / photos.front.height, target = 5 / 7;
    const crop = ratio > target ? { x: (1 - target / ratio) / 2, y: 0, width: target / ratio, height: 1 } : { x: 0, y: (1 - ratio / target) / 2, width: 1, height: ratio / target };
    images.front.crop = crop;
    const result = MockScanService.createResult(fields, images, checkPhotoQuality(photos.front));
    cardState = CardScanAdapter.toCardState(result); setState(normalizeState(cardState));
    const card = await renderSide('front', 600, 840);
    $('cardPreview').getContext('2d').drawImage(card, 0, 0);
    $('originalImage').src = photos.front.objectUrl;
    Object.assign($('cropGuide').style, { left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.width * 100}%`, height: `${crop.height * 100}%` });
    $('scanSummary').textContent = `${fields.playerName} · ${fields.brand} · ${fields.parallel} · ${fields.year}${result.reportedGrade ? ` · 标签手动转录：${result.reportedGrade.agency} ${result.reportedGrade.grade}` : ''}。资料需要核对；MAGNETIC 展示卡壳。`;
    $('savedMessage').textContent = ''; $('saveCard').disabled = false;
    showStep(4); createPreview();
  } catch (error) { showToast(`预览生成失败：${error.message}`, 'error'); }
  finally { busy = false; $('generateCard').disabled = false; }
});
$('scanPlayer').addEventListener('input', () => $('scanPlayer').setCustomValidity(''));
$('flipScan').addEventListener('click', () => { bridge?.flip(); renderer?.setView(bridge.getState().view); });
$('resetScanView').addEventListener('click', () => { bridge?.setView({ rotX: 0, rotY: 0, viewScale: 1 }); renderer?.setView(bridge.getState().view); });
$('saveCard').addEventListener('click', async () => {
  if (busy || !cardState) return;
  busy = true; $('saveCard').disabled = true;
  try {
    const saved = await saveToLibrary();
    if (saved) $('savedMessage').textContent = '已保存到本机个人库。返回 Card Builder → 卡牌库，即可加载并继续编辑。';
    else $('saveCard').disabled = false;
  } catch (error) { showToast(`保存失败：${error.message}`, 'error'); $('saveCard').disabled = false; }
  finally { busy = false; }
});
$('editCard').addEventListener('click', () => {
  if (busy || !cardState) return;
  try { sessionStorage.setItem('cardScanImport', JSON.stringify(cardState)); window.location.href = '../'; }
  catch { showToast('本机临时存储空间不足，请缩小照片后重试，或先保存到收藏', 'error'); }
});
window.addEventListener('pagehide', () => { renderer?.destroy(); renderer = null; });
window.addEventListener('pageshow', e => { if (e.persisted && cardState && !document.querySelector('[data-step="4"]').hidden) createPreview(); });
