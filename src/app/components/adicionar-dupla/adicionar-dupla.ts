// src/app/components/adicionar-dupla/adicionar-dupla.ts - CORRIGIDO COM VALIDAÇÕES

import { Component, EventEmitter, Input, Output } from '@angular/core';
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
    email: '',
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

  // ✅ NOVA FUNÇÃO: Validar telefone
  private validarTelefone(): boolean {
    const validacao = this.duplasService.validarFormatoTelefone(this.novaDupla.telefone!);
    
    if (!validacao.valido) {
      this.mostrarMensagem(`Telefone inválido: ${validacao.motivo}`, 'error');
      return false;
    }

    return true;
  }

  // ✅ NOVA FUNÇÃO: Validação em tempo real do telefone
  onTelefoneChange() {
    if (this.novaDupla.telefone && this.novaDupla.telefone.trim()) {
      const validacao = this.duplasService.validarFormatoTelefone(this.novaDupla.telefone);
      this.validacoesTelefone = {
        formatoValido: validacao.valido,
        motivo: validacao.motivo || ''
      };
    } else {
      this.validacoesTelefone = {
        formatoValido: true,
        motivo: ''
      };
    }
  }

  // ✅ MELHORAR formatação do telefone
  formatarTelefone(event: any) {
    let valor = event.target.value.replace(/\D/g, '');
    
    // Limitar a 11 dígitos
    if (valor.length > 11) {
      valor = valor.substring(0, 11);
    }
    
    // Formatar conforme o tamanho
    if (valor.length <= 2) {
      valor = valor.replace(/(\d{0,2})/, '($1');
    } else if (valor.length <= 7) {
      valor = valor.replace(/(\d{2})(\d{0,5})/, '($1) $2');
    } else if (valor.length <= 10) {
      valor = valor.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
    } else {
      valor = valor.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
    }
    
    this.novaDupla.telefone = valor;
    
    // ✅ VALIDAR em tempo real
    this.onTelefoneChange();
  }

  // ✅ NOVA FUNÇÃO: Formatar email em tempo real
  formatarEmail(event: any) {
    // Converter para minúsculas automaticamente
    this.novaDupla.email = event.target.value.toLowerCase().trim();
  }

  // ✅ FUNÇÃO: Validar email (opcional)
  private validarEmail(): boolean {
    if (!this.novaDupla.email || this.novaDupla.email.trim() === '') {
      return true; // Email é opcional
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.novaDupla.email.trim())) {
      this.mostrarMensagem('Formato de email inválido', 'error');
      return false;
    }

    return true;
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
      email: '',
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