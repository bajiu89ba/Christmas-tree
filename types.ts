export type FontStyleKey = 'style1' | 'style2' | 'style3' | 'style4' | 'style5';

export interface TextConfig {
  line1: string;
  line2: string;
  fontKey: FontStyleKey;
  size: number;
  color: string;
}

export interface ParticleConfig {
  treeCount: number;
  dustCount: number;
}

export interface SnowConfig {
  count: number;
  size: number;
  speed: number;
}

export interface AppConfig {
  text: TextConfig;
  particle: ParticleConfig;
  snow: SnowConfig;
  bgmVolume: number;
  rotationSpeed: number;
}

export interface SavedPhoto {
  id: string;
  data: string; // Base64
}

export type SceneMode = 'TREE' | 'SCATTER' | 'FOCUS';

export interface EngineState {
  mode: SceneMode;
  isCamActive: boolean;
  handDetected: boolean;
}