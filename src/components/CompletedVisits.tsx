/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Search,
  Calendar,
  Layers,
  Phone,
  UserCheck,
  FileText,
  Trash2,
  Loader2
} from 'lucide-react';
import { Visit, User } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { normalizeTerritorioName, sanitizeInterviewerName, normalizeMotivo } from '../data';

interface CompletedVisitsProps {
  visits: Visit[];
  currentUser: User;
  onUpdateVisit: (id: string, updatedFields: Partial<Visit>) => void;
  onDeleteAllCompleted?: () => Promise<number>;
}

export default function CompletedVisits({ visits, currentUser, onUpdateVisit, onDeleteAllCompleted }: CompletedVisitsProps) {
  const [search, setSearch] = useState('');

  // Batch secure deletion state variables
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [safetyWord, setSafetyWord] = useState('');
  const [enteredWord, setEnteredWord] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

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
      if (onDeleteAllCompleted) {
        const countDeleted = await onDeleteAllCompleted();

        // Log the batch delete inside localStorage audit logs
        const newLog = {
          id: `DEL-CON-${Date.now().toString().slice(-6)}`,
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
      }
      setIsDeleteAllOpen(false);
    } catch (error) {
      alert(`Erro na exclusão em lote histórico: ${error}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtering completed lists
  const completedList = useMemo(() => {
    let list = visits.filter(
      (v) => v.status === 'Concluída' || v.status === 'FINALIZADA - NÃO LOCALIZADO'
    );
    if (currentUser.cargo !== 'gestor') {
      const userTerr = normalizeTerritorioName(currentUser.territorio || '');
      list = list.filter((v) => normalizeTerritorioName(v.territorio) === userTerr);
    }
    return list;
  }, [visits, currentUser]);

  const filteredList = useMemo(() => {
    return completedList.filter((v) =>
      v.nome.toLowerCase().includes(search.toLowerCase()) ||
      v.cpf.includes(search) ||
      v.id.toLowerCase().includes(search.toLowerCase()) ||
      v.endereco.toLowerCase().includes(search.toLowerCase())
    );
  }, [completedList, search]);

  const stats = useMemo(() => {
    const total = completedList.length;
    const sucesso = completedList.filter((v) => v.status === 'Concluída').length;
    const falhaMax = completedList.filter((v) => v.status === 'FINALIZADA - NÃO LOCALIZADO').length;
    return { total, sucesso, falhaMax };
  }, [completedList]);

  // Gestor rule: Reopent the visit
  const handleReopen = (id: string, name: string) => {
    if (currentUser.cargo !== 'gestor') {
      alert('Erro: Somente usuários de nível GESTOR podem reabrir visitas já encerradas.');
      return;
    }

    const confirm = window.confirm(
      `Deseja reabrir a visita de "${name}"? Ela será colocada de volta na lista de visitas pendentes.`
    );

    if (confirm) {
      onUpdateVisit(id, {
        status: 'Pendente',
        dataConclusao: undefined,
        cpfConclusao: undefined,
        observacoesConclusao: undefined
      });
      alert('Visita reaberta com sucesso!');
    }
  };

  return (
    <div className="space-y-6">
      {/* Intro section - Bento Styled */}
      <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2.5 tracking-tight">
            <CheckCircle className="w-6 h-6 text-emerald-500" />
            <span>Arquivo de Visitas Concluídas</span>
          </h2>
          <p className="text-xs md:text-sm text-slate-500 mt-1 font-medium">
            Aqui constam todos os atendimentos domiciliares concluídos, incluindo auditoria técnica e tentativas malsucedidas históricas.
          </p>
        </div>
        <div className="flex gap-2.5 font-mono text-xs bg-slate-50 p-3 rounded-xl border border-slate-200 shadow-3xs shrink-0">
          <span className="text-emerald-700 font-extrabold">✔️ Realizadas: <strong className="font-mono text-slate-900">{stats.sucesso}</strong></span>
          <span className="text-slate-350 px-1">|</span>
          <span className="text-red-700 font-extrabold">⚠️ Não localizadas: <strong className="font-mono text-slate-900">{stats.falhaMax}</strong></span>
        </div>
      </div>

      {/* Mini search control & Gestor specific batch actions */}
      <div className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <span className="absolute left-3.5 top-3 text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Filtrar por nome, CPF ou identificador do cidadão..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-850 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-semibold"
          />
        </div>

        {currentUser.cargo === 'gestor' && (
          <button
            onClick={startDeleteAllFlow}
            className="bg-red-50 hover:bg-red-100 text-red-600 font-extrabold text-xs py-2.5 px-4 rounded-xl shadow-3xs transition-all flex items-center justify-center gap-2 cursor-pointer border border-red-200 shrink-0"
          >
            <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />
            <span>DELETAR COMPLETAMENTE O HISTÓRICO</span>
          </button>
        )}
      </div>

      {filteredList.length === 0 ? (
        <div className="bg-white p-16 text-center rounded-[2.5rem] border border-slate-200 shadow-sm">
          <Layers className="w-14 h-14 text-slate-300 mx-auto mb-4" />
          <p className="text-base font-extrabold text-slate-800">Nenhum registro encontrado</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto font-medium">
            Nenhuma visita domiciliar foi concluída com as características de busca atuais.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredList.map((v) => {
            const isSucesso = v.status === 'Concluída';
            return (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                key={v.id}
                className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-xs space-y-4 hover:shadow-md transition-all duration-300"
              >
                <div className="flex justify-between items-start gap-4 border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-[9px] font-mono font-bold text-slate-500 bg-slate-100/80 border border-slate-200 px-2 py-0.5 rounded-md">
                      ID: {v.id}
                    </span>
                    <h3 className="font-extrabold text-slate-900 mt-2 text-base tracking-tight">{v.nome}</h3>
                    <p className="text-[10px] text-slate-400 font-mono font-medium mt-0.5">CPF: {v.cpf}</p>
                  </div>

                  <div className="text-right shrink-0">
                    {isSucesso ? (
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 uppercase tracking-tight">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Concluída</span>
                      </span>
                    ) : (
                      <span className="bg-red-50 text-red-700 border border-red-200/60 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 uppercase tracking-tight">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Não Localizado</span>
                      </span>
                    )}
                    <span className="text-[9px] text-slate-450 font-mono font-semibold mt-1.5 block">Território: {v.territorio}</span>
                  </div>
                </div>

                {/* Details layout */}
                <div className="grid grid-cols-2 gap-3.5 text-xs text-slate-650 bg-slate-50 p-3.5 rounded-2xl border border-slate-150">
                  <div className="col-span-2">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block tracking-wider mb-0.5">Endereço</span>
                    <span className="font-semibold text-slate-800 text-[11px] line-clamp-1">
                      {v.endereco}, {v.numero} - {v.bairro}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold uppercase block tracking-wider mb-0.5">Motivo Reclamado</span>
                    <span className="font-bold text-slate-700 text-[11px]">{normalizeMotivo(v.motivo)}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold uppercase block tracking-wider mb-0.5">Total Tentativas</span>
                    <span className="font-bold text-slate-700 font-mono text-[11px]">
                      {v.tentativas.length === 0 ? 'Conclusão direta' : `${v.tentativas.length} tentativas`}
                    </span>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-slate-200/60 mt-1">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block tracking-wider mb-0.5">Feito por</span>
                    <span className="font-semibold text-slate-800 text-[11px]">
                      {sanitizeInterviewerName(v.nomeEntrevistador)} (em {v.dataConclusao || 'data não informada'})
                    </span>
                  </div>
                </div>

                {/* Auditing feedback */}
                {v.observacoesConclusao && (
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-150 text-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Notas do Encerramento:</span>
                    <p className="text-slate-600 italic">"{v.observacoesConclusao}"</p>
                  </div>
                )}

                {/* Historic attempts listed inside */}
                {v.tentativas.length > 0 && (
                  <details className="text-xs bg-red-50/25 border border-red-150 rounded-2xl p-3">
                    <summary className="font-bold text-red-800 cursor-pointer list-inside flex items-center gap-1.5 focus:outline-none">
                      Ver Histórico de Tentativas ({v.tentativas.length})
                    </summary>
                    <div className="space-y-2.5 mt-2.5 divide-y divide-red-100 pl-1">
                      {v.tentativas.map((att) => (
                        <div key={att.id} className="pt-2 text-[10px] space-y-1">
                          <p className="text-[10px] text-amber-700 font-bold font-mono flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{att.data} - {att.entrevistador}</span>
                          </p>
                          <p className="text-slate-650 font-semibold italic">"{att.observacoes}"</p>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {/* Reopen Action allowed only for supervisors */}
                {currentUser.cargo === 'gestor' && (
                  <div className="pt-2 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={() => handleReopen(v.id, v.nome)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-blue-500" />
                      <span>Reabrir Visita</span>
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* SECURE COMPLETED HISTORY BATCH DELETION MODAL */}
      <AnimatePresence>
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
                    Exclusão Crítica de Histórico
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
                      Você está prestes a apagar <strong>TODAS AS {completedList.length} VISITAS CONCLUÍDAS E ARQUIVADAS</strong> cadastradas no histórico municipal de Ipatinga.
                    </p>
                    <div className="bg-white/60 p-3 rounded-xl border border-red-150 text-[11px] font-medium space-y-1 text-slate-705">
                      <p>• Esta ação remove permanentemente o histórico social das visitas concluídas.</p>
                      <p>• Esta operação <strong>NÃO pode ser desfeita</strong> sob nenhuma hipótese.</p>
                      <p>• Afetará para sempre os relatórios consolidados, indicadores de visitas bem-sucedidas e gráficos.</p>
                    </div>
                    <p className="font-extrabold text-center pt-2">Deseja continuar para o segundo fator de segurança?</p>
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
                      disabled={completedList.length === 0}
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
                        Para liberar a exclusão permanente dos dados do histórico, digite exatamente o código gerado pelo sistema:
                      </p>
                    </div>

                    <div className="p-4 bg-red-50 border border-red-150 rounded-xl flex flex-col items-center justify-center space-y-2">
                      <span className="text-[10px] text-red-500 font-extrabold tracking-wider uppercase">DIGITE A PALAVRA ABAIXO:</span>
                      <strong className="text-xl font-mono font-black text-red-700 tracking-widest bg-white outline-slate-200 outline-dashed px-5 py-2.5 rounded-lg select-all shadow-3xs uppercase">
                        {safetyWord}
                      </strong>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="history-delete-safety-input" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Campo de Confirmação
                      </label>
                      <input
                        id="history-delete-safety-input"
                        type="text"
                        placeholder="Digite aqui em maiúsculas..."
                        value={enteredWord}
                        onChange={(e) => setEnteredWord(e.target.value)}
                        disabled={isDeleting}
                        className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-center text-xs font-mono font-bold uppercase text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all font-semibold"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault(); // Do not allow accidental submit on Enter
                          }
                        }}
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
                      disabled={isDeleting || enteredWord.trim().toUpperCase() !== safetyWord}
                      className="px-5 py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
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
