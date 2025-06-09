// src/app/services/configuracao.ts - MIGRADO PARA FIREBASE
import { Injectable } from '@angular/core';
import { ConfiguracaoPiramide, NovaConfiguracao } from '../models/configuracao.model';
import { PiramidesService } from './piramides';
import { FirebaseService } from './firebase';

@Injectable({
  providedIn: 'root'
})
export class ConfiguracaoService {
  // Cache local para performance
  private cache = new Map<string, ConfiguracaoPiramide>();
  private lastUpdate = new Map<string, number>();
  private readonly CACHE_DURATION = 10 * 60 * 1000; // 10 minutos

  constructor(
    private firebase: FirebaseService,
    private piramidesService: PiramidesService
  ) {}

  // ========== OPERAÇÕES PRINCIPAIS ==========

  async obterConfiguracao(piramideId?: string): Promise<ConfiguracaoPiramide> {
    const targetPiramideId = piramideId || this.piramidesService.getPiramideAtualId();
    
    if (!targetPiramideId) {
      console.log('⚠️ Nenhuma pirâmide especificada - retornando configuração padrão');
      return this.getConfiguracaoPadrao();
    }

    // Verificar cache
    const cacheKey = `config_${targetPiramideId}`;
    const now = Date.now();
    
    if (this.cache.has(cacheKey) && 
        (now - (this.lastUpdate.get(cacheKey) || 0)) < this.CACHE_DURATION) {
      console.log('📋 Usando cache da configuração');
      return this.cache.get(cacheKey)!;
    }

    try {
      console.log('🔄 Buscando configuração do Firebase para pirâmide:', targetPiramideId);
      
      const result = await this.firebase.get('configuracoes-piramide', targetPiramideId);
      
      if (result.success && result.data) {
        const config = this.formatarConfiguracao(result.data);
        
        // Atualizar cache
        this.cache.set(cacheKey, config);
        this.lastUpdate.set(cacheKey, now);
        
        console.log('✅ Configuração carregada do Firebase');
        return config;
      } else {
        console.log('⚠️ Configuração não encontrada - criando configuração padrão');
        
        // Criar configuração padrão no Firebase
        const configPadrao = this.getConfiguracaoPadrao(targetPiramideId);
        await this.criarConfiguracaoInicial(targetPiramideId, configPadrao);
        
        return configPadrao;
      }
    } catch (error) {
      console.error('❌ Erro ao buscar configuração do Firebase:', error);
      return this.getConfiguracaoPadrao(targetPiramideId);
    }
  }

  async atualizarConfiguracao(novaConfig: NovaConfiguracao, piramideId?: string): Promise<{ success: boolean, message: string }> {
    const targetPiramideId = piramideId || this.piramidesService.getPiramideAtualId();
    
    if (!targetPiramideId) {
      return {
        success: false,
        message: 'Nenhuma pirâmide selecionada para atualizar configuração'
      };
    }

    try {
      console.log('⚙️ Atualizando configuração no Firebase:', targetPiramideId, novaConfig);

      // Validar se a pirâmide existe e permite modificações
      const piramides = await this.piramidesService.obterPiramides();
      const piramide = piramides.find(p => p.id === targetPiramideId);
      
      if (!piramide) {
        return {
          success: false,
          message: 'Pirâmide não encontrada'
        };
      }

      // Verificar se pode modificar configurações
      const podeModificar = this.piramidesService.isPiramideEditavel(targetPiramideId);
      if (!podeModificar) {
        return {
          success: false,
          message: 'Esta pirâmide não pode ter suas configurações alteradas no momento'
        };
      }

      // Buscar configuração atual para preservar dados
      const configAtual = await this.obterConfiguracao(targetPiramideId);
      
      // Preparar dados para atualização
      const dadosAtualizacao = {
        id: targetPiramideId,
        posicaoLimiteDesafioTopo: novaConfig.posicaoLimiteDesafioTopo,
        criadoPor: configAtual.criadoPor || 'admin',
        dataAtualizacao: new Date(),
        piramideId: targetPiramideId,
        versao: (configAtual as any).versao ? (configAtual as any).versao + 1 : 1
      };

      // Atualizar no Firebase
      const result = await this.firebase.set('configuracoes-piramide', targetPiramideId, dadosAtualizacao);
      
      if (result.success) {
        // Limpar cache para forçar reload
        this.limparCache(targetPiramideId);
        
        // Também atualizar a configuração na própria pirâmide
        await this.atualizarConfiguracaoNaPiramide(targetPiramideId, novaConfig);
        
        console.log('✅ Configuração atualizada no Firebase com sucesso');
        return {
          success: true,
          message: 'Configuração atualizada com sucesso!'
        };
      } else {
        return {
          success: false,
          message: result.error || 'Erro ao atualizar configuração no Firebase'
        };
      }
    } catch (error) {
      console.error('❌ Erro ao atualizar configuração:', error);
      return {
        success: false,
        message: 'Erro ao atualizar configuração. Tente novamente.'
      };
    }
  }

