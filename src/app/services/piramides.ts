// src/app/services/piramides.ts - ATUALIZADO COM MELHORIAS

import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { 
  Piramide, 
  NovaPiramide, 
  ConfiguracaoPiramideEspecifica
} from '../models/piramide.model';
import { EstatisticasPiramide, PiramideSeletor, TransferenciaDupla } from '../models/dupla.model';

@Injectable({
  providedIn: 'root'
})
export class PiramidesService {
  private piramides: Piramide[] = [];
  private piramideAtual: Piramide | null = null;
  private piramideAtualSubject = new BehaviorSubject<Piramide | null>(null);
  
  public piramideAtual$ = this.piramideAtualSubject.asObservable();
  
  constructor() {
    this.inicializarDados();
  }

  private inicializarDados() {
    // Verificar se há dados salvos
    const piramidesSalvas = localStorage.getItem('piramides');
    const piramideAtualId = localStorage.getItem('piramideAtualId');
    
    if (piramidesSalvas) {
      this.piramides = JSON.parse(piramidesSalvas).map((p: any) => ({
        ...p,
        dataInicio: new Date(p.dataInicio),
        dataFim: p.dataFim ? new Date(p.dataFim) : undefined
      }));
    } else {
      // Criar pirâmide padrão para migração
      this.criarPiramidePadrao();
    }
    
    // Definir pirâmide atual
    if (piramideAtualId && this.piramides.length > 0) {
      const piramide = this.piramides.find(p => p.id === piramideAtualId);
      if (piramide) {
        this.piramideAtual = piramide;
        this.piramideAtualSubject.next(piramide);
      }
    } else if (this.piramides.length > 0) {
      // Se não tem pirâmide definida, usar a primeira ativa
      const piramideAtiva = this.piramides.find(p => p.status === 'ativa') || this.piramides[0];
      this.selecionarPiramide(piramideAtiva.id);
    }
  }

  private criarPiramidePadrao() {
    const piramidePadrao: Piramide = {
      id: '1',
      nome: 'Pirâmide Principal',
      descricao: 'Pirâmide principal do Beach Tennis',
      categoria: 'misto',
      status: 'ativa',
      maxDuplas: 45,
      dataInicio: new Date(),
      criadoPor: 'sistema',
      configuracao: this.getConfiguracaoPadrao(),
      cor: '#667eea',
      icone: '🏆',
      ativa: true
    };
    
    this.piramides = [piramidePadrao];
    this.salvarDados();
  }

  private getConfiguracaoPadrao(): ConfiguracaoPiramideEspecifica {
    return {
      posicaoLimiteDesafioTopo: 5,
      permitirDesafiosEntrePiramides: false,
      diasPrazoResposta: 7,
      maxDesafiosPorSemana: 2,
      pontosVitoriaIgual: 10,
      pontosVitoriaSuperior: 15,
      pontosDerrota: -5
    };
  }

  // ========== OPERAÇÕES BÁSICAS ==========
  
  async criarPiramide(novaPiramide: NovaPiramide): Promise<{ success: boolean; message: string; piramide?: Piramide }> {
    try {
      await this.delay(300);
      
      // Validar nome único
      if (this.piramides.some(p => p.nome.toLowerCase() === novaPiramide.nome.toLowerCase().trim())) {
        return {
          success: false,
          message: 'Já existe uma pirâmide com este nome'
        };
      }

      const piramide: Piramide = {
        id: this.gerarId(),
        nome: novaPiramide.nome.trim(),
        descricao: novaPiramide.descricao?.trim() || '',
        categoria: novaPiramide.categoria,
        status: 'ativa',
        maxDuplas: novaPiramide.maxDuplas || 45,
        dataInicio: new Date(),
        criadoPor: 'admin', // TODO: pegar do AuthService
        configuracao: {
          ...this.getConfiguracaoPadrao(),
          ...novaPiramide.configuracao
        },
        cor: novaPiramide.cor || this.getCoresDisponiveis()[0],
        icone: novaPiramide.icone || this.getIconesDisponiveis()[0],
        ativa: true
      };

      this.piramides.push(piramide);
      this.salvarDados();

      return {
        success: true,
        message: 'Pirâmide criada com sucesso!',
        piramide
      };
    } catch (error) {
      return {
        success: false,
        message: 'Erro ao criar pirâmide. Tente novamente.'
      };
    }
  }

  async obterPiramides(): Promise<Piramide[]> {
    await this.delay(100);
    return [...this.piramides];
  }

  async obterPiramidesPorStatus(status: string): Promise<Piramide[]> {
    await this.delay(100);
    return this.piramides.filter(p => p.status === status);
  }

