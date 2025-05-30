import { Injectable } from '@angular/core';
import { ConfiguracaoPiramide, NovaConfiguracao } from '../models/configuracao.model';

@Injectable({
  providedIn: 'root'
})
export class ConfiguracaoService {
  private configuracao: ConfiguracaoPiramide = {
    id: '1',
    posicaoLimiteDesafioTopo: 5, // Padrão: a partir do 5º colocado pode desafiar até o topo
    criadoPor: 'admin@piramide.com',
    dataAtualizacao: new Date()
  };

  constructor() {
    // Carregar configuração do localStorage se existir
    const configSalva = localStorage.getItem('configPiramide');
    if (configSalva) {
      this.configuracao = JSON.parse(configSalva);
    }
  }

  async obterConfiguracao(): Promise<ConfiguracaoPiramide> {
    await this.delay(100); // Simular delay da API
    return { ...this.configuracao };
  }

  async atualizarConfiguracao(novaConfig: NovaConfiguracao): Promise<{ success: boolean, message: string }> {
    try {
      await this.delay(300); // Simular delay da API
      
      this.configuracao = {
        ...this.configuracao,
        posicaoLimiteDesafioTopo: novaConfig.posicaoLimiteDesafioTopo,
        dataAtualizacao: new Date()
      };

      // Salvar no localStorage
      localStorage.setItem('configPiramide', JSON.stringify(this.configuracao));
      
      return {
        success: true,
        message: 'Configuração atualizada com sucesso!'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Erro ao atualizar configuração. Tente novamente.'
      };
    }
  }

  // Método para facilitar acesso rápido às configurações
  getPosicaoLimiteDesafioTopo(): number {
    return this.configuracao.posicaoLimiteDesafioTopo;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}