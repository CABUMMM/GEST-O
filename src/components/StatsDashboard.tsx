/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';
import { Visit, Territory, User } from '../types';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  Calendar,
  CheckCircle,
  AlertTriangle,
  Users,
  TrendingUp,
  MapPin,
  Clock,
  Compass
} from 'lucide-react';
import { motion } from 'motion/react';
import { normalizeTerritorioName } from '../data';

interface StatsDashboardProps {
  visits: Visit[];
  territories: Territory[];
  users: User[];
  currentUser: User;
  onSetTab: (tab: string) => void;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function StatsDashboard({ visits, territories, users, currentUser, onSetTab }: StatsDashboardProps) {
  // Filter active logs or records assigned to the interviewer if they are not gestor
  const filteredVisits = useMemo(() => {
    if (currentUser.cargo === 'gestor') return visits;
    const userTerr = normalizeTerritorioName(currentUser.territorio || '');
    return visits.filter((v) => normalizeTerritorioName(v.territorio) === userTerr);
  }, [visits, currentUser]);

  const stats = useMemo(() => {
    const total = filteredVisits.length;
    const pendentes = filteredVisits.filter((v) => v.status === 'Pendente').length;
    const concluidas = filteredVisits.filter((v) => v.status === 'Concluída').length;
    const naoLocalizados = filteredVisits.filter((v) => v.status === 'FINALIZADA - NÃO LOCALIZADO').length;

    // Attempts calculation
    let totalTentativas = 0;
    filteredVisits.forEach(v => {
      totalTentativas += v.tentativas.length;
    });

    const taxaConclusao = total > 0 ? Math.round(((concluidas + naoLocalizados) / total) * 100) : 0;
    const mediaTentativas = total > 0 ? (totalTentativas / total).toFixed(1) : '0';

    return {
      total,
      pendentes,
      concluidas,
      naoLocalizados,
      taxaConclusao,
      mediaTentativas,
      totalTentativas
    };
  }, [filteredVisits]);

  const isGestor = currentUser.cargo === 'gestor';

  // Chart 1: Visits by Territory or Bairro depending on user role
  const territoryChartData = useMemo(() => {
    if (isGestor) {
      return territories.map((t) => {
        const territoryVisits = filteredVisits.filter((v) => v.territorio === t.nome);
        return {
          name: t.nome,
          'Pendentes': territoryVisits.filter((v) => v.status === 'Pendente').length,
          'Concluídas': territoryVisits.filter((v) => v.status === 'Concluída').length,
          'Não Localizados': territoryVisits.filter((v) => v.status === 'FINALIZADA - NÃO LOCALIZADO').length,
        };
      });
    } else {
      // For interviewer, show active bairros within their own territory to keep context local
      const userTerrName = normalizeTerritorioName(currentUser.territorio || '');
      const matchedTerr = territories.find((t) => normalizeTerritorioName(t.nome) === userTerrName);
      if (!matchedTerr) return [];

      return matchedTerr.bairros.map((b) => {
        const bd = filteredVisits.filter((v) => v.bairro === b);
        return {
          name: b,
          'Pendentes': bd.filter((v) => v.status === 'Pendente').length,
          'Concluídas': bd.filter((v) => v.status === 'Concluída').length,
          'Não Localizados': bd.filter((v) => v.status === 'FINALIZADA - NÃO LOCALIZADO').length,
        };
      }).filter((item) => (item.Pendentes + item['Concluídas'] + item['Não Localizados']) > 0);
    }
  }, [filteredVisits, territories, isGestor, currentUser.territorio]);

  // Chart 2: Visits by Motive
  const motiveChartData = useMemo(() => {
    const motivesMap: Record<string, number> = {};
    filteredVisits.forEach((v) => {
      motivesMap[v.motivo] = (motivesMap[v.motivo] || 0) + 1;
    });

    return Object.keys(motivesMap).map((key) => ({
      name: key,
      value: motivesMap[key]
    }));
  }, [filteredVisits]);

  // Interviewer Activity Ranking (Only show self if interviewer)
  const interviewersActivity = useMemo(() => {
    let interviewerUsers = users.filter((u) => u.cargo === 'entrevistador');
    if (!isGestor) {
      interviewerUsers = interviewerUsers.filter((u) => u.id === currentUser.id);
    }
    const ranks = interviewerUsers.map((u) => {
      const userConcluded = visits.filter((v) => v.entrevistadorId === u.id && v.status === 'Concluída').length;
      const userPendentes = visits.filter((v) => v.entrevistadorId === u.id && v.status === 'Pendente').length;
      const userFailures = visits.filter((v) => v.entrevistadorId === u.id && v.status === 'FINALIZADA - NÃO LOCALIZADO').length;
      return {
        nome: u.nome,
        territorio: u.territorio,
        concluidas: userConcluded,
        pendentes: userPendentes,
        naoLocalizados: userFailures,
        total: userConcluded + userPendentes + userFailures
      };
    });
    return ranks.sort((a, b) => b.concluidas - a.concluidas);
  }, [visits, users, isGestor, currentUser.id]);

  // Bairros distribution ranking
  const neighborhoodData = useMemo(() => {
    const list: Record<string, { total: number; pendentes: number; concluidas: number }> = {};
    filteredVisits.forEach((v) => {
      if (!list[v.bairro]) {
        list[v.bairro] = { total: 0, pendentes: 0, concluidas: 0 };
      }
      list[v.bairro].total += 1;
      if (v.status === 'Pendente') {
        list[v.bairro].pendentes += 1;
      } else {
        list[v.bairro].concluidas += 1;
      }
    });

    return Object.entries(list)
      .map(([nome, val]) => ({ nome, ...val }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [filteredVisits]);

  // Get pending visits in danger/urgent levels for alarm panel
  const urgentVisits = useMemo(() => {
    const pendings = filteredVisits.filter((v) => v.status === 'Pendente' && v.dataLimite);
    
    const calculated = pendings.map((v) => {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const target = new Date(v.dataLimite);
      target.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return { ...v, diffDays };
    });

    // Sort: lowest remaining days first
    return calculated.sort((a, b) => a.diffDays - b.diffDays).slice(0, 5);
  }, [filteredVisits]);

  return (
    <div className="space-y-6">
      {/* Top Banner Contextual - Bento Styled */}
      <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Olá, {currentUser.nome}!</h2>
          <p className="text-xs md:text-sm text-slate-500 mt-1 font-medium">
            {isGestor 
              ? 'Acompanhe em tempo real o andamento e produtividade das visitas do Cadastro Único em Ipatinga/MG.'
              : `Acompanhe suas metas de visitas e andamento geral do ${currentUser.territorio}.`}
          </p>
        </div>
        <div className="flex gap-2.5 font-mono text-xs shrink-0">
          <span className="bg-blue-50 text-blue-700 px-3.5 py-2 rounded-xl border border-blue-150 font-bold uppercase tracking-wider shadow-2xs">
            {currentUser.cargo}
          </span>
          <span className="bg-slate-100 text-slate-700 px-3.5 py-2 rounded-xl border border-slate-200 font-bold shadow-2xs">
            {currentUser.territorio}
          </span>
        </div>
      </div>

      {/* Numerical Indicators Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* KPI 1: Total demandadas */}
        <motion.div
          whileHover={{ y: -3 }}
          className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-xs flex flex-col justify-between min-h-44 group hover:shadow-md transition-all duration-300"
        >
          <div className="flex items-center justify-between">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100/50">
              <Calendar className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-extrabold text-blue-600 bg-blue-100/70 border border-blue-200/50 px-2.5 py-1 rounded-lg uppercase tracking-wider">
              Cadastros
            </span>
          </div>
          <div className="mt-5">
            <span className="text-slate-500 text-xs font-bold uppercase tracking-widest block">Total de Solicitadas</span>
            <h2 className="text-3xl font-black text-slate-900 mt-1.5 font-mono tracking-tight">{stats.total}</h2>
            <span className="text-[10px] text-slate-400 block mt-1 font-medium italic">Visitas registradas no sistema</span>
          </div>
        </motion.div>

        {/* KPI 2: Pendentes */}
        <motion.div
          whileHover={{ y: -3 }}
          className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-xs flex flex-col justify-between min-h-44 group hover:shadow-md transition-all duration-300"
        >
          <div className="flex items-center justify-between">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100/50">
              <Clock className="w-6 h-6 animate-pulse" />
            </div>
            <span className="text-[10px] font-extrabold text-amber-600 bg-amber-100/70 border border-amber-200/50 px-2.5 py-1 rounded-lg uppercase tracking-wider">
              Em Aberto
            </span>
          </div>
          <div className="mt-5">
            <span className="text-slate-500 text-xs font-bold uppercase tracking-widest block">Visitas Pendentes</span>
            <h2 className="text-3xl font-black text-amber-600 mt-1.5 font-mono tracking-tight">{stats.pendentes}</h2>
            <span className="text-[10px] text-slate-400 block mt-1 font-medium italic">Distribuição ativa para equipes</span>
          </div>
        </motion.div>

        {/* KPI 3: Concluidas */}
        <motion.div
          whileHover={{ y: -3 }}
          className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-xs flex flex-col justify-between min-h-44 group hover:shadow-md transition-all duration-300"
        >
          <div className="flex items-center justify-between">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100/50" id="vis-concluidas-card">
              <CheckCircle className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-100/70 border border-emerald-200/50 px-2.5 py-1 rounded-lg uppercase tracking-wider">
              Resolvidas
            </span>
          </div>
          <div className="mt-5">
            <span className="text-slate-500 text-xs font-bold uppercase tracking-widest block">Visitas Concluídas</span>
            <h2 className="text-3xl font-black text-emerald-600 mt-1.5 font-mono tracking-tight">{stats.concluidas}</h2>
            <span className="text-[10px] text-emerald-550 block mt-1 font-semibold italic">Atualizações registradas</span>
          </div>
        </motion.div>

        {/* KPI 4: Nao localizadas */}
        <motion.div
          whileHover={{ y: -3 }}
          className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-xs flex flex-col justify-between min-h-44 group hover:shadow-md transition-all duration-300"
        >
          <div className="flex items-center justify-between">
            <div className="p-3 bg-red-50 text-red-600 rounded-2xl border border-red-100/50">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-extrabold text-red-600 bg-red-100/70 border border-red-200/50 px-2.5 py-1 rounded-lg uppercase tracking-wider">
              Limite Falhas
            </span>
          </div>
          <div className="mt-5">
            <span className="text-slate-500 text-xs font-bold uppercase tracking-widest block">Não Localizadas</span>
            <h2 className="text-3xl font-black text-red-650 mt-1.5 font-mono tracking-tight">{stats.naoLocalizados}</h2>
            <span className="text-[10px] text-slate-400 block mt-1 font-medium italic">Após 3 tentativas de campo</span>
          </div>
        </motion.div>
      </div>

      {/* Alarm Panel: Visitas que Exigem Atenção */}
      <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm" id="paineis-alerta-prazos">
        <div className="flex justify-between items-center mb-5 pb-2 border-b border-slate-100">
          <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-red-500 animate-pulse" />
            <span>Visitas que Exigem Atenção / Controle de Prazo</span>
          </h3>
          <span className="text-[10px] bg-red-50 text-red-700 px-2.5 py-1 rounded-full font-extrabold uppercase tracking-wider border border-red-150">
            {urgentVisits.length} Alertas Ativos
          </span>
        </div>
        
        {urgentVisits.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-400 italic">
            Nenhuma visita pendente exige atenção ou possui prazo expirando no momento. Muito bem!
          </div>
        ) : (
          <div className="space-y-3">
            {urgentVisits.map((v) => {
              // Determine visual traffic light color based on outstanding diffDays
              let priorityColor = "bg-emerald-50 text-emerald-700 border-emerald-200";
              let priorityLabel = "Tranquilo";
              
              if (v.diffDays < 0) {
                priorityColor = "bg-rose-50 text-rose-700 border-rose-200 font-extrabold animate-pulse";
                priorityLabel = `Vencido há ${Math.abs(v.diffDays)} dias!`;
              } else if (v.diffDays <= 5) {
                priorityColor = "bg-red-50 text-red-700 border-red-150 font-extrabold animate-pulse";
                priorityLabel = `Urgente: ${v.diffDays} dias`;
              } else if (v.diffDays <= 15) {
                priorityColor = "bg-amber-50 text-amber-700 border-amber-200 font-bold";
                priorityLabel = `Atenção: ${v.diffDays} dias`;
              } else {
                priorityColor = "bg-emerald-50 text-emerald-700 border-emerald-100 font-semibold";
                priorityLabel = `${v.diffDays} dias`;
              }

              return (
                <div key={v.id} className="flex flex-col sm:flex-row justify-between sm:items-center p-3.5 bg-slate-50 rounded-2xl border border-slate-150 gap-3 hover:border-slate-300 transition-all">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-[#0f172a] text-xs font-sans">{v.nome}</span>
                      <span className="text-[9px] bg-slate-200 text-slate-650 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">{v.id}</span>
                      <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200/50 px-2 py-0.5 rounded font-bold uppercase tracking-wider font-sans">{v.motivo}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{v.bairro} ({v.territorio}) • Prazo Limite: <strong className="font-mono text-slate-700 bg-slate-100 px-1 rounded">{v.dataLimite}</strong></span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto font-mono text-[10px]">
                    <span className="text-slate-400 font-bold">Prioridade:</span>
                    <span className={`px-2.5 py-1 rounded-xl border uppercase font-extrabold ${priorityColor}`}>
                      {priorityLabel}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Secondary Row: Wide Performance Bento Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Dark Ambient Glowing Bento Card */}
        <div className="bg-slate-900 border border-slate-800 text-white p-6 rounded-[2rem] shadow-lg flex flex-col justify-between min-h-44 relative overflow-hidden group">
          {/* Ambient Glowing Background */}
          <div className="absolute -right-6 -bottom-6 w-36 h-36 bg-blue-500/15 rounded-full blur-3xl pointer-events-none group-hover:scale-110 transition-transform duration-300"></div>
          
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-blue-400 bg-blue-900/40 border border-blue-800/50 px-2.5 py-1 rounded-lg uppercase tracking-widest">
              Produtividade Geral
            </span>
            <TrendingUp className="w-5 h-5 text-blue-400" />
          </div>
          <div className="mt-4 relative z-10">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Índice Geral de Resolução</span>
            <h2 className="text-4xl font-black text-white mt-1 font-mono">{stats.taxaConclusao}%</h2>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">Meta municipal regulada em 90%</p>
          </div>
        </div>

        {/* Medium Stat 2 */}
        <div className="bg-white border border-slate-200 p-6 rounded-[2rem] shadow-xs flex flex-col justify-between min-h-44 hover:shadow-md transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-150 px-2.5 py-1 rounded-lg uppercase tracking-widest">
              Esforço Médio
            </span>
            <Compass className="w-5 h-5 text-amber-500" />
          </div>
          <div className="mt-4">
            <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">Média de Tentativas</span>
            <h2 className="text-4xl font-black text-slate-900 mt-1 font-mono">{stats.mediaTentativas}</h2>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">Por agendamento de visita ativa</p>
          </div>
        </div>

        {/* Medium Stat 3 */}
        <div className="bg-white border border-slate-200 p-6 rounded-[2rem] shadow-xs flex flex-col justify-between min-h-44 hover:shadow-md transition-all duration-300 col-span-1 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-150 px-2.5 py-1 rounded-lg uppercase tracking-widest">
              Rastreamento de Campo
            </span>
            <MapPin className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="mt-4">
            <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">Total de Tentativas</span>
            <h2 className="text-4xl font-black text-slate-900 mt-1 font-mono">{stats.totalTentativas}</h2>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">Controle de eficácia operacional</p>
          </div>
        </div>

      </div>

      {/* Visual Charts Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Territories distribution bar chart */}
        <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300">
          <h3 className="text-base font-bold text-slate-900 mb-5 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-500" />
            <span className="font-extrabold tracking-tight">
              {isGestor ? 'Visitas Domiciliares por Território / CRAS' : `Visitas Domiciliares por Bairro - ${currentUser.territorio}`}
            </span>
          </h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={territoryChartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#64748b" style={{ fontSize: '11px', fontFamily: 'monospace' }} />
                <YAxis stroke="#64748b" style={{ fontSize: '11px' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', borderColor: '#f1f5f9', fontSize: '12px' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="Pendentes" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Concluídas" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Não Localizados" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Motives pie representation */}
        <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between">
          <h3 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-500" />
            <span className="font-extrabold tracking-tight">Demandas mais Solicitadas (BPC e Bolsa Família)</span>
          </h3>
          {motiveChartData.length === 0 ? (
            <div className="h-72 flex items-center justify-center text-xs text-slate-400 italic">
              Nenhuma visita cadastrada no sistema.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-6 items-center h-full">
              <div className="h-56 sm:col-span-3">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={motiveChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {motiveChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} Visitas`, 'Quantidade']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="sm:col-span-2 space-y-2">
                {motiveChartData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-2 text-xs">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-slate-600 line-clamp-1 flex-1 font-semibold">{entry.name}</span>
                    <span className="font-bold font-mono text-slate-800 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Grid: Team and Top Bairros - Bento Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Interviewers & Stats */}
        <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-5 pb-2 border-b border-slate-100">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-500" id="interviewer-prod-title" />
              <span>{isGestor ? 'Produtividade dos Entrevistadores' : 'Sua Produtividade Pessoal'}</span>
            </h3>
            {currentUser.cargo === 'gestor' && (
              <button
                onClick={() => onSetTab('gestao_usuarios')}
                id="view-users-management-btn"
                className="text-xs text-blue-600 hover:text-blue-700 font-extrabold cursor-pointer hover:underline transition-all"
              >
                Gerenciar Usuários
              </button>
            )}
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="min-w-full text-xs text-left text-slate-500">
              <thead className="bg-[#f8fafc]/80 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100">
                <tr>
                  <th className="py-3 px-3 rounded-l-lg">Entrevistador</th>
                  <th className="py-3 px-2">Território</th>
                  <th className="py-3 px-2 text-center text-emerald-600 font-bold">Resolvidas</th>
                  <th className="py-3 px-2 text-center text-amber-500 font-bold">Pendente</th>
                  <th className="py-3 px-2 text-center text-rose-500 font-bold flex-1">Outros/Falhas</th>
                  <th className="py-3 px-3 rounded-r-lg text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {interviewersActivity.map((it) => (
                  <tr key={it.nome} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-3 font-extrabold text-slate-900">{it.nome}</td>
                    <td className="py-3 px-2 text-slate-550 font-mono font-medium">{it.territorio}</td>
                    <td className="py-3 px-2 text-center font-extrabold text-emerald-600 font-mono">{it.concluidas}</td>
                    <td className="py-3 px-2 text-center font-extrabold text-amber-600 font-mono">{it.pendentes}</td>
                    <td className="py-3 px-2 text-center font-extrabold text-rose-500 font-mono">{it.naoLocalizados}</td>
                    <td className="py-3 px-3 text-right font-extrabold text-slate-800 font-mono">{it.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top 6 Bairros com maior demanda */}
        <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col">
          <div className="mb-5 pb-2 border-b border-slate-100">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-orange-500" />
              <span>{isGestor ? 'Áreas Críticas (Bairros com Mais Visitas)' : `Demandas por Bairro no ${currentUser.territorio}`}</span>
            </h3>
          </div>
          {neighborhoodData.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-400 italic">
              Sem dados territoriais registrados ainda.
            </div>
          ) : (
            <div className="space-y-4 flex-1 flex flex-col justify-center">
              {neighborhoodData.map((item, index) => {
                const totalMax = Math.max(...neighborhoodData.map(n => n.total));
                const percentage = totalMax > 0 ? (item.total / totalMax) * 100 : 0;
                return (
                  <div key={item.nome} className="text-xs">
                    <div className="flex justify-between font-bold text-slate-800 mb-1.5">
                      <span className="font-semibold text-slate-700">{index + 1}. {item.nome}</span>
                      <span className="font-mono text-slate-900">{item.total} visitas <span className="text-slate-400 font-normal">({item.pendentes} pend / {item.concluidas} conc)</span></span>
                    </div>
                    {/* Progress Bar styled with beautiful gradient */}
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-linear-to-r from-blue-500 to-indigo-500 transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
