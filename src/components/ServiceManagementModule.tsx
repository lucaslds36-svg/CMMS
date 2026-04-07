import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Pencil, 
  History, 
  Package, 
  ChevronDown, 
  ChevronRight,
  Calendar as CalendarIcon,
  User as UserIcon,
  Filter,
  MoreVertical,
  Box,
  Eye,
  Trash2,
  FileText,
  DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, parseISO, differenceInDays, isAfter, isBefore, addDays, startOfMonth, eachDayOfInterval, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import type { ServiceDemand, Employee, UserProfile, MaterialRequisition, ServiceDemandScopeChange, ServiceDemandStatusChange, ThirdPartyCompany } from '../types';

const safeParseISO = (dateStr: string | undefined | null) => {
  if (!dateStr) return new Date();
  try {
    return parseISO(dateStr);
  } catch (e) {
    return new Date();
  }
};
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ServiceManagementModuleProps {
  demands: ServiceDemand[];
  employees: Employee[];
  companies: ThirdPartyCompany[];
  userProfile: UserProfile | null;
  onSave: (demand: Partial<ServiceDemand>) => Promise<void>;
  onDelete?: (demandId: string) => Promise<void>;
  onUpdateStatus: (demandId: string, status: ServiceDemand['status']) => Promise<void>;
  onAddScopeChange: (demandId: string, description: string) => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  selectedDemandId?: string | null;
  onClearSelectedDemandId?: () => void;
}

