import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Trash2, 
  Pencil, 
  X, 
  Check, 
  AlertCircle,
  Hash,
  FileText,
  Activity,
  Settings,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FailureCause, ServiceType } from '../types';

interface MasterDataModuleProps {
  failureCauses: FailureCause[];
  serviceTypes: ServiceType[];
  onSaveFailureCause: (cause: Partial<FailureCause>) => Promise<void>;
  onDeleteFailureCause: (id: string) => Promise<void>;
  onSaveServiceType: (type: Partial<ServiceType>) => Promise<void>;
  onDeleteServiceType: (id: string) => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  isAdmin: boolean;
}

export const MasterDataModule: React.FC<MasterDataModuleProps> = ({
  failureCauses,
  serviceTypes,
  onSaveFailureCause,
  onDeleteFailureCause,
  onSaveServiceType,
  onDeleteServiceType,
  showToast,
  isAdmin
}) => {
  const [activeTab, setActiveTab] = useState<'failureCauses' | 'serviceTypes'>('failureCauses');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<{ id?: string; name: string; description: string } | null>(null);

  const filteredItems = (activeTab === 'failureCauses' ? failureCauses : serviceTypes).filter(item =>
    (item.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (item.description || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenModal = (item?: FailureCause | ServiceType) => {
    if (item) {
      setEditingItem({ id: item.id, name: item.name, description: item.description || '' });
    } else {
      setEditingItem({ name: '', description: '' });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!editingItem?.name) {
      showToast('O nome é obrigatório', 'error');
      return;
    }

    try {
      if (activeTab === 'failureCauses') {
        await onSaveFailureCause(editingItem);
      } else {
        await onSaveServiceType(editingItem);
      }
      setShowModal(false);
      setEditingItem(null);
    } catch (error) {
      console.error('Error saving master data:', error);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center space-y-6">
        <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center shadow-lg shadow-rose-100">
          <AlertTriangle className="w-10 h-10" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Acesso Restrito</h2>
          <p className="text-slate-500 max-w-md mx-auto mt-2">
            Apenas usuários Master ou habilitados podem gerenciar as tabelas de causas de falha e tipos de serviço.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-200">
            <Hash className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Dados Mestres</h1>
            <p className="text-sm text-slate-500">Gerenciamento de tabelas auxiliares das Ordens de Serviço</p>
          </div>
        </div>

        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95"
        >
          <Plus className="w-5 h-5" />
          <span>Novo Registro</span>
        </button>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-2 rounded-[24px] border border-slate-100 shadow-sm">
        <div className="flex gap-1 p-1 bg-slate-50 rounded-2xl w-full lg:w-auto">
          <button 
            onClick={() => setActiveTab('failureCauses')}
            className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs transition-all ${activeTab === 'failureCauses' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Activity className="w-4 h-4" />
            Causas de Falha
          </button>
          <button 
            onClick={() => setActiveTab('serviceTypes')}
            className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs transition-all ${activeTab === 'serviceTypes' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Settings className="w-4 h-4" />
            Tipos de Serviço
          </button>
        </div>

        <div className="relative w-full lg:w-96">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar registros..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 transition-all font-medium"
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">ID</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Nome</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Descrição</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredItems.length > 0 ? filteredItems.map((item) => (
                <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-5">
                    <span className="text-xs font-black text-slate-400 font-mono tracking-tighter">#{item.id.split('-')[1]}</span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                        {activeTab === 'failureCauses' ? <Activity className="w-4 h-4" /> : <Settings className="w-4 h-4" />}
                      </div>
                      <span className="font-bold text-slate-900">{item.name}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <p className="text-sm text-slate-500 max-w-xs truncate">{item.description || 'Sem descrição'}</p>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        onClick={() => handleOpenModal(item)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => {
                          if (window.confirm('Deseja excluir este registro?')) {
                            if (activeTab === 'failureCauses') {
                              onDeleteFailureCause(item.id);
                            } else {
                              onDeleteServiceType(item.id);
                            }
                          }
                        }}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center">
                    <div className="w-16 h-16 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-white shadow-inner">
                      <FileText className="w-8 h-8" />
                    </div>
                    <p className="text-slate-400 font-bold">Nenhum registro encontrado</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[32px] shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner">
                    <Plus className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900">
                      {editingItem?.id ? 'Editar Registro' : 'Novo Registro'}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                      {activeTab === 'failureCauses' ? 'Causa de Falha' : 'Tipo de Serviço'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome do Registro</label>
                  <input 
                    type="text" 
                    value={editingItem?.name || ''}
                    onChange={e => setEditingItem(prev => prev ? { ...prev, name: e.target.value } : null)}
                    placeholder="Ex: Falha Elétrica / Reparo Preventivo"
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 font-bold text-slate-900 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrição (Opcional)</label>
                  <textarea 
                    value={editingItem?.description || ''}
                    onChange={e => setEditingItem(prev => prev ? { ...prev, description: e.target.value } : null)}
                    placeholder="Descreva detalhes sobre este registro..."
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 min-h-[120px] font-medium text-slate-700 transition-all"
                  />
                </div>

                <div className="pt-4 flex flex-col sm:flex-row gap-3">
                  <button 
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all text-sm"
                  >
                    Descartar
                  </button>
                  <button 
                    onClick={handleSave}
                    className="flex-1 px-6 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 text-sm"
                  >
                    <Check className="w-5 h-5" />
                    Salvar Registro
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
