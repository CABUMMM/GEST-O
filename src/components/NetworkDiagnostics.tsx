import { useState, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  Activity,
  Database,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Clock,
  Shield,
  Layers,
  FileText
} from 'lucide-react';
import { motion } from 'motion/react';

interface EndpointStatus {
  name: string;
  url: string;
  category: string;
  status: 'online' | 'blocked' | 'checking';
  latency: number | null;
}

export default function NetworkDiagnostics() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [checking, setChecking] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'status' | 'logs'>('status');

  const [endpoints, setEndpoints] = useState<EndpointStatus[]>([
    {
      name: 'Hospedagem Netlify (Estático)',
      url: 'https://crasipatinga.netlify.app',
      category: 'Hospedagem Principal',
      status: 'checking',
      latency: null
    },
    {
      name: 'Banco Sincronizado Firestore',
      url: 'https://firestore.googleapis.com',
      category: 'Firebase Database',
      status: 'checking',
      latency: null
    },
    {
      name: 'Autenticação de Segurança',
      url: 'https://identitytoolkit.googleapis.com',
      category: 'Firebase Auth',
      status: 'checking',
      latency: null
    },
    {
      name: 'Tipografia & Fontes Google',
      url: 'https://fonts.googleapis.com',
      category: 'Assets Externos',
      status: 'checking',
      latency: null
    },
    {
      name: 'Rotas de Mapas OpenStreetMap',
      url: 'https://www.openstreetmap.org',
      category: 'Serviços de Terceiros',
      status: 'checking',
      latency: null
    }
  ]);

  // Read logs from global cache
  const loadLogs = () => {
    if (typeof window !== 'undefined') {
      const globalLogs = (window as any).__connection_logs || [];
      setLogs([...globalLogs]);
    }
  };

  const testEndpoints = async () => {
    setChecking(true);
    
    const results = await Promise.all(
      endpoints.map(async (ep) => {
        const start = performance.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2800); // 2.8s strict timeout
        
        try {
          // Use no-cors mode to prevent CORS blocking issues on standard tests
          await fetch(ep.url, {
            method: 'HEAD',
            mode: 'no-cors',
            signal: controller.signal,
            cache: 'no-store'
          });
          
          clearTimeout(timeoutId);
          const duration = Math.round(performance.now() - start);
          return {
            ...ep,
            status: 'online' as const,
            latency: duration
          };
        } catch (err: any) {
          clearTimeout(timeoutId);
          return {
            ...ep,
            status: 'blocked' as const,
            latency: null
          };
        }
      })
    );

    setEndpoints(results);
    setChecking(false);
    loadLogs();
  };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    testEndpoints();
    loadLogs();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const clearDiagnosticLogs = () => {
    if (typeof window !== 'undefined') {
      (window as any).__connection_logs = [];
      setLogs([]);
    }
  };

  const isFirebaseBlocked = endpoints.some(
    (e) => e.category.startsWith('Firebase') && e.status === 'blocked'
  );

  return (
    <div className="space-y-6">
      {/* Title block */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-[10px] text-blue-600 font-bold uppercase tracking-widest block mb-1">
            Gestor Admin Console
          </span>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600 animate-pulse" />
            Diagnóstico de Conexão & Rede
          </h2>
          <p className="text-slate-500 text-xs mt-1">
            Auditoria técnica em tempo real de latência, firewall e compatibilidade com redes institucionais (Prefeitura de Ipatinga).
          </p>
        </div>

        <button
          onClick={testEndpoints}
          disabled={checking}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-xs cursor-pointer select-none"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
          <span>{checking ? 'Testando Linhas...' : 'Recarregar Testes'}</span>
        </button>
      </div>

      {/* Network Alert Banners based on connection status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Status 1: Local vs Online */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-start gap-4">
          <div className={`p-3 rounded-xl ${isOnline ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            {isOnline ? <Wifi className="w-6 h-6" /> : <WifiOff className="w-6 h-6" />}
          </div>
          <div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Canal do Navegador</span>
            <h4 className="text-sm font-extrabold text-slate-900 mt-0.5">
              {isOnline ? 'Internet Conectada' : 'Sem Sinal de Internet'}
            </h4>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              Dispositivo {isOnline ? 'possui' : 'não possui'} conexão direta com a internet de forma geral.
            </p>
          </div>
        </div>

        {/* Status 2: Firebase Firewall Status */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-start gap-4">
          <div className={`p-3 rounded-xl ${isFirebaseBlocked ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
            <Database className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Servidor Firebase</span>
            <h4 className="text-sm font-extrabold text-slate-900 mt-0.5">
              {isFirebaseBlocked ? 'Restrito (Bloqueado)' : 'Disponível (Liberado)'}
            </h4>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              {isFirebaseBlocked
                ? 'Bloqueado pelo Firewall/Proxy municipal. O sistema ativou o Modo Local Resiliente automaticamente.'
                : 'Porta de comunicação aberta. Registro em nuvem ativo e operacional.'}
            </p>
          </div>
        </div>

        {/* Status 3: System Resiliency Active Mode */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-start gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Modo Operacional Ativo</span>
            <span className={`inline-block px-2 py-0.5 mt-1 rounded text-[10px] font-black uppercase text-white ${isFirebaseBlocked ? 'bg-amber-500' : 'bg-emerald-500'}`}>
              {isFirebaseBlocked ? 'Modo Local Estável' : 'Modo Nuvem Sincronizada'}
            </span>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              O sistema armazena dados em cache de estado progressivo (LocalStorage), garantindo zero perda e funcionamento 100% offline.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs list */}
      <div className="border-b border-slate-200 flex items-center gap-1">
        <button
          onClick={() => setActiveTab('status')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider relative cursor-pointer ${
            activeTab === 'status' ? 'text-blue-600 border-b-2 border-blue-650' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Endpoints & Latências
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider relative flex items-center gap-2 cursor-pointer ${
            activeTab === 'logs' ? 'text-blue-600 border-b-2 border-blue-650' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Logs de Sincronização</span>
          {logs.length > 0 && (
            <span className="bg-amber-500 text-white font-mono text-[9px] font-black px-1.5 py-0.5 rounded-full">
              {logs.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'status' ? (
        <div className="space-y-4">
          {/* Detailed Endpoints Grid */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="bg-slate-50/80 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">Linha de Comunicação / API Externa</span>
              <span className="text-[10px] font-mono text-slate-400">Verificação automática de barreira</span>
            </div>
            
            <div className="divide-y divide-slate-100">
              {endpoints.map((ep) => (
                <div key={ep.url} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50/40 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-slate-800">{ep.name}</span>
                      <span className="px-2 py-0.5 text-[9px] font-black bg-slate-100 text-slate-500 rounded uppercase font-mono">
                        {ep.category}
                      </span>
                    </div>
                    <p className="text-[11px] font-mono text-slate-400">{ep.url}</p>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    {ep.status === 'checking' && (
                      <div className="flex items-center gap-1.5 text-slate-400 text-xs font-bold">
                        <div className="w-2 h-2 rounded-full bg-slate-450 animate-ping"></div>
                        <span>Avaliando...</span>
                      </div>
                    )}
                    {ep.status === 'online' && (
                      <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold">
                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Estável</span>
                        <span className="font-mono text-[11px] text-slate-400 font-medium tracking-tight">
                          ({ep.latency}ms)
                        </span>
                      </div>
                    )}
                    {ep.status === 'blocked' && (
                      <div className="flex items-center gap-1.5 text-amber-600 text-xs font-extrabold bg-amber-50 px-2 py-1 rounded-xl border border-amber-200/50">
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                        <span>Restrito / Local</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Technical Info Box */}
          <div className="bg-slate-900 text-slate-300 p-5 rounded-2xl border border-slate-800 space-y-4">
            <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-400" />
              Por que este aplicativo funciona sem VPN em qualquer rede?
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs leading-relaxed text-slate-400 font-medium">
              <div className="space-y-2">
                <p>
                  <strong className="text-white">1. Arquitetura SPA Offline Estática:</strong><br />
                  Todo o core da aplicação é carregado e interpretado diretamente no navegador do computador. Não há necessidade de túneis WebSockets ou scripts dinâmicos de sandbox.
                </p>
                <p>
                  <strong className="text-white">2. LocalStorage Caching Progressivo:</strong><br />
                  Qualquer cadastro, edição ou conclusão é salvo primeiro no banco de dados local do seu navegador. O aplicativo é 100% autônomo.
                </p>
              </div>
              <div className="space-y-2">
                <p>
                  <strong className="text-white">3. Tolerância a Bloqueios de Rede:</strong><br />
                  Se a internet municipal bloquear os servidores do Firebase, o aplicativo continua rodando liso, sem travar nem congelar a tela. Ele descarta erros de conexões falhas de modo inteligente.
                </p>
                <p>
                  <strong className="text-white">4. Importação e Exportação por Planilhas:</strong><br />
                  Mesmo em computadores antigos e sem internet, você pode importar listas inteiras por JSON/Excel e fazer as impressões PDF localmente em papel ou relatórios com precisão absoluta.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="px-4 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h4 className="text-xs font-extrabold text-slate-800">Histórico de Erros e Eventos Coletados</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Rastreador de requisições que caíram para o Modo de Segurança nos Filtros e Ações.</p>
              </div>
              
              {logs.length > 0 && (
                <button
                  onClick={clearDiagnosticLogs}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 hover:text-slate-800 text-slate-600 transition-colors font-bold text-[10px] uppercase rounded-lg cursor-pointer"
                >
                  Limpar Logs
                </button>
              )}
            </div>

            {logs.length === 0 ? (
              <div className="p-8 text-center space-y-2 text-slate-400">
                <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-medium">Nenhuma falha de carregamento detectada ou reportada.</p>
                <p className="text-[10px] text-slate-400">O sistema está operando com estabilidade e ótima resiliência.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
                {logs.map((log, index) => (
                  <div key={index} className="p-4 flex items-start gap-3 hover:bg-slate-50/40 transition-all font-mono">
                    <span className="text-[10px] font-bold text-slate-400 shrink-0 mt-0.5">
                      {log.timestamp}
                    </span>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 text-[9px] font-black bg-amber-50 text-amber-700 border border-amber-200/50 rounded uppercase">
                          {log.type}
                        </span>
                        <span className="text-slate-600 font-bold">
                          Op: {log.operationType}
                        </span>
                        <span className="text-slate-450 text-[10px]">
                          Caminho: {log.path}
                        </span>
                      </div>
                      <p className="text-[11px] font-sans text-slate-500 font-medium py-1 px-2 border-l-2 border-slate-300 bg-slate-50 rounded">
                        {log.message}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
