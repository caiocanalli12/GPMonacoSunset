/**
 * ============================================================================
 * PASTA "CASO Z-FIGHTING" NO PAINEL LIL-GUI — ENTREGA M4 (FASE B - ITEM 6)
 * ============================================================================
 * Demonstra ao vivo o problema clássico de precisão do Depth Buffer (Z-Buffer):
 * - Quando "Modo Coplanar (Com Bug)" está ATIVO, as faixas pintadas da pista são
 *   posicionadas exatamente na mesma altura Y do asfalto (Y = 0.050 m) e com
 *   `polygonOffset = false`. A competição de profundidade gera cintilação severa
 *   (z-fighting), agravada se diminuirmos `camera.near` ou aumentarmos `camera.far`.
 * - Quando "Modo Coplanar (Com Bug)" está DESLIGADO (versão corrigida), aplica-se
 *   deslocamento físico em Y (+2,5 cm -> Y = 0.075 m) aliado a `polygonOffset`
 *   no material, eliminando completamente o artefato.
 *
 * @param {{
 *   gui: import('lil-gui').GUI,
 *   setZFightingProblemActive: (bugActive: boolean) => void,
 *   diagnostics: ReturnType<import('./diagnostics.js').createDiagnostics>
 * }} params
 */
export function createZFightingPanel({
  gui,
  setZFightingProblemActive,
  diagnostics,
}) {
  const { ctrlNear, ctrlFar } = diagnostics.controls;

  const state = {
    coplanarBugMode: false, // false = Corrigido (padrão); true = Linha coplanar COM z-fighting
    cameraNear: ctrlNear.getValue(),
    cameraFar: ctrlFar.getValue(),
    presetReproduceBug: () => {
      ctrlBugMode.setValue(true);
      ctrlNearLocal.setValue(0.1);
      ctrlFarLocal.setValue(420.0);
    },
    presetApplyFix: () => {
      ctrlBugMode.setValue(false);
      ctrlNearLocal.setValue(0.5);
      ctrlFarLocal.setValue(260.0);
    },
  };

  const zFolder = gui.addFolder('Caso z-fighting');

  const ctrlBugMode = zFolder
    .add(state, 'coplanarBugMode')
    .name('Linha Coplanar (Com Bug)')
    .onChange((bugActive) => {
      setZFightingProblemActive(bugActive);
    });

  const ctrlNearLocal = zFolder
    .add(state, 'cameraNear', 0.1, 45.0, 0.1)
    .name('Câmera Near (m)')
    .onChange((val) => {
      ctrlNear.setValue(val);
    });

  const ctrlFarLocal = zFolder
    .add(state, 'cameraFar', 35.0, 450.0, 1.0)
    .name('Câmera Far (m)')
    .onChange((val) => {
      ctrlFar.setValue(val);
    });

  zFolder.add(state, 'presetReproduceBug').name('⚠ 1. Reproduzir Z-Fighting');
  zFolder.add(state, 'presetApplyFix').name('✓ 2. Aplicar Correção');

  zFolder.open();

  return {
    zFolder,
  };
}
