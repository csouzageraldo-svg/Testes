// Catálogo de tipos de equipamento + inventário identificado nas fotos do home gym (spec §3).
// O inventário identificado NÃO é confirmado: o gerador só usa itens com `confirmed: true`.

export const EQUIPMENT_TYPES = {
  barbell: 'Barra longa (olímpica)',
  bumper_plates: 'Anilhas bumper',
  iron_plates: 'Anilhas com pegada (tri-grip)',
  collars: 'Presilhas/travas de barra',
  squat_stand: 'Suporte para barra/agachamento',
  safety_arms: 'Barras de segurança (spotter arms)',
  dumbbells: 'Halteres (ajustáveis)',
  kb_handle: 'Alça de kettlebell (conversão de halter)',
  db_bar_connector: 'Conector halter→barra curta',
  kettlebell: 'Kettlebell',
  sandbag: 'Sandbag / saco de carga',
  bench: 'Banco ajustável',
  bike: 'Bicicleta ergométrica/spinning',
  bands_tube: 'Elásticos tubulares com pegadores',
  bands_loop: 'Mini bands / faixas de látex',
  bands_hip: 'Hip bands de tecido',
  door_anchor: 'Âncora de porta para elástico',
  mat: 'Colchonete / tapete',
  pullup_bar: 'Barra fixa',
  rower: 'Remo ergométrico',
  ski_erg: 'Ski erg',
  assault_bike: 'Assault/echo bike',
  medball: 'Medicine ball / wall ball',
  box: 'Caixa de salto (box)',
  jump_rope: 'Corda de pular',
  treadmill: 'Esteira',
  cable: 'Polia/cabos',
  machines: 'Máquinas de musculação',
  rings: 'Argolas',
  wall: 'Parede livre (wall walk / wall ball)',
  outdoor: 'Espaço externo para corrida',
} as const;
export type EquipmentType = keyof typeof EQUIPMENT_TYPES;

/** Itens que normalmente se checam numa academia de hotel/convencional. */
export const HOTEL_GYM_CHECKLIST: EquipmentType[] = [
  'dumbbells', 'bench', 'treadmill', 'bike', 'cable', 'barbell', 'squat_stand', 'machines', 'kettlebell',
  'pullup_bar', 'rower', 'medball', 'box', 'jump_rope', 'mat',
];

/** Sempre disponíveis em qualquer ambiente (peso corporal). Parede só fora do quarto. */
export const BODYWEIGHT_ALWAYS: EquipmentType[] = [];

export interface EquipmentItemSeed {
  key: string;
  type: EquipmentType;
  label: string;
  quantity?: number;
  /** Carga por unidade quando lida na foto ou relatada — continua precisando confirmação. */
  loadKg?: number;
  loadNote?: string;
  evidence: string;
  photoRefs: string[];
  safetyNote?: string;
}

/**
 * Leitura visual das 5 fotos de `assets/equipamentos/` (hashes conferidos com manifesto_assets.csv):
 * 423988 = barra + suporte; 423989 = sandbag/halteres/presilhas; 423990 = bike;
 * 423992 = banco + tapete; 424045 = elásticos.
 * Tudo aqui é "identificado na foto" e precisa de confirmação na tela Equipamentos.
 */
