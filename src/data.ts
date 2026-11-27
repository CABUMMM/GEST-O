/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { User, Visit, Territory, SystemLog } from './types';

// Territórios oficiais (Ipatinga/MG - Assistência Social / CRAS)
export const IPATINGA_TERRITORIES: Territory[] = [
  {
    id: 'T1',
    nome: 'Território I',
    cras: 'CRAS Centro - Cadastro Único',
    bairros: [
      'Areal',
      'Bela Vista',
      'Caçula',
      'Caravelas',
      'Cariru',
      'Castelo',
      'Centro',
      'Horto',
      'Imbaúbas',
      'Jardim Panorama',
      'Novo Cruzeiro',
      'Parque das Águas',
      'Planalto',
      'Santa Mônica',
      'Vila Ipanema',
      'Veneza'
    ]
  },
  {
    id: 'T2',
    nome: 'Território II',
    cras: 'CRAS Canaã',
    bairros: [
      'Canaã',
      'Chácaras Oliveira',
      'Fontes',
      'Forquilha',
      'Vila Celeste',
      'Vista Alegre'
    ]
  },
  {
    id: 'T3',
    nome: 'Território III',
    cras: 'CRAS Bom Jardim',
    bairros: [
      'Bom Jardim',
      'Esperança',
      'Ferroviários',
      'Ideal',
      'Iguaçu',
      'Nova Esperança'
    ]
  },
  {
    id: 'T4',
    nome: 'Território IV',
    cras: 'CRAS Limoeiro',
    bairros: [
      'Barra Alegre',
      'Chácaras Madalena',
      'Córrego Novo',
      'Cidade Nobre',
      'Ipaneminha',
      'Limoeiro',
      'Morro Escuro',
      'Pedra Branca',
      'Recanto',
      'Tribuna',
      'Vila Formosa'
    ]
  },
  {
    id: 'T5',
    nome: 'Território V',
    cras: 'CRAS Bethânia',
    bairros: [
      'Bethânia',
      'Taubas',
      'Tiradentes',
      'Vagalume',
      'Vila Militar'
    ]
  }
];

// Lista para autocomplete de ruas
export const IPATINGA_STREET_SUGGESTIONS = [
  { rua: 'Avenida João Valentim Pascoal', bairro: 'Centro' },
  { rua: 'Rua Mariana', bairro: 'Centro' },
  { rua: 'Rua Diamantina', bairro: 'Centro' },
  { rua: 'Rua Ponte Nova', bairro: 'Centro' },
  { rua: 'Rua Sabará', bairro: 'Centro' },
  { rua: 'Rua Edgard Boy Rossi', bairro: 'Centro' },
  { rua: 'Rua Estados Unidos', bairro: 'Cariru' },
  { rua: 'Rua Itália', bairro: 'Cariru' },
  { rua: 'Rua Japão', bairro: 'Cariru' },
  { rua: 'Avenida Castelo Branco', bairro: 'Horto' },
  { rua: 'Avenida Fernando de Noronha', bairro: 'Bom Retiro' },
  { rua: 'Rua Imbé', bairro: 'Bom Retiro' },
  { rua: 'Rua Paineiras', bairro: 'Bom Retiro' },
  { rua: 'Rua Palmeiras', bairro: 'Horto' },
  { rua: 'Rua Jequitibá', bairro: 'Horto' },
  { rua: 'Rua Macapá', bairro: 'Veneza' },
  { rua: 'Rua Teresina', bairro: 'Veneza' },
  { rua: 'Rua Natal', bairro: 'Veneza' },
  { rua: 'Avenida Londrina', bairro: 'Veneza' },
  { rua: 'Avenida Selim José de Sales', bairro: 'Canaã' },
  { rua: 'Avenida Gerasa', bairro: 'Canaã' },
  { rua: 'Rua Dinamarca', bairro: 'Canaã' },
  { rua: 'Avenida Alberto Giovanini', bairro: 'Bethânia' },
  { rua: 'Rua Boston', bairro: 'Bethânia' },
  { rua: 'Rua Chicago', bairro: 'Bethânia' },
  { rua: 'Avenida Brasil', bairro: 'Iguaçu' },
  { rua: 'Rua Guajajaras', bairro: 'Iguaçu' },
  { rua: 'Rua Altina Gonçalves', bairro: 'Iguaçu' },
  { rua: 'Avenida das Flores', bairro: 'Bom Jardim' },
  { rua: 'Rua Orquídea', bairro: 'Bom Jardim' },
  { rua: 'Rua Margarida', bairro: 'Bom Jardim' },
  { rua: 'Rua Rosa', bairro: 'Bom Jardim' },
  { rua: 'Rua Caravelas', bairro: 'Caravelas' },
  { rua: 'Rua Limoeiro', bairro: 'Limoeiro' },
  { rua: 'Avenida Vila Celeste', bairro: 'Vila Celeste' },
  { rua: 'Rua Pica-Pau', bairro: 'Vila Celeste' }
];

