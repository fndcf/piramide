// src/app/services/auth.ts - VERSÃO SIMPLIFICADA

import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { 
  Auth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User,
  UserCredential
} from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';

// ✅ INTERFACE SIMPLES - Apenas admin e jogador
interface AppUser {
  uid: string;
  email?: string | null;
  tipo: 'admin' | 'jogador';
  displayName: string;
  // Propriedades específicas do jogador
  duplaId?: string;
  dupla?: any;
  telefone?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<AppUser | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  
  // Email do administrador
  private readonly ADMIN_EMAIL = 'admin@piramide.com';

  constructor(
    private auth: Auth,
    private firestore: Firestore
  ) {
    // ✅ MONITORAR apenas login de admin via Firebase Auth
    onAuthStateChanged(this.auth, (user: User | null) => {
      if (user && user.email === this.ADMIN_EMAIL) {
        // Usuário administrador logado
        const appUser: AppUser = {
          uid: user.uid,
          email: user.email,
          tipo: 'admin',
          displayName: 'Administrador'
        };
        this.currentUserSubject.next(appUser);
        console.log('👑 Admin logado via Firebase');
      } else if (!user) {
        // Verificar se há jogador logado localmente
        this.verificarSessaoJogadorLocal();
      }
    });

    // ✅ VERIFICAR sessão de jogador ao inicializar
    this.verificarSessaoJogadorLocal();
  }

  // ✅ LOGIN ADMIN - Via Firebase (igual ao atual)
  async loginAdmin(email: string, password: string): Promise<{success: boolean, error?: string}> {
    try {
      if (email !== this.ADMIN_EMAIL) {
        return { success: false, error: 'Email de administrador inválido' };
      }

      const result: UserCredential = await signInWithEmailAndPassword(this.auth, email, password);
      
      if (result.user) {
        console.log('✅ Admin logado com sucesso');
        return { success: true };
      } else {
        return { success: false, error: 'Falha na autenticação' };
      }
    } catch (error: any) {
      console.error('Erro no login admin:', error);
      
      switch (error.code) {
        case 'auth/user-not-found':
          return { success: false, error: 'Usuário administrador não encontrado' };
        case 'auth/wrong-password':
          return { success: false, error: 'Senha incorreta' };
        case 'auth/invalid-email':
          return { success: false, error: 'Email inválido' };
        case 'auth/too-many-requests':
          return { success: false, error: 'Muitas tentativas. Tente novamente mais tarde' };
        default:
          return { success: false, error: 'Erro ao fazer login. Tente novamente.' };
      }
    }
  }

  // ✅ LOGIN JOGADOR - Via localStorage (sem Firebase)
  async loginJogador(jogadorInfo: {duplaId: string, dupla: any, telefone: string}): Promise<{success: boolean, error?: string}> {
    try {
      console.log('🏐 Login de jogador:', jogadorInfo.dupla.jogador1, '/', jogadorInfo.dupla.jogador2);
      
      // ✅ VALIDAÇÕES BÁSICAS
      if (!jogadorInfo.duplaId || !jogadorInfo.dupla) {
        return { success: false, error: 'Informações da dupla são obrigatórias' };
      }

      if (!jogadorInfo.dupla.jogador1 || !jogadorInfo.dupla.jogador2) {
        return { success: false, error: 'Dupla deve ter dois jogadores' };
      }

      if (!jogadorInfo.telefone) {
        return { success: false, error: 'Telefone é obrigatório' };
      }

      // ✅ CRIAR sessão do jogador
      const appUser: AppUser = {
        uid: `jogador_${jogadorInfo.duplaId}`, // ID único baseado na dupla
        tipo: 'jogador',
        displayName: `${jogadorInfo.dupla.jogador1}/${jogadorInfo.dupla.jogador2}`,
        duplaId: jogadorInfo.duplaId,
        dupla: jogadorInfo.dupla,
        telefone: jogadorInfo.telefone
      };

      // ✅ SALVAR sessão localmente (simples e eficiente)
      const sessaoJogador = {
        ...appUser,
        loginTimestamp: new Date().toISOString(),
        ultimoAcesso: new Date().toISOString()
      };

      localStorage.setItem('sessao_jogador', JSON.stringify(sessaoJogador));
      
      // ✅ ATUALIZAR estado da aplicação
      this.currentUserSubject.next(appUser);
      
      console.log('✅ Jogador logado com sucesso');
      return { success: true };
      
    } catch (error: any) {
      console.error('❌ Erro no login jogador:', error);
      return { success: false, error: 'Erro ao fazer login como jogador. Tente novamente.' };
    }
  }

