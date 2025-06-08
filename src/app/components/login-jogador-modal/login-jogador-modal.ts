// src/app/components/login-jogador-modal/login-jogador-modal.ts - CORRIGIDO
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth';
import { DuplasService } from '../../services/duplas';

@Component({
  selector: 'app-login-jogador-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login-jogador-modal.html',
  styleUrls: ['./login-jogador-modal.scss']
})
export class LoginJogadorModalComponent {
  @Input() mostrar = false;
  @Output() fechar = new EventEmitter<void>();
  @Output() jogadorLogado = new EventEmitter<any>();

  telefone = '';
  loading = false;
  errorMessage = '';
  duplaEncontrada: any = null;

  constructor(
    private authService: AuthService,
    private duplasService: DuplasService
  ) {}

  async onLogin() {
    if (!this.telefone) {
      this.errorMessage = 'Digite um telefone válido';
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.duplaEncontrada = null;

    try {
      // Buscar dupla pelo telefone
      const duplas = await this.duplasService.obterDuplas();
      const dupla = duplas.find(d => this.limparTelefone(d.telefone || '') === this.limparTelefone(this.telefone));
      
      if (dupla) {
        this.duplaEncontrada = dupla;
        
        // Criar informações do jogador
        const jogadorInfo = {
          duplaId: dupla.id,
          dupla: dupla
        };
        
        // Fazer login do jogador usando o método corrigido
        const loginResult = await this.authService.loginJogador(jogadorInfo);
        
        if (loginResult.success) {
          this.jogadorLogado.emit(jogadorInfo);
          
          // Fechar modal após 3 segundos para o usuário ver as informações
          setTimeout(() => {
            this.fecharModal();
          }, 3000);
        } else {
          this.errorMessage = loginResult.error || 'Erro ao fazer login';
          this.duplaEncontrada = null;
        }
        
      } else {
        this.errorMessage = 'Telefone não encontrado. Verifique se o número está correto.';
      }
    } catch (error) {
      console.error('Erro ao buscar dupla:', error);
      this.errorMessage = 'Erro ao buscar dupla. Tente novamente.';
    }
    
    this.loading = false;
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
    
    this.telefone = valor;
  }

  private limparTelefone(telefone: string): string {
    return telefone.replace(/\D/g, '');
  }

  fecharModal() {
    this.mostrar = false;
    this.fechar.emit();
    this.limparForm();
  }

  private limparForm() {
    this.telefone = '';
    this.errorMessage = '';
    this.duplaEncontrada = null;
  }
}