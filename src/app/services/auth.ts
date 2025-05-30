import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

// Interface para simular User
interface DemoUser {
  email: string;
  uid: string;
  tipo?: 'admin' | 'jogador';
  duplaId?: string;
  dupla?: any;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<DemoUser | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  
  // Email do administrador
  private readonly ADMIN_EMAIL = 'admin@piramide.com';

  constructor() {
    // Verificar se já estava logado (localStorage)
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      this.currentUserSubject.next(JSON.parse(savedUser));
    }
  }

  async login(email: string, password: string): Promise<any> {
    try {
      // Login de administrador apenas
      if (email === this.ADMIN_EMAIL && password.length >= 4) {
        const demoUser: DemoUser = {
          email: email,
          uid: 'admin-demo-123',
          tipo: 'admin'
        };
        
        this.currentUserSubject.next(demoUser);
        localStorage.setItem('currentUser', JSON.stringify(demoUser));
        
        return { success: true, user: demoUser };
      } else if (email === this.ADMIN_EMAIL) {
        return { success: false, error: 'Senha deve ter pelo menos 4 caracteres' };
      } else {
        return { success: false, error: 'Email de administrador inválido' };
      }
    } catch (error: any) {
      return { success: false, error: 'Erro ao fazer login' };
    }
  }

  // Método para login de jogador (será chamado pelo modal de jogador)
  loginJogador(jogadorInfo: any): void {
    const jogadorUser: DemoUser = {
      email: `jogador_${jogadorInfo.duplaId}@piramide.local`,
      uid: `jogador_${jogadorInfo.duplaId}`,
      tipo: 'jogador',
      duplaId: jogadorInfo.duplaId,
      dupla: jogadorInfo.dupla
    };
    
    this.currentUserSubject.next(jogadorUser);
    localStorage.setItem('currentUser', JSON.stringify(jogadorUser));
  }

  async logout(): Promise<void> {
    this.currentUserSubject.next(null);
    localStorage.removeItem('currentUser');
  }

  // Verifica se o usuário atual é administrador
  isAdmin(): boolean {
    const currentUser = this.currentUserSubject.value;
    return currentUser?.email === this.ADMIN_EMAIL && currentUser?.tipo === 'admin';
  }

  // Verifica se o usuário atual é jogador
  isJogador(): boolean {
    const currentUser = this.currentUserSubject.value;
    return currentUser?.tipo === 'jogador';
  }

  // Verifica se está logado
  isLoggedIn(): boolean {
    return this.currentUserSubject.value !== null;
  }

  // Obtém o usuário atual
  getCurrentUser(): DemoUser | null {
    return this.currentUserSubject.value;
  }
}