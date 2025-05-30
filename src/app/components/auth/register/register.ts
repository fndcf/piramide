import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './register.html',
  styleUrls: ['./register.scss']
})
export class RegisterComponent {
  // Propriedades para quando a funcionalidade for implementada
  nome = '';
  email = '';
  senha = '';
  confirmarSenha = '';
  loading = false;
  errorMessage = '';

  constructor() {}

  // Método placeholder para futura implementação
  onRegister() {
    // Implementar quando o Firebase estiver configurado
    console.log('Funcionalidade de registro será implementada em breve');
  }

  // Método placeholder para navegação ao login
  goToLogin() {
    // Implementar navegação para a página de login
    console.log('Navegar para login');
  }
}