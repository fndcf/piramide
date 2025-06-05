import { Injectable } from '@angular/core';
import { Dupla, NovaDupla } from '../models/dupla.model';

@Injectable({
  providedIn: 'root'
})
export class DuplasService {
  private duplas: Dupla[] = [
    {
      id: '1',
      jogador1: 'João',
      jogador2: 'Pedro',
      base: 1,
      posicao: 1,
      pontos: 150,
      vitorias: 12,
      derrotas: 3,
      ativa: true,
      dataIngresso: new Date('2024-01-01'),
      telefone: '(11) 99999-0001'
    },
    {
      id: '2',
      jogador1: 'Ana',
      jogador2: 'Maria',
      base: 2,
      posicao: 1,
      pontos: 120,
      vitorias: 10,
      derrotas: 4,
      ativa: true,
      dataIngresso: new Date('2024-01-05'),
      telefone: '(11) 99999-0002'
    },
    {
      id: '3',
      jogador1: 'Carlos',
      jogador2: 'Bruno',
      base: 2,
      posicao: 2,
      pontos: 110,
      vitorias: 8,
      derrotas: 6,
      ativa: true,
      dataIngresso: new Date('2024-01-10'),
      telefone: '(11) 99999-0003'
    },
    {
      id: '4',
      jogador1: 'Lucas',
      jogador2: 'Rafael',
      base: 3,
      posicao: 1,
      pontos: 100,
      vitorias: 9,
      derrotas: 5,
      ativa: true,
      dataIngresso: new Date('2024-01-15'),
      telefone: '(11) 99999-0004'
    },
    {
      id: '5',
      jogador1: 'Paula',
      jogador2: 'Carla',
      base: 3,
      posicao: 2,
      pontos: 90,
      vitorias: 7,
      derrotas: 7,
      ativa: true,
      dataIngresso: new Date('2024-01-20'),
      telefone: '(11) 99999-0005'
    },
    {
      id: '6',
      jogador1: 'Diego',
      jogador2: 'Marcos',
      base: 3,
      posicao: 3,
      pontos: 85,
      vitorias: 6,
      derrotas: 8,
      ativa: true,
      dataIngresso: new Date('2024-01-25'),
      telefone: '(11) 99999-0006'
    },
    {
      id: '7',
      jogador1: 'Fernanda',
      jogador2: 'Júlia',
      base: 4,
      posicao: 1,
      pontos: 80,
      vitorias: 5,
      derrotas: 9,
      ativa: true,
      dataIngresso: new Date('2024-01-30'),
      telefone: '(11) 99999-0007'
    }
  ];

  private nextId = 8;

  constructor() {}

  // ✅ NOVA FUNCIONALIDADE: Atualizar posições das duplas após desafio
  async atualizarPosicoes(movimentacoes: { dupla: Dupla; novaPos: number }[]): Promise<{ success: boolean, message: string }> {
    try {
      await this.delay(500); // Simular delay da API

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

  // ✅ NOVA FUNCIONALIDADE: Registrar resultado do jogo e atualizar estatísticas
  async registrarResultadoJogo(vencedorId: string, perdedorId: string): Promise<{ success: boolean, message: string }> {
    try {
      await this.delay(300);

      const vencedor = this.duplas.find(d => d.id === vencedorId);
      const perdedor = this.duplas.find(d => d.id === perdedorId);

      if (vencedor && perdedor) {
        // Atualizar estatísticas
        vencedor.vitorias = (vencedor.vitorias || 0) + 1;
        perdedor.derrotas = (perdedor.derrotas || 0) + 1;

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

  async criarDupla(novaDupla: NovaDupla): Promise<{ success: boolean, message: string }> {
    try {
      await this.delay(500); // Simular delay da API

      // Verificar capacidade antes de adicionar
      const totalAtivas = this.duplas.filter(d => d.ativa).length;
      if (totalAtivas >= 45) {
        return {
          success: false,
          message: 'Pirâmide está com capacidade máxima (45 duplas)'
        };
      }

      // Encontrar a próxima posição sequencial
      const proximaBase = this.encontrarProximaBaseDisponivel();
      const proximaPosicao = this.encontrarProximaPosicao(proximaBase);

      const dupla: Dupla = {
        id: this.nextId.toString(),
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
      
      // Reorganizar todas as duplas para garantir ordem correta
      await this.reorganizarPiramide();
      
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

  private async reorganizarPiramide(): Promise<void> {
    const duplasAtivas = this.duplas.filter(d => d.ativa);
    
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

  private calcularPosicaoGeral(dupla: Dupla): number {
    let posicoesAnteriores = 0;
    
    for (let i = 1; i < dupla.base; i++) {
      posicoesAnteriores += i;
    }
    
    return posicoesAnteriores + dupla.posicao;
  }

  async obterDuplas(): Promise<Dupla[]> {
    await this.delay(300); // Simular delay da API
    return this.duplas
      .filter(d => d.ativa)
      .sort((a, b) => {
        if (a.base !== b.base) return a.base - b.base;
        return a.posicao - b.posicao;
      });
  }

  async obterDuplasOrganizadas(): Promise<Dupla[][]> {
    await this.delay(300); // Simular delay da API
    const duplas = await this.obterDuplas();
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

  async removerDupla(duplaId: string): Promise<{ success: boolean, message: string }> {
    try {
      await this.delay(300); // Simular delay da API
      
      const dupla = this.duplas.find(d => d.id === duplaId);
      if (dupla) {
        dupla.ativa = false;
        
        // Reorganizar todas as duplas após remoção
        await this.reorganizarPiramide();
        
        return { 
          success: true, 
          message: 'Dupla removida e pirâmide reorganizada com sucesso' 
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
        message: 'Erro ao remover dupla. Tente novamente.' 
      };
    }
  }

  async atualizarDupla(duplaId: string, dados: Partial<Dupla>): Promise<{ success: boolean, message: string }> {
    try {
      await this.delay(300); // Simular delay da API
      
      const index = this.duplas.findIndex(d => d.id === duplaId);
      if (index >= 0) {
        this.duplas[index] = { ...this.duplas[index], ...dados };
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

  async validarCapacidadePiramide(): Promise<{ podeAdicionar: boolean, message: string }> {
    const duplas = await this.obterDuplas();
    const totalDuplas = duplas.length;
    const capacidadeMaxima = 45; // 1+2+3+4+5+6+7+8+9
    
    if (totalDuplas >= capacidadeMaxima) {
      return {
        podeAdicionar: false,
        message: 'Pirâmide está com capacidade máxima (45 duplas)'
      };
    }
    
    return {
      podeAdicionar: true,
      message: `Você pode adicionar mais ${capacidadeMaxima - totalDuplas} dupla(s)`
    };
  }

  private encontrarProximaBaseDisponivel(): number {
    const totalDuplas = this.duplas.filter(d => d.ativa).length;
    
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

  private encontrarProximaPosicao(base: number): number {
    const totalDuplas = this.duplas.filter(d => d.ativa).length;
    
    // Calcular quantas posições existem antes desta base
    let posicoesAnteriores = 0;
    for (let i = 1; i < base; i++) {
      posicoesAnteriores += i;
    }
    
    // A posição na base será o total de duplas menos as posições anteriores + 1
    const posicaoNaBase = totalDuplas - posicoesAnteriores + 1;
    
    return Math.max(1, Math.min(posicaoNaBase, base));
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}