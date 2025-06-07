// src/app/components/seletor-piramide/seletor-piramide.ts

import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PiramidesService } from '../../services/piramides';
import { Piramide } from '../../models/piramide.model';

@Component({
  selector: 'app-seletor-piramide',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './seletor-piramide.html',
  styleUrls: ['./seletor-piramide.scss']
})
export class SeletorPiramideComponent implements OnInit {
  @Output() piramideSelecionada = new EventEmitter<Piramide>();
  
  piramides: Piramide[] = [];
  piramideAtual: Piramide | null = null;
  mostrarDropdown = false;
  carregando = false;

  constructor(private piramidesService: PiramidesService) {}

  async ngOnInit() {
    await this.carregarPiramides();
    this.piramideAtual = this.piramidesService.getPiramideAtual();
  }

  async carregarPiramides() {
    this.carregando = true;
    try {
      const todasPiramides = await this.piramidesService.obterPiramides();
      // Filtrar apenas pirâmides ativas e finalizadas (visíveis para público)
      this.piramides = todasPiramides.filter(p => 
        p.status === 'ativa' || p.status === 'finalizada'
      );
    } catch (error) {
      console.error('Erro ao carregar pirâmides:', error);
    }
    this.carregando = false;
  }

  async selecionarPiramide(piramide: Piramide) {
    if (piramide.id === this.piramideAtual?.id) {
      this.fecharDropdown();
      return; // Já é a atual
    }

    this.carregando = true;
    const resultado = await this.piramidesService.selecionarPiramide(piramide.id);
    
    if (resultado.success) {
      this.piramideAtual = piramide;
      this.piramideSelecionada.emit(piramide);
      this.fecharDropdown();
    }
    
    this.carregando = false;
  }

  toggleDropdown() {
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
      'misto': 'Misto',
      'iniciante': 'Iniciante',
      'avancado': 'Avançado',
      'custom': 'Personalizado'
    };
    return categorias[categoria as keyof typeof categorias] || categoria;
  }
}