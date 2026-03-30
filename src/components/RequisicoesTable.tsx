import React from 'react';
import { Hash, Building2, Clock, Calendar, CheckCircle2, Edit2, Trash2, Search } from 'lucide-react';
import { format } from 'date-fns';
import { Requisition } from '../types';

const cn = (...inputs: any[]) => inputs.filter(Boolean).join(' ');

interface RequisicoesTableProps {
  requisitions: Requisition[];
  onEdit: (req: Requisition) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: 'TOTAL' | 'PARCIAL') => void;
}

export const RequisicoesTable = ({ requisitions, onEdit, onDelete, onUpdateStatus }: RequisicoesTableProps) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50/50">
            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Requisição</th>
            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Cód. Item</th>
            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Categoria</th>
            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Item / Descrição</th>
            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Fornecedor</th>
            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Datas</th>
            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">Lead Time</th>
            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">Status</th>
            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {requisitions.map((req) => (
            <tr key={req.id} className="hover:bg-slate-50/50 transition-colors group">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-slate-100 rounded-md text-slate-500">
                    <Hash className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-bold text-slate-900">{req.code}</span>
                </div>
              </td>
              <td className="px-4 py-3">
                <span className="text-xs font-medium text-slate-600">{req.itemCode || '-'}</span>
              </td>
              <td className="px-4 py-3">
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-bold rounded uppercase">
                  {req.category || 'Outros'}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="space-y-0.5 min-w-[200px] max-w-[350px]">
                  <p className="text-xs font-bold text-slate-900 whitespace-normal break-words">{req.item}</p>
                  <p className="text-[10px] text-slate-500 whitespace-normal break-words">{req.description}</p>
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1 text-[10px] text-slate-500">
                  <Building2 className="w-3 h-3" />
                  <span className="truncate max-w-[100px]">{req.supplier}</span>
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase">
                    <Clock className="w-3 h-3" />
                    Req: {format(new Date(req.requestDate), 'dd/MM/yyyy')}
                  </div>
                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-blue-600 uppercase">
                    <Calendar className="w-3 h-3" />
                    Rem: {format(new Date(req.deliveryDate), 'dd/MM/yyyy')}
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-center">
                <div className="inline-flex flex-col items-center">
                  <span className="text-xs font-black text-slate-900">{req.leadTime}</span>
                  <span className="text-[8px] font-bold text-slate-400 uppercase">dias</span>
                </div>
              </td>
              <td className="px-4 py-3 text-center">
                <div className={cn(
                  "inline-flex flex-col items-center px-2 py-1 rounded-lg",
                  req.status === 'ATRASADO' ? "bg-rose-50 text-rose-600" : 
                  req.status === 'EM DIA' ? "bg-emerald-50 text-emerald-600" : 
                  req.status === 'TOTAL' ? "bg-slate-100 text-slate-500" : 
                  req.status === 'PARCIAL' ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"
                )}>
                  <span className="text-[9px] font-black uppercase leading-none mb-0.5">
                    {req.status === 'TOTAL' ? 'OK' : req.status}
                  </span>
                  {req.status !== 'TOTAL' && (
                    <span className={cn(
                      "text-[10px] font-bold leading-none",
                      req.daysRemaining < 0 ? "text-rose-600" : ""
                    )}>
                      {req.daysRemaining} dias
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-1">
                  {req.status !== 'TOTAL' && (
                    <>
                      <button 
                        onClick={() => onUpdateStatus(req.id, 'TOTAL')}
                        title="Chegou Total (OK)"
                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => onUpdateStatus(req.id, 'PARCIAL')}
                        title="Chegou Parcial"
                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Clock className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  <button 
                    onClick={() => onEdit(req)}
                    title="Editar"
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => onDelete(req.id)}
                    title="Excluir"
                    className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {requisitions.length === 0 && (
        <div className="p-20 text-center">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-10 h-10 text-slate-200" />
          </div>
          <p className="text-slate-400 font-medium">Nenhuma requisição encontrada.</p>
        </div>
      )}
    </div>
  );
};
