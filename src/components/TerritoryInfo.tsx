/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Territory } from '../types';
import { MapPin, Shield, Building2, Layers } from 'lucide-react';
import { motion } from 'motion/react';

interface TerritoryInfoProps {
  territories: Territory[];
}

export default function TerritoryInfo({ territories }: TerritoryInfoProps) {
  return (
    <div className="space-y-6">
      {/* Intro banner - Bento Styled */}
      <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm">
        <h2 className="text-2xl font-black text-slate-950 flex items-center gap-2.5 tracking-tight">
          <Building2 className="w-6 h-6 text-blue-600 animate-pulse" />
          <span>Divisão Territorial Assistencial - Ipatinga / MG</span>
        </h2>
        <p className="text-xs md:text-sm text-slate-500 mt-1.5 font-medium">
          Cinco grandes territórios do Cadastro Único integrados aos centros oficiais de Referência de Assistência Social (CRAS) do município.
        </p>
      </div>

      {/* Grid of territories */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {territories.map((t) => (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            key={t.id}
            className="bg-white rounded-[2rem] border border-slate-200 shadow-xs p-6 space-y-5 hover:shadow-md transition-all duration-300 flex flex-col justify-between"
          >
            <div className="space-y-4">
              {/* Title card header */}
              <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                <div className="space-y-1">
                  <span className="text-[9px] font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200">
                    ID: {t.id}
                  </span>
                  <h3 className="font-extrabold text-slate-900 text-base tracking-tight mt-1.5">{t.nome}</h3>
                  <p className="text-[11px] text-slate-500 font-bold flex items-center gap-1 mt-0.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>{t.cras}</span>
                  </p>
                </div>
                <Building2 className="w-5 h-5 text-slate-350 shrink-0" />
              </div>



              {/* Cataloged Bairros tags */}
              <div className="space-y-2.5">
                <span className="text-[10px] font-bold text-slate-450 uppercase tracking-widest block flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-slate-400" />
                  <span>Bairros Circunvizinhos ({t.bairros.length})</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {t.bairros.map((b) => (
                    <span
                      key={b}
                      className="bg-slate-50 text-slate-700 font-bold border border-slate-150 px-2.5 py-1 rounded-lg text-[10px]"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