  async obterPiramideSeletor(): Promise<PiramideSeletor[]> {
    await this.delay(100);
    
    return this.piramides.map(p => ({
      id: p.id,
      nome: p.nome,
      categoria: p.categoria,
      status: p.status,
      totalDuplas: this.contarDuplasPiramide(p.id),
      cor: p.cor,
      icone: p.icone,
      ultimaAtividade: new Date() // TODO: calcular última atividade real
    }));
  }

  async selecionarPiramide(piramideId: string): Promise<{ success: boolean; message: string }> {
    const piramide = this.piramides.find(p => p.id === piramideId);
    
    if (!piramide) {
      return {
        success: false,
        message: 'Pirâmide não encontrada'
      };
    }

    if (piramide.status === 'arquivada') {
      return {
        success: false,
        message: 'Não é possível selecionar uma pirâmide arquivada'
      };
    }

    this.piramideAtual = piramide;
    this.piramideAtualSubject.next(piramide);
    localStorage.setItem('piramideAtualId', piramideId);

    return {
      success: true,
      message: `Pirâmide "${piramide.nome}" selecionada`
    };
  }

  getPiramideAtual(): Piramide | null {
    return this.piramideAtual;
  }

  getPiramideAtualId(): string | null {
    return this.piramideAtual?.id || null;
  }

  // ========== ✅ NOVAS FUNCIONALIDADES: REATIVAÇÃO E EXCLUSÃO ==========
  
