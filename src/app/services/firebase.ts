// src/app/services/firebase.service.ts
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
  Unsubscribe
} from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  constructor(private firestore: Firestore) {}

  // ========== OPERAÇÕES BÁSICAS ==========

  // Criar documento com ID automático
  async create(collectionName: string, data: any): Promise<{success: boolean, id?: string, error?: string}> {
    try {
      const colRef = collection(this.firestore, collectionName);
      const docRef = await addDoc(colRef, {
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      return { success: true, id: docRef.id };
    } catch (error: any) {
      console.error(`Erro ao criar documento em ${collectionName}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Criar/atualizar documento com ID específico
  async set(collectionName: string, id: string, data: any): Promise<{success: boolean, error?: string}> {
    try {
      const docRef = doc(this.firestore, collectionName, id);
      await setDoc(docRef, {
        ...data,
        updatedAt: new Date()
      }, { merge: true });
      
      return { success: true };
    } catch (error: any) {
      console.error(`Erro ao definir documento ${id} em ${collectionName}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Buscar documento por ID
  async get(collectionName: string, id: string): Promise<{success: boolean, data?: any, error?: string}> {
    try {
      const docRef = doc(this.firestore, collectionName, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { 
          success: true, 
          data: { id: docSnap.id, ...docSnap.data() }
        };
      } else {
        return { success: false, error: 'Documento não encontrado' };
      }
    } catch (error: any) {
      console.error(`Erro ao buscar documento ${id} em ${collectionName}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Buscar todos os documentos de uma coleção
  async getAll(collectionName: string, constraints?: QueryConstraint[]): Promise<{success: boolean, data?: any[], error?: string}> {
    try {
      const colRef = collection(this.firestore, collectionName);
      const q = constraints ? query(colRef, ...constraints) : colRef;
      const querySnapshot = await getDocs(q);
      
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      return { success: true, data };
    } catch (error: any) {
      console.error(`Erro ao buscar documentos em ${collectionName}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Atualizar documento
  async update(collectionName: string, id: string, data: any): Promise<{success: boolean, error?: string}> {
    try {
      const docRef = doc(this.firestore, collectionName, id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: new Date()
      });
      
      return { success: true };
    } catch (error: any) {
      console.error(`Erro ao atualizar documento ${id} em ${collectionName}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Excluir documento
  async delete(collectionName: string, id: string): Promise<{success: boolean, error?: string}> {
    try {
      const docRef = doc(this.firestore, collectionName, id);
      await deleteDoc(docRef);
      
      return { success: true };
    } catch (error: any) {
      console.error(`Erro ao excluir documento ${id} em ${collectionName}:`, error);
      return { success: false, error: error.message };
    }
  }

  // ========== OPERAÇÕES ESPECÍFICAS ==========

  // Buscar por campo específico
  async findBy(
    collectionName: string, 
    field: string, 
    value: any,
    constraints?: QueryConstraint[]
  ): Promise<{success: boolean, data?: any[], error?: string}> {
    try {
      const colRef = collection(this.firestore, collectionName);
      const whereConstraint = where(field, '==', value);
      const allConstraints = constraints ? [whereConstraint, ...constraints] : [whereConstraint];
      const q = query(colRef, ...allConstraints);
      const querySnapshot = await getDocs(q);
      
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      return { success: true, data };
    } catch (error: any) {
      console.error(`Erro ao buscar por ${field}=${value} em ${collectionName}:`, error);
      return { success: false, error: error.message };
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
      console.error(`Erro ao buscar primeiro por ${field}=${value} em ${collectionName}:`, error);
      return { success: false, error: error.message };
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
      console.error(`Erro ao contar documentos em ${collectionName}:`, error);
      return { success: false, error: error.message };
    }
  }

  // ========== OPERAÇÕES EM TEMPO REAL ==========

  // Escutar mudanças em um documento
  listenToDoc(collectionName: string, id: string, callback: (data: any) => void): Unsubscribe {
    const docRef = doc(this.firestore, collectionName, id);
    
    return onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        callback({ id: doc.id, ...doc.data() });
      } else {
        callback(null);
      }
    }, (error) => {
      console.error(`Erro ao escutar documento ${id} em ${collectionName}:`, error);
      callback(null);
    });
  }

  // Escutar mudanças em uma coleção
  listenToCollection(
    collectionName: string, 
    callback: (data: any[]) => void,
    constraints?: QueryConstraint[]
  ): Unsubscribe {
    const colRef = collection(this.firestore, collectionName);
    const q = constraints ? query(colRef, ...constraints) : colRef;
    
    return onSnapshot(q, (querySnapshot) => {
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(data);
    }, (error) => {
      console.error(`Erro ao escutar coleção ${collectionName}:`, error);
      callback([]);
    });
  }

  // ========== OPERAÇÕES EM LOTE ==========

  // Criar múltiplos documentos
  async createBatch(collectionName: string, items: any[]): Promise<{success: boolean, ids?: string[], error?: string}> {
    try {
      const ids: string[] = [];
      const colRef = collection(this.firestore, collectionName);
      
      for (const item of items) {
        const docRef = await addDoc(colRef, {
          ...item,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        ids.push(docRef.id);
      }
      
      return { success: true, ids };
    } catch (error: any) {
      console.error(`Erro ao criar lote em ${collectionName}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Atualizar múltiplos documentos
  async updateBatch(collectionName: string, updates: {id: string, data: any}[]): Promise<{success: boolean, error?: string}> {
    try {
      for (const update of updates) {
        const docRef = doc(this.firestore, collectionName, update.id);
        await updateDoc(docRef, {
          ...update.data,
          updatedAt: new Date()
        });
      }
      
      return { success: true };
    } catch (error: any) {
      console.error(`Erro ao atualizar lote em ${collectionName}:`, error);
      return { success: false, error: error.message };
    }
  }

  // ========== UTILITÁRIOS ==========

  // Gerar ID único
  generateId(): string {
    return doc(collection(this.firestore, 'temp')).id;
  }

  // Validar se documento existe
  async exists(collectionName: string, id: string): Promise<boolean> {
    try {
      const result = await this.get(collectionName, id);
      return result.success;
    } catch (error) {
      return false;
    }
  }

  // Operações úteis para queries
  static constraints = {
    where,
    orderBy,
    limit
  };
}