// src/lib/ai/models.ts — Shared model configuration

export interface ModelInfo {
  id: string;        // API model ID
  name: string;      // Display name
  desc: string;      // Description
  reasoning: boolean;
  multimodal: boolean;
}

export const MODELS: ModelInfo[] = [
  {
    id: 'hy3-free',
    name: 'Hydra',
    desc: 'Reasoning kuat, responsif',
    reasoning: true,
    multimodal: false,
  },
  {
    id: 'deepseek-v4-flash-free',
    name: 'Nova',
    desc: 'Cepat & ringan untuk tugas sehari-hari',
    reasoning: true,
    multimodal: false,
  },
  {
    id: 'mimo-v2.5-free',
    name: 'Luma',
    desc: 'Multimodal, reasoning, serba bisa',
    reasoning: true,
    multimodal: true,
  },
  {
    id: 'nemotron-3-ultra-free',
    name: 'Cael',
    desc: 'Powerful untuk tugas kompleks',
    reasoning: true,
    multimodal: true,
  },
];

export function getModelById(id: string): ModelInfo | undefined {
  return MODELS.find(m => m.id === id);
}

export function getMultimodalModel(): ModelInfo {
  return MODELS.find(m => m.multimodal) || MODELS[2]; // Default to Luma
}

export function isMultimodalModel(modelId: string): boolean {
  return getModelById(modelId)?.multimodal ?? false;
}
