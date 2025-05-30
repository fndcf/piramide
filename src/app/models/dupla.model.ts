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

export interface EstatisticasDupla {
  totalJogos: number;
  percentualVitorias: number;
  jogosRecentes: number;
  melhorBase: number;
  tempoNaBase: number; // dias na base atual
}