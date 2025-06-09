export interface Dupla {
  id: string;
  piramideId: string; // NOVO: ID da pirâmide
  jogador1: string;
  jogador2: string;
  base: number; // 1 a 9 (1 = topo da pirâmide)
  posicao: number; // posição dentro da base
  vitorias: number;
  derrotas: number;
  ativa: boolean;
  dataIngresso: Date;
  telefone?: string;
  observacoes?: string;
  selected?: boolean; // Propriedade para seleção na interface
}

export interface NovaDupla {
  jogador1: string;
  jogador2: string;
  telefone?: string;
  observacoes?: string;
}

// ✅ NOVA INTERFACE: Para transferência entre pirâmides
export interface TransferenciaDupla {
  duplaId: string;
  piramideOrigemId: string;
  piramideDestinoId: string;
  manterEstatisticas: boolean;
  observacoes?: string;
}

// ✅ INTERFACE MANTIDA: Para edição de duplas
export interface EditarDupla {
  id: string;
  jogador1: string;
  jogador2: string;
  telefone: string;
  observacoes: string;
  vitorias: number;
  derrotas: number;
}

// ✅ INTERFACE MANTIDA: Para resultados de reposicionamento
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

// ✅ INTERFACE ATUALIZADA: Para movimentações na pirâmide (adicionado piramideId)
export interface MovimentacaoDupla {
  duplaId: string;
  posicaoAnterior: number;
  novaPosicao: number;
  baseAnterior: number;
  novaBase: number;
  motivo: 'reposicionamento_manual' | 'vitoria' | 'derrota' | 'adicao' | 'remocao' | 'transferencia';
  data: Date;
  piramideId: string; // NOVO: ID da pirâmide onde ocorreu a movimentação
}

export interface EstatisticasPiramide {
  totalDuplas: number;
  vagasDisponiveis: number;
  totalJogos: number;
  duplasMaisAtivas: Dupla[];
  ultimaAtividade: Date;
  tempoMedioBase: number; // dias médios que duplas ficam na mesma base
  rotatividade: number; // porcentagem de mudanças de posição por mês
}

// Para o seletor de pirâmides
export interface PiramideSeletor {
  id: string;
  nome: string;
  categoria: string;
  status: string;
  totalDuplas: number;
  cor: string;
  icone: string;
  ultimaAtividade: Date;
}