  async reativarPiramide(piramideId: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.delay(300);
      
      const piramide = this.piramides.find(p => p.id === piramideId);
      
      if (!piramide) {
        return {
          success: false,
          message: 'Pirâmide não encontrada'
        };
      }

      if (piramide.status === 'ativa') {
        return {
          success: false,
          message: 'Esta pirâmide já está ativa'
        };
      }

      if (piramide.status === 'arquivada') {
        return {
          success: false,
          message: 'Não é possível reativar uma pirâmide arquivada'
        };
      }

      // Reativar a pirâmide
      const index = this.piramides.findIndex(p => p.id === piramideId);
      this.piramides[index] = {
        ...this.piramides[index],
        status: 'ativa',
        dataFim: undefined // Remove data de fim se existir
      };

      // Se for a pirâmide atual, atualizar o subject
      if (this.piramideAtual?.id === piramideId) {
        this.piramideAtual = this.piramides[index];
        this.piramideAtualSubject.next(this.piramideAtual);
      }

      this.salvarDados();

      return {
        success: true,
        message: `Pirâmide "${piramide.nome}" foi reativada com sucesso!`
      };
    } catch (error) {
      return {
        success: false,
        message: 'Erro ao reativar pirâmide'
      };
    }
  }

  async excluirPiramide(piramideId: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.delay(500);
      
      const piramide = this.piramides.find(p => p.id === piramideId);
      
      if (!piramide) {
        return {
          success: false,
          message: 'Pirâmide não encontrada'
        };
      }

      // ✅ REGRA: Só pode excluir pirâmides finalizadas
      if (piramide.status !== 'finalizada') {
        return {
          success: false,
          message: 'Só é possível excluir pirâmides que estão finalizadas'
        };
      }

      // Verificar se é a última pirâmide
      const piramidesAtivas = this.piramides.filter(p => p.status !== 'arquivada' && p.id !== piramideId);
      if (piramidesAtivas.length === 0) {
        return {
          success: false,
          message: 'Não é possível excluir a última pirâmide do sistema'
        };
      }

      // Se for a pirâmide atual, selecionar outra
      if (this.piramideAtual?.id === piramideId) {
        const outraPiramide = piramidesAtivas.find(p => p.status === 'ativa') || piramidesAtivas[0];
        if (outraPiramide) {
          await this.selecionarPiramide(outraPiramide.id);
        }
      }

      // Remover a pirâmide completamente
      this.piramides = this.piramides.filter(p => p.id !== piramideId);
      this.salvarDados();

      // TODO: Aqui você também deve excluir todas as duplas desta pirâmide
      // Isso seria feito no DuplasService
      // await this.duplasService.excluirTodasDuplasPiramide(piramideId);

      return {
        success: true,
        message: `Pirâmide "${piramide.nome}" foi excluída permanentemente`
      };
    } catch (error) {
      return {
        success: false,
        message: 'Erro ao excluir pirâmide'
      };
    }
  }

  // ========== ✅ VALIDAÇÕES DE PROTEÇÃO ==========
  
  isPiramideEditavel(piramideId: string): boolean {
    const piramide = this.piramides.find(p => p.id === piramideId);
    return piramide?.status === 'ativa' || piramide?.status === 'pausada';
  }

  isPiramideFinalizadaOuArquivada(piramideId: string): boolean {
    const piramide = this.piramides.find(p => p.id === piramideId);
    return piramide?.status === 'finalizada' || piramide?.status === 'arquivada';
  }

  podeAdicionarDuplas(piramideId: string): { pode: boolean; motivo?: string } {
    const piramide = this.piramides.find(p => p.id === piramideId);
    
    if (!piramide) {
      return { pode: false, motivo: 'Pirâmide não encontrada' };
    }

    if (piramide.status === 'finalizada') {
      return { pode: false, motivo: 'Não é possível adicionar duplas em uma pirâmide finalizada' };
    }

    if (piramide.status === 'arquivada') {
      return { pode: false, motivo: 'Não é possível adicionar duplas em uma pirâmide arquivada' };
    }

    if (piramide.status === 'pausada') {
      return { pode: false, motivo: 'Pirâmide está pausada. Reative-a para adicionar duplas' };
    }

    return { pode: true };
  }

  podeCriarDesafios(piramideId: string): { pode: boolean; motivo?: string } {
    const piramide = this.piramides.find(p => p.id === piramideId);
    
    if (!piramide) {
      return { pode: false, motivo: 'Pirâmide não encontrada' };
    }

    if (piramide.status === 'finalizada') {
      return { pode: false, motivo: 'Não é possível criar desafios em uma pirâmide finalizada' };
    }

    if (piramide.status === 'arquivada') {
      return { pode: false, motivo: 'Não é possível criar desafios em uma pirâmide arquivada' };
    }

    if (piramide.status === 'pausada') {
      return { pode: false, motivo: 'Pirâmide está pausada. Reative-a para criar desafios' };
    }

    return { pode: true };
  }

  // ========== OPERAÇÕES AVANÇADAS (MANTIDAS) ==========
  
  async atualizarPiramide(piramideId: string, dados: Partial<Piramide>): Promise<{ success: boolean; message: string }> {
    try {
      await this.delay(300);
      
      const index = this.piramides.findIndex(p => p.id === piramideId);
      if (index === -1) {
        return {
          success: false,
          message: 'Pirâmide não encontrada'
        };
      }

      // Validar nome único se estiver sendo alterado
      if (dados.nome && dados.nome !== this.piramides[index].nome) {
        if (this.piramides.some(p => p.nome.toLowerCase() === dados.nome!.toLowerCase().trim() && p.id !== piramideId)) {
          return {
            success: false,
            message: 'Já existe uma pirâmide com este nome'
          };
        }
      }

      this.piramides[index] = {
        ...this.piramides[index],
        ...dados
      };

      // Se for a pirâmide atual, atualizar o subject
      if (this.piramideAtual?.id === piramideId) {
        this.piramideAtual = this.piramides[index];
        this.piramideAtualSubject.next(this.piramideAtual);
      }

      this.salvarDados();

      return {
        success: true,
        message: 'Pirâmide atualizada com sucesso!'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Erro ao atualizar pirâmide'
      };
    }
  }

  async alterarStatusPiramide(piramideId: string, novoStatus: Piramide['status']): Promise<{ success: boolean; message: string }> {
    try {
      await this.delay(300);
      
      const piramide = this.piramides.find(p => p.id === piramideId);
      
      if (!piramide) {
        return {
          success: false,
          message: 'Pirâmide não encontrada'
        };
      }

      // ✅ VALIDAÇÕES ESPECIAIS PARA FINALIZAÇÃO
      if (novoStatus === 'finalizada') {
        const dados: Partial<Piramide> = { 
          status: 'finalizada',
          dataFim: new Date()
        };
        
        const resultado = await this.atualizarPiramide(piramideId, dados);
        
        if (resultado.success) {
          resultado.message = `Pirâmide "${piramide.nome}" foi finalizada. Agora você pode excluí-la se necessário.`;
        }
        
        return resultado;
      }

      // Para outros status, usar a função normal
      const resultado = await this.atualizarPiramide(piramideId, { status: novoStatus });
      
      if (resultado.success) {
        resultado.message = `Status alterado para "${novoStatus}" com sucesso!`;
      }
      
      return resultado;
    } catch (error) {
      return {
        success: false,
        message: 'Erro ao alterar status'
      };
    }
  }

  async arquivarPiramide(piramideId: string): Promise<{ success: boolean; message: string }> {
    const piramide = this.piramides.find(p => p.id === piramideId);
    
    if (!piramide) {
      return {
        success: false,
        message: 'Pirâmide não encontrada'
      };
    }

    // Se for a pirâmide atual, selecionar outra
    if (this.piramideAtual?.id === piramideId) {
      const outraPiramide = this.piramides.find(p => p.id !== piramideId && p.status === 'ativa');
      if (outraPiramide) {
        await this.selecionarPiramide(outraPiramide.id);
      } else {
        this.piramideAtual = null;
        this.piramideAtualSubject.next(null);
        localStorage.removeItem('piramideAtualId');
      }
    }

    return await this.alterarStatusPiramide(piramideId, 'arquivada');
  }

  async obterEstatisticasPiramide(piramideId: string): Promise<EstatisticasPiramide> {
    await this.delay(200);
    
    // TODO: Integrar com DuplasService para obter dados reais
    const totalDuplas = this.contarDuplasPiramide(piramideId);
    const piramide = this.piramides.find(p => p.id === piramideId);
    
    return {
      totalDuplas,
      vagasDisponiveis: (piramide?.maxDuplas || 45) - totalDuplas,
      totalJogos: 0, // TODO: calcular do histórico
      duplasMaisAtivas: [], // TODO: buscar do DuplasService
      ultimaAtividade: new Date(),
      tempoMedioBase: 30, // TODO: calcular real
      rotatividade: 15 // TODO: calcular real
    };
  }

  // ========== TRANSFERÊNCIA DE DUPLAS ==========
  
  async transferirDupla(transferencia: TransferenciaDupla): Promise<{ success: boolean; message: string }> {
    try {
      await this.delay(500);
      
      const piramideOrigem = this.piramides.find(p => p.id === transferencia.piramideOrigemId);
      const piramideDestino = this.piramides.find(p => p.id === transferencia.piramideDestinoId);
      
      if (!piramideOrigem || !piramideDestino) {
        return {
          success: false,
          message: 'Pirâmide de origem ou destino não encontrada'
        };
      }

      // ✅ VALIDAR SE PODE MODIFICAR AS PIRÂMIDES
      const podeOrigemPerder = this.podeAdicionarDuplas(piramideOrigem.id);
      const podeDestinoReceber = this.podeAdicionarDuplas(piramideDestino.id);
      
      if (!podeOrigemPerder.pode) {
        return {
          success: false,
          message: `Pirâmide origem: ${podeOrigemPerder.motivo}`
        };
      }
      
      if (!podeDestinoReceber.pode) {
        return {
          success: false,
          message: `Pirâmide destino: ${podeDestinoReceber.motivo}`
        };
      }

      // Verificar capacidade da pirâmide destino
      const duplasDestino = this.contarDuplasPiramide(piramideDestino.id);
      if (duplasDestino >= piramideDestino.maxDuplas) {
        return {
          success: false,
          message: `Pirâmide "${piramideDestino.nome}" está com capacidade máxima`
        };
      }

      // TODO: Integrar com DuplasService para fazer a transferência real
      // 1. Remover da pirâmide origem
      // 2. Adicionar na pirâmide destino (última posição)
      // 3. Se manterEstatisticas = false, zerar vitórias/derrotas
      // 4. Reorganizar ambas as pirâmides

      return {
        success: true,
        message: `Dupla transferida para "${piramideDestino.nome}" com sucesso!`
      };
    } catch (error) {
      return {
        success: false,
        message: 'Erro ao transferir dupla'
      };
    }
  }

  // ========== UTILITÁRIOS ==========
  
  getCoresDisponiveis(): string[] {
    return [
      '#667eea', '#764ba2', '#f093fb', '#f5576c',
      '#4facfe', '#00f2fe', '#43e97b', '#38f9d7',
      '#ffecd2', '#fcb69f', '#a8edea', '#fed6e3',
      '#ff9a9e', '#fecfef', '#ffeaa7', '#fab1a0'
    ];
  }

  getIconesDisponiveis(): string[] {
    return [
      '🏆', '🥇', '🏐', '🎾', '⚡', '🔥', '💎', '👑',
      '🌟', '⭐', '💫', '🎯', '🚀', '💪', '🏅', '🥉'
    ];
  }

  getCategorias(): Array<{value: string, label: string, description: string}> {
    return [
      { value: 'masculino', label: 'Masculino', description: 'Apenas duplas masculinas' },
      { value: 'feminino', label: 'Feminino', description: 'Apenas duplas femininas' },
      { value: 'misto', label: 'Misto', description: 'Duplas mistas ou qualquer gênero' },
      { value: 'iniciante', label: 'Iniciante', description: 'Para jogadores iniciantes' },
      { value: 'avancado', label: 'Avançado', description: 'Para jogadores experientes' },
      { value: 'custom', label: 'Personalizada', description: 'Categoria personalizada' }
    ];
  }

  private contarDuplasPiramide(piramideId: string): number {
    // TODO: Integrar com DuplasService para contar duplas reais
    // Por enquanto, retornar número simulado
    return Math.floor(Math.random() * 20) + 5;
  }

  private gerarId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  private salvarDados(): void {
    localStorage.setItem('piramides', JSON.stringify(this.piramides));
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}