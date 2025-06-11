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
      
      console.log('🗑️ Iniciando exclusão em cascata da pirâmide:', piramideId);
      
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

      // ✅ VERIFICAR se é a última pirâmide ativa do sistema
      const piramidesAtivas = await this.firebase.findBy('piramides', 'status', 'ativa');
      const piramidesPausadas = await this.firebase.findBy('piramides', 'status', 'pausada');

      const totalPiramidesAtivas = (piramidesAtivas.success ? piramidesAtivas.data?.length || 0 : 0) +
                                  (piramidesPausadas.success ? piramidesPausadas.data?.length || 0 : 0);

      if (totalPiramidesAtivas === 0) {
        return {
          success: false,
          message: 'Não é possível excluir a última pirâmide do sistema. Deve haver pelo menos uma pirâmide ativa ou pausada.'
        };
      }

      // ✅ ETAPA 1: Remover/desativar todas as duplas da pirâmide
      console.log('📂 Etapa 1/4: Removendo duplas da pirâmide...');
      try {
        // Importar DuplasService dinamicamente para evitar dependência circular
        const { DuplasService } = await import('./duplas');
        const duplasService = new DuplasService(this, this.firebase);
        
        const resultadoDuplas = await duplasService.excluirTodasDuplasPiramide(piramideId);
        
        if (resultadoDuplas.success) {
          console.log(`✅ ${resultadoDuplas.duplasRemovidas} dupla(s) removida(s) da pirâmide`);
        } else {
          console.warn('⚠️ Erro ao remover duplas:', resultadoDuplas.message);
          // Continua mesmo se houver erro nas duplas
        }
      } catch (duplasError) {
        console.warn('⚠️ Erro ao remover duplas da pirâmide:', duplasError);
        // Continua mesmo se houver erro
      }

      // ✅ ETAPA 2: Excluir configuração da pirâmide
      console.log('⚙️ Etapa 2/4: Removendo configuração da pirâmide...');
      try {
        // Importar ConfiguracaoService dinamicamente para evitar dependência circular
        const { ConfiguracaoService } = await import('./configuracao');
        const configuracaoService = new ConfiguracaoService(this.firebase, this);
        
        const configResult = await configuracaoService.excluirConfiguracaoPiramide(piramideId);
        
        if (configResult.success) {
          console.log('✅ Configuração da pirâmide removida');
        } else {
          console.warn('⚠️ Configuração não encontrada ou erro ao remover:', configResult.message);
          // Continua mesmo se não encontrar configuração
        }
      } catch (configError) {
        console.warn('⚠️ Erro ao remover configuração:', configError);
        // Continua mesmo se houver erro na configuração
      }

      // ✅ ETAPA 3: Verificar e alterar pirâmide atual se necessário
      console.log('🔄 Etapa 3/4: Verificando pirâmide atual...');
      if (this.piramideAtual?.id === piramideId) {
        console.log('📍 Pirâmide sendo excluída é a atual, selecionando outra...');
        
        // Tentar selecionar uma pirâmide ativa
        if (piramidesAtivas.success && piramidesAtivas.data && piramidesAtivas.data.length > 0) {
          const novaPiramide = piramidesAtivas.data.find(p => p.id !== piramideId);
          if (novaPiramide) {
            await this.selecionarPiramide(novaPiramide.id);
            console.log('✅ Nova pirâmide selecionada:', novaPiramide.nome);
          }
        } 
        // Se não há ativas, tentar pausadas
        else if (piramidesPausadas.success && piramidesPausadas.data && piramidesPausadas.data.length > 0) {
          const novaPiramide = piramidesPausadas.data.find(p => p.id !== piramideId);
          if (novaPiramide) {
            await this.selecionarPiramide(novaPiramide.id);
            console.log('✅ Nova pirâmide selecionada (pausada):', novaPiramide.nome);
          }
        } 
        // Última opção: limpar pirâmide atual
        else {
          this.piramideAtual = null;
          this.piramideAtualSubject.next(null);
          
          try {
            await this.firebase.update('configuracoes', 'global', { piramideAtualId: null });
            console.log('✅ Configuração global limpa');
          } catch (globalError) {
            console.warn('⚠️ Erro ao limpar configuração global:', globalError);
          }
        }
      }

      // ✅ ETAPA 4: Excluir a pirâmide
      console.log('🗑️ Etapa 4/4: Excluindo a pirâmide...');
      const deleteResult = await this.firebase.delete('piramides', piramideId);

      if (deleteResult.success) {
        // ✅ ETAPA 5: Limpeza final
        console.log('🧹 Etapa 5/4: Limpeza final...');
        
        // Limpar cache
        await this.limparCache();
        
        // Remover da configuração global se ainda estiver referenciada
        try {
          const configGlobal = await this.firebase.get('configuracoes', 'global');
          if (configGlobal.success && configGlobal.data?.piramideAtualId === piramideId) {
            await this.firebase.update('configuracoes', 'global', { piramideAtualId: null });
          }
        } catch (cleanupError) {
          console.warn('⚠️ Erro na limpeza da configuração global:', cleanupError);
        }

        console.log('✅ Pirâmide excluída com sucesso em cascata');

        return {
          success: true,
          message: `Pirâmide "${piramide.nome}" foi excluída permanentemente junto com todas as suas duplas e configurações`
        };
      } else {
        return {
          success: false,
          message: deleteResult.error || 'Erro ao excluir pirâmide'
        };
      }
    } catch (error: any) {
      console.error('❌ Erro na exclusão em cascata da pirâmide:', error);
      return {
        success: false,
        message: 'Erro ao excluir pirâmide. Alguns dados podem não ter sido removidos completamente.'
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

  // ========== MÉTODO PARA LIMPEZA GERAL DO SISTEMA ==========
  async limparDadosOrfaos(): Promise<{
    success: boolean;
    message: string;
    detalhes: {
      configuracoesLimpas: number;
      duplasLimpas: number;
      erros: string[];
    };
  }> {
    try {
      console.log('🧹 Iniciando limpeza geral de dados órfãos...');
      
      const erros: string[] = [];
      let configuracoesLimpas = 0;
      let duplasLimpas = 0;

      // ✅ ETAPA 1: Buscar todas as pirâmides válidas
      const piramidesResult = await this.firebase.getAll('piramides');
      const piramidesValidas = new Set(
        piramidesResult.success && piramidesResult.data 
          ? piramidesResult.data.map(p => p.id)
          : []
      );

      console.log(`📊 ${piramidesValidas.size} pirâmide(s) válida(s) encontrada(s)`);

      // ✅ ETAPA 2: Limpar configurações órfãs
      try {
        const { ConfiguracaoService } = await import('./configuracao');
        const configuracaoService = new ConfiguracaoService(this.firebase, this);
        
        const limpezaConfig = await configuracaoService.limparConfiguracaoOrfas();
        
        if (limpezaConfig.success) {
          configuracoesLimpas = limpezaConfig.limpas;
          console.log(`✅ ${configuracoesLimpas} configuração(ões) órfã(s) limpa(s)`);
        } else {
          erros.push(`Erro na limpeza de configurações: ${limpezaConfig.message}`);
        }
      } catch (configError) {
        erros.push(`Erro ao limpar configurações órfãs: ${configError}`);
        console.error('❌ Erro ao limpar configurações órfãs:', configError);
      }

      // ✅ ETAPA 3: Limpar duplas órfãs
      try {
        const { DuplasService } = await import('./duplas');
        const duplasService = new DuplasService(this, this.firebase);
        
        // Buscar todas as duplas
        const duplasResult = await this.firebase.getAll('duplas');
        
        if (duplasResult.success && duplasResult.data) {
          // Encontrar duplas de pirâmides que não existem mais
          const duplasOrfas = duplasResult.data.filter(dupla => 
            dupla.piramideId && !piramidesValidas.has(dupla.piramideId)
          );
          
          console.log(`📊 ${duplasOrfas.length} dupla(s) órfã(s) encontrada(s)`);
          
          if (duplasOrfas.length > 0) {
            // Agrupar por pirâmide para limpeza eficiente
            const duplasPorPiramide = new Map<string, any[]>();
            
            duplasOrfas.forEach(dupla => {
              if (!duplasPorPiramide.has(dupla.piramideId)) {
                duplasPorPiramide.set(dupla.piramideId, []);
              }
              duplasPorPiramide.get(dupla.piramideId)!.push(dupla);
            });
            
            // Limpar duplas por pirâmide órfã
            for (const [piramideOrfaId, duplas] of duplasPorPiramide) {
              try {
                const resultado = await duplasService.excluirTodasDuplasPiramide(piramideOrfaId);
                if (resultado.success) {
                  duplasLimpas += resultado.duplasRemovidas;
                  console.log(`✅ ${resultado.duplasRemovidas} dupla(s) da pirâmide órfã ${piramideOrfaId} limpa(s)`);
                } else {
                  erros.push(`Erro ao limpar duplas da pirâmide órfã ${piramideOrfaId}: ${resultado.message}`);
                }
              } catch (duplaError) {
                erros.push(`Erro ao processar duplas da pirâmide órfã ${piramideOrfaId}: ${duplaError}`);
              }
            }
          }
        }
      } catch (duplaError) {
        erros.push(`Erro ao limpar duplas órfãs: ${duplaError}`);
        console.error('❌ Erro ao limpar duplas órfãs:', duplaError);
      }

      // ✅ ETAPA 4: Limpar referências na configuração global
      try {
        const configGlobal = await this.firebase.get('configuracoes', 'global');
        
        if (configGlobal.success && configGlobal.data?.piramideAtualId) {
          const piramideAtualId = configGlobal.data.piramideAtualId;
          
          // Verificar se a pirâmide atual ainda existe
          if (!piramidesValidas.has(piramideAtualId)) {
            console.log('🔄 Pirâmide atual não existe mais, limpando referência...');
            
            // Tentar selecionar uma pirâmide válida
            if (piramidesValidas.size > 0) {
              const primeiraPiramideValida = Array.from(piramidesValidas)[0];
              await this.selecionarPiramide(primeiraPiramideValida);
              console.log('✅ Nova pirâmide atual selecionada automaticamente');
            } else {
              // Não há pirâmides válidas, limpar configuração
              await this.firebase.update('configuracoes', 'global', { piramideAtualId: null });
              this.piramideAtual = null;
              this.piramideAtualSubject.next(null);
              console.log('✅ Configuração global limpa (nenhuma pirâmide válida)');
            }
          }
        }
      } catch (globalError) {
        erros.push(`Erro ao limpar configuração global: ${globalError}`);
        console.error('❌ Erro ao limpar configuração global:', globalError);
      }

      // ✅ ETAPA 5: Limpar cache
      await this.limparCache();

      // ✅ RESUMO FINAL
      const temErros = erros.length > 0;
      const totalLimpezas = configuracoesLimpas + duplasLimpas;
      
      let mensagem = '';
      if (totalLimpezas === 0 && !temErros) {
        mensagem = 'Sistema limpo! Nenhum dado órfão encontrado.';
      } else if (totalLimpezas > 0 && !temErros) {
        mensagem = `Limpeza concluída com sucesso! ${configuracoesLimpas} configuração(ões) e ${duplasLimpas} dupla(s) órfã(s) removida(s).`;
      } else if (totalLimpezas > 0 && temErros) {
        mensagem = `Limpeza parcialmente concluída. ${configuracoesLimpas} configuração(ões) e ${duplasLimpas} dupla(s) órfã(s) removida(s), mas ${erros.length} erro(s) encontrado(s).`;
      } else {
        mensagem = `Limpeza falhou. ${erros.length} erro(s) encontrado(s).`;
      }

      console.log('📋 Resultado da limpeza:', {
        configuracoesLimpas,
        duplasLimpas,
        erros: erros.length,
        mensagem
      });

      return {
        success: totalLimpezas > 0 || !temErros,
        message: mensagem,
        detalhes: {
          configuracoesLimpas,
          duplasLimpas,
          erros
        }
      };
    } catch (error) {
      console.error('❌ Erro crítico na limpeza geral:', error);
      return {
        success: false,
        message: 'Erro crítico na limpeza geral do sistema',
        detalhes: {
          configuracoesLimpas: 0,
          duplasLimpas: 0,
          erros: [`Erro crítico: ${error}`]
        }
      };
    }
  }

  // ========== MÉTODO PARA VALIDAÇÃO DE INTEGRIDADE ==========
  async validarIntegridadeSistema(): Promise<{
    success: boolean;
    problemas: string[];
    sugestoes: string[];
    estatisticas: {
      totalPiramides: number;
      totalDuplas: number;
      totalConfiguracoes: number;
      duplasOrfas: number;
      configuracoesOrfas: number;
    };
  }> {
    try {
      console.log('🔍 Iniciando validação de integridade do sistema...');
      
      const problemas: string[] = [];
      const sugestoes: string[] = [];

      // ✅ ESTATÍSTICAS BÁSICAS
      const piramidesResult = await this.firebase.getAll('piramides');
      const duplasResult = await this.firebase.getAll('duplas');
      const configuracoesResult = await this.firebase.getAll('configuracoes-piramide');

      const totalPiramides = piramidesResult.success ? (piramidesResult.data?.length || 0) : 0;
      const totalDuplas = duplasResult.success ? (duplasResult.data?.length || 0) : 0;
      const totalConfiguracoes = configuracoesResult.success ? (configuracoesResult.data?.length || 0) : 0;

      const piramidesValidas = new Set(
        piramidesResult.success && piramidesResult.data 
          ? piramidesResult.data.map(p => p.id)
          : []
      );

      // ✅ VERIFICAR DUPLAS ÓRFÃS
      let duplasOrfas = 0;
      if (duplasResult.success && duplasResult.data) {
        duplasOrfas = duplasResult.data.filter(dupla => 
          dupla.piramideId && !piramidesValidas.has(dupla.piramideId)
        ).length;
        
        if (duplasOrfas > 0) {
          problemas.push(`${duplasOrfas} dupla(s) órfã(s) encontrada(s) (referenciando pirâmides inexistentes)`);
          sugestoes.push('Execute a limpeza automática para remover duplas órfãs');
        }
      }

      // ✅ VERIFICAR CONFIGURAÇÕES ÓRFÃS
      let configuracoesOrfas = 0;
      if (configuracoesResult.success && configuracoesResult.data) {
        configuracoesOrfas = configuracoesResult.data.filter(config => 
          !piramidesValidas.has(config.id)
        ).length;
        
        if (configuracoesOrfas > 0) {
          problemas.push(`${configuracoesOrfas} configuração(ões) órfã(s) encontrada(s)`);
          sugestoes.push('Execute a limpeza automática para remover configurações órfãs');
        }
      }

      // ✅ VERIFICAR PIRÂMIDE ATUAL
      try {
        const configGlobal = await this.firebase.get('configuracoes', 'global');
        
        if (configGlobal.success && configGlobal.data?.piramideAtualId) {
          const piramideAtualId = configGlobal.data.piramideAtualId;
          
          if (!piramidesValidas.has(piramideAtualId)) {
            problemas.push('Pirâmide atual configurada não existe mais');
            sugestoes.push('Selecione uma pirâmide válida ou execute a limpeza automática');
          }
        } else if (totalPiramides > 0) {
          problemas.push('Nenhuma pirâmide atual configurada, mas existem pirâmides no sistema');
          sugestoes.push('Selecione uma pirâmide como atual');
        }
      } catch (globalError) {
        problemas.push('Erro ao verificar configuração global');
      }

      // ✅ VERIFICAR PIRÂMIDES SEM CONFIGURAÇÃO
      if (piramidesResult.success && piramidesResult.data && configuracoesResult.success) {
        const configuracoesExistentes = new Set(
          configuracoesResult.data?.map(c => c.id) || []
        );
        
        const piramidesSemConfig = piramidesResult.data.filter(p => 
          !configuracoesExistentes.has(p.id)
        );
        
        if (piramidesSemConfig.length > 0) {
          problemas.push(`${piramidesSemConfig.length} pirâmide(s) sem configuração`);
          sugestoes.push('As configurações serão criadas automaticamente quando necessário');
        }
      }

      // ✅ VERIFICAR CONSISTÊNCIA DE DADOS
      if (totalPiramides === 0 && (totalDuplas > 0 || totalConfiguracoes > 0)) {
        problemas.push('Sistema inconsistente: duplas ou configurações existem sem pirâmides');
        sugestoes.push('Execute a limpeza automática ou crie pelo menos uma pirâmide');
      }

      const estatisticas = {
        totalPiramides,
        totalDuplas,
        totalConfiguracoes,
        duplasOrfas,
        configuracoesOrfas
      };

      console.log('📊 Validação concluída:', {
        problemas: problemas.length,
        sugestoes: sugestoes.length,
        estatisticas
      });

      return {
        success: problemas.length === 0,
        problemas,
        sugestoes,
        estatisticas
      };
    } catch (error) {
      console.error('❌ Erro na validação de integridade:', error);
      return {
        success: false,
        problemas: [`Erro na validação: ${error}`],
        sugestoes: ['Tente novamente ou contate o suporte'],
        estatisticas: {
          totalPiramides: 0,
          totalDuplas: 0,
          totalConfiguracoes: 0,
          duplasOrfas: 0,
          configuracoesOrfas: 0
        }
      };
    }
  }

  // ========== MÉTODO PARA RELATÓRIO DE SISTEMA ==========
  async gerarRelatorioSistema(): Promise<{
    timestamp: Date;
    integridade: any;
    diagnosticos: any;
    recomendacoes: string[];
  }> {
    try {
      console.log('📋 Gerando relatório completo do sistema...');
      
      // Executar validação de integridade
      const integridade = await this.validarIntegridadeSistema();
      
      // Obter diagnósticos do Firebase
      const diagnosticos = await this.getDiagnostics();
      
      // Gerar recomendações baseadas nos problemas encontrados
      const recomendacoes: string[] = [];
      
      if (integridade.problemas.length > 0) {
        recomendacoes.push('🧹 Execute a limpeza automática para resolver problemas de dados órfãos');
      }
      
      if (integridade.estatisticas.totalPiramides === 0) {
        recomendacoes.push('🏗️ Crie pelo menos uma pirâmide para começar a usar o sistema');
      }
      
      if (!diagnosticos.firebaseStatus.isOnline) {
        recomendacoes.push('🔌 Verifique a conexão com o Firebase');
      }
      
      if (recomendacoes.length === 0) {
        recomendacoes.push('✅ Sistema funcionando corretamente');
      }

      const relatorio = {
        timestamp: new Date(),
        integridade,
        diagnosticos,
        recomendacoes
      };

      console.log('✅ Relatório gerado com sucesso');
      return relatorio;
    } catch (error) {
      console.error('❌ Erro ao gerar relatório:', error);
      return {
        timestamp: new Date(),
        integridade: { success: false, problemas: [`Erro: ${error}`], sugestoes: [], estatisticas: {} },
        diagnosticos: { error },
        recomendacoes: ['❌ Erro ao gerar relatório - tente novamente']
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