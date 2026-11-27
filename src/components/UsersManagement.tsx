/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Users,
  Plus,
  Edit2,
  Lock,
  Unlock,
  Shield,
  Briefcase,
  Layers,
  CheckCircle,
  AlertCircle,
  X,
  UserCheck
} from 'lucide-react';
import { User, Territory } from '../types';
import { formatCPF, validateCPF } from '../data';
import { motion, AnimatePresence } from 'motion/react';

interface UsersManagementProps {
  users: User[];
  territories: Territory[];
  onAddUser: (user: Omit<User, 'id'>) => void;
  onUpdateUser: (id: string, updatedFields: Partial<User>) => void;
  onDeleteUser?: (id: string) => void;
}

export default function UsersManagement({ users, territories, onAddUser, onUpdateUser, onDeleteUser }: UsersManagementProps) {
  // Modal visibility state
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Form input states
  const [nome, setNome] = useState('');
  const [username, setUsername] = useState('');
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [cargo, setCargo] = useState<'gestor' | 'entrevistador'>('entrevistador');
  const [territorio, setTerritorio] = useState<any>('Território I');
  const [status, setStatus] = useState<'ativo' | 'bloqueado'>('ativo');

  // Input validation feedbacks
  const [cpfError, setCpfError] = useState(false);

  // Open modal for creation
  const handleOpenCreateModal = () => {
    setEditingUser(null);
    setNome('');
    setUsername('');
    setCpf('');
    setSenha('');
    setCargo('entrevistador');
    setTerritorio('Território I');
    setStatus('ativo');
    setCpfError(false);
    setShowModal(true);
  };

  // Open modal for edit
  const handleOpenEditModal = (u: User) => {
    setEditingUser(u);
    setNome(u.nome);
    setUsername(u.username);
    setCpf(u.cpf);
    setSenha(u.senha || '123');
    setCargo(u.cargo);
    setTerritorio(u.cargo === 'gestor' ? 'Nenhum' : (u.territorio || 'Território I'));
    setStatus(u.status);
    setCpfError(false);
    setShowModal(true);
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

  // Submit trigger
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!nome.trim() || !username.trim() || !cpf || !senha.trim()) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    const cleanCpf = cpf.replace(/[^\d]/g, '');
    if (cleanCpf.length === 11 && !validateCPF(cleanCpf)) {
      alert('O CPF digitado é inválido. Por favor, verifique para evitar erros.');
      return;
    }

    const finalTerritorio = cargo === 'gestor' ? 'Nenhum' : (territorio || 'Território I');

    if (editingUser) {
      // Update
      onUpdateUser(editingUser.id, {
        nome: nome.trim(),
        username: username.trim().toLowerCase(),
        cpf,
        senha: senha.trim(),
        cargo,
        territorio: finalTerritorio,
        status
      });
      alert('Usuário atualizado com sucesso!');
    } else {
      // Create
      onAddUser({
        nome: nome.trim(),
        username: username.trim().toLowerCase(),
        cpf,
        senha: senha.trim(),
        cargo,
        territorio: finalTerritorio,
        status
      });
      alert('Novo usuário credenciado com sucesso no banco de dados!');
    }

    setShowModal(false);
  };

  // Handle locking/unlocking user
  const handleToggleStatus = (u: User) => {
    const newStatus = u.status === 'ativo' ? 'bloqueado' : 'ativo';
    const actionLabel = newStatus === 'ativo' ? 'DESBLOQUEAR' : 'BLOQUEAR';
    
    const confirm = window.confirm(`Tem certeza de que deseja ${actionLabel} o acesso do entrevistador "${u.nome}"?`);
    if (confirm) {
      onUpdateUser(u.id, { status: newStatus });
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            <span>Gestão de Usuários e Operadores</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Controle de permissões, liberação de senhas e bloqueio de entrevistadores no CADÚNICO de Ipatinga.
          </p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          id="add-new-user-modal-btn"
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2.5 px-4 rounded-xl shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Operador</span>
        </button>
      </div>

      {/* Grid listing all operators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {users.map((u) => {
          const isActive = u.status === 'ativo';
          const isGestor = u.cargo === 'gestor';
          return (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              key={u.id}
              className={`bg-white rounded-2xl border ${isActive ? 'border-slate-100' : 'border-red-100 bg-red-50/10'} shadow-sm p-5 space-y-4`}
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 ${isGestor ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'} rounded-xl`}>
                    <UserCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm line-clamp-1">{u.nome}</h3>
                    <p className="text-[10px] font-mono text-slate-400">CPF: {u.cpf}</p>
                  </div>
                </div>

                <div>
                  {isActive ? (
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-bold px-2 py-0.5 rounded-lg uppercase">
                      Ativo
                    </span>
                  ) : (
                    <span className="bg-red-50 text-red-700 border border-red-100 text-[10px] font-bold px-2 py-0.5 rounded-lg uppercase">
                      Bloqueado
                    </span>
                  )}
                </div>
              </div>

              {/* Data descriptors */}
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 font-medium">
                <div>
                  <span className="text-[9px] text-slate-400 font-semibold uppercase block">Cargo</span>
                  <span className={`font-semibold ${isGestor ? 'text-indigo-600' : 'text-slate-700'} uppercase text-[10px]`}>
                    {u.cargo}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-semibold uppercase block">Território</span>
                  <span className="text-slate-700 font-mono text-[10px]">
                    {isGestor ? 'Acesso Global' : u.territorio}
                  </span>
                </div>
                <div className="col-span-2 pt-1 border-t border-slate-100 mt-1">
                  <span className="text-[9px] text-slate-400 font-semibold uppercase block">Acesso (Login/Senha)</span>
                  <span className="text-slate-800 font-mono text-[10px]">
                    login: <strong className="text-slate-900">{u.username}</strong> / senha: <strong>{u.senha || '•••'}</strong>
                  </span>
                </div>
              </div>

              {/* Action row controls */}
              <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
                <button
                  onClick={() => handleToggleStatus(u)}
                  className={`p-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${isActive ? 'bg-red-50 hover:bg-red-100 text-red-600 border-red-100' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border-emerald-100'} transition-colors`}
                  title={isActive ? 'Bloquear Usuário' : 'Desbloquear Usuário'}
                >
                  {isActive ? (
                    <div className="flex items-center gap-1 px-1">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Bloquear</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 px-1">
                      <Unlock className="w-3.5 h-3.5" />
                      <span>Liberar</span>
                    </div>
                  )}
                </button>

                <button
                  onClick={() => handleOpenEditModal(u)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 p-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  title="Editar Credenciais"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Editar</span>
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* POPUP MODAL FOR USER EDITING & CREATING */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full p-6 text-slate-800 space-y-4 font-sans"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h3 className="text-base font-extrabold text-slate-900">
                  {editingUser ? 'Atualizar Dados do Operador' : 'Cadastrar Novo Operador no SUAS'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="user-form-nome" className="block text-xs font-semibold text-slate-500 mb-1 uppercase">
                    Nome Completo do Funcionário *
                  </label>
                  <input
                    id="user-form-nome"
                    type="text"
                    required
                    placeholder="Ex: Ana Carla Nogueira"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="user-form-username" className="block text-xs font-semibold text-slate-500 mb-1 uppercase">
                      Usuário de Login *
                    </label>
                    <input
                      id="user-form-username"
                      type="text"
                      required
                      placeholder="Ex: ananog"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="user-form-senha" className="block text-xs font-semibold text-slate-500 mb-1 uppercase">
                      Senha Provisória *
                    </label>
                    <input
                      id="user-form-senha"
                      type="text"
                      required
                      placeholder="Ex: 123"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="user-form-cpf" className="block text-xs font-semibold text-slate-500 mb-1 uppercase">
                    CPF de Identificação *
                  </label>
                  <input
                    id="user-form-cpf"
                    type="text"
                    required
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={handleCpfChange}
                    className={`w-full bg-slate-50 border ${cpfError ? 'border-red-400 ring-1 ring-red-400' : 'border-slate-200'} p-2 rounded-xl text-xs text-slate-850 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono`}
                  />
                  {cpfError && (
                    <span className="text-[10px] text-red-500 font-semibold block mt-1" id="user-form-cpf-error">
                      ⚠️ CPF inválido ou inconsistente.
                    </span>
                  )}
                </div>

                <div className={`grid ${cargo === 'entrevistador' ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
                  <div>
                    <label htmlFor="user-form-cargo" className="block text-xs font-semibold text-slate-500 mb-1 uppercase">
                      Cargo / Nível
                    </label>
                    <select
                      id="user-form-cargo"
                      value={cargo}
                      onChange={(e) => setCargo(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-semibold"
                    >
                      <option value="entrevistador">Entrevistador</option>
                      <option value="gestor">Gestor Social</option>
                    </select>
                  </div>

                  {cargo === 'entrevistador' && (
                    <div>
                      <label htmlFor="user-form-territory" className="block text-xs font-semibold text-slate-500 mb-1 uppercase">
                        Território Padrão *
                      </label>
                      <select
                        id="user-form-territory"
                        value={territorio}
                        onChange={(e) => setTerritorio(e.target.value as any)}
                        className="w-full bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-semibold"
                        required
                      >
                        {territories.map((t) => (
                          <option key={t.id} value={t.nome}>
                            {t.nome} ({t.cras})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {editingUser && (
                  <div>
                    <label htmlFor="user-form-status" className="block text-xs font-semibold text-slate-500 mb-1 uppercase">
                      Status da Conta
                    </label>
                    <select
                      id="user-form-status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="ativo">Ativo (Permitido)</option>
                      <option value="bloqueado">Bloqueado (Negado)</option>
                    </select>
                  </div>
                )}

                {/* Submit controllers */}
                <div className="pt-4 flex gap-2 justify-end border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl"
                  >
                    Descartar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
                  >
                    {editingUser ? 'Atualizar Cadastro' : 'Confirmar Credenciamento'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