// CPF Helper Validation
export function validateCPF(cpfRaw: string): boolean {
  const cpf = cpfRaw.replace(/[^\d]/g, '');
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  let soma = 0;
  let resto;
  for (let i = 1; i <= 9; i++) {
    soma = soma + parseInt(cpf.substring(i - 1, i)) * (11 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.substring(9, 10))) return false;

  soma = 0;
  for (let i = 1; i <= 10; i++) {
    soma = soma + parseInt(cpf.substring(i - 1, i)) * (12 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.substring(10, 11))) return false;

  return true;
}

// CPF formatting (CPF: 000.000.000-00)
export function formatCPF(value: string): string {
  const clean = value.replace(/\D/g, '').slice(0, 11);
  let formatted = clean;
  if (clean.length > 9) {
    formatted = `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`;
  } else if (clean.length > 6) {
    formatted = `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6)}`;
  } else if (clean.length > 3) {
    formatted = `${clean.slice(0, 3)}.${clean.slice(3)}`;
  }
  return formatted;
}

// Phone formatting: (DD) 9XXXX-XXXX
export function formatPhone(value: string): string {
  const clean = value.replace(/\D/g, '').slice(0, 11);
  if (clean.length === 0) return '';
  if (clean.length <= 2) {
    return `(${clean}`;
  }
  if (clean.length <= 6) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2)}`;
  }
  if (clean.length <= 10) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  }
  return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
}

// OpenStreetMap routing link generator
export function getOSMLink(rua: string, numero: string, bairro: string): string {
  const query = encodeURIComponent(`${rua}, ${numero}, Bairro ${bairro}, Ipatinga, MG, Brasil`);
  return `https://www.openstreetmap.org/search?query=${query}`;
}

// Maps Roman/Numeric territory notations smoothly
export function normalizeTerritorioName(name: string): 'Território I' | 'Território II' | 'Território III' | 'Território IV' | 'Território V' {
  if (!name) return 'Território I';
  const clean = name.trim().toUpperCase();
  if (clean === 'TERRITÓRIO 1' || clean === 'TERRITORIO 1' || clean === 'TERRITÓRIO I' || clean === 'TERRITORIO I' || clean === 'T1') return 'Território I';
  if (clean === 'TERRITÓRIO 2' || clean === 'TERRITORIO 2' || clean === 'TERRITÓRIO II' || clean === 'TERRITORIO II' || clean === 'T2') return 'Território II';
  if (clean === 'TERRITÓRIO 3' || clean === 'TERRITORIO 3' || clean === 'TERRITÓRIO III' || clean === 'TERRITORIO III' || clean === 'T3') return 'Território III';
  if (clean === 'TERRITÓRIO 4' || clean === 'TERRITORIO 4' || clean === 'TERRITÓRIO IV' || clean === 'TERRITORIO IV' || clean === 'T4') return 'Território IV';
  if (clean === 'TERRITÓRIO 5' || clean === 'TERRITORIO 5' || clean === 'TERRITÓRIO V' || clean === 'TERRITORIO V' || clean === 'T5') return 'Território V';
  return 'Território I';
}

// Automatically resolve Territory using Bairro
export function findTerritoryByBairro(bairroName: string): Territory | undefined {
  if (!bairroName) return undefined;
  return IPATINGA_TERRITORIES.find(t =>
    t.bairros.some(b => b.trim().toUpperCase() === bairroName.trim().toUpperCase())
  );
}

// Initial default users
export const INITIAL_USERS: User[] = [
  {
    id: 'U1',
    username: 'gestor1',
    nome: 'Regina Santos Moura',
    cpf: '111.111.155-11',
    cargo: 'gestor',
    territorio: 'Nenhum',
    status: 'ativo',
    senha: 'admin'
  }
];

// Initial default visits
export const INITIAL_VISITS: Visit[] = [];

// Seed storage safely if empty or if containing old test/mock users/visits
export function initLocalStorageStore() {
  const storedUsers = localStorage.getItem('visitas_users');
  const hasOldMockUsers = storedUsers && (
    storedUsers.includes('"carlos"') || 
    storedUsers.includes('"juliana"') || 
    storedUsers.includes('"marcos"') || 
    storedUsers.includes('"patricia"')
  );

  const storedVisits = localStorage.getItem('visitas_records');
  const hasOldMockVisits = storedVisits && storedVisits.length > 5; // Old mock visits exist

  if (hasOldMockUsers || hasOldMockVisits || !localStorage.getItem('visitas_users') || !localStorage.getItem('visitas_records_cleaned_v5')) {
    localStorage.setItem('visitas_users', JSON.stringify(INITIAL_USERS));
    localStorage.setItem('visitas_records', JSON.stringify(INITIAL_VISITS));
    localStorage.setItem('visitas_territories', JSON.stringify(IPATINGA_TERRITORIES));
    localStorage.setItem('visitas_records_cleaned', 'true');
    localStorage.setItem('visitas_records_cleaned_v2', 'true');
    localStorage.setItem('visitas_records_cleaned_v3', 'true');
    localStorage.setItem('visitas_records_cleaned_v4', 'true');
    localStorage.setItem('visitas_records_cleaned_v5', 'true');
    localStorage.removeItem('visitas_session'); // Reset active session to force login with clean credentials
  } else {
    // Keep up-to-date with code configurations
    localStorage.setItem('visitas_territories', JSON.stringify(IPATINGA_TERRITORIES));
  }
}

