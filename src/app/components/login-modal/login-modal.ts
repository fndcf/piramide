// src/app/components/login-modal/login-modal.ts - ATUALIZADO PARA FIREBASE
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-login-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" *ngIf="mostrar" (click)="fecharModal()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>🔐 Acesso Administrativo</h3>
          <button class="btn-close" (click)="fecharModal()">×</button>
        </div>
        
        <div class="modal-body">
          <p class="subtitle">Faça login para gerenciar a pirâmide</p>
          
          <form (ngSubmit)="onLogin()" #loginForm="ngForm">
            <div class="form-group">
              <label>Email:</label>
              <input 
                type="email" 
                [(ngModel)]="email" 
                name="email"
                placeholder="admin&#64;piramide.com"
                required
                [disabled]="loading"
                class="form-control">
            </div>
            
            <div class="form-group">
              <label>Senha:</label>
              <input 
                type="password" 
                [(ngModel)]="password" 
                name="password"
                placeholder="Digite sua senha"
                required
                [disabled]="loading"
                class="form-control">
            </div>
            
            <div class="error-message" *ngIf="errorMessage">
              {{ errorMessage }}
            </div>
            
            <!-- Instruções para primeiro acesso -->
            <div class="firebase-instructions" *ngIf="mostrarInstrucoes">
              <h4>🚀 Primeiro Acesso</h4>
              <p>Parece que o usuário administrador ainda não foi criado no Firebase.</p>
              <div class="instructions-steps">
                <h5>Opção 1: Criar pelo Firebase Console (Recomendado)</h5>
                <ol>
                  <li>Acesse o <a href="https://console.firebase.google.com/" target="_blank">Firebase Console</a></li>
                  <li>Vá em <strong>Authentication</strong> → <strong>Users</strong></li>
                  <li>Clique em <strong>"Add user"</strong></li>
                  <li>Email: <code>admin&#64;piramide.com</code></li>
                  <li>Senha: <strong>escolha uma senha segura</strong></li>
                  <li>Clique em <strong>"Add user"</strong></li>
                </ol>
                
                <h5>Opção 2: Instruções no Console</h5>
                <button type="button" class="btn-instructions" (click)="criarUsuarioAdmin()" [disabled]="loading">
                  📋 Ver Instruções Detalhadas
                </button>
              </div>
            </div>
            
            <div class="form-actions">
              <button 
                type="button" 
                class="btn-cancelar" 
                (click)="fecharModal()"
                [disabled]="loading">
                Cancelar
              </button>
              <button 
                type="submit" 
                class="btn-login" 
                [disabled]="loading || !loginForm.form.valid">
                <span *ngIf="loading">Entrando...</span>
                <span *ngIf="!loading">Entrar</span>
              </button>
            </div>
          </form>
          
          <div class="info-box">
            <h4>🔥 Firebase Integration</h4>
            <p><strong>👑 Admin:</strong> admin&#64;piramide.com - Gerencia toda a pirâmide</p>
            <p><strong>🎯 Função:</strong> Criar/remover duplas, gerenciar desafios</p>
            <p><strong>🛡️ Segurança:</strong> Dados sincronizados em tempo real</p>
            
            <div class="firebase-status">
              <p><strong>📱 Status:</strong> 
                <span class="status-badge connected">Conectado ao Firebase</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
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