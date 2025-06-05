// src/app/models/dupla.model.ts - VERSÃO ATUALIZADA

export interface Dupla {
  id: string;
  jogador1: string;
  jogador2: string;
  base: number; // 1 a 9 (1 = topo da pirâmide)
  posicao: number; // posição dentro da base
  pontos: number;
  vitorias: number;
  derrotas: number;
  ativa: boolean;
  dataIngresso: Date;
  telefone?: string;
  email?: string;
  observacoes?: string;
  selected?: boolean; // Propriedade para seleção na interface
}

export interface NovaDupla {
  jogador1: string;
  jogador2: string;
  telefone?: string;
  email?: string;
  observacoes?: string;
}

// ✅ NOVA INTERFACE: Para edição de duplas
export interface EditarDupla {
  id: string;
  jogador1: string;
  jogador2: string;
  telefone: string;
  email: string;
  observacoes: string;
  vitorias: number;
  derrotas: number;
}

// ✅ NOVA INTERFACE: Para resultados de reposicionamento
export interface ResultadoReposicionamento {
  success: boolean;
  message: string;
  duplasAfetadas?: number;
  novasPosicoes?: { duplaId: string; novaBase: number; novaPosicao: number }[];
}

export interface EstatisticasDupla {
  totalJogos: number;
  percentualVitorias: number;
  jogosRecentes: number;
  melhorBase: number;
  tempoNaBase: number; // dias na base atual
}

// ✅ NOVA INTERFACE: Para movimentações na pirâmide
export interface MovimentacaoDupla {
  duplaId: string;
  posicaoAnterior: number;
  novaPosicao: number;
  baseAnterior: number;
  novaBase: number;
  motivo: 'reposicionamento_manual' | 'vitoria' | 'derrota' | 'adicao' | 'remocao';
  data: Date;
}