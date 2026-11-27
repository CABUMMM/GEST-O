/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  MapPin,
  Calendar,
  Phone,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  Printer,
  ChevronDown,
  Clock,
  UserCheck,
  Edit2,
  Trash2,
  RefreshCw,
  Plus,
  Landmark,
  FileText,
  Loader2,
  FileDown
} from 'lucide-react';
import { Visit, User, Attempt } from '../types';
import { getOSMLink, normalizeTerritorioName, sanitizeInterviewerName, normalizeMotivo } from '../data';
import { motion, AnimatePresence } from 'motion/react';

interface VisitListProps {
  visits: Visit[];
  currentUser: User;
  onUpdateVisit: (id: string, updatedFields: Partial<Visit>) => void;
  onDeleteVisit?: (id: string) => void;
  onDeleteAllPending?: () => Promise<number>;
  onSetTab: (tab: string) => void;
}

export function getDeadlineBadge(dateStr: string) {
  if (!dateStr) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  let colorClass = 'text-emerald-700 bg-emerald-50 border-emerald-150';
  let dotClass = 'bg-emerald-500';
  let label = `${diffDays} dias restantes`;
  
  if (diffDays < 0) {
    colorClass = 'text-rose-700 bg-rose-50 border-rose-150 font-black';
    dotClass = 'bg-rose-500 animate-pulse';
    label = `Vencido há ${Math.abs(diffDays)}d!`;
  } else if (diffDays <= 5) {
    colorClass = 'text-red-700 bg-red-50 border-red-200 animate-pulse font-black';
    dotClass = 'bg-red-500 animate-pulse';
    label = `Urgente: ${diffDays}d`;
  } else if (diffDays <= 15) {
    colorClass = 'text-amber-700 bg-amber-50 border-amber-150 font-bold';
    dotClass = 'bg-amber-500';
    label = `Atenção: ${diffDays}d`;
  } else {
    colorClass = 'text-emerald-700 bg-emerald-50 border-emerald-150 font-semibold';
    dotClass = 'bg-emerald-500';
    label = `${diffDays}d`;
  }

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] uppercase border tracking-wider font-extrabold ${colorClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
      <span>{label}</span>
    </div>
  );
}