export const PHOTO_INVENTORY: EquipmentItemSeed[] = [
  { key: 'barbell', type: 'barbell', label: 'Barra longa olímpica (pegada recartilhada)', quantity: 1,
    evidence: 'Barra longa apoiada no suporte', photoRefs: ['423988', '423992'], loadNote: 'Peso da barra não visível — confirmar (comum: 15 ou 20 kg)' },
  { key: 'bumper_10', type: 'bumper_plates', label: 'Anilhas bumper FLEXBE 10 kg', quantity: 4, loadKg: 10,
    evidence: 'Marcação "10 kg / 22 lb" visível; aparentam 2 por lado', photoRefs: ['423988'], loadNote: 'Quantidade estimada — confirmar' },
  { key: 'bumper_other', type: 'bumper_plates', label: 'Anilhas bumper FLEXBE (outro peso)', quantity: undefined,
    evidence: 'Foto do banco mostra anilha com número parcialmente legível', photoRefs: ['423992'], loadNote: 'Peso ilegível — confirmar' },
  { key: 'tri_grip_15', type: 'iron_plates', label: 'Anilha com pegada "15"', quantity: 1, loadKg: 15,
    evidence: 'Marcação "15" na anilha', photoRefs: ['423989'], loadNote: 'Unidade e quantidade a confirmar' },
  { key: 'tri_grip_small', type: 'iron_plates', label: 'Anilhas com pegada menores', quantity: undefined,
    evidence: 'Anilhas no chão ao lado do suporte', photoRefs: ['423988'], loadNote: 'Pesos não legíveis' },
  { key: 'collars', type: 'collars', label: 'Presilhas de barra (verde)', quantity: 2,
    evidence: 'Par de presilhas verdes', photoRefs: ['423989'] },
  { key: 'squat_stand', type: 'squat_stand', label: 'Suporte de agachamento independente com ganchos (J-hooks) e pegadores',
    quantity: 1, evidence: 'Suporte com ganchos vermelhos e pegadores com espuma', photoRefs: ['423988', '423992'],
    safetyNote: 'Não foram identificadas barras de segurança. Sem confirmação de travas/geometria, o app NÃO sugere supino ou agachamento pesado com barra sem supervisão.' },
  { key: 'dumbbells', type: 'dumbbells', label: 'Par de halteres ajustáveis (anilhas de cimento/vinil)', quantity: 2,
    evidence: 'Dois halteres com pegada vermelha', photoRefs: ['423988', '423989', '423992'], loadNote: 'Carga máxima por halter a confirmar' },
  { key: 'kb_handle', type: 'kb_handle', label: 'Alça de kettlebell para conversão do halter', quantity: 1,
    evidence: 'Alça em "U" com pegada vermelha acoplada às anilhas', photoRefs: ['423989'],
    safetyNote: 'Kettlebell convertido: confirmar rosca/travamento antes de swings.' },
  { key: 'db_connector', type: 'db_bar_connector', label: 'Tubo conector (halteres → barra curta)', quantity: 1,
    evidence: 'Tubo com espuma vermelha/preta', photoRefs: ['423989'] },
  { key: 'sandbag', type: 'sandbag', label: 'Sandbag com alças', quantity: 1, loadKg: 20,
    evidence: 'Saco de carga cinza/preto com várias alças', photoRefs: ['423988', '423989'],
    loadNote: 'Uso relatado com 20 kg (relato do atleta) — não é necessariamente o máximo' },
  { key: 'bench', type: 'bench', label: 'Banco ajustável MovUp (com apoio de pernas)', quantity: 1,
    evidence: 'Banco com rolos de apoio de pernas', photoRefs: ['423992'] },
  { key: 'bike', type: 'bike', label: 'Bicicleta de spinning com monitor', quantity: 1,
    evidence: 'Bike com monitor e roda de inércia', photoRefs: ['423990'] },
  { key: 'bands_tube', type: 'bands_tube', label: 'Kit de elásticos tubulares (5 cores) com mosquetões e pegadores', quantity: 5,
    evidence: 'Tubos azul, verde, vermelho, amarelo e preto', photoRefs: ['424045', '423992'] },
  { key: 'bands_loop', type: 'bands_loop', label: 'Faixas de látex (mini bands)', quantity: 4,
    evidence: 'Faixas planas vermelha, verde, amarela e azul', photoRefs: ['424045'] },
  { key: 'bands_hip', type: 'bands_hip', label: 'Hip bands de tecido', quantity: 3,
    evidence: 'Faixas de tecido roxa, verde/rosa e kit embalado', photoRefs: ['424045'] },
  { key: 'door_anchor', type: 'door_anchor', label: 'Âncora de porta + tornozeleiras', quantity: 1,
    evidence: 'Fitas pretas com argola', photoRefs: ['424045'] },
  { key: 'mats', type: 'mat', label: 'Colchonete roxo + tapete EVA + grama sintética', quantity: 3,
    evidence: 'Colchonete roxo, tapete EVA preto e área de grama', photoRefs: ['423988', '423992'] },
];

/** Capacidades do espaço doméstico observadas (sacada coberta, piso porcelanato). Confirmar. */
export const SPACE_OBSERVATIONS = [
  'Sacada coberta com guarda-corpo de vidro e piso porcelanato: saltos e drops de barra apenas sobre tapete/plataforma.',
  'Altura do teto não verificada: confirmar antes de movimentos acima da cabeça com barra.',
  'Área residencial (quarto ao lado): considerar ruído em horários de silêncio.',
  'Não foram identificados: barra fixa, kettlebell maciço, remo, ski erg, assault bike, medicine ball, caixa de salto, corda.',
];
