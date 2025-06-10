// src/app/services/piramides.ts - CORRIGIDO PARA EVITAR ERRO DO FIREBASE
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
  
  // Flag de inicialização
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  constructor(private firebase: FirebaseService) {
    this.inicializarDados();
  }

  // ✅ MÉTODO CORRIGIDO: inicializarDados com melhor tratamento de erro
  private async inicializarDados() {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._inicializar();
    return this.initializationPromise;
  }

  private async _inicializar(): Promise<void> {
    try {
      console.log('🔄 Inicializando PiramidesService...');
      
      // ✅ AGUARDAR inicialização do Firebase
      const diagnostics = await this.firebase.getDiagnostics();
      if (!diagnostics.firestoreAvailable) {
        throw new Error('Firestore não está disponível');
      }

      // ✅ TENTATIVA SEGURA de obter configuração global
      let piramideAtualId: string | null = null;
      
      try {
        console.log('📋 Tentando obter configuração global...');
        const configResult = await this.firebase.get('configuracoes', 'global');
        
        if (configResult.success && configResult.data?.piramideAtualId) {
          piramideAtualId = configResult.data.piramideAtualId;
          console.log('✅ Configuração global encontrada:', piramideAtualId);
        } else {
          console.log('⚠️ Configuração global não encontrada, será criada posteriormente');
        }
      } catch (configError) {
        console.warn('⚠️ Erro ao acessar configuração global:', configError);
        // Continua sem configuração global (será criada posteriormente)
      }

      // ✅ TENTATIVA de obter pirâmide atual se ID foi encontrado
      if (piramideAtualId) {
        try {
          const piramideResult = await this.firebase.get('piramides', piramideAtualId);
          
          if (piramideResult.success && piramideResult.data) {
            this.piramideAtual = this.formatarPiramide(piramideResult.data);
            this.piramideAtualSubject.next(this.piramideAtual);
            console.log('✅ Pirâmide atual carregada:', this.piramideAtual.nome);
            this.isInitialized = true;
            return; // Sucesso, sair da função
          }
        } catch (piramideError) {
          console.warn('⚠️ Erro ao carregar pirâmide atual:', piramideError);
        }
      }

      // ✅ BUSCAR primeira pirâmide ativa disponível
      try {
        console.log('🔍 Buscando pirâmides ativas...');
        const result = await this.firebase.findBy('piramides', 'status', 'ativa');

        if (result.success && result.data && result.data.length > 0) {
          console.log(`📊 ${result.data.length} pirâmide(s) ativa(s) encontrada(s)`);
          
          // Ordenar manualmente por dataInicio (mais antiga primeiro)
          const piramidesOrdenadas = result.data.sort((a, b) => {
            const dataA = a.dataInicio?.toDate ? a.dataInicio.toDate() : new Date(a.dataInicio);
            const dataB = b.dataInicio?.toDate ? b.dataInicio.toDate() : new Date(b.dataInicio);
            return dataA.getTime() - dataB.getTime();
          });
          
          const piramide = this.formatarPiramide(piramidesOrdenadas[0]);
          await this.selecionarPiramide(piramide.id);
          console.log('✅ Primeira pirâmide ativa selecionada:', piramide.nome);
        } else {
          console.log('⚠️ Nenhuma pirâmide ativa encontrada');
          this.piramideAtual = null;
          this.piramideAtualSubject.next(null);
        }
      } catch (searchError) {
        console.warn('⚠️ Erro ao buscar pirâmides ativas:', searchError);
        this.piramideAtual = null;
        this.piramideAtualSubject.next(null);
      }

      this.isInitialized = true;
      console.log('✅ PiramidesService inicializado');
      
    } catch (error) {
      console.error('❌ Erro crítico ao inicializar PiramidesService:', error);
      this.piramideAtual = null;
      this.piramideAtualSubject.next(null);
      this.isInitialized = true; // Marcar como inicializado mesmo com erro
    }
  }

  // ✅ MÉTODO auxiliar para aguardar inicialização
  private async aguardarInicializacao(): Promise<void> {
    if (!this.isInitialized) {
      await this.inicializarDados();
    }
  }

  // Método para verificar se precisa de configuração inicial (apenas para admin)
  async precisaConfiguracaoInicial(): Promise<boolean> {
    try {
      await this.aguardarInicializacao();
      const piramides = await this.firebase.getAll('piramides');
      return !piramides.success || !piramides.data || piramides.data.length === 0;
    } catch (error) {
      console.error('Erro ao verificar configuração inicial:', error);
      return true;
    }
  }

  // Método para criar a primeira pirâmide (apenas quando admin solicitar)
  async criarPrimeiraPiramide(): Promise<{ success: boolean; message: string; piramide?: Piramide }> {
    const piramidePadrao: NovaPiramide = {
      nome: 'Pirâmide Principal',
      descricao: 'Pirâmide principal do Beach Tennis',
      categoria: 'mista',
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
      diasPrazoResposta: 7
    };
  }

  // ========== OPERAÇÕES BÁSICAS CORRIGIDAS ==========
  
  // ✅ MÉTODO CORRIGIDO: criarPiramide com melhor tratamento de erro
  async criarPiramide(novaPiramide: NovaPiramide): Promise<{ success: boolean; message: string; piramide?: Piramide }> {
    try {
      await this.aguardarInicializacao();
      
      // Validar entrada
      if (!novaPiramide.nome?.trim()) {
        return { success: false, message: 'Nome da pirâmide é obrigatório' };
      }

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

        // ✅ LIMPAR cache para forçar reload
        await this.limparCache();
        
        console.log('✅ Pirâmide criada e cache limpo:', piramide.nome);

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

  // ✅ MÉTODO CORRIGIDO: obterPiramides com melhor cache e tratamento de erro
  async obterPiramides(): Promise<Piramide[]> {
    try {
      await this.aguardarInicializacao();
      
      // Verificar cache apenas se não for muito antigo (reduzido para 2 minutos)
      const agora = Date.now();
      const CACHE_DURATION_REDUCED = 2 * 60 * 1000; // 2 minutos
      
      if (this.piramidesCache.length > 0 && (agora - this.lastCacheUpdate) < CACHE_DURATION_REDUCED) {
        console.log('📋 Usando cache das pirâmides');
        return [...this.piramidesCache];
      }

      console.log('🔄 Buscando pirâmides no Firebase...');
      
      // ✅ BUSCA SEGURA sem orderBy (pode causar erro de índice)
      const result = await this.firebase.getAll('piramides');

      if (result.success && result.data) {
        // Ordenar manualmente por dataInicio
        const piramidesOrdenadas = result.data
          .map(p => this.formatarPiramide(p))
          .sort((a, b) => b.dataInicio.getTime() - a.dataInicio.getTime()); // Mais recente primeiro

        this.piramidesCache = piramidesOrdenadas;
        this.lastCacheUpdate = agora;
        
        console.log(`✅ ${this.piramidesCache.length} pirâmides carregadas do Firebase`);
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
      await this.aguardarInicializacao();
      
      const result = await this.firebase.findBy('piramides', 'status', status);

      if (result.success && result.data) {
        // Ordenar manualmente
        const piramides = result.data
          .map(p => this.formatarPiramide(p))
          .sort((a, b) => b.dataInicio.getTime() - a.dataInicio.getTime());
        
        return piramides;
      } else {
        return [];
      }
    } catch (error) {
      console.error(`Erro ao obter pirâmides por status ${status}:`, error);
      return [];
    }
  }

  // ✅ MÉTODO CORRIGIDO: obterPiramideSeletor com cache atualizado
  async obterPiramideSeletor(): Promise<PiramideSeletor[]> {
    try {
      const piramides = await this.obterPiramides();
      
      console.log('🔄 Convertendo pirâmides para seletor...');
      
      const seletores = piramides.map(p => ({
        id: p.id,
        nome: p.nome,
        categoria: p.categoria,
        status: p.status,
        totalDuplas: 0, // TODO: calcular do DuplasService
        cor: p.cor,
        icone: p.icone,
        ultimaAtividade: p.dataInicio // TODO: calcular última atividade real
      }));
      
      console.log(`✅ ${seletores.length} seletores criados`);
      return seletores;
    } catch (error) {
      console.error('Erro ao obter seletor de pirâmides:', error);
      return [];
    }
  }

  // ✅ MÉTODO CORRIGIDO: selecionarPiramide com melhor tratamento de erro
  async selecionarPiramide(piramideId: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.aguardarInicializacao();
      
      if (!piramideId) {
        return { success: false, message: 'ID da pirâmide é obrigatório' };
      }

      const result = await this.firebase.get('piramides', piramideId);
      
      if (!result.success) {
        return {
          success: false,
          message: result.error || 'Pirâmide não encontrada'
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

      // ✅ SALVAR configuração global com tratamento de erro
      try {
        await this.firebase.set('configuracoes', 'global', {
          piramideAtualId: piramideId,
          versaoApp: '1.0.0',
          ultimaAtualizacao: new Date()
        });
      } catch (configError) {
        console.warn('⚠️ Erro ao salvar configuração global:', configError);
        // Continua mesmo se não conseguir salvar a configuração
      }

      // ✅ LIMPAR cache para garantir dados atualizados
      await this.limparCache();

      console.log(`✅ Pirâmide "${piramide.nome}" selecionada`);
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

  // ========== OUTROS MÉTODOS (mantidos iguais mas com aguardarInicializacao) ==========

  async reativarPiramide(piramideId: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.aguardarInicializacao();
      
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

  // ✅ MÉTODO CORRIGIDO: excluirPiramide com melhor tratamento
  async excluirPiramide(piramideId: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.aguardarInicializacao();
      
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
      const piramidesAtivas = await this.firebase.findBy('piramides', 'status', 'ativa');

      if (piramidesAtivas.success && (!piramidesAtivas.data || piramidesAtivas.data.length === 0)) {
        // Verificar pirâmides pausadas também
        const piramidesPausadas = await this.firebase.findBy('piramides', 'status', 'pausada');

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
        } else {
          this.piramideAtual = null;
          this.piramideAtualSubject.next(null);
        }
      }

      // Excluir a pirâmide
      const deleteResult = await this.firebase.delete('piramides', piramideId);

      if (deleteResult.success) {
        // ✅ LIMPAR cache
        await this.limparCache();

        console.log('✅ Pirâmide excluída e cache limpo');

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

  // ========== MÉTODOS AUXILIARES ==========
  
  // ✅ MÉTODO CORRIGIDO: atualizarPiramide
  async atualizarPiramide(piramideId: string, dados: Partial<Piramide>): Promise<{ success: boolean; message: string }> {
    try {
      await this.aguardarInicializacao();
      
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

        // ✅ LIMPAR cache
        await this.limparCache();

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

  // ✅ MÉTODO CORRIGIDO: alterarStatusPiramide
  async alterarStatusPiramide(piramideId: string, novoStatus: Piramide['status']): Promise<{ success: boolean; message: string }> {
    try {
      await this.aguardarInicializacao();
      
      const dados: Partial<Piramide> = { status: novoStatus };
      
      if (novoStatus === 'finalizada') {
        dados.dataFim = new Date();
      }

      const resultado = await this.atualizarPiramide(piramideId, dados);
      
      if (resultado.success) {
        // ✅ LIMPAR cache adicional (já é feito no atualizarPiramide, mas garantindo)
        await this.limparCache();
        
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
      await this.aguardarInicializacao();
      
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
          
          try {
            await this.firebase.update('configuracoes', 'global', { piramideAtualId: null });
          } catch (configError) {
            console.warn('Erro ao atualizar configuração global:', configError);
          }
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
      await this.aguardarInicializacao();
      
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
      { value: 'mista', label: 'Mista', description: 'Duplas mistas ou qualquer gênero' }
    ];
  }

  // ✅ MÉTODO CORRIGIDO: limparCache
  async limparCache(): Promise<void> {
    console.log('🧹 Limpando cache das pirâmides...');
    this.piramidesCache = [];
    this.lastCacheUpdate = 0;
  }

  // ========== MÉTODOS DE DIAGNÓSTICO ==========

  // Verificar status do service
  async getDiagnostics(): Promise<{
    isInitialized: boolean;
    piramideAtual: string | null;
    totalPiramidesCache: number;
    lastCacheUpdate: number;
    firebaseStatus: any;
  }> {
    try {
      const firebaseStatus = await this.firebase.getDiagnostics();
      
      return {
        isInitialized: this.isInitialized,
        piramideAtual: this.piramideAtual?.nome || null,
        totalPiramidesCache: this.piramidesCache.length,
        lastCacheUpdate: this.lastCacheUpdate,
        firebaseStatus
      };
    } catch (error) {
      return {
        isInitialized: this.isInitialized,
        piramideAtual: this.piramideAtual?.nome || null,
        totalPiramidesCache: this.piramidesCache.length,
        lastCacheUpdate: this.lastCacheUpdate,
        firebaseStatus: { error: error }
      };
    }
  }

  // Forçar recarregamento completo
  async forceReload(): Promise<void> {
    console.log('🔄 Forçando recarregamento completo do PiramidesService...');
    
    // Limpar cache
    await this.limparCache();
    
    // Resetar inicialização
    this.isInitialized = false;
    this.initializationPromise = null;
    
    // Reinicializar
    await this.inicializarDados();
  }

  // Método para teste de conectividade
  async testFirebaseConnection(): Promise<boolean> {
    try {
      await this.aguardarInicializacao();
      return await this.firebase.checkConnection();
    } catch (error) {
      console.error('Erro ao testar conexão Firebase:', error);
      return false;
    }
  }
}