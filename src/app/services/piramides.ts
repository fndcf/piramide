// src/app/services/piramides.ts - ATUALIZADO COM FIREBASE
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { 
  Piramide, 
  NovaPiramide, 
  ConfiguracaoPiramideEspecifica
} from '../models/piramide.model';
import { EstatisticasPiramide, PiramideSeletor } from '../models/dupla.model';
import { orderBy, where } from '@angular/fire/firestore';
import { FirebaseService } from './firebase';

@Injectable({
  providedIn: 'root'
})
export class PiramidesService {
  private piramideAtual: Piramide | null = null;
  private piramideAtualSubject = new BehaviorSubject<Piramide | null>(null);
  
  public piramideAtual$ = this.piramideAtualSubject.asObservable();
  
  // Cache local para performance
  private piramidesCache: Piramide[] = [];
  private lastCacheUpdate = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

  constructor(private firebase: FirebaseService) {
    this.inicializarDados();
  }

  private async inicializarDados() {
    try {
      console.log('🔄 Inicializando PiramidesService...');
      
      // Tentar obter a pirâmide atual do Firebase
      const configResult = await this.firebase.get('configuracoes', 'global');
      
      if (configResult.success && configResult.data?.piramideAtualId) {
        console.log('📋 Configuração encontrada:', configResult.data.piramideAtualId);
        const piramideResult = await this.firebase.get('piramides', configResult.data.piramideAtualId);
        
        if (piramideResult.success) {
          this.piramideAtual = this.formatarPiramide(piramideResult.data);
          this.piramideAtualSubject.next(this.piramideAtual);
          console.log('✅ Pirâmide atual carregada:', this.piramideAtual.nome);
          return; // Pirâmide encontrada, não fazer mais nada
        }
      }

      // Se não há configuração, buscar pirâmides ativas (SEM orderBy para evitar erro de índice)
      console.log('🔍 Buscando pirâmides ativas...');
      const result = await this.firebase.findBy('piramides', 'status', 'ativa');

      if (result.success && result.data && result.data.length > 0) {
        console.log(`📊 ${result.data.length} pirâmide(s) ativa(s) encontrada(s)`);
        
        // Ordenar manualmente por dataInicio
        const piramidesOrdenadas = result.data.sort((a, b) => {
          const dataA = a.dataInicio?.toDate ? a.dataInicio.toDate() : new Date(a.dataInicio);
          const dataB = b.dataInicio?.toDate ? b.dataInicio.toDate() : new Date(b.dataInicio);
          return dataA.getTime() - dataB.getTime();
        });
        
        const piramide = this.formatarPiramide(piramidesOrdenadas[0]);
        await this.selecionarPiramide(piramide.id);
        console.log('✅ Primeira pirâmide ativa selecionada:', piramide.nome);
      } else {
        // Se não há pirâmides, definir como null (não criar automaticamente)
        this.piramideAtual = null;
        this.piramideAtualSubject.next(null);
        console.log('⚠️ Nenhuma pirâmide encontrada - Modal de criação aparecerá apenas para administradores');
      }
    } catch (error) {
      console.error('❌ Erro ao inicializar dados das pirâmides:', error);
      // Em caso de erro, não mostrar modal automaticamente
      this.piramideAtual = null;
      this.piramideAtualSubject.next(null);
    }
  }

  // Método para verificar se precisa de configuração inicial (apenas para admin)
  async precisaConfiguracaoInicial(): Promise<boolean> {
    try {
      const piramides = await this.firebase.getAll('piramides');
      return !piramides.success || !piramides.data || piramides.data.length === 0;
    } catch (error) {
      return true;
    }
  }

  // Método para criar a primeira pirâmide (apenas quando admin solicitar)
  async criarPrimeiraPiramide(): Promise<{ success: boolean; message: string; piramide?: Piramide }> {
    const piramidePadrao: NovaPiramide = {
      nome: 'Pirâmide Principal',
      descricao: 'Pirâmide principal do Beach Tennis',
      categoria: 'misto',
      maxDuplas: 45,
      cor: '#667eea',
      icone: '🏆'
    };

    const result = await this.criarPiramide(piramidePadrao);
    if (result.success && result.piramide) {
      await this.selecionarPiramide(result.piramide.id);
    }
    return result;
  }

