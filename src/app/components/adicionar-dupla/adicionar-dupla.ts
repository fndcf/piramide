// src/app/components/adicionar-dupla/adicionar-dupla.ts - CORRIGIDO COM VALIDAÇÕES

import { Component, EventEmitter, Input, Output, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DuplasService } from '../../services/duplas';
import { PiramidesService } from '../../services/piramides';
import { NovaDupla } from '../../models/dupla.model';

@Component({
  selector: 'app-adicionar-dupla',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './adicionar-dupla.html',
  styleUrls: ['./adicionar-dupla.scss']
})
export class AdicionarDuplaComponent {
  @Input() mostrar = false;
  @Output() fechar = new EventEmitter<void>();
  @Output() duplaAdicionada = new EventEmitter<void>();

  novaDupla: NovaDupla = {
    jogador1: '',
    jogador2: '',
    telefone: '',
    observacoes: ''
  };

  loading = false;
  mensagem = '';
  tipoMensagem: 'success' | 'error' = 'success';

  // ✅ NOVA PROPRIEDADE: Para mostrar validações em tempo real
  validacoesTelefone = {
    formatoValido: true,
    motivo: ''
  };

  constructor(
    private duplasService: DuplasService,
    private piramidesService: PiramidesService
  ) {}

  private telefoneTimeout: any;

  async onSubmit() {
    // ✅ VALIDAÇÕES BÁSICAS MELHORADAS
    if (!this.validarCamposObrigatorios()) {
      return;
    }

    // ✅ VALIDAÇÃO DE TELEFONE APRIMORADA
    if (!this.validarTelefone()) {
      return;
    }

    // ✅ VALIDAÇÃO: Verificar se não é a mesma pessoa
    if (this.novaDupla.jogador1.toLowerCase().trim() === this.novaDupla.jogador2.toLowerCase().trim()) {
      this.mostrarMensagem('Os jogadores devem ser pessoas diferentes', 'error');
      return;
    }

    // ✅ VALIDAÇÃO: Obter ID da pirâmide atual
    const piramideAtualId = this.piramidesService.getPiramideAtualId();
    if (!piramideAtualId) {
      this.mostrarMensagem('Nenhuma pirâmide selecionada. Selecione uma pirâmide primeiro.', 'error');
      return;
    }

    // ✅ VALIDAÇÃO: Verificar capacidade da pirâmide atual
    const capacidade = await this.duplasService.validarCapacidadePiramide(piramideAtualId);
    if (!capacidade.podeAdicionar) {
      this.mostrarMensagem(capacidade.message, 'error');
      return;
    }

    this.loading = true;
    this.mensagem = '';

    try {
      // ✅ CRIAR dupla com validações automáticas do service
      const resultado = await this.duplasService.criarDupla(this.novaDupla, piramideAtualId);
      
      if (resultado.success) {
        this.mostrarMensagem(resultado.message, 'success');
        this.limparFormulario();
        this.duplaAdicionada.emit();
        
        // Fechar modal após 2 segundos
        setTimeout(() => {
          this.fecharModal();
        }, 2000);
      } else {
        this.mostrarMensagem(resultado.message, 'error');
      }
    } catch (error) {
      console.error('Erro ao criar dupla:', error);
      this.mostrarMensagem('Erro inesperado ao criar dupla. Tente novamente.', 'error');
    }
    
    this.loading = false;
  }

  // ✅ NOVA FUNÇÃO: Validar campos obrigatórios
  private validarCamposObrigatorios(): boolean {
    if (!this.novaDupla.jogador1?.trim()) {
      this.mostrarMensagem('Nome do jogador 1 é obrigatório', 'error');
      return false;
    }

    if (this.novaDupla.jogador1.trim().length < 2) {
      this.mostrarMensagem('Nome do jogador 1 deve ter pelo menos 2 caracteres', 'error');
      return false;
    }

    if (!this.novaDupla.jogador2?.trim()) {
      this.mostrarMensagem('Nome do jogador 2 é obrigatório', 'error');
      return false;
    }

    if (this.novaDupla.jogador2.trim().length < 2) {
      this.mostrarMensagem('Nome do jogador 2 deve ter pelo menos 2 caracteres', 'error');
      return false;
    }

    if (!this.novaDupla.telefone?.trim()) {
      this.mostrarMensagem('Telefone é obrigatório', 'error');
      return false;
    }

    return true;
  }

  // ✅ NOVO: Verificar telefone único em tempo real
  async verificarTelefoneUnicoTempoReal() {
    if (!this.novaDupla.telefone || this.novaDupla.telefone.trim().length < 10) {
      return; // Não verifica se telefone muito curto
    }

    try {
      const verificacao = await this.duplasService.verificarTelefoneUnico(this.novaDupla.telefone);
      
      if (!verificacao.unico) {
        this.validacoesTelefone = {
          formatoValido: false,
          motivo: `Telefone já cadastrado para: ${verificacao.dupla!.jogador1}/${verificacao.dupla!.jogador2}`
        };
      } else {
        // Se chegou aqui, telefone é único, verificar formato
        const formatoOk = this.duplasService.validarFormatoTelefone(this.novaDupla.telefone);
        this.validacoesTelefone = {
          formatoValido: formatoOk.valido,
          motivo: formatoOk.motivo || ''
        };
      }
    } catch (error) {
      console.error('Erro ao verificar telefone:', error);
      // Em caso de erro, só valida formato
      const formatoOk = this.duplasService.validarFormatoTelefone(this.novaDupla.telefone);
      this.validacoesTelefone = {
        formatoValido: formatoOk.valido,
        motivo: formatoOk.motivo || ''
      };
    }
  }

