/**
 * Animações SVG ORIGINAIS (spec §8): boneco de vista lateral, keyframes por ângulos absolutos.
 * Convenção de ângulo (graus): 0 = para baixo, 90 = para frente (direita), 180 = para cima, -90 = para trás.
 * Ilustrativo: mostra a sequência do movimento, não substitui orientação de coach.
 */

export type Prop =
  | 'barbell' | 'barbell_back' | 'dumbbell' | 'kettlebell' | 'sandbag' | 'sandbag_shoulder' | 'ball' | 'band'
  | 'rope' | 'pullbar' | 'bench' | 'box' | 'wall' | 'bike' | 'rower';

export interface Pose {
  /** Posição horizontal do quadril (0–200). */
  hx: number;
  torso: number;
  /** Curvatura da coluna (+ arredonda para cima, − arqueia). */
  bend?: number;
  ua: number; la: number;   // braço da frente (superior/antebraço)
  ua2?: number; la2?: number; // braço de trás (default = da frente)
  th: number; sh: number;   // perna da frente (coxa/canela)
  th2?: number; sh2?: number; // perna de trás
  /** Elevação extra (saltos), em unidades do SVG. */
  lift?: number;
  head?: number; // inclinação extra da cabeça
}

export interface Animation {
  frames: Pose[];
  /** Duração de um ciclo (s). */
  cycle: number;
  anchor: 'ground' | 'hang' | 'seat';
  props: Prop[];
  /** Objeto preso às mãos (desenhado no ponto da mão). */
  handProp?: 'barbell' | 'dumbbell' | 'kettlebell' | 'sandbag' | 'ball' | 'band';
  /** Mantém pose final por um instante (fração do ciclo). */
  hold?: number;
}

const P = (o: Partial<Pose>): Pose => ({ hx: 100, torso: 180, ua: 0, la: 0, th: 0, sh: 0, ...o });

const STAND = P({});
const STAND_ARMS_FWD = P({ ua: 90, la: 90 });
const SQUAT_BOTTOM = P({ torso: 145, th: 100, sh: -28, ua: 95, la: 95 });
const QUARTER = P({ torso: 165, th: 45, sh: -20 });
const HINGE = P({ torso: 100, th: 12, sh: -4, ua: 0, la: 0 });
const DL_START = P({ torso: 112, th: 62, sh: -12, ua: 2, la: 2 });
const RACK = { ua: 100, la: -150 };
const OVERHEAD = { ua: 180, la: 180 };
const PLANK_TOP = P({ torso: 115, th: -65, sh: -65, ua: 0, la: 0, hx: 100 });
const PLANK_BOTTOM = P({ torso: 99, th: -81, sh: -81, ua: -100, la: 10, hx: 100 });
const LYING_UP = P({ torso: -90, th: 90, sh: 0 }); // deitado de costas, cabeça à esquerda
const QUADRUPED = P({ torso: 90, th: 0, sh: -90, ua: 0, la: 0 });

const A = (frames: Pose[], cycle: number, props: Prop[] = [], extra: Partial<Animation> = {}): Animation => ({ frames, cycle, anchor: 'ground', props, ...extra });

