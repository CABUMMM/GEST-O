/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  MapPin,
  Calendar,
  User,
  Phone,
  FileText,
  AlertCircle,
  Check,
  Compass,
  CornerDownRight,
  ExternalLink
} from 'lucide-react';
import { Visit, User as AppUser, Territory } from '../types';
import {
  IPATINGA_STREET_SUGGESTIONS,
  IPATINGA_TERRITORIES,
  formatCPF,
  formatPhone,
  validateCPF,
  getOSMLink,
  normalizeTerritorioName,
  findTerritoryByBairro
} from '../data';
import { motion } from 'motion/react';

interface VisitFormProps {
  currentUser: AppUser;
  territories: Territory[];
  onAddVisit: (newVisit: Omit<Visit, 'id' | 'tentativas' | 'status'>) => void;
  onSetTab: (tab: string) => void;
}

export default function VisitForm({ currentUser, territories, onAddVisit, onSetTab }: VisitFormProps) {
  // Local state for all fields
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [endereco, setEndereco] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [territorio, setTerritorio] = useState(() => {
    if (currentUser.cargo === 'gestor') return 'Território I';
    return normalizeTerritorioName(currentUser.territorio || '');
  });
  const [telefone, setTelefone] = useState('');
  const [motivo, setMotivo] = useState<Visit['motivo']>('BPC ATUALIZAÇÃO');
  const [dataLimite, setDataLimite] = useState('');
  const [observacoes, setObservacoes] = useState('');

  // Autocomplete UI logic
  const [streetQuery, setStreetQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cpfError, setCpfError] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const isFirstRender = React.useRef(true);

  // Suggest dataLimite based on selected reason: Bolsa Família -> 90 days, Averiguação -> 60 days, BPC -> 45 days
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const isBolsaFamilias = motivo.startsWith('BOLSA FAMÍLIA');
    const isAveriguacao = motivo.startsWith('AVERIGUAÇÃO');
    const daysOffset = isBolsaFamilias ? 90 : (isAveriguacao ? 60 : 45);
    
    const today = new Date();
    today.setDate(today.getDate() + daysOffset);
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    setDataLimite(`${yyyy}-${mm}-${dd}`);
  }, [motivo]);

  // Sync state when current user is populated
  useEffect(() => {
    if (currentUser.cargo === 'gestor') {
      if (!territorio) {
        setTerritorio('Território I');
      }
    } else {
      setTerritorio(normalizeTerritorioName(currentUser.territorio || ''));
    }
  }, [currentUser]);

  // Filtered Bairros permitted for the current user's territory
  const allowedBairros = useMemo(() => {
    const targetTerrName = currentUser.cargo === 'gestor' ? territorio : normalizeTerritorioName(currentUser.territorio || '');
    const matchedTerr = territories.find(
      (t) => normalizeTerritorioName(t.nome) === targetTerrName
    );
    if (matchedTerr) {
      return [...matchedTerr.bairros].sort();
    }
    // Fallback if not found
    const set = new Set<string>();
    territories.forEach((t) => t.bairros.forEach((b) => set.add(b)));
    return Array.from(set).sort();
  }, [currentUser.cargo, currentUser.territorio, territorio, territories]);

  // Autocomplete Street suggestions - only show streets from allowed neighborhoods to prevent inconsistencies
  const suggestions = useMemo(() => {
    if (!streetQuery.trim() || streetQuery.length < 2) return [];
    
    const allowedSet = new Set(allowedBairros.map(b => b.toUpperCase()));
    
    return IPATINGA_STREET_SUGGESTIONS.filter((s) =>
      s.rua.toLowerCase().includes(streetQuery.toLowerCase()) &&
      allowedSet.has(s.bairro.toUpperCase())
    ).slice(0, 5);
  }, [streetQuery, allowedBairros]);

  // Automatic determination of territory based on neighborhood selection
  const handleBairroChange = (selectedBairro: string) => {
    setBairro(selectedBairro);
    if (selectedBairro) {
      const matched = findTerritoryByBairro(selectedBairro);
      if (matched) {
        setTerritorio(normalizeTerritorioName(matched.nome));
      }
    }
  };

  const handleStreetSelect = (streetName: string, suggBairro: string) => {
    setEndereco(streetName);
    setStreetQuery(streetName);
    setShowSuggestions(false);
    handleBairroChange(suggBairro);
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPF(e.target.value);
    setCpf(formatted);

    const clean = formatted.replace(/[^\d]/g, '');
    if (clean.length === 11) {
      setCpfError(!validateCPF(clean));
    } else {
      setCpfError(false);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTelefone(formatPhone(e.target.value));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!nome.trim() || !cpf || !endereco.trim() || !bairro || !territorio || !motivo) {
      alert('Por favor, preencha todos os campos obrigatórios (*).');
      return;
    }

    const cleanCpf = cpf.replace(/[^\d]/g, '');
    if (cleanCpf.length === 11 && !validateCPF(cleanCpf)) {
      alert('O CPF fornecido é inválido. Por favor, verifique para evitar erros no Cadastro Único.');
      return;
    }

    // Auto calculate solicitation date and time
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 5);
    const dataSolicitacao = `${dateStr} ${timeStr}`;

    onAddVisit({
      nome: nome.trim(),
      cpf,
      endereco: endereco.trim(),
      numero: numero.trim(),
      complemento: complemento.trim() || undefined,
      bairro,
      territorio,
      telefone,
      motivo,
      nomeEntrevistador: currentUser.nome,
      entrevistadorId: currentUser.id,
      dataSolicitacao,
      dataLimite: dataLimite || undefined,
      observacoes: observacoes.trim() || undefined
    });

    // Reset Form
    setNome('');
    setCpf('');
    setEndereco('');
    setStreetQuery('');
    setNumero('');
    setComplemento('');
    setBairro('');
    setTelefone('');
    setObservacoes('');

    setSuccessMsg('Visita cadastrada com sucesso! Direcionando para a lista...');
    setTimeout(() => {
      setSuccessMsg('');
      onSetTab('ver_visitas');
    }, 1500);
  };

  // Check if current user owns territory constraint
  const territoryLabel = useMemo(() => {
    const found = territories.find((t) => t.nome === territorio);
    return found ? `${found.nome} (${found.cras})` : territorio;
  }, [territorio, territories]);

  const hasSelectedLocation = endereco && numero && bairro;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Banner Intro */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Compass className="w-6 h-6 text-blue-600" />
          <span>Lançamento de Nova Visita Domiciliar</span>
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Informe os dados da família requisitante de assistência. O território de atendimento associado é regulado pelas diretrizes do CRAS local de Ipatinga.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white shadow-xl shadow-slate-100/50 rounded-2xl border border-slate-100 p-6 md:p-8 relative"
      >
        {successMsg && (
          <div className="absolute inset-0 bg-white/95 rounded-2xl flex flex-col items-center justify-center z-30 transition-all">
            <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 mb-4 animate-bounce">
              <Check className="w-8 h-8 font-bold" />
            </div>
            <p className="text-lg font-bold text-slate-800">{successMsg}</p>
            <p className="text-xs text-slate-400 mt-1">Atualizando dados e carregando painéis...</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* SEC 1: IDENTIFICATION OF CITIZEN */}
          <div>
            <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
              <User className="w-4 h-4" />
              <span>1. Identificação do Munícipe</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label htmlFor="cit-nome" className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">
                  Nome Completo *
                </label>
                <div className="relative">
                  <input
                    id="cit-nome"
                    type="text"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Nome completo do cidadão ou responsável familiar"
                    className="block w-full py-2.5 px-3 bg-slate-50/65 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="cit-cpf" className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">
                  CPF *
                </label>
                <div className="relative">
                  <input
                    id="cit-cpf"
                    type="text"
                    required
                    value={cpf}
                    onChange={handleCpfChange}
                    placeholder="000.000.000-00"
                    className={`block w-full py-2.5 px-3 bg-slate-50/65 border ${cpfError ? 'border-red-400 ring-1 ring-red-400' : 'border-slate-200'} rounded-xl text-slate-800 focus:outline-none focus:ring-2 ${cpfError ? 'focus:ring-red-400' : 'focus:ring-blue-500'} text-sm`}
                  />
                  {cpf.replace(/[^\d]/g, '').length === 11 && (
                    <div className="absolute right-3 top-3">
                      {cpfError ? (
                        <div className="flex items-center gap-1 text-[10px] text-red-600 font-semibold" id="cpf-invalid-msg">
                          <AlertCircle className="w-4 h-4 text-red-500" />
                          <span>Inválido</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-semibold" id="cpf-valid-msg">
                          <Check className="w-4 h-4 text-emerald-500" />
                          <span>CPF Válido</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* SEC 2: INTELIGNET ADDRESS */}
          <div>
            <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
              <MapPin className="w-4 h-4" />
              <span>2. Endereço</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              {/* Suggester field */}
              <div className="md:col-span-8 relative">
                <label htmlFor="addr-street" className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">
                  Logradouro / Rua *
                </label>
                <input
                  id="addr-street"
                  type="text"
                  required
                  placeholder="Inicie digitando a rua ou avenida..."
                  value={streetQuery}
                  onChange={(e) => {
                    setStreetQuery(e.target.value);
                    setEndereco(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  className="block w-full py-2.5 px-3 bg-slate-50/65 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />

                {/* Autocomplete Dropdown suggestions list */}
                {showSuggestions && suggestions.length > 0 && (
                  <div
                    id="address-autocomplete-list"
                    className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto divide-y divide-slate-100"
                  >
                    {suggestions.map((s) => (
                      <button
                        key={`${s.rua}-${s.bairro}`}
                        type="button"
                        onClick={() => handleStreetSelect(s.rua, s.bairro)}
                        className="w-full text-left px-4 py-2 text-xs hover:bg-slate-50 flex items-center justify-between text-slate-700 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span className="font-semibold text-slate-900">{s.rua}</span>
                        </div>
                        <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-mono text-slate-500">{s.bairro}</span>
                      </button>
                    ))}
                  </div>
                )}
                {showSuggestions && streetQuery.trim().length >= 2 && suggestions.length === 0 && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-slate-50 border border-slate-200 p-3 rounded-xl shadow-md text-[11px] text-slate-500 italic">
                    Nenhuma rua pré-indexada correspondente. Você pode digitar livremente.
                  </div>
                )}
              </div>

              {/* Number and Complement */}
              <div className="md:col-span-2">
                <label htmlFor="addr-num" className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">
                  Número *
                </label>
                <input
                  id="addr-num"
                  type="text"
                  required
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  placeholder="123"
                  className="block w-full py-2.5 px-3 bg-slate-50/65 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="addr-complement" className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">
                  Compl.
                </label>
                <input
                  id="addr-complement"
                  type="text"
                  value={complemento}
                  onChange={(e) => setComplemento(e.target.value)}
                  placeholder="Apto 2B"
                  className="block w-full py-2.5 px-3 bg-slate-50/65 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              {/* Bairro Select */}
              <div className="md:col-span-6">
                <label htmlFor="addr-bairro" className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">
                  Bairro *
                </label>
                <select
                  id="addr-bairro"
                  required
                  value={bairro}
                  onChange={(e) => handleBairroChange(e.target.value)}
                  className="block w-full py-2.5 px-3 bg-slate-50/65 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm cursor-pointer"
                >
                  <option value="">Selecione o Bairro...</option>
                  {allowedBairros.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              {/* Territory (Automatically Prefilled or Selectable based on Role) */}
              <div className="md:col-span-6">
                <label htmlFor="form-territory" className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">
                  Território Associado *
                </label>
                <div className="relative">
                  {currentUser.cargo === 'gestor' ? (
                    <select
                      id="form-territory"
                      value={territorio}
                      onChange={(e) => {
                        const selectedVal = e.target.value;
                        setTerritorio(selectedVal);
                        // Safe clean up for neighborhood if inconsistent
                        const matched = territories.find(t => normalizeTerritorioName(t.nome) === selectedVal);
                        if (matched && bairro) {
                          const belongs = matched.bairros.some(b => b.trim().toUpperCase() === bairro.trim().toUpperCase());
                          if (!belongs) {
                            setBairro('');
                          }
                        }
                      }}
                      className="block w-full py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm cursor-pointer font-semibold shadow-xs"
                    >
                      {territories.map((t) => (
                        <option key={t.id} value={normalizeTerritorioName(t.nome)}>
                          {t.nome} ({t.cras})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-mono font-semibold text-slate-700 flex justify-between items-center select-none">
                      <span>{territoryLabel}</span>
                      <span className="text-[10px] bg-slate-200 text-slate-600 px-2.5 py-0.5 rounded uppercase font-bold tracking-wide text-center">Bloqueado / Automático</span>
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 block mt-1">
                  {currentUser.cargo === 'gestor' 
                    ? '* Gestor possui acesso global e pode selecionar qualquer território de Ipatinga.' 
                    : '* Preenchido automaticamente com base no território do seu login oficial para evitar erros.'}
                </span>
              </div>
            </div>

            {hasSelectedLocation && (
              <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-blue-800">
                  <Compass className="w-4 h-4 text-blue-500 animate-spin" />
                  <span className="font-semibold">Localização Verificada:</span>
                  <span className="text-slate-600 font-mono text-[11px] font-normal">
                    {endereco}, {numero} - {bairro}, Ipatinga/MG
                  </span>
                </div>
                <a
                  href={getOSMLink(endereco, numero, bairro)}
                  target="_blank"
                  rel="noreferrer"
                  id="osm-external-route-btn"
                  className="bg-white hover:bg-slate-100 text-blue-600 font-bold text-xs py-1.5 px-3 rounded-lg shadow-sm flex items-center gap-1 border border-slate-200 cursor-pointer"
                >
                  <span>Verificar Rota</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>

          {/* SEC 3: METADATA & REASON */}
          <div>
            <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
              <FileText className="w-4 h-4" />
              <span>3. Motivo e Detalhes da Solicitação</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label htmlFor="form-motivo-select" className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">
                  Motivo da Visita *
                </label>
                <select
                  id="form-motivo-select"
                  required
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value as any)}
                  className="block w-full py-2.5 px-3 bg-slate-50/65 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm cursor-pointer font-semibold text-slate-700"
                >
                  <option value="BPC ATUALIZAÇÃO">BPC ATUALIZAÇÃO</option>
                  <option value="BPC BLOQUEADO">BPC BLOQUEADO</option>
                  <option value="REQUERER BPC">REQUERER BPC</option>
                  <option value="BOLSA FAMÍLIA ATUALIZAÇÃO">BOLSA FAMÍLIA ATUALIZAÇÃO</option>
                  <option value="BOLSA FAMÍLIA BLOQUEADO">BOLSA FAMÍLIA BLOQUEADO</option>
                  <option value="REQUERER BOLSA FAMÍLIA">REQUERER BOLSA FAMÍLIA</option>
                  <option value="AVERIGUAÇÃO NÃO UNIPESSOAL">AVERIGUAÇÃO NÃO UNIPESSOAL</option>
                  <option value="AVERIGUAÇÃO UNIPESSOAL">AVERIGUAÇÃO UNIPESSOAL</option>
                </select>
              </div>

              <div>
                <label htmlFor="cit-phone" className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">
                  Telefone de Contato
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-slate-400">
                    <Phone className="w-4 h-4" />
                  </span>
                  <input
                    id="cit-phone"
                    type="text"
                    value={telefone}
                    onChange={handlePhoneChange}
                    placeholder="(31) 90000-0000"
                    className="block w-full pl-9 pr-3 py-2.5 bg-slate-50/65 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="cit-dt-lim" className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">
                  Vencimento do CadÚnico (Opcional)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-slate-400">
                    <Calendar className="w-4 h-4" />
                  </span>
                  <input
                    id="cit-dt-lim"
                    type="date"
                    value={dataLimite}
                    onChange={(e) => setDataLimite(e.target.value)}
                    className="block w-full pl-9 pr-3 py-2.5 bg-slate-50/65 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Observation field */}
            <div className="mt-5">
              <label htmlFor="cit-obs" className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">
                Observações Especiais
              </label>
              <textarea
                id="cit-obs"
                rows={3}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Insira detalhes como referências de endereço, horários preferenciais da família, problemas de locomoção, etc."
                className="block w-full py-2.5 px-3 bg-slate-50/65 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>

          {/* SEC 4: AUDITING LOG PREFILL DETAILS */}
          <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-100 flex flex-col md:flex-row justify-between gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <CornerDownRight className="w-4 h-4 text-slate-400" />
              <span>Entrevistador Responsável: <strong className="text-slate-700">{currentUser.nome}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Lançamento no CADÚNICO: <strong className="text-slate-700 font-mono">Automático (HOJE)</strong></span>
            </div>
          </div>

          {/* Submit action buttons */}
          <div className="pt-4 flex flex-col sm:flex-row justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              id="cancel-add-visit-btn"
              onClick={() => onSetTab('ver_visitas')}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs sm:text-sm shadow-sm transition-colors cursor-pointer"
            >
              Cancelar e Voltar
            </button>
            <button
              type="submit"
              id="submit-add-visit-btn"
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md shadow-blue-600/10 transition-colors cursor-pointer"
            >
              Confirmar Cadastro de Visita
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
