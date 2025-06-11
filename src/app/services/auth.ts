// src/app/services/auth.ts - CORRIGIDO PARA FIREBASE
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
import { FirebaseService } from './firebase';

interface AppUser {
  uid: string;
  email?: string | null;
  tipo: 'admin' | 'jogador';
  displayName: string;
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
  
  private readonly ADMIN_EMAIL = 'admin@piramide.com';
  private isInitialized = false;

  constructor(
    private auth: Auth,
    private firebase: FirebaseService
  ) {
    this.inicializarAuth();
  }

  private async inicializarAuth() {
    try {
      console.log('🔐 Inicializando AuthService...');
      
      // Aguardar inicialização do Firebase
      const diagnostics = await this.firebase.getDiagnostics();
      if (!diagnostics.firestoreAvailable) {
        console.error('❌ Firestore não disponível');
        return;
      }

      // Monitorar estado de autenticação do Firebase
      onAuthStateChanged(this.auth, async (user: User | null) => {
        console.log('🔄 Estado de auth mudou:', user?.email || 'Não logado');
        
        if (user && user.email === this.ADMIN_EMAIL) {
          const appUser: AppUser = {
            uid: user.uid,
            email: user.email,
            tipo: 'admin',
            displayName: 'Administrador'
          };
          this.currentUserSubject.next(appUser);
          console.log('👑 Admin logado via Firebase');
        } else {
          // Se não é admin Firebase, verificar sessão local de jogador
          await this.verificarSessaoJogadorLocal();
        }
      });

      // Verificar sessão inicial
      await this.verificarSessaoJogadorLocal();
      this.isInitialized = true;
      console.log('✅ AuthService inicializado');
      
    } catch (error) {
      console.error('❌ Erro ao inicializar AuthService:', error);
      this.isInitialized = true;
    }
  }

  // ========== LOGIN ADMIN ==========
  async loginAdmin(email: string, password: string): Promise<{success: boolean, error?: string}> {
    try {
      if (email !== this.ADMIN_EMAIL) {
        return { success: false, error: 'Email de administrador inválido' };
      }

      console.log('🔐 Tentando login admin...');
      
      // Testar conexão primeiro
      const connectionOk = await this.firebase.checkConnection();
      if (!connectionOk) {
        return { 
          success: false, 
          error: 'Problemas de conexão com o Firebase. Verifique sua internet.' 
        };
      }

      const result: UserCredential = await signInWithEmailAndPassword(this.auth, email, password);
      
      if (result.user) {
        console.log('✅ Admin logado com sucesso');
        
        // Registrar evento de login
        try {
          await this.registrarEventoSeguranca('admin_login', {
            email: email,
            timestamp: new Date(),
            ip: 'unknown'
          });
        } catch (logError) {
          console.warn('⚠️ Erro ao registrar evento de login:', logError);
        }

        return { success: true };
      } else {
        return { success: false, error: 'Falha na autenticação' };
      }
    } catch (error: any) {
      console.error('❌ Erro no login admin:', error);
      
      const errorMessages = {
        'auth/user-not-found': 'Usuário administrador não encontrado no Firebase',
        'auth/wrong-password': 'Senha incorreta',
        'auth/invalid-email': 'Email inválido',
        'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos',
        'auth/invalid-credential': 'Credenciais inválidas',
        'auth/network-request-failed': 'Erro de conexão. Verifique sua internet'
      };
      
      return { 
        success: false, 
        error: errorMessages[error.code as keyof typeof errorMessages] || 
               `Erro ao fazer login: ${error.message || 'Erro desconhecido'}` 
      };
    }
  }