  private inicializarDadosLocais() {
    // Fallback para dados locais (código original mantido como backup)
    const piramidesSalvas = localStorage.getItem('piramides');
    if (piramidesSalvas) {
      const piramides = JSON.parse(piramidesSalvas);
      if (piramides.length > 0) {
        this.piramideAtual = piramides[0];
        this.piramideAtualSubject.next(this.piramideAtual);
      }
    }
  }

  private formatarPiramide(data: any): Piramide {
    return {
      ...data,
      dataInicio: data.dataInicio?.toDate ? data.dataInicio.toDate() : new Date(data.dataInicio),
      dataFim: data.dataFim?.toDate ? data.dataFim.toDate() : (data.dataFim ? new Date(data.dataFim) : undefined),
      configuracao: {
        ...this.getConfiguracaoPadrao(),
        ...data.configuracao
      }
    };
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
      // Validar nome único
      const existeResult = await this.firebase.findFirst('piramides', 'nome', novaPiramide.nome.trim());
      if (existeResult.success) {
        return {
          success: false,
          message: 'Já existe uma pirâmide com este nome'
        };
      }

      const piramideData = {
        nome: novaPiramide.nome.trim(),
        descricao: novaPiramide.descricao?.trim() || '',
        categoria: novaPiramide.categoria,
        status: 'ativa' as const,
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

      const result = await this.firebase.create('piramides', piramideData);

      if (result.success && result.id) {
        const piramide: Piramide = {
          id: result.id,
          ...piramideData
        };

        // Limpar cache
        this.limparCache();

        return {
          success: true,
          message: 'Pirâmide criada com sucesso!',
          piramide
        };
      } else {
        return {
          success: false,
          message: result.error || 'Erro ao criar pirâmide'
        };
      }
    } catch (error: any) {
      console.error('Erro ao criar pirâmide:', error);
      return {
        success: false,
        message: 'Erro ao criar pirâmide. Tente novamente.'
      };
    }
  }

  async obterPiramides(): Promise<Piramide[]> {
    try {
      // Verificar cache
      const agora = Date.now();
      if (this.piramidesCache.length > 0 && (agora - this.lastCacheUpdate) < this.CACHE_DURATION) {
        return [...this.piramidesCache];
      }

      const result = await this.firebase.getAll(
        'piramides',
        [orderBy('dataInicio', 'desc')]
      );

      if (result.success && result.data) {
        this.piramidesCache = result.data.map(p => this.formatarPiramide(p));
        this.lastCacheUpdate = agora;
        return [...this.piramidesCache];
      } else {
        console.error('Erro ao obter pirâmides:', result.error);
        return [];
      }
    } catch (error) {
      console.error('Erro ao obter pirâmides:', error);
      return [];
    }
  }

  async obterPiramidesPorStatus(status: string): Promise<Piramide[]> {
    try {
      const result = await this.firebase.findBy(
        'piramides',
        'status',
        status,
        [orderBy('dataInicio', 'desc')]
      );

      if (result.success && result.data) {
        return result.data.map(p => this.formatarPiramide(p));
      } else {
        return [];
      }
    } catch (error) {
      console.error(`Erro ao obter pirâmides por status ${status}:`, error);
      return [];
    }
  }

  async obterPiramideSeletor(): Promise<PiramideSeletor[]> {
    try {
      const piramides = await this.obterPiramides();
      
      return piramides.map(p => ({
        id: p.id,
        nome: p.nome,
        categoria: p.categoria,
        status: p.status,
        totalDuplas: 0, // TODO: calcular do DuplasService
        cor: p.cor,
        icone: p.icone,
        ultimaAtividade: new Date() // TODO: calcular última atividade real
      }));
    } catch (error) {
      console.error('Erro ao obter seletor de pirâmides:', error);
      return [];
    }
  }

  async selecionarPiramide(piramideId: string): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.firebase.get('piramides', piramideId);
      
      if (!result.success) {
        return {
          success: false,
          message: 'Pirâmide não encontrada'
        };
      }

      const piramide = this.formatarPiramide(result.data);

