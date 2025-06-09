// src/app/components/seletor-piramide/seletor-piramide.ts

import { Component, EventEmitter, OnInit, OnDestroy, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { PiramidesService } from '../../services/piramides';
import { Piramide } from '../../models/piramide.model';

@Component({
  selector: 'app-seletor-piramide',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './seletor-piramide.html',
  styleUrls: ['./seletor-piramide.scss']
})
export class SeletorPiramideComponent implements OnInit, OnDestroy {
  @Output() piramideSelecionada = new EventEmitter<Piramide>();
  
  piramides: Piramide[] = [];
  piramideAtual: Piramide | null = null;
  mostrarDropdown = false;
  carregando = false;
  
  // ✅ ADICIONAR: Subscription para mudanças
  private subscriptions: Subscription[] = [];

  constructor(private piramidesService: PiramidesService) {}

  async ngOnInit() {
    console.log('🏗️ SeletorPiramideComponent iniciado');
    
    // ✅ ADICIONAR: Subscribir para mudanças na pirâmide atual
    const piramideSub = this.piramidesService.piramideAtual$.subscribe(piramide => {
      console.log('📊 Seletor - Pirâmide mudou via subscription:', piramide?.nome || 'null');
      this.piramideAtual = piramide;
    });
    this.subscriptions.push(piramideSub);
    
    // Carregar dados iniciais
    await this.carregarPiramides();
    this.piramideAtual = this.piramidesService.getPiramideAtual();
    
    console.log('✅ Seletor inicializado:', {
      totalPiramides: this.piramides.length,
      piramideAtual: this.piramideAtual?.nome || 'Nenhuma'
    });
  }

  // ✅ ADICIONAR: Cleanup das subscriptions
  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    console.log('🧹 SeletorPiramideComponent destruído - subscriptions limpas');
  }

  // ✅ MÉTODO MELHORADO: carregarPiramides com refresh automático
  async carregarPiramides(forceRefresh = false) {
    this.carregando = true;
    try {
      console.log('🔄 Seletor - Carregando pirâmides...', { forceRefresh });
      
      // ✅ Limpar cache se forçado
      if (forceRefresh) {
        await this.piramidesService.limparCache();
      }
      
      const todasPiramides = await this.piramidesService.obterPiramides();
      
      // Filtrar apenas pirâmides ativas e finalizadas (visíveis para público)
      this.piramides = todasPiramides.filter(p => 
        p.status === 'ativa' || p.status === 'finalizada'
      );
      
      console.log(`✅ Seletor - ${this.piramides.length} pirâmide(s) carregada(s)`);
    } catch (error) {
      console.error('❌ Seletor - Erro ao carregar pirâmides:', error);
    }
    this.carregando = false;
  }

  // ✅ MÉTODO CORRIGIDO: selecionarPiramide
  async selecionarPiramide(piramide: Piramide) {
    if (piramide.id === this.piramideAtual?.id) {
      this.fecharDropdown();
      return; // Já é a atual
    }

    console.log('📊 Seletor - Selecionando pirâmide:', piramide.nome);
    this.carregando = true;
    
    const resultado = await this.piramidesService.selecionarPiramide(piramide.id);
    
    if (resultado.success) {
      console.log('✅ Seletor - Pirâmide selecionada com sucesso');
      
      // ✅ A atualização local será feita via subscription
      // Apenas emitir evento e fechar dropdown
      this.piramideSelecionada.emit(piramide);
      this.fecharDropdown();
    } else {
      console.error('❌ Seletor - Erro ao selecionar pirâmide:', resultado.message);
    }
    
    this.carregando = false;
  }

  // ✅ NOVO: Método para refresh manual
  async refreshPiramides() {
    console.log('🔄 Seletor - Refresh manual solicitado');
    await this.carregarPiramides(true);
  }

  // ✅ MÉTODO MELHORADO: toggleDropdown com refresh
  async toggleDropdown() {
    if (!this.mostrarDropdown) {
      // ✅ Atualizar lista antes de abrir
      console.log('📂 Seletor - Abrindo dropdown, atualizando lista...');
      await this.carregarPiramides(true);
    }
    
    this.mostrarDropdown = !this.mostrarDropdown;
  }

  fecharDropdown() {
    this.mostrarDropdown = false;
  }

  getStatusBadgeClass(status: string): string {
    const classes = {
      'ativa': 'status-ativa',
      'finalizada': 'status-finalizada'
    };
    return classes[status as keyof typeof classes] || 'status-default';
  }

  getStatusTexto(status: string): string {
    const textos = {
      'ativa': 'Ativa',
      'finalizada': 'Finalizada'
    };
    return textos[status as keyof typeof textos] || status;
  }

  getCategoriaTexto(categoria: string): string {
    const categorias = {
      'masculino': 'Masculino',
      'feminino': 'Feminino',
      'mista': 'Mista'
    };
    return categorias[categoria as keyof typeof categorias] || categoria;
  }

  trackByPiramideId(index: number, piramide: Piramide): string {
    return piramide.id;
  }
}