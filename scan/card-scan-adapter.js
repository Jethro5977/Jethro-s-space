import { DEFAULT_STATE, TEAM_PRESETS } from '../src/constants.js';

/**
 * @typedef {{x:number,y:number,width:number,height:number}} CropRect Normalized coordinates.
 * @typedef {{objectUrl?:string,dataUrl?:string,assetId?:string,remoteUrl?:string,crop?:CropRect,width?:number,height?:number}} ScanImage
 * @typedef {Object} CardScanResult
 * @property {'needs-review'|'confirmed'|'failed'} status
 * @property {{front?:ScanImage,back?:ScanImage,label?:ScanImage}} sourceImages
 * @property {{score:number|null,issues:string[]}} quality
 * @property {{id:string,title:string,confidence:number,referenceSource?:string,thumbnailUrl?:string}[]} candidateMatches
 * @property {{player:string,team?:string,teamAbbr?:string,jerseyNumber?:string,position?:string,brand?:string,set?:string,year?:string,cardNumber?:string,parallel?:string,serialNumber?:string}} parsedFields
 * @property {{agency?:string,grade?:string,certNumber?:string,ocrConfidence:number|null}} [reportedGrade]
 * @property {{overall?:number,centering?:number,corners?:number,edges?:number,surface?:number,confidence?:number,disclaimer:string}} [conditionEstimate] Reserved; never generated in Phase A.
 */
const SERIES_MAP = { prizm: 'prism', prism: 'prism', select: 'select', mosaic: 'mosaic', optic: 'optic', heritage: 'heritage', tactical: 'tactical' };
const RARITIES = new Set(['base', 'silver', 'gold', 'neon', 'rwb', 'black']);
export function mapBrandToSeries(brand, set) {
  return SERIES_MAP[String(set || brand || '').trim().toLowerCase()] || 'prism';
}
export function mapParallelToRarity(parallel) {
  const key = String(parallel || '').trim().toLowerCase();
  return key === 'red white blue' ? 'rwb' : RARITIES.has(key) ? key : 'base';
}
export function checkPhotoQuality({ width, height, size }) {
  const issues = [];
  if (Math.min(width, height) < 800) issues.push('low-resolution');
  if (size > 15 * 1024 * 1024) issues.push('large-file');
  if (width / height < 0.6 || width / height > 0.8) issues.push('aspect-ratio');
  return { score: null, issues };
}
export const CardScanAdapter = {
  /** @param {CardScanResult} result */
  toCardState(result) {
    const f = result.parsedFields;
    const entry = Object.entries(TEAM_PRESETS).find(([, p]) => p.abbr === f.teamAbbr || p.name.toLowerCase() === (f.team || '').toLowerCase());
    const preset = entry?.[1];
    return {
      ...structuredClone(DEFAULT_STATE),
      playerName: f.player, playerNumber: f.jerseyNumber || '', playerPosition: f.position || '',
      playerId: '', playerMediaId: '', playerImageCategory: '', playerImageCredit: '', playerImageCapturedAt: '', playerImageTeamAtCapture: '', playerImageLicenseSnapshot: '',
      teamPreset: entry?.[0] || '', teamName: f.team || '', teamAbbr: f.teamAbbr || preset?.abbr || '',
      colorPrimary: preset?.primary || '#252934', colorSecondary: preset?.secondary || '#bda16a',
      style: mapBrandToSeries(f.brand, f.set), rarity: mapParallelToRarity(f.parallel),
      playerImg: result.sourceImages.front?.dataUrl || result.sourceImages.front?.objectUrl || null,
      logoImg: null, signatureData: null, badges: [], effect: 'none', imageMode: 'fullart', slabType: 'magnetic',
      gradeValue: result.reportedGrade?.grade || '—', cardSeason: f.year || '', cardId: f.cardNumber || '', cardNum: f.serialNumber || '',
      playerHeight: '', playerWeight: '', playerHometown: '', playerDraft: '', playerBio: '',
      statGP: '', statPPG: '', statRPG: '', statAPG: '', statFG: '', stat3P: '',
      motionOn: false, rotX: 0, rotY: 0, autoRotY: 0, flipped: false,
      _scanSource: true, _scanResult: structuredClone(result)
    };
  }
};
