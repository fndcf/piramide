// src/app/components/gerenciar-piramides/gerenciar-piramides.ts

import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PiramidesService } from '../../services/piramides';
import { NovaPiramide, Piramide } from '../../models/piramide.model';
import { EstatisticasPiramide, PiramideSeletor } from '../../models/dupla.model';

@Component({
  selector: 'app-gerenciar-piramides',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gerenciar-piramides.html',
  styleUrls: ['./gerenciar-piramides.scss']
})
export class GerenciarPiramidesComponent implements OnInit {
  @Input() mostrar = false;
  @Output() fechar = new EventEmitter<void>();
  @Output() piramideSelecionada = new EventEmitter<Piramide>();

  piramides: PiramideSeletor[] = [];
  piramideAtual: Piramide | null = null;
  loading = false;
  mensagem = '';
  tipoMensagem: 'success' | 'error' | 'info' = 'info';
  
  // Modal de nova pirâmide
  mostrarModalNova = false;
  novaPiramide: NovaPiramide = this.resetarNovaPiramide();
  
  // Modal de edição
  mostrarModalEdicao = false;
  piramideEdicao: Partial<Piramide> = {};
  
  // Modal de estatísticas
  mostrarModalEstatisticas = false;
  estatisticasSelecionada: EstatisticasPiramide | null = null;
  
  // Filtros e busca
  filtroStatus = 'todas';
  filtroCategoria = 'todas';
  termoBusca = '';
  
  // Dados auxiliares
  cores: string[] = [];
  icones: string[] = [];
  categorias: Array<{value: string, label: string, description: string}> = [];

  constructor(private piramidesService: PiramidesService) {
    // Inicializar dados auxiliares no constructor
    this.cores = this.piramidesService.getCoresDisponiveis();
    this.icones = this.piramidesService.getIconesDisponiveis();
    this.categorias = this.piramidesService.getCategorias();
    
    // Agora podemos inicializar novaPiramide com segurança
    this.novaPiramide = this.resetarNovaPiramide();
  }

  async ngOnInit() {
    if (this.mostrar) {
      await this.carregarDados();
    }
  }

  async carregarDados() {
    this.loading = true;
    try {
      this.piramides = await this.piramidesService.obterPiramideSeletor();
      this.piramideAtual = this.piramidesService.getPiramideAtual();
    } catch (error) {
      this.mostrarMensagem('Erro ao carregar pirâmides', 'error');
    }
    this.loading = false;
  }

  // ========== FILTROS E BUSCA ==========
  
  get piramidesFiltradas(): PiramideSeletor[] {
    let resultado = [...this.piramides];
    
    // Filtro por status
    if (this.filtroStatus !== 'todas') {
      resultado = resultado.filter(p => p.status === this.filtroStatus);
    }
    
    // Filtro por categoria
    if (this.filtroCategoria !== 'todas') {
      resultado = resultado.filter(p => p.categoria === this.filtroCategoria);
    }
    
    // Busca por nome
    if (this.termoBusca.trim()) {
      const termo = this.termoBusca.toLowerCase().trim();
      resultado = resultado.filter(p => 
        p.nome.toLowerCase().includes(termo)
      );
    }
    
    return resultado;
  }

  // ========== SELEÇÃO DE PIRÂMIDE ==========
  
  async selecionarPiramide(piramide: PiramideSeletor) {
    if (piramide.id === this.piramideAtual?.id) {
      return; // Já é a atual
    }
    
    this.loading = true;
    const resultado = await this.piramidesService.selecionarPiramide(piramide.id);
    
    if (resultado.success) {
      this.piramideAtual = this.piramidesService.getPiramideAtual();
      this.mostrarMensagem(resultado.message, 'success');
      this.piramideSelecionada.emit(this.piramideAtual!);
    } else {
      this.mostrarMensagem(resultado.message, 'error');
    }
    
    this.loading = false;
  }

  // ========== NOVA PIRÂMIDE ==========
  
  abrirModalNova() {
    // Garantir que os arrays estão carregados
    if (this.cores.length === 0) {
      this.cores = this.piramidesService.getCoresDisponiveis();
    }
    if (this.icones.length === 0) {
      this.icones = this.piramidesService.getIconesDisponiveis();
    }
    if (this.categorias.length === 0) {
      this.categorias = this.piramidesService.getCategorias();
    }
    
    this.novaPiramide = this.resetarNovaPiramide();
    this.mostrarModalNova = true;
    this.mensagem = '';
  }

  async criarPiramide() {
    if (!this.validarNovaPiramide()) {
      return;
    }

    this.loading = true;
    const resultado = await this.piramidesService.criarPiramide(this.novaPiramide);
    
    if (resultado.success) {
      this.mostrarMensagem(resultado.message, 'success');
      await this.carregarDados();
      this.fecharModalNova();
    } else {
      this.mostrarMensagem(resultado.message, 'error');
    }
    
    this.loading = false;
  }

  fecharModalNova() {
    this.mostrarModalNova = false;
    this.novaPiramide = this.resetarNovaPiramide();
    this.mensagem = '';
  }