      if (piramide.status === 'arquivada') {
        return {
          success: false,
          message: 'Não é possível selecionar uma pirâmide arquivada'
        };
      }

      // Atualizar pirâmide atual
      this.piramideAtual = piramide;
      this.piramideAtualSubject.next(piramide);

      // Salvar configuração global
      await this.firebase.set('configuracoes', 'global', {
        piramideAtualId: piramideId,
        versaoApp: '1.0.0'
      });

      return {
        success: true,
        message: `Pirâmide "${piramide.nome}" selecionada`
      };
    } catch (error: any) {
      console.error('Erro ao selecionar pirâmide:', error);
      return {
        success: false,
        message: 'Erro ao selecionar pirâmide'
      };
    }
  }

  getPiramideAtual(): Piramide | null {
    return this.piramideAtual;
  }

  getPiramideAtualId(): string | null {
    return this.piramideAtual?.id || null;
  }

  // ========== REATIVAÇÃO E EXCLUSÃO ==========
  
  async reativarPiramide(piramideId: string): Promise<{ success: boolean; message: string }> {
    try {
      const getResult = await this.firebase.get('piramides', piramideId);
      
      if (!getResult.success) {
        return {
          success: false,
          message: 'Pirâmide não encontrada'
        };
      }

      const piramide = getResult.data;

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

      const updateResult = await this.firebase.update('piramides', piramideId, {
        status: 'ativa',
        dataFim: null
      });

      if (updateResult.success) {
        // Se for a pirâmide atual, atualizar o subject
        if (this.piramideAtual?.id === piramideId) {
          this.piramideAtual.status = 'ativa';
          this.piramideAtual.dataFim = undefined;
          this.piramideAtualSubject.next(this.piramideAtual);
        }

        this.limparCache();

        return {
          success: true,
          message: `Pirâmide "${piramide.nome}" foi reativada com sucesso!`
        };
      } else {
        return {
          success: false,
          message: updateResult.error || 'Erro ao reativar pirâmide'
        };
      }
    } catch (error: any) {
      console.error('Erro ao reativar pirâmide:', error);
      return {
        success: false,
        message: 'Erro ao reativar pirâmide'
      };
    }
  }

  async excluirPiramide(piramideId: string): Promise<{ success: boolean; message: string }> {
    try {
      const getResult = await this.firebase.get('piramides', piramideId);
      
      if (!getResult.success) {
        return {
          success: false,
          message: 'Pirâmide não encontrada'
        };
      }

      const piramide = getResult.data;

      // Só pode excluir pirâmides finalizadas
      if (piramide.status !== 'finalizada') {
        return {
          success: false,
          message: 'Só é possível excluir pirâmides que estão finalizadas'
        };
      }

      // Verificar se é a última pirâmide
      const piramidesAtivas = await this.firebase.findBy(
        'piramides',
        'status',
        'ativa'
      );

      if (piramidesAtivas.success && (!piramidesAtivas.data || piramidesAtivas.data.length === 0)) {
        // Verificar pirâmides pausadas também
        const piramidesPausadas = await this.firebase.findBy(
          'piramides',
          'status',
          'pausada'
        );

        if (!piramidesPausadas.success || !piramidesPausadas.data || piramidesPausadas.data.length === 0) {
          return {
            success: false,
            message: 'Não é possível excluir a última pirâmide do sistema'
          };
        }
      }

      // Se for a pirâmide atual, selecionar outra
      if (this.piramideAtual?.id === piramideId) {
        if (piramidesAtivas.success && piramidesAtivas.data && piramidesAtivas.data.length > 0) {
          await this.selecionarPiramide(piramidesAtivas.data[0].id);
        }
      }

      // Excluir a pirâmide
      const deleteResult = await this.firebase.delete('piramides', piramideId);

      if (deleteResult.success) {
        // TODO: Excluir todas as duplas desta pirâmide
        // await this.duplasService.excluirTodasDuplasPiramide(piramideId);

        this.limparCache();

        return {
          success: true,
          message: `Pirâmide "${piramide.nome}" foi excluída permanentemente`
        };
      } else {
        return {
          success: false,
          message: deleteResult.error || 'Erro ao excluir pirâmide'
        };
      }
    } catch (error: any) {
      console.error('Erro ao excluir pirâmide:', error);
      return {
        success: false,
        message: 'Erro ao excluir pirâmide'
      };
    }
  }

  // ========== VALIDAÇÕES DE PROTEÇÃO ==========
  
  isPiramideEditavel(piramideId: string): boolean {
    // Implementar cache local ou buscar do Firebase se necessário
    const piramide = this.piramidesCache.find(p => p.id === piramideId);
    return piramide?.status === 'ativa' || piramide?.status === 'pausada';
  }

  isPiramideFinalizadaOuArquivada(piramideId: string): boolean {
    const piramide = this.piramidesCache.find(p => p.id === piramideId);
    return piramide?.status === 'finalizada' || piramide?.status === 'arquivada';
  }

  podeAdicionarDuplas(piramideId: string): { pode: boolean; motivo?: string } {
    const piramide = this.piramidesCache.find(p => p.id === piramideId) || this.piramideAtual;
    
    if (!piramide || piramide.id !== piramideId) {
      return { pode: false, motivo: 'Pirâmide não encontrada' };
    }

    switch (piramide.status) {
      case 'finalizada':
        return { pode: false, motivo: 'Não é possível adicionar duplas em uma pirâmide finalizada' };
      case 'arquivada':
        return { pode: false, motivo: 'Não é possível adicionar duplas em uma pirâmide arquivada' };
      case 'pausada':
        return { pode: false, motivo: 'Pirâmide está pausada. Reative-a para adicionar duplas' };
      default:
        return { pode: true };
    }
  }

  podeCriarDesafios(piramideId: string): { pode: boolean; motivo?: string } {
    const piramide = this.piramidesCache.find(p => p.id === piramideId) || this.piramideAtual;
    
    if (!piramide || piramide.id !== piramideId) {
      return { pode: false, motivo: 'Pirâmide não encontrada' };
    }

    switch (piramide.status) {
      case 'finalizada':
        return { pode: false, motivo: 'Não é possível criar desafios em uma pirâmide finalizada' };
      case 'arquivada':
        return { pode: false, motivo: 'Não é possível criar desafios em uma pirâmide arquivada' };
      case 'pausada':
        return { pode: false, motivo: 'Pirâmide está pausada. Reative-a para criar desafios' };
      default:
        return { pode: true };
    }
  }

  // ========== OPERAÇÕES AVANÇADAS ==========
  
  async atualizarPiramide(piramideId: string, dados: Partial<Piramide>): Promise<{ success: boolean; message: string }> {
    try {
      // Validar nome único se estiver sendo alterado
      if (dados.nome) {
        const existeResult = await this.firebase.findFirst('piramides', 'nome', dados.nome.trim());
        if (existeResult.success && existeResult.data.id !== piramideId) {
          return {
            success: false,
            message: 'Já existe uma pirâmide com este nome'
          };
        }
      }

      const updateResult = await this.firebase.update('piramides', piramideId, dados);

      if (updateResult.success) {
        // Se for a pirâmide atual, atualizar o subject
        if (this.piramideAtual?.id === piramideId) {
          this.piramideAtual = { ...this.piramideAtual, ...dados };
          this.piramideAtualSubject.next(this.piramideAtual);
        }

        this.limparCache();

        return {
          success: true,
          message: 'Pirâmide atualizada com sucesso!'
        };
      } else {
        return {
          success: false,
          message: updateResult.error || 'Erro ao atualizar pirâmide'
        };
      }
    } catch (error: any) {
      console.error('Erro ao atualizar pirâmide:', error);
      return {
        success: false,
        message: 'Erro ao atualizar pirâmide'
      };
    }
  }

  async alterarStatusPiramide(piramideId: string, novoStatus: Piramide['status']): Promise<{ success: boolean; message: string }> {
    try {
      const dados: Partial<Piramide> = { status: novoStatus };
      
      if (novoStatus === 'finalizada') {
        dados.dataFim = new Date();
      }

      const resultado = await this.atualizarPiramide(piramideId, dados);
      
      if (resultado.success) {
        if (novoStatus === 'finalizada') {
          const piramide = await this.firebase.get('piramides', piramideId);
          resultado.message = `Pirâmide "${piramide.data?.nome}" foi finalizada. Agora você pode excluí-la se necessário.`;
        } else {
          resultado.message = `Status alterado para "${novoStatus}" com sucesso!`;
        }
      }
      
      return resultado;
    } catch (error: any) {
      console.error('Erro ao alterar status:', error);
      return {
        success: false,
        message: 'Erro ao alterar status'
      };
    }
  }

  async arquivarPiramide(piramideId: string): Promise<{ success: boolean; message: string }> {
    try {
      const getResult = await this.firebase.get('piramides', piramideId);
      
      if (!getResult.success) {
        return {
          success: false,
          message: 'Pirâmide não encontrada'
        };
      }

      // Se for a pirâmide atual, selecionar outra
      if (this.piramideAtual?.id === piramideId) {
        const piramidesAtivas = await this.firebase.findBy('piramides', 'status', 'ativa');
        
        if (piramidesAtivas.success && piramidesAtivas.data && piramidesAtivas.data.length > 0) {
          // Encontrar uma pirâmide diferente da atual
          const outraPiramide = piramidesAtivas.data.find(p => p.id !== piramideId);
          if (outraPiramide) {
            await this.selecionarPiramide(outraPiramide.id);
          }
        } else {
          // Não há outras pirâmides ativas
          this.piramideAtual = null;
          this.piramideAtualSubject.next(null);
          await this.firebase.update('configuracoes', 'global', { piramideAtualId: null });
        }
      }

      return await this.alterarStatusPiramide(piramideId, 'arquivada');
    } catch (error: any) {
      console.error('Erro ao arquivar pirâmide:', error);
      return {
        success: false,
        message: 'Erro ao arquivar pirâmide'
      };
    }
  }

  async obterEstatisticasPiramide(piramideId: string): Promise<EstatisticasPiramide> {
    try {
      // TODO: Integrar com DuplasService para obter dados reais
      const piramideResult = await this.firebase.get('piramides', piramideId);
      const piramide = piramideResult.success ? piramideResult.data : null;
      
      return {
        totalDuplas: 0, // TODO: calcular do DuplasService
        vagasDisponiveis: (piramide?.maxDuplas || 45),
        totalJogos: 0, // TODO: calcular do histórico
        duplasMaisAtivas: [], // TODO: buscar do DuplasService
        ultimaAtividade: new Date(),
        tempoMedioBase: 30, // TODO: calcular real
        rotatividade: 15 // TODO: calcular real
      };
    } catch (error) {
      console.error('Erro ao obter estatísticas:', error);
      return {
        totalDuplas: 0,
        vagasDisponiveis: 0,
        totalJogos: 0,
        duplasMaisAtivas: [],
        ultimaAtividade: new Date(),
        tempoMedioBase: 0,
        rotatividade: 0
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

  private limparCache(): void {
    this.piramidesCache = [];
    this.lastCacheUpdate = 0;
  }

  // ========== MIGRAÇÃO DE DADOS ==========
  
  async migrarDadosLocais(): Promise<{ success: boolean; message: string; migrados: number }> {
    try {
      const piramidesSalvas = localStorage.getItem('piramides');
      if (!piramidesSalvas) {
        return {
          success: true,
          message: 'Nenhum dado local encontrado para migrar',
          migrados: 0
        };
      }

      const piramides = JSON.parse(piramidesSalvas);
      let migrados = 0;

      for (const piramide of piramides) {
        // Verificar se já existe
        const existe = await this.firebase.get('piramides', piramide.id);
        
        if (!existe.success) {
          // Migrar pirâmide
          const result = await this.firebase.set('piramides', piramide.id, {
            ...piramide,
            dataInicio: new Date(piramide.dataInicio),
            dataFim: piramide.dataFim ? new Date(piramide.dataFim) : null
          });

          if (result.success) {
            migrados++;
          }
        }
      }

      this.limparCache();

      return {
        success: true,
        message: `${migrados} pirâmide(s) migrada(s) com sucesso!`,
        migrados
      };
    } catch (error: any) {
      console.error('Erro ao migrar dados:', error);
      return {
        success: false,
        message: 'Erro ao migrar dados locais',
        migrados: 0
      };
    }
  }
}