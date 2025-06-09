// src/app/components/login-modal/login-modal.ts - ATUALIZADO PARA FIREBASE
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-login-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login-modal.html',
  styleUrls: ['./login-modal.scss']
})
export class LoginModalComponent {
  @Input() mostrar = false;
  @Output() fechar = new EventEmitter<void>();
  @Output() loginSucesso = new EventEmitter<void>();

  email = '';
  password = '';
  loading = false;
  errorMessage = '';
  
  // Flag para mostrar instruções de primeiro acesso
  mostrarInstrucoes = false;

  constructor(private authService: AuthService) {}

  async onLogin() {
    if (!this.email || !this.password) {
      this.errorMessage = 'Preencha todos os campos';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    const result = await this.authService.loginAdmin(this.email, this.password);
    
    if (result.success) {
      this.loginSucesso.emit();
      this.fecharModal();
      this.limparForm();
    } else {
      this.errorMessage = result.error || 'Erro ao fazer login';
      
      // Se o erro for de usuário não encontrado, mostrar instruções
      if (result.error?.includes('não encontrado')) {
        this.mostrarInstrucoes = true;
      }
    }
    
    this.loading = false;
  }

  async criarUsuarioAdmin() {
    this.loading = true;
    const result = await this.authService.criarUsuarioAdmin();
    
    if (result.success) {
      this.mostrarInstrucoes = false;
      this.errorMessage = '';
      alert('Siga as instruções no console do navegador para criar o usuário administrador no Firebase.');
    } else {
      this.errorMessage = result.message;
    }
    
    this.loading = false;
  }

  fecharModal() {
    this.mostrar = false;
    this.fechar.emit();
    this.limparForm();
  }

  private limparForm() {
    this.email = '';
    this.password = '';
    this.errorMessage = '';
    this.mostrarInstrucoes = false;
  }
}