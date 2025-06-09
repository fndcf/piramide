// src/app/components/login-jogador-modal/login-jogador-modal.ts - VERSÃO SIMPLIFICADA

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
    // ✅ VALIDAÇÕES BÁSICAS
    if (!this.telefone) {
      this.errorMessage = 'Digite um telefone válido';
      return;
    }

    const telefoneLimpo = this.limparTelefone(this.telefone);
    if (telefoneLimpo.length < 10) {
      this.errorMessage = 'Digite um telefone válido com pelo menos 10 dígitos';
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.duplaEncontrada = null;

    try {
      console.log('🔍 Buscando dupla por telefone:', telefoneLimpo);
      
      // ✅ BUSCAR dupla pelo telefone
      const dupla = await this.duplasService.obterDuplasPorTelefone(telefoneLimpo);
      
      if (dupla) {
        console.log('✅ Dupla encontrada:', dupla);
        this.duplaEncontrada = dupla;
        
        // ✅ PREPARAR informações para login
        const jogadorInfo = {
          duplaId: dupla.id,
          dupla: dupla,
          telefone: telefoneLimpo
        };
        
        // ✅ FAZER LOGIN simples (sem Firebase)
        const loginResult = await this.authService.loginJogador(jogadorInfo);
        
        if (loginResult.success) {
          console.log('✅ Login do jogador realizado com sucesso');
          this.jogadorLogado.emit(jogadorInfo);
          
          // ✅ MOSTRAR informações da dupla por 3 segundos
          setTimeout(() => {
            this.fecharModal();
          }, 3000);
        } else {
          this.errorMessage = loginResult.error || 'Erro ao fazer login';
          this.duplaEncontrada = null;
        }
        
      } else {
        console.log('❌ Dupla não encontrada para telefone:', telefoneLimpo);
        this.errorMessage = 'Telefone não encontrado. Verifique se o número está correto ou entre em contato com o administrador.';
      }
    } catch (error) {
      console.error('❌ Erro ao buscar dupla:', error);
      this.errorMessage = 'Erro ao buscar dupla. Tente novamente.';
    }
    
    this.loading = false;
  }

  // ✅ FORMATAÇÃO automática do telefone
  formatarTelefone(event: any) {
    let valor = event.target.value.replace(/\D/g, '');
    
    // Limitar a 11 dígitos
    if (valor.length > 11) {
      valor = valor.substring(0, 11);
    }
    
    // Formatar conforme o tamanho
    if (valor.length <= 2) {
      valor = valor.replace(/(\d{0,2})/, '($1');
    } else if (valor.length <= 7) {
      valor = valor.replace(/(\d{2})(\d{0,5})/, '($1) $2');
    } else if (valor.length <= 10) {
      valor = valor.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
    } else {
      valor = valor.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
    }
    
    this.telefone = valor;
    
    // Limpar mensagem de erro ao digitar
    if (this.errorMessage) {
      this.errorMessage = '';
    }
  }

  // ✅ FUNÇÃO auxiliar para limpar telefone
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