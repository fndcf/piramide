// src/app/components/piramide/piramide.ts - VERSÃO COMPLETA PARA MÚLTIPLAS PIRÂMIDES

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth';
import { DuplasService } from '../../services/duplas';
import { ConfiguracaoService } from '../../services/configuracao';
import { PiramidesService } from '../../services/piramides';
import { AdicionarDuplaComponent } from '../adicionar-dupla/adicionar-dupla';
import { LoginModalComponent } from '../login-modal/login-modal';
import { LoginJogadorModalComponent } from '../login-jogador-modal/login-jogador-modal';
import { ConfiguracaoModalComponent } from '../configuracao-modal/configuracao-modal';
import { SeletorPiramideComponent } from '../seletor-piramide/seletor-piramide';
import { Dupla } from '../../models/dupla.model';
import { Piramide } from '../../models/piramide.model';
import { GerenciarPiramidesComponent } from '../gerenciar-piramides/gerenciar-piramides';

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
  imports: [
    CommonModule, 
    AdicionarDuplaComponent, 
    LoginModalComponent, 
    LoginJogadorModalComponent, 
    ConfiguracaoModalComponent,
    GerenciarPiramidesComponent,
    SeletorPiramideComponent
  ],
  templateUrl: './piramide.html',
  styleUrls: ['./piramide.scss']
})
export class PiramideComponent implements OnInit, OnDestroy {
  // ========== ESTADO ATUAL ==========
  piramideAtual: Piramide | null = null;
  duplasSelecionadas: Dupla[] = [];
  basesReais: Dupla[][] = [];
  carregando = true;
  jogadorInfo: any = null;
  posicaoLimiteDesafioTopo = 5;
  
  // ========== MODAIS ==========
  mostrarModalAdicionar = false;
  mostrarModalLogin = false;
  mostrarModalJogador = false;
  mostrarModalConfig = false;
  mostrarModalGerenciarPiramides = false;
  mostrarModalResultado = false;
  desafioAtual: DesafioInfo | null = null;

  // ========== SUBSCRIPTIONS ==========
  private subscriptions: Subscription[] = [];

  constructor(
    public authService: AuthService,
    private duplasService: DuplasService,
    private configuracaoService: ConfiguracaoService,
    private piramidesService: PiramidesService
  ) {}

  async ngOnInit() {
    // Subscribir para mudanças na pirâmide atual
    const piramideSub = this.piramidesService.piramideAtual$.subscribe(piramide => {
      this.piramideAtual = piramide;
      if (piramide) {
        this.carregarDadosPiramide();
      }
    });
    this.subscriptions.push(piramideSub);

    // Carregar dados iniciais
    await this.inicializar();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private async inicializar() {
    this.carregando = true;
    
    try {
      // Garantir que há uma pirâmide selecionada
      this.piramideAtual = this.piramidesService.getPiramideAtual();
      
      if (!this.piramideAtual) {
        // Se não há pirâmide, abrir modal de gerenciamento
        this.mostrarModalGerenciarPiramides = true;
        this.carregando = false;
        return;
      }

      await this.carregarDadosPiramide();
      this.verificarSessaoJogador();
    } catch (error) {
      console.error('Erro ao inicializar:', error);
    }
    
    this.carregando = false;
  }

  private async carregarDadosPiramide() {
    if (!this.piramideAtual) return;

    try {
      // Carregar duplas da pirâmide atual
      this.basesReais = await this.duplasService.obterDuplasOrganizadas(this.piramideAtual.id);
      
      // Limpar seleções
      this.basesReais.forEach(base => {
        base.forEach(dupla => {
          dupla.selected = false;
        });
      });
      this.duplasSelecionadas = [];

      // Carregar configuração da pirâmide
      this.posicaoLimiteDesafioTopo = this.piramideAtual.configuracao.posicaoLimiteDesafioTopo;
      
    } catch (error) {
      console.error('Erro ao carregar dados da pirâmide:', error);
    }
  }

  verificarSessaoJogador() {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser && (currentUser as any).tipo === 'jogador') {
      this.jogadorInfo = currentUser;
      
      // Verificar se o jogador está na pirâmide atual
      if (this.piramideAtual && this.jogadorInfo.dupla.piramideId !== this.piramideAtual.id) {
        // Jogador não está na pirâmide atual, mostrar aviso
        this.mostrarAvisoPiramideDiferente();
      }
    }
  }

