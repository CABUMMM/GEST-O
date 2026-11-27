/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Lock, Landmark, UserCheck } from 'lucide-react';
import { User } from '../types';
import { motion } from 'motion/react';

interface LoginScreenProps {
  users: User[];
  onLoginSuccess: (user: User) => void;
}

export default function LoginScreen({ users, onLoginSuccess }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    // Find user (by username or CPF)
    const normalizedInput = username.trim().toLowerCase();
    const user = users.find(
      (u) =>
        u.username.toLowerCase() === normalizedInput ||
        u.cpf.replace(/[^\d]/g, '') === normalizedInput.replace(/[^\d]/g, '')
    );

    if (!user) {
      setError('Usuário ou CPF não encontrado no cadastro.');
      return;
    }

    if (user.status === 'bloqueado') {
      setError('Acesso bloqueado pelo gestor. Entre em contato com a supervisão.');
      return;
    }

    // Simple validation (password in our mock is 'admin' or '123')
    if (user.senha && user.senha !== password) {
      setError('Senha incorreta. Verifique as credenciais.');
      return;
    }

    onLoginSuccess(user);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Background blobs */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-100 rounded-full mix-blend-multiply filter blur-2xl opacity-50 -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald-50 rounded-full mix-blend-multiply filter blur-2xl opacity-60 translate-x-1/3 translate-y-1/3" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10">
        <div className="flex justify-center items-center gap-3">
          <div className="p-3 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-600/20">
            <Landmark className="w-8 h-8" id="logo-icon" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">VISITAS IPATINGA</h1>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Assistência Social - SUAS</p>
          </div>
        </div>
        <h2 className="mt-6 text-center text-2xl font-semibold tracking-tight text-slate-900">
          Controle de Visitas Domiciliares
        </h2>
        <p className="mt-1 text-center text-sm text-slate-500">
          Acesse para gerenciar beneficiários de programas governamentais
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white py-8 px-6 shadow-xl shadow-slate-200/50 rounded-2xl border border-slate-100"
        >
          <form className="space-y-5" onSubmit={handleLogin}>
            <div>
              <label htmlFor="username-input" className="block text-sm font-medium text-slate-700">
                Usuário ou CPF
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <UserCheck className="h-5 w-5" />
                </div>
                <input
                  id="username-input"
                  name="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all"
                  placeholder="Ex: gestor1 ou 111.111.111-11"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password-input" className="block text-sm font-medium text-slate-700">
                Senha
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  id="password-input"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all"
                  placeholder="Insera sua senha de acesso"
                />
              </div>
            </div>

            {error && (
              <div
                id="login-error-alert"
                className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex gap-2 items-center"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></span>
                <span>{error}</span>
              </div>
            )}

            <div>
              <button
                type="submit"
                id="login-submit-btn"
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-150 cursor-pointer"
              >
                Entrar no Sistema
              </button>
            </div>
          </form>
        </motion.div>
      </div>

      <div className="mt-8 text-center text-xs text-slate-400 z-10 font-mono">
        <p>Prefeitura Municipal de Ipatinga - MG</p>
        <p className="mt-1">Secretaria Municipal de Assistência Social</p>
      </div>
    </div>
  );
}
