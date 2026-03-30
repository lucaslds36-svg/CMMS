import React, { useState } from 'react';
import { Search, Filter, Plus, Pencil, X } from 'lucide-react';
import { cn } from '../lib/utils';
import type { Asset } from '../types';

export const AssetList = ({ assets, onAdd, onEdit, onDelete }: { assets: Asset[], onAdd: () => void, onEdit: (asset: Asset) => void, onDelete: (id: string) => void }) => {
  const [search, setSearch] = useState('');
  
  const filteredAssets = assets.filter(a => 
    (a.Tag || '').toLowerCase().includes(search.toLowerCase()) || 
    (a.Model || '').toLowerCase().includes(search.toLowerCase()) ||
    (a.Description || '').toLowerCase().includes(search.toLowerCase()) ||
    (a.Location || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <h3 className="text-lg font-semibold text-slate-900">Inventário de Ativos</h3>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="relative flex-1 sm:flex-none">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar ativos..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button className="flex-1 sm:flex-none p-2 bg-slate-50 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors flex items-center justify-center">
              <Filter className="w-4 h-4" />
            </button>
            <button 
              onClick={onAdd}
              className="flex-[3] sm:flex-none flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Ativo</span>
            </button>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50/50">
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">TAG</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Modelo</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Descrição</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Localização</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Planta</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredAssets.map((asset, i) => (
              <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4 text-sm font-medium text-slate-900">{asset.Tag}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{asset.Model}</td>
                <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">{asset.Description}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{asset.Location}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{asset.Plant}</td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium",
                    asset.Status === 'Ativo' ? "bg-emerald-50 text-emerald-700" : 
                    asset.Status === 'Inativo' ? "bg-rose-50 text-rose-700" :
                    asset.Status === 'Em Manutenção' ? "bg-amber-50 text-amber-700" :
                    "bg-slate-50 text-slate-700"
                  )}>
                    {asset.Status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={() => onEdit(asset)}
                      className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                      title="Editar Ativo"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => onDelete(asset.ID)}
                      className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                      title="Excluir Ativo"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
