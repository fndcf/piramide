// src/app/services/auth.ts - ATUALIZADO COM FIREBASE
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { 
  Auth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User,
  signInAnonymously,
  UserCredential
} from '@angular/fire/auth';
import { 
  Firestore, 
  doc, 
  getDoc, 
  setDoc 
} from '@angular/fire/firestore';

interface AppUser {
  uid: string;
  email?: string | null;
  tipo: 'admin' | 'jogador' | 'anonimo';
  duplaId?: string;
  dupla?: any;
  displayName?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<AppUser | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  
  // Email do administrador
  private readonly ADMIN_EMAIL = 'admin@piramide.com';
  private readonly ADMIN_PASSWORD = 'admin123'; // Você pode mudar isso

  constructor(
    private auth: Auth,
    private firestore: Firestore
  ) {
    // Monitorar mudanças no estado de autenticação
    onAuthStateChanged(this.auth, (user: User | null) => {
      if (user) {
        this.handleAuthStateChange(user);
      } else {
        this.currentUserSubject.next(null);
      }
    });
  }

  private async handleAuthStateChange(user: User): Promise<void> {
    try {
      if (user.email === this.ADMIN_EMAIL) {
        // Usuário administrador
        const appUser: AppUser = {
          uid: user.uid,
          email: user.email,
          tipo: 'admin',
          displayName: 'Administrador'
        };
        this.currentUserSubject.next(appUser);
      } else if (user.isAnonymous) {
        // Usuário anônimo (visitante)
        const appUser: AppUser = {
          uid: user.uid,
          tipo: 'anonimo',
          displayName: 'Visitante'
        };
        this.currentUserSubject.next(appUser);
      } else {
        // Verificar se é um jogador no Firestore
        await this.verificarJogador(user);
      }
    } catch (error) {
      console.error('Erro ao processar mudança de auth:', error);
      this.currentUserSubject.next(null);
    }
  }

  private async verificarJogador(user: User): Promise<void> {
    try {
      // Buscar dados do jogador no Firestore
      const jogadorRef = doc(this.firestore, `usuarios_jogadores/${user.uid}`);
      const jogadorSnap = await getDoc(jogadorRef);

      if (jogadorSnap.exists()) {
        const dadosJogador = jogadorSnap.data();
        const appUser: AppUser = {
          uid: user.uid,
          email: user.email,
          tipo: 'jogador',
          duplaId: dadosJogador['duplaId'],
          dupla: dadosJogador['dupla'],
          displayName: `${dadosJogador['dupla']?.jogador1}/${dadosJogador['dupla']?.jogador2}`
        };
        this.currentUserSubject.next(appUser);
      } else {
        // Usuário não encontrado, fazer logout
        await this.logout();
      }
    } catch (error) {
      console.error('Erro ao verificar jogador:', error);
      await this.logout();
    }
  }

  async loginAdmin(email: string, password: string): Promise<{success: boolean, error?: string}> {
    try {
      if (email !== this.ADMIN_EMAIL) {
        return { success: false, error: 'Email de administrador inválido' };
      }

      const result: UserCredential = await signInWithEmailAndPassword(this.auth, email, password);
      
      if (result.user) {
        return { success: true };
      } else {
        return { success: false, error: 'Falha na autenticação' };
      }
    } catch (error: any) {
      console.error('Erro no login admin:', error);
      
      // Mapear erros do Firebase para mensagens amigáveis
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

  async loginJogador(jogadorInfo: {duplaId: string, dupla: any}): Promise<{success: boolean, error?: string}> {
    try {
      // Primeiro, fazer login anônimo para acessar o Firestore
      const anonResult = await signInAnonymously(this.auth);
      
      if (!anonResult.user) {
        return { success: false, error: 'Erro na autenticação' };
      }

      // Salvar dados do jogador no Firestore para futuras consultas
      await setDoc(doc(this.firestore, `usuarios_jogadores/${anonResult.user.uid}`), {
        duplaId: jogadorInfo.duplaId,
        dupla: jogadorInfo.dupla,
        loginTimestamp: new Date()
      });

      // Atualizar o estado local
      const appUser: AppUser = {
        uid: anonResult.user.uid,
        tipo: 'jogador',
        duplaId: jogadorInfo.duplaId,
        dupla: jogadorInfo.dupla,
        displayName: `${jogadorInfo.dupla.jogador1}/${jogadorInfo.dupla.jogador2}`
      };
      
      this.currentUserSubject.next(appUser);
      
      return { success: true };
    } catch (error: any) {
      console.error('Erro no login jogador:', error);
      return { success: false, error: 'Erro ao fazer login como jogador' };
    }
  }

  // Método auxiliar para buscar jogador por telefone (será usado pelo componente)
  async buscarJogadorPorTelefone(telefone: string): Promise<{success: boolean, jogador?: any, error?: string}> {
    try {
      // TODO: Implementar busca no Firestore
      // Por enquanto retorna erro para implementação futura
      return { success: false, error: 'Busca por telefone ainda não implementada no Firebase' };
    } catch (error: any) {
      console.error('Erro ao buscar jogador:', error);
      return { success: false, error: 'Erro ao buscar jogador' };
    }
  }

  async loginAnonimo(): Promise<{success: boolean, error?: string}> {
    try {
      const result = await signInAnonymously(this.auth);
      
      if (result.user) {
        return { success: true };
      } else {
        return { success: false, error: 'Falha na autenticação anônima' };
      }
    } catch (error: any) {
      console.error('Erro no login anônimo:', error);
      return { success: false, error: 'Erro ao entrar como visitante' };
    }
  }

  async logout(): Promise<void> {
    try {
      await signOut(this.auth);
      this.currentUserSubject.next(null);
    } catch (error) {
      console.error('Erro no logout:', error);
    }
  }

  // Métodos de verificação de tipo de usuário
  isAdmin(): boolean {
    const currentUser = this.currentUserSubject.value;
    return currentUser?.tipo === 'admin';
  }

  isJogador(): boolean {
    const currentUser = this.currentUserSubject.value;
    return currentUser?.tipo === 'jogador';
  }

  isAnonimo(): boolean {
    const currentUser = this.currentUserSubject.value;
    return currentUser?.tipo === 'anonimo';
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

  // Método para criar o usuário administrador (executar uma vez)
  async criarUsuarioAdmin(): Promise<{success: boolean, message: string}> {
    try {
      // Este método deve ser executado apenas uma vez para criar o admin
      // Em produção, você pode fazer isso direto no Firebase Console
      
      console.log('Para criar o usuário administrador:');
      console.log('1. Vá no Firebase Console > Authentication');
      console.log('2. Clique em "Add user"');
      console.log(`3. Email: ${this.ADMIN_EMAIL}`);
      console.log(`4. Password: ${this.ADMIN_PASSWORD}`);
      
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
}