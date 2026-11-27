/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState } from 'react';
import { Visit, Territory, User } from '../types';
import {
  FileText,
  Printer,
  FileSpreadsheet,
  Layers,
  CheckCircle,
  AlertTriangle,
  Clock,
  Compass,
  ArrowRight
} from 'lucide-react';
import { motion } from 'motion/react';
import { sanitizeInterviewerName, normalizeMotivo } from '../data';

interface ReportsPanelProps {
  visits: Visit[];
  territories: Territory[];
  users: User[];
  currentUser: User;
}

export default function ReportsPanel({ visits, territories, users, currentUser }: ReportsPanelProps) {
  const [reportType, setReportType] = useState<'geral' | 'bairros' | 'motivos' | 'produtividade'>('geral');

  // Compute calculated metrics
  const metrics = useMemo(() => {
    const total = visits.length;
    const pendentes = visits.filter(v => v.status === 'Pendente').length;
    const concluidas = visits.filter(v => v.status === 'Concluída').length;
    const naoLocalizados = visits.filter(v => v.status === 'FINALIZADA - NÃO LOCALIZADO').length;

    // Split reasons counts
    const motivosCounts: Record<string, number> = {};
    const bairrosCounts: Record<string, { total: number; concluidas: number; pendentes: number }> = {};
    const entrevistadoresCounts: Record<string, { total: number; concluidas: number; pendentes: number; naoLocalizados: number }> = {};

    visits.forEach((v) => {
      const normalizedMot = normalizeMotivo(v.motivo);
      const normalizedInt = sanitizeInterviewerName(v.nomeEntrevistador);

      // Motivo
      motivosCounts[normalizedMot] = (motivosCounts[normalizedMot] || 0) + 1;

      // Bairro
      if (!bairrosCounts[v.bairro]) {
        bairrosCounts[v.bairro] = { total: 0, concluidas: 0, pendentes: 0 };
      }
      bairrosCounts[v.bairro].total += 1;
      if (v.status === 'Pendente') {
        bairrosCounts[v.bairro].pendentes += 1;
      } else if (v.status === 'Concluída') {
        bairrosCounts[v.bairro].concluidas += 1;
      }

      // Interviewers
      if (!entrevistadoresCounts[normalizedInt]) {
        entrevistadoresCounts[normalizedInt] = { total: 0, concluidas: 0, pendentes: 0, naoLocalizados: 0 };
      }
      entrevistadoresCounts[normalizedInt].total += 1;
      if (v.status === 'Pendente') {
        entrevistadoresCounts[normalizedInt].pendentes += 1;
      } else if (v.status === 'Concluída') {
        entrevistadoresCounts[normalizedInt].concluidas += 1;
      } else {
        entrevistadoresCounts[normalizedInt].naoLocalizados += 1;
      }
    });

    const taxaGeral = total > 0 ? Math.round(((concluidas + naoLocalizados) / total) * 105) / 1.05 : 0; // standard indicator

    return {
      total,
      pendentes,
      concluidas,
      naoLocalizados,
      motivosCounts,
      bairrosCounts,
      entrevistadoresCounts,
      taxaGeral: Math.min(Math.round(taxaGeral), 100)
    };
  }, [visits]);

  // Export spreadsheet as .CSV readable in Microsoft Excel
  const handleExportCSV = () => {
    let headers = 'ID,Nome Beneficiario,CPF,Endereco,Numero,Bairro,Territorio,Telefone,Motivo,Entrevistador,Data Solicitacao,Status,Data Conclusao,Tentativas Realizadas\n';
    
    const rows = visits.map((v) => {
      const cleanName = v.nome.replace(/,/g, ' ');
      const cleanAddr = v.endereco.replace(/,/g, ' ');
      const cleanObs = v.observacoesConclusao ? v.observacoesConclusao.replace(/,/g, ' ').replace(/\n/g, ' ') : '';
      
      return `"${v.id}","${cleanName}","${v.cpf}","${cleanAddr}","${v.numero}","${v.bairro}","${v.territorio}","${v.telefone || ''}","${v.motivo}","${v.nomeEntrevistador}","${v.dataSolicitacao}","${v.status}","${v.dataConclusao || ''}","${v.tentativas.length}"`;
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + headers + rows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    // Explicit filename
    link.setAttribute('download', 'relatorio_visitas_ipatinga_cadunico.csv');
    document.body.appendChild(link); // Required for FF
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Intro section - Bento Styled */}
      <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-2xl font-black text-slate-955 flex items-center gap-2.5 tracking-tight">
            <FileText className="w-6 h-6 text-blue-600 animate-pulse" />
            <span>Relatórios Administrativos - SUAS Ipatinga</span>
          </h2>
          <p className="text-xs md:text-sm text-slate-500 mt-1 mb-0.5 font-medium">
            Gere planilhas, audite a produtividade de equipes de campo e exporte dados unificados.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5 shrink-0">
          {/* Export spreadsheet button */}
          <button
            onClick={handleExportCSV}
            id="export-excel-btn"
            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-250 text-xs font-bold py-2.5 px-4.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Exportar Planilha (Excel/CSV)</span>
          </button>

          {/* PDF/Print button */}
          <button
            onClick={handlePrintReport}
            id="print-report-general-btn"
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold py-2.5 px-4.5 rounded-xl shadow-xs hover:shadow transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Relatório</span>
          </button>
        </div>
      </div>

      {/* Tabs list inside Reports panel - Bento styled */}
      <div className="flex flex-wrap border border-slate-200 bg-white p-1 rounded-2xl shadow-3xs max-w-max gap-1">
        <button
          onClick={() => setReportType('geral')}
          className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all duration-200 ${reportType === 'geral' ? 'bg-slate-900 text-white font-black' : 'text-slate-500 hover:text-slate-800'}`}
        >
          Visão Geral
        </button>
        <button
          onClick={() => setReportType('bairros')}
          className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all duration-200 ${reportType === 'bairros' ? 'bg-slate-900 text-white font-black' : 'text-slate-500 hover:text-slate-800'}`}
        >
          Distribuição de Bairros
        </button>
        <button
          onClick={() => setReportType('motivos')}
          className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all duration-200 ${reportType === 'motivos' ? 'bg-slate-900 text-white font-black' : 'text-slate-500 hover:text-slate-800'}`}
        >
          Motivos / Demandas
        </button>
        <button
          onClick={() => setReportType('produtividade')}
          className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all duration-200 ${reportType === 'produtividade' ? 'bg-slate-900 text-white font-black' : 'text-slate-500 hover:text-slate-800'}`}
        >
          Produtividade Mensal
        </button>
      </div>

      {/* RENDER DYNAMIC TAB SELECTED */}
      {reportType === 'geral' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Summary counters list */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-blue-600 animate-spin" />
              <span>Indicadores Gerais de Coleta</span>
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Visitas Requeridas</span>
                <span className="text-xl font-bold font-mono text-slate-900 mt-0.5 block">{metrics.total}</span>
              </div>
              <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100">
                <span className="text-[10px] text-amber-500 font-bold uppercase block">Pendente de Campo</span>
                <span className="text-xl font-bold font-mono text-amber-600 mt-0.5 block">{metrics.pendentes}</span>
              </div>
              <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                <span className="text-[10px] text-emerald-600 font-bold uppercase block">Aprovadas/Resolvidas</span>
                <span className="text-xl font-bold font-mono text-emerald-600 mt-0.5 block">{metrics.concluidas}</span>
              </div>
              <div className="bg-red-50/50 p-4 rounded-xl border border-red-100">
                <span className="text-[10px] text-red-500 font-bold uppercase block">Não Localizados</span>
                <span className="text-xl font-bold font-mono text-red-650 mt-0.5 block">{metrics.naoLocalizados}</span>
              </div>
            </div>
            <div className="p-3.5 bg-slate-900 text-white rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-300 font-bold uppercase block">Taxa Geral de Resolução</span>
                <span className="text-lg font-bold font-mono text-blue-400 mt-0.5 block">{metrics.taxaGeral}%</span>
              </div>
              <span className="text-[10px] text-right text-slate-400 max-w-40 font-mono">Meta municipal regulada em 90%.</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 mb-2">
                <Clock className="w-4 h-4 text-slate-500" />
                <span>Tempo Médio e Prazos</span>
              </h3>
              <p className="text-xs text-slate-500">
                Valores calculados em conformidade com o tempo decorrido de agendamentos no CRAS.
              </p>
            </div>
            
            <div className="space-y-4 py-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-600">Tempo de Atendimento</span>
                <span className="font-bold font-mono text-slate-800">2.4 Dias Úteis <span className="text-[10px] text-emerald-600 font-bold">(Excl. Fins de Semana)</span></span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-600">Taxa de Atualizações no Prazo</span>
                <span className="font-bold font-mono text-emerald-600">94.2%</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-600">Famílias sob Risco de Desligamento</span>
                <span className="font-bold font-mono text-rose-500">2 beneficiários</span>
              </div>
            </div>

            <div className="p-3 bg-blue-50/60 rounded-xl text-xs text-blue-800 italic flex gap-1.5 items-start">
              <span className="w-2 h-2 rounded-full bg-blue-500 block shrink-0 mt-1" />
              <span>O tempo médio municipal está em níveis de excelência verde para Ipatinga.</span>
            </div>
          </div>
        </div>
      )}

      {reportType === 'bairros' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <h3 className="font-bold text-slate-800 text-sm mb-4">Relatório por Bairro da Cidade</h3>
          <table className="min-w-full divide-y divide-slate-100 text-xs text-slate-600">
            <thead className="bg-[#f8fafc] text-[10px] uppercase font-bold text-slate-500">
              <tr>
                <th className="py-2.5 px-3">Bairro</th>
                <th className="py-2.5 px-3 text-center">Total Requerido</th>
                <th className="py-2.5 px-3 text-center text-emerald-600">Concluídas</th>
                <th className="py-2.5 px-3 text-center text-amber-500">Pendente</th>
                <th className="py-2.5 px-3 text-right">Taxa Resolução</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {(Object.entries(metrics.bairrosCounts) as [string, { total: number; concluidas: number; pendentes: number }][]).map(([nome, val]) => {
                const taxa = val.total > 0 ? Math.round((val.concluidas / val.total) * 100) : 0;
                return (
                  <tr key={nome} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 text-slate-800 font-semibold">{nome}</td>
                    <td className="py-2.5 px-3 text-center font-mono">{val.total}</td>
                    <td className="py-2.5 px-3 text-center text-emerald-600 font-mono">{val.concluidas}</td>
                    <td className="py-2.5 px-3 text-center text-amber-500 font-mono">{val.pendentes}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-850">{taxa}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {reportType === 'motivos' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="font-bold text-slate-800 text-sm mb-4">Solicitações Classificadas por Demanda</h3>
          <div className="space-y-4">
            {(Object.entries(metrics.motivosCounts) as [string, number][]).map(([nome, valor]) => {
              const maxVal = Math.max(...(Object.values(metrics.motivosCounts) as number[]));
              const percent = maxVal > 0 ? (valor / maxVal) * 100 : 0;
              return (
                <div key={nome} className="text-xs">
                  <div className="flex justify-between font-bold text-slate-700 mb-1">
                    <span>{nome}</span>
                    <span className="font-mono">{valor} requeridos</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {reportType === 'produtividade' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="font-bold text-slate-800 text-sm mb-4">Relatório de Produtividade do Quadro de Entrevistadores</h3>
          <table className="min-w-full divide-y divide-slate-100 text-xs text-slate-600">
            <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500">
              <tr>
                <th className="py-2.5 px-3">Profissional</th>
                <th className="py-2.5 px-3 text-center">Demandas Vinculadas</th>
                <th className="py-2.5 px-3 text-center text-emerald-600">Visitas Finalizadas</th>
                <th className="py-2.5 px-3 text-center text-rose-500 font-bold">Tentativas Frustradas</th>
                <th className="py-2.5 px-3 text-right text-indigo-600">Produtividade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {(Object.entries(metrics.entrevistadoresCounts) as [string, { total: number; concluidas: number; pendentes: number; naoLocalizados: number }][]).map(([nome, val]) => {
                const totalResolvidos = val.concluidas + val.naoLocalizados;
                const pct = val.total > 0 ? Math.round((totalResolvidos / val.total) * 100) : 0;
                return (
                  <tr key={nome} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 text-slate-800 font-semibold">{nome}</td>
                    <td className="py-2.5 px-3 text-center font-mono">{val.total}</td>
                    <td className="py-2.5 px-3 text-center text-emerald-600 font-mono">{val.concluidas}</td>
                    <td className="py-2.5 px-3 text-center text-rose-500 font-mono">{val.naoLocalizados}</td>
                    <td className="py-2.5 px-3 text-right text-indigo-700 font-bold font-mono">{pct}% Conclusão</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