export const ServiceManagementModule = ({
  demands,
  employees,
  companies,
  userProfile,
  onSave,
  onDelete,
  onUpdateStatus,
  onAddScopeChange,
  showToast,
  selectedDemandId,
  onClearSelectedDemandId
}: ServiceManagementModuleProps) => {
  const [showModal, setShowModal] = useState(false);
  const [editingDemand, setEditingDemand] = useState<ServiceDemand | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterArea, setFilterArea] = useState<string>('Todas');
  const [filterStatus, setFilterStatus] = useState<string>('Todos');

  useEffect(() => {
    if (selectedDemandId) {
      const demand = demands.find(d => d.id === selectedDemandId);
      if (demand) {
        setEditingDemand(demand);
        setIsEditing(true);
        if (onClearSelectedDemandId) {
          onClearSelectedDemandId();
        }
      }
    }
  }, [selectedDemandId, demands, onClearSelectedDemandId]);

  useEffect(() => {
    if (editingDemand && !isEditing) {
      const updatedDemand = demands.find(d => d.id === editingDemand.id);
      if (updatedDemand) {
        setEditingDemand(updatedDemand);
      }
    }
  }, [demands, editingDemand?.id, isEditing]);

  const [formData, setFormData] = useState<Partial<ServiceDemand>>({
    description: '',
    area: 'Trefila',
    executorType: 'Próprio',
    responsibleId: '',
    priority: 'Média',
    estimatedDeliveryDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
    executorName: '',
    companyId: '',
    companyName: '',
    needsMaterial: false,
    materialRequisition: {
      item: '',
      requisitionNumber: '',
      deliveryDate: ''
    },
    collaborators: []
  });

  const areas = ['Trefila', 'Cordeira Car', 'Cordeira Truck', 'Semi Pronto', 'Logistica', 'Centralizado', 'Área externa', 'Utilidades'];
  const priorities = ['Alta', 'Média', 'Baixa'];
  const statuses = ['Não Iniciado', 'Em andamento', 'Parado', 'Cancelado', 'Concluído'];

  const getStatusInfo = (demand: ServiceDemand) => {
    if (demand.status === 'Concluído') return { label: 'Concluído', color: 'bg-emerald-100 text-emerald-700' };
    if (demand.status === 'Cancelado') return { label: 'Cancelado', color: 'bg-slate-100 text-slate-700' };
    
    const today = new Date();
    const deliveryDate = safeParseISO(demand.estimatedDeliveryDate);
    const daysDiff = differenceInDays(deliveryDate, today);

    if (isBefore(deliveryDate, today)) return { label: 'Vencida', color: 'bg-rose-100 text-rose-700' };
    if (daysDiff <= 3) return { label: 'A vencer', color: 'bg-amber-100 text-amber-700' };
    return { label: 'No prazo', color: 'bg-blue-100 text-blue-700' };
  };

  const filteredDemands = demands.filter(d => {
    const matchesSearch = (d.description || '').toLowerCase().includes(search.toLowerCase()) || 
                         (d.responsibleName || '').toLowerCase().includes(search.toLowerCase());
    const matchesArea = filterArea === 'Todas' || d.area === filterArea;
    const matchesStatus = filterStatus === 'Todos' || d.status === filterStatus;
    return matchesSearch && matchesArea && matchesStatus;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;

    try {
      const demandData: Partial<ServiceDemand> = {
        ...formData,
        requesterUid: userProfile.uid,
        requesterName: userProfile.displayName || 'Usuário',
        responsibleName: formData.responsibleName || '',
        responsibleId: formData.responsibleId || '',
        collaborators: formData.collaborators || [],
        status: 'Não Iniciado',
        openedAt: new Date().toISOString(),
        scopeChanges: [],
        statusHistory: [{
          id: Math.random().toString(36).substr(2, 9),
          status: 'Não Iniciado',
          date: new Date().toISOString(),
          user: userProfile.displayName || 'Usuário'
        }]
      };

      await onSave(demandData);
      setShowModal(false);
      setFormData({
        description: '',
        area: 'Trefila',
        executorType: 'Próprio',
        responsibleId: '',
        priority: 'Média',
        estimatedDeliveryDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
        needsMaterial: false,
        materialRequisition: {
          item: '',
          requisitionNumber: '',
          deliveryDate: ''
        }
      });
    } catch (error) {
      console.error('Error saving demand:', error);
      showToast('Erro ao salvar demanda', 'error');
    }
  };

  const GanttChart = ({ demand }: { demand: ServiceDemand }) => {
    const start = safeParseISO(demand.startDate || demand.openedAt);
    const end = safeParseISO(demand.estimatedDeliveryDate);
    const today = new Date();
    
    const totalDays = Math.max(differenceInDays(end, start), 1);
    const elapsedDays = Math.max(differenceInDays(today, start), 0);
    const progress = Math.min((elapsedDays / totalDays) * 100, 100);

    return (
      <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden relative">
        <div 
          className={cn(
            "h-full transition-all duration-500",
            demand.status === 'Concluído' ? "bg-emerald-500" :
            demand.status === 'Cancelado' ? "bg-slate-400" :
            progress >= 100 ? "bg-rose-500" : "bg-blue-500"
          )}
          style={{ width: `${progress}%` }}
        />
        {demand.status !== 'Concluído' && demand.status !== 'Cancelado' && (
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-slate-900 z-10"
            style={{ left: `${progress}%` }}
          />
        )}
      </div>
    );
  };

  const [viewMode, setViewMode] = useState<'table' | 'gantt'>('table');

  const handleGenerateReport = async () => {
    const sortedDemands = [...filteredDemands].sort((a, b) => {
      const dateA = safeParseISO(a.estimatedDeliveryDate);
      const dateB = safeParseISO(b.estimatedDeliveryDate);
      return dateA.getTime() - dateB.getTime();
    });

    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Header
    doc.setFontSize(18);
    doc.setTextColor(30, 64, 175); // Blue-800
    doc.text('Relatório de Gestão de Serviços', 15, 15);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 15, 22);
    
    // Stats Summary
    const total = sortedDemands.length;
    const inProgress = sortedDemands.filter(d => d.status === 'Em andamento').length;
    const completed = sortedDemands.filter(d => d.status === 'Concluído').length;
    
    doc.setFontSize(12);
    doc.setTextColor(30, 64, 175);
    doc.text('Resumo Executivo', 15, 35);
    
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    doc.text(`Total de Demandas: ${total}`, 15, 42);
    doc.text(`Em Andamento: ${inProgress}`, 70, 42);
    doc.text(`Concluídas: ${completed}`, 120, 42);

    // Table
    autoTable(doc, {
      head: [['ID', 'Descrição', 'Área', 'Vencimento', 'Executor', 'Responsável', 'Status']],
      body: sortedDemands.map(demand => [
        `#${demand.id.replace('SD-', '')}`,
        demand.description,
        demand.area,
        format(safeParseISO(demand.estimatedDeliveryDate), 'dd/MM/yyyy'),
        demand.executorType === 'Terceiro' ? (demand.companyName || 'Terceiro') : 'Próprio',
        demand.responsibleName || '-',
        demand.status
      ]),
      startY: 50,
      headStyles: { fillColor: [30, 64, 175] },
      styles: { fontSize: 8, cellPadding: 2 },
    });
    
    doc.save(`relatorio-servicos-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    showToast('Relatório PDF gerado com sucesso!');
  };

  const generateIndividualReport = (demand: ServiceDemand) => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.setTextColor(30, 64, 175); // Blue-800
    doc.text(`Relatório de Demanda: #${demand.id.replace('SD-', '')}`, 10, 15);
    
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Responsável: ${demand.responsibleName || '-'}`, 10, 25);
    doc.text(`Status: ${demand.status}`, 10, 32);
    doc.text(`Área: ${demand.area}`, 10, 39);
    doc.text(`Prioridade: ${demand.priority}`, 10, 46);
    doc.text(`Data de Abertura: ${demand.openedAt ? format(safeParseISO(demand.openedAt), 'dd/MM/yyyy HH:mm') : '-'}`, 10, 53);
    doc.text(`Previsão de Entrega: ${demand.estimatedDeliveryDate ? format(safeParseISO(demand.estimatedDeliveryDate), 'dd/MM/yyyy') : '-'}`, 10, 60);
    
    doc.setFontSize(14);
    doc.setTextColor(30, 64, 175);
    doc.text('Descrição da Demanda', 10, 75);
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    doc.text(demand.description || '-', 10, 82, { maxWidth: 180 });
    
    let y = 100;

    // Status History Table
    if (demand.statusHistory && demand.statusHistory.length > 0) {
      doc.setFontSize(14);
      doc.setTextColor(30, 64, 175);
      doc.text('Histórico de Status', 10, y);
      autoTable(doc, {
        head: [['Data', 'Status', 'Usuário']],
        body: demand.statusHistory.map(h => [
          format(safeParseISO(h.date), 'dd/MM/yyyy HH:mm'),
          h.status,
          h.user
        ]),
        startY: y + 5,
        headStyles: { fillColor: [30, 64, 175] }
      });
      y = (doc as any).lastAutoTable.finalY + 15;
    }

    // Scope Changes Table
    if (demand.scopeChanges && demand.scopeChanges.length > 0) {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFontSize(14);
      doc.setTextColor(30, 64, 175);
      doc.text('Alterações de Escopo', 10, y);
      autoTable(doc, {
        head: [['Data', 'Descrição', 'Usuário']],
        body: demand.scopeChanges.map(s => [
          format(safeParseISO(s.date), 'dd/MM/yyyy'),
          s.description,
          s.user
        ]),
        startY: y + 5,
        headStyles: { fillColor: [30, 64, 175] }
      });
      y = (doc as any).lastAutoTable.finalY + 15;
    }

    // Material Requisition
    if (demand.needsMaterial && demand.materialRequisition) {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFontSize(14);
      doc.setTextColor(30, 64, 175);
      doc.text('Requisição de Material', 10, y);
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);
      doc.text(`Item: ${demand.materialRequisition.item}`, 10, y + 7);
      doc.text(`Nº Requisição: ${demand.materialRequisition.requisitionNumber}`, 10, y + 14);
      doc.text(`Data de Entrega: ${demand.materialRequisition.deliveryDate ? format(safeParseISO(demand.materialRequisition.deliveryDate), 'dd/MM/yyyy') : '-'}`, 10, y + 21);
    }
    
    doc.save(`relatorio_demanda_${demand.id}.pdf`);
    showToast('Relatório PDF gerado com sucesso!');
  };

  const GanttView = () => {
    const today = new Date();
    const startDate = startOfMonth(today);
    const endDate = addDays(startDate, 30);
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    return (
      <div className="p-6 overflow-x-auto">
        <div className="min-w-[1200px]">
          <div className="flex border-b border-slate-100 pb-4 mb-4">
            <div className="w-64 flex-shrink-0 font-bold text-xs text-slate-400 uppercase">Demanda</div>
            <div className="flex-1 flex">
              {days.map((day, i) => (
                <div key={i} className={cn(
                  "flex-1 text-center text-[10px] font-bold border-l border-slate-50",
                  isToday(day) ? "text-blue-600 bg-blue-50/50" : "text-slate-400"
                )}>
                  {format(day, 'dd')}
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            {filteredDemands.map(demand => {
              const start = safeParseISO(demand.startDate || demand.openedAt);
              const end = safeParseISO(demand.estimatedDeliveryDate);
              
              const startOffset = Math.max(differenceInDays(start, startDate), 0);
              const duration = Math.max(differenceInDays(end, start), 1);
              const totalDays = 31;
              
              const left = (startOffset / totalDays) * 100;
              const width = (duration / totalDays) * 100;

              return (
                <div key={demand.id} className="flex items-center group">
                  <div className="w-64 flex-shrink-0 pr-4">
                    <div className="text-sm font-bold text-slate-900 truncate" title={demand.description}>
                      {demand.description}
                    </div>
                    <div className="text-[10px] text-slate-400">{demand.responsibleName}</div>
                  </div>
                  <div className="flex-1 h-8 bg-slate-50 rounded-lg relative overflow-hidden">
                    <div 
                      className={cn(
                        "absolute top-1 bottom-1 rounded-md shadow-sm transition-all group-hover:brightness-110",
                        demand.status === 'Concluído' ? "bg-emerald-500" :
                        demand.status === 'Cancelado' ? "bg-slate-400" :
                        isAfter(today, end) ? "bg-rose-500" : "bg-blue-500"
                      )}
                      style={{ left: `${left}%`, width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Gestão de Serviços</h2>
          <p className="text-slate-500 text-sm">Acompanhamento de demandas e ordens de serviço</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-white p-1 rounded-xl border border-slate-100 flex">
            <button 
              onClick={() => setViewMode('table')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                viewMode === 'table' ? "bg-slate-900 text-white shadow-lg" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              Tabela
            </button>
            <button 
              onClick={() => setViewMode('gantt')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                viewMode === 'gantt' ? "bg-slate-900 text-white shadow-lg" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              Gantt
            </button>
          </div>
          <button 
            onClick={handleGenerateReport}
            className="flex items-center justify-center space-x-2 px-6 py-3 bg-slate-100 text-slate-700 rounded-2xl font-bold hover:bg-slate-200 transition-all border border-slate-200"
          >
            <FileText className="w-5 h-5" />
            <span>Relatório PDF</span>
          </button>
          <button 
            onClick={() => setShowModal(true)}
            className="flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
          >
            <Plus className="w-5 h-5" />
            <span>Nova Demanda</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-1">
            <span className="text-slate-500 text-xs font-medium">Total</span>
            <Box className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{demands.length}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-1">
            <span className="text-slate-500 text-xs font-medium">Em Andamento</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {demands.filter(d => d.status === 'Em andamento').length}
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-1">
            <span className="text-slate-500 text-xs font-medium">Concluídas</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {demands.filter(d => d.status === 'Concluído').length}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar por descrição ou responsável..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <select 
              value={filterArea}
              onChange={e => setFilterArea(e.target.value)}
              className="px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="Todas">Todas as Áreas</option>
              {areas.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <select 
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="Todos">Todos os Status</option>
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {viewMode === 'table' ? (
          <div className="overflow-x-auto w-full touch-pan-x">
            <table className="w-max min-w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase">OS</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase">Título</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase">Responsável</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase">Técnico</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase">Status</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase">Prioridade</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDemands.map((demand) => {
                const statusInfo = getStatusInfo(demand);
                return (
                  <tr key={demand.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-bold text-blue-700">#{demand.id.replace('SD-', '')}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-bold text-slate-900">{demand.description}</div>
                      <div className="text-xs text-slate-500">{demand.area}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      <span className="px-2 py-1 bg-slate-100 rounded text-xs border border-slate-200">
                        {demand.responsibleName}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{demand.responsibleName}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "px-2 py-1 rounded text-xs font-bold text-white",
                        statusInfo.color.replace('bg-', 'bg-').replace('text-', 'text-') // Assuming color mapping needs adjustment
                      )}>
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "px-2 py-1 rounded text-xs font-bold text-white",
                        demand.priority === 'Alta' ? "bg-rose-600" :
                        demand.priority === 'Média' ? "bg-amber-500" :
                        "bg-emerald-600"
                      )}>
                        {demand.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center space-x-1">
                        <button 
                          onClick={() => {
                            setEditingDemand(demand);
                            setIsEditing(false);
                          }}
                          className="p-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 transition-all"
                          title="Ver Detalhes"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {(userProfile?.role === 'admin' || 
                          demand.requesterUid === userProfile?.uid || 
                          employees.find(emp => emp.ID === demand.responsibleId)?.userUid === userProfile?.uid || 
                          demand.responsibleId === userProfile?.uid ||
                          userProfile?.workOrderRole === 'planner') && (
                          <>
                            <button 
                              onClick={() => {
                                setEditingDemand(demand);
                                setIsEditing(true);
                              }}
                              className="p-1.5 bg-amber-500 text-white rounded hover:bg-amber-600 transition-all"
                              title="Editar"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            {onDelete && (userProfile?.role === 'admin' || demand.requesterUid === userProfile?.uid || userProfile?.workOrderRole === 'planner') && (
                              <button 
                                onClick={() => onDelete(demand.id)}
                                className="p-1.5 bg-rose-600 text-white rounded hover:bg-rose-700 transition-all"
                                title="Excluir"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            </table>
          </div>
        ) : (
          <GanttView />
        )}
      </div>

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
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-8 overflow-y-auto">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">Nova Demanda de Serviço</h3>
                    <p className="text-slate-500 text-sm">Preencha os dados para abrir uma nova solicitação</p>
                  </div>
                  <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-full">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Descrição da Demanda</label>
                      <textarea 
                        required
                        rows={3}
                        className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 resize-none"
                        placeholder="Descreva detalhadamente o serviço necessário..."
                        value={formData.description || ''}
                        onChange={e => setFormData({...formData, description: e.target.value})}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Área</label>
                      <select 
                        required
                        className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500"
                        value={formData.area || 'Trefila'}
                        onChange={e => setFormData({...formData, area: e.target.value as any})}
                      >
                        {areas.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Executor</label>
                      <select 
                        required
                        className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500"
                        value={formData.executorType || 'Próprio'}
                        onChange={e => setFormData({
                          ...formData, 
                          executorType: e.target.value as any,
                          companyId: '',
                          companyName: '',
                          responsibleId: '',
                          responsibleName: '',
                          collaborators: []
                        })}
                      >
                        <option value="Próprio">Próprio</option>
                        <option value="Terceiro">Terceiro</option>
                      </select>
                    </div>

                    {formData.executorType === 'Terceiro' && (
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Empresa Terceira</label>
                        <select 
                          required
                          className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500"
                          value={formData.companyId || ''}
                          onChange={e => {
                            const company = companies.find(c => c.id === e.target.value);
                            setFormData({
                              ...formData, 
                              companyId: e.target.value,
                              companyName: company?.name || '',
                              responsibleId: '',
                              responsibleName: '',
                              collaborators: []
                            });
                          }}
                        >
                          <option value="">Selecione a Empresa</option>
                          {companies.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Responsável</label>
                      <select 
                        required
                        className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500"
                        value={formData.responsibleId || ''}
                        onChange={e => {
                          const emp = employees.find(emp => emp.ID === e.target.value);
                          setFormData({
                            ...formData,
                            responsibleId: e.target.value,
                            responsibleName: emp?.Name || ''
                          });
                        }}
                      >
                        <option value="">Selecione o Responsável</option>
                        {employees
                          .filter(emp => {
                            if (formData.executorType === 'Próprio') {
                              return emp.Type === 'Próprio';
                            } else {
                              return emp.Type === 'Terceiro' && emp.companyId === formData.companyId;
                            }
                          })
                          .map(emp => (
                            <option key={emp.ID} value={emp.ID}>{emp.Name}</option>
                          ))
                        }
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Colaboradores Adicionais</label>
                      <div className="flex gap-2">
                        <select 
                          className="flex-1 px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500"
                          onChange={e => {
                            const emp = employees.find(emp => emp.ID === e.target.value);
                            if (emp && !formData.collaborators?.find(c => c.id === emp.ID)) {
                              setFormData({
                                ...formData,
                                collaborators: [...(formData.collaborators || []), { id: emp.ID, name: emp.Name }]
                              });
                            }
                          }}
                        >
                          <option value="">Adicionar colaborador</option>
                          {employees
                            .filter(emp => {
                              const isRightType = formData.executorType === 'Próprio' 
                                ? emp.Type === 'Próprio' 
                                : (emp.Type === 'Terceiro' && emp.companyId === formData.companyId);
                              return isRightType && emp.ID !== formData.responsibleId;
                            })
                            .map(emp => (
                              <option key={emp.ID} value={emp.ID}>
                                {emp.Name}
                              </option>
                            ))
                          }
                        </select>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(formData.collaborators || []).map((collab, index) => (
                          <span key={index} className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs">
                            {collab.name}
                            <button 
                              type="button" 
                              onClick={() => setFormData({
                                ...formData,
                                collaborators: formData.collaborators?.filter((_, i) => i !== index)
                              })}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Prioridade</label>
                      <div className="flex gap-2">
                        {priorities.map(p => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setFormData({...formData, priority: p as any})}
                            className={cn(
                              "flex-1 py-2 rounded-xl text-xs font-bold transition-all border-2",
                              formData.priority === p 
                                ? p === 'Alta' ? "bg-rose-50 border-rose-500 text-rose-600" :
                                  p === 'Média' ? "bg-amber-50 border-amber-500 text-amber-600" :
                                  "bg-emerald-50 border-emerald-500 text-emerald-600"
                                : "bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100"
                            )}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Data Provável de Entrega</label>
                      <input 
                        required
                        type="date"
                        className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500"
                        value={formData.estimatedDeliveryDate || ''}
                        onChange={e => setFormData({...formData, estimatedDeliveryDate: e.target.value})}
                      />
                    </div>

                    <div className="flex items-center space-x-3 p-4 bg-slate-50 rounded-2xl">
                      <input 
                        type="checkbox"
                        id="needsMaterial"
                        className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        checked={formData.needsMaterial}
                        onChange={e => setFormData({...formData, needsMaterial: e.target.checked})}
                      />
                      <label htmlFor="needsMaterial" className="text-sm font-bold text-slate-700 cursor-pointer">
                        Necessita requisição de material?
                      </label>
                    </div>

                    {formData.needsMaterial && (
                      <div className="md:col-span-2 p-6 bg-blue-50 rounded-3xl space-y-4 border border-blue-100">
                        <h4 className="text-sm font-bold text-blue-700 flex items-center gap-2">
                          <Package className="w-4 h-4" />
                          Dados da Requisição
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-blue-400 uppercase mb-1">Item</label>
                            <input 
                              type="text"
                              className="w-full px-4 py-2 bg-white border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                              value={formData.materialRequisition?.item ?? ''}
                              onChange={e => setFormData({
                                ...formData, 
                                materialRequisition: { ...(formData.materialRequisition || { item: '', requisitionNumber: '', deliveryDate: '' }), item: e.target.value }
                              })}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-blue-400 uppercase mb-1">Nº Requisição</label>
                            <input 
                              type="text"
                              className="w-full px-4 py-2 bg-white border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                              value={formData.materialRequisition?.requisitionNumber ?? ''}
                              onChange={e => setFormData({
                                ...formData, 
                                materialRequisition: { ...(formData.materialRequisition || { item: '', requisitionNumber: '', deliveryDate: '' }), requisitionNumber: e.target.value }
                              })}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-blue-400 uppercase mb-1">Data Entrega</label>
                            <input 
                              type="date"
                              className="w-full px-4 py-2 bg-white border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                              value={formData.materialRequisition?.deliveryDate ?? ''}
                              onChange={e => setFormData({
                                ...formData, 
                                materialRequisition: { ...(formData.materialRequisition || { item: '', requisitionNumber: '', deliveryDate: '' }), deliveryDate: e.target.value }
                              })}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                  >
                    Abrir Demanda
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingDemand && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingDemand(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-4 sm:p-8 overflow-y-auto">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">Detalhes da Demanda</h3>
                    <p className="text-slate-500 text-sm">ID: {editingDemand.id}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => generateIndividualReport(editingDemand)}
                      className="px-4 py-2 bg-slate-800 text-white rounded-full text-xs font-bold flex items-center gap-2 hover:bg-slate-900 transition-all"
                    >
                      <FileText className="w-4 h-4" /> Relatório PDF
                    </button>
                    <button onClick={() => { setEditingDemand(null); setIsEditing(false); }} className="p-2 hover:bg-slate-100 rounded-full">
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Descrição</label>
                      <p className="text-slate-700 bg-slate-50 p-4 rounded-2xl text-sm leading-relaxed">
                        {editingDemand.description}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Área</label>
                        <p className="text-sm font-bold text-slate-900">{editingDemand.area}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Executor</label>
                        {isEditing ? (
                          <select 
                            className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                            value={editingDemand.executorType}
                            onChange={e => setEditingDemand({
                              ...editingDemand, 
                              executorType: e.target.value as any,
                              companyId: '',
                              companyName: '',
                              responsibleId: '',
                              responsibleName: '',
                              collaborators: []
                            })}
                          >
                            <option value="Próprio">Próprio</option>
                            <option value="Terceiro">Terceiro</option>
                          </select>
                        ) : (
                          <p className="text-sm font-bold text-slate-900">{editingDemand.executorType}</p>
                        )}
                      </div>
                    </div>

                    {editingDemand.executorType === 'Terceiro' && (
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Empresa Terceira</label>
                        {isEditing ? (
                          <select 
                            className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                            value={editingDemand.companyId}
                            onChange={e => {
                              const company = companies.find(c => c.id === e.target.value);
                              setEditingDemand({
                                ...editingDemand, 
                                companyId: e.target.value,
                                companyName: company?.name || '',
                                responsibleId: '',
                                responsibleName: '',
                                collaborators: []
                              });
                            }}
                          >
                            <option value="">Selecione a Empresa</option>
                            {companies.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        ) : (
                          <p className="text-sm font-bold text-slate-900">{editingDemand.companyName || 'Não informada'}</p>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Data Prevista</label>
                        <input 
                          type="date"
                          className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                          value={editingDemand.estimatedDeliveryDate || ''}
                          onChange={e => setEditingDemand({...editingDemand, estimatedDeliveryDate: e.target.value})}
                          disabled={!isEditing || userProfile?.role !== 'admin'}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Responsável</label>
                        {isEditing ? (
                          <select 
                            className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                            value={editingDemand.responsibleId}
                            onChange={e => {
                              const emp = employees.find(emp => emp.ID === e.target.value);
                              setEditingDemand({
                                ...editingDemand,
                                responsibleId: e.target.value,
                                responsibleName: emp?.Name || '',
                                responsibleHourlyRate: emp?.hourlyRate || 0
                              });
                            }}
                          >
                            <option value="">Selecione o Responsável</option>
                            {employees
                              .filter(emp => {
                                if (editingDemand.executorType === 'Próprio') {
                                  return emp.Type === 'Próprio';
                                } else {
                                  return emp.Type === 'Terceiro' && emp.companyId === editingDemand.companyId;
                                }
                              })
                              .map(emp => (
                                <option key={emp.ID} value={emp.ID}>
                                  {emp.Name} {emp.hourlyRate ? `(R$ ${emp.hourlyRate}/h)` : ''}
                                </option>
                              ))
                            }
                          </select>
                        ) : (
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-slate-900">{editingDemand.responsibleName}</p>
                            {editingDemand.responsibleHourlyRate && editingDemand.responsibleHourlyRate > 0 && (
                              <span className="text-[10px] text-emerald-600 font-bold">R$ {editingDemand.responsibleHourlyRate}/h</span>
                            )}
                          </div>
                        )}
                        {isEditing && (
                          <div className="mt-2 space-y-2">
                            <div className="flex items-center gap-2">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">Horas do Responsável:</label>
                              <input 
                                type="number"
                                step="0.5"
                                className="w-20 px-2 py-1 bg-slate-50 border-none rounded-lg text-xs"
                                value={editingDemand.responsibleHoursWorked || 0}
                                onChange={e => setEditingDemand({...editingDemand, responsibleHoursWorked: parseFloat(e.target.value) || 0})}
                              />
                            </div>
                          </div>
                        )}
                        {!isEditing && editingDemand.responsibleHoursWorked ? (
                          <p className="text-xs text-slate-500 mt-1">Horas: {editingDemand.responsibleHoursWorked}h</p>
                        ) : null}
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Colaboradores</label>
                        <div className="space-y-2 mb-2">
                          {(editingDemand.collaborators || []).map((collab, index) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-slate-50 rounded-xl border border-slate-100">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-700">{collab.name}</span>
                                {collab.hourlyRate && collab.hourlyRate > 0 && (
                                  <span className="text-[10px] text-emerald-600 font-bold">R$ {collab.hourlyRate}/h</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {isEditing ? (
                                  <>
                                    <input 
                                      type="number"
                                      step="0.5"
                                      placeholder="Hrs"
                                      className="w-16 px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px]"
                                      value={collab.hoursWorked || 0}
                                      onChange={e => {
                                        const newCollabs = [...(editingDemand.collaborators || [])];
                                        newCollabs[index] = { ...collab, hoursWorked: parseFloat(e.target.value) || 0 };
                                        setEditingDemand({ ...editingDemand, collaborators: newCollabs });
                                      }}
                                    />
                                    <button 
                                      type="button" 
                                      onClick={() => setEditingDemand({
                                        ...editingDemand,
                                        collaborators: editingDemand.collaborators?.filter((_, i) => i !== index)
                                      })}
                                      className="p-1 text-rose-400 hover:bg-rose-50 rounded-lg"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </>
                                ) : (
                                  <span className="text-xs text-slate-500">{collab.hoursWorked || 0}h</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        {isEditing && (
                          <select 
                            className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                            onChange={e => {
                              const emp = employees.find(emp => emp.ID === e.target.value);
                              if (emp) {
                                setEditingDemand({
                                  ...editingDemand,
                                  collaborators: [...(editingDemand.collaborators || []), { 
                                    id: emp.ID, 
                                    name: emp.Name,
                                    hourlyRate: emp.hourlyRate || 0,
                                    hoursWorked: 0
                                  }]
                                });
                              }
                            }}
                          >
                            <option value="">Adicionar colaborador</option>
                            {employees
                              .filter(emp => emp.Type === editingDemand.executorType && emp.ID !== editingDemand.responsibleId && !(editingDemand.collaborators || []).find(c => c.id === emp.ID))
                              .map(emp => (
                                <option key={emp.ID} value={emp.ID}>
                                  {emp.Name} {emp.hourlyRate ? `(R$ ${emp.hourlyRate}/h)` : ''}
                                </option>
                              ))
                            }
                          </select>
                        )}
                      </div>
                    </div>

                    {editingDemand.executorType === 'Terceiro' && (
                      <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
                        <div>
                          <h4 className="text-[10px] font-bold text-emerald-700 uppercase mb-1">Custo Estimado de Mão de Obra</h4>
                          <p className="text-lg font-bold text-emerald-900">
                            R$ {((editingDemand.responsibleHoursWorked || 0) * (editingDemand.responsibleHourlyRate || 0) + 
                                (editingDemand.collaborators || []).reduce((acc, c) => acc + (c.hoursWorked || 0) * (c.hourlyRate || 0), 0))
                                .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <DollarSign className="w-8 h-8 text-emerald-200" />
                      </div>
                    )}

                    {editingDemand.executorType === 'Terceiro' && (
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nome do Executante (Terceiro)</label>
                        <input 
                          type="text"
                          className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                          value={editingDemand.executorName || ''}
                          onChange={e => setEditingDemand({...editingDemand, executorName: e.target.value})}
                          disabled={!isEditing}
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Status</label>
                        <p className="text-sm font-bold text-slate-900">{editingDemand.status}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Solicitante</label>
                        <p className="text-sm font-bold text-slate-900">{editingDemand.requesterName}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Data de Início</label>
                        <input 
                          type="date"
                          className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                          value={editingDemand.startDate || ''}
                          onChange={e => setEditingDemand({...editingDemand, startDate: e.target.value})}
                          disabled={!isEditing}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Data de Conclusão</label>
                        <input 
                          type="date"
                          className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                          value={editingDemand.closedAt || ''}
                          onChange={e => setEditingDemand({...editingDemand, closedAt: e.target.value})}
                          disabled={!isEditing}
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="block text-xs font-bold text-slate-400 uppercase">Status</label>
                      <div className="flex gap-2">
                        {['Não Iniciado', 'Em andamento', 'Concluído'].map(status => (
                          <button
                            key={status}
                            type="button"
                            disabled={!isEditing}
                            onClick={() => setEditingDemand({...editingDemand, status: status as any})}
                            className={cn(
                              "px-4 py-2 rounded-xl text-sm font-bold transition-all",
                              editingDemand.status === status 
                                ? "bg-blue-600 text-white shadow-lg shadow-blue-200" 
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                              !isEditing && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </div>

                    {editingDemand.needsMaterial && editingDemand.materialRequisition && (
                      <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                        <h4 className="text-xs font-bold text-blue-700 uppercase mb-3 flex items-center gap-2">
                          <Package className="w-4 h-4" />
                          Requisição de Material
                        </h4>
                        <div className="grid grid-cols-1 gap-2 text-sm">
                          <p><span className="text-blue-400 font-medium">Item:</span> {editingDemand.materialRequisition.item}</p>
                          <p><span className="text-blue-400 font-medium">Nº:</span> {editingDemand.materialRequisition.requisitionNumber}</p>
                          <p><span className="text-blue-400 font-medium">Entrega:</span> {format(safeParseISO(editingDemand.materialRequisition.deliveryDate), 'dd/MM/yyyy')}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                        <History className="w-4 h-4" />
                        Histórico de Status
                      </label>
                      <div className="space-y-3">
                        {(Array.isArray(editingDemand.statusHistory) ? editingDemand.statusHistory : []).map((h, i) => (
                          <div key={h.id} className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <div className={cn(
                                "w-2 h-2 rounded-full mt-1.5",
                                i === 0 ? "bg-blue-600" : "bg-slate-300"
                              )} />
                              {i < (Array.isArray(editingDemand.statusHistory) ? editingDemand.statusHistory : []).length - 1 && <div className="w-0.5 flex-1 bg-slate-100 my-1" />}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900">{h.status}</p>
                              <p className="text-[10px] text-slate-400">
                                {format(safeParseISO(h.date), 'dd/MM/yyyy HH:mm')} por {h.user}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="block text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                          <Pencil className="w-4 h-4" />
                          Alterações de Escopo
                        </label>
                      </div>
                      <div className="flex gap-2 mb-3">
                        <input
                          type="text"
                          placeholder="Descreva a alteração..."
                          className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                          id="new-scope-change"
                        />
                        <button 
                          onClick={async () => {
                            const input = document.getElementById('new-scope-change') as HTMLInputElement;
                            if (input && input.value && editingDemand) {
                              const description = input.value;
                              
                              const newScopeEntry = {
                                id: Math.random().toString(36).substr(2, 9),
                                description,
                                date: new Date().toISOString(),
                                user: userProfile?.displayName || 'Usuário'
                              };
                              
                              const updatedDemand = {
                                ...editingDemand,
                                scopeChanges: [...(Array.isArray(editingDemand.scopeChanges) ? editingDemand.scopeChanges : []), newScopeEntry]
                              };
                              
                              // Update local state immediately
                              setEditingDemand(updatedDemand);
                              
                              // If not in edit mode, persist immediately
                              if (!isEditing) {
                                try {
                                  await onAddScopeChange(editingDemand.id, description);
                                } catch (error) {
                                  console.error('Error adding scope change:', error);
                                  showToast('Erro ao adicionar alteração de escopo', 'error');
                                }
                              }
                              
                              input.value = '';
                            }
                          }}
                          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all"
                        >
                          Adicionar
                        </button>
                      </div>
                      <div className="space-y-3">
                        {(Array.isArray(editingDemand.scopeChanges) ? editingDemand.scopeChanges : []).length > 0 ? (
                          (Array.isArray(editingDemand.scopeChanges) ? editingDemand.scopeChanges : []).map((s) => (
                            <div key={s.id} className="p-3 bg-slate-50 rounded-xl">
                              <p className="text-sm text-slate-700 mb-1">{s.description}</p>
                              <p className="text-[10px] text-slate-400">
                                {format(safeParseISO(s.date), 'dd/MM/yyyy')} por {s.user}
                              </p>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-slate-400 italic">Nenhuma alteração registrada.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                <button 
                  onClick={() => { setEditingDemand(null); setIsEditing(false); }}
                  className="px-6 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all"
                >
                  Fechar
                </button>
                {isEditing && (
                  <button 
                    onClick={async () => {
                      const totalCost = ((editingDemand.responsibleHoursWorked || 0) * (editingDemand.responsibleHourlyRate || 0) + 
                                        (editingDemand.collaborators || []).reduce((acc, c) => acc + (c.hoursWorked || 0) * (c.hourlyRate || 0), 0));
                      await onSave({ ...editingDemand, totalCost });
                      setEditingDemand(null);
                      setIsEditing(false);
                    }}
                    className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all"
                  >
                    Salvar Alterações
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
