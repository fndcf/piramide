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

  constructor(private authService: AuthService) {}

  async onLogin() {
    if (!this.email || !this.password) {
      this.errorMessage = 'Preencha todos os campos';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    const result = await this.authService.login(this.email, this.password);
    
    if (result.success) {
      this.loginSucesso.emit();
      this.fecharModal();
      this.limparForm();
    } else {
      this.errorMessage = result.error;
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
  }
}