  // ========== OPERAÇÕES AUXILIARES ==========

  private async criarConfiguracaoInicial(piramideId: string, config: ConfiguracaoPiramide): Promise<void> {
    try {
      console.log('🆕 Criando configuração inicial no Firebase para pirâmide:', piramideId);
      
      const result = await this.firebase.set('configuracoes-piramide', piramideId, {
        ...config,
        piramideId: piramideId,
        versao: 1
      });
      
      if (result.success) {
        console.log('✅ Configuração inicial criada no Firebase');
      } else {
        console.error('❌ Erro ao criar configuração inicial:', result.error);
      }
    } catch (error) {
      console.error('❌ Erro ao criar configuração inicial:', error);
    }
  }

  private async atualizarConfiguracaoNaPiramide(piramideId: string, novaConfig: NovaConfiguracao): Promise<void> {
    try {
      console.log('🔄 Atualizando configuração na pirâmide:', piramideId);
      
      // Atualizar a configuração diretamente na pirâmide também
      const result = await this.firebase.update('piramides', piramideId, {
        'configuracao.posicaoLimiteDesafioTopo': novaConfig.posicaoLimiteDesafioTopo,
        'configuracao.ultimaAtualizacao': new Date()
      });
      
      if (result.success) {
        console.log('✅ Configuração da pirâmide atualizada');
      }
    } catch (error) {
      console.error('❌ Erro ao atualizar configuração na pirâmide:', error);
    }
  }

  // ========== CONFIGURAÇÕES ESPECÍFICAS POR PIRÂMIDE ==========

  async obterConfiguracoesPorPiramide(piramideIds: string[]): Promise<Map<string, ConfiguracaoPiramide>> {
    const configuracoes = new Map<string, ConfiguracaoPiramide>();
    
    try {
      console.log('📊 Buscando configurações para múltiplas pirâmides:', piramideIds.length);
      
      // Buscar configurações em paralelo
      const promises = piramideIds.map(async (piramideId) => {
        const config = await this.obterConfiguracao(piramideId);
        return { piramideId, config };
      });
      
      const resultados = await Promise.all(promises);
      
      resultados.forEach(({ piramideId, config }) => {
        configuracoes.set(piramideId, config);
      });
      
      console.log(`✅ ${configuracoes.size} configuração(ões) carregada(s)`);
    } catch (error) {
      console.error('❌ Erro ao buscar configurações múltiplas:', error);
    }
    
    return configuracoes;
  }

  async copiarConfiguracaoEntrePiramides(piramideOrigemId: string, piramideDestinoId: string): Promise<{ success: boolean, message: string }> {
    try {
      console.log('📋 Copiando configuração entre pirâmides:', piramideOrigemId, '->', piramideDestinoId);
      
      // Buscar configuração da pirâmide origem
      const configOrigem = await this.obterConfiguracao(piramideOrigemId);
      
      // Criar nova configuração para destino
      const novaConfig: NovaConfiguracao = {
        posicaoLimiteDesafioTopo: configOrigem.posicaoLimiteDesafioTopo
      };
      
      // Aplicar na pirâmide destino
      const result = await this.atualizarConfiguracao(novaConfig, piramideDestinoId);
      
      if (result.success) {
        console.log('✅ Configuração copiada com sucesso');
        return {
          success: true,
          message: `Configuração copiada da pirâmide origem para destino com sucesso!`
        };
      } else {
        return result;
      }
    } catch (error) {
      console.error('❌ Erro ao copiar configuração:', error);
      return {
        success: false,
        message: 'Erro ao copiar configuração entre pirâmides'
      };
    }
  }