export const ANIMATIONS: Record<string, Animation> = {
  air_squat: A([STAND_ARMS_FWD, SQUAT_BOTTOM], 2),
  box_squat_bench: A([STAND_ARMS_FWD, P({ torso: 150, th: 90, sh: -15, ua: 95, la: 95 })], 2.4, ['bench']),
  goblet_squat: A([P({ ua: 25, la: 165 }), P({ torso: 155, th: 100, sh: -28, ua: 50, la: 175 })], 2.6, [], { handProp: 'dumbbell' }),
  front_squat: A([P({ ...RACK }), P({ torso: 160, th: 100, sh: -28, ...RACK })], 3, [], { handProp: 'barbell' }),
  back_squat: A([P({ ua: -130, la: 40 }), P({ torso: 140, th: 100, sh: -28, ua: -100, la: 60 })], 3, ['barbell_back']),
  thruster: A([P({ torso: 160, th: 100, sh: -28, ...RACK }), P({ ...RACK }), P({ ...OVERHEAD })], 2.6, [], { handProp: 'barbell' }),
  deadlift: A([DL_START, P({ torso: 140, th: 25, sh: -5 }), STAND], 3.2, [], { handProp: 'barbell', hold: 0.15 }),
  kb_deadlift_light: A([HINGE, STAND], 2.8, [], { handProp: 'kettlebell' }),
  hip_hinge_drill: A([P({ ua: 30, la: 60 }), P({ torso: 100, th: 12, sh: -4, ua: 30, la: 60 })], 3),
  kb_swing: A([P({ torso: 105, th: 18, sh: -6, ua: -25, la: -25 }), P({ ua: 90, la: 90 })], 2, [], { handProp: 'kettlebell' }),
  power_clean: A([DL_START, P({ torso: 190, th: -5, sh: 0, ua: 0, la: 0, lift: 6 }), P({ ...QUARTER, ...RACK }), P({ ...RACK })], 3.2, [], { handProp: 'barbell' }),
  power_snatch: A([P({ torso: 108, th: 65, sh: -12, ua: 5, la: 5 }), P({ torso: 190, th: -5, sh: 0, ua: 20, la: 20, lift: 6 }), P({ ...QUARTER, ...OVERHEAD }), P({ ...OVERHEAD })], 3.4, [], { handProp: 'barbell' }),
  clean_and_jerk: A([DL_START, P({ ...QUARTER, ...RACK }), P({ ...RACK }), P({ torso: 180, th: 40, sh: -5, th2: -35, sh2: -40, ...OVERHEAD }), P({ ...OVERHEAD })], 4.5, [], { handProp: 'barbell' }),
  db_snatch: A([P({ torso: 108, th: 50, sh: -10, ua: 0, la: 0, ua2: 30, la2: 60 }), P({ torso: 185, ua: 140, la: 170, ua2: 20, la2: 40 }), P({ ...OVERHEAD, ua2: 10, la2: 20 })], 2.8, [], { handProp: 'dumbbell' }),
  sandbag_clean: A([P({ torso: 105, th: 70, sh: -15, ua: 10, la: 60 }), P({ torso: 160, th: 60, sh: -20, ua: 40, la: 150 }), P({ ua: -150, la: 30 })], 4, [], { handProp: 'sandbag' }),
  db_press: A([P({ ua: 60, la: 170 }), P({ ...OVERHEAD })], 2.6, [], { handProp: 'dumbbell' }),
  db_push_press: A([P({ ua: 60, la: 170 }), P({ torso: 178, th: 30, sh: -20, ua: 60, la: 170 }), P({ ...OVERHEAD })], 2.4, [], { handProp: 'dumbbell' }),
  band_press: A([P({ ua: 60, la: 170 }), P({ ...OVERHEAD })], 2.4, [], { handProp: 'band' }),
  strict_hspu: A([P({ torso: 0, th: 180, sh: 180, ua: 0, la: 0, hx: 110 }), P({ torso: 0, th: 180, sh: 180, ua: 80, la: -20, hx: 110 })], 3.6, ['wall']),
  pike_push_up: A([P({ torso: 45, th: -35, sh: -35, ua: 5, la: 5 }), P({ torso: 50, th: -35, sh: -35, ua: -70, la: 30 })], 3),
  push_up: A([PLANK_TOP, PLANK_BOTTOM], 2.4),
  push_up_incline: A([P({ torso: 128, th: -52, sh: -52, ua: 30, la: 30 }), P({ torso: 115, th: -65, sh: -65, ua: -80, la: 40 })], 2.3, ['bench']),
  bench_press: A([P({ ...LYING_UP, ...OVERHEAD }), P({ ...LYING_UP, ua: 25, la: 180 })], 3, ['bench'], { handProp: 'barbell' }),
  db_bench_press: A([P({ ...LYING_UP, ...OVERHEAD }), P({ ...LYING_UP, ua: 30, la: 175 })], 3, ['bench'], { handProp: 'dumbbell' }),
  pull_up: A([P({ ...OVERHEAD }), P({ ua: 15, la: 175 })], 3, ['pullbar'], { anchor: 'hang' }),
  chin_up: A([P({ ...OVERHEAD }), P({ ua: 10, la: 170 })], 3, ['pullbar'], { anchor: 'hang' }),
  toes_to_bar: A([P({ ...OVERHEAD, torso: 185 }), P({ ...OVERHEAD, torso: 200, th: 165, sh: 175 })], 3, ['pullbar'], { anchor: 'hang' }),
  band_lat_pulldown: A([P({ th: 0, sh: -90, ...OVERHEAD }), P({ th: 0, sh: -90, ua: 25, la: 160 })], 2.5, [], { handProp: 'band' }),
  db_row: A([P({ torso: 110, th: 25, sh: -10, ua: 0, la: 0 }), P({ torso: 110, th: 25, sh: -10, ua: -70, la: 20 })], 2.8, [], { handProp: 'dumbbell' }),
  band_row: A([P({ torso: 178, th: 90, sh: 90, ua: 90, la: 90 }), P({ torso: 185, th: 90, sh: 90, ua: -30, la: 85 })], 2.5, [], { handProp: 'band', anchor: 'ground' }),
  band_pull_apart: A([P({ ua: 90, la: 90 }), P({ ua: 90, la: 90, ua2: -40, la2: -40 })], 2, [], { handProp: 'band' }),
  db_curl: A([P({ ua: 0, la: 0 }), P({ ua: 5, la: 150 })], 2.5, [], { handProp: 'dumbbell' }),
  triceps_ext: A([P({ ua: 170, la: 20 }), P({ ...OVERHEAD })], 2.5, [], { handProp: 'dumbbell' }),
  lunge: A([STAND, P({ th: 85, sh: 0, th2: -15, sh2: -95 })], 2.6),
  bulgarian_split_squat: A([P({ th: 20, sh: 0, th2: -40, sh2: -95 }), P({ th: 88, sh: -5, th2: -10, sh2: -85 })], 3, ['bench']),
  step_up: A([P({ hx: 85, th: 85, sh: -5 }), P({ hx: 125, lift: 35 })], 2.6, ['box']),
  box_jump: A([P({ hx: 60, torso: 150, th: 85, sh: -25, ua: -40, la: -40 }), P({ hx: 95, th: 70, sh: -60, ua: 150, la: 150, lift: 60 }), P({ hx: 130, lift: 40 })], 3, ['box']),
  jump_squat: A([SQUAT_BOTTOM, P({ ua: 160, la: 160, lift: 25 })], 2.2),
  plank: A([P({ torso: 98, th: -82, sh: -82, ua: 0, la: 90 }), P({ torso: 99, th: -81, sh: -81, ua: 0, la: 90, bend: 2 })], 3),
  side_plank: A([P({ torso: 112, th: -68, sh: -68, ua: 0, la: 0, ua2: 180, la2: 180 }), P({ torso: 116, th: -64, sh: -64, ua: 0, la: 0, ua2: 180, la2: 180 })], 3),
  dead_bug: A([P({ ...LYING_UP, th: 180, sh: 90, ...OVERHEAD }), P({ ...LYING_UP, th: 120, sh: 115, th2: 180, sh2: 90, ua: -100, la: -100, ua2: 180, la2: 180 })], 3),
  hollow_hold: A([P({ torso: -100, th: 102, sh: 102, ua: -100, la: -100, bend: 5 }), P({ torso: -97, th: 99, sh: 99, ua: -97, la: -97, bend: 5 })], 2.5),
  sit_up: A([P({ torso: -90, th: 60, sh: -40, ua: -90, la: -90 }), P({ torso: 145, th: 60, sh: -40, ua: 120, la: 120 })], 2.5),
  v_up_tuck: A([P({ torso: -100, th: 102, sh: 102, ua: -100, la: -100 }), P({ torso: -140, th: 150, sh: 10, ua: 100, la: 100, bend: 8 })], 2.5),
  wall_walk: A([P({ torso: 90, th: -90, sh: -90, ua: 0, la: 120, hx: 120 }), P({ torso: 40, th: -140, sh: -150, ua: 10, la: 10, hx: 120 }), P({ torso: 8, th: 175, sh: 175, ua: 0, la: 0, hx: 120 })], 6, ['wall'], { hold: 0.2 }),
  glute_bridge: A([P({ torso: -90, th: 135, sh: 0 }), P({ torso: -110, th: 100, sh: 0 })], 2.5),
  superman: A([P({ torso: 90, th: -90, sh: -90, ua: 90, la: 90 }), P({ torso: 100, th: -100, sh: -100, ua: 100, la: 100 })], 3),
  burpee: A([STAND, P({ torso: 140, th: 105, sh: -35, ua: 0, la: 0 }), PLANK_TOP, P({ torso: 92, th: -88, sh: -88, ua: -110, la: 10 }), PLANK_TOP, P({ torso: 140, th: 105, sh: -35, ua: 0, la: 0 }), P({ ...OVERHEAD, lift: 20 })], 4),
  burpee_step: A([STAND, P({ torso: 140, th: 105, sh: -35, ua: 0, la: 0 }), P({ torso: 125, th: 90, sh: -40, th2: -55, sh2: -55, ua: 0, la: 0 }), PLANK_TOP, P({ torso: 140, th: 105, sh: -35, ua: 0, la: 0 }), STAND], 4.5),
  mountain_climber: A([P({ ...PLANK_TOP, th: 70, sh: -60 }), P({ ...PLANK_TOP, th2: 70, sh2: -60 })], 0.9),
  high_knee_march: A([P({ th: 90, sh: 0, ua: 60, la: 120, ua2: -30, la2: 20 }), P({ th2: 90, sh2: 0, ua2: 60, la2: 120, ua: -30, la: 20 })], 1.2),
  run: A([P({ torso: 172, th: 45, sh: -10, th2: -30, sh2: -80, ua: -40, la: 50, ua2: 40, la2: 110 }), P({ torso: 172, th2: 45, sh2: -10, th: -30, sh: -80, ua2: -40, la2: 50, ua: 40, la: 110, lift: 6 })], 0.8),
  bike: A([P({ torso: 130, ua: 100, la: 100, th: 100, sh: 10, th2: 45, sh2: -20 }), P({ torso: 130, ua: 100, la: 100, th: 60, sh: -30, th2: 95, sh2: 20 }), P({ torso: 130, ua: 100, la: 100, th: 45, sh: -20, th2: 100, sh2: 10 }), P({ torso: 130, ua: 100, la: 100, th: 95, sh: 20, th2: 60, sh2: -30 })], 1.2, ['bike'], { anchor: 'seat' }),
  row_erg: A([P({ torso: 145, th: 140, sh: 20, ua: 90, la: 90 }), P({ torso: 195, th: 95, sh: 90, ua: -20, la: 80 })], 2.4, ['rower'], { anchor: 'seat' }),
  double_under: A([P({ ua: 20, la: 60, lift: 0 }), P({ ua: 20, la: 60, lift: 16 })], 0.6, ['rope']),
  single_under: A([P({ ua: 20, la: 60, lift: 0 }), P({ ua: 20, la: 60, lift: 7 })], 0.5, ['rope']),
  wall_ball: A([P({ torso: 150, th: 100, sh: -28, ua: 40, la: 160 }), P({ ...OVERHEAD, lift: 4 })], 3, ['wall'], { handProp: 'ball' }),
  farmer_carry: A([P({ th: 25, sh: -10, th2: -20, sh2: -20 }), P({ th2: 25, sh2: -10, th: -20, sh: -20 })], 1.1, [], { handProp: 'dumbbell' }),
  thoracic_rotation: A([P({ torso: -90, th: 0, sh: 90, ua: 90, la: 90, hx: 120 }), P({ torso: -90, th: 0, sh: 90, ua: 180, la: 180, hx: 120 }), P({ torso: -90, th: 0, sh: 90, ua: -90, la: -90, hx: 120 })], 4),
  hip_90_90: A([P({ torso: 180, th: 90, sh: 0, th2: -90, sh2: 0, ua: 60, la: 60 }), P({ torso: 180, th: 90, sh: 180, th2: -90, sh2: 180, ua: 60, la: 60 })], 4),
  shoulder_passthrough: A([P({ ua: 60, la: 60 }), P({ ...OVERHEAD }), P({ ua: -60, la: -60 })], 3, [], { handProp: 'band' }),
  cat_cow: A([P({ ...QUADRUPED, bend: 14, head: 30 }), P({ ...QUADRUPED, bend: -12, head: -25 })], 4),
  hamstring_stretch: A([P({ torso: -90, th: 90, sh: 90, th2: 170, sh2: 170, ua: 160, la: 175 }), P({ torso: -90, th: 90, sh: 90, th2: 178, sh2: 178, ua: 165, la: 178 })], 4, [], { handProp: 'band' }),
  breathing_recovery: A([P({ torso: -90, th: 120, sh: 0, ua: 60, la: 120, bend: 0 }), P({ torso: -90, th: 120, sh: 0, ua: 60, la: 120, bend: 6 })], 6),
};
export function animationFor(exerciseId: string): Animation | null {
  return ANIMATIONS[exerciseId] ?? null;
}
