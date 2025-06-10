// src/app/services/firebase.ts - CORRIGIDO COM MELHOR TRATAMENTO DE ERROS
import { Injectable } from '@angular/core';
import { 
  Firestore,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  QueryConstraint,
  onSnapshot,
  Unsubscribe,
  connectFirestoreEmulator,
  enableNetwork,
  disableNetwork
} from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private isOnline = true;
  private initializationPromise: Promise<void>;

  constructor(private firestore: Firestore) {
    this.initializationPromise = this.initialize();
  }

  // ========== INICIALIZAÇÃO ==========
  private async initialize(): Promise<void> {
    try {
      console.log('🔄 Inicializando Firebase Service...');
      
      // Verificar se o Firestore está disponível
      if (!this.firestore) {
        throw new Error('Firestore não foi inicializado corretamente');
      }

      // Tentar uma operação simples para verificar conectividade
      await this.testConnection();
      console.log('✅ Firebase Service inicializado com sucesso');
    } catch (error) {
      console.error('❌ Erro ao inicializar Firebase Service:', error);
      throw error;
    }
  }

  private async testConnection(): Promise<void> {
    try {
      // Fazer uma consulta simples para testar a conexão
      const testCollection = collection(this.firestore, 'test_connection');
      const testQuery = query(testCollection, limit(1));
      await getDocs(testQuery);
      this.isOnline = true;
    } catch (error) {
      console.warn('⚠️ Problema de conectividade detectado:', error);
      this.isOnline = false;
    }
  }

  // ========== OPERAÇÕES BÁSICAS CORRIGIDAS ==========

  // Criar documento com ID automático
  async create(collectionName: string, data: any): Promise<{success: boolean, id?: string, error?: string}> {
    try {
      await this.initializationPromise;
      
      if (!collectionName || !data) {
        return { success: false, error: 'Nome da coleção e dados são obrigatórios' };
      }

      const colRef = collection(this.firestore, collectionName);
      const docRef = await addDoc(colRef, {
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log(`✅ Documento criado em ${collectionName} com ID: ${docRef.id}`);
      return { success: true, id: docRef.id };
    } catch (error: any) {
      console.error(`❌ Erro ao criar documento em ${collectionName}:`, error);
      return { success: false, error: this.formatError(error) };
    }
  }

  // Criar/atualizar documento com ID específico
  async set(collectionName: string, id: string, data: any): Promise<{success: boolean, error?: string}> {
    try {
      await this.initializationPromise;
      
      if (!collectionName || !id || !data) {
        return { success: false, error: 'Nome da coleção, ID e dados são obrigatórios' };
      }

      const docRef = doc(this.firestore, collectionName, id);
      await setDoc(docRef, {
        ...data,
        updatedAt: new Date()
      }, { merge: true });
      
      console.log(`✅ Documento definido em ${collectionName}/${id}`);
      return { success: true };
    } catch (error: any) {
      console.error(`❌ Erro ao definir documento ${id} em ${collectionName}:`, error);
      return { success: false, error: this.formatError(error) };
    }
  }

  // Buscar documento por ID
  async get(collectionName: string, id: string): Promise<{success: boolean, data?: any, error?: string}> {
    try {
      await this.initializationPromise;
      
      if (!collectionName || !id) {
        return { success: false, error: 'Nome da coleção e ID são obrigatórios' };
      }

      const docRef = doc(this.firestore, collectionName, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() };
        console.log(`✅ Documento encontrado em ${collectionName}/${id}`);
        return { success: true, data };
      } else {
        console.log(`⚠️ Documento não encontrado em ${collectionName}/${id}`);
        return { success: false, error: 'Documento não encontrado' };
      }
    } catch (error: any) {
      console.error(`❌ Erro ao buscar documento ${id} em ${collectionName}:`, error);
      return { success: false, error: this.formatError(error) };
    }
  }

  // Buscar todos os documentos de uma coleção
  async getAll(collectionName: string, constraints?: QueryConstraint[]): Promise<{success: boolean, data?: any[], error?: string}> {
    try {
      await this.initializationPromise;
      
      if (!collectionName) {
        return { success: false, error: 'Nome da coleção é obrigatório' };
      }

      const colRef = collection(this.firestore, collectionName);
      let q = query(colRef);
      
      if (constraints && constraints.length > 0) {
        q = query(colRef, ...constraints);
      }
      
      const querySnapshot = await getDocs(q);
      
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log(`✅ ${data.length} documento(s) encontrado(s) em ${collectionName}`);
      return { success: true, data };
    } catch (error: any) {
      console.error(`❌ Erro ao buscar documentos em ${collectionName}:`, error);
      return { success: false, error: this.formatError(error) };
    }
  }

  // Atualizar documento
  async update(collectionName: string, id: string, data: any): Promise<{success: boolean, error?: string}> {
    try {
      await this.initializationPromise;
      
      if (!collectionName || !id || !data) {
        return { success: false, error: 'Nome da coleção, ID e dados são obrigatórios' };
      }

      const docRef = doc(this.firestore, collectionName, id);
      
      // Verificar se o documento existe antes de atualizar
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        return { success: false, error: 'Documento não encontrado para atualização' };
      }

      await updateDoc(docRef, {
        ...data,
        updatedAt: new Date()
      });
      
      console.log(`✅ Documento atualizado em ${collectionName}/${id}`);
      return { success: true };
    } catch (error: any) {
      console.error(`❌ Erro ao atualizar documento ${id} em ${collectionName}:`, error);
      return { success: false, error: this.formatError(error) };
    }
  }

  // Excluir documento
  async delete(collectionName: string, id: string): Promise<{success: boolean, error?: string}> {
    try {
      await this.initializationPromise;
      
      if (!collectionName || !id) {
        return { success: false, error: 'Nome da coleção e ID são obrigatórios' };
      }

      const docRef = doc(this.firestore, collectionName, id);
      
      // Verificar se o documento existe antes de excluir
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        return { success: false, error: 'Documento não encontrado para exclusão' };
      }

      await deleteDoc(docRef);
      
      console.log(`✅ Documento excluído em ${collectionName}/${id}`);
      return { success: true };
    } catch (error: any) {
      console.error(`❌ Erro ao excluir documento ${id} em ${collectionName}:`, error);
      return { success: false, error: this.formatError(error) };
    }
  }

  // ========== OPERAÇÕES ESPECÍFICAS CORRIGIDAS ==========

  // Buscar por campo específico
  async findBy(
    collectionName: string, 
    field: string, 
    value: any,
    constraints?: QueryConstraint[]
  ): Promise<{success: boolean, data?: any[], error?: string}> {
    try {
      await this.initializationPromise;
      
      if (!collectionName || !field || value === undefined || value === null) {
        return { success: false, error: 'Nome da coleção, campo e valor são obrigatórios' };
      }

      const colRef = collection(this.firestore, collectionName);
      const whereConstraint = where(field, '==', value);
      const allConstraints = constraints ? [whereConstraint, ...constraints] : [whereConstraint];
      const q = query(colRef, ...allConstraints);
      const querySnapshot = await getDocs(q);
      
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log(`✅ ${data.length} documento(s) encontrado(s) em ${collectionName} com ${field}=${value}`);
      return { success: true, data };
    } catch (error: any) {
      console.error(`❌ Erro ao buscar por ${field}=${value} em ${collectionName}:`, error);
      return { success: false, error: this.formatError(error) };
    }
  }

  // Buscar primeiro documento que corresponda aos critérios
  async findFirst(
    collectionName: string, 
    field: string, 
    value: any
  ): Promise<{success: boolean, data?: any, error?: string}> {
    try {
      const result = await this.findBy(collectionName, field, value, [limit(1)]);
      
      if (result.success && result.data && result.data.length > 0) {
        return { success: true, data: result.data[0] };
      } else {
        return { success: false, error: 'Documento não encontrado' };
      }
    } catch (error: any) {
      console.error(`❌ Erro ao buscar primeiro por ${field}=${value} em ${collectionName}:`, error);
      return { success: false, error: this.formatError(error) };
    }
  }

  // Contar documentos
  async count(collectionName: string, constraints?: QueryConstraint[]): Promise<{success: boolean, count?: number, error?: string}> {
    try {
      const result = await this.getAll(collectionName, constraints);
      
      if (result.success) {
        return { success: true, count: result.data?.length || 0 };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error: any) {
      console.error(`❌ Erro ao contar documentos em ${collectionName}:`, error);
      return { success: false, error: this.formatError(error) };
    }
  }

  // ========== OPERAÇÕES EM TEMPO REAL CORRIGIDAS ==========

  // Escutar mudanças em um documento
  listenToDoc(collectionName: string, id: string, callback: (data: any) => void): Unsubscribe {
    try {
      if (!collectionName || !id || !callback) {
        console.error('❌ Parâmetros obrigatórios para listenToDoc');
        return () => {}; // Retorna função vazia
      }

      const docRef = doc(this.firestore, collectionName, id);
      
      return onSnapshot(docRef, (doc) => {
        if (doc.exists()) {
          const data = { id: doc.id, ...doc.data() };
          callback(data);
        } else {
          callback(null);
        }
      }, (error) => {
        console.error(`❌ Erro ao escutar documento ${id} em ${collectionName}:`, error);
        callback(null);
      });
    } catch (error) {
      console.error(`❌ Erro ao configurar listener para ${collectionName}/${id}:`, error);
      return () => {}; // Retorna função vazia
    }
  }

  // Escutar mudanças em uma coleção
  listenToCollection(
    collectionName: string, 
    callback: (data: any[]) => void,
    constraints?: QueryConstraint[]
  ): Unsubscribe {
    try {
      if (!collectionName || !callback) {
        console.error('❌ Parâmetros obrigatórios para listenToCollection');
        return () => {}; // Retorna função vazia
      }

      const colRef = collection(this.firestore, collectionName);
      let q = query(colRef);
      
      if (constraints && constraints.length > 0) {
        q = query(colRef, ...constraints);
      }
      
      return onSnapshot(q, (querySnapshot) => {
        const data = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        callback(data);
      }, (error) => {
        console.error(`❌ Erro ao escutar coleção ${collectionName}:`, error);
        callback([]);
      });
    } catch (error) {
      console.error(`❌ Erro ao configurar listener para coleção ${collectionName}:`, error);
      return () => {}; // Retorna função vazia
    }
  }

  // ========== OPERAÇÕES EM LOTE CORRIGIDAS ==========

  // Criar múltiplos documentos
  async createBatch(collectionName: string, items: any[]): Promise<{success: boolean, ids?: string[], error?: string}> {
    try {
      await this.initializationPromise;
      
      if (!collectionName || !items || items.length === 0) {
        return { success: false, error: 'Nome da coleção e itens são obrigatórios' };
      }

      const ids: string[] = [];
      const colRef = collection(this.firestore, collectionName);
      
      // Processar em lotes para evitar problemas de performance
      const BATCH_SIZE = 500; // Limite do Firestore
      
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE);
        
        for (const item of batch) {
          const docRef = await addDoc(colRef, {
            ...item,
            createdAt: new Date(),
            updatedAt: new Date()
          });
          ids.push(docRef.id);
        }
      }
      
      console.log(`✅ ${ids.length} documento(s) criado(s) em lote em ${collectionName}`);
      return { success: true, ids };
    } catch (error: any) {
      console.error(`❌ Erro ao criar lote em ${collectionName}:`, error);
      return { success: false, error: this.formatError(error) };
    }
  }

  // Atualizar múltiplos documentos
  async updateBatch(collectionName: string, updates: {id: string, data: any}[]): Promise<{success: boolean, error?: string}> {
    try {
      await this.initializationPromise;
      
      if (!collectionName || !updates || updates.length === 0) {
        return { success: false, error: 'Nome da coleção e atualizações são obrigatórios' };
      }

      // Processar em lotes para evitar problemas de performance
      const BATCH_SIZE = 500;
      
      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);
        
        for (const update of batch) {
          if (!update.id || !update.data) {
            console.warn('⚠️ Update inválido ignorado:', update);
            continue;
          }

          const docRef = doc(this.firestore, collectionName, update.id);
          await updateDoc(docRef, {
            ...update.data,
            updatedAt: new Date()
          });
        }
      }
      
      console.log(`✅ ${updates.length} documento(s) atualizado(s) em lote em ${collectionName}`);
      return { success: true };
    } catch (error: any) {
      console.error(`❌ Erro ao atualizar lote em ${collectionName}:`, error);
      return { success: false, error: this.formatError(error) };
    }
  }

  // ========== UTILITÁRIOS CORRIGIDOS ==========

  // Gerar ID único
  generateId(): string {
    try {
      return doc(collection(this.firestore, 'temp')).id;
    } catch (error) {
      console.error('❌ Erro ao gerar ID:', error);
      // Fallback para um ID baseado em timestamp
      return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  }

  // Validar se documento existe
  async exists(collectionName: string, id: string): Promise<boolean> {
    try {
      const result = await this.get(collectionName, id);
      return result.success;
    } catch (error) {
      console.error(`❌ Erro ao verificar existência de ${collectionName}/${id}:`, error);
      return false;
    }
  }

  // ========== MÉTODOS DE DIAGNÓSTICO ==========

  // Verificar status da conexão
  async checkConnection(): Promise<boolean> {
    try {
      await this.testConnection();
      return this.isOnline;
    } catch (error) {
      console.error('❌ Erro ao verificar conexão:', error);
      return false;
    }
  }

  // Obter informações de diagnóstico
  async getDiagnostics(): Promise<{
    isOnline: boolean;
    isInitialized: boolean;
    firestoreAvailable: boolean;
  }> {
    try {
      await this.initializationPromise;
      
      return {
        isOnline: this.isOnline,
        isInitialized: true,
        firestoreAvailable: !!this.firestore
      };
    } catch (error) {
      return {
        isOnline: false,
        isInitialized: false,
        firestoreAvailable: !!this.firestore
      };
    }
  }

  // ========== MÉTODO DE FORMATAÇÃO DE ERRO ==========
  private formatError(error: any): string {
    if (error?.code) {
      switch (error.code) {
        case 'permission-denied':
          return 'Permissão negada. Verifique as regras de segurança do Firestore.';
        case 'unavailable':
          return 'Serviço temporariamente indisponível. Tente novamente.';
        case 'deadline-exceeded':
          return 'Operação demorou muito para completar. Tente novamente.';
        case 'resource-exhausted':
          return 'Cota de recursos excedida. Tente novamente mais tarde.';
        case 'unauthenticated':
          return 'Usuário não autenticado.';
        case 'not-found':
          return 'Documento ou coleção não encontrado.';
        case 'already-exists':
          return 'Documento já existe.';
        case 'failed-precondition':
          return 'Pré-condição da operação falhou.';
        case 'aborted':
          return 'Operação foi abortada devido a conflito.';
        case 'out-of-range':
          return 'Operação fora do intervalo válido.';
        case 'unimplemented':
          return 'Operação não implementada.';
        case 'internal':
          return 'Erro interno do servidor.';
        case 'data-loss':
          return 'Perda de dados detectada.';
        default:
          return error.message || 'Erro desconhecido no Firebase.';
      }
    }
    
    return error?.message || 'Erro desconhecido.';
  }

  // ========== OPERAÇÕES ESPECÍFICAS PARA DEBUG ==========
  
  // Método para forçar reconexão
  async reconnect(): Promise<boolean> {
    try {
      console.log('🔄 Forçando reconexão com Firebase...');
      await disableNetwork(this.firestore);
      await enableNetwork(this.firestore);
      await this.testConnection();
      console.log('✅ Reconexão bem-sucedida');
      return true;
    } catch (error) {
      console.error('❌ Erro na reconexão:', error);
      return false;
    }
  }

  // Operações úteis para queries - constantes estáticas
  static constraints = {
    where,
    orderBy,
    limit
  };
}