  // ========== HISTÓRICO DE CONFIGURAÇÕES ==========

  async obterHistoricoConfiguracoes(piramideId: string): Promise<ConfiguracaoPiramide[]> {
    try {
      console.log('📜 Buscando histórico de configurações para pirâmide:', piramideId);
      
      // Implementar busca por histórico se necessário
      // Por enquanto, retorna apenas a configuração atual
      const configAtual = await this.obterConfiguracao(piramideId);
      return [configAtual];
    } catch (error) {
      console.error('❌ Erro ao buscar histórico:', error);
      return [];
    }
  }

  // ========== UTILITÁRIOS ==========

  getPosicaoLimiteDesafioTopo(piramideId?: string): number {
    const targetPiramideId = piramideId || this.piramidesService.getPiramideAtualId();
    
    if (!targetPiramideId) {
      return 5; // Padrão
    }

    // Buscar do cache primeiro
    const cacheKey = `config_${targetPiramideId}`;
    const configCache = this.cache.get(cacheKey);
    
    if (configCache) {
      return configCache.posicaoLimiteDesafioTopo;
    }

    // Se não tem cache, usar padrão (será carregado async)
    return 5;
  }

  async validarConfiguracao(config: NovaConfiguracao): Promise<{ valida: boolean; erros: string[] }> {
    const erros: string[] = [];

    // Validar posição limite
    if (config.posicaoLimiteDesafioTopo < 1) {
      erros.push('Posição limite deve ser pelo menos 1');
    }

    if (config.posicaoLimiteDesafioTopo > 15) {
      erros.push('Posição limite não pode ser maior que 15');
    }

    return {
      valida: erros.length === 0,
      erros
    };
  }

  private formatarConfiguracao(data: any): ConfiguracaoPiramide {
    return {
      id: data.id || data.piramideId,
      posicaoLimiteDesafioTopo: data.posicaoLimiteDesafioTopo || 5,
      criadoPor: data.criadoPor || 'admin',
      dataAtualizacao: data.dataAtualizacao?.toDate ? data.dataAtualizacao.toDate() : new Date(data.dataAtualizacao || Date.now())
    };
  }

  private getConfiguracaoPadrao(piramideId?: string): ConfiguracaoPiramide {
    return {
      id: piramideId || 'default',
      posicaoLimiteDesafioTopo: 5, // Padrão: a partir do 5º colocado pode desafiar até o topo
      criadoPor: 'admin',
      dataAtualizacao: new Date()
    };
  }

  // ========== GERENCIAMENTO DE CACHE ==========

  private limparCache(piramideId?: string): void {
    if (piramideId) {
      const cacheKey = `config_${piramideId}`;
      this.cache.delete(cacheKey);
      this.lastUpdate.delete(cacheKey);
      console.log('🧹 Cache de configuração limpo para pirâmide:', piramideId);
    } else {
      this.cache.clear();
      this.lastUpdate.clear();
      console.log('🧹 Todo cache de configurações limpo');
    }
  }

  limparCacheTodasConfiguracoes(): void {
    this.limparCache();
  }

  // ========== OPERAÇÕES BATCH ==========