export default function VisitList({ visits, currentUser, onUpdateVisit, onDeleteVisit, onDeleteAllPending, onSetTab }: VisitListProps) {
  // Filters & Search
  const [search, setSearch] = useState('');
  const [selectedBairro, setSelectedBairro] = useState('');
  const [selectedTerritorio, setSelectedTerritorio] = useState('');
  const [selectedMotivo, setSelectedMotivo] = useState('');
  const [selectedEntrevistador, setSelectedEntrevistador] = useState('');

  // Bulk selector for printing
  const [selectedVisitIds, setSelectedVisitIds] = useState<string[]>([]);

  // Print Preview state
  const [isPrinting, setIsPrinting] = useState(false);

  // Modern modal state
  const [activeModal, setActiveModal] = useState<'finalize' | 'fail' | null>(null);
  const [targetVisit, setTargetVisit] = useState<Visit | null>(null);

  // Modal input fields
  const [modalDate, setModalDate] = useState(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  });
  const [modalObs, setModalObs] = useState('');

  // Batch secure deletion state variables
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [safetyWord, setSafetyWord] = useState('');
  const [enteredWord, setEnteredWord] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Filtering pending items
  const pendingVisits = useMemo(() => {
    let list = visits.filter((v) => v.status === 'Pendente');
    if (currentUser.cargo !== 'gestor') {
      const userTerr = normalizeTerritorioName(currentUser.territorio || '');
      list = list.filter((v) => normalizeTerritorioName(v.territorio) === userTerr);
    }
    
    // Sort automatically: most urgent first (lowest remaining days first)
    return [...list].sort((a, b) => {
      const getDays = (dateStr?: string) => {
        if (!dateStr) return 9999;
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const target = new Date(dateStr);
        target.setHours(0, 0, 0, 0);
        return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      };
      return getDays(a.dataLimite) - getDays(b.dataLimite);
    });
  }, [visits, currentUser]);

  // Apply filters
  const filteredVisits = useMemo(() => {
    return pendingVisits.filter((v) => {
      const matchSearch =
        v.nome.toLowerCase().includes(search.toLowerCase()) ||
        v.cpf.includes(search) ||
        v.endereco.toLowerCase().includes(search.toLowerCase()) ||
        v.id.toLowerCase().includes(search.toLowerCase());

      const matchBairro = selectedBairro ? v.bairro === selectedBairro : true;
      const matchTerritorio = selectedTerritorio ? v.territorio === selectedTerritorio : true;
      const matchMotivo = selectedMotivo ? normalizeMotivo(v.motivo) === selectedMotivo : true;
      
      const interviewerClean = sanitizeInterviewerName(v.nomeEntrevistador);
      const matchEntrevistador = selectedEntrevistador 
        ? interviewerClean === selectedEntrevistador
        : true;

      return matchSearch && matchBairro && matchTerritorio && matchMotivo && matchEntrevistador;
    });
  }, [pendingVisits, search, selectedBairro, selectedTerritorio, selectedMotivo, selectedEntrevistador]);

  // Categories helper lists for dropdown filters
  const filterOptions = useMemo(() => {
    const bairros = Array.from(new Set(pendingVisits.map((v) => v.bairro))).filter(Boolean).sort();
    const territorios = Array.from(new Set(pendingVisits.map((v) => v.territorio))).filter(Boolean).sort();
    
    // Normalize and dynamic motives from all visits (real records in database)
    const motivos = Array.from(
      new Set(
        visits
          .map((v) => normalizeMotivo(v.motivo))
          .filter(Boolean)
      )
    ).sort();

    // Clean interviewer list dynamically from all visits, normalizing duplicates and 'SEM ENTREVISTADOR'
    const entrevistadores = Array.from(
      new Set(
        visits
          .map((v) => sanitizeInterviewerName(v.nomeEntrevistador))
          .filter((name) => name && name !== 'SEM ENTREVISTADOR' && name.trim() !== '')
      )
    ).sort();

    return { bairros, territorios, motivos, entrevistadores };
  }, [pendingVisits, visits]);

  // Selector controls
  const handleToggleSelectRow = (id: string) => {
    setSelectedVisitIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedVisitIds.length === filteredVisits.length) {
      setSelectedVisitIds([]);
    } else {
      setSelectedVisitIds(filteredVisits.map((v) => v.id));
    }
  };

  // Finalize Visit Modal opener
  const openFinalizeModal = (visit: Visit) => {
    setTargetVisit(visit);
    setModalObs('');
    const today = new Date();
    setModalDate(today.toISOString().slice(0, 10));
    setActiveModal('finalize');
  };

  // Unsuccessful attempt modal opener
  const openFailAttemptModal = (visit: Visit) => {
    setTargetVisit(visit);
    setModalObs('');
    const today = new Date();
    setModalDate(today.toISOString().slice(0, 10));
    setActiveModal('fail');
  };

  // Commit Finalizing visit
  const handleConfirmFinalize = () => {
    if (!targetVisit) return;

    if (!modalDate) {
      alert('Por favor, informe a data da visita.');
      return;
    }

    onUpdateVisit(targetVisit.id, {
      status: 'Concluída',
      dataConclusao: `${modalDate} 12:00`,
      cpfConclusao: currentUser.cpf,
      observacoesConclusao: modalObs.trim() || 'Visita finalizada com preenchimento de cadastro regular.'
    });

    // Remove from print list if inside
    setSelectedVisitIds((prev) => prev.filter((id) => id !== targetVisit.id));
    setActiveModal(null);
    setTargetVisit(null);
  };

  // Commit Unsuccessful attempt
  const handleConfirmFailAttempt = () => {
    if (!targetVisit) return;

    if (!modalObs.trim()) {
      alert('Por favor, descreva qual o motivo da não conclusão (ex: morador ausente).');
      return;
    }

    const newAttempt: Attempt = {
      id: `T_${targetVisit.id}_${Date.now()}`,
      data: `${modalDate} 15:00`,
      entrevistador: currentUser.nome,
      observacoes: modalObs.trim()
    };

    const updatedAttempts = [...targetVisit.tentativas, newAttempt];
    const isOverAttemptsLimit = updatedAttempts.length >= 3;

    if (isOverAttemptsLimit) {
      // Auto convert to FINALIZADA - NÃO LOCALIZADO
      onUpdateVisit(targetVisit.id, {
        tentativas: updatedAttempts,
        status: 'FINALIZADA - NÃO LOCALIZADO',
        dataConclusao: `${modalDate} 15:00`,
        cpfConclusao: currentUser.cpf,
        observacoesConclusao: `Encerrado automaticamente após 3 tentativas infrutíferas. Última observação: ${modalObs.trim()}`
      });
      alert(`Visita para "${targetVisit.nome}" convertida em 'FINALIZADA - NÃO LOCALIZADO' devido ao limite de 3 tentativas atingido.`);
    } else {
      // Save attempt failure, retain on pending list
      onUpdateVisit(targetVisit.id, {
        tentativas: updatedAttempts
      });
    }

    setActiveModal(null);
    setTargetVisit(null);
  };

  // Handle deletion safely
  const handleDelete = (id: string, name: string) => {
    if (!onDeleteVisit) return;
    const confirm = window.confirm(`ATENÇÃO: Tem certeza absoluta que deseja EXCLUIR do cadastro a solicitação de visita de "${name}"?`);
    if (confirm) {
      onDeleteVisit(id);
      setSelectedVisitIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const startDeleteAllFlow = () => {
    setDeleteStep(1);
    setEnteredWord('');
    setDeleteError('');
    setIsDeleteAllOpen(true);
  };

  const WORDS_POOL = ['LIMOEIRO', 'CADUNICO', 'IPATINGA', 'VISITAS', 'TERRITORIO', 'CRAS2026'];

  const handleGoToDeleteStep2 = () => {
    const randomWord = WORDS_POOL[Math.floor(Math.random() * WORDS_POOL.length)];
    setSafetyWord(randomWord);
    setEnteredWord('');
    setDeleteError('');
    setDeleteStep(2);
  };

  const handleExecuteDeleteAll = async () => {
    if (enteredWord.trim().toUpperCase() !== safetyWord) {
      setDeleteError('Palavra-chave incorreta! Novo código de segurança gerado.');
      const randomWord = WORDS_POOL[Math.floor(Math.random() * WORDS_POOL.length)];
      setSafetyWord(randomWord);
      setEnteredWord('');
      return;
    }

    setIsDeleting(true);
    setDeleteError('');

    try {
      if (onDeleteAllPending) {
        const countDeleted = await onDeleteAllPending();
        
        // Log the batch delete inside localStorage audit logs
        const newLog = {
          id: `DEL-${Date.now().toString().slice(-6)}`,
          dataHora: new Date().toLocaleString('pt-BR'),
          usuario: currentUser.nome,
          cargo: currentUser.cargo,
          totalDeletadas: countDeleted,
          palavraChave: safetyWord,
          ipSessao: `IP: 184.22.95.${Math.floor(Math.random() * 254) + 1} / Sessão SUS-UID-${currentUser.cpf || currentUser.id}`
        };

        const existingLogsStr = localStorage.getItem('visitas_deletions_audit_logs') || '[]';
        let existingLogs = [];
        try {
          existingLogs = JSON.parse(existingLogsStr);
        } catch (err) {
          console.error(err);
        }
        existingLogs = [newLog, ...existingLogs];
        localStorage.setItem('visitas_deletions_audit_logs', JSON.stringify(existingLogs));

        setSelectedVisitIds([]);
      }
      setIsDeleteAllOpen(false);
    } catch (error) {
      alert(`Erro na exclusão em lote: ${error}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // List of selected visits data for custom print
  const visitsToPrint = useMemo(() => {
    return visits.filter((v) => selectedVisitIds.includes(v.id));
  }, [selectedVisitIds, visits]);

  // Clean filters button
  const handleClearFilters = () => {
    setSearch('');
    setSelectedBairro('');
    setSelectedTerritorio('');
    setSelectedMotivo('');
    setSelectedEntrevistador('');
  };

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {isPrinting && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2rem] border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 md:p-8"
              id="printable-vis-container"
            >
              {/* Controls bar inside modal - NOT PRINTED */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 mb-5 border-b border-slate-200">
                <div className="flex items-center gap-2.5">
                  <Landmark className="w-5 h-5 text-blue-600 animate-pulse" />
                  <div className="text-left">
                    <h2 className="text-xs font-bold text-slate-900 uppercase">Prefeitura Municipal de Ipatinga</h2>
                    <p className="text-[9px] text-slate-400 font-extrabold tracking-wider">EXPORTAÇÃO / INSTITUCIONAL</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2.5 w-full sm:w-auto">
                  <button
                    onClick={() => setIsPrinting(false)}
                    className="flex-1 sm:flex-initial px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer text-center"
                  >
                    Fechar Preview
                  </button>
                  <button
                    onClick={() => {
                      window.print();
                    }}
                    className="flex-1 sm:flex-initial px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs hover:shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Imprimir Agora</span>
                  </button>
                </div>
              </div>

              {/* Visually beautiful interactive Screen Preview - ONLY visible on screen inside modal */}
              <div className="space-y-6 font-sans p-2">
                <div className="text-center bg-slate-50 border border-slate-200 py-3 rounded-2xl mb-4">
                  <span className="text-[9px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Preview de Impressão</span>
                  <h3 className="text-base font-black text-slate-905 uppercase tracking-tight mt-1">
                    Visualização das Fichas de Visitas
                  </h3>
                  <p className="text-[10px] text-slate-500 font-medium">As fichas abaixo serão reorganizadas em layout compacto para economizar papel ao imprimir.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {visitsToPrint.map((v) => (
                    <div key={v.id} className="p-4 border border-slate-200 rounded-xl space-y-3 bg-slate-50/40 relative">
                      <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                        <span className="font-extrabold text-slate-900 text-xs">👤 {v.nome}</span>
                        <span className="font-mono text-[10px] text-slate-550">CPF: {v.cpf}</span>
                      </div>
                      <div className="space-y-1.5 text-[11px] text-slate-700">
                        <p><strong className="text-slate-500 font-bold uppercase tracking-wide text-[9px] mr-1">Endereço:</strong> {v.endereco}, {v.numero} - {v.bairro}</p>
                        <p><strong className="text-slate-500 font-bold uppercase tracking-wide text-[9px] mr-1">Telefone:</strong> {v.telefone || 'Não Informado'}</p>
                        <p><strong className="text-slate-500 font-bold uppercase tracking-wide text-[9px] mr-1">Motivo:</strong> <span className="bg-amber-100 text-amber-800 font-semibold px-1 rounded">{normalizeMotivo(v.motivo)}</span></p>
                        <p><strong className="text-slate-500 font-bold uppercase tracking-wide text-[9px] mr-1">Entrevistador:</strong> {sanitizeInterviewerName(v.nomeEntrevistador)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* REACT PORTAL: Absolute Isolation for printing environment avoiding extra empty layouts */}
      {isPrinting && createPortal(
        <div id="print-portal-root" className="bg-white text-slate-900 font-sans p-6 antialiased">
          {/* Printable institutional logo */}
          <div className="flex justify-between items-center pb-3 border-b border-slate-300 mb-3">
            <div className="flex items-center gap-2">
              <Landmark className="w-6 h-6 text-blue-600 shrink-0" />
              <div className="text-left font-sans">
                <h2 className="text-xs font-black text-slate-950 uppercase tracking-tight">Prefeitura Municipal de Ipatinga</h2>
                <p className="text-[8px] text-slate-500 font-extrabold tracking-wider">SECRETARIA MUNICIPAL DE ASSISTÊNCIA SOCIAL</p>
              </div>
            </div>
            <div className="text-right font-mono text-[8px] text-slate-400">
              <span>Emissão: {new Date().toLocaleDateString('pt-BR')}</span>
            </div>
          </div>

          <div className="text-center bg-slate-50 border border-slate-200 py-2 rounded-lg mb-4">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest leading-none">
              Ficha de Visitas Domiciliares do Cadastro Único (SUAS)
            </h3>
            <p className="text-[8px] text-slate-500 font-semibold uppercase tracking-wider mt-1">Trabalho de Campo para Atualização Cadastral</p>
          </div>

          {/* Optimized vertical content-saving density stack. Generously fits 2 to 3 cards per A4 sheet */}
          <div className="space-y-4 font-sans text-slate-905">
            {visitsToPrint.map((v) => (
              <div key={v.id} className="p-4 border-2 border-slate-300 bg-white rounded-xl space-y-3 page-break text-[10px] leading-relaxed shadow-xs">
                {/* Header with requester name and CPF */}
                <div className="flex justify-between items-center border-b-2 border-slate-300 pb-2 mb-2">
                  <span className="font-black text-slate-950 text-sm uppercase tracking-tight">
                    👤 {v.nome}
                  </span>
                  <span className="font-mono font-black text-slate-900 text-[11px] bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200">
                    CPF: {v.cpf}
                  </span>
                </div>

                {/* Grid with 12 columns for precise side-by-side desktop/print alignment */}
                <div className="grid grid-cols-12 gap-x-5 gap-y-2.5">
                  <div className="col-span-8 border-r border-slate-200 pr-3">
                    <span className="text-[8px] uppercase font-black text-slate-400 block tracking-wider">Endereço Completo</span>
                    <span className="font-bold text-slate-950 leading-tight block">
                      {v.endereco}, Nº {v.numero} {v.complemento ? `(${v.complemento})` : ''} — Bairro: {v.bairro}
                    </span>
                  </div>
                  <div className="col-span-4">
                    <span className="text-[8px] uppercase font-black text-slate-400 block tracking-wider">Telefone</span>
                    <span className="font-mono font-bold text-slate-900 block mt-0.5">{v.telefone || 'Não Informado'}</span>
                  </div>

                  <div className="col-span-4 border-r border-slate-200 pr-3">
                    <span className="text-[8px] uppercase font-black text-slate-400 block tracking-wider">Demanda Requisitada</span>
                    <span className="font-extrabold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/50 text-[10px] inline-block mt-0.5 uppercase">
                      {normalizeMotivo(v.motivo)}
                    </span>
                  </div>
                  <div className="col-span-4 border-r border-slate-200 pr-3">
                    <span className="text-[8px] uppercase font-black text-slate-400 block tracking-wider">Entrevistador Responsável</span>
                    <span className="font-bold text-slate-900 block mt-0.5">{sanitizeInterviewerName(v.nomeEntrevistador)}</span>
                  </div>
                  <div className="col-span-4">
                    <span className="text-[8px] uppercase font-black text-slate-400 block tracking-wider">Lançamento / Prazo</span>
                    <span className="font-mono text-slate-900 font-bold block mt-0.5">
                      {v.dataSolicitacao} {v.dataLimite ? ` até ${v.dataLimite}` : ''}
                    </span>
                  </div>
                </div>

                {v.observacoes && (
                  <div className="mt-2 pt-2 border-t border-dashed border-slate-200 text-[10px] text-slate-705 italic leading-relaxed">
                    <strong className="text-[8px] uppercase font-black text-slate-400 not-italic mr-1.5 tracking-wider">Observações:</strong>
                    {v.observacoes}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}

      {/* Main filter container - Bento Styled */}
      <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 className="text-2xl font-black text-slate-950 flex items-center gap-2.5 tracking-tight">
              <Clock className="w-6 h-6 text-amber-500 animate-pulse" />
              <span>Visitas Domiciliares Pendentes</span>
            </h2>
            <p className="text-xs md:text-sm text-slate-500 mt-1 font-medium">
              Identificadas {pendingVisits.length} visitas ativas sob acompanhamento em Ipatinga/MG.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5 shrink-0">
            {selectedVisitIds.length > 0 && (
              <button
                onClick={() => setIsPrinting(true)}
                id="bulk-print-btn"
                className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs py-2.5 px-4 rounded-xl shadow-xs hover:shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Visitas ({selectedVisitIds.length})</span>
              </button>
            )}

            <button
              onClick={() => onSetTab('adicionar_visita')}
              id="quick-add-visit-btn"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-2.5 px-4 rounded-xl shadow-xs hover:shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar Nova Visita</span>
            </button>
          </div>
        </div>

        {/* Dynamic Search & filter parameters UI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 pt-2">
          {/* Text Search input */}
          <div className="relative sm:col-span-2 lg:col-span-1">
            <span className="absolute left-3.5 top-3 text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Buscar Nome, CPF ou ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-850 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-semibold"
            />
          </div>

          {/* District filter */}
          <select
            value={selectedBairro}
            onChange={(e) => setSelectedBairro(e.target.value)}
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-extrabold"
          >
            <option value="">Filtrar todos os Bairros...</option>
            {filterOptions.bairros.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          {/* Territory filter */}
          <select
            value={selectedTerritorio}
            onChange={(e) => setSelectedTerritorio(e.target.value)}
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-extrabold"
          >
            <option value="">Filtrar Territórios...</option>
            {filterOptions.territorios.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {/* Motive filter */}
          <select
            value={selectedMotivo}
            onChange={(e) => setSelectedMotivo(e.target.value)}
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-extrabold"
          >
            <option value="">Filtrar Motivo...</option>
            {filterOptions.motivos.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          {/* Assigned Worker filter */}
          <select
            value={selectedEntrevistador}
            onChange={(e) => setSelectedEntrevistador(e.target.value)}
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-extrabold"
          >
            <option value="">Filtrar Entrevistador...</option>
            {filterOptions.entrevistadores.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
            <option value="SEM ENTREVISTADOR">SEM ENTREVISTADOR</option>
          </select>
        </div>

        {/* Dynamic active tags resetter */}
        {(search || selectedBairro || selectedTerritorio || selectedMotivo || selectedEntrevistador) && (
          <div className="flex justify-between items-center text-xs text-slate-650 bg-slate-50 p-3 rounded-xl border border-slate-200/60 font-medium">
            <span id="active-filters-desc">
              Exibindo <strong>{filteredVisits.length}</strong> resultados filtrados de <strong>{pendingVisits.length}</strong> pendentes totais.
            </span>
            <button
              onClick={handleClearFilters}
              id="clear-filters-btn"
              className="text-blue-600 font-extrabold flex items-center gap-1.5 hover:text-blue-700 hover:underline cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 animate-spin-reverse" />
              <span>Limpar Filtros</span>
            </button>
          </div>
        )}

        {currentUser.cargo === 'gestor' && (
          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              onClick={startDeleteAllFlow}
              className="bg-red-50 hover:bg-red-100 text-red-600 font-extrabold text-xs py-2.5 px-4 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer hover:text-red-700 border border-red-200"
            >
              <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />
              <span>DELETAR TODAS AS VISITAS PENDENTES</span>
            </button>
          </div>
        )}
      </div>

      {/* Grid or Table representing result set */}
      {filteredVisits.length === 0 ? (
        <div className="bg-white text-center py-20 px-6 rounded-[2.5rem] border border-slate-200 shadow-sm">
          <AlertTriangle className="w-14 h-14 text-slate-300 mx-auto mb-4" />
          <p className="text-lg font-extrabold text-slate-800">Nenhuma visita pendente encontrada</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto font-medium">
            Não existem visitas correspondentes com as especificações inseridas no painel de buscas do CadÚnico.
          </p>
          <button
            onClick={handleClearFilters}
            className="mt-5 px-5 py-2.5 bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-bold cursor-pointer transition-all"
          >
            Ver Todas Pendentes
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* DESKTOP TABLE MODE (hidden on smaller phones) */}
          <div className="hidden md:block bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-all duration-300">
            <table className="min-w-full divide-y divide-slate-100 text-xs text-left" id="desktop-visits-table">
              <thead className="bg-[#f8fafc]/85 border-b border-slate-200 font-bold uppercase text-[10px] text-slate-500 tracking-wider">
                <tr>
                  <th className="py-4.5 px-4 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={selectedVisitIds.length === filteredVisits.length && filteredVisits.length > 0}
                      onChange={handleToggleSelectAll}
                      className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4"
                    />
                  </th>
                  <th className="py-4.5 px-3 w-20">ID</th>
                  <th className="py-4.5 px-3">Beneficiário</th>
                  <th className="py-4.5 px-3">Endereço / Bairro</th>
                  <th className="py-4.5 px-3">Motivo / Requisito</th>
                  <th className="py-4.5 px-3">Responsável</th>
                  <th className="py-4.5 px-2 text-center">Tentativas</th>
                  <th className="py-4.5 pr-5 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredVisits.map((v) => {
                  const hasSelected = selectedVisitIds.includes(v.id);
                  const isThirdAttemptPossible = v.tentativas.length === 2;
                  return (
                     <tr
                      key={v.id}
                      className={`${hasSelected ? 'bg-blue-50/30 font-medium' : 'hover:bg-slate-50/50'} transition-all`}
                    >
                      <td className="py-4 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={hasSelected}
                          onChange={() => handleToggleSelectRow(v.id)}
                          className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4"
                        />
                      </td>

                      <td className="py-4 px-3">
                        <span className="font-mono font-bold text-slate-900 bg-slate-100/80 border border-slate-200 text-[10px] px-2.5 py-1 rounded-lg">
                          {v.id}
                        </span>
                      </td>

                      <td className="py-4 px-3">
                        <div className="font-extrabold text-slate-900 text-sm">{v.nome}</div>
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5 font-medium">CPF: {v.cpf}</div>
                      </td>

                      <td className="py-4 px-3 max-w-xs xl:max-w-sm">
                        <div className="font-semibold text-slate-800 line-clamp-1">{v.endereco}, {v.numero}</div>
                        <div className="flex gap-2 items-center mt-1 text-[10px]">
                          <span className="bg-slate-100/90 text-slate-600 px-2 py-0.5 rounded font-bold font-mono border border-slate-150">{v.bairro}</span>
                          <span className="text-slate-450 font-semibold font-mono">{v.territorio}</span>
                        </div>
                      </td>

                      <td className="py-4 px-3">
                        <span className="bg-amber-50 text-amber-700 border border-amber-200/60 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-tight">
                          {normalizeMotivo(v.motivo)}
                        </span>
                        {v.dataLimite && (
                          <div className="mt-1.5 block">
                            {getDeadlineBadge(v.dataLimite)}
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-3">
                        <div className="font-bold text-slate-800">{sanitizeInterviewerName(v.nomeEntrevistador)}</div>
                        {v.telefone && (
                          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                            <Phone className="w-3.5 h-3.5 text-slate-350" />
                            <span>{v.telefone}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-2 text-center">
                        {v.tentativas.length === 0 ? (
                          <span className="text-slate-405 text-[10px] font-semibold bg-slate-50 px-2 py-0.5 rounded border border-slate-100">Zero</span>
                        ) : (
                          <div className="inline-flex flex-col items-center">
                            <span className="bg-red-50 text-red-700 border border-red-200 font-extrabold px-2 py-0.5 rounded-full font-mono text-[10px] uppercase tracking-tighter">
                              {v.tentativas.length} Falhas
                            </span>
                            {isThirdAttemptPossible && (
                              <span className="text-[9px] text-red-500 font-extrabold uppercase mt-1.5 tracking-tighter animate-bounce">Atenção!</span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="py-4 pr-5 px-3 text-right">
                        <div className="flex justify-end items-center gap-2">
                          {/* Route link */}
                          <a
                            href={getOSMLink(v.endereco, v.numero, v.bairro)}
                            target="_blank"
                            rel="noreferrer"
                            className="bg-slate-50 hover:bg-slate-100 text-slate-700 p-2 rounded-xl border border-slate-200 transition-all shadow-3xs hover:shadow-2xs tooltip flex items-center justify-center cursor-pointer"
                            title="Abrir rota no OpenStreetMap"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>

                          {/* Fail Attempt */}
                          <button
                            onClick={() => openFailAttemptModal(v)}
                            className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/50 px-3 py-1.5 rounded-xl text-xs font-extrabold font-mono tracking-tight cursor-pointer transition-all"
                            title="Registrar tentativa malsucedida"
                          >
                            Malsucedida
                          </button>

                          {/* Finalize Visit */}
                          <button
                            onClick={() => openFinalizeModal(v)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-extrabold shadow-sm hover:shadow transition-all cursor-pointer"
                          >
                            Concluir
                          </button>

                          {/* Delete option only for gestor */}
                          {currentUser.cargo === 'gestor' && onDeleteVisit && (
                            <button
                              onClick={() => handleDelete(v.id, v.nome)}
                              className="bg-red-50 hover:bg-red-100 text-red-650 p-2 rounded-xl border border-red-150 cursor-pointer transition-colors"
                              title="Excluir Visita"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* MOBILE CARDS LIST - Styled as Bento cells */}
          <div className="block md:hidden space-y-4">
            {filteredVisits.map((v) => (
              <div
                key={v.id}
                className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-xs space-y-4 relative overflow-hidden group hover:shadow-md transition-all duration-300"
              >
                {/* Active index checkbox */}
                <div className="absolute top-5 left-5">
                  <input
                    type="checkbox"
                    checked={selectedVisitIds.includes(v.id)}
                    onChange={() => handleToggleSelectRow(v.id)}
                    className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer w-4.5 h-4.5"
                  />
                </div>

                <div className="pl-8 flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-150">
                      ID: {v.id}
                    </span>
                    <h4 className="font-extrabold text-slate-900 mt-2 text-base tracking-tight">{v.nome}</h4>
                    <p className="text-[10px] font-mono text-slate-400 font-medium">CPF: {v.cpf}</p>
                  </div>
                  <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-amber-100 text-center uppercase tracking-tight">
                    {normalizeMotivo(v.motivo)}
                  </span>
                </div>

                <div className="text-xs text-slate-650 space-y-2.5 bg-slate-50/75 p-3.5 rounded-2xl border border-slate-150">
                  <p className="flex items-start gap-2 font-medium text-slate-800">
                    <MapPin className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    <span>{v.endereco}, {v.numero} - {v.bairro} ({v.territorio})</span>
                  </p>
                  {v.telefone && (
                    <p className="flex items-center gap-2 font-mono text-xs">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{v.telefone}</span>
                    </p>
                  )}
                  {v.dataLimite && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                        <span className="text-slate-500 font-bold">Limite: {v.dataLimite}</span>
                        {getDeadlineBadge(v.dataLimite)}
                      </div>
                    </div>
                  )}
                </div>

                {/* History of attempts inside mobile panel */}
                {v.tentativas.length > 0 && (
                  <div className="bg-red-50/40 p-3.5 rounded-2xl border border-red-150 space-y-2">
                    <p className="text-[10px] font-extrabold text-red-700 uppercase flex items-center gap-1.5 tracking-tight">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Infrutíferas ({v.tentativas.length})</span>
                    </p>
                    <div className="divide-y divide-red-100">
                      {v.tentativas.map((att, i) => (
                        <p key={att.id} className="text-[10px] text-slate-650 pt-1.5 first:pt-0">
                          <strong className="text-slate-800 font-mono block">Tentativa {i + 1} - {att.data}:</strong>
                          <span className="italic">"{att.observacoes}"</span>
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mobile actions panel */}
                <div className="flex flex-wrap justify-end items-center gap-2 pt-3 border-t border-slate-100">
                  <a
                    href={getOSMLink(v.endereco, v.numero, v.bairro)}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all"
                  >
                    Abrir Rota
                  </a>
                  <button
                    onClick={() => openFailAttemptModal(v)}
                    className="p-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-bold text-xs rounded-xl transition-all"
                  >
                    Malsucedida
                  </button>
                  <button
                    onClick={() => openFinalizeModal(v)}
                    className="p-2 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all"
                  >
                    Concluir Visita
                  </button>
                  {currentUser.cargo === 'gestor' && onDeleteVisit && (
                    <button
                      onClick={() => handleDelete(v.id, v.nome)}
                      className="p-2 text-red-650 bg-red-50 hover:bg-red-100 border border-red-100 rounded-xl text-xs font-bold transition-all"
                    >
                      Excluir
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL CORES FOR CONCLUDING OR FAILING VISITS - Bento Styled */}
      <AnimatePresence>
        {activeModal && targetVisit && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-white rounded-[2rem] border border-slate-200 shadow-2xl max-w-md w-full p-6 md:p-8 text-slate-800 space-y-5 font-sans relative overflow-hidden"
            >
              <div className="flex gap-3.5 items-center">
                {activeModal === 'finalize' ? (
                  <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600 shrink-0 border border-emerald-100">
                    <CheckCircle className="w-6 h-6 animate-pulse" />
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 rounded-2xl text-amber-600 shrink-0 border border-amber-100">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">
                    {activeModal === 'finalize' ? 'Finalizar Atendimento' : 'Registrar Tentativa Malsucedida'}
                  </h3>
                  <p className="text-[10px] font-mono font-bold text-slate-400 bg-slate-50 border border-slate-150 px-2 py-0.5 rounded-md mt-1 inline-block">ID: {targetVisit.id}</p>
                </div>
              </div>

              <div className="bg-slate-50/75 p-4 rounded-2xl border border-slate-150 text-xs text-slate-700 space-y-1.5">
                <p><strong>Cidadão:</strong> {targetVisit.nome}</p>
                <p><strong>Local:</strong> {targetVisit.endereco}, nº {targetVisit.numero} - {targetVisit.bairro}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="modal-date-picker" className="block text-xs font-extrabold text-slate-500 mb-1.5 uppercase tracking-wider">
                    Data da Visita/Tentativa
                  </label>
                  <input
                    id="modal-date-picker"
                    type="date"
                    value={modalDate}
                    onChange={(e) => setModalDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  />
                </div>

                <div>
                  <label htmlFor="modal-obs-area" className="block text-xs font-extrabold text-slate-500 mb-1.5 uppercase tracking-wider">
                    {activeModal === 'finalize' ? 'Observações Finais (Opcional)' : 'Explicar motivo da falha *'}
                  </label>
                  <textarea
                    id="modal-obs-area"
                    rows={3}
                    placeholder={
                      activeModal === 'finalize'
                        ? 'Forneça notas do que foi coletado de documentos no domicílio...'
                        : 'Por que a visita não foi concluída? (Ex: Morador ausente, mudou de residência, recusou assinar...)'
                    }
                    value={modalObs}
                    onChange={(e) => setModalObs(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-400 font-medium"
                  />
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 text-[10px] text-slate-450 font-mono flex flex-col gap-0.5">
                <span>Registrado por: <strong>{currentUser.nome}</strong></span>
                <span>CPF Verificador: <strong>{currentUser.cpf}</strong></span>
              </div>

              {/* Modal controls */}
              <div className="flex gap-2.5 justify-end pt-2">
                <button
                  onClick={() => {
                    setActiveModal(null);
                    setTargetVisit(null);
                  }}
                  className="px-4.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                {activeModal === 'finalize' ? (
                  <button
                    onClick={handleConfirmFinalize}
                    className="px-4.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs hover:shadow transition-all cursor-pointer"
                  >
                    Confirmar e Finalizar
                  </button>
                ) : (
                  <button
                    onClick={handleConfirmFailAttempt}
                    className="px-4.5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl shadow-xs hover:shadow transition-all cursor-pointer"
                  >
                    Registrar Falha
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {/* SECURE PENDING BATCH DELETION MODAL */}
        {isDeleteAllOpen && currentUser.cargo === 'gestor' && (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl max-w-lg w-full p-6 md:p-8 space-y-6 text-slate-800 relative overflow-hidden"
            >
              {/* Caution decorative header stripes */}
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-red-600 via-amber-500 to-red-600" />

              <div className="flex gap-4 items-start">
                <div className="p-3 bg-red-100 rounded-2xl text-red-600 shrink-0 border border-red-200">
                  <AlertTriangle className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-rose-950 tracking-tight uppercase">
                    Exclusão Crítica de Dados
                  </h3>
                  <p className="text-[10px] text-red-600 font-bold tracking-widest uppercase mt-0.5">
                    Apenas Nível de Coordenação SUAS
                  </p>
                </div>
              </div>

              {deleteStep === 1 ? (
                <>
                  <div className="bg-red-50 p-5 rounded-2xl border border-red-200 text-xs text-red-900 leading-relaxed font-semibold space-y-3">
                    <p className="font-extrabold text-sm">⚠️ ATENÇÃO CRÍTICA:</p>
                    <p>
                      Você está prestes a apagar <strong>TODAS AS {pendingVisits.length} VISITAS PENDENTES</strong> cadastradas no banco de dados municipal do SUAS / Ipatinga.
                    </p>
                    <div className="bg-white/60 p-3 rounded-xl border border-red-150 text-[11px] font-medium space-y-1 text-slate-705">
                      <p>• Esta ação removerá visitas ainda não concluídas e abertas.</p>
                      <p>• Esta operação <strong>NÃO pode ser desfeita</strong> sob nenhuma hipótese.</p>
                      <p>• Afetará relatórios históricos, indicadores de desempenho e o monitoramento geral.</p>
                    </div>
                    <p className="font-extrabold text-center pt-2">Deseja realmente continuar para o segundo fator de segurança?</p>
                  </div>

                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setIsDeleteAllOpen(false)}
                      className="px-5 py-3 text-xs font-black text-slate-600 bg-slate-100 hover:bg-slate-250 hover:text-slate-800 rounded-xl transition-all cursor-pointer"
                    >
                      CANCELAR
                    </button>
                    <button
                      onClick={handleGoToDeleteStep2}
                      disabled={pendingVisits.length === 0}
                      className="px-6 py-3 text-xs font-black text-white bg-red-600 hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>CONTINUAR</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 leading-relaxed">
                      <p className="font-bold text-slate-900">Segundo Fator de Confirmação Obrigatório</p>
                      <p className="mt-1">
                        Para liberar a exclusão permanente dos dados, pedimos que digite exatamente o código gerado pelo sistema para o seu usuário:
                      </p>
                    </div>

                    <div className="p-4 bg-red-50 border border-red-150 rounded-xl flex flex-col items-center justify-center space-y-2">
                      <span className="text-[10px] text-red-500 font-extrabold tracking-wider uppercase">DIGITE A PALAVRA ABAIXO:</span>
                      <strong className="text-xl font-mono font-black text-red-700 tracking-widest bg-white outline-slate-200 outline-dashed px-5 py-2.5 rounded-lg select-all shadow-3xs uppercase">
                        {safetyWord}
                      </strong>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="delete-safety-word-input" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Campo de Confirmação Corretor
                      </label>
                      <input
                        id="delete-safety-word-input"
                        type="text"
                        placeholder="Digite aqui..."
                        value={enteredWord}
                        onChange={(e) => setEnteredWord(e.target.value)}
                        disabled={isDeleting}
                        className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-center text-xs font-mono font-bold uppercase text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all font-semibold"
                        autoFocus
                      />
                      {deleteError && (
                        <p className="text-[11px] text-red-600 font-extrabold flex items-center gap-1 mt-1 justify-center animate-shake">
                          <span>⚠️</span>
                          <span>{deleteError}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-150 text-[10px] text-slate-450 font-mono flex flex-col gap-0.5">
                    <span>Solicitante Responsável: <strong>{currentUser.nome}</strong></span>
                    <span>Cargo Autenticado: <strong>{currentUser.cargo.toUpperCase()}</strong></span>
                  </div>

                  <div className="flex gap-2.5 justify-end">
                    <button
                      onClick={() => setIsDeleteAllOpen(false)}
                      disabled={isDeleting}
                      className="px-4.5 py-3 text-slate-600 text-xs font-bold hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                    >
                      CANCELAR EXCLUSÃO
                    </button>
                    <button
                      onClick={handleExecuteDeleteAll}
                      disabled={isDeleting || !enteredWord.trim()}
                      className="px-5 py-3 bg-red-650 hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>DELETANDO...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          <span>EXCLUIR AGORA</span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
