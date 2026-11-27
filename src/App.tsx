/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import {
  Landmark,
  LayoutDashboard,
  PlusCircle,
  Clock,
  CheckSquare,
  BarChart3,
  Users2,
  MapPin,
  LogOut,
  Menu,
  X,
  UserCheck,
  Bell,
  HelpCircle,
  Building2,
  Upload,
  Activity
} from 'lucide-react';
import { User, Visit, Territory } from './types';
import { initLocalStorageStore, IPATINGA_TERRITORIES, sanitizeInterviewerName, normalizeMotivo } from './data';
import LoginScreen from './components/LoginScreen';
import StatsDashboard from './components/StatsDashboard';
import VisitForm from './components/VisitForm';
import VisitList from './components/VisitList';
import CompletedVisits from './components/CompletedVisits';
import ReportsPanel from './components/ReportsPanel';
import UsersManagement from './components/UsersManagement';
import TerritoryInfo from './components/TerritoryInfo';
import ImportVisits from './components/ImportVisits';
import NetworkDiagnostics from './components/NetworkDiagnostics';

// Firebase Firestore Imports
import { collection, getDocs, setDoc, doc, deleteDoc } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from './firebase';

function cleanUndefined(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(cleanUndefined);
  }
  const cleaned: any = {};
  for (const key of Object.keys(obj)) {
    if (obj[key] !== undefined) {
      cleaned[key] = cleanUndefined(obj[key]);
    }
  }
  return cleaned;
}

