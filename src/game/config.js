/**
 * ============================================================================
 * CONFIGURAÇÃO CENTRAL DO JOGO DE DRIFT — ENTREGA M4
 * ============================================================================
 * Todos os parâmetros numéricos de física arcade, detecção de drift, pontuação,
 * multiplicador, pista, câmera, SUPERDRIFT e efeitos ficam neste arquivo para
 * facilitar ajustes em tempo real no painel "Jogo" (lil-gui) e a explicação
 * pela dupla (Caio e Davi) durante a defesa.
 */

export const GAME_CONFIG = {
  // --------------------------------------------------------------------------
  // 1. FÍSICA ARCADE DO CARRO (Unidades no SI: metros, segundos, radianos)
  // --------------------------------------------------------------------------
  maxForwardSpeed: 30.0,        // Velocidade máxima para frente (m/s, ~108 km/h)
  maxReverseSpeed: -11.0,       // Velocidade máxima de ré (m/s)
  forwardAcceleration: 23.0,    // Força/aceleração longitudinal ao acelerar (m/s²)
  brakingDeceleration: 34.0,    // Desaceleração ao frear (S em movimento frontal) (m/s²)
  reverseAcceleration: 15.0,    // Aceleração em marcha à ré (m/s²)
  forwardDrag: 0.42,            // Arrasto longitudinal no asfalto (proporcional a v_frontal)
  coastingBrake: 6.5,           // Freio motor suave ao soltar o acelerador (m/s²)
  offTrackExtraDrag: 2.35,      // Arrasto extra na grama/calçada fora da pista (s⁻¹)

  // Atrito lateral: reduz v_lateral por exp(-grip * dt) a cada frame
  lateralGripNormal: 7.2,       // Grip lateral alto em condução normal (carro adere ao asfalto)
  lateralGripHandbrake: 1.15,   // Grip lateral muito baixo ao segurar Espaço (freio de mão)
  lateralGripFlick: 2.05,       // Grip lateral reduzido ao esterçar tudo em alta velocidade ("flick")
  flickSpeedThreshold: 15.5,    // Velocidade mínima (m/s) para iniciar drift por flick sem freio de mão
  handbrakeForwardDrag: 3.2,    // Leve perda de velocidade frontal enquanto puxa o freio de mão
  handbrakeSlipImpulse: 3.4,    // Impulso lateral (m/s²) ao puxar freio de mão + esterçar para iniciar a rabada

  // Direção (Esterço)
  turnSpeedMaxRad: 2.25,        // Velocidade angular máxima de direção (rad/s)
  driftTurnBoost: 1.18,         // Ganho leve de controle angular durante o drift para manter a curva
  minSteerSpeed: 1.2,           // Abaixo desta velocidade (m/s) o volante trava (carro parado não gira)
  steerFullSpeed: 8.5,          // Velocidade (m/s) na qual o esterço atinge 100% da resposta

  // Limites invisíveis do mapa (impede cair na água ou sair dos quarteirões)
  mapBounds: {
    minX: -21.5,
    maxX: 90.0,
    minZ: -120.0,
    maxZ: 120.0,
  },

  // --------------------------------------------------------------------------
  // 2. DETECÇÃO DE DRIFT E HISTERESE
  // --------------------------------------------------------------------------
  minDriftSpeed: 7.5,           // Velocidade escalar mínima (m/s) para validar drift (~27 km/h)
  driftEntryAngleDeg: 13.0,     // |slip| >= 13° para começar a contar entrada em drift
  driftExitAngleDeg: 8.0,       // Histerese: |slip| < 8° para começar a contar saída do drift
  driftEntryConfirmTime: 0.25,  // Tempo mínimo (s) acima do ângulo de entrada para ativar DRIFTANDO
  driftExitConfirmTime: 0.20,   // Tempo (s) abaixo do ângulo de saída (ou vel. baixa) para encerrar drift

  // --------------------------------------------------------------------------
  // 3. PONTUAÇÃO, MULTIPLICADOR, TRANSIÇÕES E SEQUÊNCIA
  // --------------------------------------------------------------------------
  // Calibrado por simulação para que uma boa sequência de 40 a 60 s (~30-35 s de drift
  // efetivo entre curvas e retas) alcance 25.000 pontos de forma desafiadora mas justa.
  basePointsPerSecond: 66.0,    // Taxa base de pontos/s em drift (calibrada para 25.000 pts em 45–52 s)
  referenceSpeedForScore: 19.0, // Velocidade de referência (m/s) para o fator de velocidade = 1.0
  maxSpeedScoreFactor: 1.5,     // Teto do fator de velocidade
  referenceAngleForScore: 28.0, // Ângulo de deriva (graus) para o fator de ângulo = 1.0
  maxAngleScoreFactor: 1.65,    // Teto do fator de ângulo
  edgeBonusMultiplier: 1.5,     // Bônus x1,5 quando o drift passa a menos de ~1 m da borda da pista
  edgeBonusDistanceMeters: 1.05,// Distância até a borda do asfalto (m) que ativa o bônus "BORDA!"

  // Multiplicador em degraus crescentes e limiares de tempo acumulado de drift na sequência
  multiplierSteps: [1, 2, 3, 5, 8, 12, 20],
  multiplierTimeThresholds: [2, 5, 9, 14, 20, 27], // Segundos acumulados de drift na sequência
  transitionMaxWindowSec: 1.5,  // Janela máxima (s) para inverter o sinal do drift e ganhar "TRANSIÇÃO +1"
  transitionCooldownSec: 10.0,  // Cooldown mínimo (s) entre bônus de transição (1 transição por chicane/trecho)
  sequenceResetTimeSec: 3.0,    // 3 s sem drift -> banca PENDENTES no TOTAL e reseta multiplicador para x1

  // --------------------------------------------------------------------------
  // 4. DETECÇÃO DE SAÍDA DE PISTA (9 PONTOS NA PEGADA DO CARRO)
  // --------------------------------------------------------------------------
  trackSamplePointsCount: 600,  // Quantidade de pontos pré-calculados na CatmullRomCurve3 (getSpacedPoints)
  trackWidth: 11.0,             // Largura oficial da faixa de asfalto (m)
  carFootprintHalfWidth: 0.88,  // Meia-largura da pegada do carro (m) para os 9 pontos
  carFootprintHalfLength: 2.05, // Meio-comprimento da pegada do carro (m) para os 9 pontos
  offTrackPointsThreshold: 5,   // 5 ou mais de 9 pontos (> 50%) fora da meia-largura -> perde pendentes
  offTrackPenaltyCooldownSec: 1.0, // Cooldown de 1 s para não repetir a penalidade continuamente

  // --------------------------------------------------------------------------
  // 5. SUPERDRIFT (CONDIÇÃO DE VITÓRIA CONTINUÁVEL)
  // --------------------------------------------------------------------------
  superdriftThreshold: 25000,   // Pontos PENDENTES necessários na sequência para disparar o SUPERDRIFT
  superdriftMaxMultHoldSec: 3.0,// Alternativa: segurar o multiplicador máximo (x20) por 3 s de drift ativo

  // --------------------------------------------------------------------------
  // 6. CÂMERA DINÂMICA EM 3ª PESSOA E EFEITOS
  // --------------------------------------------------------------------------
  cameraSmoothingK: 8.0,        // Constante k do amortecimento 1 - exp(-k * dt)
  cameraVelocityLookAhead: 0.22,// Quanto a câmera antecipa o vetor velocidade durante o drift
  cameraBaseFov: 60.0,          // FOV base da câmera do jogador (graus)
  cameraMaxSpeedFovBoost: 8.5,  // Aumento máximo de FOV em velocidade máxima (graus)
  cameraSuperdriftFovPunch: 14.0, // "Soco" de FOV instantâneo ao disparar o SUPERDRIFT
  cameraShakeSuperdriftDuration: 0.9, // Duração (s) do tremor de câmera no SUPERDRIFT
  cameraShakeIntensity: 0.42,   // Amplitude máxima do camera shake (m)

  // Pool de partículas e marcas de pneu (Fase C — zero alocação por frame)
  smokePoolSize: 300,           // Quantidade fixa de partículas de fumaça num único THREE.Points
  skidMarksMaxSegments: 360,    // Capacidade do ring buffer de marcas de pneu num único BufferGeometry
  skidMarksEnabled: true,       // Liga/desliga marcas de pneu no painel
};
