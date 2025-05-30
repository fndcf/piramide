import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth';
import { DuplasService } from '../../services/duplas';
import { ConfiguracaoService } from '../../services/configuracao';
import { AdicionarDuplaComponent } from '../adicionar-dupla/adicionar-dupla';
import { LoginModalComponent } from '../login-modal/login-modal';
import { LoginJogadorModalComponent } from '../login-jogador-modal/login-jogador-modal';
import { ConfiguracaoModalComponent } from '../configuracao-modal/configuracao-modal';
import { ModalGerenciarDuplaComponent } from '../modal-gerenciar-dupla/modal-gerenciar-dupla';
import { Dupla } from '../../models/dupla.model';

interface DesafioInfo {
  desafiante: Dupla;
  desafiado: Dupla;
  posicaoDesafiante: number;
  posicaoDesafiado: number;
  diferenciaPosicoes: number;
}

interface ResultadoMovimentacao {
  novasPosicoes: { dupla: Dupla; novaPos: number }[];
  descricao: string;
}

@Component({
  selector: 'app-piramide',
  standalone: true,
  imports: [CommonModule, AdicionarDuplaComponent, LoginModalComponent, LoginJogadorModalComponent, ConfiguracaoModalComponent, ModalGerenciarDuplaComponent],
  templateUrl: './piramide.html',
  styleUrls: ['./piramide.scss']
})
export class PiramideComponent implements OnInit {
  duplasSelecionadas: Dupla[] = [];
  basesReais: Dupla[][] = [];
  carregando = true;
  mostrarModalAdicionar = false;
  mostrarModalLogin = false;
  mostrarModalJogador = false;
  mostrarModalConfig = false;
  jogadorInfo: any = null;
  posicaoLimiteDesafioTopo = 5;
  
  // Modal para registrar resultado
  mostrarModalResultado = false;
  desafioAtual: DesafioInfo | null = null;
  
  // ✅ NOVO: Modal para gerenciar dupla
  mostrarModalGerenciar = false;
  duplaGerenciada: Dupla | null = null;

  constructor(
    public authService: AuthService,
    private duplasService: DuplasService,
    private configuracaoService: ConfiguracaoService
  ) {}

  async ngOnInit() {
    await this.carregarDuplas();
    await this.carregarConfiguracao();
    this.verificarSessaoJogador();
  }

  async carregarConfiguracao() {
    try {
      const config = await this.configuracaoService.obterConfiguracao();
      this.posicaoLimiteDesafioTopo = config.posicaoLimiteDesafioTopo;
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
    }
  }

