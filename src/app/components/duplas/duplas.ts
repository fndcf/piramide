import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-duplas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './duplas.html',
  styleUrls: ['./duplas.scss']
})
export class DuplasComponent {
  
  constructor() {}

  // Métodos para futuras funcionalidades
  adicionarDupla() {
    console.log('Funcionalidade para adicionar dupla será implementada');
  }

  editarDupla(id: string) {
    console.log('Funcionalidade para editar dupla será implementada', id);
  }

  visualizarEstatisticas(id: string) {
    console.log('Funcionalidade para visualizar estatísticas será implementada', id);
  }

  verHistorico(id: string) {
    console.log('Funcionalidade para ver histórico será implementada', id);
  }

  definirBaseInicial(id: string) {
    console.log('Funcionalidade para definir base inicial será implementada', id);
  }
}