  // ========== LOGIN JOGADOR ==========
  async loginJogador(jogadorInfo: {duplaId: string, dupla: any, telefone: string}): Promise<{success: boolean, error?: string}> {
    try {
      console.log('🏐 Login jogador:', jogadorInfo.dupla.jogador1, '/', jogadorInfo.dupla.jogador2);
      
      // Validações
      if (!jogadorInfo.duplaId || !jogadorInfo.dupla || !jogadorInfo.telefone) {
        return { success: false, error: 'Informações incompletas da dupla' };
      }

      // Testar conexão
      const connectionOk = await this.firebase.checkConnection();
      if (!connectionOk) {
        return { 
          success: false, 
          error: 'Problemas de conexão. Verifique sua internet.' 
        };
      }

      const appUser: AppUser = {
        uid: `jogador_${jogadorInfo.duplaId}`,
        tipo: 'jogador',
        displayName: `${jogadorInfo.dupla.jogador1}/${jogadorInfo.dupla.jogador2}`,
        duplaId: jogadorInfo.duplaId,
        dupla: jogadorInfo.dupla,
        telefone: jogadorInfo.telefone
      };

      // Salvar sessão local
      const sessaoLocal = {
        ...appUser,
        loginTimestamp: new Date().toISOString(),
        ultimoAcesso: new Date().toISOString()
      };

      localStorage.setItem('sessao_jogador', JSON.stringify(sessaoLocal));
      this.currentUserSubject.next(appUser);
      
      // Tentar registrar no Firebase (não crítico se falhar)
      try {
        const telefoneHash = this.criarHashTelefone(jogadorInfo.telefone);
        await this.firebase.set('sessoes-jogador', telefoneHash, {
          duplaId: jogadorInfo.duplaId,
          telefone: this.criptografarTelefone(jogadorInfo.telefone),
          loginTimestamp: new Date(),
          ultimoAcesso: new Date(),
          ativo: true,
          userAgent: navigator.userAgent,
          dispositivo: this.detectarDispositivo()
        });
      } catch (firebaseError) {
        console.warn('⚠️ Erro ao salvar sessão no Firebase (continuando):', firebaseError);
      }
      
      console.log('✅ Jogador logado com sucesso');
      return { success: true };
      
    } catch (error: any) {
      console.error('❌ Erro no login jogador:', error);
      return { success: false, error: 'Erro ao fazer login. Tente novamente.' };
    }
  }

  // ========== VERIFICAÇÕES E VALIDAÇÕES ==========
  private async verificarSessaoJogadorLocal(): Promise<void> {
    try {
      const sessaoSalva = localStorage.getItem('sessao_jogador');
      if (!sessaoSalva) return;

      const sessao = JSON.parse(sessaoSalva);
      
      // Verificar se não expirou (24 horas)
      const loginTime = new Date(sessao.loginTimestamp);
      const agora = new Date();
      const diferencaHoras = (agora.getTime() - loginTime.getTime()) / (1000 * 60 * 60);
      
      if (diferencaHoras > 24) {
        localStorage.removeItem('sessao_jogador');
        console.log('⏰ Sessão de jogador expirada');
        return;
      }

      // Restaurar usuário
      const appUser: AppUser = {
        uid: sessao.uid,
        tipo: 'jogador',
        displayName: sessao.displayName,
        duplaId: sessao.duplaId,
        dupla: sessao.dupla,
        telefone: sessao.telefone
      };
      
      this.currentUserSubject.next(appUser);
      console.log('🔄 Sessão de jogador restaurada:', appUser.displayName);
      
    } catch (error) {
      console.error('❌ Erro ao verificar sessão local:', error);
      localStorage.removeItem('sessao_jogador');
    }
  }

  // ========== LOGOUT ==========
  async logout(): Promise<void> {
    try {
      const currentUser = this.currentUserSubject.value;
      
      if (currentUser?.tipo === 'admin') {
        await signOut(this.auth);
        console.log('👑 Admin deslogado');
      } else if (currentUser?.tipo === 'jogador') {
        localStorage.removeItem('sessao_jogador');
        console.log('🏐 Jogador deslogado');
      }
      
      this.currentUserSubject.next(null);
      
    } catch (error) {
      console.error('❌ Erro no logout:', error);
      // Forçar limpeza
      localStorage.removeItem('sessao_jogador');
      this.currentUserSubject.next(null);
    }
  }

  // ========== MÉTODOS DE VERIFICAÇÃO ==========
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

  // ========== MÉTODOS AUXILIARES ==========
  private criarHashTelefone(telefone: string): string {
    const telefoneLimpo = telefone.replace(/\D/g, '');
    return btoa(telefoneLimpo + '_sessao').replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
  }

  private criptografarTelefone(telefone: string): string {
    const telefoneLimpo = telefone.replace(/\D/g, '');
    return btoa(telefoneLimpo).replace(/=/g, '');
  }

  private detectarDispositivo(): string {
    const userAgent = navigator.userAgent;
    if (/Mobile|Android|iPhone|iPad/.test(userAgent)) return 'mobile';
    if (/Tablet|iPad/.test(userAgent)) return 'tablet';
    return 'desktop';
  }

