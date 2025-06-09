// src/app/services/duplas.ts - MIGRADO PARA FIREBASE
import { Injectable } from '@angular/core';
import { Dupla, NovaDupla, TransferenciaDupla } from '../models/dupla.model';
import { PiramidesService } from './piramides';
import { FirebaseService } from './firebase';
import { orderBy, where } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class DuplasService {
  // Cache local para performance
  private cache = new Map<string, Dupla[]>();
  private lastUpdate = new Map<string, number>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

  constructor(
    private piramidesService: PiramidesService,
    private firebase: FirebaseService
  ) {}

  // ========== OPERAÇÕES BÁSICAS COM FIREBASE ==========

  async obterDuplas(piramideId?: string): Promise<Dupla[]> {
    const targetPiramideId = piramideId || this.piramidesService.getPiramideAtualId();
    if (!targetPiramideId) {
      return [];
    }

    try {
      console.log('📊 Buscando duplas do Firebase para pirâmide:', targetPiramideId);
      
      const result = await this.firebase.findBy(
        'duplas',
        'piramideId',
        targetPiramideId,
        [
          where('ativa', '==', true),
          orderBy('base', 'asc'),
          orderBy('posicao', 'asc')
        ]
      );

      if (result.success && result.data) {
        const duplas = result.data.map(d => this.formatarDupla(d));
        console.log(`✅ ${duplas.length} dupla(s) carregada(s) do Firebase`);
        return duplas;
      } else {
        console.log('⚠️ Nenhuma dupla encontrada ou erro:', result.error);
        return [];
      }
    } catch (error) {
      console.error('❌ Erro ao buscar duplas do Firebase:', error);
      return [];
    }
  }

  async obterDuplasComCache(piramideId?: string): Promise<Dupla[]> {
    const targetPiramideId = piramideId || this.piramidesService.getPiramideAtualId();
    if (!targetPiramideId) return [];

    const cacheKey = `duplas_${targetPiramideId}`;
    const now = Date.now();

    // Verificar cache
    if (this.cache.has(cacheKey) && 
        (now - (this.lastUpdate.get(cacheKey) || 0)) < this.CACHE_DURATION) {
      console.log('📋 Usando cache das duplas');
      return this.cache.get(cacheKey)!;
    }

    // Buscar do Firebase
    const duplas = await this.obterDuplas(targetPiramideId);
    this.cache.set(cacheKey, duplas);
    this.lastUpdate.set(cacheKey, now);

    return duplas;
  }

  async criarDupla(novaDupla: NovaDupla, piramideId?: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log('➕ Criando nova dupla no Firebase:', novaDupla);

      const targetPiramideId = piramideId || this.piramidesService.getPiramideAtualId();
      if (!targetPiramideId) {
        return { success: false, message: 'Nenhuma pirâmide selecionada' };
      }

      // Validações de proteção
      const podeAdicionarDuplas = this.piramidesService.podeAdicionarDuplas(targetPiramideId);
      if (!podeAdicionarDuplas.pode) {
        return { success: false, message: podeAdicionarDuplas.motivo! };
      }

      // Validar telefone único
      if (novaDupla.telefone && novaDupla.telefone.trim()) {
        const telefoneExistente = await this.verificarTelefoneExistente(novaDupla.telefone.trim());
        if (telefoneExistente.existe) {
          return {
            success: false,
            message: `Este telefone já está cadastrado para a dupla: ${telefoneExistente.dupla!.jogador1}/${telefoneExistente.dupla!.jogador2}`
          };
        }
      }

      // Validar dupla única
      const duplaExistente = await this.verificarDuplaExistente(
        novaDupla.jogador1.trim(), 
        novaDupla.jogador2.trim(), 
        targetPiramideId
      );
      if (duplaExistente.existe) {
        return {
          success: false,
          message: `Esta dupla já existe na pirâmide: ${duplaExistente.dupla!.jogador1}/${duplaExistente.dupla!.jogador2}`
        };
      }

      // Verificar capacidade da pirâmide
      const capacidade = await this.validarCapacidadePiramide(targetPiramideId);
      if (!capacidade.podeAdicionar) {
        return { success: false, message: capacidade.message };
      }

      // Encontrar posição na pirâmide
      const proximaBase = await this.encontrarProximaBaseDisponivel(targetPiramideId);
      const proximaPosicao = await this.encontrarProximaPosicao(targetPiramideId, proximaBase);

      // Criar dupla no Firebase
      const duplaData = {
        piramideId: targetPiramideId,
        jogador1: novaDupla.jogador1.trim(),
        jogador2: novaDupla.jogador2.trim(),
        telefone: novaDupla.telefone?.trim() || '',
        base: proximaBase,
        posicao: proximaPosicao,
        vitorias: 0,
        derrotas: 0,
        ativa: true,
        dataIngresso: new Date(),
        observacoes: novaDupla.observacoes?.trim() || ''
      };

      const result = await this.firebase.create('duplas', duplaData);

      if (result.success) {
        // Limpar cache para forçar reload
        this.limparCache(targetPiramideId);
        
        // Reorganizar pirâmide
        await this.reorganizarPiramide(targetPiramideId);
        
        const posicaoFinal = await this.calcularPosicaoGeral(result.id!, targetPiramideId);
        
        console.log('✅ Dupla criada no Firebase com sucesso');
        return { 
          success: true, 
          message: `Dupla adicionada na ${posicaoFinal}ª posição da pirâmide` 
        };
      } else {
        return { 
          success: false, 
          message: result.error || 'Erro ao criar dupla no Firebase' 
        };
      }
    } catch (error) {
      console.error('❌ Erro ao criar dupla:', error);
      return { 
        success: false, 
        message: 'Erro ao adicionar dupla. Tente novamente.' 
      };
    }
  }

  async removerDupla(duplaId: string): Promise<{ success: boolean, message: string }> {
    try {
      console.log('🗑️ Removendo dupla do Firebase:', duplaId);

      // Buscar dupla no Firebase
      const duplaResult = await this.firebase.get('duplas', duplaId);
      if (!duplaResult.success) {
        return { success: false, message: 'Dupla não encontrada' };
      }

      const dupla = this.formatarDupla(duplaResult.data);

      // Validar permissões
      const podeModificar = this.piramidesService.podeAdicionarDuplas(dupla.piramideId);
      if (!podeModificar.pode) {
        return {
          success: false,
          message: `Não é possível remover dupla: ${podeModificar.motivo}`
        };
      }

      // Marcar como inativa em vez de deletar (soft delete)
      const updateResult = await this.firebase.update('duplas', duplaId, {
        ativa: false,
        dataRemocao: new Date()
      });

      if (updateResult.success) {
        // Limpar cache
        this.limparCache(dupla.piramideId);
        
        // Reorganizar pirâmide
        await this.reorganizarPiramide(dupla.piramideId);
        
        console.log('✅ Dupla removida do Firebase com sucesso');
        return { 
          success: true, 
          message: 'Dupla removida e pirâmide reorganizada com sucesso' 
        };
      } else {
        return { 
          success: false, 
          message: updateResult.error || 'Erro ao remover dupla' 
        };
      }
    } catch (error) {
      console.error('❌ Erro ao remover dupla:', error);
      return { 
        success: false, 
        message: 'Erro ao remover dupla. Tente novamente.' 
      };
    }
  }

  // ========== VALIDAÇÕES COM FIREBASE ==========

  async verificarTelefoneExistente(telefone: string): Promise<{ existe: boolean; dupla?: Dupla }> {
    try {
      const telefoneLimpo = this.limparTelefone(telefone);
      
      if (!telefoneLimpo || telefoneLimpo.length < 10) {
        return { existe: false };
      }

      const result = await this.firebase.findBy(
        'duplas',
        'telefone',
        telefoneLimpo,
        [where('ativa', '==', true)]
      );

      if (result.success && result.data && result.data.length > 0) {
        const dupla = this.formatarDupla(result.data[0]);
        return { existe: true, dupla };
      }

      return { existe: false };
    } catch (error) {
      console.error('Erro ao verificar telefone:', error);
      return { existe: false };
    }
  }

  async verificarDuplaExistente(jogador1: string, jogador2: string, piramideId: string): Promise<{ existe: boolean; dupla?: Dupla }> {
    try {
      const nome1 = jogador1.toLowerCase().trim();
      const nome2 = jogador2.toLowerCase().trim();

      // Buscar duplas da pirâmide
      const result = await this.firebase.findBy(
        'duplas',
        'piramideId',
        piramideId,
        [where('ativa', '==', true)]
      );

      if (result.success && result.data) {
        const dupla = result.data.find(d => {
          const dNome1 = d.jogador1.toLowerCase().trim();
          const dNome2 = d.jogador2.toLowerCase().trim();
          
          return (dNome1 === nome1 && dNome2 === nome2) || 
                 (dNome1 === nome2 && dNome2 === nome1);
        });

        if (dupla) {
          return { existe: true, dupla: this.formatarDupla(dupla) };
        }
      }

      return { existe: false };
    } catch (error) {
      console.error('Erro ao verificar dupla existente:', error);
      return { existe: false };
    }
  }

  async obterDuplasPorTelefone(telefone: string, piramideId?: string): Promise<Dupla | null> {
    try {
      const telefoneLimpo = this.limparTelefone(telefone);
      
      if (!telefoneLimpo || telefoneLimpo.length < 10) {
        return null;
      }

      console.log('🔍 Buscando dupla por telefone no Firebase:', telefoneLimpo);

      const constraints = [
        where('telefone', '==', telefoneLimpo),
        where('ativa', '==', true)
      ];

      if (piramideId) {
        constraints.push(where('piramideId', '==', piramideId));
      }

      const result = await this.firebase.getAll('duplas', constraints);

      if (result.success && result.data && result.data.length > 0) {
        const dupla = this.formatarDupla(result.data[0]);
        console.log('✅ Dupla encontrada no Firebase:', `${dupla.jogador1}/${dupla.jogador2}`);
        return dupla;
      }

      console.log('❌ Dupla não encontrada no Firebase');
      return null;
    } catch (error) {
      console.error('❌ Erro ao buscar dupla por telefone:', error);
      return null;
    }
  }

  // ========== OPERAÇÕES DE POSIÇÃO ==========

  async atualizarPosicoes(movimentacoes: { dupla: Dupla; novaPos: number }[]): Promise<{ success: boolean, message: string }> {
    try {
      console.log('🔄 Atualizando posições no Firebase:', movimentacoes.length, 'duplas');

      // Validar permissões
      const piramidesEnvolvidas = new Set(movimentacoes.map(m => m.dupla.piramideId));
      
      for (const piramideId of piramidesEnvolvidas) {
        const podeModificar = this.piramidesService.podeCriarDesafios(piramideId);
        if (!podeModificar.pode) {
          return {
            success: false,
            message: `Não é possível atualizar posições: ${podeModificar.motivo}`
          };
        }
      }

      // Preparar updates para Firebase
      const updates = movimentacoes.map(movimentacao => {
        const novaBase = this.calcularBasePorPosicao(movimentacao.novaPos);
        const novaPosicaoNaBase = this.calcularPosicaoNaBasePorPosicao(movimentacao.novaPos);
        
        return {
          id: movimentacao.dupla.id,
          data: {
            base: novaBase,
            posicao: novaPosicaoNaBase,
            ultimaMovimentacao: new Date()
          }
        };
      });

      // Executar updates em lote
      const result = await this.firebase.updateBatch('duplas', updates);

      if (result.success) {
        // Limpar cache das pirâmides envolvidas
        piramidesEnvolvidas.forEach(piramideId => {
          this.limparCache(piramideId);
        });

        console.log('✅ Posições atualizadas no Firebase com sucesso!');
        return {
          success: true,
          message: 'Posições atualizadas com sucesso!'
        };
      } else {
        return {
          success: false,
          message: result.error || 'Erro ao atualizar posições'
        };
      }
    } catch (error) {
      console.error('❌ Erro ao atualizar posições:', error);
      return {
        success: false,
        message: 'Erro ao atualizar posições. Tente novamente.'
      };
    }
  }

  async registrarResultadoJogo(vencedorId: string, perdedorId: string): Promise<{ success: boolean, message: string }> {
    try {
      console.log('📊 Registrando resultado no Firebase:', vencedorId, 'vs', perdedorId);

      // Buscar duplas
      const [vencedorResult, perdedorResult] = await Promise.all([
        this.firebase.get('duplas', vencedorId),
        this.firebase.get('duplas', perdedorId)
      ]);

      if (!vencedorResult.success || !perdedorResult.success) {
        return { success: false, message: 'Duplas não encontradas' };
      }

      const vencedor = this.formatarDupla(vencedorResult.data);
      const perdedor = this.formatarDupla(perdedorResult.data);

      // Validar permissões
      const podeJogar = this.piramidesService.podeCriarDesafios(vencedor.piramideId);
      if (!podeJogar.pode) {
        return {
          success: false,
          message: `Não é possível registrar resultado: ${podeJogar.motivo}`
        };
      }

      // Atualizar estatísticas
      const updates = [
        {
          id: vencedorId,
          data: {
            vitorias: (vencedor.vitorias || 0) + 1,
            ultimoJogo: new Date()
          }
        },
        {
          id: perdedorId,
          data: {
            derrotas: (perdedor.derrotas || 0) + 1,
            ultimoJogo: new Date()
          }
        }
      ];

      const result = await this.firebase.updateBatch('duplas', updates);

      if (result.success) {
        // Limpar cache
        this.limparCache(vencedor.piramideId);

        console.log('✅ Resultado registrado no Firebase com sucesso');
        return {
          success: true,
          message: 'Resultado registrado e estatísticas atualizadas!'
        };
      } else {
        return {
          success: false,
          message: result.error || 'Erro ao registrar resultado'
        };
      }
    } catch (error) {
      console.error('❌ Erro ao registrar resultado:', error);
      return {
        success: false,
        message: 'Erro ao registrar resultado'
      };
    }
  }

  // ========== ORGANIZAÇÃO DE DADOS ==========

  async obterDuplasOrganizadas(piramideId?: string): Promise<Dupla[][]> {
    const duplas = await this.obterDuplasComCache(piramideId);
    const basesOrganizadas: Dupla[][] = [];
    
    // Inicializar todas as bases (1 a 9)
    for (let i = 0; i < 9; i++) {
      basesOrganizadas[i] = [];
    }
    
    // Organizar duplas por base
    duplas.forEach(dupla => {
      if (dupla.base >= 1 && dupla.base <= 9) {
        basesOrganizadas[dupla.base - 1].push(dupla);
      }
    });
    
    // Ordenar por posição dentro de cada base
    basesOrganizadas.forEach(base => {
      base.sort((a, b) => a.posicao - b.posicao);
    });
    
    return basesOrganizadas;
  }

  // ========== UTILITÁRIOS ==========

  private formatarDupla(data: any): Dupla {
    return {
      ...data,
      dataIngresso: data.dataIngresso?.toDate ? data.dataIngresso.toDate() : new Date(data.dataIngresso),
      ultimoJogo: data.ultimoJogo?.toDate ? data.ultimoJogo.toDate() : (data.ultimoJogo ? new Date(data.ultimoJogo) : undefined),
      ultimaMovimentacao: data.ultimaMovimentacao?.toDate ? data.ultimaMovimentacao.toDate() : (data.ultimaMovimentacao ? new Date(data.ultimaMovimentacao) : undefined)
    };
  }

  private limparTelefone(telefone: string): string {
    if (!telefone) return '';
    return telefone.replace(/\D/g, '');
  }

  private limparCache(piramideId?: string): void {
    if (piramideId) {
      const cacheKey = `duplas_${piramideId}`;
      this.cache.delete(cacheKey);
      this.lastUpdate.delete(cacheKey);
      console.log('🧹 Cache limpo para pirâmide:', piramideId);
    } else {
      this.cache.clear();
      this.lastUpdate.clear();
      console.log('🧹 Todo cache de duplas limpo');
    }
  }

  // ========== OPERAÇÕES DE REORGANIZAÇÃO ==========

  private async reorganizarPiramide(piramideId: string): Promise<void> {
    try {
      console.log('🔄 Reorganizando pirâmide no Firebase:', piramideId);
      
      const duplas = await this.obterDuplas(piramideId);
      
      // Ordenar por posição atual
      duplas.sort((a, b) => {
        const posA = this.calcularPosicaoGeralLocal(a);
        const posB = this.calcularPosicaoGeralLocal(b);
        return posA - posB;
      });
      
      // Reassinar posições sequencialmente
      const updates: { id: string; data: any }[] = [];
      let posicaoAtual = 1;
      
      for (const dupla of duplas) {
        const novaBase = this.calcularBasePorPosicao(posicaoAtual);
        const novaPosicaoNaBase = this.calcularPosicaoNaBasePorPosicao(posicaoAtual);
        
        if (dupla.base !== novaBase || dupla.posicao !== novaPosicaoNaBase) {
          updates.push({
            id: dupla.id,
            data: {
              base: novaBase,
              posicao: novaPosicaoNaBase,
              ultimaReorganizacao: new Date()
            }
          });
        }
        
        posicaoAtual++;
      }

      if (updates.length > 0) {
        await this.firebase.updateBatch('duplas', updates);
        this.limparCache(piramideId);
        console.log(`✅ ${updates.length} dupla(s) reorganizada(s) no Firebase`);
      }
    } catch (error) {
      console.error('❌ Erro ao reorganizar pirâmide:', error);
    }
  }

  private async encontrarProximaBaseDisponivel(piramideId: string): Promise<number> {
    const duplas = await this.obterDuplas(piramideId);
    const totalDuplas = duplas.length;
    
    let posicoesOcupadas = 0;
    
    for (let base = 1; base <= 9; base++) {
      const novoTotal = posicoesOcupadas + base;
      
      if (totalDuplas < novoTotal) {
        return base;
      }
      
      posicoesOcupadas = novoTotal;
    }
    
    return 9; // Fallback
  }

  private async encontrarProximaPosicao(piramideId: string, base: number): Promise<number> {
    const duplas = await this.obterDuplas(piramideId);
    const totalDuplas = duplas.length;
    
    let posicoesAnteriores = 0;
    for (let i = 1; i < base; i++) {
      posicoesAnteriores += i;
    }
    
    const posicaoNaBase = totalDuplas - posicoesAnteriores + 1;
    return Math.max(1, Math.min(posicaoNaBase, base));
  }

  private async calcularPosicaoGeral(duplaId: string, piramideId: string): Promise<number> {
    try {
      const duplas = await this.obterDuplas(piramideId);
      const dupla = duplas.find(d => d.id === duplaId);
      
      if (!dupla) return 0;
      
      let posicoesAnteriores = 0;
      for (let i = 1; i < dupla.base; i++) {
        posicoesAnteriores += i;
      }
      
      return posicoesAnteriores + dupla.posicao;
    } catch (error) {
      console.error('Erro ao calcular posição geral:', error);
      return 0;
    }
  }

  private calcularPosicaoGeralLocal(dupla: Dupla): number {
    let posicoesAnteriores = 0;
    for (let i = 1; i < dupla.base; i++) {
      posicoesAnteriores += i;
    }
    return posicoesAnteriores + dupla.posicao;
  }

  private calcularBasePorPosicao(posicaoGeral: number): number {
    let posicoesAcumuladas = 0;
    
    for (let base = 1; base <= 9; base++) {
      if (posicaoGeral <= posicoesAcumuladas + base) {
        return base;
      }
      posicoesAcumuladas += base;
    }
    
    return 9; // Fallback
  }

  private calcularPosicaoNaBasePorPosicao(posicaoGeral: number): number {
    let posicoesAcumuladas = 0;
    
    for (let base = 1; base <= 9; base++) {
      if (posicaoGeral <= posicoesAcumuladas + base) {
        return posicaoGeral - posicoesAcumuladas;
      }
      posicoesAcumuladas += base;
    }
    
    return 1; // Fallback
  }

  // ========== VALIDAÇÕES DE CAPACIDADE ==========

  async validarCapacidadePiramide(piramideId: string): Promise<{ podeAdicionar: boolean, message: string }> {
    try {
      const piramides = await this.piramidesService.obterPiramides();
      const piramide = piramides.find(p => p.id === piramideId);
      
      if (!piramide) {
        return { podeAdicionar: false, message: 'Pirâmide não encontrada' };
      }

      const podeAdicionar = this.piramidesService.podeAdicionarDuplas(piramideId);
      if (!podeAdicionar.pode) {
        return { podeAdicionar: false, message: podeAdicionar.motivo! };
      }

      const duplas = await this.obterDuplas(piramideId);
      const totalDuplas = duplas.length;
      const maxDuplas = piramide.maxDuplas;
      
      if (totalDuplas >= maxDuplas) {
        return {
          podeAdicionar: false,
          message: `Pirâmide "${piramide.nome}" está com capacidade máxima (${maxDuplas} duplas)`
        };
      }
      
      return {
        podeAdicionar: true,
        message: `Você pode adicionar mais ${maxDuplas - totalDuplas} dupla(s) na pirâmide "${piramide.nome}"`
      };
    } catch (error) {
      console.error('Erro ao validar capacidade:', error);
      return { podeAdicionar: false, message: 'Erro ao validar capacidade da pirâmide' };
    }
  }

  // ========== OPERAÇÕES DE TRANSFERÊNCIA ==========

  async transferirDupla(transferencia: TransferenciaDupla): Promise<{ success: boolean; message: string }> {
    try {
      console.log('🔄 Transferindo dupla entre pirâmides no Firebase:', transferencia);

      // Buscar dupla
      const duplaResult = await this.firebase.get('duplas', transferencia.duplaId);
      if (!duplaResult.success) {
        return { success: false, message: 'Dupla não encontrada' };
      }

      const dupla = this.formatarDupla(duplaResult.data);

      // Validações de proteção
      const podeOrigemPerder = this.piramidesService.podeAdicionarDuplas(transferencia.piramideOrigemId);
      const podeDestinoReceber = this.piramidesService.podeAdicionarDuplas(transferencia.piramideDestinoId);
      
      if (!podeOrigemPerder.pode) {
        return { success: false, message: `Pirâmide origem: ${podeOrigemPerder.motivo}` };
      }
      
      if (!podeDestinoReceber.pode) {
        return { success: false, message: `Pirâmide destino: ${podeDestinoReceber.motivo}` };
      }

      // Verificar capacidade da pirâmide destino
      const capacidade = await this.validarCapacidadePiramide(transferencia.piramideDestinoId);
      if (!capacidade.podeAdicionar) {
        return { success: false, message: `Pirâmide destino: ${capacidade.message}` };
      }

      // Encontrar posição na nova pirâmide
      const novaBase = await this.encontrarProximaBaseDisponivel(transferencia.piramideDestinoId);
      const novaPosicao = await this.encontrarProximaPosicao(transferencia.piramideDestinoId, novaBase);
      
      // Preparar dados da transferência
      const updateData: any = {
        piramideId: transferencia.piramideDestinoId,
        base: novaBase,
        posicao: novaPosicao,
        dataTransferencia: new Date(),
        piramideAnterior: transferencia.piramideOrigemId
      };

      // Resetar estatísticas se solicitado
      if (!transferencia.manterEstatisticas) {
        updateData.vitorias = 0;
        updateData.derrotas = 0;
      }

      // Adicionar observações da transferência
      if (transferencia.observacoes) {
        const observacoesAtuais = dupla.observacoes || '';
        updateData.observacoes = observacoesAtuais ? 
          `${observacoesAtuais} | Transferência: ${transferencia.observacoes}` : 
          `Transferência: ${transferencia.observacoes}`;
      }

      // Executar transferência
      const result = await this.firebase.update('duplas', transferencia.duplaId, updateData);

      if (result.success) {
        // Limpar cache das duas pirâmides
        this.limparCache(transferencia.piramideOrigemId);
        this.limparCache(transferencia.piramideDestinoId);
        
        // Reorganizar ambas as pirâmides
        await Promise.all([
          this.reorganizarPiramide(transferencia.piramideOrigemId),
          this.reorganizarPiramide(transferencia.piramideDestinoId)
        ]);

        console.log('✅ Dupla transferida no Firebase com sucesso');
        return {
          success: true,
          message: `Dupla transferida com sucesso! ${transferencia.manterEstatisticas ? 'Estatísticas mantidas.' : 'Estatísticas resetadas.'}`
        };
      } else {
        return {
          success: false,
          message: result.error || 'Erro ao transferir dupla'
        };
      }
    } catch (error) {
      console.error('❌ Erro ao transferir dupla:', error);
      return {
        success: false,
        message: 'Erro ao transferir dupla. Tente novamente.'
      };
    }
  }

  // ========== OPERAÇÕES ESPECÍFICAS POR PIRÂMIDE ==========

  async contarDuplasPiramide(piramideId: string): Promise<number> {
    try {
      const result = await this.firebase.findBy(
        'duplas',
        'piramideId',
        piramideId,
        [where('ativa', '==', true)]
      );

      return result.success && result.data ? result.data.length : 0;
    } catch (error) {
      console.error('Erro ao contar duplas:', error);
      return 0;
    }
  }

  async obterEstatisticasPiramide(piramideId: string): Promise<{
    totalDuplas: number;
    vagasDisponiveis: number;
    duplaMaisVitorias: Dupla | null;
    duplaMaisAtiva: Dupla | null;
  }> {
    try {
      const duplas = await this.obterDuplas(piramideId);
      const piramides = await this.piramidesService.obterPiramides();
      const piramide = piramides.find(p => p.id === piramideId);
      
      const maxDuplas = piramide?.maxDuplas || 45;
      
      // Encontrar dupla com mais vitórias
      const duplaMaisVitorias = duplas.length > 0 ? 
        duplas.reduce((max, dupla) => dupla.vitorias > max.vitorias ? dupla : max) : 
        null;
      
      // Encontrar dupla mais ativa (mais jogos)
      const duplaMaisAtiva = duplas.length > 0 ? 
        duplas.reduce((max, dupla) => 
          (dupla.vitorias + dupla.derrotas) > (max.vitorias + max.derrotas) ? dupla : max
        ) : 
        null;

      return {
        totalDuplas: duplas.length,
        vagasDisponiveis: maxDuplas - duplas.length,
        duplaMaisVitorias,
        duplaMaisAtiva
      };
    } catch (error) {
      console.error('Erro ao obter estatísticas:', error);
      return {
        totalDuplas: 0,
        vagasDisponiveis: 0,
        duplaMaisVitorias: null,
        duplaMaisAtiva: null
      };
    }
  }

  // ========== OPERAÇÕES DE EXCLUSÃO ==========

  async excluirTodasDuplasPiramide(piramideId: string): Promise<{ success: boolean; message: string; duplasRemovidas: number }> {
    try {
      console.log('🗑️ Excluindo todas as duplas da pirâmide no Firebase:', piramideId);

      // Buscar todas as duplas da pirâmide
      const result = await this.firebase.findBy(
        'duplas',
        'piramideId',
        piramideId
      );

      if (!result.success || !result.data) {
        return { success: true, message: 'Nenhuma dupla encontrada para remover', duplasRemovidas: 0 };
      }

      const duplas = result.data;
      const quantidadeRemovida = duplas.length;

      // Marcar todas como inativas (soft delete)
      const updates = duplas.map(dupla => ({
        id: dupla.id,
        data: {
          ativa: false,
          dataRemocao: new Date(),
          motivoRemocao: 'Pirâmide excluída'
        }
      }));

      const updateResult = await this.firebase.updateBatch('duplas', updates);

      if (updateResult.success) {
        // Limpar cache
        this.limparCache(piramideId);

        console.log(`✅ ${quantidadeRemovida} dupla(s) removida(s) do Firebase`);
        return {
          success: true,
          message: `${quantidadeRemovida} dupla(s) removida(s) da pirâmide excluída`,
          duplasRemovidas: quantidadeRemovida
        };
      } else {
        return {
          success: false,
          message: updateResult.error || 'Erro ao remover duplas',
          duplasRemovidas: 0
        };
      }
    } catch (error) {
      console.error('❌ Erro ao excluir duplas da pirâmide:', error);
      return {
        success: false,
        message: 'Erro ao remover duplas da pirâmide',
        duplasRemovidas: 0
      };
    }
  }

  // ========== VALIDAÇÃO DE FORMATO ==========

  validarFormatoTelefone(telefone: string): { valido: boolean; motivo?: string } {
    if (!telefone || telefone.trim() === '') {
      return { valido: false, motivo: 'Telefone é obrigatório' };
    }
    
    const telefoneLimpo = this.limparTelefone(telefone);
    
    if (telefoneLimpo.length < 10) {
      return { valido: false, motivo: 'Telefone deve ter pelo menos 10 dígitos' };
    }
    
    if (telefoneLimpo.length > 11) {
      return { valido: false, motivo: 'Telefone deve ter no máximo 11 dígitos' };
    }
    
    // Validações específicas para formato brasileiro
    if (telefoneLimpo.length === 11) {
      const ddd = telefoneLimpo.substring(0, 2);
      const terceiroDigito = telefoneLimpo.charAt(2);
      
      const dddsValidos = [
        '11', '12', '13', '14', '15', '16', '17', '18', '19', // SP
        '21', '22', '24', '27', '28', // RJ/ES
        '31', '32', '33', '34', '35', '37', '38', // MG
        '41', '42', '43', '44', '45', '46', // PR
        '47', '48', '49', // SC
        '51', '53', '54', '55', // RS
        '61', '62', '63', '64', '65', '66', '67', '68', '69', // Centro-Oeste
        '71', '73', '74', '75', '77', '79', // BA/SE
        '81', '82', '83', '84', '85', '86', '87', '88', '89', // Nordeste
        '91', '92', '93', '94', '95', '96', '97', '98', '99' // Norte
      ];
      
      if (!dddsValidos.includes(ddd)) {
        return { valido: false, motivo: 'DDD inválido' };
      }
      
      if (terceiroDigito !== '9') {
        return { valido: false, motivo: 'Celular deve ter 9 como terceiro dígito' };
      }
    } else if (telefoneLimpo.length === 10) {
      const ddd = telefoneLimpo.substring(0, 2);
      const terceiroDigito = telefoneLimpo.charAt(2);
      
      if (parseInt(ddd) < 11 || parseInt(ddd) > 99) {
        return { valido: false, motivo: 'DDD inválido' };
      }
      
      if (terceiroDigito === '0' || terceiroDigito === '1') {
        return { valido: false, motivo: 'Terceiro dígito inválido para telefone fixo' };
      }
    }
    
    return { valido: true };
  }

  // ========== OPERAÇÕES DE BACKUP/IMPORTAÇÃO ==========

  async exportarDuplasPiramide(piramideId: string): Promise<Dupla[]> {
    try {
      const duplas = await this.obterDuplas(piramideId);
      console.log(`📤 Exportando ${duplas.length} dupla(s) da pirâmide ${piramideId}`);
      return duplas;
    } catch (error) {
      console.error('Erro ao exportar duplas:', error);
      return [];
    }
  }

  async importarDuplas(duplas: Dupla[]): Promise<{ success: boolean; message: string }> {
    try {
      console.log('📥 Importando duplas para Firebase:', duplas.length);
      
      const duplasValidas = duplas.filter(dupla => 
        dupla.id && dupla.piramideId && dupla.jogador1 && dupla.jogador2
      );

      if (duplasValidas.length === 0) {
        return {
          success: false,
          message: 'Nenhuma dupla válida encontrada no arquivo'
        };
      }

      // Validar permissões das pirâmides
      const piramidesEnvolvidas = new Set(duplasValidas.map(d => d.piramideId));
      
      for (const piramideId of piramidesEnvolvidas) {
        const podeModificar = this.piramidesService.podeAdicionarDuplas(piramideId);
        if (!podeModificar.pode) {
          return {
            success: false,
            message: `Não é possível importar para a pirâmide ${piramideId}: ${podeModificar.motivo}`
          };
        }
      }

      // Preparar dados para Firebase
      const duplasParaImportar = duplasValidas.map(dupla => {
        const { id, ...dadosDupla } = dupla;
        return {
          ...dadosDupla,
          dataImportacao: new Date(),
          importada: true
        };
      });

      // Criar em lote no Firebase
      const result = await this.firebase.createBatch('duplas', duplasParaImportar);

      if (result.success) {
        // Limpar cache de todas as pirâmides envolvidas
        piramidesEnvolvidas.forEach(piramideId => {
          this.limparCache(piramideId);
        });

        console.log(`✅ ${duplasValidas.length} dupla(s) importada(s) para Firebase`);
        return {
          success: true,
          message: `${duplasValidas.length} duplas importadas com sucesso!`
        };
      } else {
        return {
          success: false,
          message: result.error || 'Erro ao importar duplas'
        };
      }
    } catch (error) {
      console.error('❌ Erro ao importar duplas:', error);
      return {
        success: false,
        message: 'Erro ao importar duplas'
      };
    }
  }

  // ========== MÉTODO DE ATUALIZAÇÃO GERAL ==========

  async atualizarDupla(duplaId: string, dados: Partial<Dupla>): Promise<{ success: boolean, message: string }> {
    try {
      // Buscar dupla atual
      const duplaResult = await this.firebase.get('duplas', duplaId);
      if (!duplaResult.success) {
        return { success: false, message: 'Dupla não encontrada' };
      }

      const dupla = this.formatarDupla(duplaResult.data);

      // Validar permissões
      const podeModificar = this.piramidesService.podeAdicionarDuplas(dupla.piramideId);
      if (!podeModificar.pode) {
        return {
          success: false,
          message: `Não é possível atualizar dupla: ${podeModificar.motivo}`
        };
      }
      
      // Não permitir alterar piramideId através desta função
      const { piramideId, id, ...dadosPermitidos } = dados;
      
      // Adicionar timestamp de atualização
      const dadosAtualizacao = {
        ...dadosPermitidos,
        ultimaAtualizacao: new Date()
      };

      const result = await this.firebase.update('duplas', duplaId, dadosAtualizacao);
      
      if (result.success) {
        // Limpar cache
        this.limparCache(dupla.piramideId);
        
        console.log('✅ Dupla atualizada no Firebase com sucesso');
        return { 
          success: true, 
          message: 'Dupla atualizada com sucesso' 
        };
      } else {
        return { 
          success: false, 
          message: result.error || 'Erro ao atualizar dupla' 
        };
      }
    } catch (error) {
      console.error('❌ Erro ao atualizar dupla:', error);
      return { 
        success: false, 
        message: 'Erro ao atualizar dupla. Tente novamente.' 
      };
    }
  }
}