export default function App() {
  // Session logs states
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [territories] = useState<Territory[]>(IPATINGA_TERRITORIES);

  // Tab indicator
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Mobile menu visibility
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Load and seed storage datasets on component render
  useEffect(() => {
    initLocalStorageStore();

    // 1. Initial Local State Fallback
    const storedUsers = localStorage.getItem('visitas_users');
    const storedVisits = localStorage.getItem('visitas_records');

    if (storedUsers) {
      setUsers(JSON.parse(storedUsers));
    }
    if (storedVisits) {
      try {
        const parsed = JSON.parse(storedVisits) as Visit[];
        const sanitized = parsed.map(v => ({
          ...v,
          nomeEntrevistador: sanitizeInterviewerName(v.nomeEntrevistador),
          motivo: normalizeMotivo(v.motivo) as any
        }));
        setVisits(sanitized);
      } catch (err) {
        setVisits(JSON.parse(storedVisits));
      }
    }

    // Retain logged session if exists
    const storedSession = localStorage.getItem('visitas_session');
    if (storedSession) {
      const parsedSession = JSON.parse(storedSession) as User;
      const userList = storedUsers ? (JSON.parse(storedUsers) as User[]) : [];
      const verify = userList.find(u => u.id === parsedSession.id);
      if (verify && verify.status === 'ativo') {
        setCurrentUser(verify);
      } else {
        localStorage.removeItem('visitas_session');
      }
    }

    // 2. Load and Sync from Firestore (If connected)
    const syncWithFirestore = async () => {
      try {
        // Load users from Firestore
        const usersSnap = await getDocs(collection(db, 'users'));
        let firestoreUsers: User[] = [];
        usersSnap.forEach((doc) => {
          firestoreUsers.push(doc.data() as User);
        });

        // Seed default admin in Firestore if user table is empty
        if (firestoreUsers.length === 0) {
          const defaultAdmin: User = {
            id: 'U1',
            username: 'gestor1',
            nome: 'Regina Santos Moura',
            cpf: '111.111.155-11',
            cargo: 'gestor',
            territorio: 'Território I',
            status: 'ativo',
            senha: 'admin'
          };
          await setDoc(doc(db, 'users', defaultAdmin.id), cleanUndefined(defaultAdmin));
          firestoreUsers = [defaultAdmin];
        }

        setUsers(firestoreUsers);
        localStorage.setItem('visitas_users', JSON.stringify(firestoreUsers));

        // Load visits from Firestore
        const visitsSnap = await getDocs(collection(db, 'visits'));
        const firestoreVisits: Visit[] = [];
        visitsSnap.forEach((doc) => {
          const v = doc.data() as Visit;
          v.nomeEntrevistador = sanitizeInterviewerName(v.nomeEntrevistador);
          v.motivo = normalizeMotivo(v.motivo) as any;
          firestoreVisits.push(v);
        });

        // Sort visits by query timestamp desc
        firestoreVisits.sort((a, b) => b.dataSolicitacao.localeCompare(a.dataSolicitacao));

        setVisits(firestoreVisits);
        localStorage.setItem('visitas_records', JSON.stringify(firestoreVisits));

        // Re-verify session
        if (storedSession) {
          const parsedSession = JSON.parse(storedSession) as User;
          const verify = firestoreUsers.find(u => u.id === parsedSession.id);
          if (verify && verify.status === 'ativo') {
            setCurrentUser(verify);
          } else {
            setCurrentUser(null);
            localStorage.removeItem('visitas_session');
          }
        }
      } catch (err) {
        console.warn("Firestore offline or configuration pending. Using local storage fallback.", err);
      }
    };

    syncWithFirestore();
  }, []);

  // Sync users database helper
  const saveUsersToStorage = (updatedUsers: User[]) => {
    setUsers(updatedUsers);
    localStorage.setItem('visitas_users', JSON.stringify(updatedUsers));
  };

  // Sync visits database helper
  const saveVisitsToStorage = (updatedVisits: Visit[]) => {
    setVisits(updatedVisits);
    localStorage.setItem('visitas_records', JSON.stringify(updatedVisits));
  };

  // Login handler
  const handleLogin = (loggedUser: User) => {
    setCurrentUser(loggedUser);
    localStorage.setItem('visitas_session', JSON.stringify(loggedUser));
    setActiveTab('dashboard');
  };

  // Logout handler
  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('visitas_session');
    setIsMobileMenuOpen(false);
  };

  // Visit CRUD mechanics
  const handleAddVisit = async (newVisitFields: Omit<Visit, 'id' | 'tentativas' | 'status'>) => {
    const nextIdNum = visits.length > 0 
      ? Math.max(...visits.map(v => parseInt(v.id.split('-')[1]) || 1000)) + 1 
      : 1001;
    
    const newVisit: Visit = {
      ...newVisitFields,
      nomeEntrevistador: sanitizeInterviewerName(newVisitFields.nomeEntrevistador),
      motivo: normalizeMotivo(newVisitFields.motivo) as any,
      id: `VIS-${nextIdNum}`,
      tentativas: [],
      status: 'Pendente'
    };

    const nextVisits = [newVisit, ...visits];
    saveVisitsToStorage(nextVisits);

    try {
      await setDoc(doc(db, 'visits', newVisit.id), cleanUndefined(newVisit));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `visits/${newVisit.id}`);
    }
  };

  const handleImportVisits = async (newVisits: Visit[]) => {
    const sanitized = newVisits.map((v) => ({
      ...v,
      nomeEntrevistador: sanitizeInterviewerName(v.nomeEntrevistador),
      motivo: normalizeMotivo(v.motivo) as any,
    }));
    const nextVisits = [...sanitized, ...visits];
    saveVisitsToStorage(nextVisits);

    try {
      for (const visit of sanitized) {
        setDoc(doc(db, 'visits', visit.id), cleanUndefined(visit)).catch((err) => {
          handleFirestoreError(err, OperationType.WRITE, `visits/${visit.id}`);
        });
      }
    } catch (err) {
      console.error("Error setting documents sequentially in firebase", err);
    }
  };

  const handleUpdateVisit = async (id: string, updatedFields: Partial<Visit>) => {
    const nextVisits = visits.map((v) => {
      if (v.id === id) {
        const fieldsToUpdate = { ...updatedFields };
        if (fieldsToUpdate.nomeEntrevistador !== undefined) {
          fieldsToUpdate.nomeEntrevistador = sanitizeInterviewerName(fieldsToUpdate.nomeEntrevistador);
        }
        if (fieldsToUpdate.motivo !== undefined) {
          fieldsToUpdate.motivo = normalizeMotivo(fieldsToUpdate.motivo) as any;
        }
        const updatedDoc = { ...v, ...fieldsToUpdate };
        setDoc(doc(db, 'visits', id), cleanUndefined(updatedDoc)).catch((err) => {
          handleFirestoreError(err, OperationType.WRITE, `visits/${id}`);
        });
        return updatedDoc;
      }
      return v;
    });
    saveVisitsToStorage(nextVisits);
  };

  const handleDeleteVisit = async (id: string) => {
    const nextVisits = visits.filter((v) => v.id !== id);
    saveVisitsToStorage(nextVisits);

    try {
      await deleteDoc(doc(db, 'visits', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `visits/${id}`);
    }
  };

  const handleDeleteAllPendingVisits = async (): Promise<number> => {
    if (!currentUser || currentUser.cargo !== 'gestor') {
      alert('ERRO 403: Apenas coordenadores gestores municipais têm autorização para esta operação.');
      throw new Error('403 Unauthorized');
    }

    const pendingVisits = visits.filter(v => v.status === 'Pendente');
    const totalPendingCount = pendingVisits.length;

    if (totalPendingCount === 0) {
      return 0;
    }

    const remainingVisits = visits.filter(v => v.status !== 'Pendente');
    saveVisitsToStorage(remainingVisits);

    const deletePromises = pendingVisits.map(v => 
      deleteDoc(doc(db, 'visits', v.id)).catch(err => {
        console.error(`Erro ao remover documento ${v.id}`, err);
      })
    );
    await Promise.all(deletePromises);

    return totalPendingCount;
  };

  const handleDeleteAllCompletedVisits = async (): Promise<number> => {
    if (!currentUser || currentUser.cargo !== 'gestor') {
      alert('ERRO 403: Apenas coordenadores gestores municipais têm autorização para esta operação.');
      throw new Error('403 Unauthorized');
    }

    const completedVisits = visits.filter(
      (v) => v.status === 'Concluída' || v.status === 'FINALIZADA - NÃO LOCALIZADO'
    );
    const totalCompletedCount = completedVisits.length;

    if (totalCompletedCount === 0) {
      return 0;
    }

    const remainingVisits = visits.filter(
      (v) => v.status !== 'Concluída' && v.status !== 'FINALIZADA - NÃO LOCALIZADO'
    );
    saveVisitsToStorage(remainingVisits);

    const deletePromises = completedVisits.map((v) =>
      deleteDoc(doc(db, 'visits', v.id)).catch((err) => {
        console.error(`Erro ao remover documento ${v.id}`, err);
      })
    );
    await Promise.all(deletePromises);

    return totalCompletedCount;
  };

  // Users CRUD mechanics (Gestor only)
  const handleAddUser = async (newFields: Omit<User, 'id'>) => {
    const generatedId = `U_${Date.now().toString().slice(-6)}`;
    const newUser: User = {
      ...newFields,
      id: generatedId
    };
    const nextUsers = [...users, newUser];
    saveUsersToStorage(nextUsers);

    try {
      await setDoc(doc(db, 'users', newUser.id), cleanUndefined(newUser));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${newUser.id}`);
    }
  };

  const handleUpdateUser = async (id: string, updatedFields: Partial<User>) => {
    const nextUsers = users.map((u) => {
      if (u.id === id) {
        const updatedDoc = { ...u, ...updatedFields };
        setDoc(doc(db, 'users', id), cleanUndefined(updatedDoc)).catch((err) => {
          handleFirestoreError(err, OperationType.WRITE, `users/${id}`);
        });
        return updatedDoc;
      }
      return u;
    });
    saveUsersToStorage(nextUsers);

    // If edited user is currently logged in, sync their local session metadata immediately
    if (currentUser && currentUser.id === id) {
      const updatedSess = { ...currentUser, ...updatedFields };
      if (updatedSess.status === 'bloqueado') {
        handleLogout();
      } else {
        setCurrentUser(updatedSess);
        localStorage.setItem('visitas_session', JSON.stringify(updatedSess));
      }
    }
  };

  // Notifications or active logs calculators
  const statsCounts = {
    pendentes: visits.filter((v) => v.status === 'Pendente').length,
    concluidas: visits.filter((v) => v.status === 'Concluída').length,
    falhas: visits.filter((v) => v.status === 'FINALIZADA - NÃO LOCALIZADO').length
  };

  // Check router matching menu depending on the user cargos
  const isGestor = currentUser?.cargo === 'gestor';
  
  const operationalItems = [
    { id: 'dashboard', label: isGestor ? 'Painel Geral' : 'Meu Painel', icon: LayoutDashboard },
    { id: 'adicionar_visita', label: 'Lançar Visita', icon: PlusCircle },
    { id: 'ver_visitas', label: isGestor ? 'Monitorar Visitas' : 'Minhas Visitas', badge: statsCounts.pendentes, icon: Clock },
    { id: 'visitas_concluidas', label: isGestor ? 'Concluídas/Histórico' : 'Visitas Concluídas', icon: CheckSquare }
  ];

  const adminItems = [
    { id: 'relatorios', label: 'Relatórios Sociais', icon: BarChart3 },
    { id: 'gestao_usuarios', label: 'Controle de Equipes', icon: Users2 },
    { id: 'gestao_territorios', label: 'Territórios Ipatinga', icon: MapPin },
    { id: 'importar_dados', label: 'Importar Visitas', icon: Upload },
    { id: 'diagnostico_rede', label: 'Diagnóstico de Rede', icon: Activity }
  ];

  // User auth loading verification screen
  if (!currentUser) {
    return <LoginScreen users={users} onLoginSuccess={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-800">
      
      {/* MOBILE HEADER BAR (visible only on mobile) */}
      <header className="md:hidden bg-white border-b border-slate-200 py-3 px-4 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-600 rounded-lg text-white">
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 tracking-tight leading-none">CadÚnico Ipatinga</h1>
            <span className="text-[9px] text-blue-600 font-bold uppercase tracking-wider">Assistência Social</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            id="mobile-drawer-toggle"
            className="p-2 text-slate-600 hover:text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-100 rounded-lg cursor-pointer"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* FIXED SIDEBAR CANVAS (Desktop fixed, Mobile floating drawer) */}
      <aside
        className={`fixed md:sticky md:top-0 top-[52px] md:h-screen h-[calc(100vh-52px)] bg-slate-900 text-slate-300 w-80 md:w-72 max-w-full z-40 shrink-0 border-r border-slate-800 transition-transform duration-250 ease-in-out flex flex-col justify-between ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-5 flex flex-col gap-6">
          {/* Logo Brand Header */}
          <div className="hidden md:flex items-center gap-3 border-b border-slate-800 pb-5">
            <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-md shadow-blue-500/10">
              <Landmark className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight leading-none">Prefeitura Ipatinga</h1>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 block">CadÚnico & SUAS</span>
            </div>
          </div>

          {/* Current login card profile metadata detailing responsibilities */}
          <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-800 flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600/20 text-blue-400 rounded-lg flex items-center justify-center font-bold text-sm shrink-0">
              {currentUser.nome.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold text-white truncate">{currentUser.nome}</h4>
              <p className="text-[10px] text-slate-400 font-mono line-clamp-1">{currentUser.territorio}</p>
            </div>
          </div>

          {/* Navigation link elements with beautiful role categories */}
          <div className="space-y-4">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2 px-1">
                Área Operacional
              </span>
              <nav className="space-y-1">
                {operationalItems.map((item) => {
                  const IconComp = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      id={`nav-tab-${item.id}`}
                      onClick={() => {
                        setActiveTab(item.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all duration-150 cursor-pointer whitespace-nowrap flex-nowrap ${
                        isActive
                          ? 'bg-blue-600 text-white font-bold'
                          : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <IconComp className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="bg-amber-500/15 text-amber-500 font-extrabold px-2 py-0.5 rounded-full font-mono text-[10px] shrink-0 ml-1.5">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {isGestor && (
              <div className="pt-3 border-t border-slate-800">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2 px-1">
                  Gestão Municipal
                </span>
                <nav className="space-y-1">
                  {adminItems.map((item) => {
                    const IconComp = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        id={`nav-tab-${item.id}`}
                        onClick={() => {
                          setActiveTab(item.id);
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all duration-150 cursor-pointer whitespace-nowrap flex-nowrap ${
                          isActive
                            ? 'bg-blue-600 text-white font-bold'
                            : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <IconComp className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                          <span className="truncate">{item.label}</span>
                        </div>
                      </button>
                    );
                  })}
                </nav>
              </div>
            )}
          </div>
        </div>

        {/* Footer sign out controllers */}
        <div className="p-5 border-t border-slate-800 space-y-3">
          <div className="text-[10px] text-slate-500 font-mono text-center md:text-left">
            <p className="font-semibold text-slate-400">Cidade Solidária</p>
            <p className="mt-0.5 text-[9px]">Ipatinga - Minas Gerais</p>
          </div>
          
          <button
            onClick={handleLogout}
            id="nav-logout-btn"
            className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl text-xs font-semibold uppercase tracking-wider cursor-pointer border border-red-500/25 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Encerrar Sessão</span>
          </button>
        </div>
      </aside>

      {/* CONTENT CANVAS AREA */}
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
        <div className="space-y-6">
          
          {/* RENDER CURRENT VIEW */}
          {activeTab === 'dashboard' && (
            <StatsDashboard
              visits={visits}
              territories={territories}
              users={users}
              currentUser={currentUser}
              onSetTab={setActiveTab}
            />
          )}

          {activeTab === 'adicionar_visita' && (
            <VisitForm
              currentUser={currentUser}
              territories={territories}
              onAddVisit={handleAddVisit}
              onSetTab={setActiveTab}
            />
          )}

          {activeTab === 'ver_visitas' && (
            <VisitList
              visits={visits}
              currentUser={currentUser}
              onUpdateVisit={handleUpdateVisit}
              onDeleteVisit={currentUser.cargo === 'gestor' ? handleDeleteVisit : undefined}
              onDeleteAllPending={currentUser.cargo === 'gestor' ? handleDeleteAllPendingVisits : undefined}
              onSetTab={setActiveTab}
            />
          )}

          {activeTab === 'visitas_concluidas' && (
            <CompletedVisits
              visits={visits}
              currentUser={currentUser}
              onUpdateVisit={handleUpdateVisit}
              onDeleteAllCompleted={currentUser.cargo === 'gestor' ? handleDeleteAllCompletedVisits : undefined}
            />
          )}

          {currentUser.cargo === 'gestor' && activeTab === 'relatorios' && (
            <ReportsPanel
              visits={visits}
              territories={territories}
              users={users}
              currentUser={currentUser}
            />
          )}

          {currentUser.cargo === 'gestor' && activeTab === 'gestao_usuarios' && (
            <UsersManagement
              users={users}
              territories={territories}
              onAddUser={handleAddUser}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleUpdateUser ? (id) => handleUpdateUser(id, { status: 'bloqueado' }) : undefined}
            />
          )}

          {currentUser.cargo === 'gestor' && activeTab === 'gestao_territorios' && (
            <TerritoryInfo territories={territories} />
          )}

          {currentUser.cargo === 'gestor' && activeTab === 'importar_dados' && (
            <ImportVisits
              onImportVisits={handleImportVisits}
              existingVisits={visits}
              currentUser={currentUser}
            />
          )}

          {currentUser.cargo === 'gestor' && activeTab === 'diagnostico_rede' && (
            <NetworkDiagnostics />
          )}

        </div>
      </main>
    </div>
  );
}