  // ========== REGISTRO DE EVENTOS ==========
  private async registrarEventoSeguranca(evento: string, detalhes: any = {}): Promise<void> {
    try {
      const currentUser = this.currentUserSubject.value;
      
      const logData = {
        evento,
        usuario: currentUser ? {
          uid: currentUser.uid,
          tipo: currentUser.tipo,
          displayName: currentUser.displayName
        } : null,
        detalhes,
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        dispositivo: this.detectarDispositivo()
      };

      await this.firebase.create('logs-seguranca', logData);
    } catch (error) {
      console.warn('⚠️ Erro ao registrar evento de segurança:', error);
    }
  }

  // ========== DIAGNÓSTICO ==========
  async getDiagnostics(): Promise<{
    isInitialized: boolean;
    isLoggedIn: boolean;
    userType: string | null;
    firebaseUser: boolean;
    firebaseStatus: any;
  }> {
    try {
      const firebaseStatus = await this.firebase.getDiagnostics();
      const currentUser = this.currentUserSubject.value;
      
      return {
        isInitialized: this.isInitialized,
        isLoggedIn: this.isLoggedIn(),
        userType: currentUser?.tipo || null,
        firebaseUser: !!this.auth.currentUser,
        firebaseStatus
      };
    } catch (error) {
      return {
        isInitialized: this.isInitialized,
        isLoggedIn: false,
        userType: null,
        firebaseUser: false,
        firebaseStatus: { error }
      };
    }
  }

  // ========== CRIAÇÃO DE USUÁRIO ADMIN (PRIMEIRA VEZ) ==========
  async criarUsuarioAdmin(): Promise<{success: boolean, message: string}> {
    console.log('\n🔥 INSTRUÇÕES PARA CRIAR USUÁRIO ADMINISTRADOR 🔥');
    console.log('='.repeat(60));
    console.log('1. Acesse: https://console.firebase.google.com/');
    console.log('2. Selecione seu projeto Firebase');
    console.log('3. Vá em "Authentication" > "Users"');
    console.log('4. Clique em "Add user"');
    console.log(`5. Email: ${this.ADMIN_EMAIL}`);
    console.log('6. Password: escolha uma senha segura (mín. 6 caracteres)');
    console.log('7. Clique em "Add user"');
    console.log('8. Configure as regras do Firestore (veja o console)');
    console.log('9. Teste o login na aplicação');
    console.log('='.repeat(60));
    
    return {
      success: true,
      message: 'Instruções exibidas no console do navegador'
    };
  }

  // ========== TESTES DE CONECTIVIDADE ==========
  async testarConexaoFirebase(): Promise<{success: boolean, message: string, details?: any}> {
    try {
      console.log('🧪 Testando conexão Firebase...');
      
      const diagnostics = await this.firebase.getDiagnostics();
      console.log('📋 Diagnósticos Firebase:', diagnostics);
      
      if (!diagnostics.firestoreAvailable) {
        return {
          success: false,
          message: 'Firestore não está disponível',
          details: diagnostics
        };
      }

      // Testar operação simples
      const connectionOk = await this.firebase.checkConnection();
      
      if (connectionOk) {
        // Testar operação de leitura real
        try {
          const testResult = await this.firebase.get('configuracoes', 'global');
          console.log('📊 Teste de leitura:', testResult);
          
          return {
            success: true,
            message: 'Conexão Firebase funcionando corretamente',
            details: { diagnostics, testResult }
          };
        } catch (readError) {
          return {
            success: false,
            message: `Problemas nas regras de segurança: ${readError}`,
            details: { diagnostics, readError }
          };
        }
      } else {
        return {
          success: false,
          message: 'Problemas de conectividade detectados',
          details: diagnostics
        };
      }
    } catch (error: any) {
      console.error('❌ Erro no teste de conexão:', error);
      return {
        success: false,
        message: `Erro na conexão: ${error.message || 'Erro desconhecido'}`,
        details: { error: error.code || error.message }
      };
    }
  }

  async forcarReconexao(): Promise<{success: boolean, message: string}> {
    try {
      console.log('🔄 Forçando reconexão...');
      
      const success = await this.firebase.reconnect();
      
      if (success) {
        return {
          success: true,
          message: 'Reconexão realizada com sucesso'
        };
      } else {
        return {
          success: false,
          message: 'Falha na reconexão'
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: `Erro na reconexão: ${error.message || 'Erro desconhecido'}`
      };
    }
  }
}