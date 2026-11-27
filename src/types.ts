/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Attempt {
  id: string;
  data: string;
  entrevistador: string;
  observacoes: string;
}

export interface Visit {
  id: string; // Ex: VIS-1001
  nome: string;
  cpf: string;
  endereco: string;
  numero: string;
  complemento?: string;
  bairro: string;
  territorio: string;
  telefone: string;
  motivo: 'BPC ATUALIZAÇÃO' | 'BPC BLOQUEADO' | 'REQUERER BPC' | 'BOLSA FAMÍLIA ATUALIZAÇÃO' | 'BOLSA FAMÍLIA BLOQUEADO' | 'REQUERER BOLSA FAMÍLIA' | 'AVERIGUAÇÃO NÃO UNIPESSOAL' | 'AVERIGUAÇÃO UNIPESSOAL';
  nomeEntrevistador: string;
  entrevistadorId: string;
  dataSolicitacao: string;
  dataLimite?: string;
  observacoes?: string;
  status: 'Pendente' | 'Concluída' | 'FINALIZADA - NÃO LOCALIZADO';
  dataConclusao?: string;
  cpfConclusao?: string;
  observacoesConclusao?: string;
  tentativas: Attempt[];
}

export interface User {
  id: string;
  username: string; // CPF ou nome de usuário
  nome: string;
  cpf: string;
  cargo: 'gestor' | 'entrevistador';
  territorio?: 'Território I' | 'Território II' | 'Território III' | 'Território IV' | 'Território V' | 'Nenhum' | '';
  status: 'ativo' | 'bloqueado';
  senha?: string; // Para validação local
}

export interface Territory {
  id: string;
  nome: string;
  cras: string;
  bairros: string[];
  responsavel?: string;
}

export interface SystemLog {
  id: string;
  data: string;
  usuario: string;
  acao: string;
  detalhes: string;
}
