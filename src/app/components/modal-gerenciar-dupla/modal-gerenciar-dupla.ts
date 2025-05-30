import { Component, EventEmitter, Input, Output, OnInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DuplasService } from '../../services/duplas';
import { Dupla } from '../../models/dupla.model';

interface EditarDupla {
  id: string;
  jogador1: string;
  jogador2: string;
  telefone: string;
  email: string;
  observacoes: string;
  vitorias: number;
  derrotas: number;
}

@Component({
  selector: 'app-modal-gerenciar-dupla',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './modal-gerenciar-dupla.html',
  styleUrls: ['./modal-gerenciar-dupla.scss']
})
export class ModalGerenciarDuplaComponent implements OnInit, OnChanges {
  @Input() mostrar = false;
  @Input() dupla: Dupla | null = null;
  @Input() todasDuplas: Dupla[] = [];
  @Input() getPosicaoNaPiramide: ((dupla: Dupla) => number) | null = null;
  @Output() fechar = new EventEmitter<void>();
  @Output() duplaAtualizada = new EventEmitter<void>();

  abaSelecionada: 'info' | 'posicao' = 'info';
  loading = false;
  mensagem = '';
  tipoMensagem: 'success' | 'error' = 'success';

  // ✅ CORREÇÃO: Adicionar Math para uso no template
  Math = Math;

  // Dados para edição
  duplaEditada: EditarDupla = {
    id: '',
    jogador1: '',
    jogador2: '',
    telefone: '',
    email: '',
    observacoes: '',
    vitorias: 0,
    derrotas: 0
  };

  // Dados para reposicionamento
  novaPosicao = 1;
  posicaoAtual = 1;
  duplasAfetadas: {dupla: Dupla, posicaoAtual: number, novaPosicao: number}[] = [];

  constructor(private duplasService: DuplasService) {}

  ngOnInit() {
    this.carregarDados();
  }

  ngOnChanges() {
    if (this.mostrar && this.dupla) {
      this.carregarDados();
    }
  }

  carregarDados() {
    if (!this.dupla) return;

    this.duplaEditada = {
      id: this.dupla.id,
      jogador1: this.dupla.jogador1,
      jogador2: this.dupla.jogador2,
      telefone: this.dupla.telefone || '',
      email: this.dupla.email || '',
      observacoes: this.dupla.observacoes || '',
      vitorias: this.dupla.vitorias || 0,
      derrotas: this.dupla.derrotas || 0
    };

    if (this.getPosicaoNaPiramide) {
      this.posicaoAtual = this.getPosicaoNaPiramide(this.dupla);
      this.novaPosicao = this.posicaoAtual;
    }

    this.calcularDuplasAfetadas();
  }

  async onSalvarInformacoes() {
    if (!this.validarDados()) return;

    this.loading = true;
    this.mensagem = '';

    try {
      // Aqui você faria a chamada para o service
      // const resultado = await this.duplasService.atualizarDupla(this.duplaEditada);
      
      // Simulação
      console.log('Atualizando dupla:', this.duplaEditada);
      
      this.mostrarMensagem('Informações atualizadas com sucesso!', 'success');
      this.duplaAtualizada.emit();
      
      setTimeout(() => {
        this.fecharModal();
      }, 2000);
      
    } catch (error) {
      console.error('Erro ao atualizar dupla:', error);
      this.mostrarMensagem('Erro ao atualizar informações. Tente novamente.', 'error');
    }
    
    this.loading = false;
  }

  async onReposicionarDupla() {
    if (this.novaPosicao === this.posicaoAtual) {
      this.mostrarMensagem('A dupla já está nesta posição.', 'error');
      return;
    }

    const confirmar = confirm(
      `Confirma o reposicionamento da dupla ${this.duplaEditada.jogador1}/${this.duplaEditada.jogador2}?\n\n` +
      `De: ${this.posicaoAtual}º lugar\n` +
      `Para: ${this.novaPosicao}º lugar\n\n` +
      `${this.duplasAfetadas.length} dupla(s) serão reposicionadas automaticamente.`
    );

    if (!confirmar) return;

    this.loading = true;
    this.mensagem = '';

    try {
      // Aqui você faria a chamada para o service
      // const resultado = await this.duplasService.reposicionarDupla(this.dupla!.id, this.novaPosicao);
      
      // Simulação
      console.log('Reposicionando dupla:', {
        duplaId: this.dupla!.id,
        posicaoAtual: this.posicaoAtual,
        novaPosicao: this.novaPosicao,
        duplasAfetadas: this.duplasAfetadas
      });
      
      this.mostrarMensagem('Dupla reposicionada com sucesso!', 'success');
      this.duplaAtualizada.emit();
      
      setTimeout(() => {
        this.fecharModal();
      }, 2000);
      
    } catch (error) {
      console.error('Erro ao reposicionar dupla:', error);
      this.mostrarMensagem('Erro ao reposicionar dupla. Tente novamente.', 'error');
    }
    
    this.loading = false;
  }

