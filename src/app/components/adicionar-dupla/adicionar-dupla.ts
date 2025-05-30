import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DuplasService } from '../../services/duplas';
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

  constructor(private duplasService: DuplasService) {}

  async onSubmit() {
    if (!this.novaDupla.jogador1 || !this.novaDupla.jogador2 || !this.novaDupla.telefone) {
      this.mostrarMensagem('Preencha todos os campos obrigatórios', 'error');
      return;
    }

    // Validar se não é a mesma pessoa
    if (this.novaDupla.jogador1.toLowerCase().trim() === this.novaDupla.jogador2.toLowerCase().trim()) {
      this.mostrarMensagem('Os jogadores devem ser pessoas diferentes', 'error');
      return;
    }

    // Verificar capacidade da pirâmide
    const capacidade = await this.duplasService.validarCapacidadePiramide();
    if (!capacidade.podeAdicionar) {
      this.mostrarMensagem(capacidade.message, 'error');
      return;
    }

    this.loading = true;
    this.mensagem = '';

    const resultado = await this.duplasService.criarDupla(this.novaDupla);
    
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
    
    this.loading = false;
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
  }

  private mostrarMensagem(mensagem: string, tipo: 'success' | 'error') {
    this.mensagem = mensagem;
    this.tipoMensagem = tipo;
  }
}