  // ✅ VERIFICAR sessão de jogador salva localmente
  private verificarSessaoJogadorLocal(): void {
    try {
      const sessaoSalva = localStorage.getItem('sessao_jogador');
      
      if (sessaoSalva) {
        const sessao = JSON.parse(sessaoSalva);
        
        // ✅ VERIFICAR se a sessão não expirou (24 horas)
        const loginTime = new Date(sessao.loginTimestamp);
        const agora = new Date();
        const diferencaHoras = (agora.getTime() - loginTime.getTime()) / (1000 * 60 * 60);
        
        if (diferencaHoras <= 24) {
          // ✅ SESSÃO VÁLIDA - restaurar jogador
          const appUser: AppUser = {
            uid: sessao.uid,
            tipo: 'jogador',
            displayName: sessao.displayName,
            duplaId: sessao.duplaId,
            dupla: sessao.dupla,
            telefone: sessao.telefone
          };
          
          // Atualizar último acesso
          sessao.ultimoAcesso = new Date().toISOString();
          localStorage.setItem('sessao_jogador', JSON.stringify(sessao));
          
          this.currentUserSubject.next(appUser);
          console.log('🔄 Sessão de jogador restaurada:', appUser.displayName);
        } else {
          // ✅ SESSÃO EXPIRADA - remover
          localStorage.removeItem('sessao_jogador');
          console.log('⏰ Sessão de jogador expirada - removida');
        }
      }
    } catch (error) {
      console.error('Erro ao verificar sessão local:', error);
      localStorage.removeItem('sessao_jogador');
    }
  }

  // ✅ LOGOUT GERAL
  async logout(): Promise<void> {
    try {
      const currentUser = this.currentUserSubject.value;
      
      if (currentUser?.tipo === 'admin') {
        // ✅ LOGOUT DO ADMIN - via Firebase
        await signOut(this.auth);
        console.log('👑 Admin deslogado');
      } else if (currentUser?.tipo === 'jogador') {
        // ✅ LOGOUT DO JOGADOR - remover sessão local
        localStorage.removeItem('sessao_jogador');
        console.log('🏐 Jogador deslogado');
      }
      
      // ✅ LIMPAR estado da aplicação
      this.currentUserSubject.next(null);
      
    } catch (error) {
      console.error('Erro no logout:', error);
      // ✅ FORÇAR limpeza mesmo com erro
      localStorage.removeItem('sessao_jogador');
      this.currentUserSubject.next(null);
    }
  }

  // ✅ MÉTODOS DE VERIFICAÇÃO (simplificados)
  isAdmin(): boolean {
    const currentUser = this.currentUserSubject.value;
    return currentUser?.tipo === 'admin';
  }

  isJogador(): boolean {
    const currentUser = this.currentUserSubject.value;
    return currentUser?.tipo === 'jogador';
  }

  isLoggedIn(): boolean {
    return this.currentUserSubject.value !== null;
  }

  getCurrentUser(): AppUser | null {
    return this.currentUserSubject.value;
  }

  getCurrentFirebaseUser(): User | null {
    return this.auth.currentUser;
  }

  // ✅ MÉTODO para criar usuário admin (igual ao atual)
  async criarUsuarioAdmin(): Promise<{success: boolean, message: string}> {
    try {
      console.log('Para criar o usuário administrador:');
      console.log('1. Vá no Firebase Console > Authentication');
      console.log('2. Clique em "Add user"');
      console.log(`3. Email: ${this.ADMIN_EMAIL}`);
      console.log('4. Password: escolha uma senha segura');
      
      return {
        success: true,
        message: 'Instruções para criar admin exibidas no console'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Erro ao criar usuário admin'
      };
    }
  }

  // ✅ MÉTODO para obter informações específicas do jogador
  getJogadorInfo(): {duplaId: string, dupla: any, telefone: string} | null {
    const currentUser = this.currentUserSubject.value;
    
    if (currentUser?.tipo === 'jogador') {
      return {
        duplaId: currentUser.duplaId!,
        dupla: currentUser.dupla,
        telefone: currentUser.telefone!
      };
    }
    
    return null;
  }

  // ✅ MÉTODO para verificar se a sessão do jogador ainda é válida
  verificarValidadeSessaoJogador(): boolean {
    try {
      const sessaoSalva = localStorage.getItem('sessao_jogador');
      
      if (!sessaoSalva) return false;
      
      const sessao = JSON.parse(sessaoSalva);
      const loginTime = new Date(sessao.loginTimestamp);
      const agora = new Date();
      const diferencaHoras = (agora.getTime() - loginTime.getTime()) / (1000 * 60 * 60);
      
      return diferencaHoras <= 24;
    } catch {
      return false;
    }
  }
}