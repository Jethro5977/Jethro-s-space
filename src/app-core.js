// Card Builder — Late-binding function registry
// Solves circular dependencies between modules.
// Modules register their functions here; other modules call through this object.

export const app = {
  // Registered by render.js
  render: null,
  updateInterface: null,
  hydrateInputs: null,
  // Registered by effects.js
  applyEffect: null,
  clearEffectLayers: null,
  // Registered by interaction.js
  applyRotation: null,
  // Registered by signatures.js
  syncSignatureModeUI: null,
  syncSignaturePadFromState: null,
  // Registered by foil.js
  syncFoilMaskPadFromState: null,
  // Registered by library.js
  loadLibrary: null,
  saveLibraryResilient: null,
  updateLibraryDrawer: null,
  updatePreviewNavigationUI: null,
  updateAchievementsUI: null,
  navigateLibraryCard: null,
  updateBackgroundMosaic: null,
  escapeHtml: null,
  openPackExperience: null,
  closePackExperience: null,
};
