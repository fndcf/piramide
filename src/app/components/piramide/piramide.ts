import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth';
import { DuplasService } from '../../services/duplas';
import { ConfiguracaoService } from '../../services/configuracao';
import { AdicionarDuplaComponent } from '../adicionar-dupla/adicionar-dupla';
import { LoginModalComponent } from '../login-modal/login-modal';
import { LoginJogadorModalComponent } from '../login-jogador-modal/login-jogador-modal';
import { ConfiguracaoModalComponent } from '../configuracao-modal/configuracao-modal';
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
  imports: [CommonModule, AdicionarDuplaComponent, LoginModalComponent, LoginJogadorModalComponent, ConfiguracaoModalComponent],
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
    // ✅ NOVA REGRA: Apenas administradores podem selecionar duplas para criar desafios
    if (!this.isAdmin()) {
      return; // Bloqueia a seleção para não-administradores
    }

    // ✅ VALIDAÇÃO: Se já temos uma dupla selecionada, validar se a segunda seleção é válida
    if (this.duplasSelecionadas.length === 1 && !dupla.selected) {
      const primeiraDupla = this.duplasSelecionadas[0];
      
      // Determinar quem seria o desafiante
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
      
      // Validar se o desafio seria válido
      const validacao = this.validarDesafio(desafiante, desafiado);
      
      if (!validacao.valido) {
        alert(`❌ Seleção Inválida!\n\n${validacao.motivo}\n\n${validacao.explicacao}`);
        return; // Não permite a seleção
      }
    }

    // Lógica original de seleção
    if (dupla.selected) {
      dupla.selected = false;
      this.duplasSelecionadas = this.duplasSelecionadas.filter(d => d.id !== dupla.id);
    } else {
      if (this.duplasSelecionadas.length < 2) {
        dupla.selected = true;
        this.duplasSelecionadas.push(dupla);
      } else {
        // Se já tem 2 selecionadas, substituir a primeira pela nova
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

  // ✅ FUNCIONALIDADE: Criar desafio com regras avançadas e validação
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

      // ✅ VALIDAÇÃO COMPLETA: Verificar se o desafio é válido conforme as regras
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

      // Mostrar modal com opções de resultado
      this.mostrarModalResultado = true;
      this.limparSelecao();
    }
  }

  // ✅ NOVA FUNCIONALIDADE: Validação completa das regras de desafio
  validarDesafio(desafiante: Dupla, desafiado: Dupla): { valido: boolean, motivo: string, explicacao: string } {
    const posDesafiante = this.getPosicaoNaPiramide(desafiante);
    const posDesafiado = this.getPosicaoNaPiramide(desafiado);
    
    // ❌ Regra 1: Não pode desafiar a si mesmo
    if (desafiante.id === desafiado.id) {
      return {
        valido: false,
        motivo: "Uma dupla não pode desafiar a si mesma",
        explicacao: "Selecione duas duplas diferentes para criar um desafio."
      };
    }
    
    // ❌ Regra 2: Só pode desafiar posições melhores (números menores)
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

    // ✅ Regra 3: Mesma base - pode desafiar todos à esquerda (posições menores)
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
    
    // ✅ Regra 4: Base imediatamente acima - pode desafiar todos à direita
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
    
    // ✅ Regra 5: Exceção para posições ATÉ o limite configurado
    if (this.posicaoLimiteDesafioTopo > 1 && posDesafiante <= this.posicaoLimiteDesafioTopo) {
      if (baseDesafiado < baseDesafiante) {
        return {
          valido: true,
          motivo: "Desafio válido por posição privilegiada",
          explicacao: `${desafiante.jogador1}/${desafiante.jogador2} (${posDesafiante}º lugar) tem privilégio especial e pode desafiar até o topo da pirâmide.`
        };
      }
    }
    
    // ❌ Todas as outras situações são inválidas
    let explicacaoDetalhada = `${desafiante.jogador1}/${desafiante.jogador2} (base ${baseDesafiante}, ${posDesafiante}º geral) não pode desafiar ${desafiado.jogador1}/${desafiado.jogador2} (base ${baseDesafiado}, ${posDesafiado}º geral).\n\n`;
    
    explicacaoDetalhada += "📋 Regras permitidas:\n";
    explicacaoDetalhada += `• Mesma base (${baseDesafiante}): posições 1 a ${posicaoDesafiante - 1}\n`;
    explicacaoDetalhada += `• Base acima (${baseDesafiante - 1}): posições ${posicaoDesafiante} a ${baseDesafiante - 1}\n`;
    
    if (this.posicaoLimiteDesafioTopo > 1 && posDesafiante <= this.posicaoLimiteDesafioTopo) {
      explicacaoDetalhada += `• Posição privilegiada: pode desafiar qualquer dupla até o topo\n`;
    } else if (this.posicaoLimiteDesafioTopo > 1) {
      explicacaoDetalhada += `• Para ter privilégio especial, precisa estar entre o 2º e ${this.posicaoLimiteDesafioTopo}º lugar\n`;
    }

    return {
      valido: false,
      motivo: "Desafio não permitido pelas regras da pirâmide",
      explicacao: explicacaoDetalhada
    };
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
        console.log('🎯 Aplicando resultado do desafio...');
        
        // 1. Atualizar posições das duplas
        const resultadoPosicoes = await this.duplasService.atualizarPosicoes(movimentacao.novasPosicoes);
        
        if (!resultadoPosicoes.success) {
          alert(`Erro ao atualizar posições: ${resultadoPosicoes.message}`);
          return;
        }

        // 2. Registrar estatísticas do jogo
        const vencedorId = desafianteVenceu ? this.desafioAtual.desafiante.id : this.desafioAtual.desafiado.id;
        const perdedorId = desafianteVenceu ? this.desafioAtual.desafiado.id : this.desafioAtual.desafiante.id;
        
        const resultadoEstatisticas = await this.duplasService.registrarResultadoJogo(vencedorId, perdedorId);
        
        if (!resultadoEstatisticas.success) {
          console.warn('Aviso ao atualizar estatísticas:', resultadoEstatisticas.message);
        }

        // 3. Mostrar mensagem de sucesso
        const vencedor = desafianteVenceu ? this.desafioAtual.desafiante : this.desafioAtual.desafiado;
        alert(`🏆 Resultado registrado com sucesso!\n\n${vencedor.jogador1}/${vencedor.jogador2} venceu o desafio!\nA pirâmide foi atualizada automaticamente.`);
        
        // 4. Recarregar a pirâmide para mostrar as mudanças
        await this.carregarDuplas();
        
      } catch (error) {
        console.error('❌ Erro ao aplicar resultado:', error);
        alert('Erro ao registrar o resultado. Tente novamente.');
      }
    }

    this.mostrarModalResultado = false;
    this.desafioAtual = null;
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
    // ✅ NOVA FUNCIONALIDADE: Tooltips específicos para administradores
    if (this.isAdmin()) {
      // ✅ VALIDAÇÃO PARA ADMIN: Mostrar dicas de seleção quando há uma dupla já selecionada
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
          return `✅ SELEÇÃO VÁLIDA PARA DESAFIO\n\n${validacao.explicacao}\n\nClique para criar: ${desafiante.jogador1}/${desafiante.jogador2} vs ${desafiado.jogador1}/${desafiado.jogador2}`;
        } else {
          return `❌ SELEÇÃO INVÁLIDA PARA DESAFIO\n\n${validacao.motivo}\n\n${validacao.explicacao}`;
        }
      }

      // Status de seleção para admin
      const statusSelecao = this.duplasSelecionadas.length === 0 ? 
        'Clique para selecionar e criar desafios' : 
        this.duplasSelecionadas.length === 1 ? 
          'Clique para fazer o segundo par do desafio' : 
          'Máximo de 2 duplas selecionadas';
          
      return `👑 ADMIN - ${dupla.jogador1}/${dupla.jogador2}\nBase ${dupla.base}, Pos ${dupla.posicao} (${this.getPosicaoNaPiramide(dupla)}º lugar)\n\n${statusSelecao}`;
    }

    // ✅ TOOLTIPS PARA JOGADORES: Apenas informativos, sem opção de seleção
    if (this.isMinhaDupla(dupla)) {
      return `🏐 Esta é a sua dupla!\n\nPosição: ${this.getPosicaoNaPiramide(dupla)}º lugar\nBase: ${dupla.base}, Posição: ${dupla.posicao}\nEstatísticas: ${dupla.vitorias}V - ${dupla.derrotas}D\n\n📋 Apenas administradores podem criar desafios`;
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
      
      let tooltip = `🎯 DUPLA DESAFIÁVEL (${motivo})\n\n` +
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
    
    // ✅ TOOLTIPS PARA VISITANTES: Apenas informativos
    if (!this.authService.isLoggedIn()) {
      return `${dupla.jogador1}/${dupla.jogador2} - ${this.getPosicaoNaPiramide(dupla)}º lugar\n\nFaça login para ver mais informações`;
    }
    
    // ✅ TOOLTIPS PARA JOGADORES EM OUTRAS DUPLAS: Informativos
    return `${dupla.jogador1}/${dupla.jogador2} - ${this.getPosicaoNaPiramide(dupla)}º lugar\nBase ${dupla.base}, Posição ${dupla.posicao}\nEstatísticas: ${dupla.vitorias}V - ${dupla.derrotas}D`;
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
    // ✅ NOVO: Limpar seleções quando fizer logout
    this.limparSelecao();
  }

  onLoginSucesso() {
    // ✅ NOVO: Limpar seleções quando fizer login
    this.limparSelecao();
    this.carregarDuplas();
  }

  onJogadorLogado(jogadorInfo: any) {
    this.jogadorInfo = jogadorInfo;
    // ✅ NOVO: Limpar seleções quando jogador fizer login
    this.limparSelecao();
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

  // ✅ NOVAS FUNCIONALIDADES AUXILIARES: Para o preview do desafio
  getDuplaDesafiante(): Dupla {
    if (this.duplasSelecionadas.length !== 2) return this.duplasSelecionadas[0];
    
    const pos1 = this.getPosicaoNaPiramide(this.duplasSelecionadas[0]);
    const pos2 = this.getPosicaoNaPiramide(this.duplasSelecionadas[1]);
    
    // Desafiante é quem está em posição pior (número maior)
    return pos1 > pos2 ? this.duplasSelecionadas[0] : this.duplasSelecionadas[1];
  }

  getDuplaDesafiado(): Dupla {
    if (this.duplasSelecionadas.length !== 2) return this.duplasSelecionadas[0];
    
    const pos1 = this.getPosicaoNaPiramide(this.duplasSelecionadas[0]);
    const pos2 = this.getPosicaoNaPiramide(this.duplasSelecionadas[1]);
    
    // Desafiado é quem está em posição melhor (número menor)
    return pos1 > pos2 ? this.duplasSelecionadas[1] : this.duplasSelecionadas[0];
  }

  // ✅ Expor Math para o template
  Math = Math;
}