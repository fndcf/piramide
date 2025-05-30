export interface EstadoPiramide {
  id: string;
  bases: {
    [key: number]: string[]; // base -> array de IDs das duplas
  };
  ultimaAtualizacao: Date;
  temporada: string;
  ativa: boolean;
}

export interface ConfiguracaoPiramide {
  id: string;
  maxDuplasTotal: number; // 45 duplas (1+2+3+...+9)
  pontosVitoriaIgual: number; // pontos por vitória na mesma base
  pontosVitoriaSuperior: number; // pontos por vitória contra base superior
  pontosDerrota: number; // pontos perdidos por derrota
  pontosNaoAceitar: number; // pontos perdidos por não aceitar desafio
  diasPrazoResposta: number; // dias para responder desafio
  maxDesafiosPorSemana: number; // limite de desafios por dupla
  basesPermiteDesafio: number; // quantas bases acima pode desafiar
}

export interface MovimentacaoPiramide {
  id: string;
  duplaId: string;
  baseAnterior: number;
  posicaoAnterior: number;
  baseNova: number;
  posicaoNova: number;
  motivo: 'vitoria' | 'derrota' | 'inatividade' | 'admin';
  jogoId?: string;
  data: Date;
  observacoes?: string;
}

export interface RankingGeral {
  dupla: string;
  base: number;
  posicao: number;
  pontos: number;
  vitorias: number;
  derrotas: number;
  percentual: number;
  jogosRecentes: number;
}