  // ✅ NOVA FUNÇÃO: Validar telefone
  private validarTelefone(): boolean {
    const validacao = this.duplasService.validarFormatoTelefone(this.novaDupla.telefone!);
    
    if (!validacao.valido) {
      this.mostrarMensagem(`Telefone inválido: ${validacao.motivo}`, 'error');
      return false;
    }

    return true;
  }

  // ✅ ATUALIZAR: Método onTelefoneChange para incluir verificação de duplicação
  onTelefoneChange() {
    if (this.novaDupla.telefone && this.novaDupla.telefone.trim()) {
      // Primeiro valida formato
      const validacao = this.duplasService.validarFormatoTelefone(this.novaDupla.telefone);
      this.validacoesTelefone = {
        formatoValido: validacao.valido,
        motivo: validacao.motivo || ''
      };

      // Se formato está ok, verifica se é único (com debounce)
      if (validacao.valido) {
        // Usar debounce para não fazer muitas consultas
        clearTimeout(this.telefoneCheckTimeout);
        this.telefoneCheckTimeout = setTimeout(() => {
          this.verificarTelefoneUnicoTempoReal();
        }, 800); // Aguarda 800ms após parar de digitar
      }
    } else {
      this.validacoesTelefone = {
        formatoValido: true,
        motivo: ''
      };
    }
  }

  // ✅ ADICIONAR após o método onTelefoneChange():
  verificarTelefoneComDebounce() {
    if (this.telefoneTimeout) {
      clearTimeout(this.telefoneTimeout);
    }

    this.onTelefoneChange();

    // ✅ CORREÇÃO: Verificar se telefone existe antes de usar
    if (this.validacoesTelefone.formatoValido && 
        this.novaDupla.telefone && 
        this.novaDupla.telefone.trim().length >= 10) {
      this.telefoneTimeout = setTimeout(() => {
        this.verificarTelefoneUnico();
      }, 800);
    }
  }
  
  async verificarTelefoneUnico() {
    // ✅ CORREÇÃO: Verificar se telefone existe antes de usar
    if (!this.novaDupla.telefone || this.novaDupla.telefone.trim().length < 10) {
      return;
    }

    try {
      const verificacao = await this.duplasService.verificarTelefoneUnico(this.novaDupla.telefone);
      
      if (!verificacao.unico && verificacao.dupla) {
        this.validacoesTelefone = {
          formatoValido: false,
          motivo: `Telefone já cadastrado para: ${verificacao.dupla.jogador1}/${verificacao.dupla.jogador2}`
        };
      } else {
        const formatoOk = this.duplasService.validarFormatoTelefone(this.novaDupla.telefone);
        this.validacoesTelefone = {
          formatoValido: formatoOk.valido,
          motivo: formatoOk.motivo || ''
        };
      }
    } catch (error) {
      console.error('❌ Erro ao verificar telefone único:', error);
      // ✅ CORREÇÃO: Verificar se telefone existe antes de validar
      if (this.novaDupla.telefone) {
        const formatoOk = this.duplasService.validarFormatoTelefone(this.novaDupla.telefone);
        this.validacoesTelefone = {
          formatoValido: formatoOk.valido,
          motivo: formatoOk.motivo || ''
        };
      }
    }
  }

  ngOnDestroy() {
    if (this.telefoneTimeout) {
      clearTimeout(this.telefoneTimeout);
    }
  }

  private telefoneCheckTimeout: any;

  // ✅ SUBSTITUIR por esta versão simples
  formatarTelefone(event: any) {
    let valor = event.target.value.replace(/\D/g, '');
    
    if (valor.length > 11) {
      valor = valor.substring(0, 11);
    }
    
    // Formatação visual simples
    if (valor.length >= 10) {
      if (valor.length === 11) {
        valor = valor.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
      } else {
        valor = valor.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
      }
    } else if (valor.length >= 6) {
      valor = valor.replace(/(\d{2})(\d+)/, '($1) $2');
    } else if (valor.length >= 2) {
      valor = valor.replace(/(\d{2})/, '($1) ');
    }
    
    this.novaDupla.telefone = valor;
    this.onTelefoneChange();
  }

  fecharModal() {
    this.mostrar = false;
    this.fechar.emit();
    this.limparFormulario();
    this.mensagem = '';
  }

  private limparFormulario() {
    this.novaDupla = {
      jogador1: '',
      jogador2: '',
      telefone: '',
      observacoes: ''
    };
    
    // ✅ LIMPAR validações
    this.validacoesTelefone = {
      formatoValido: true,
      motivo: ''
    };
  }

  private mostrarMensagem(mensagem: string, tipo: 'success' | 'error') {
    this.mensagem = mensagem;
    this.tipoMensagem = tipo;
  }

  // ✅ GETTER: Para verificar se o formulário está válido
  get formularioValido(): boolean {
    return !!(
      this.novaDupla.jogador1?.trim() &&
      this.novaDupla.jogador2?.trim() &&
      this.novaDupla.telefone?.trim() &&
      this.validacoesTelefone.formatoValido &&
      this.novaDupla.jogador1.trim() !== this.novaDupla.jogador2.trim()
    );
  }
}