// Sanitize and validate interviewer strings to block addresses, digits, and noise
export function sanitizeInterviewerName(name: string | null | undefined): string {
  if (!name) return 'SEM ENTREVISTADOR';
  const cleaned = name.trim().replace(/\s+/g, ' ');
  if (!cleaned) return 'SEM ENTREVISTADOR';

  const clUpper = cleaned.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (
    clUpper === 'SEM ENTREVISTADOR' ||
    clUpper === 'NAO ATRIBUIDO' ||
    clUpper === 'NENHUM' ||
    clUpper === 'SEM' ||
    clUpper === 'NULL' ||
    clUpper === 'UNDEFINED' ||
    clUpper === ''
  ) {
    return 'SEM ENTREVISTADOR';
  }

  // Strict check for digits: real people names do not contain digits
  const hasDigits = /\d/.test(cleaned);
  
  // Typical address, block, or number keywords
  const keywords = ['RUA', 'AV.', 'AVENIDA', 'LOTE', 'APTO', 'AP', 'CASA', 'BLOCO', 'Nº', 'NUMERO', 'S/N', 'TRAVESSA', 'RODOVIA', 'ESTRADA', 'BECO', 'ALAMEDA', 'PRACA', 'PRAÇA'];
  const isAddress = keywords.some(keyword => {
    const regex = new RegExp('\\b' + keyword + '\\b', 'i');
    return regex.test(clUpper);
  });

  // Verify CPF formats or street-like patterns
  const isCpf = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(cleaned) || /^\d{11}$/.test(cleaned);

  if (hasDigits || isAddress || isCpf || cleaned.length < 2 || cleaned.length > 50) {
    return 'SEM ENTREVISTADOR';
  }

  // Capitalize properly for professional appearance
  const normalizedCapitalized = cleaned
    .split(' ')
    .map(word => {
      const lower = word.toLowerCase();
      if (['de', 'da', 'do', 'das', 'dos', 'e'].includes(lower)) return lower;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');

  // If it resolves to some variation of sem entrevistador
  if (normalizedCapitalized.toUpperCase() === 'SEM ENTREVISTADOR') {
    return 'SEM ENTREVISTADOR';
  }

  return normalizedCapitalized;
}

// Normalize and clean reasons (motivos) dynamically to avoid duplicates or misindexing
export function normalizeMotivo(motivo: string | null | undefined): string {
  if (!motivo) return 'BOLSA FAMÍLIA ATUALIZAÇÃO';
  const cleaned = motivo.trim().replace(/\s+/g, ' ').toUpperCase();
  const deaccented = cleaned.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (
    deaccented.includes('AVERIGUACAO NAO UNIP') || 
    deaccented.includes('AVERIGUACAO NAO-UNIP') || 
    deaccented.includes('AVERIGUACAO COLETIVA') ||
    deaccented.includes('AVERIGUACAO E COMPLEMENTACAO NAO UNIP')
  ) {
    return 'AVERIGUAÇÃO NÃO UNIPESSOAL';
  }
  if (
    deaccented.includes('AVERIGUACAO UNIP') || 
    deaccented.includes('AVERIGUACAO UNIPESSOAL')
  ) {
    return 'AVERIGUAÇÃO UNIPESSOAL';
  }
  if (
    deaccented.includes('BPC ATUALIZACAO')
  ) {
    return 'BPC ATUALIZAÇÃO';
  }
  if (deaccented.includes('BPC BLOQUEADO')) {
    return 'BPC BLOQUEADO';
  }
  if (deaccented.includes('REQUERER BPC')) {
    return 'REQUERER BPC';
  }
  if (
    deaccented.includes('BOLSA FAMILIA ATUALIZACAO') || 
    deaccented.includes('BOLSA FAMILIA INFORMACOES') ||
    deaccented.includes('ATUALIZACAO BOLSA FAMILIA')
  ) {
    return 'BOLSA FAMÍLIA ATUALIZAÇÃO';
  }
  if (
    deaccented.includes('BOLSA FAMILIA BLOQUEADO') || 
    deaccented.includes('BLOQUEADO BOLSA FAMILIA')
  ) {
    return 'BOLSA FAMÍLIA BLOQUEADO';
  }
  if (deaccented.includes('REQUERER BOLSA FAMILIA')) {
    return 'REQUERER BOLSA FAMÍLIA';
  }

  return cleaned;
}
