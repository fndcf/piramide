export interface Piramide {
  id: string;
  nome: string;
  descricao: string;
  categoria: 'masculino' | 'feminino' | 'mista';
  status: 'ativa' | 'pausada' | 'finalizada' | 'arquivada';
  maxDuplas: number; // padrão 45, mas pode ser configurável
  dataInicio: Date;
  dataFim?: Date;
  criadoPor: string;
  configuracao: ConfiguracaoPiramideEspecifica;
  cor: string; // cor tema da pirâmide
  icone: string; // emoji ou ícone da pirâmide
  ativa: boolean; // se está sendo exibida atualmente
}

export interface ConfiguracaoPiramideEspecifica {
  posicaoLimiteDesafioTopo: number;
  permitirDesafiosEntrePiramides: boolean;
  diasPrazoResposta: number;
  regrasPersonalizadas?: string;
}

export interface NovaPiramide {
  nome: string;
  descricao: string;
  categoria: 'masculino' | 'feminino' | 'mista';
  maxDuplas?: number;
  cor?: string;
  icone?: string;
  configuracao?: Partial<ConfiguracaoPiramideEspecifica>;
}

// Atualizar interface da Dupla para incluir pirâmideId
export interface Dupla {
  id: string;
  piramideId: string; // NOVO: ID da pirâmide
  jogador1: string;
  jogador2: string;
  base: number;
  posicao: number;
  vitorias: number;
  derrotas: number;
  ativa: boolean;
  dataIngresso: Date;
  telefone?: string;
  observacoes?: string;
  selected?: boolean;
}

export interface NovaDupla {
  jogador1: string;
  jogador2: string;
  telefone?: string;
  observacoes?: string;
}