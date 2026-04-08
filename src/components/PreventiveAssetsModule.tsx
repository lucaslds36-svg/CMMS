import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Building2,
  Tag,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { PreventivePlan, Asset } from '../types';
import { format, isAfter, isBefore, addDays, parseISO } from 'date-fns';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface PreventiveAssetsModuleProps {
  plans: PreventivePlan[];
  assets: Asset[];
}

export const PreventiveAssetsModule: React.FC<PreventiveAssetsModuleProps> = ({ plans, assets }) => {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'overdue' | 'upcoming'>('all');

  // Debounce search input
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const getAssetStatus = (nextDate: string) => {
    if (!nextDate) return 'upcoming';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    try {
      const next = parseISO(nextDate);
      if (isNaN(next.getTime())) return 'upcoming';
      
      const nextTime = next.getTime();
      const todayTime = today.getTime();

      if (nextTime < todayTime) return 'overdue';
      
      // Check if it's today without using format()
      const isToday = next.getFullYear() === today.getFullYear() &&
                      next.getMonth() === today.getMonth() &&
                      next.getDate() === today.getDate();
      
      if (isToday) return 'today';
    } catch (e) {
      return 'upcoming';
    }
    return 'upcoming';
  };

  const allAssetsByPlan = useMemo(() => {
    // Create a map for O(1) asset lookup
    const assetMap = new Map(assets.map(a => [a.ID, a]));

    return plans.flatMap(plan => {
      let planAssets = plan.assets || [];
      
      if (planAssets.length === 0 && plan.AssetIDs && plan.AssetIDs.length > 0) {
        planAssets = plan.AssetIDs.map(id => ({
          assetId: id,
          nextDate: plan.AssetNextDues?.[id] || plan.NextDue || '',
          lastDate: plan.AssetLastDones?.[id] || plan.LastDone || null
        }));
      }

      return planAssets.map(pa => {
        const asset = assetMap.get(pa.assetId);
        return {
          planId: plan.ID,
          planTask: plan.Task,
          assetId: pa.assetId,
          assetTag: asset?.Tag || pa.assetId,
          assetDescription: asset?.Description || 'Sem descrição',
          assetModel: asset?.Model || 'N/A',
          assetLocation: asset?.Location || 'N/A',
          lastDate: pa.lastDate,
          nextDate: pa.nextDate,
          status: getAssetStatus(pa.nextDate)
        };
      });
    });
  }, [plans, assets]);

  const filteredData = useMemo(() => {
    const searchTerm = debouncedSearch.toLowerCase();
    return allAssetsByPlan.filter(item => {
      const matchesSearch = searchTerm === '' ||
        item.assetTag.toLowerCase().includes(searchTerm) ||
        item.assetDescription.toLowerCase().includes(searchTerm) ||
        item.planTask.toLowerCase().includes(searchTerm) ||
        item.assetModel.toLowerCase().includes(searchTerm);
      
      const matchesStatus = 
        filterStatus === 'all' || 
        (filterStatus === 'overdue' && item.status === 'overdue') ||
        (filterStatus === 'upcoming' && (item.status === 'upcoming' || item.status === 'today'));

      return matchesSearch && matchesStatus;
    }).sort((a, b) => a.assetDescription.localeCompare(b.assetDescription));
  }, [allAssetsByPlan, debouncedSearch, filterStatus]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Equipamentos por Plano</h3>
          <p className="text-sm text-slate-500">Acompanhamento de datas de manutenção por ativo</p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar ativo ou plano..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 w-full sm:w-64 shadow-sm"
            />
          </div>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as any)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
          >
            <option value="all">Todos Status</option>
            <option value="overdue">Atrasados</option>
            <option value="upcoming">Próximos</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredData.map((item, idx) => (
            <motion.div
              key={`${item.planId}-${item.assetId}-${idx}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    item.status === 'overdue' ? "bg-rose-50 text-rose-600" : 
                    item.status === 'today' ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"
                  )}>
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm line-clamp-1">{item.assetDescription}</h4>
                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{item.assetTag} • {item.assetModel}</p>
                  </div>
                </div>
                <div className={cn(
                  "px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                  item.status === 'overdue' ? "bg-rose-100 text-rose-700" : 
                  item.status === 'today' ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                )}>
                  {item.status === 'overdue' ? 'Atrasado' : item.status === 'today' ? 'Hoje' : 'Em Dia'}
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Plano de Manutenção</p>
                  <p className="text-xs font-semibold text-slate-700 line-clamp-1">{item.planTask}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-white border border-slate-100 rounded-xl">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Última</p>
                    </div>
                    <p className="text-xs font-bold text-slate-600">
                      {item.lastDate && !isNaN(parseISO(item.lastDate).getTime()) ? format(parseISO(item.lastDate), 'dd/MM/yyyy') : '--/--/----'}
                    </p>
                  </div>
                  <div className={cn(
                    "p-3 border rounded-xl",
                    item.status === 'overdue' ? "bg-rose-50/30 border-rose-100" : "bg-white border-slate-100"
                  )}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Calendar className={cn(
                        "w-3 h-3",
                        item.status === 'overdue' ? "text-rose-400" : "text-slate-400"
                      )} />
                      <p className={cn(
                        "text-[9px] font-bold uppercase",
                        item.status === 'overdue' ? "text-rose-400" : "text-slate-400"
                      )}>Próxima</p>
                    </div>
                    <p className={cn(
                      "text-xs font-bold",
                      item.status === 'overdue' ? "text-rose-600" : "text-slate-900"
                    )}>
                      {item.nextDate && !isNaN(parseISO(item.nextDate).getTime()) ? format(parseISO(item.nextDate), 'dd/MM/yyyy') : '--/--/----'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between text-[10px]">
                <div className="flex items-center text-slate-400">
                  <Tag className="w-3 h-3 mr-1" />
                  <span>ID: {item.assetId}</span>
                </div>
                <div className="flex items-center text-slate-400">
                  <ArrowRight className="w-3 h-3 mr-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span>{item.assetLocation}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filteredData.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
          <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-slate-300 mb-4">
            <Search className="w-8 h-8" />
          </div>
          <p className="text-slate-500 font-medium">Nenhum equipamento encontrado com os filtros atuais.</p>
        </div>
      )}
    </div>
  );
};
