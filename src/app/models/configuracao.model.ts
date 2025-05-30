export interface ConfiguracaoPiramide {
  id: string;
  posicaoLimiteDesafioTopo: number; // A partir de qual posição pode desafiar até o topo (ex: 5 = 5º colocado em diante pode desafiar 1º)
  criadoPor: string;
  dataAtualizacao: Date;
}

export interface NovaConfiguracao {
  posicaoLimiteDesafioTopo: number;
}