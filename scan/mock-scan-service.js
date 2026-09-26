/** Local form adapter. No OCR, inference, or network requests. */
export class MockScanService {
  static createResult(form, images, quality = { score: null, issues: [] }) {
    const result = {
      status: 'needs-review', sourceImages: structuredClone(images), quality,
      candidateMatches: [],
      parsedFields: {
        player: form.playerName.trim(), team: form.team.trim(), teamAbbr: form.teamAbbr.trim(),
        jerseyNumber: form.jerseyNumber.trim(), position: form.position.trim(),
        brand: form.brand, set: form.brand, year: form.year, cardNumber: form.cardNumber.trim(),
        parallel: form.parallel, serialNumber: form.serialNumber.trim()
      }
    };
    if (images.label && form.gradeAgency) result.reportedGrade = {
      agency: form.gradeAgency, grade: form.gradeScore.trim(), certNumber: form.certNumber.trim(), ocrConfidence: null
    };
    return result;
  }
}