  async atualizarConfiguracoesEmLote(atualizacoes: { piramideId: string; config: NovaConfiguracao }[]): Promise<{ success: boolean; message: string; resultados: { piramideId: string; sucesso: boolean }[] }> {
    try {
      console.log('📦 Atualizando configurações em lote:', atualizacoes.length, 'pirâmides');
      
      const resultados: { piramideId: string; sucesso: boolean }[] = [];
      let sucessos = 0;
      
      // Processar atualizações em paralelo
      const promises = atualizacoes.map(async ({ piramideId, config }) => {
        try {
          const resultado = await this.atualizarConfiguracao(config, piramideId);
          resultados.push({ piramideId, sucesso: resultado.success });
          if (resultado.success) sucessos++;
          return resultado;
        } catch (error) {
          resultados.push({ piramideId, sucesso: false });
          return { success: false, message: 'Erro interno' };
        }
      });
      
      await Promise.all(promises);
      
      console.log(`✅ ${sucessos}/${atualizacoes.length} configurações atualizadas com sucesso`);
      
      return {
        success: sucessos > 0,
        message: `${sucessos}/${atualizacoes.length} configurações atualizadas com sucesso`,
        resultados
      };
    } catch (error) {
      console.error('❌ Erro ao atualizar configurações em lote:', error);
      return {
        success: false,
        message: 'Erro ao atualizar configurações em lote',
        resultados: []
      };
    }
  }

  // ========== EXPORTAÇÃO/IMPORTAÇÃO ==========

  async exportarConfiguracoes(piramideIds?: string[]): Promise<{ piramideId: string; configuracao: ConfiguracaoPiramide }[]> {
    try {
      const ids = piramideIds || [this.piramidesService.getPiramideAtualId()].filter(Boolean) as string[];
      
      console.log('📤 Exportando configurações:', ids.length, 'pirâmides');
      
      const configuracoes = await this.obterConfiguracoesPorPiramide(ids);
      
      const resultado = Array.from(configuracoes.entries()).map(([piramideId, configuracao]) => ({
        piramideId,
        configuracao
      }));
      
      console.log(`✅ ${resultado.length} configuração(ões) exportada(s)`);
      return resultado;
    } catch (error) {
      console.error('❌ Erro ao exportar configurações:', error);
      return [];
    }
  }

  async importarConfiguracoes(dados: { piramideId: string; configuracao: Partial<NovaConfiguracao> }[]): Promise<{ success: boolean; message: string }> {
    try {
      console.log('📥 Importando configurações:', dados.length, 'pirâmides');
      
      const atualizacoes = dados.map(({ piramideId, configuracao }) => ({
        piramideId,
        config: {
          posicaoLimiteDesafioTopo: configuracao.posicaoLimiteDesafioTopo || 5
        }
      }));
      
      const resultado = await this.atualizarConfiguracoesEmLote(atualizacoes);
      
      console.log(`✅ Importação concluída: ${resultado.message}`);
      return {
        success: resultado.success,
        message: `Configurações importadas: ${resultado.message}`
      };
    } catch (error) {
      console.error('❌ Erro ao importar configurações:', error);
      return {
        success: false,
        message: 'Erro ao importar configurações'
      };
    }
  }

  // ========== RESET E LIMPEZA ==========

  async resetarConfiguracaoPiramide(piramideId: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log('🔄 Resetando configuração da pirâmide:', piramideId);
      
      const configPadrao: NovaConfiguracao = {
        posicaoLimiteDesafioTopo: 5
      };
      
      const resultado = await this.atualizarConfiguracao(configPadrao, piramideId);
      
      if (resultado.success) {
        console.log('✅ Configuração resetada para padrão');
        return {
          success: true,
          message: 'Configuração resetada para os valores padrão'
        };
      } else {
        return resultado;
      }
    } catch (error) {
      console.error('❌ Erro ao resetar configuração:', error);
      return {
        success: false,
        message: 'Erro ao resetar configuração'
      };
    }
  }

  async excluirConfiguracaoPiramide(piramideId: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log('🗑️ Excluindo configuração da pirâmide:', piramideId);
      
      const result = await this.firebase.delete('configuracoes-piramide', piramideId);
      
      if (result.success) {
        // Limpar cache
        this.limparCache(piramideId);
        
        console.log('✅ Configuração excluída do Firebase');
        return {
          success: true,
          message: 'Configuração da pirâmide excluída com sucesso'
        };
      } else {
        return {
          success: false,
          message: result.error || 'Erro ao excluir configuração'
        };
      }
    } catch (error) {
      console.error('❌ Erro ao excluir configuração:', error);
      return {
        success: false,
        message: 'Erro ao excluir configuração da pirâmide'
      };
    }
  }
}