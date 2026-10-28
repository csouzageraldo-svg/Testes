// Taxonomia multidimensional (spec §5.2). Rótulos em pt-BR para a UI.

export const PATTERNS = [
  'squat', 'hinge', 'lunge', 'push_h', 'push_v', 'pull_h', 'pull_v', 'carry', 'rotation',
  'core_flexion', 'core_extension', 'core_stability', 'locomotion', 'gymnastics', 'olympic',
  'mono_cardio', 'plyo', 'mobility',
] as const;
export type Pattern = (typeof PATTERNS)[number];

export const PATTERN_LABEL: Record<Pattern, string> = {
  squat: 'Agachamento', hinge: 'Dobradiça de quadril', lunge: 'Avanço/unilateral',
  push_h: 'Empurrar horizontal', push_v: 'Empurrar vertical', pull_h: 'Puxar horizontal',
  pull_v: 'Puxar vertical', carry: 'Carregar', rotation: 'Rotação/antirrotação',
  core_flexion: 'Flexão de tronco', core_extension: 'Extensão de tronco', core_stability: 'Estabilidade de core',
  locomotion: 'Locomoção', gymnastics: 'Ginástica', olympic: 'Levantamento olímpico',
  mono_cardio: 'Cardio cíclico', plyo: 'Pliometria', mobility: 'Mobilidade',
};

export const MUSCLES = [
  'chest', 'lats', 'upper_back', 'delts', 'biceps', 'triceps', 'forearms',
  'core_ant', 'core_lat', 'lower_back', 'glutes', 'quads', 'hamstrings', 'calves', 'adductors', 'hip_flexors',
] as const;
export type Muscle = (typeof MUSCLES)[number];

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: 'Peitoral', lats: 'Dorsal', upper_back: 'Costas altas/trapézio', delts: 'Deltoides',
  biceps: 'Bíceps', triceps: 'Tríceps', forearms: 'Antebraço/pegada', core_ant: 'Core anterior',
  core_lat: 'Core lateral/oblíquos', lower_back: 'Lombar', glutes: 'Glúteos', quads: 'Quadríceps',
  hamstrings: 'Posteriores de coxa', calves: 'Panturrilha', adductors: 'Adutores', hip_flexors: 'Flexores do quadril',
};

/** Grupos usados no foco do briefing e no balanceamento. */
export const MUSCLE_GROUPS = {
  upper: ['chest', 'lats', 'upper_back', 'delts', 'biceps', 'triceps', 'forearms'],
  legs: ['glutes', 'quads', 'hamstrings', 'calves', 'adductors'],
  core: ['core_ant', 'core_lat', 'lower_back', 'hip_flexors'],
} as const satisfies Record<string, readonly Muscle[]>;
export type MuscleGroup = keyof typeof MUSCLE_GROUPS;

export const JOINTS = ['shoulder', 'elbow', 'wrist', 'lumbar', 'hip', 'knee', 'ankle'] as const;
export type Joint = (typeof JOINTS)[number];
export const JOINT_LABEL: Record<Joint, string> = {
  shoulder: 'Ombro', elbow: 'Cotovelo', wrist: 'Punho', lumbar: 'Lombar', hip: 'Quadril', knee: 'Joelho', ankle: 'Tornozelo',
};

export const ENERGY_DOMAINS = ['power', 'anaerobic_interval', 'mixed', 'aerobic', 'low'] as const;
export type EnergyDomain = (typeof ENERGY_DOMAINS)[number];
export const ENERGY_LABEL: Record<EnergyDomain, string> = {
  power: 'Potência curta', anaerobic_interval: 'Anaeróbico intervalado', mixed: 'Misto',
  aerobic: 'Aeróbico prolongado', low: 'Baixa intensidade',
};

/** As 10 capacidades físicas gerais citadas na metodologia CrossFit. */
export const CAPACITIES = [
  'cardio_endurance', 'stamina', 'strength', 'flexibility', 'power', 'speed', 'coordination', 'agility', 'balance', 'accuracy',
] as const;
export type Capacity = (typeof CAPACITIES)[number];
export const CAPACITY_LABEL: Record<Capacity, string> = {
  cardio_endurance: 'Resistência cardiorrespiratória', stamina: 'Stamina', strength: 'Força', flexibility: 'Flexibilidade',
  power: 'Potência', speed: 'Velocidade', coordination: 'Coordenação', agility: 'Agilidade', balance: 'Equilíbrio', accuracy: 'Precisão',
};

/** Categorias de modalidade da metodologia: monostrutural, ginástica, levantamento de peso. */
export type Modality = 'M' | 'G' | 'W';
export const MODALITY_LABEL: Record<Modality, string> = { M: 'Monostrutural/cardio', G: 'Ginástica', W: 'Levantamento' };

export type Intensity = 'recovery' | 'light' | 'moderate' | 'high';
export const INTENSITY_ORDER: Intensity[] = ['recovery', 'light', 'moderate', 'high'];
export const INTENSITY_LABEL: Record<Intensity, string> = { recovery: 'Recuperação', light: 'Leve', moderate: 'Moderada', high: 'Alta' };
export const INTENSITY_RPE: Record<Intensity, [number, number]> = { recovery: [2, 3], light: [4, 5], moderate: [6, 7], high: [8, 9] };

export function minIntensity(a: Intensity, b: Intensity): Intensity {
  return INTENSITY_ORDER[Math.min(INTENSITY_ORDER.indexOf(a), INTENSITY_ORDER.indexOf(b))];
}

export type Focus =
  | 'auto' | 'core' | 'upper' | 'legs' | 'strength' | 'cardio' | 'full_body' | 'mobility' | 'recovery' | 'technique';
export const FOCUS_LABEL: Record<Focus, string> = {
  auto: 'Aceitar sugestão', core: 'Core', upper: 'Superiores', legs: 'Pernas', strength: 'Força', cardio: 'Cardio',
  full_body: 'Full body', mobility: 'Mobilidade', recovery: 'Recuperação', technique: 'Técnica',
};

export type Location = 'home' | 'no_equipment' | 'hotel_gym' | 'hotel_room';
export const LOCATION_LABEL: Record<Location, string> = {
  home: 'Casa', no_equipment: 'Sem equipamentos', hotel_gym: 'Academia (hotel/convencional)', hotel_room: 'Quarto de hotel',
};

export function placeLabel(loc?: string): string {
  if (!loc) return '';
  if (loc === 'box') return 'box';
  return LOCATION_LABEL[loc as Location] ?? loc;
}
