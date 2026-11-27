/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  AlertTriangle, 
  FileText, 
  CheckCircle2, 
  ShieldAlert, 
  MapPin, 
  HelpCircle, 
  Trash2, 
  Clock, 
  User, 
  Sparkles, 
  Loader2,
  Calendar
} from 'lucide-react';
import { Visit, Attempt, User as AppUser } from '../types';
import { formatCPF, formatPhone, IPATINGA_TERRITORIES, sanitizeInterviewerName, normalizeMotivo } from '../data';

interface ImportLog {
  id: string;
  dataHora: string;
  responsavel: string;
  territorioId: string;
  territorioNome: string;
  totalAnalisados: number;
  totalImportados: number;
  totalIgnoradosDuplicidade: number;
  totalErrosBairro: number;
  telefonesNormalizadosCount: number;
  cpfsCorrigidosCount: number;
  naoLocalizadasCount: number;
}

interface ImportVisitsProps {
  onImportVisits: (newVisits: Visit[]) => void;
  existingVisits: Visit[];
  currentUser: AppUser | null;
}

export default function ImportVisits({ onImportVisits, existingVisits, currentUser }: ImportVisitsProps) {
  // Security validation (Only GESTOR can access: double check prop constraint)
  const isGestor = currentUser?.cargo === 'gestor';

  const [jsonText, setJsonText] = useState('');
  const [selectedTerritorioId, setSelectedTerritorioId] = useState('T1');
  const [status, setStatus] = useState<'idle' | 'success' | 'error' | 'pending'>('idle');
  const [msg, setMsg] = useState('');
  
  // Confirmation State
  const [showConfirm, setShowConfirm] = useState(false);
  const [parsedData, setParsedData] = useState<any[] | null>(null);

  // Advanced progress simulation
  const [progressPct, setProgressPct] = useState(0);
  const [currentImportStep, setCurrentImportStep] = useState('');

  // Detailed post-import report
  const [importReport, setImportReport] = useState<{
    totalAnalisados: number;
    totalImportados: number;
    totalIgnoradosDuplicidade: number;
    totalErrosBairro: number;
    telefonesNormalizadosCount: number;
    cpfsCorrigidosCount: number;
    naoLocalizadasCount: number;
  } | null>(null);

  // Persistent Import Logs List
  const [logs, setLogs] = useState<ImportLog[]>([]);

  // Load persistent import logs from localstorage on mount
  useEffect(() => {
    const savedLogs = localStorage.getItem('visitas_imports_audit_logs');
    if (savedLogs) {
      try {
        setLogs(JSON.parse(savedLogs));
      } catch (e) {
        console.error("Erro ao carregar log de auditoria", e);
      }
    }
  }, []);

  const saveAuditLog = (newLog: ImportLog) => {
    const updated = [newLog, ...logs];
    setLogs(updated);
    localStorage.setItem('visitas_imports_audit_logs', JSON.stringify(updated));
  };

  const clearAuditLogs = () => {
    if (window.confirm("Deseja realmente limpar todo o histórico de auditoria de importações?")) {
      setLogs([]);
      localStorage.removeItem('visitas_imports_audit_logs');
    }
  };

  if (!isGestor) {
    return (
      <div className="bg-white p-8 rounded-[2rem] border border-slate-200 text-center max-w-xl mx-auto space-y-4 my-8">
        <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto text-rose-500">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-black text-slate-950">Acesso Restrito</h3>
        <p className="text-xs text-slate-500 leading-relaxed font-semibold">
          Desculpe! A funcionalidade de Importação em Lote via JSON é de uso exclusivo da Coordenação Gestora Municipal do Cadastro Único e do SUAS.
        </p>
      </div>
    );
  }

  // Self-contained Unicode accent remover
  const removeAccents = (str: string): string => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };

  // Sane string formatting
  const cleanString = (val: any): string => {
    if (val === undefined || val === null) return '';
    return String(val)
      .replace(/\s+/g, ' ') // remove duplicate intermediate spaces
      .trim();
  };

  // Convert bad scientific floating notation or string to clean integer representation for CPF
  const cleanCPFValue = (val: any): string => {
    if (!val) return '';
    let strVal = String(val).trim().toUpperCase();
    
    // Excel standard float cleanup (e.g. 50139657649.0 -> 50139657649)
    if (strVal.endsWith('.0')) {
      strVal = strVal.substring(0, strVal.length - 2);
    }
    
    // Handle Exponential scientific notation (e.g. 1.2345e+11)
    if (strVal.includes('E+') || strVal.includes('E')) {
      const parsedNum = Number(strVal);
      if (!isNaN(parsedNum)) {
        strVal = parsedNum.toFixed(0);
      }
    }

    const cleanDigits = strVal.replace(/\D/g, '');
    return formatCPF(cleanDigits);
  };

  // Clean Telefones and normalize excel decimal fields (.0) or scientific notation
  const cleanPhoneValue = (val: any): string => {
    if (!val) return '';
    let strVal = String(val).trim().toUpperCase();

    // Excel standard float cleanup (e.g. 3199999999.0)
    if (strVal.endsWith('.0')) {
      strVal = strVal.substring(0, strVal.length - 2);
    }

    // Handle Exponential scientific notation (e.g. 3.19852E+10)
    if (strVal.includes('E+') || strVal.includes('E')) {
      const parsedNum = Number(strVal);
      if (!isNaN(parsedNum)) {
        strVal = parsedNum.toFixed(0);
      }
    }

    const cleanDigits = strVal.replace(/\D/g, '');
    return formatPhone(cleanDigits);
  };

  const cleanBairroValue = (val: any): string => {
    if (!val) return 'CENTRO';
    return cleanString(val).toUpperCase();
  };

  const cleanDateValue = (val: any): string => {
    if (!val) return '';
    let strVal = cleanString(val);
    if (strVal.endsWith('.0')) {
      strVal = strVal.substring(0, strVal.length - 2);
    }
    return strVal;
  };

  const fetchSelectedTerritorioDetails = () => {
    return IPATINGA_TERRITORIES.find(t => t.id === selectedTerritorioId) || IPATINGA_TERRITORIES[0];
  };

  // Anti-duplicity and rigorous validation pipeline
  const processImport = async (dataArray: any[]) => {
    setStatus('pending');
    setProgressPct(5);
    setCurrentImportStep('Iniciando conformidade e saneamento dos dados...');

    await new Promise(r => setTimeout(r, 600));

    try {
      const targetTerritorio = fetchSelectedTerritorioDetails();
      const targetTerritorioNome = targetTerritorio.nome;
      const allowedBairrosList = targetTerritorio.bairros;

      const importedList: Visit[] = [];
      let skippedDuplicidadeCount = 0;
      let erroBairroCount = 0;
      let telefonesNormalizadosCount = 0;
      let cpfsCorrigidosCount = 0;
      let naoLocalizadasCount = 0;

      // Hash comparison maps for extreme speed and strict duplicate checks in local scope
      const normalizeForDeepComparison = (str: string): string => {
        return removeAccents(str).replace(/[^A-Z0-9]/gi, '').toUpperCase();
      };

      dataArray.forEach((item, index) => {
        // Step progress updates
        if (index % 10 === 0) {
          const stepPct = Math.min(85, Math.ceil(5 + (index / dataArray.length) * 80));
          setProgressPct(stepPct);
          setCurrentImportStep(`Saneando registro ${index + 1} de ${dataArray.length}...`);
        }

        const nome = cleanString(item.NOME || item.Nome);
        const endereco = cleanString(item.ENDEREÇO || item.Endereco || item["ENDEREÇO"] || item["Endereco"]);
        
        // Advanced scientific and bad float clean for CPF
        const rawCPF = item.CPF || item.Cpf;
        const cpf = cleanCPFValue(rawCPF);
        if (rawCPF && (rawCPF !== cpf)) {
          cpfsCorrigidosCount++;
        }

        // Advanced phone scientific cleaning
        const rawTelefone = item.TELEFONE || item.Telefone;
        const telefone = cleanPhoneValue(rawTelefone);
        if (rawTelefone && (rawTelefone !== telefone)) {
          telefonesNormalizadosCount++;
        }

        const rawBairro = item.BAIRRO || item.Bairro;
        const bairro = cleanBairroValue(rawBairro);
        
        const rawMotivo = item.MOTIVO || item.Motivo || item.motivo || item.Motivo_da_Visita || '';
        const motivo = normalizeMotivo(rawMotivo) as any;

        const observacoes = cleanString(item["OBSERVAÇÕES"] || item.Observações || item.OBSERVACOES || item.observacoes);

        // DATA DA SOLICITAÇÃO -> Only import if exists
        const dataSolicitacaoRaw = item["DATA DA SOLICITAÇÃO"] || item["Data da Solicitação"] || item.dataSolicitacao;
        const dataSolicitacaoClean = cleanDateValue(dataSolicitacaoRaw);

        // DATA LIMITE DE ATUALIZAR -> Representing vencimento cadunico
        const dataLimiteRaw = item["DATA LIMITE DE ATUALIZAR"] || item["DATA LIMITE PARA ATUALIZAR"] || item["Data Limite de Atualizar"];
        const dataLimiteClean = cleanDateValue(dataLimiteRaw);

        const nTentativasRaw = item["N TENTATIVAS"] || item["N Tentativas"];
        const nTentativasClean = nTentativasRaw ? cleanString(nTentativasRaw) : undefined;

        const entrevistadorRaw = item.ENTREVISTADOR || item.Entrevistador;
        const entrevistadorClean = sanitizeInterviewerName(entrevistadorRaw);

        // Verification steps
        if (!nome || (nome.includes('RUA') && nome.length < 25 && !endereco)) {
          // Empty or broken row
          return;
        }

        // 1. Barrio mapping and validation against chosen territory
        const normParsedBairro = removeAccents(bairro).replace(/\s+/g, '').toUpperCase();
        const isBairroValid = allowedBairrosList.some(
          b => removeAccents(b).replace(/\s+/g, '').toUpperCase() === normParsedBairro
        );

        if (!isBairroValid) {
          erroBairroCount++;
          return; // Strictly ignore unmatched or incorrect territory bairros to keep db immaculate
        }

        // 2. Strict Anti-Duplicity Check (Keys: CPF / Combined Case-Insensitive Nome & Endereco)
        const deepCompNome = normalizeForDeepComparison(nome);
        const deepCompEndereco = normalizeForDeepComparison(endereco);
        const cleanDigitsCPF = cpf.replace(/\D/g, '');

        const isDuplicateWithDatabase = existingVisits.some(v => {
          const matchCPF = cleanDigitsCPF && (v.cpf.replace(/\D/g, '') === cleanDigitsCPF);
          const matchNomeEndereco = (normalizeForDeepComparison(v.nome) === deepCompNome) && 
                                     (normalizeForDeepComparison(v.endereco) === deepCompEndereco);
          return matchCPF || matchNomeEndereco;
        });

        const isDuplicateInBatch = importedList.some(v => {
          const matchCPF = cleanDigitsCPF && (v.cpf.replace(/\D/g, '') === cleanDigitsCPF);
          const matchNomeEndereco = (normalizeForDeepComparison(v.nome) === deepCompNome) && 
                                     (normalizeForDeepComparison(v.endereco) === deepCompEndereco);
          return matchCPF || matchNomeEndereco;
        });

        if (isDuplicateWithDatabase || isDuplicateInBatch) {
          skippedDuplicidadeCount++;
          return; // Skip duplicated entries immediately
        }

        // 3. Attempt extraction rules
        const dataVisitaField = cleanString(item["DATA DA VISITA"] || item["Data da Visita"]);
        let attemptsCount = 0;
        let attemptsList: Attempt[] = [];

        // Check text expressions of "X vez" indicating history attempts
        if (dataVisitaField.includes('1 VEZ') || dataVisitaField.includes('1T') || nTentativasClean?.includes('1')) {
          attemptsCount = 1;
        } else if (dataVisitaField.includes('2 VEZES') || dataVisitaField.includes('2T') || nTentativasClean?.includes('2')) {
          attemptsCount = 2;
        } else if (dataVisitaField.includes('3 VEZES') || dataVisitaField.includes('3T') || nTentativasClean?.includes('3')) {
          attemptsCount = 3;
        } else if (dataVisitaField.includes('4 VEZES') || dataVisitaField.includes('4T') || nTentativasClean?.includes('4')) {
          attemptsCount = 4;
        }

        for (let i = 1; i <= attemptsCount; i++) {
          attemptsList.push({
            id: `ATT-${Date.now()}-${index}-${i}`,
            data: dataSolicitacaoClean || new Date().toLocaleDateString('pt-BR'),
            entrevistador: entrevistadorClean || 'Responsável Importado',
            observacoes: `Arquivo de Importação: Tentativa nº ${i} recuperada da planilha.`
          });
        }

        // Marks automatically "NÃO LOCALIZADA" if 3 or more attempts are found
        let finalStatus: 'Pendente' | 'Concluída' | 'FINALIZADA - NÃO LOCALIZADO' = 'Pendente';
        if (attemptsCount >= 3) {
          finalStatus = 'FINALIZADA - NÃO LOCALIZADO';
          naoLocalizadasCount++;
        }

        // Construct pristine Visit model
        const visitRecord: Visit = {
          id: `VIS-${2000 + existingVisits.length + importedList.length + 1}`,
          nome,
          cpf,
          endereco: endereco || 'Não informado',
          numero: item.NUMERO || item.Numero || 'S/N',
          bairro,
          territorio: targetTerritorioNome, // Attached to chosen territory
          telefone,
          motivo: (motivo as any) || 'BOLSA FAMÍLIA ATUALIZAÇÃO',
          nomeEntrevistador: entrevistadorClean,
          entrevistadorId: '', // do not import fake entrevistador database users
          dataSolicitacao: dataSolicitacaoClean || new Date().toLocaleDateString('pt-BR'),
          dataLimite: dataLimiteClean || undefined,
          status: finalStatus,
          observacoes: observacoes || undefined,
          tentativas: attemptsList
        };

        importedList.push(visitRecord);
      });

      setProgressPct(95);
      setCurrentImportStep('Quase pronto! Gravando registros no banco de dados...');
      await new Promise(r => setTimeout(r, 500));

      if (importedList.length === 0) {
        setStatus('error');
        setMsg(`Processado completo. Nenhuma visita nova foi adicionada. ${skippedDuplicidadeCount} duplicadas foram ignoradas e ${erroBairroCount} registros continham bairros fora do plano do território.`);
        setImportReport(null);
      } else {
        // Callback parent to append inside Firestore & localStorage
        onImportVisits(importedList);

        // Build audit performance report
        const report = {
          totalAnalisados: dataArray.length,
          totalImportados: importedList.length,
          totalIgnoradosDuplicidade: skippedDuplicidadeCount,
          totalErrosBairro: erroBairroCount,
          telefonesNormalizadosCount,
          cpfsCorrigidosCount,
          naoLocalizadasCount
        };

        setImportReport(report);
        setStatus('success');
        setMsg(`Lote importado com sucesso! ${importedList.length} novos registros migrados para o ${targetTerritorioNome}.`);

        // Log audit persistence
        const auditLog: ImportLog = {
          id: `IMP-${Date.now().toString().slice(-6)}`,
          dataHora: new Date().toLocaleString('pt-BR'),
          responsavel: currentUser?.nome || 'Gestor Admin',
          territorioId: targetTerritorio.id,
          territorioNome: targetTerritorioNome,
          totalAnalisados: report.totalAnalisados,
          totalImportados: report.totalImportados,
          totalIgnoradosDuplicidade: report.totalIgnoradosDuplicidade,
          totalErrosBairro: report.totalErrosBairro,
          telefonesNormalizadosCount: report.telefonesNormalizadosCount,
          cpfsCorrigidosCount: report.cpfsCorrigidosCount,
          naoLocalizadasCount: report.naoLocalizadasCount
        };
        saveAuditLog(auditLog);

        setJsonText('');
      }
    } catch (e: any) {
      setStatus('error');
      setMsg(`Ocorreu um erro no processador de importação: ${e.message}`);
    }
  };

  const handleStartImportWorkflow = () => {
    try {
      const parsed = JSON.parse(jsonText);
      const dataArray = Array.isArray(parsed) ? parsed : [parsed];
      setParsedData(dataArray);
      setShowConfirm(true);
    } catch (e: any) {
      setStatus('error');
      setMsg(`Formato de estrutura JSON inválido: ${e.message}`);
    }
  };

  const confirmAndExecute = () => {
    setShowConfirm(false);
    if (parsedData) {
      processImport(parsedData);
    }
  };

  const cancelImport = () => {
    setShowConfirm(false);
    setParsedData(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-slate-900 text-white p-6 md:p-8 rounded-[2.5rem] shadow-sm relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-6 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl"></div>
        <div className="relative z-10">
          <h2 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-2">
            <Upload className="w-6 h-6 text-blue-400" />
            <span>Módulo de Importação SUAS/IPATINGA</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl font-medium leading-relaxed">
            Painel do Gestor para migração e lote de visitas socioassistenciais de Ipatinga/MG. Permite processamento, saneamento automático anti-duplicidade e estruturação de dados em tempo real.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Territory parameters and parameters check list */}
        <div className="lg:col-span-1 space-y-6">
          {/* Target Selector */}
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="w-5 h-5 text-blue-600" />
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Configuração do Lote
              </h3>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Território Destino (Obrigatório)
              </label>
              <select
                value={selectedTerritorioId}
                onChange={(e) => setSelectedTerritorioId(e.target.value)}
                className="w-full text-xs font-semibold p-3 outline-none border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500/20"
              >
                {IPATINGA_TERRITORIES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome} – {t.cras.replace(' - Cadastro Único', '')}
                  </option>
                ))}
              </select>
            </div>

            <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-150">
              <p className="text-[10px] text-blue-800 font-extrabold flex items-center gap-1.5 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Território Ativo</span>
              </p>
              <p className="text-xs font-black text-slate-900 mt-1">
                {fetchSelectedTerritorioDetails().nome}
              </p>
              <p className="text-[10px] text-slate-500 mt-1">
                Apenas visitas com bairros vinculados ao {fetchSelectedTerritorioDetails().cras} serão aceitas. Outros bairros serão rejeitados na validação municipal.
              </p>
            </div>
          </div>

          {/* Saneador Rules Panel */}
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-3.5">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>Verificação Automática</span>
            </h3>
            <ul className="space-y-2.5 text-[11px] text-slate-600 font-medium">
              <li className="flex gap-2">
                <span className="text-blue-500 font-bold shrink-0">✓</span>
                <span>Normaliza notação científica de CPF e telefones (.0 ou E+10)</span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-500 font-bold shrink-0">✓</span>
                <span>Remove acentuação e espaços duplicados de nomes</span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-500 font-bold shrink-0">✓</span>
                <span>Mapeia "1 vez" e "4 vezes" como históricos oficiais de tentativas</span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-500 font-bold shrink-0">✓</span>
                <span>Ignora registros cujo CPF ou Nome+Endereço coincida com o banco</span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-500 font-bold shrink-0">✓</span>
                <span>Permite Vencimento de CadÚnico em branco</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Input Text Area block */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col space-y-4">
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1">
                <FileText className="w-4.5 h-4.5 text-blue-500" />
                <span>Inserir Estrutura do Lote (JSON)</span>
              </label>
              <span className="text-[10px] text-slate-400">Cole a listagem de registros oriunda da planilha saneada em formato de array</span>
            </div>

            {status === 'pending' ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-4">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                <div className="text-center space-y-1">
                  <p className="text-xs font-extrabold text-slate-900">{currentImportStep}</p>
                  <p className="text-[10px] text-slate-400">Processamento em tempo real...</p>
                </div>
                <div className="w-64 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                  <div 
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            ) : (
              <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder='[ { "NOME": "JAQUELINE SILVESTRE DOS SANTOS", "CPF": "100.226.976-83", "BAIRRO": "VENEZA", "TELEFONE": "31999725040.0", "MOTIVO": "REQUERER BOLSA FAMÍLIA" } ]'
                className="w-full h-72 p-4 text-xs font-mono bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500/80 leading-relaxed"
              />
            )}

            {/* Inline Confirm Modal Section */}
            {showConfirm && parsedData && (
              <div className="p-5 bg-blue-50 border border-blue-200 rounded-2xl space-y-4 animate-fade-in">
                <div className="flex gap-2 text-blue-900">
                  <HelpCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-extrabold text-xs">Confirmar Alimentação do Lote</h5>
                    <p className="text-[11px] font-semibold mt-0.5">
                      Deseja realmente processar e importar estes <strong className="text-blue-700 font-bold">{parsedData.length} registros</strong> analisados diretamente para o <strong className="text-blue-700 font-bold">{fetchSelectedTerritorioDetails().nome} ({fetchSelectedTerritorioDetails().cras})</strong>?
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={cancelImport}
                    className="px-4 py-2 text-xs font-extrabold text-slate-600 hover:bg-slate-100/80 rounded-xl transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmAndExecute}
                    className="px-5 py-2 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all cursor-pointer"
                  >
                    Sim, Importar
                  </button>
                </div>
              </div>
            )}

            {/* Post Import Performance Report Panel */}
            {status === 'success' && importReport && (
              <div className="bg-emerald-50/50 p-6 rounded-2xl border border-emerald-150 space-y-4">
                <div className="flex items-center gap-2 text-emerald-800">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <h4 className="text-xs font-black uppercase tracking-wider">
                    Relatório Pós-Importação municipal
                  </h4>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                  <div className="p-3 bg-white rounded-xl border border-emerald-100 flex flex-col justify-between">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Processados</span>
                    <strong className="text-lg font-black text-slate-900 mt-1">{importReport.totalAnalisados}</strong>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-emerald-100 flex flex-col justify-between">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Importados</span>
                    <strong className="text-lg font-black text-emerald-600 mt-1">+{importReport.totalImportados}</strong>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-emerald-100 flex flex-col justify-between col-span-2 sm:col-span-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Ignorados (Duplicados)</span>
                    <strong className="text-lg font-black text-slate-500 mt-1">{importReport.totalIgnoradosDuplicidade}</strong>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-emerald-100 flex flex-col justify-between">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Erros de Bairro</span>
                    <strong className="text-lg font-black text-rose-500 mt-1">{importReport.totalErrosBairro}</strong>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-emerald-100 flex flex-col justify-between">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Fones Normalizados</span>
                    <strong className="text-lg font-black text-slate-650 mt-1">{importReport.telefonesNormalizadosCount}</strong>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-emerald-100 flex flex-col justify-between">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">CadÚnicos Vencendo</span>
                    <strong className="text-lg font-black text-amber-600 mt-1">{importReport.cpfsCorrigidosCount}</strong>
                  </div>
                </div>

                {importReport.naoLocalizadasCount > 0 && (
                  <div className="text-[10px] text-slate-500 font-bold bg-slate-100 p-2.5 rounded-lg border flex gap-1 items-center">
                    <span>⚠</span>
                    <span>{importReport.naoLocalizadasCount} visitas foram finalizadas automaticamente devido a 3 ou mais tentativas registradas na planilha original.</span>
                  </div>
                )}
              </div>
            )}

            {/* Simple Msg Status Alert */}
            {status !== 'idle' && status !== 'pending' && !importReport && (
              <div className={`p-4 rounded-xl border flex items-start gap-2.5 text-xs ${
                status === 'success' ? 'bg-emerald-50 text-emerald-850 border-emerald-150' : 'bg-rose-50 text-rose-850 border-rose-150'
              }`}>
                {status === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-extrabold">{status === 'success' ? 'Sucesso' : 'Falha na Conformidade'}</p>
                  <p className="mt-0.5 font-medium leading-relaxed">{msg}</p>
                </div>
              </div>
            )}

            {!showConfirm && status !== 'pending' && (
              <div className="flex justify-end pt-2">
                <button
                  onClick={handleStartImportWorkflow}
                  disabled={!jsonText.trim()}
                  className="py-3 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-extrabold uppercase text-xs tracking-wider rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Saneiar e Processar</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Persistence Audit log tables */}
      <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
        <div className="flex justify-between items-center pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-500" />
            <h3 className="text-sm font-extrabold text-slate-900 leading-snug">
              Histórico de Importações e Auditoria SUAS
            </h3>
          </div>
          {logs.length > 0 && (
            <button
              onClick={clearAuditLogs}
              className="text-[10px] text-rose-600 hover:text-rose-700 font-extrabold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpar Auditoria</span>
            </button>
          )}
        </div>

        {logs.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400 italic">
            Nenhum histórico de importação recente registrado neste computador. Importe seu primeiro lote para gerar os logs de auditoria municipal.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100">
                  <th className="py-2.5 px-3">Código</th>
                  <th className="py-2.5 px-3">Data / Hora</th>
                  <th className="py-2.5 px-3">Responsável</th>
                  <th className="py-2.5 px-3">Território Destino</th>
                  <th className="py-2.5 px-3 text-center text-emerald-600 font-extrabold">Importado</th>
                  <th className="py-2.5 px-3 text-center text-slate-500">Ignorado</th>
                  <th className="py-2.5 px-3 text-center text-rose-500">Erros (Bairro)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-3 font-mono text-[10px] text-slate-500">{log.id}</td>
                    <td className="py-3 px-3 text-slate-700">{log.dataHora}</td>
                    <td className="py-3 px-3 text-slate-900 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{log.responsavel}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700 font-semibold uppercase tracking-wider border border-blue-100">
                        {log.territorioNome}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center text-emerald-600 font-black">+{log.totalImportados}</td>
                    <td className="py-3 px-3 text-center text-slate-400">{log.totalIgnoradosDuplicidade}</td>
                    <td className="py-3 px-3 text-center text-rose-500">{log.totalErrosBairro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