  calcularDuplasAfetadas() {
    if (!this.getPosicaoNaPiramide || this.novaPosicao === this.posicaoAtual) {
      this.duplasAfetadas = [];
      return;
    }

    const afetadas: {dupla: Dupla, posicaoAtual: number, novaPosicao: number}[] = [];

    if (this.novaPosicao < this.posicaoAtual) {
      // Subindo na pirâmide - duplas entre nova posição e posição atual descem
      for (const dupla of this.todasDuplas) {
        if (dupla.id === this.dupla!.id) continue;
        
        const pos = this.getPosicaoNaPiramide(dupla);
        if (pos >= this.novaPosicao && pos < this.posicaoAtual) {
          afetadas.push({
            dupla,
            posicaoAtual: pos,
            novaPosicao: pos + 1
          });
        }
      }
    } else {
      // Descendo na pirâmide - duplas entre posição atual e nova posição sobem
      for (const dupla of this.todasDuplas) {
        if (dupla.id === this.dupla!.id) continue;
        
        const pos = this.getPosicaoNaPiramide(dupla);
        if (pos > this.posicaoAtual && pos <= this.novaPosicao) {
          afetadas.push({
            dupla,
            posicaoAtual: pos,
            novaPosicao: pos - 1
          });
        }
      }
    }

    this.duplasAfetadas = afetadas.sort((a, b) => a.posicaoAtual - b.posicaoAtual);
  }

  onNovaPosicaoChange() {
    this.calcularDuplasAfetadas();
  }

  validarDados(): boolean {
    if (!this.duplaEditada.jogador1.trim()) {
      this.mostrarMensagem('Nome do Jogador 1 é obrigatório', 'error');
      return false;
    }

    if (!this.duplaEditada.jogador2.trim()) {
      this.mostrarMensagem('Nome do Jogador 2 é obrigatório', 'error');
      return false;
    }

    if (!this.duplaEditada.telefone.trim()) {
      this.mostrarMensagem('Telefone é obrigatório', 'error');
      return false;
    }

    if (this.duplaEditada.jogador1.toLowerCase().trim() === this.duplaEditada.jogador2.toLowerCase().trim()) {
      this.mostrarMensagem('Os jogadores devem ser pessoas diferentes', 'error');
      return false;
    }

    return true;
  }

  formatarTelefone(event: any) {
    let valor = event.target.value.replace(/\D/g, '');
    
    if (valor.length <= 11) {
      if (valor.length <= 2) {
        valor = valor.replace(/(\d{0,2})/, '($1');
      } else if (valor.length <= 7) {
        valor = valor.replace(/(\d{2})(\d{0,5})/, '($1) $2');
      } else {
        valor = valor.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
      }
    }
    
    this.duplaEditada.telefone = valor;
  }

  selecionarAba(aba: 'info' | 'posicao') {
    this.abaSelecionada = aba;
    this.mensagem = '';
  }

  fecharModal() {
    this.mostrar = false;
    this.fechar.emit();
    this.limparDados();
  }

  private limparDados() {
    this.abaSelecionada = 'info';
    this.mensagem = '';
    this.duplasAfetadas = [];
    this.duplaEditada = {
      id: '',
      jogador1: '',
      jogador2: '',
      telefone: '',
      email: '',
      observacoes: '',
      vitorias: 0,
      derrotas: 0
    };
  }

  private mostrarMensagem(mensagem: string, tipo: 'success' | 'error') {
    this.mensagem = mensagem;
    this.tipoMensagem = tipo;
  }

  getTotalDuplas(): number {
    return this.todasDuplas.length;
  }
}