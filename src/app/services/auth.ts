// src/app/services/auth.ts - VERSÃO OTIMIZADA COM FIREBASE
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
import { orderBy, limit } from '@angular/fire/firestore';

// Interface para usuários da aplicação
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
  
  // Cache para sessões de jogadores
  private sessoesCache = new Map<string, any>();
  private readonly SESSAO_DURATION = 24 * 60 * 60 * 1000; // 24 horas

  constructor(
    private auth: Auth,
    private firebase: FirebaseService
  ) {
    this.inicializarAuth();
  }

  private inicializarAuth() {
    // Monitorar login de admin via Firebase Auth
    onAuthStateChanged(this.auth, (user: User | null) => {
      if (user && user.email === this.ADMIN_EMAIL) {
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

    // Verificar sessão de jogador ao inicializar
    this.verificarSessaoJogadorLocal();
  }

  // ========== LOGIN ADMIN (Firebase Auth) ==========

  async loginAdmin(email: string, password: string): Promise<{success: boolean, error?: string}> {
    try {
      if (email !== this.ADMIN_EMAIL) {
        return { success: false, error: 'Email de administrador inválido' };
      }

      console.log('🔐 Tentando login admin via Firebase...');
      const result: UserCredential = await signInWithEmailAndPassword(this.auth, email, password);
      
      if (result.user) {
        console.log('✅ Admin logado com sucesso');
        return { success: true };
      } else {
        return { success: false, error: 'Falha na autenticação' };
      }
    } catch (error: any) {
      console.error('❌ Erro no login admin:', error);
      
      const errorMessages = {
        'auth/user-not-found': 'Usuário administrador não encontrado',
        'auth/wrong-password': 'Senha incorreta',
        'auth/invalid-email': 'Email inválido',
        'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde',
        'auth/invalid-credential': 'Credenciais inválidas'
      };
      
      return { 
        success: false, 
        error: errorMessages[error.code as keyof typeof errorMessages] || 'Erro ao fazer login. Tente novamente.' 
      };
    }
  }

  // ========== LOGIN JOGADOR (Firebase + Cache Local) ==========

  async loginJogador(jogadorInfo: {duplaId: string, dupla: any, telefone: string}): Promise<{success: boolean, error?: string}> {
    try {
      console.log('🏐 Iniciando login de jogador:', jogadorInfo.dupla.jogador1, '/', jogadorInfo.dupla.jogador2);
      
      // Validações básicas
      if (!jogadorInfo.duplaId || !jogadorInfo.dupla) {
        return { success: false, error: 'Informações da dupla são obrigatórias' };
      }

      if (!jogadorInfo.dupla.jogador1 || !jogadorInfo.dupla.jogador2) {
        return { success: false, error: 'Dupla deve ter dois jogadores' };
      }

      if (!jogadorInfo.telefone) {
        return { success: false, error: 'Telefone é obrigatório' };
      }

      // Criar hash seguro do telefone
      const telefoneHash = this.criarHashTelefone(jogadorInfo.telefone);
      
      // Criar sessão local
      const appUser: AppUser = {
        uid: `jogador_${jogadorInfo.duplaId}`,
        tipo: 'jogador',
        displayName: `${jogadorInfo.dupla.jogador1}/${jogadorInfo.dupla.jogador2}`,
        duplaId: jogadorInfo.duplaId,
        dupla: jogadorInfo.dupla,
        telefone: jogadorInfo.telefone
      };

      // Criar dados da sessão
      const sessaoData = {
        duplaId: jogadorInfo.duplaId,
        telefone: this.criptografarTelefone(jogadorInfo.telefone),
        loginTimestamp: new Date(),
        ultimoAcesso: new Date(),
        ativo: true,
        userAgent: navigator.userAgent,
        dispositivo: this.detectarDispositivo()
      };

      // Salvar no Firebase (opcional - para controle de sessões)
      try {
        await this.firebase.set('sessoes-jogador', telefoneHash, sessaoData);
        console.log('✅ Sessão salva no Firebase');
      } catch (firebaseError) {
        console.log('⚠️ Erro ao salvar no Firebase, continuando com cache local:', firebaseError);
      }

      // Salvar cache local (principal)
      const sessaoLocal = {
        ...appUser,
        loginTimestamp: new Date().toISOString(),
        ultimoAcesso: new Date().toISOString(),
        telefoneHash
      };

      localStorage.setItem('sessao_jogador', JSON.stringify(sessaoLocal));
      this.sessoesCache.set(telefoneHash, sessaoLocal);
      
      // Atualizar estado da aplicação
      this.currentUserSubject.next(appUser);
      
      console.log('✅ Jogador logado com sucesso');
      return { success: true };
      
    } catch (error: any) {
      console.error('❌ Erro no login jogador:', error);
      return { success: false, error: 'Erro ao fazer login como jogador. Tente novamente.' };
    }
  }

  // ========== VERIFICAÇÃO DE SESSÕES ==========

  private async verificarSessaoJogadorLocal(): Promise<void> {
    try {
      const sessaoSalva = localStorage.getItem('sessao_jogador');
      
      if (!sessaoSalva) return;

      const sessao = JSON.parse(sessaoSalva);
      
      // Verificar se a sessão não expirou
      const loginTime = new Date(sessao.loginTimestamp);
      const agora = new Date();
      const diferencaHoras = (agora.getTime() - loginTime.getTime()) / (1000 * 60 * 60);
      
      if (diferencaHoras > 24) {
        // Sessão expirada
        localStorage.removeItem('sessao_jogador');
        console.log('⏰ Sessão de jogador expirada - removida');
        return;
      }

      // Sessão válida - verificar no Firebase se possível
      try {
        if (sessao.telefoneHash) {
          const sessaoFirebase = await this.firebase.get('sessoes-jogador', sessao.telefoneHash);
          
          if (sessaoFirebase.success && sessaoFirebase.data && sessaoFirebase.data.ativo) {
            // Atualizar último acesso no Firebase
            await this.firebase.update('sessoes-jogador', sessao.telefoneHash, {
              ultimoAcesso: new Date()
            });
          }
        }
      } catch (firebaseError) {
        console.log('⚠️ Erro ao verificar sessão no Firebase, usando cache local');
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
      
      // Atualizar último acesso local
      sessao.ultimoAcesso = new Date().toISOString();
      localStorage.setItem('sessao_jogador', JSON.stringify(sessao));
      
      this.currentUserSubject.next(appUser);
      console.log('🔄 Sessão de jogador restaurada:', appUser.displayName);
      
    } catch (error) {
      console.error('❌ Erro ao verificar sessão local:', error);
      localStorage.removeItem('sessao_jogador');
    }
  }

  async verificarSessaoNoFirebase(telefoneHash: string): Promise<boolean> {
    try {
      const result = await this.firebase.get('sessoes-jogador', telefoneHash);
      
      if (result.success && result.data) {
        const sessao = result.data;
        
        // Verificar se está ativa e não expirou
        const loginTime = sessao.loginTimestamp?.toDate ? 
          sessao.loginTimestamp.toDate() : 
          new Date(sessao.loginTimestamp);
        
        const agora = new Date();
        const diferencaHoras = (agora.getTime() - loginTime.getTime()) / (1000 * 60 * 60);
        
        return sessao.ativo && diferencaHoras <= 24;
      }
      
      return false;
    } catch (error) {
      console.error('Erro ao verificar sessão no Firebase:', error);
      return false;
    }
  }

  // ========== LOGOUT ==========

  async logout(): Promise<void> {
    try {
      const currentUser = this.currentUserSubject.value;
      
      if (currentUser?.tipo === 'admin') {
        // Logout do admin via Firebase
        await signOut(this.auth);
        console.log('👑 Admin deslogado');
      } else if (currentUser?.tipo === 'jogador') {
        // Logout do jogador
        await this.logoutJogador();
      }
      
      // Limpar estado da aplicação
      this.currentUserSubject.next(null);
      
    } catch (error) {
      console.error('❌ Erro no logout:', error);
      // Forçar limpeza mesmo com erro
      localStorage.removeItem('sessao_jogador');
      this.sessoesCache.clear();
      this.currentUserSubject.next(null);
    }
  }

  private async logoutJogador(): Promise<void> {
    try {
      const sessaoLocal = localStorage.getItem('sessao_jogador');
      
      if (sessaoLocal) {
        const sessao = JSON.parse(sessaoLocal);
        
        // Desativar sessão no Firebase
        if (sessao.telefoneHash) {
          try {
            await this.firebase.update('sessoes-jogador', sessao.telefoneHash, {
              ativo: false,
              logoutTimestamp: new Date()
            });
          } catch (firebaseError) {
            console.log('⚠️ Erro ao desativar sessão no Firebase:', firebaseError);
          }
        }
        
        // Remover cache local
        localStorage.removeItem('sessao_jogador');
        this.sessoesCache.delete(sessao.telefoneHash);
      }
      
      console.log('🏐 Jogador deslogado');
    } catch (error) {
      console.error('❌ Erro ao fazer logout de jogador:', error);
    }
  }

  // ========== GERENCIAMENTO DE SESSÕES (ADMIN) ==========

  async obterSessoesAtivas(): Promise<any[]> {
    try {
      if (!this.isAdmin()) {
        return [];
      }

      console.log('👀 Buscando sessões ativas no Firebase...');
      
      const result = await this.firebase.findBy(
        'sessoes-jogador',
        'ativo',
        true
      );

      if (result.success && result.data) {
        // Filtrar sessões não expiradas
        const sessoesValidas = result.data.filter(sessao => {
          const loginTime = sessao.loginTimestamp?.toDate ? 
            sessao.loginTimestamp.toDate() : 
            new Date(sessao.loginTimestamp);
          
          const agora = new Date();
          const diferencaHoras = (agora.getTime() - loginTime.getTime()) / (1000 * 60 * 60);
          
          return diferencaHoras <= 24;
        });

        console.log(`✅ ${sessoesValidas.length} sessão(ões) ativa(s) encontrada(s)`);
        return sessoesValidas;
      }

      return [];
    } catch (error) {
      console.error('❌ Erro ao buscar sessões ativas:', error);
      return [];
    }
  }

  async desativarSessao(telefoneHash: string): Promise<{ success: boolean; message: string }> {
    try {
      if (!this.isAdmin()) {
        return { success: false, message: 'Apenas administradores podem desativar sessões' };
      }

      console.log('🚫 Desativando sessão:', telefoneHash);
      
      const result = await this.firebase.update('sessoes-jogador', telefoneHash, {
        ativo: false,
        desativadoPor: 'admin',
        dataDesativacao: new Date()
      });

      if (result.success) {
        console.log('✅ Sessão desativada com sucesso');
        return { success: true, message: 'Sessão desativada com sucesso' };
      } else {
        return { success: false, message: result.error || 'Erro ao desativar sessão' };
      }
    } catch (error) {
      console.error('❌ Erro ao desativar sessão:', error);
      return { success: false, message: 'Erro ao desativar sessão' };
    }
  }

  async limparSessoesExpiradas(): Promise<{ success: boolean; message: string; removidas: number }> {
    try {
      if (!this.isAdmin()) {
        return { success: false, message: 'Apenas administradores podem limpar sessões', removidas: 0 };
      }

      console.log('🧹 Limpando sessões expiradas...');
      
      const result = await this.firebase.getAll('sessoes-jogador');
      
      if (result.success && result.data) {
        const agora = new Date();
        const sessoesExpiradas = result.data.filter(sessao => {
          const loginTime = sessao.loginTimestamp?.toDate ? 
            sessao.loginTimestamp.toDate() : 
            new Date(sessao.loginTimestamp);
          
          const diferencaHoras = (agora.getTime() - loginTime.getTime()) / (1000 * 60 * 60);
          return diferencaHoras > 24;
        });

        // Desativar sessões expiradas
        const updates = sessoesExpiradas.map(sessao => ({
          id: sessao.id,
          data: {
            ativo: false,
            expirada: true,
            dataExpiracao: new Date()
          }
        }));

        if (updates.length > 0) {
          const updateResult = await this.firebase.updateBatch('sessoes-jogador', updates);
          
          if (updateResult.success) {
            console.log(`✅ ${updates.length} sessão(ões) expirada(s) limpa(s)`);
            return { 
              success: true, 
              message: `${updates.length} sessão(ões) expirada(s) removida(s)`,
              removidas: updates.length 
            };
          }
        } else {
          return { success: true, message: 'Nenhuma sessão expirada encontrada', removidas: 0 };
        }
      }

      return { success: true, message: 'Limpeza concluída', removidas: 0 };
    } catch (error) {
      console.error('❌ Erro ao limpar sessões expiradas:', error);
      return { success: false, message: 'Erro ao limpar sessões expiradas', removidas: 0 };
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

  // ========== INFORMAÇÕES DO JOGADOR ==========

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

  // ========== CRIAÇÃO DE USUÁRIO ADMIN ==========

  async criarUsuarioAdmin(): Promise<{success: boolean, message: string}> {
    try {
      console.log('\n🔥 INSTRUÇÕES PARA CRIAR USUÁRIO ADMINISTRADOR 🔥');
      console.log('='.repeat(60));
      console.log('1. Acesse: https://console.firebase.google.com/');
      console.log('2. Selecione seu projeto Firebase');
      console.log('3. Vá em "Authentication" > "Users"');
      console.log('4. Clique em "Add user"');
      console.log(`5. Email: ${this.ADMIN_EMAIL}`);
      console.log('6. Password: escolha uma senha segura (mín. 6 caracteres)');
      console.log('7. Clique em "Add user"');
      console.log('8. Teste o login na aplicação');
      console.log('='.repeat(60));
      
      return {
        success: true,
        message: 'Instruções para criar admin exibidas no console'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Erro ao exibir instruções'
      };
    }
  }

  // ========== UTILITÁRIOS DE SEGURANÇA ==========

  private criarHashTelefone(telefone: string): string {
    // Criar hash seguro do telefone para usar como ID
    const telefoneLimpo = telefone.replace(/\D/g, '');
    const hash = btoa(telefoneLimpo + '_sessao').replace(/[^a-zA-Z0-9]/g, '');
    return hash.substring(0, 20); // Limitar tamanho
  }

  private criptografarTelefone(telefone: string): string {
    // Criptografia simples para o Firebase (apenas ofuscar)
    const telefoneLimpo = telefone.replace(/\D/g, '');
    return btoa(telefoneLimpo).replace(/=/g, '');
  }

  private descriptografarTelefone(telefoneHash: string): string {
    try {
      return atob(telefoneHash + '=='.substring(0, telefoneHash.length % 4));
    } catch {
      return '';
    }
  }

  private detectarDispositivo(): string {
    const userAgent = navigator.userAgent;
    
    if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
      return 'mobile';
    } else if (/Tablet|iPad/.test(userAgent)) {
      return 'tablet';
    } else {
      return 'desktop';
    }
  }

  // ========== ESTATÍSTICAS DE SESSÕES ==========

  async obterEstatisticasSessoes(): Promise<{
    totalSessoes: number;
    sessoesAtivas: number;
    sessoesHoje: number;
    dispositivosMaisUsados: { tipo: string; count: number }[];
  }> {
    try {
      if (!this.isAdmin()) {
        return { totalSessoes: 0, sessoesAtivas: 0, sessoesHoje: 0, dispositivosMaisUsados: [] };
      }

      const result = await this.firebase.getAll('sessoes-jogador');
      
      if (result.success && result.data) {
        const agora = new Date();
        const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
        
        const sessoesAtivas = result.data.filter(sessao => {
          if (!sessao.ativo) return false;
          
          const loginTime = sessao.loginTimestamp?.toDate ? 
            sessao.loginTimestamp.toDate() : 
            new Date(sessao.loginTimestamp);
          
          const diferencaHoras = (agora.getTime() - loginTime.getTime()) / (1000 * 60 * 60);
          return diferencaHoras <= 24;
        });

        const sessoesHoje = result.data.filter(sessao => {
          const loginTime = sessao.loginTimestamp?.toDate ? 
            sessao.loginTimestamp.toDate() : 
            new Date(sessao.loginTimestamp);
          
          return loginTime >= inicioHoje;
        });

        // Contar dispositivos
        const dispositivos = new Map<string, number>();
        result.data.forEach(sessao => {
          const tipo = sessao.dispositivo || 'unknown';
          dispositivos.set(tipo, (dispositivos.get(tipo) || 0) + 1);
        });

        const dispositivosMaisUsados = Array.from(dispositivos.entries())
          .map(([tipo, count]) => ({ tipo, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        return {
          totalSessoes: result.data.length,
          sessoesAtivas: sessoesAtivas.length,
          sessoesHoje: sessoesHoje.length,
          dispositivosMaisUsados
        };
      }

      return { totalSessoes: 0, sessoesAtivas: 0, sessoesHoje: 0, dispositivosMaisUsados: [] };
    } catch (error) {
      console.error('❌ Erro ao obter estatísticas de sessões:', error);
      return { totalSessoes: 0, sessoesAtivas: 0, sessoesHoje: 0, dispositivosMaisUsados: [] };
    }
  }

  // ========== AUDITORIA E LOGS ==========

  async registrarEventoSeguranca(evento: string, detalhes: any = {}): Promise<void> {
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
        ip: 'unknown', // Seria necessário obter do backend
        dispositivo: this.detectarDispositivo()
      };

      await this.firebase.create('logs-seguranca', logData);
      console.log('📝 Evento de segurança registrado:', evento);
    } catch (error) {
      console.error('❌ Erro ao registrar evento de segurança:', error);
    }
  }

  async obterLogsSeguranca(limite: number = 50): Promise<any[]> {
    try {
      if (!this.isAdmin()) {
        return [];
      }

      const result = await this.firebase.getAll(
        'logs-seguranca',
        [
          orderBy('timestamp', 'desc'),
          limit(limite)
        ]
      );

      return result.success && result.data ? result.data : [];
    } catch (error) {
      console.error('❌ Erro ao obter logs de segurança:', error);
      return [];
    }
  }

  // ========== MANUTENÇÃO ==========

  async executarManutencaoSessoes(): Promise<{ success: boolean; message: string; acoes: string[] }> {
    try {
      if (!this.isAdmin()) {
        return { success: false, message: 'Apenas administradores podem executar manutenção', acoes: [] };
      }

      console.log('🔧 Executando manutenção de sessões...');
      const acoes: string[] = [];

      // 1. Limpar sessões expiradas
      const limpeza = await this.limparSessoesExpiradas();
      if (limpeza.success && limpeza.removidas > 0) {
        acoes.push(`${limpeza.removidas} sessão(ões) expirada(s) removida(s)`);
      }

      // 2. Limpar cache local se necessário
      if (!this.verificarValidadeSessaoJogador()) {
        localStorage.removeItem('sessao_jogador');
        acoes.push('Cache local limpo');
      }

      // 3. Registrar evento de manutenção
      await this.registrarEventoSeguranca('manutencao_sessoes', { acoes });
      acoes.push('Evento de manutenção registrado');

      console.log('✅ Manutenção de sessões concluída');
      return {
        success: true,
        message: 'Manutenção executada com sucesso',
        acoes
      };
    } catch (error) {
      console.error('❌ Erro na manutenção de sessões:', error);
      return {
        success: false,
        message: 'Erro na manutenção de sessões',
        acoes: []
      };
    }
  }

  // ========== MIGRAÇÃO E BACKUP ==========

  async exportarSessoes(): Promise<any[]> {
    try {
      if (!this.isAdmin()) {
        return [];
      }

      const result = await this.firebase.getAll('sessoes-jogador');
      return result.success && result.data ? result.data : [];
    } catch (error) {
      console.error('❌ Erro ao exportar sessões:', error);
      return [];
    }
  }

  async importarSessoes(sessoes: any[]): Promise<{ success: boolean; message: string }> {
    try {
      if (!this.isAdmin()) {
        return { success: false, message: 'Apenas administradores podem importar sessões' };
      }

      console.log('📥 Importando sessões:', sessoes.length);

      const result = await this.firebase.createBatch('sessoes-jogador', sessoes);

      if (result.success) {
        console.log('✅ Sessões importadas com sucesso');
        return { success: true, message: `${sessoes.length} sessão(ões) importada(s) com sucesso` };
      } else {
        return { success: false, message: result.error || 'Erro ao importar sessões' };
      }
    } catch (error) {
      console.error('❌ Erro ao importar sessões:', error);
      return { success: false, message: 'Erro ao importar sessões' };
    }
  }
}