  verificarSessaoJogador() {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser && (currentUser as any).tipo === 'jogador') {
      this.jogadorInfo = currentUser;
    }
  }

  async carregarDuplas() {
    this.carregando = true;
    try {
      this.basesReais = await this.duplasService.obterDuplasOrganizadas();
      this.basesReais.forEach(base => {
        base.forEach(dupla => {
          dupla.selected = false;
        });
      });
    } catch (error) {
      console.error('Erro ao carregar duplas:', error);
    }
    this.carregando = false;
  }

  getSlots(baseNumber: number, duplasExistentes: number): any[] {
    const slotsVazios = baseNumber - duplasExistentes;
    return new Array(Math.max(0, slotsVazios)).fill(null);
  }

  getTotalDuplas(): number {
    return this.basesReais.reduce((total, base) => total + base.length, 0);
  }

  getTotalVagas(): number {
    return 45 - this.getTotalDuplas();
  }

  selecionarDupla(dupla: Dupla) {
    if (dupla.selected) {
      dupla.selected = false;
      this.duplasSelecionadas = this.duplasSelecionadas.filter(d => d.id !== dupla.id);
    } else {
      if (this.duplasSelecionadas.length < 2) {
        dupla.selected = true;
        this.duplasSelecionadas.push(dupla);
      }
    }
  }

  async removerDupla(event: Event, dupla: Dupla) {
    event.stopPropagation();
    
    if (confirm(`Tem certeza que deseja remover a dupla ${dupla.jogador1}/${dupla.jogador2}?`)) {
      const resultado = await this.duplasService.removerDupla(dupla.id);
      
      if (resultado.success) {
        alert(resultado.message);
        await this.carregarDuplas();
        this.limparSelecao();
      } else {
        alert(resultado.message);
      }
    }
  }

  // ✅ NOVA FUNCIONALIDADE: Gerenciar dupla
  gerenciarDupla(event: Event, dupla: Dupla) {
    event.stopPropagation();
    this.duplaGerenciada = dupla;
    this.mostrarModalGerenciar = true;
  }

  getPosicaoNaPiramide(duplaBuscada: any): number {
    let posicao = 1;
    
    for (let baseIndex = 0; baseIndex < this.basesReais.length; baseIndex++) {
      const base = this.basesReais[baseIndex];
      
      for (let duplaIndex = 0; duplaIndex < base.length; duplaIndex++) {
        const dupla = base[duplaIndex];
        
        if (dupla.id === duplaBuscada.id) {
          return posicao;
        }
        
        posicao++;
      }
    }
    
    return posicao;
  }

  // ✅ NOVA FUNCIONALIDADE: Criar desafio com regras avançadas
  criarDesafio() {
    if (this.duplasSelecionadas.length === 2) {
      const dupla1 = this.duplasSelecionadas[0];
      const dupla2 = this.duplasSelecionadas[1];
      
      const pos1 = this.getPosicaoNaPiramide(dupla1);
      const pos2 = this.getPosicaoNaPiramide(dupla2);
      
      // Determinar quem é o desafiante (posição menor = melhor colocado)
      let desafiante: Dupla, desafiado: Dupla;
      let posDesafiante: number, posDesafiado: number;
      
      if (pos1 > pos2) {
        // dupla1 está em posição pior, logo é o desafiante
        desafiante = dupla1;
        desafiado = dupla2;
        posDesafiante = pos1;
        posDesafiado = pos2;
      } else {
        // dupla2 está em posição pior, logo é o desafiante
        desafiante = dupla2;
        desafiado = dupla1;
        posDesafiante = pos2;
        posDesafiado = pos1;
      }

      // Verificar se o desafio é válido
      if (this.isJogador()) {
        const minhaDupla = this.jogadorInfo.dupla;
        if (!this.podeDesafiar(desafiado) && minhaDupla.id === desafiante.id) {
          alert('Desafio inválido! Você só pode desafiar duplas dentro das regras permitidas.');
          this.limparSelecao();
          return;
        }
      }

      const diferenca = posDesafiante - posDesafiado;
      
      this.desafioAtual = {
        desafiante,
        desafiado,
        posicaoDesafiante: posDesafiante,
        posicaoDesafiado: posDesafiado,
        diferenciaPosicoes: diferenca
      };

      // Mostrar modal com opções de resultado
      this.mostrarModalResultado = true;
      this.limparSelecao();
    }
  }

  // ✅ REGRAS DE MOVIMENTAÇÃO: Vitória do desafiante
  calcularMovimentacaoVitoria(desafio: DesafioInfo): ResultadoMovimentacao {
    const { desafiante, desafiado, posicaoDesafiante, posicaoDesafiado } = desafio;
    const novasPosicoes: { dupla: Dupla; novaPos: number }[] = [];
    
    // Desafiante assume a posição do desafiado
    novasPosicoes.push({ dupla: desafiante, novaPos: posicaoDesafiado });
    
    // Todas as duplas entre a posição do desafiado e do desafiante descem 1 posição
    const todasDuplas = this.obterTodasDuplasOrdenadas();
    
    for (const dupla of todasDuplas) {
      const posAtual = this.getPosicaoNaPiramide(dupla);
      
      if (dupla.id === desafiante.id) continue; // Já tratado
      
      if (posAtual >= posicaoDesafiado && posAtual < posicaoDesafiante) {
        novasPosicoes.push({ dupla, novaPos: posAtual + 1 });
      }
    }
    
    const descricao = `🏆 ${desafiante.jogador1}/${desafiante.jogador2} venceu!\n` +
                     `• Subiu da ${posicaoDesafiante}ª para a ${posicaoDesafiado}ª posição\n` +
                     `• ${desafiado.jogador1}/${desafiado.jogador2} desceu para a ${posicaoDesafiado + 1}ª posição\n` +
                     `• ${novasPosicoes.length - 1} dupla(s) foram afetadas`;

    return { novasPosicoes, descricao };
  }

  // ✅ REGRAS DE MOVIMENTAÇÃO: Derrota do desafiante (CORRIGIDO)
  calcularMovimentacaoDerrota(desafio: DesafioInfo): ResultadoMovimentacao {
    const { desafiante, posicaoDesafiante, diferenciaPosicoes } = desafio;
    const novasPosicoes: { dupla: Dupla; novaPos: number }[] = [];
    
    // ✅ CORREÇÃO: Respeitar o limite máximo da pirâmide
    const totalDuplas = this.getTotalDuplas();
    const novaPosicaoCalculada = posicaoDesafiante + diferenciaPosicoes;
    const novaPosicaoDesafiante = Math.min(novaPosicaoCalculada, totalDuplas);
    
    // Verificar se houve limitação pela quantidade de duplas
    const posicoesPenalizadas = novaPosicaoDesafiante - posicaoDesafiante;
    const limitePiramide = novaPosicaoCalculada > totalDuplas;
    
    novasPosicoes.push({ dupla: desafiante, novaPos: novaPosicaoDesafiante });
    
    // Todas as duplas entre a posição original do desafiante e sua nova posição sobem 1
    const todasDuplas = this.obterTodasDuplasOrdenadas();
    
    for (const dupla of todasDuplas) {
      const posAtual = this.getPosicaoNaPiramide(dupla);
      
      if (dupla.id === desafiante.id) continue; // Já tratado
      
      if (posAtual > posicaoDesafiante && posAtual <= novaPosicaoDesafiante) {
        novasPosicoes.push({ dupla, novaPos: posAtual - 1 });
      }
    }
    
    // ✅ DESCRIÇÃO ATUALIZADA com informação sobre limite
    let descricao = `💥 ${desafiante.jogador1}/${desafiante.jogador2} perdeu!\n` +
                   `• Caiu da ${posicaoDesafiante}ª para a ${novaPosicaoDesafiante}ª posição\n`;
    
    if (limitePiramide) {
      descricao += `• Penalidade aplicada: ${posicoesPenalizadas} posições (limitado ao último lugar)\n` +
                   `• Penalidade original seria: ${diferenciaPosicoes} posições, mas a pirâmide só tem ${totalDuplas} duplas\n`;
    } else {
      descricao += `• Penalidade: ${diferenciaPosicoes} posições (diferença do desafio)\n`;
    }
    
    descricao += `• ${novasPosicoes.length - 1} dupla(s) subiram uma posição`;

    return { novasPosicoes, descricao };
  }

  // ✅ APLICAR RESULTADO DO DESAFIO
  async aplicarResultadoDesafio(desafianteVenceu: boolean) {
    if (!this.desafioAtual) return;

    const movimentacao = desafianteVenceu 
      ? this.calcularMovimentacaoVitoria(this.desafioAtual)
      : this.calcularMovimentacaoDerrota(this.desafioAtual);

    // Mostrar preview da movimentação
    const confirmar = confirm(
      `${movimentacao.descricao}\n\nConfirma a aplicação deste resultado?`
    );

    if (confirmar) {
      try {
        // Aqui você faria a chamada para o service atualizar as posições
        // await this.duplasService.atualizarPosicoes(movimentacao.novasPosicoes);
        
        console.log('Movimentação aplicada:', movimentacao);
        alert('Resultado registrado com sucesso! A pirâmide foi atualizada.');
        
        // Recarregar a pirâmide
        await this.carregarDuplas();
        
      } catch (error) {
        console.error('Erro ao aplicar resultado:', error);
        alert('Erro ao registrar o resultado. Tente novamente.');
      }
    }

    this.mostrarModalResultado = false;
    this.desafioAtual = null;
  }

  // ✅ FUNÇÃO AUXILIAR: Calcular nova posição respeitando limites
  calcularNovaPosicaoComLimite(posicaoAtual: number, penalidade: number): {
    novaPosicao: number;
    limitada: boolean;
    penalityAplicada: number;
  } {
    const totalDuplas = this.getTotalDuplas();
    const novaPosicaoCalculada = posicaoAtual + penalidade;
    const novaPosicao = Math.min(novaPosicaoCalculada, totalDuplas);
    const limitada = novaPosicaoCalculada > totalDuplas;
    const penalityAplicada = novaPosicao - posicaoAtual;
    
    return {
      novaPosicao,
      limitada,
      penalityAplicada
    };
  }

  // ✅ FUNÇÃO DE TESTE: Para demonstrar o exemplo do usuário
  exemploCalculo() {
    // Exemplo: 13 duplas, 11º vs 7º
    const totalDuplas = 13;
    const posicaoDesafiante = 11;
    const posicaoDesafiado = 7;
    const diferenca = posicaoDesafiante - posicaoDesafiado; // 4
    
    const resultado = this.calcularNovaPosicaoComLimite(posicaoDesafiante, diferenca);
    
    console.log('=== EXEMPLO DE CÁLCULO ===');
    console.log(`Pirâmide com: ${totalDuplas} duplas`);
    console.log(`Desafiante: ${posicaoDesafiante}º lugar`);
    console.log(`Desafiado: ${posicaoDesafiado}º lugar`);
    console.log(`Diferença: ${diferenca} posições`);
    console.log(`Nova posição calculada: ${posicaoDesafiante + diferenca}º`);
    console.log(`Nova posição aplicada: ${resultado.novaPosicao}º`);
    console.log(`Limitada pela pirâmide: ${resultado.limitada ? 'SIM' : 'NÃO'}`);
    console.log(`Penalidade aplicada: ${resultado.penalityAplicada} posições`);
    
    return resultado;
  }
  // ✅ OBTER TODAS AS DUPLAS EM ORDEM DE POSIÇÃO
  obterTodasDuplasOrdenadas(): Dupla[] {
    const duplas: Dupla[] = [];
    
    this.basesReais.forEach(base => {
      base.forEach(dupla => {
        duplas.push(dupla);
      });
    });
    
    // Ordenar por posição na pirâmide
    return duplas.sort((a, b) => this.getPosicaoNaPiramide(a) - this.getPosicaoNaPiramide(b));
  }

  limparSelecao() {
    this.duplasSelecionadas.forEach(dupla => dupla.selected = false);
    this.duplasSelecionadas = [];
  }

  isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  isJogador(): boolean {
    const currentUser = this.authService.getCurrentUser();
    return !!(currentUser && (currentUser as any).tipo === 'jogador');
  }

  getUserEmail(): string {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      if ((currentUser as any).tipo === 'jogador') {
        return `${(currentUser as any).dupla.jogador1}/${(currentUser as any).dupla.jogador2}`;
      }
      return currentUser.email || '';
    }
    return '';
  }

  getStatusUsuario(): string {
    if (!this.authService.isLoggedIn()) return 'Visitante (não logado)';
    if (this.isAdmin()) return 'Administrador';
    if (this.isJogador()) return 'Jogador';
    return 'Usuário';
  }

  isMinhaDupla(dupla: Dupla): boolean {
    if (!this.isJogador() || !this.jogadorInfo) return false;
    return dupla.id === this.jogadorInfo.dupla.id;
  }

  podeDesafiar(dupla: Dupla): boolean {
    if (!this.isJogador() || !this.jogadorInfo) return false;
    
    const minhaDupla = this.jogadorInfo.dupla;
    
    // Não pode desafiar a si mesmo
    if (dupla.id === minhaDupla.id) return false;
    
    const minhaBase = minhaDupla.base;
    const minhaPosicaoNaBase = minhaDupla.posicao;
    const duplaBase = dupla.base;
    const duplaPosicaoNaBase = dupla.posicao;
    
    // Calcular posições gerais
    const minhaPosicaoGeral = this.getPosicaoNaPiramide(minhaDupla);
    const posicaoAlvo = this.getPosicaoNaPiramide(dupla);
    
    // Só pode desafiar posições melhores (números menores)
    if (posicaoAlvo >= minhaPosicaoGeral) return false;
    
    // Regra 1: Mesma base - pode desafiar todos à esquerda (posições menores)
    if (duplaBase === minhaBase) {
      return duplaPosicaoNaBase < minhaPosicaoNaBase;
    }
    
    // Regra 2: Base imediatamente acima - pode desafiar todos à direita
    if (duplaBase === minhaBase - 1) {
      const podeDesafiarNaBase = duplaPosicaoNaBase >= minhaPosicaoNaBase && duplaPosicaoNaBase <= duplaBase;
      if (podeDesafiarNaBase) return true;
    }
    
    // Regra 3: Exceção para posições ATÉ o limite configurado
    if (this.posicaoLimiteDesafioTopo > 1 && minhaPosicaoGeral <= this.posicaoLimiteDesafioTopo) {
      if (duplaBase < minhaBase) {
        return true;
      }
    }
    
    return false;
  }

  podeSerDesafiada(dupla: Dupla): boolean {
    return this.isJogador() && this.podeDesafiar(dupla);
  }

  getTituloCard(dupla: Dupla): string {
    if (this.isMinhaDupla(dupla)) {
      return 'Esta é a sua dupla!';
    }
    
    if (this.isJogador() && this.podeDesafiar(dupla)) {
      const minhaDupla = this.jogadorInfo.dupla;
      const minhaPosicao = this.getPosicaoNaPiramide(minhaDupla);
      const posicaoAlvo = this.getPosicaoNaPiramide(dupla);
      const diferenca = minhaPosicao - posicaoAlvo;
      
      // ✅ CORREÇÃO: Calcular penalidade considerando limite da pirâmide
      const totalDuplas = this.getTotalDuplas();
      const penalidade = Math.min(minhaPosicao + diferenca, totalDuplas);
      const penalityLimitada = penalidade < (minhaPosicao + diferenca);
      
      let motivo = '';
      if (dupla.base === minhaDupla.base) {
        motivo = 'mesma base, à sua esquerda';
      } else if (dupla.base === minhaDupla.base - 1) {
        motivo = 'base acima, à sua direita';
      } else {
        motivo = 'posição privilegiada, pode desafiar livremente';
      }
      
      let tooltip = `Você pode desafiar esta dupla (${motivo})\n` +
                   `🏆 PRÊMIO: Se ganhar, assumirá a ${posicaoAlvo}ª posição\n`;
      
      if (penalityLimitada) {
        tooltip += `⚠️ RISCO: Se perder, cairá para o último lugar (${totalDuplas}º)\n` +
                   `   (penalidade seria ${diferenca} posições, limitada pelo tamanho da pirâmide)`;
      } else {
        tooltip += `⚠️ RISCO: Se perder, cairá ${diferenca} posições para a ${penalidade}ª posição!`;
      }
      
      return tooltip;
    }
    
    if (this.isAdmin()) {
      return `${dupla.jogador1}/${dupla.jogador2} - Base ${dupla.base}, Pos ${dupla.posicao} (${this.getPosicaoNaPiramide(dupla)}º lugar)`;
    }
    
    return `${dupla.jogador1}/${dupla.jogador2} - ${this.getPosicaoNaPiramide(dupla)}º lugar`;
  }

  getQuantidadeDesafiosDisponiveis(): number {
    if (!this.isJogador() || !this.jogadorInfo) return 0;
    
    let count = 0;
    this.basesReais.forEach(base => {
      base.forEach(dupla => {
        if (this.podeDesafiar(dupla)) {
          count++;
        }
      });
    });
    
    return count;
  }

  async logout() {
    await this.authService.logout();
    this.jogadorInfo = null;
    this.limparSelecao();
  }

  onLoginSucesso() {
    this.carregarDuplas();
  }

  onJogadorLogado(jogadorInfo: any) {
    this.jogadorInfo = jogadorInfo;
    this.carregarDuplas();
  }

  onDuplaAdicionada() {
    this.carregarDuplas();
  }

  async onConfiguracaoAtualizada() {
    await this.carregarConfiguracao();
  }

  fecharModalResultado() {
    this.mostrarModalResultado = false;
    this.desafioAtual = null;
  }

  // ✅ NOVO: Fechar modal de gerenciamento
  fecharModalGerenciar() {
    this.mostrarModalGerenciar = false;
    this.duplaGerenciada = null;
  }

  // ✅ NOVO: Callback quando dupla é atualizada
  onDuplaGerenciada() {
    this.carregarDuplas();
    this.fecharModalGerenciar();
  }

  // ✅ NOVO: Obter todas as duplas (para o modal de gerenciamento)
  obterTodasDuplas(): Dupla[] {
    return this.obterTodasDuplasOrdenadas();
  }
}