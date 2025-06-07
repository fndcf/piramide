// src/app/services/duplas.ts - ATUALIZADO COM PROTEÇÕES

import { Injectable } from '@angular/core';
import { Dupla, NovaDupla, TransferenciaDupla } from '../models/dupla.model';
import { PiramidesService } from './piramides';

@Injectable({
  providedIn: 'root'
})
export class DuplasService {
  private duplas: Dupla[] = [];
  private nextId = 1;

  constructor(private piramidesService: PiramidesService) {
    this.inicializarDados();
  }

  // ========== ✅ VALIDAÇÕES DE PROTEÇÃO INTEGRADAS ==========

  async criarDupla(novaDupla: NovaDupla, piramideId?: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.delay(500);

      // Usar pirâmide atual se não especificada
      const targetPiramideId = piramideId || this.piramidesService.getPiramideAtualId();
      if (!targetPiramideId) {
        return {
          success: false,
          message: 'Nenhuma pirâmide selecionada'
        };
      }

      // ✅ NOVA VALIDAÇÃO: Verificar se a pirâmide aceita duplas
      const podeAdicionarDuplas = this.piramidesService.podeAdicionarDuplas(targetPiramideId);
      if (!podeAdicionarDuplas.pode) {
        return {
          success: false,
          message: podeAdicionarDuplas.motivo!
        };
      }

      // Verificar capacidade da pirâmide específica
      const capacidade = await this.validarCapacidadePiramide(targetPiramideId);
      if (!capacidade.podeAdicionar) {
        return {
          success: false,
          message: capacidade.message
        };
      }

      // Encontrar a próxima posição na pirâmide específica
      const proximaBase = this.encontrarProximaBaseDisponivel(targetPiramideId);
      const proximaPosicao = this.encontrarProximaPosicao(targetPiramideId, proximaBase);

      const dupla: Dupla = {
        id: this.nextId.toString(),
        piramideId: targetPiramideId,
        jogador1: novaDupla.jogador1.trim(),
        jogador2: novaDupla.jogador2.trim(),
        telefone: novaDupla.telefone?.trim() || '',
        base: proximaBase,
        posicao: proximaPosicao,
        pontos: 0,
        vitorias: 0,
        derrotas: 0,
        ativa: true,
        dataIngresso: new Date(),
        email: novaDupla.email?.trim() || '',
        observacoes: novaDupla.observacoes?.trim() || ''
      };

      this.duplas.push(dupla);
      this.nextId++;
      
      // Reorganizar apenas a pirâmide específica
      await this.reorganizarPiramide(targetPiramideId);
      
      const posicaoFinal = this.calcularPosicaoGeral(dupla);
      
      return { 
        success: true, 
        message: `Dupla adicionada na ${posicaoFinal}ª posição da pirâmide` 
      };
    } catch (error) {
      return { 
        success: false, 
        message: 'Erro ao adicionar dupla. Tente novamente.' 
      };
    }
  }

  async removerDupla(duplaId: string): Promise<{ success: boolean, message: string }> {
    try {
      await this.delay(300);
      
      const dupla = this.duplas.find(d => d.id === duplaId);
      if (!dupla) {
        return { 
          success: false, 
          message: 'Dupla não encontrada' 
        };
      }

      // ✅ NOVA VALIDAÇÃO: Verificar se a pirâmide permite modificações
      const podeModificar = this.piramidesService.podeAdicionarDuplas(dupla.piramideId);
      if (!podeModificar.pode) {
        return {
          success: false,
          message: `Não é possível remover dupla: ${podeModificar.motivo}`
        };
      }
      
      dupla.ativa = false;
      
      // Reorganizar apenas a pirâmide da dupla removida
      await this.reorganizarPiramide(dupla.piramideId);
      
      return { 
        success: true, 
        message: 'Dupla removida e pirâmide reorganizada com sucesso' 
      };
    } catch (error) {
      return { 
        success: false, 
        message: 'Erro ao remover dupla. Tente novamente.' 
      };
    }
  }

  // ✅ NOVA FUNÇÃO: Validar se é possível criar desafios
  async validarDesafio(desafianteId: string, desafiadoId: string): Promise<{ valido: boolean; motivo?: string }> {
    const desafiante = this.duplas.find(d => d.id === desafianteId);
    const desafiado = this.duplas.find(d => d.id === desafiadoId);

    if (!desafiante || !desafiado) {
      return {
        valido: false,
        motivo: 'Uma ou ambas as duplas não foram encontradas'
      };
    }

    if (desafiante.piramideId !== desafiado.piramideId) {
      return {
        valido: false,
        motivo: 'Não é possível desafiar duplas de pirâmides diferentes'
      };
    }

    // ✅ VALIDAÇÃO DE PROTEÇÃO: Verificar se a pirâmide aceita desafios
    const podeDesafiar = this.piramidesService.podeCriarDesafios(desafiante.piramideId);
    if (!podeDesafiar.pode) {
      return {
        valido: false,
        motivo: podeDesafiar.motivo
      };
    }

    return { valido: true };
  }

  async atualizarPosicoes(movimentacoes: { dupla: Dupla; novaPos: number }[]): Promise<{ success: boolean, message: string }> {
    try {
      await this.delay(500);

      // ✅ VALIDAÇÃO DE PROTEÇÃO: Verificar se todas as pirâmides envolvidas permitem alterações
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

      console.log('🔄 Iniciando atualização de posições:', movimentacoes);

      // Criar um mapa de todas as duplas por ID para facilitar busca
      const mapaDuplas = new Map<string, Dupla>();
      this.duplas.forEach(dupla => {
        if (dupla.ativa) {
          mapaDuplas.set(dupla.id, dupla);
        }
      });

      // Aplicar as movimentações
      for (const movimentacao of movimentacoes) {
        const dupla = mapaDuplas.get(movimentacao.dupla.id);
        if (dupla) {
          // Calcular nova base e posição baseado na posição geral
          const novaBase = this.calcularBasePorPosicao(movimentacao.novaPos);
          const novaPosicaoNaBase = this.calcularPosicaoNaBasePorPosicao(movimentacao.novaPos);
          
          console.log(`📍 ${dupla.jogador1}/${dupla.jogador2}: ${dupla.base}.${dupla.posicao} → ${novaBase}.${novaPosicaoNaBase} (${movimentacao.novaPos}º geral)`);
          
          dupla.base = novaBase;
          dupla.posicao = novaPosicaoNaBase;
        }
      }

      this.salvarDados();
      console.log('✅ Posições atualizadas com sucesso!');

      return {
        success: true,
        message: 'Posições atualizadas com sucesso!'
      };
    } catch (error) {
      console.error('❌ Erro ao atualizar posições:', error);
      return {
        success: false,
        message: 'Erro ao atualizar posições. Tente novamente.'
      };
    }
  }

  // ✅ NOVA FUNÇÃO: Excluir todas as duplas de uma pirâmide (para quando excluir pirâmide)
  async excluirTodasDuplasPiramide(piramideId: string): Promise<{ success: boolean; message: string; duplasRemovidas: number }> {
    try {
      await this.delay(300);

      const duplasParaRemover = this.duplas.filter(d => d.piramideId === piramideId);
      const quantidadeRemovida = duplasParaRemover.length;

      // Marcar todas como inativas
      duplasParaRemover.forEach(dupla => {
        dupla.ativa = false;
      });

      this.salvarDados();

      return {
        success: true,
        message: `${quantidadeRemovida} dupla(s) removida(s) da pirâmide excluída`,
        duplasRemovidas: quantidadeRemovida
      };
    } catch (error) {
      return {
        success: false,
        message: 'Erro ao remover duplas da pirâmide',
        duplasRemovidas: 0
      };
    }
  }

  // ========== FUNÇÕES MANTIDAS COM VALIDAÇÕES ATUALIZADAS ==========

  async validarCapacidadePiramide(piramideId: string): Promise<{ podeAdicionar: boolean, message: string }> {
    const piramides = await this.piramidesService.obterPiramides();
    const piramide = piramides.find(p => p.id === piramideId);
    
    if (!piramide) {
      return {
        podeAdicionar: false,
        message: 'Pirâmide não encontrada'
      };
    }

    // ✅ VALIDAÇÃO DE PROTEÇÃO ADICIONAL
    const podeAdicionar = this.piramidesService.podeAdicionarDuplas(piramideId);
    if (!podeAdicionar.pode) {
      return {
        podeAdicionar: false,
        message: podeAdicionar.motivo!
      };
    }

    const duplas = this.duplas.filter(d => d.ativa && d.piramideId === piramideId);
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
  }

  // ========== RESTO DAS FUNÇÕES MANTIDAS IGUAIS ==========
  
  private inicializarDados() {
    // Verificar se há dados salvos
    const duplasSalvas = localStorage.getItem('duplas');
    if (duplasSalvas) {
      this.duplas = JSON.parse(duplasSalvas).map((d: any) => ({
        ...d,
        dataIngresso: new Date(d.dataIngresso)
      }));
      
      // Encontrar o maior ID para continuar a sequência
      const maiorId = Math.max(...this.duplas.map(d => parseInt(d.id) || 0));
      this.nextId = maiorId + 1;
    } else {
      // Migrar dados existentes ou criar dados de exemplo
      this.migrarDadosExistentes();
    }
  }

  private migrarDadosExistentes() {
    // Verificar se há dados antigos sem pirâmideId
    const dadosAntigos = localStorage.getItem('duplas_old');
    if (dadosAntigos) {
      const duplasAntigas = JSON.parse(dadosAntigos);
      const piramidePadrao = this.piramidesService.getPiramideAtual();
      
      if (piramidePadrao) {
        // Migrar duplas antigas para a pirâmide padrão
        this.duplas = duplasAntigas.map((d: any) => ({
          ...d,
          piramideId: piramidePadrao.id,
          dataIngresso: new Date(d.dataIngresso)
        }));
        
        localStorage.removeItem('duplas_old');
        this.salvarDados();
      }
    } else {
      // Criar dados de exemplo apenas se não há nenhum dado
      this.criarDadosExemplo();
    }
  }

  private criarDadosExemplo() {
    const piramidePadrao = this.piramidesService.getPiramideAtual();
    if (!piramidePadrao) return;

    this.duplas = [
      {
        id: '1',
        piramideId: piramidePadrao.id,
        jogador1: 'João',
        jogador2: 'Pedro',
        base: 1,
        posicao: 1,
        pontos: 150,
        vitorias: 15,
        derrotas: 2,
        ativa: true,
        dataIngresso: new Date('2024-01-01'),
        telefone: '(11) 99999-0001'
      },
      {
        id: '2',
        piramideId: piramidePadrao.id,
        jogador1: 'Ana',
        jogador2: 'Maria',
        base: 2,
        posicao: 1,
        pontos: 120,
        vitorias: 12,
        derrotas: 4,
        ativa: true,
        dataIngresso: new Date('2024-01-05'),
        telefone: '(11) 99999-0002'
      },
      // ... resto dos dados de exemplo mantidos iguais
    ];

    this.nextId = 8;
    this.salvarDados();
  }

  async obterDuplas(piramideId?: string): Promise<Dupla[]> {
    await this.delay(300);
    
    const targetPiramideId = piramideId || this.piramidesService.getPiramideAtualId();
    if (!targetPiramideId) {
      return [];
    }

    return this.duplas
      .filter(d => d.ativa && d.piramideId === targetPiramideId)
      .sort((a, b) => {
        if (a.base !== b.base) return a.base - b.base;
        return a.posicao - b.posicao;
      });
  }

  async obterDuplasOrganizadas(piramideId?: string): Promise<Dupla[][]> {
    await this.delay(300);
    
    const duplas = await this.obterDuplas(piramideId);
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

  async registrarResultadoJogo(vencedorId: string, perdedorId: string): Promise<{ success: boolean, message: string }> {
    try {
      await this.delay(300);

      const vencedor = this.duplas.find(d => d.id === vencedorId);
      const perdedor = this.duplas.find(d => d.id === perdedorId);

      if (vencedor && perdedor) {
        // ✅ VALIDAÇÃO DE PROTEÇÃO
        const podeJogar = this.piramidesService.podeCriarDesafios(vencedor.piramideId);
        if (!podeJogar.pode) {
          return {
            success: false,
            message: `Não é possível registrar resultado: ${podeJogar.motivo}`
          };
        }

        // Atualizar estatísticas
        vencedor.vitorias = (vencedor.vitorias || 0) + 1;
        perdedor.derrotas = (perdedor.derrotas || 0) + 1;

        // Atualizar pontos
        vencedor.pontos = (vencedor.pontos || 0) + 10;
        perdedor.pontos = Math.max(0, (perdedor.pontos || 0) - 5);

        this.salvarDados();

        console.log(`📈 Estatísticas atualizadas:`);
        console.log(`🏆 ${vencedor.jogador1}/${vencedor.jogador2}: ${vencedor.vitorias}V-${vencedor.derrotas}D`);
        console.log(`💥 ${perdedor.jogador1}/${perdedor.jogador2}: ${perdedor.vitorias}V-${perdedor.derrotas}D`);

        return {
          success: true,
          message: 'Resultado registrado e estatísticas atualizadas!'
        };
      } else {
        return {
          success: false,
          message: 'Duplas não encontradas para atualizar estatísticas'
        };
      }
    } catch (error) {
      return {
        success: false,
        message: 'Erro ao registrar resultado'
      };
    }
  }

  // ========== OPERAÇÕES DE REORGANIZAÇÃO ==========

  private async reorganizarPiramide(piramideId: string): Promise<void> {
    const duplasAtivas = this.duplas.filter(d => d.ativa && d.piramideId === piramideId);
    
    // Reorganizar por posição geral (mantendo a ordem atual)
    duplasAtivas.sort((a, b) => {
      const posA = this.calcularPosicaoGeral(a);
      const posB = this.calcularPosicaoGeral(b);
      return posA - posB;
    });
    
    // Reassinar bases e posições sequencialmente
    let posicaoAtual = 1;
    
    for (const dupla of duplasAtivas) {
      const novaBase = this.calcularBasePorPosicao(posicaoAtual);
      const novaPosicaoNaBase = this.calcularPosicaoNaBasePorPosicao(posicaoAtual);
      
      dupla.base = novaBase;
      dupla.posicao = novaPosicaoNaBase;
      
      posicaoAtual++;
    }

    this.salvarDados();
  }

  private encontrarProximaBaseDisponivel(piramideId: string): number {
    const totalDuplas = this.duplas.filter(d => d.ativa && d.piramideId === piramideId).length;
    
    // Calcular em qual base a próxima dupla deve ser colocada
    let posicoesOcupadas = 0;
    
    for (let base = 1; base <= 9; base++) {
      // Se adicionar uma dupla nesta base, quantas posições teremos?
      const novoTotal = posicoesOcupadas + base;
      
      // Se o total de duplas ativas couber nesta base
      if (totalDuplas < novoTotal) {
        return base;
      }
      
      posicoesOcupadas = novoTotal;
    }
    
    // Se chegou aqui, a pirâmide está cheia, retornar base 9
    return 9;
  }

  private encontrarProximaPosicao(piramideId: string, base: number): number {
    const totalDuplas = this.duplas.filter(d => d.ativa && d.piramideId === piramideId).length;
    
    // Calcular quantas posições existem antes desta base
    let posicoesAnteriores = 0;
    for (let i = 1; i < base; i++) {
      posicoesAnteriores += i;
    }
    
    // A posição na base será o total de duplas menos as posições anteriores + 1
    const posicaoNaBase = totalDuplas - posicoesAnteriores + 1;
    
    return Math.max(1, Math.min(posicaoNaBase, base));
  }

  // ========== OPERAÇÕES DE TRANSFERÊNCIA ==========

  async transferirDupla(transferencia: TransferenciaDupla): Promise<{ success: boolean; message: string }> {
    try {
      await this.delay(500);

      const dupla = this.duplas.find(d => d.id === transferencia.duplaId);
      if (!dupla) {
        return {
          success: false,
          message: 'Dupla não encontrada'
        };
      }

      // ✅ VALIDAÇÕES DE PROTEÇÃO PARA TRANSFERÊNCIA
      const podeOrigemPerder = this.piramidesService.podeAdicionarDuplas(transferencia.piramideOrigemId);
      const podeDestinoReceber = this.piramidesService.podeAdicionarDuplas(transferencia.piramideDestinoId);
      
      if (!podeOrigemPerder.pode) {
        return {
          success: false,
          message: `Pirâmide origem: ${podeOrigemPerder.motivo}`
        };
      }
      
      if (!podeDestinoReceber.pode) {
        return {
          success: false,
          message: `Pirâmide destino: ${podeDestinoReceber.motivo}`
        };
      }

      // Verificar capacidade da pirâmide destino
      const capacidade = await this.validarCapacidadePiramide(transferencia.piramideDestinoId);
      if (!capacidade.podeAdicionar) {
        return {
          success: false,
          message: `Pirâmide destino: ${capacidade.message}`
        };
      }

      // Salvar pirâmide original para reorganização
      const piramideOrigem = dupla.piramideId;

      // Transferir dupla
      dupla.piramideId = transferencia.piramideDestinoId;
      
      // Encontrar posição na nova pirâmide (última posição)
      const novaBase = this.encontrarProximaBaseDisponivel(transferencia.piramideDestinoId);
      const novaPosicao = this.encontrarProximaPosicao(transferencia.piramideDestinoId, novaBase);
      
      dupla.base = novaBase;
      dupla.posicao = novaPosicao;

      // Resetar estatísticas se solicitado
      if (!transferencia.manterEstatisticas) {
        dupla.vitorias = 0;
        dupla.derrotas = 0;
        dupla.pontos = 0;
      }

      // Adicionar observações da transferência
      if (transferencia.observacoes) {
        dupla.observacoes = dupla.observacoes ? 
          `${dupla.observacoes} | Transferência: ${transferencia.observacoes}` : 
          `Transferência: ${transferencia.observacoes}`;
      }

      // Reorganizar ambas as pirâmides
      await this.reorganizarPiramide(piramideOrigem);
      await this.reorganizarPiramide(transferencia.piramideDestinoId);

      this.salvarDados();

      return {
        success: true,
        message: `Dupla transferida com sucesso! ${transferencia.manterEstatisticas ? 'Estatísticas mantidas.' : 'Estatísticas resetadas.'}`
      };
    } catch (error) {
      return {
        success: false,
        message: 'Erro ao transferir dupla. Tente novamente.'
      };
    }
  }

  // ========== OPERAÇÕES ESPECÍFICAS POR PIRÂMIDE ==========

  async contarDuplasPiramide(piramideId: string): Promise<number> {
    await this.delay(100);
    return this.duplas.filter(d => d.ativa && d.piramideId === piramideId).length;
  }

  async obterEstatisticasPiramide(piramideId: string): Promise<{
    totalDuplas: number;
    vagasDisponiveis: number;
    duplaMaisVitorias: Dupla | null;
    duplaMaisAtiva: Dupla | null;
  }> {
    await this.delay(200);
    
    const duplas = this.duplas.filter(d => d.ativa && d.piramideId === piramideId);
    const piramide = await this.piramidesService.obterPiramides().then(p => 
      p.find(piramide => piramide.id === piramideId)
    );
    
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
  }

  // ========== OPERAÇÕES DE BACKUP/IMPORTAÇÃO ==========

  async importarDuplas(duplas: Dupla[]): Promise<{ success: boolean; message: string }> {
    try {
      await this.delay(500);
      
      // Validar estrutura das duplas
      const duplasValidas = duplas.filter(dupla => 
        dupla.id && dupla.piramideId && dupla.jogador1 && dupla.jogador2
      );

      if (duplasValidas.length === 0) {
        return {
          success: false,
          message: 'Nenhuma dupla válida encontrada no arquivo'
        };
      }

      // ✅ VALIDAÇÃO DE PROTEÇÃO: Verificar se as pirâmides das duplas permitem modificações
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

      // Substituir duplas existentes
      this.duplas = duplasValidas.map(dupla => ({
        ...dupla,
        dataIngresso: new Date(dupla.dataIngresso)
      }));

      // Atualizar nextId
      const maiorId = Math.max(...this.duplas.map(d => parseInt(d.id) || 0));
      this.nextId = maiorId + 1;

      this.salvarDados();

      return {
        success: true,
        message: `${duplasValidas.length} duplas importadas com sucesso!`
      };
    } catch (error) {
      return {
        success: false,
        message: 'Erro ao importar duplas'
      };
    }
  }

  async exportarDuplasPiramide(piramideId: string): Promise<Dupla[]> {
    await this.delay(200);
    return this.duplas.filter(d => d.piramideId === piramideId);
  }

  // ========== UTILITÁRIOS ==========

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

  private calcularPosicaoGeral(dupla: Dupla): number {
    let posicoesAnteriores = 0;
    
    for (let i = 1; i < dupla.base; i++) {
      posicoesAnteriores += i;
    }
    
    return posicoesAnteriores + dupla.posicao;
  }

  private salvarDados(): void {
    localStorage.setItem('duplas', JSON.stringify(this.duplas));
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ========== MÉTODOS AUXILIARES PARA INTEGRAÇÃO ==========

  async obterDuplasPorTelefone(telefone: string, piramideId?: string): Promise<Dupla | null> {
    await this.delay(200);
    
    const telefoneLimpo = telefone.replace(/\D/g, '');
    
    let duplas = this.duplas.filter(d => d.ativa);
    
    // Filtrar por pirâmide se especificada
    if (piramideId) {
      duplas = duplas.filter(d => d.piramideId === piramideId);
    }
    
    return duplas.find(d => {
      const telefoneDupla = (d.telefone || '').replace(/\D/g, '');
      return telefoneDupla === telefoneLimpo;
    }) || null;
  }

  async atualizarDupla(duplaId: string, dados: Partial<Dupla>): Promise<{ success: boolean, message: string }> {
    try {
      await this.delay(300);
      
      const index = this.duplas.findIndex(d => d.id === duplaId);
      if (index >= 0) {
        const dupla = this.duplas[index];

        // ✅ VALIDAÇÃO DE PROTEÇÃO: Verificar se a pirâmide permite modificações
        const podeModificar = this.piramidesService.podeAdicionarDuplas(dupla.piramideId);
        if (!podeModificar.pode) {
          return {
            success: false,
            message: `Não é possível atualizar dupla: ${podeModificar.motivo}`
          };
        }
        
        // Não permitir alterar piramideId através desta função
        // Use transferirDupla() para isso
        const { piramideId, ...dadosPermitidos } = dados;
        
        this.duplas[index] = { ...this.duplas[index], ...dadosPermitidos };
        this.salvarDados();
        
        return { 
          success: true, 
          message: 'Dupla atualizada com sucesso' 
        };
      } else {
        return { 
          success: false, 
          message: 'Dupla não encontrada' 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        message: 'Erro ao atualizar dupla. Tente novamente.' 
      };
    }
  }
}