export interface Jogo {
  id: string;
  dupla1Id: string;
  dupla2Id: string;
  dupla1Nome: string; // Para facilitar exibição
  dupla2Nome: string;
  placar1: number;
  placar2: number;
  vencedorId: string;
  perdedorId: string;
  data: Date;
  dataAgendada?: Date;
  base: number; // base onde aconteceu o jogo
  status: 'agendado' | 'em_andamento' | 'finalizado' | 'cancelado';
  tipoJogo: 'desafio' | 'mesmo_nivel' | 'amistoso';
  observacoes?: string;
  sets?: Set[];
}

export interface Set {
  games1: number;
  games2: number;
  tiebreak1?: number;
  tiebreak2?: number;
}

export interface NovoJogo {
  dupla1Id: string;
  dupla2Id: string;
  dataAgendada?: Date;
  tipoJogo: 'desafio' | 'mesmo_nivel' | 'amistoso';
  observacoes?: string;
}

export interface ResultadoJogo {
  jogoId: string;
  placar1: number;
  placar2: number;
  sets?: Set[];
  observacoes?: string;
}