  private validarNovaPiramide(): boolean {
    if (!this.novaPiramide.nome?.trim()) {
      this.mostrarMensagem('Nome da pirâmide é obrigatório', 'error');
      return false;
    }
    
    if (this.novaPiramide.nome.trim().length < 3) {
      this.mostrarMensagem('Nome deve ter pelo menos 3 caracteres', 'error');
      return false;
    }
    
    if (!this.novaPiramide.categoria) {
      this.mostrarMensagem('Categoria é obrigatória', 'error');
      return false;
    }
    
    return true;
  }

  private resetarNovaPiramide(): NovaPiramide {
    return {
      nome: '',
      descricao: '',
      categoria: 'misto',
      maxDuplas: 45,
      cor: this.cores && this.cores.length > 0 ? this.cores[0] : '#667eea',
      icone: this.icones && this.icones.length > 0 ? this.icones[0] : '🏆'
    };
  }

  // ========== EDIÇÃO DE PIRÂMIDE ==========
  
  abrirModalEdicao(piramide: PiramideSeletor) {
    this.piramideEdicao = {
      id: piramide.id,
      nome: piramide.nome,
      categoria: piramide.categoria as any
    };
    this.mostrarModalEdicao = true;
    this.mensagem = '';
  }

  async salvarEdicao() {
    if (!this.piramideEdicao.nome?.trim()) {
      this.mostrarMensagem('Nome é obrigatório', 'error');
      return;
    }

    this.loading = true;
    const resultado = await this.piramidesService.atualizarPiramide(
      this.piramideEdicao.id!,
      this.piramideEdicao
    );
    
    if (resultado.success) {
      this.mostrarMensagem(resultado.message, 'success');
      await this.carregarDados();
      this.fecharModalEdicao();
    } else {
      this.mostrarMensagem(resultado.message, 'error');
    }
    
    this.loading = false;
  }

  fecharModalEdicao() {
    this.mostrarModalEdicao = false;
    this.piramideEdicao = {};
    this.mensagem = '';
  }

  // ========== AÇÕES DA PIRÂMIDE ==========
  
  async alterarStatus(piramide: PiramideSeletor, novoStatus: Piramide['status']) {
    const confirmacao = confirm(
      `Tem certeza que deseja alterar o status da pirâmide "${piramide.nome}" para "${novoStatus}"?`
    );
    
    if (!confirmacao) return;

    this.loading = true;
    const resultado = await this.piramidesService.alterarStatusPiramide(piramide.id, novoStatus);
    
    if (resultado.success) {
      this.mostrarMensagem(resultado.message, 'success');
      await this.carregarDados();
    } else {
      this.mostrarMensagem(resultado.message, 'error');
    }
    
    this.loading = false;
  }

  async arquivarPiramide(piramide: PiramideSeletor) {
    const confirmacao = confirm(
      `Tem certeza que deseja ARQUIVAR a pirâmide "${piramide.nome}"?\n\n` +
      `Esta ação irá:\n` +
      `• Tornar a pirâmide inacessível\n` +
      `• Manter os dados salvos\n` +
      `• Selecionar outra pirâmide automaticamente se esta for a atual`
    );
    
    if (!confirmacao) return;

    this.loading = true;
    const resultado = await this.piramidesService.arquivarPiramide(piramide.id);
    
    if (resultado.success) {
      this.mostrarMensagem(resultado.message, 'success');
      await this.carregarDados();
    } else {
      this.mostrarMensagem(resultado.message, 'error');
    }
    
    this.loading = false;
  }

  // ========== ESTATÍSTICAS ==========
  
  async abrirEstatisticas(piramide: PiramideSeletor) {
    this.loading = true;
    try {
      this.estatisticasSelecionada = await this.piramidesService.obterEstatisticasPiramide(piramide.id);
      this.mostrarModalEstatisticas = true;
    } catch (error) {
      this.mostrarMensagem('Erro ao carregar estatísticas', 'error');
    }
    this.loading = false;
  }

  fecharModalEstatisticas() {
    this.mostrarModalEstatisticas = false;
    this.estatisticasSelecionada = null;
  }

  // ========== UTILITÁRIOS ==========
  
  getStatusBadgeClass(status: string): string {
    const classes = {
      'ativa': 'status-ativa',
      'pausada': 'status-pausada',
      'finalizada': 'status-finalizada',
      'arquivada': 'status-arquivada'
    };
    return classes[status as keyof typeof classes] || 'status-default';
  }

  getCategoriaNome(categoria: string): string {
    const cat = this.categorias.find(c => c.value === categoria);
    return cat?.label || categoria;
  }

  getCategoriaDescricao(categoria: string): string {
    const cat = this.categorias.find(c => c.value === categoria);
    return cat?.description || '';
  }

  formatarData(data: Date): string {
    return new Date(data).toLocaleDateString('pt-BR');
  }

  isAtual(piramide: PiramideSeletor): boolean {
    return this.piramideAtual?.id === piramide.id;
  }

  fecharModal() {
    this.mostrar = false;
    this.fechar.emit();
    this.mensagem = '';
  }

  private mostrarMensagem(mensagem: string, tipo: 'success' | 'error' | 'info') {
    this.mensagem = mensagem;
    this.tipoMensagem = tipo;
  }
}