  private mostrarAvisoPiramideDiferente() {
    const confirmar = confirm(
      'Você está logado em uma dupla de outra pirâmide.\n\n' +
      'Deseja continuar visualizando esta pirâmide ou voltar para sua pirâmide?'
    );
    
    if (!confirmar) {
      // Tentar mudar para a pirâmide do jogador
      this.piramidesService.selecionarPiramide(this.jogadorInfo.dupla.piramideId);
    }
  }

  // ========== INTERFACE DA PIRÂMIDE ==========

  async carregarDuplas() {
    await this.carregarDadosPiramide();
  }

  getSlots(baseNumber: number, duplasExistentes: number): any[] {
    const slotsVazios = baseNumber - duplasExistentes;
    return new Array(Math.max(0, slotsVazios)).fill(null);
  }

  getTotalDuplas(): number {
    return this.basesReais.reduce((total, base) => total + base.length, 0);
  }

  getTotalVagas(): number {
    const maxDuplas = this.piramideAtual?.maxDuplas || 45;
    return maxDuplas - this.getTotalDuplas();
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

  // ========== GESTÃO DE MÚLTIPLAS PIRÂMIDES ==========

  getNomePiramideAtual(): string {
    return this.piramideAtual?.nome || 'Nenhuma pirâmide selecionada';
  }

  getCorPiramideAtual(): string {
    return this.piramideAtual?.cor || '#667eea';
  }

  getIconePiramideAtual(): string {
    return this.piramideAtual?.icone || '🏆';
  }

  getStatusPiramideAtual(): string {
    if (!this.piramideAtual) return 'Não selecionada';
    
    const status = {
      'ativa': 'Ativa',
      'pausada': 'Pausada',
      'finalizada': 'Finalizada',
      'arquivada': 'Arquivada'
    };
    
    return status[this.piramideAtual.status as keyof typeof status] || this.piramideAtual.status;
  }

  isPiramideAtiva(): boolean {
    return this.piramideAtual?.status === 'ativa';
  }

  onPiramideSelecionada(piramide: Piramide) {
    // A pirâmide já foi selecionada pelo service, apenas recarregar
    this.carregarDadosPiramide();
  }

  onPiramideSelecionadaVisitante(piramide: Piramide) {
    // Método específico para visitantes
    this.carregarDadosPiramide();
  }

  // ========== SELEÇÃO E DESAFIOS ==========

  selecionarDupla(dupla: Dupla) {
    if (!this.isAdmin()) {
      return;
    }

    if (!this.isPiramideAtiva()) {
      alert('Não é possível criar desafios em uma pirâmide pausada ou finalizada.');
      return;
    }

    // Validação de desafio
    if (this.duplasSelecionadas.length === 1 && !dupla.selected) {
      const primeiraDupla = this.duplasSelecionadas[0];
      const pos1 = this.getPosicaoNaPiramide(primeiraDupla);
      const pos2 = this.getPosicaoNaPiramide(dupla);
      
      let desafiante: Dupla, desafiado: Dupla;
      
      if (pos1 > pos2) {
        desafiante = primeiraDupla;
        desafiado = dupla;
      } else {
        desafiante = dupla;
        desafiado = primeiraDupla;
      }
      
      const validacao = this.validarDesafio(desafiante, desafiado);
      
      if (!validacao.valido) {
        alert(`❌ Seleção Inválida!\n\n${validacao.motivo}\n\n${validacao.explicacao}`);
        return;
      }
    }

    // Lógica de seleção
    if (dupla.selected) {
      dupla.selected = false;
      this.duplasSelecionadas = this.duplasSelecionadas.filter(d => d.id !== dupla.id);
    } else {
      if (this.duplasSelecionadas.length < 2) {
        dupla.selected = true;
        this.duplasSelecionadas.push(dupla);
      } else {
        const primeiraSelecionada = this.duplasSelecionadas[0];
        primeiraSelecionada.selected = false;
        
        this.duplasSelecionadas = [this.duplasSelecionadas[1]];
        dupla.selected = true;
        this.duplasSelecionadas.push(dupla);
      }
    }
  }

  async removerDupla(event: Event, dupla: Dupla) {
    event.stopPropagation();
    
    if (!this.isPiramideAtiva()) {
      alert('Não é possível remover duplas de uma pirâmide pausada ou finalizada.');
      return;
    }
    
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

  // ========== VALIDAÇÃO E LÓGICA DE DESAFIOS ==========

  validarDesafio(desafiante: Dupla, desafiado: Dupla): { valido: boolean, motivo: string, explicacao: string } {
    const posDesafiante = this.getPosicaoNaPiramide(desafiante);
    const posDesafiado = this.getPosicaoNaPiramide(desafiado);
    
    if (desafiante.id === desafiado.id) {
      return {
        valido: false,
        motivo: "Uma dupla não pode desafiar a si mesma",
        explicacao: "Selecione duas duplas diferentes para criar um desafio."
      };
    }
    
    if (posDesafiado >= posDesafiante) {
      return {
        valido: false,
        motivo: "Só é possível desafiar duplas em posições superiores",
        explicacao: `${desafiante.jogador1}/${desafiante.jogador2} (${posDesafiante}º) não pode desafiar ${desafiado.jogador1}/${desafiado.jogador2} (${posDesafiado}º).`
      };
    }

    const baseDesafiante = desafiante.base;
    const posicaoDesafiante = desafiante.posicao;
    const baseDesafiado = desafiado.base;
    const posicaoDesafiado = desafiado.posicao;

    // Regra: Mesma base - pode desafiar todos à esquerda
    if (baseDesafiado === baseDesafiante) {
      if (posicaoDesafiado < posicaoDesafiante) {
        return {
          valido: true,
          motivo: "Desafio válido na mesma base",
          explicacao: `${desafiante.jogador1}/${desafiante.jogador2} pode desafiar duplas à sua esquerda na mesma base.`
        };
      } else {
        return {
          valido: false,
          motivo: "Na mesma base, só pode desafiar duplas à esquerda",
          explicacao: `${desafiante.jogador1}/${desafiante.jogador2} (base ${baseDesafiante}, pos ${posicaoDesafiante}) só pode desafiar duplas nas posições 1 a ${posicaoDesafiante - 1} da base ${baseDesafiante}.`
        };
      }
    }
    
    // Regra: Base imediatamente acima - pode desafiar todos à direita
    if (baseDesafiado === baseDesafiante - 1) {
      const podeDesafiarNaBase = posicaoDesafiado >= posicaoDesafiante && posicaoDesafiado <= baseDesafiado;
      if (podeDesafiarNaBase) {
        return {
          valido: true,
          motivo: "Desafio válido na base acima",
          explicacao: `${desafiante.jogador1}/${desafiante.jogador2} pode desafiar duplas à sua direita na base ${baseDesafiado}.`
        };
      } else {
        return {
          valido: false,
          motivo: "Na base acima, só pode desafiar duplas à direita ou alinhadas",
          explicacao: `${desafiante.jogador1}/${desafiante.jogador2} (pos ${posicaoDesafiante}) só pode desafiar posições ${posicaoDesafiante} a ${baseDesafiado} da base ${baseDesafiado}.`
        };
      }
    }
    
    // Regra: Exceção para posições privilegiadas
    if (this.posicaoLimiteDesafioTopo > 1 && posDesafiante <= this.posicaoLimiteDesafioTopo) {
      if (baseDesafiado < baseDesafiante) {
        return {
          valido: true,
          motivo: "Desafio válido por posição privilegiada",
          explicacao: `${desafiante.jogador1}/${desafiante.jogador2} (${posDesafiante}º lugar) tem privilégio especial e pode desafiar até o topo da pirâmide.`
        };
      }
    }
    
    return {
      valido: false,
      motivo: "Desafio não permitido pelas regras da pirâmide",
      explicacao: `Consulte as regras da pirâmide "${this.piramideAtual?.nome}" para mais detalhes.`
    };
  }

  // ========== MÉTODOS DE DESAFIO E RESULTADO ==========

  criarDesafio() {
    if (!this.isPiramideAtiva()) {
      alert('Não é possível criar desafios em uma pirâmide pausada ou finalizada.');
      return;
    }

    if (this.duplasSelecionadas.length === 2) {
      const dupla1 = this.duplasSelecionadas[0];
      const dupla2 = this.duplasSelecionadas[1];
      
      const pos1 = this.getPosicaoNaPiramide(dupla1);
      const pos2 = this.getPosicaoNaPiramide(dupla2);
      
      let desafiante: Dupla, desafiado: Dupla;
      let posDesafiante: number, posDesafiado: number;
      
      if (pos1 > pos2) {
        desafiante = dupla1;
        desafiado = dupla2;
        posDesafiante = pos1;
        posDesafiado = pos2;
      } else {
        desafiante = dupla2;
        desafiado = dupla1;
        posDesafiante = pos2;
        posDesafiado = pos1;
      }

      const validacao = this.validarDesafio(desafiante, desafiado);
      
      if (!validacao.valido) {
        alert(`❌ Desafio Inválido!\n\n${validacao.motivo}\n\n${validacao.explicacao}`);
        this.limparSelecao();
        return;
      }

      const diferenca = posDesafiante - posDesafiado;
      
      this.desafioAtual = {
        desafiante,
        desafiado,
        posicaoDesafiante: posDesafiante,
        posicaoDesafiado: posDesafiado,
        diferenciaPosicoes: diferenca
      };

      this.mostrarModalResultado = true;
      this.limparSelecao();
    }
  }

  calcularMovimentacaoVitoria(desafio: DesafioInfo): ResultadoMovimentacao {
    const { desafiante, desafiado, posicaoDesafiante, posicaoDesafiado } = desafio;
    const novasPosicoes: { dupla: Dupla; novaPos: number }[] = [];
    
    novasPosicoes.push({ dupla: desafiante, novaPos: posicaoDesafiado });
    
    const todasDuplas = this.obterTodasDuplasOrdenadas();
    
    for (const dupla of todasDuplas) {
      const posAtual = this.getPosicaoNaPiramide(dupla);
      
      if (dupla.id === desafiante.id) continue;
      
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

  calcularMovimentacaoDerrota(desafio: DesafioInfo): ResultadoMovimentacao {
    const { desafiante, posicaoDesafiante, diferenciaPosicoes } = desafio;
    const novasPosicoes: { dupla: Dupla; novaPos: number }[] = [];
    
    const totalDuplas = this.getTotalDuplas();
    const novaPosicaoCalculada = posicaoDesafiante + diferenciaPosicoes;
    const novaPosicaoDesafiante = Math.min(novaPosicaoCalculada, totalDuplas);
    
    const posicoesPenalizadas = novaPosicaoDesafiante - posicaoDesafiante;
    const limitePiramide = novaPosicaoCalculada > totalDuplas;
    
    novasPosicoes.push({ dupla: desafiante, novaPos: novaPosicaoDesafiante });
    
    const todasDuplas = this.obterTodasDuplasOrdenadas();
    
    for (const dupla of todasDuplas) {
      const posAtual = this.getPosicaoNaPiramide(dupla);
      
      if (dupla.id === desafiante.id) continue;
      
      if (posAtual > posicaoDesafiante && posAtual <= novaPosicaoDesafiante) {
        novasPosicoes.push({ dupla, novaPos: posAtual - 1 });
      }
    }
    
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

  async aplicarResultadoDesafio(desafianteVenceu: boolean) {
    if (!this.desafioAtual) return;

    const movimentacao = desafianteVenceu 
      ? this.calcularMovimentacaoVitoria(this.desafioAtual)
      : this.calcularMovimentacaoDerrota(this.desafioAtual);

    const confirmar = confirm(
      `${movimentacao.descricao}\n\nConfirma a aplicação deste resultado?`
    );

    if (confirmar) {
      try {
        console.log('🎯 Aplicando resultado do desafio...');
        
        const resultadoPosicoes = await this.duplasService.atualizarPosicoes(movimentacao.novasPosicoes);
        
        if (!resultadoPosicoes.success) {
          alert(`Erro ao atualizar posições: ${resultadoPosicoes.message}`);
          return;
        }

        const vencedorId = desafianteVenceu ? this.desafioAtual.desafiante.id : this.desafioAtual.desafiado.id;
        const perdedorId = desafianteVenceu ? this.desafioAtual.desafiado.id : this.desafioAtual.desafiante.id;
        
        const resultadoEstatisticas = await this.duplasService.registrarResultadoJogo(vencedorId, perdedorId);
        
        if (!resultadoEstatisticas.success) {
          console.warn('Aviso ao atualizar estatísticas:', resultadoEstatisticas.message);
        }

        const vencedor = desafianteVenceu ? this.desafioAtual.desafiante : this.desafioAtual.desafiado;
        alert(`🏆 Resultado registrado com sucesso!\n\n${vencedor.jogador1}/${vencedor.jogador2} venceu o desafio!\nA pirâmide foi atualizada automaticamente.`);
        
        await this.carregarDuplas();
        
      } catch (error) {
        console.error('❌ Erro ao aplicar resultado:', error);
        alert('Erro ao registrar o resultado. Tente novamente.');
      }
    }

    this.mostrarModalResultado = false;
    this.desafioAtual = null;
  }

  obterTodasDuplasOrdenadas(): Dupla[] {
    const duplas: Dupla[] = [];
    
    this.basesReais.forEach(base => {
      base.forEach(dupla => {
        duplas.push(dupla);
      });
    });
    
    return duplas.sort((a, b) => this.getPosicaoNaPiramide(a) - this.getPosicaoNaPiramide(b));
  }

  limparSelecao() {
    this.duplasSelecionadas.forEach(dupla => dupla.selected = false);
    this.duplasSelecionadas = [];
  }

  // ========== MÉTODOS DE INTERFACE ==========

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
    if (this.isAdmin()) return `Administrador - ${this.getNomePiramideAtual()}`;
    if (this.isJogador()) return `Jogador - ${this.getNomePiramideAtual()}`;
    return 'Usuário';
  }

  isMinhaDupla(dupla: Dupla): boolean {
    if (!this.isJogador() || !this.jogadorInfo) return false;
    return dupla.id === this.jogadorInfo.dupla.id;
  }

  podeDesafiar(dupla: Dupla): boolean {
    if (!this.isJogador() || !this.jogadorInfo || !this.piramideAtual) return false;
    
    // Verificar se o jogador está na mesma pirâmide
    if (this.jogadorInfo.dupla.piramideId !== this.piramideAtual.id) return false;
    
    const minhaDupla = this.jogadorInfo.dupla;
    
    if (dupla.id === minhaDupla.id) return false;
    
    const minhaBase = minhaDupla.base;
    const minhaPosicaoNaBase = minhaDupla.posicao;
    const duplaBase = dupla.base;
    const duplaPosicaoNaBase = dupla.posicao;
    
    const minhaPosicaoGeral = this.getPosicaoNaPiramide(minhaDupla);
    const posicaoAlvo = this.getPosicaoNaPiramide(dupla);
    
    if (posicaoAlvo >= minhaPosicaoGeral) return false;
    
    // Aplicar regras específicas da pirâmide
    const config = this.piramideAtual.configuracao;
    
    if (duplaBase === minhaBase) {
      return duplaPosicaoNaBase < minhaPosicaoNaBase;
    }
    
    if (duplaBase === minhaBase - 1) {
      const podeDesafiarNaBase = duplaPosicaoNaBase >= minhaPosicaoNaBase && duplaPosicaoNaBase <= duplaBase;
      if (podeDesafiarNaBase) return true;
    }
    
    if (config.posicaoLimiteDesafioTopo > 1 && minhaPosicaoGeral <= config.posicaoLimiteDesafioTopo) {
      if (duplaBase < minhaBase) {
        return true;
      }
    }
    
    return false;
  }

  getTituloCard(dupla: Dupla): string {
    const piramideInfo = this.piramideAtual ? ` (${this.piramideAtual.nome})` : '';
    
    if (this.isAdmin()) {
      if (this.duplasSelecionadas.length === 1 && !dupla.selected) {
        const primeiraDupla = this.duplasSelecionadas[0];
        const pos1 = this.getPosicaoNaPiramide(primeiraDupla);
        const pos2 = this.getPosicaoNaPiramide(dupla);
        
        let desafiante: Dupla, desafiado: Dupla;
        
        if (pos1 > pos2) {
          desafiante = primeiraDupla;
          desafiado = dupla;
        } else {
          desafiante = dupla;
          desafiado = primeiraDupla;
        }
        
        const validacao = this.validarDesafio(desafiante, desafiado);
        
        if (validacao.valido) {
          return `✅ SELEÇÃO VÁLIDA PARA DESAFIO${piramideInfo}\n\n${validacao.explicacao}\n\nClique para criar: ${desafiante.jogador1}/${desafiante.jogador2} vs ${desafiado.jogador1}/${desafiado.jogador2}`;
        } else {
          return `❌ SELEÇÃO INVÁLIDA PARA DESAFIO${piramideInfo}\n\n${validacao.motivo}\n\n${validacao.explicacao}`;
        }
      }

      const statusSelecao = this.duplasSelecionadas.length === 0 ? 
        'Clique para selecionar e criar desafios' : 
        this.duplasSelecionadas.length === 1 ? 
          'Clique para fazer o segundo par do desafio' : 
          'Máximo de 2 duplas selecionadas';
          
      return `👑 ADMIN - ${dupla.jogador1}/${dupla.jogador2}${piramideInfo}\nBase ${dupla.base}, Pos ${dupla.posicao} (${this.getPosicaoNaPiramide(dupla)}º lugar)\n\n${statusSelecao}`;
    }

    if (this.isMinhaDupla(dupla)) {
      return `🏐 Esta é a sua dupla!${piramideInfo}\n\nPosição: ${this.getPosicaoNaPiramide(dupla)}º lugar\nBase: ${dupla.base}, Posição: ${dupla.posicao}\nEstatísticas: ${dupla.vitorias}V - ${dupla.derrotas}D\n\n📋 Apenas administradores podem criar desafios`;
    }
    
    if (this.isJogador() && this.podeDesafiar(dupla)) {
      const minhaDupla = this.jogadorInfo.dupla;
      const minhaPosicao = this.getPosicaoNaPiramide(minhaDupla);
      const posicaoAlvo = this.getPosicaoNaPiramide(dupla);
      const diferenca = minhaPosicao - posicaoAlvo;
      
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
      
      let tooltip = `🎯 DUPLA DESAFIÁVEL${piramideInfo} (${motivo})\n\n` +
                   `🏆 SE VENCER: Assumirá a ${posicaoAlvo}ª posição\n`;
      
      if (penalityLimitada) {
        tooltip += `⚠️ SE PERDER: Cairá para o último lugar (${totalDuplas}º)\n` +
                   `   (penalidade seria ${diferenca} posições, limitada pelo tamanho da pirâmide)\n\n`;
      } else {
        tooltip += `⚠️ SE PERDER: Cairá ${diferenca} posições para a ${penalidade}ª posição!\n\n`;
      }
      
      tooltip += `📋 Apenas administradores podem criar desafios`;
      
      return tooltip;
    }
    
    if (!this.authService.isLoggedIn()) {
      return `${dupla.jogador1}/${dupla.jogador2}${piramideInfo} - ${this.getPosicaoNaPiramide(dupla)}º lugar\n\nFaça login para ver mais informações`;
    }
    
    return `${dupla.jogador1}/${dupla.jogador2}${piramideInfo} - ${this.getPosicaoNaPiramide(dupla)}º lugar\nBase ${dupla.base}, Posição ${dupla.posicao}\nEstatísticas: ${dupla.vitorias}V - ${dupla.derrotas}D`;
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

  // ========== MÉTODOS DE EVENTO ==========

  async logout() {
    await this.authService.logout();
    this.jogadorInfo = null;
    this.limparSelecao();
  }

  onLoginSucesso() {
    this.limparSelecao();
    this.carregarDuplas();
  }

  onJogadorLogado(jogadorInfo: any) {
    this.jogadorInfo = jogadorInfo;
    this.limparSelecao();
    
    // Verificar se o jogador está na pirâmide atual
    if (this.piramideAtual && jogadorInfo.dupla.piramideId !== this.piramideAtual.id) {
      this.mostrarAvisoPiramideDiferente();
    }
    
    this.carregarDuplas();
  }

  onDuplaAdicionada() {
    this.carregarDuplas();
  }

  async onConfiguracaoAtualizada() {
    if (this.piramideAtual) {
      // Recarregar configuração da pirâmide atual
      const piramides = await this.piramidesService.obterPiramides();
      const piramideAtualizada = piramides.find(p => p.id === this.piramideAtual!.id);
      if (piramideAtualizada) {
        this.piramideAtual = piramideAtualizada;
        this.posicaoLimiteDesafioTopo = piramideAtualizada.configuracao.posicaoLimiteDesafioTopo;
      }
    }
  }

  fecharModalResultado() {
    this.mostrarModalResultado = false;
    this.desafioAtual = null;
  }

  getDuplaDesafiante(): Dupla {
    if (this.duplasSelecionadas.length !== 2) return this.duplasSelecionadas[0];
    
    const pos1 = this.getPosicaoNaPiramide(this.duplasSelecionadas[0]);
    const pos2 = this.getPosicaoNaPiramide(this.duplasSelecionadas[1]);
    
    return pos1 > pos2 ? this.duplasSelecionadas[0] : this.duplasSelecionadas[1];
  }

  getDuplaDesafiado(): Dupla {
    if (this.duplasSelecionadas.length !== 2) return this.duplasSelecionadas[0];
    
    const pos1 = this.getPosicaoNaPiramide(this.duplasSelecionadas[0]);
    const pos2 = this.getPosicaoNaPiramide(this.duplasSelecionadas[1]);
    
    return pos1 > pos2 ? this.duplasSelecionadas[1] : this.duplasSelecionadas[0];
  }

  // Expor Math para o template
  Math = Math;
}