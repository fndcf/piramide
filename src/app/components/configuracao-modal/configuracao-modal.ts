import { Component, EventEmitter, Input, Output, OnInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfiguracaoService } from '../../services/configuracao';
import { NovaConfiguracao } from '../../models/configuracao.model';

@Component({
  selector: 'app-configuracao-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './configuracao-modal.html',
  styleUrls: ['./configuracao-modal.scss']
})
export class ConfiguracaoModalComponent implements OnInit, OnChanges {
  @Input() mostrar = false;
  @Output() fechar = new EventEmitter<void>();
  @Output() configuracaoAtualizada = new EventEmitter<void>();

  posicaoLimite = 5; // Padrão
  loading = false;
  mensagem = '';
  tipoMensagem: 'success' | 'error' = 'success';

  constructor(private configuracaoService: ConfiguracaoService) {}

  async ngOnInit() {
    if (this.mostrar) {
      await this.carregarConfiguracao();
    }
  }

  async ngOnChanges() {
    if (this.mostrar) {
      await this.carregarConfiguracao();
    }
  }

  async carregarConfiguracao() {
    try {
      const config = await this.configuracaoService.obterConfiguracao();
      this.posicaoLimite = config.posicaoLimiteDesafioTopo;
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
    }
  }

  async onSalvar() {
    this.loading = true;
    this.mensagem = '';

    const novaConfig: NovaConfiguracao = {
      posicaoLimiteDesafioTopo: this.posicaoLimite
    };

    const resultado = await this.configuracaoService.atualizarConfiguracao(novaConfig);
    
    if (resultado.success) {
      this.mostrarMensagem(resultado.message, 'success');
      this.configuracaoAtualizada.emit();
      
      // Fechar modal após 2 segundos
      setTimeout(() => {
        this.fecharModal();
      }, 2000);
    } else {
      this.mostrarMensagem(resultado.message, 'error');
    }
    
    this.loading = false;
  }

  fecharModal() {
    this.mostrar = false;
    this.fechar.emit();
    this.mensagem = '';
  }

  private mostrarMensagem(mensagem: string, tipo: 'success' | 'error') {
    this.mensagem = mensagem;
    this.tipoMensagem = tipo;
  }

  // ✅ CORRIGIDO: Agora mostra exemplos para lógica "ATÉ"
  getExemplosConfiguracao(): {posicaoComExcecao: number[], posicaoSemExcecao: number[], temExcecao: boolean} {
    if (this.posicaoLimite <= 1) {
      return {
        posicaoComExcecao: [],
        posicaoSemExcecao: [],
        temExcecao: false
      };
    }
    
    // Gerar lista de posições que TÊM exceção (do 2º até o limite)
    const comExcecao = [];
    for (let i = 2; i <= this.posicaoLimite; i++) {
      comExcecao.push(i);
    }
    
    // Gerar lista de posições que NÃO têm exceção (a partir do limite + 1)
    const semExcecao = [];
    for (let i = this.posicaoLimite + 1; i <= this.posicaoLimite + 3; i++) {
      semExcecao.push(i);
    }
    
    return {
      posicaoComExcecao: comExcecao,
      posicaoSemExcecao: semExcecao,
      temExcecao: true
    };
  }
}