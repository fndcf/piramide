// src/app/components/gerenciar-piramides/gerenciar-piramides.ts - ATUALIZADO

import { Component, EventEmitter, Input, Output, OnInit, SimpleChanges } from '@angular/core';
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
  loadingMessage = '';
  
  // Modal de nova pirâmide
  mostrarModalNova = false;
  novaPiramide: NovaPiramide = this.resetarNovaPiramide();
  
  // Modal de edição
  mostrarModalEdicao = false;
  piramideEdicao: Partial<Piramide> = {};
  
  // Modal de estatísticas
  mostrarModalEstatisticas = false;
  estatisticasSelecionada: EstatisticasPiramide | null = null;
  
  // ✅ NOVO: Modal de confirmação para exclusão
  mostrarModalConfirmacaoExclusao = false;
  piramideParaExcluir: PiramideSeletor | null = null;
  textoConfirmacao = ''; // ✅ NOVA VARIÁVEL para o texto de confirmação
  
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
    console.log('🏗️ GerenciarPiramidesComponent iniciado');
    await this.carregarDados();
  }

  // ✅ MÉTODO CORRIGIDO: ngOnChanges para detectar abertura do modal
  async ngOnChanges(changes: SimpleChanges) {
    console.log('🔄 GerenciarPiramidesComponent - mudanças detectadas:', changes);
    
    // ✅ Recarregar sempre que o modal for aberto
    if (changes['mostrar'] && changes['mostrar'].currentValue === true) {
      console.log('✅ Modal aberto - recarregando dados...');
      await this.carregarDados(true);
    }
  }

  // ✅ MÉTODO MELHORADO: carregarDados com force refresh
  async carregarDados(forceRefresh = false) {
    this.loading = true;
    this.mensagem = '';
    this.loadingMessage = forceRefresh ? 'Atualizando lista...' : 'Carregando pirâmides...';
    
    try {
      console.log('📊 Carregando dados das pirâmides...', { forceRefresh });
      
      // ✅ FORÇAR refresh do service (limpar cache)
      if (forceRefresh) {
        await this.piramidesService.limparCache();
      }
      
      // Carregar pirâmides
      this.piramides = await this.piramidesService.obterPiramideSeletor();
      console.log(`✅ ${this.piramides.length} pirâmide(s) carregada(s)`);
      
      // Atualizar pirâmide atual
      this.piramideAtual = this.piramidesService.getPiramideAtual();
      console.log('📋 Pirâmide atual:', this.piramideAtual?.nome || 'Nenhuma');
      
    } catch (error) {
      console.error('❌ Erro ao carregar pirâmides:', error);
      this.mostrarMensagem('Erro ao carregar pirâmides', 'error');
    }
    
    this.loading = false;
    this.loadingMessage = '';
  }

  // ✅ NOVO: Método para forçar refresh manual
  async forcarRefresh() {
    console.log('🔄 Refresh manual solicitado');
    await this.carregarDados(true);
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
  
  // ✅ MÉTODO CORRIGIDO: selecionarPiramide com refresh
  async selecionarPiramide(piramide: PiramideSeletor) {
    if (piramide.id === this.piramideAtual?.id) {
      return; // Já é a atual
    }
    
    this.loading = true;
    this.loadingMessage = 'Selecionando pirâmide...';
    
    const resultado = await this.piramidesService.selecionarPiramide(piramide.id);
    
    if (resultado.success) {
      this.piramideAtual = this.piramidesService.getPiramideAtual();
      this.mostrarMensagem(resultado.message, 'success');
      this.piramideSelecionada.emit(this.piramideAtual!);
      
      // ✅ RECARREGAR dados após seleção para atualizar estado
      await this.carregarDados(true);
    } else {
      this.mostrarMensagem(resultado.message, 'error');
    }
    
    this.loading = false;
    this.loadingMessage = '';
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

  // ✅ MÉTODO CORRIGIDO: criarPiramide com refresh automático
  async criarPiramide() {
    if (!this.validarNovaPiramide()) {
      return;
    }

    this.loading = true;
    this.loadingMessage = 'Criando pirâmide...';
    console.log('🏗️ Criando nova pirâmide:', this.novaPiramide.nome);
    
    const resultado = await this.piramidesService.criarPiramide(this.novaPiramide);
    
    if (resultado.success) {
      this.mostrarMensagem(resultado.message, 'success');
      
      // ✅ RECARREGAR dados após criação
      console.log('🔄 Recarregando dados após criação...');
      await this.carregarDados(true);
      
      this.fecharModalNova();
      
      // ✅ SELEÇÃO AUTOMÁTICA CORRIGIDA
      if (resultado.piramide) {
        const piramideAtual = this.piramidesService.getPiramideAtual();
        console.log('🔍 Estado após criação:', {
          piramideCriada: resultado.piramide.nome,
          piramideAtual: piramideAtual?.nome || 'Nenhuma',
          totalPiramides: this.piramides.length
        });
        
        // Selecionar automaticamente se:
        // 1. Não há pirâmide atual OU
        // 2. É a primeira pirâmide criada
        const deveSelecionar = !piramideAtual || this.piramides.length === 1;
        
        if (deveSelecionar) {
          console.log('🎯 Selecionando nova pirâmide automaticamente...');
          
          try {
            // Usar o serviço diretamente para selecionar
            const selecaoResult = await this.piramidesService.selecionarPiramide(resultado.piramide.id);
            
            if (selecaoResult.success) {
              console.log('✅ Pirâmide selecionada automaticamente');
              
              // ✅ ATUALIZAR estado local
              this.piramideAtual = this.piramidesService.getPiramideAtual();
              
              // ✅ EMITIR evento para o componente pai
              if (this.piramideAtual) {
                console.log('📡 Emitindo evento de pirâmide selecionada');
                this.piramideSelecionada.emit(this.piramideAtual);
              }
              
              // ✅ RECARREGAR dados para refletir a seleção
              await this.carregarDados(true);
              
              // ✅ FECHAR modal após seleção automática
              setTimeout(() => {
                console.log('🚪 Fechando modal após seleção automática');
                this.fecharModal();
              }, 1500);
              
            } else {
              console.error('❌ Erro ao selecionar pirâmide automaticamente:', selecaoResult.message);
            }
          } catch (error) {
            console.error('❌ Erro na seleção automática:', error);
          }
        } else {
          console.log('ℹ️ Pirâmide criada mas não selecionada automaticamente (já existe pirâmide atual)');
        }
      }
    } else {
      this.mostrarMensagem(resultado.message, 'error');
    }
    
    this.loading = false;
    this.loadingMessage = '';
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
      categoria: 'mista',
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

  // ✅ MÉTODO CORRIGIDO: salvarEdicao com refresh
  async salvarEdicao() {
    if (!this.piramideEdicao.nome?.trim()) {
      this.mostrarMensagem('Nome é obrigatório', 'error');
      return;
    }

    this.loading = true;
    this.loadingMessage = 'Salvando alterações...';
    
    const resultado = await this.piramidesService.atualizarPiramide(
      this.piramideEdicao.id!,
      this.piramideEdicao
    );
    
    if (resultado.success) {
      this.mostrarMensagem(resultado.message, 'success');
      
      // ✅ RECARREGAR dados após edição
      await this.carregarDados(true);
      
      this.fecharModalEdicao();
    } else {
      this.mostrarMensagem(resultado.message, 'error');
    }
    
    this.loading = false;
    this.loadingMessage = '';
  }

  // ✅ NOVO: Método para aplicar filtros
  aplicarFiltros() {
    // Os filtros são aplicados automaticamente pelo getter piramidesFiltradas
    console.log('🔍 Filtros aplicados:', {
      status: this.filtroStatus,
      categoria: this.filtroCategoria,
      busca: this.termoBusca
    });
  }

  // ✅ NOVO: Método para limpar filtros
  limparFiltros() {
    this.filtroStatus = 'todas';
    this.filtroCategoria = 'todas';
    this.termoBusca = '';
    console.log('🗑️ Filtros limpos');
  }

  // ✅ NOVO: TrackBy function para performance
  trackByPiramideId(index: number, piramide: PiramideSeletor): string {
    return piramide.id;
  }

  fecharModalEdicao() {
    this.mostrarModalEdicao = false;
    this.piramideEdicao = {};
    this.mensagem = '';
  }

  // ========== ✅ NOVAS AÇÕES DA PIRÂMIDE: REATIVAÇÃO E EXCLUSÃO ==========
  
  // ✅ MÉTODO CORRIGIDO: alterarStatus com refresh
  async alterarStatus(piramide: PiramideSeletor, novoStatus: Piramide['status']) {
    let confirmacao = false;
    let mensagemConfirmacao = '';

    // Mensagens específicas para cada tipo de alteração
    switch (novoStatus) {
      case 'pausada':
        mensagemConfirmacao = `Tem certeza que deseja PAUSAR a pirâmide "${piramide.nome}"?\n\n` +
                             `⚠️ Efeitos:\n` +
                             `• Não será possível adicionar duplas\n` +
                             `• Não será possível criar desafios\n` +
                             `• A pirâmide ficará "congelada"\n\n` +
                             `Você pode reativá-la a qualquer momento.`;
        break;
        
      case 'finalizada':
        mensagemConfirmacao = `Tem certeza que deseja FINALIZAR a pirâmide "${piramide.nome}"?\n\n` +
                             `⚠️ ATENÇÃO - Esta é uma ação restritiva:\n` +
                             `• Não será possível adicionar duplas\n` +
                             `• Não será possível criar desafios\n` +
                             `• A pirâmide será marcada como concluída\n` +
                             `• Após finalizar, você poderá EXCLUIR a pirâmide\n\n` +
                             `Você pode reativar se necessário.`;
        break;
        
      case 'ativa':
        mensagemConfirmacao = `Tem certeza que deseja REATIVAR a pirâmide "${piramide.nome}"?\n\n` +
                             `✅ Efeitos:\n` +
                             `• Voltará a aceitar duplas\n` +
                             `• Voltará a aceitar desafios\n` +
                             `• Ficará totalmente funcional novamente`;
        break;
    }

    confirmacao = confirm(mensagemConfirmacao);
    
    if (!confirmacao) return;

    this.loading = true;
    this.loadingMessage = 'Alterando status...';
    
    const resultado = await this.piramidesService.alterarStatusPiramide(piramide.id, novoStatus);
    
    if (resultado.success) {
      this.mostrarMensagem(resultado.message, 'success');
      
      // ✅ RECARREGAR dados após alteração
      await this.carregarDados(true);
    } else {
      this.mostrarMensagem(resultado.message, 'error');
    }
    
    this.loading = false;
    this.loadingMessage = '';
  }

  // ✅ NOVA FUNÇÃO: Reativar pirâmide
  async reativarPiramide(piramide: PiramideSeletor) {
    await this.alterarStatus(piramide, 'ativa');
  }

  // ✅ NOVA FUNÇÃO: Confirmar exclusão
  confirmarExclusao(piramide: PiramideSeletor) {
    if (piramide.status !== 'finalizada') {
      this.mostrarMensagem('Só é possível excluir pirâmides finalizadas', 'error');
      return;
    }

    this.piramideParaExcluir = piramide;
    this.mostrarModalConfirmacaoExclusao = true;
  }

  // ✅ MÉTODO CORRIGIDO: excluirPiramide com refresh
  async excluirPiramide() {
    if (!this.piramideParaExcluir) return;

    this.loading = true;
    this.loadingMessage = 'Excluindo pirâmide...';
    console.log('🗑️ Excluindo pirâmide:', this.piramideParaExcluir.nome);
    
    const resultado = await this.piramidesService.excluirPiramide(this.piramideParaExcluir.id);
    
    if (resultado.success) {
      this.mostrarMensagem(resultado.message, 'success');
      
      // ✅ RECARREGAR dados após exclusão
      await this.carregarDados(true);
      
      this.fecharModalConfirmacaoExclusao();
    } else {
      this.mostrarMensagem(resultado.message, 'error');
    }
    
    this.loading = false;
    this.loadingMessage = '';
  }

  fecharModalConfirmacaoExclusao() {
    this.mostrarModalConfirmacaoExclusao = false;
    this.piramideParaExcluir = null;
    this.textoConfirmacao = ''; // ✅ LIMPAR o texto de confirmação
  }

  // ✅ NOVA FUNÇÃO: Validar se a confirmação está correta
  isConfirmacaoValida(): boolean {
    if (!this.piramideParaExcluir) return false;
    const textoEsperado = `EXCLUIR ${this.piramideParaExcluir.nome}`;
    return this.textoConfirmacao.trim() === textoEsperado;
  }

  // ✅ MÉTODO MELHORADO: arquivarPiramide com refresh
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
    this.loadingMessage = 'Arquivando pirâmide...';
    
    const resultado = await this.piramidesService.arquivarPiramide(piramide.id);
    
    if (resultado.success) {
      this.mostrarMensagem(resultado.message, 'success');
      
      // ✅ RECARREGAR dados após arquivamento
      await this.carregarDados(true);
    } else {
      this.mostrarMensagem(resultado.message, 'error');
    }
    
    this.loading = false;
    this.loadingMessage = '';
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

  // ✅ NOVOS MÉTODOS: Verificações de status
  podeReativar(piramide: PiramideSeletor): boolean {
    return piramide.status === 'pausada' || piramide.status === 'finalizada';
  }

  podeExcluir(piramide: PiramideSeletor): boolean {
    return piramide.status === 'finalizada';
  }

  isPiramideEditavel(piramide: PiramideSeletor): boolean {
    return piramide.status === 'ativa' || piramide.status === 'pausada';
  }

  getStatusTexto(status: string): string {
    const textos = {
      'ativa': 'Ativa',
      'pausada': 'Pausada',
      'finalizada': 'Finalizada',
      'arquivada': 'Arquivada'
    };
    return textos[status as keyof typeof textos] || status;
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