import React, { useState, useMemo, useEffect } from 'react';
import { 
  ClipboardList, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  TrendingUp,
  X,
  Calendar,
  Building2,
  Package,
  Hash,
  Trash2,
  FileSpreadsheet,
  ChevronRight,
  Edit2
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  Legend
} from 'recharts';
import { format, parse, differenceInDays, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { Requisition, UserProfile } from '../types';
import { subscribeToCollection, createDocument, deleteDocument, updateDocument } from '../firebase';
import { RequisicoesTable } from './RequisicoesTable';

const cn = (...inputs: any[]) => inputs.filter(Boolean).join(' ');

const CATEGORIES = [
  'Materiais Civil',
  'Ferramentas',
  'Válvulas',
  'Materiais usinagem',
  'Manipulador',
  'Talha',
  'Exaustores',
  'Serviço',
  'Peças/Reposição',
  'Materiais',
  'Reparo',
  'Outros'
];

export const GestaoRequisicoes = ({ userProfile, showToast }: { userProfile: UserProfile | null, showToast: (msg: string, type?: 'success' | 'error') => void }) => {
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [newReq, setNewReq] = useState({
    code: '',
    item: '',
    itemCode: '',
    description: '',
    supplier: '',
    category: 'Materiais',
    requestDate: format(new Date(), 'yyyy-MM-dd'),
    deliveryDate: format(new Date(), 'yyyy-MM-dd'),
  });

  const handleEditClick = (req: Requisition) => {
    setEditingId(req.id);
    setFormError(null);
    setNewReq({
      code: req.code,
      item: req.item,
      itemCode: req.itemCode || '',
      description: req.description || '',
      supplier: req.supplier,
      category: req.category || 'Materiais',
      requestDate: format(new Date(req.requestDate), 'yyyy-MM-dd'),
      deliveryDate: format(new Date(req.deliveryDate), 'yyyy-MM-dd'),
    });
    setShowModal(true);
  };

  // Real-time subscription
  useEffect(() => {
    const unsubscribe = subscribeToCollection<Requisition>('requisitions', (data) => {
      setRequisitions(data.sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime()));
    });
    return () => unsubscribe();
  }, []);

  // Business Logic: Calculations
  const processedRequisitions = useMemo(() => {
    const today = startOfDay(new Date());
    return requisitions.map(req => {
      if (req.status === 'TOTAL') {
        return {
          ...req,
          daysRemaining: 0,
          status: 'TOTAL' as const
        };
      }

      const reqDate = new Date(req.requestDate);
      const delDate = new Date(req.deliveryDate);
      
      const leadTime = differenceInDays(delDate, reqDate);
      const daysRemaining = differenceInDays(delDate, today);
      
      let status: 'ATRASADO' | 'EM DIA' | 'AGUARDANDO' | 'TOTAL' | 'PARCIAL' = req.status === 'PARCIAL' ? 'PARCIAL' : 'AGUARDANDO';
      
      if (req.status !== 'PARCIAL') {
        if (daysRemaining < 0) {
          status = 'ATRASADO';
        } else if (daysRemaining <= 7) {
          status = 'EM DIA';
        } else {
          status = 'AGUARDANDO';
        }
      }

      return {
        ...req,
        leadTime,
        daysRemaining,
        status
      };
    });
  }, [requisitions]);

  // Indicators
  const stats = useMemo(() => {
    const total = processedRequisitions.length;
    const delayed = processedRequisitions.filter(r => r.status === 'ATRASADO').length;
    const avgLeadTime = total > 0 
      ? Math.round(processedRequisitions.reduce((acc, r) => acc + r.leadTime, 0) / total)
      : 0;

    return { total, delayed, avgLeadTime };
  }, [processedRequisitions]);

  // Chart Data: Ranking of delays per supplier
  const chartData = useMemo(() => {
    const supplierDelays: Record<string, number> = {};
    processedRequisitions.filter(r => r.status === 'ATRASADO').forEach(r => {
      supplierDelays[r.supplier] = (supplierDelays[r.supplier] || 0) + 1;
    });

    return Object.entries(supplierDelays)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [processedRequisitions]);

  // Filtering
  const filteredRequisitions = useMemo(() => {
    return processedRequisitions.filter(req => {
      const matchesSearch = 
        req.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.item.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.supplier.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'ALL' || req.status === statusFilter;
      const matchesSupplier = selectedSupplier === null || req.supplier === selectedSupplier;
      
      return matchesSearch && matchesStatus && matchesSupplier;
    });
  }, [processedRequisitions, searchTerm, statusFilter, selectedSupplier]);

  // CSV Import
  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawData: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

      // Find header row
      const headerRowIndex = rawData.findIndex(row => 
        row.some(cell => {
          const s = String(cell || '').toUpperCase();
          return s.includes('REQUISIÇÃO') || s.includes('REQUISIO') || s.includes('REQ');
        })
      );
      if (headerRowIndex === -1) throw new Error('Cabeçalho não encontrado');

      const headers = rawData[headerRowIndex].map(h => String(h || '').toUpperCase());
      const dataRows = rawData.slice(headerRowIndex + 1);
      
      const findCol = (names: string[]) => headers.findIndex(h => h && names.some(n => h.includes(n)));

      const colIdx = {
        code: findCol(['REQUISIÇÃO', 'REQUISIO', 'CÓDIGO', 'REQ']),
        item: findCol(['ITEM', 'PRODUTO']),
        itemCode: findCol(['CÓDIGO DO ITEM', 'CODIGO DO ITEM', 'COD ITEM', 'REF']),
        description: findCol(['DESCRIÇÃO', 'DESCRICAO', 'DETALHE']),
        reqDate: findCol(['DATA REQUISIÇÃO', 'DATA REQ', 'DATA DO PEDIDO']),
        delDate: findCol(['DATA REMESSA', 'DATA ENTREGA', 'PREVISÃO']),
        supplier: findCol(['FORNECEDOR', 'SUPPLIER']),
        category: findCol(['CATEGORIA', 'TIPO']),
        status: findCol(['STATUS', 'SITUAÇÃO', 'SITUACAO'])
      };

      const newRequisitions = dataRows
        .filter(row => row[colIdx.code] && (row[colIdx.item] || row[colIdx.description]))
        .map(row => {
          const code = String(row[colIdx.code] || '');
          const item = String(row[colIdx.item] || '');
          const itemCode = String(row[colIdx.itemCode] || '');
          const description = String(row[colIdx.description] || '');
          const reqDateStr = String(row[colIdx.reqDate] || '');
          const delDateStr = String(row[colIdx.delDate] || '');
          const supplier = String(row[colIdx.supplier] || 'Não Informado');
          const category = String(row[colIdx.category] || 'Outros');
          const csvStatus = String(row[colIdx.status] || '').toUpperCase();

          // Parse dates DD/MM/YYYY or Excel serial
          const parseDate = (val: any) => {
            if (!val) return new Date().toISOString();
            if (typeof val === 'number') {
              // Excel date
              const d = new Date((val - 25569) * 86400 * 1000);
              return d.toISOString();
            }
            try {
              const d = parse(String(val), 'dd/MM/yyyy', new Date());
              return d.toISOString();
            } catch {
              try {
                const d = new Date(val);
                if (!isNaN(d.getTime())) return d.toISOString();
              } catch {}
              return new Date().toISOString();
            }
          };

          const requestDate = parseDate(row[colIdx.reqDate]);
          const deliveryDate = parseDate(row[colIdx.delDate]);

          const reqDate = new Date(requestDate);
          const delDate = new Date(deliveryDate);
          const leadTime = differenceInDays(delDate, reqDate);
          const daysRemaining = differenceInDays(delDate, new Date());
          const id = Math.random().toString(36).substr(2, 9);

          let status: 'ATRASADO' | 'EM DIA' | 'AGUARDANDO' | 'TOTAL' | 'PARCIAL' = 'AGUARDANDO';
          if (csvStatus.includes('OK') || csvStatus.includes('TOTAL') || csvStatus.includes('ENTREGUE')) {
            status = 'TOTAL';
          } else if (csvStatus.includes('PARCIAL')) {
            status = 'PARCIAL';
          } else if (daysRemaining < 0) {
            status = 'ATRASADO';
          }

          return {
            id,
            code,
            item,
            itemCode,
            description,
            supplier,
            category: CATEGORIES.includes(category) ? category : 'Outros',
            requestDate,
            deliveryDate,
            leadTime,
            daysRemaining,
            status,
            createdAt: new Date().toISOString()
          };
        });

      // Persist to Firebase
      for (const req of newRequisitions) {
        await createDocument('requisitions', req, req.id);
      }

    } catch (error) {
      console.error('Erro ao importar CSV:', error);
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  const handleSaveNew = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check for duplicate code
    const newCode = (newReq.code || '').trim().toLowerCase();
    if (newCode) {
      const isDuplicate = requisitions.some(
        req => (req.code || '').trim().toLowerCase() === newCode && req.id !== editingId
      );
      
      if (isDuplicate) {
        setFormError('Já existe uma requisição com este número.');
        return;
      }
    }
    
    setFormError(null);

    const reqDate = new Date(newReq.requestDate);
    const delDate = new Date(newReq.deliveryDate);
    const leadTime = differenceInDays(delDate, reqDate);
    const daysRemaining = differenceInDays(delDate, new Date());
    const id = editingId || `REQ-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

    const requisition = {
      id,
      ...newReq,
      requestDate: new Date(newReq.requestDate).toISOString(),
      deliveryDate: new Date(newReq.deliveryDate).toISOString(),
      leadTime,
      daysRemaining,
      status: daysRemaining < 0 ? 'ATRASADO' : 'AGUARDANDO',
      createdAt: new Date().toISOString()
    };

    if (editingId) {
      await updateDocument('requisitions', id, requisition);
    } else {
      await createDocument('requisitions', requisition, id);
    }
    
    setShowModal(false);
    setEditingId(null);
    setNewReq({
      code: '',
      item: '',
      itemCode: '',
      description: '',
      supplier: '',
      category: 'Materiais',
      requestDate: format(new Date(), 'yyyy-MM-dd'),
      deliveryDate: format(new Date(), 'yyyy-MM-dd'),
    });
  };

  const handleUpdateStatus = async (id: string, status: 'TOTAL' | 'PARCIAL') => {
    await updateDocument('requisitions', id, { status });
  };

  const handleClearAll = async () => {
    for (const req of requisitions) {
      await deleteDocument('requisitions', req.id);
    }
    setShowClearConfirm(false);
  };

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (deleteConfirmId) {
      await deleteDocument('requisitions', deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  // Live Lead Time Calculation for Form
  const currentLeadTime = useMemo(() => {
    if (!newReq.requestDate || !newReq.deliveryDate) return 0;
    return differenceInDays(new Date(newReq.deliveryDate), new Date(newReq.requestDate));
  }, [newReq.requestDate, newReq.deliveryDate]);

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-200">
              <ClipboardList className="w-8 h-8" />
            </div>
            Gestão de Requisições
          </h1>
          <p className="text-slate-500 mt-1 font-medium">Controle de pedidos, prazos e performance de fornecedores.</p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowClearConfirm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl text-sm font-bold hover:bg-rose-100 transition-all shadow-sm"
          >
            <Trash2 className="w-4 h-4" />
            Limpar Tudo
          </button>

          <label className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer shadow-sm">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>{isImporting ? 'Importando...' : 'Importar CSV'}</span>
            <input type="file" accept=".csv,.xlsx" onChange={handleImportCSV} className="hidden" disabled={isImporting} />
          </label>
          
          <button 
            onClick={() => {
              setFormError(null);
              setEditingId(null);
              setNewReq({
                code: '',
                item: '',
                itemCode: '',
                description: '',
                supplier: '',
                category: 'Materiais',
                requestDate: format(new Date(), 'yyyy-MM-dd'),
                deliveryDate: format(new Date(), 'yyyy-MM-dd'),
              });
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
          >
            <Plus className="w-4 h-4" />
            Nova Requisição
          </button>
        </div>
      </div>

      {/* Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-5"
        >
          <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
            <Package className="w-7 h-7" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total de Requisições</p>
            <p className="text-3xl font-black text-slate-900">{stats.total}</p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-5"
        >
          <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pedidos Atrasados</p>
            <p className="text-3xl font-black text-rose-600">{stats.delayed}</p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-5"
        >
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
            <TrendingUp className="w-7 h-7" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lead Time Médio</p>
            <p className="text-3xl font-black text-emerald-600">{stats.avgLeadTime} <span className="text-sm font-bold text-slate-400">dias</span></p>
          </div>
        </motion.div>
      </div>

      {/* Dashboard & Table Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart */}
        <div className="lg:col-span-1 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Ranking de Atrasos
            </h3>
            {selectedSupplier && (
              <button 
                onClick={() => setSelectedSupplier(null)}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md transition-colors flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Limpar
              </button>
            )}
          </div>
          <div className="h-[400px] w-full overflow-y-auto pr-2 custom-scrollbar">
            <div 
              className="w-full transition-all duration-500" 
              style={{ height: Math.max(300, chartData.length * 50 + 60) }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false} 
                    width={100}
                    tick={{ fontSize: 12, fontWeight: 600, fill: '#64748b' }}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar 
                    dataKey="count" 
                    radius={[0, 4, 4, 0]} 
                    barSize={20}
                    onClick={(data) => {
                      if (data && data.name) {
                        setSelectedSupplier(prev => prev === data.name ? null : data.name);
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {chartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={selectedSupplier === entry.name ? '#be123c' : (index === 0 ? '#e11d48' : '#fb7185')} 
                        style={{ transition: 'fill 0.2s' }}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-bottom border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar por código, item ou fornecedor..."
                className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select 
                className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 focus:ring-2 focus:ring-blue-500"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="ALL">Todos os Status</option>
                <option value="ATRASADO">Atrasados</option>
                <option value="EM DIA">Em Dia</option>
                <option value="AGUARDANDO">Aguardando</option>
                <option value="TOTAL">Total (OK)</option>
                <option value="PARCIAL">Parcial</option>
              </select>
            </div>
          </div>

          {selectedSupplier && (
            <div className="px-6 pb-4 flex items-center gap-2">
              <span className="text-sm text-slate-500">Filtrando por fornecedor:</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 text-sm font-bold rounded-lg border border-blue-100">
                <Building2 className="w-3.5 h-3.5" />
                {selectedSupplier}
                <button 
                  onClick={() => setSelectedSupplier(null)}
                  className="ml-1 p-0.5 hover:bg-blue-200 rounded-full transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            </div>
          )}

          <RequisicoesTable 
            requisitions={filteredRequisitions}
            onEdit={handleEditClick}
            onDelete={handleDelete}
            onUpdateStatus={handleUpdateStatus}
          />
          <div className="hidden">
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
                {filteredRequisitions.map((req) => (
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
                              onClick={() => handleUpdateStatus(req.id, 'TOTAL')}
                              title="Chegou Total (OK)"
                              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleUpdateStatus(req.id, 'PARCIAL')}
                              title="Chegou Parcial"
                              className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            >
                              <Clock className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button 
                          onClick={() => handleEditClick(req)}
                          title="Editar"
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(req.id)}
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
          </div>
        </div>
      </div>

      {/* Modal Confirmação Limpar */}
      <AnimatePresence>
        {showClearConfirm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowClearConfirm(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-sm bg-white rounded-[32px] shadow-2xl p-8 text-center"
            >
              <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6 text-rose-600">
                <AlertCircle className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">Apagar Tudo?</h3>
              <p className="text-slate-500 text-sm mb-8 font-medium">
                Esta ação é irreversível e apagará todas as requisições do banco de dados.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setShowClearConfirm(false)}
                  className="py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleClearAll}
                  className="py-3 bg-rose-600 text-white rounded-2xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-200"
                >
                  Sim, Apagar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Confirmação Excluir Item */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmId(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-sm bg-white rounded-[32px] shadow-2xl p-8 text-center"
            >
              <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6 text-rose-600">
                <Trash2 className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">Excluir Requisição?</h3>
              <p className="text-slate-500 text-sm mb-8 font-medium">
                Tem certeza que deseja excluir esta requisição? Esta ação não pode ser desfeita.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setDeleteConfirmId(null)}
                  className="py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmDelete}
                  className="py-3 bg-rose-600 text-white rounded-2xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-200"
                >
                  Sim, Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Nova Requisição */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
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
              className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Nova Requisição</h3>
                  <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>

                <form onSubmit={handleSaveNew} className="space-y-6">
                  {formError && (
                    <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                      <p className="text-sm font-medium text-rose-800">{formError}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cód. Requisição</label>
                      <div className="relative">
                        <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                          required
                          type="text"
                          className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 transition-all"
                          placeholder="Ex: 3001135505"
                          value={newReq.code}
                          onChange={e => {
                            const val = e.target.value;
                            setNewReq({...newReq, code: val});
                            const newCode = val.trim().toLowerCase();
                            if (newCode) {
                              const isDuplicate = requisitions.some(
                                req => (req.code || '').trim().toLowerCase() === newCode && req.id !== editingId
                              );
                              if (isDuplicate) {
                                setFormError('Já existe uma requisição com este número.');
                                showToast('Atenção: Já existe uma requisição com este número!', 'error');
                              } else {
                                setFormError(null);
                              }
                            } else {
                              setFormError(null);
                            }
                          }}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fornecedor</label>
                      <div className="relative">
                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                          required
                          type="text"
                          className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 transition-all"
                          placeholder="Nome do fornecedor"
                          value={newReq.supplier}
                          onChange={e => setNewReq({...newReq, supplier: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoria de Material</label>
                    <select 
                      required
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 transition-all"
                      value={newReq.category}
                      onChange={e => setNewReq({...newReq, category: e.target.value})}
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Item / Produto</label>
                      <div className="relative">
                        <Package className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                          required
                          type="text"
                          className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 transition-all"
                          placeholder="Ex: Válvula, Motor..."
                          value={newReq.item}
                          onChange={e => setNewReq({...newReq, item: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cód. Item</label>
                      <div className="relative">
                        <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                          type="text"
                          className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 transition-all"
                          placeholder="Ex: 12345"
                          value={newReq.itemCode}
                          onChange={e => setNewReq({...newReq, itemCode: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrição Detalhada</label>
                    <textarea 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 transition-all min-h-[100px]"
                      placeholder="Descreva os detalhes da requisição..."
                      value={newReq.description}
                      onChange={e => setNewReq({...newReq, description: e.target.value})}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data Requisição</label>
                      <input 
                        required
                        type="date"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 transition-all"
                        value={newReq.requestDate}
                        onChange={e => setNewReq({...newReq, requestDate: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data Remessa</label>
                      <input 
                        required
                        type="date"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 transition-all"
                        value={newReq.deliveryDate}
                        onChange={e => setNewReq({...newReq, deliveryDate: e.target.value})}
                      />
                    </div>
                  </div>

                  {/* Lead Time Preview */}
                  <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-600 rounded-xl text-white">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-blue-900 uppercase">Lead Time Estimado</p>
                        <p className="text-sm text-blue-700">Calculado automaticamente</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={cn(
                        "text-2xl font-black",
                        currentLeadTime < 0 ? "text-rose-600" : "text-blue-600"
                      )}>
                        {currentLeadTime}
                      </span>
                      <span className="text-xs font-bold text-blue-400 uppercase ml-1">dias</span>
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    Salvar Requisição
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
