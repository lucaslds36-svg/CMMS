import React, { useState, useEffect, useMemo } from 'react';
import { 
  auth,
  db,
  subscribeToCollection,
  createDocument,
  updateDocument,
  deleteDocument
} from '../firebase';
import { 
  Plus, 
  Search, 
  Pencil, 
  Trash2, 
  Eye,
  Clock,
  Download,
  Box
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { EngineeringProject, UserProfile, Employee, Asset } from '../types';

interface ImprovementManagementModuleProps {
  userProfile: UserProfile | null;
  employees: Employee[];
  assets: Asset[];
  onSave: (project: Partial<EngineeringProject>) => Promise<void>;
  onDelete: (projectId: string) => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const ImprovementManagementModule = ({
  userProfile,
  employees,
  assets,
  onSave,
  onDelete,
  showToast
}: ImprovementManagementModuleProps) => {
  const [projects, setProjects] = useState<EngineeringProject[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('Todos');
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<EngineeringProject | null>(null);
  const [modalMode, setModalMode] = useState<'view' | 'edit' | 'create' | null>(null);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const initialProjectState: Partial<EngineeringProject> = {
    title: '',
    description: '',
    objective: '',
    indicator: '',
    plannedTestDays: 0,
    status: 'Planejado',
    testStatus: 'Não iniciado',
    standardize: false,
    scope: 'specific',
    assets: [],
    responsible: '',
    responsibleId: '',
    startDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    investmentValue: 0
  };

  const [newProject, setNewProject] = useState<Partial<EngineeringProject>>(initialProjectState);
  
  const models = useMemo(() => Array.from(new Set(assets.map(a => a.Model))), [assets]);
  const filteredAssets = useMemo(() => assets.filter(a => selectedModels.length === 0 || selectedModels.includes(a.Model)), [assets, selectedModels]);

  useEffect(() => {
    const unsubscribe = subscribeToCollection<EngineeringProject>('engineering-projects', (data) => {
      setProjects(data);
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async () => {
    if (!newProject.title || !newProject.assets || newProject.assets.length === 0 || !newProject.description || !newProject.objective || !newProject.indicator || !newProject.responsible) {
      showToast('Preencha todos os campos obrigatórios', 'error');
      return;
    }
    
    try {
      const firstAsset = newProject.assets?.[0];
      const projectToSave = sanitize({
        ...newProject,
        assetId: firstAsset?.id || '',
        assetName: firstAsset?.tag || '',
        startDate: newProject.startDate || new Date().toISOString(),
        plannedTestDays: newProject.plannedTestDays || 0,
        testStatus: newProject.testStatus || 'Não iniciado',
        standardize: newProject.standardize || false,
        scope: newProject.scope || 'specific',
        createdAt: newProject.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: newProject.createdBy || userProfile?.uid
      });

      await onSave(projectToSave as EngineeringProject);
      setShowNewModal(false);
      setSelectedProject(null);
      setModalMode(null);
      setNewProject(initialProjectState);
    } catch (error) {
      console.error('Error in handleSave:', error);
      showToast('Erro ao salvar projeto', 'error');
    }
  };

  const openModal = (project: EngineeringProject | null, mode: 'view' | 'edit' | 'create') => {
    if (mode === 'view') {
      setSelectedProject(project);
      setModalMode('view');
    } else {
      setSelectedProject(project);
      setModalMode(mode);
      setNewProject(project ? { ...initialProjectState, ...project, assets: project.assets || [] } : initialProjectState);
      setShowNewModal(true);
    }
  };

  const startTest = async (project: EngineeringProject) => {
    try {
      await updateDocument('engineering-projects', project.id, {
        testStartDate: new Date().toISOString(),
        testStatus: 'Em teste',
        status: 'Em teste',
        updatedAt: new Date().toISOString()
      });
      showToast('Teste iniciado com sucesso!', 'success');
    } catch (error) {
      console.error('Error starting test:', error);
      showToast('Erro ao iniciar teste', 'error');
    }
  };

  const finishTest = async (project: EngineeringProject, result: 'Sucesso' | 'Parcial' | 'Falha') => {
    try {
      await updateDocument('engineering-projects', project.id, {
        testStatus: result === 'Sucesso' ? 'Aprovado' : 'Reprovado',
        status: result === 'Sucesso' ? 'Validado' : 'Em execução',
        result: result,
        updatedAt: new Date().toISOString()
      });
      showToast('Teste finalizado com sucesso!', 'success');
    } catch (error) {
      console.error('Error finishing test:', error);
      showToast('Erro ao finalizar teste', 'error');
    }
  };

  const [activeSubModal, setActiveSubModal] = useState<{type: 'task' | 'adjustment' | 'indicator' | 'comment', mode: 'create' | 'edit', data?: any} | null>(null);
  const [subItemData, setSubItemData] = useState<any>({});

  useEffect(() => {
    if (activeSubModal?.mode === 'edit') {
      setSubItemData(activeSubModal.data);
    } else {
      if (activeSubModal?.type === 'task') {
        setSubItemData({ name: '', responsible: '', plannedDate: '', investmentValue: 0 });
      } else if (activeSubModal?.type === 'indicator') {
        setSubItemData({ name: '', before: 0, after: 0 });
      } else if (activeSubModal?.type === 'adjustment') {
        setSubItemData({ description: '', responsible: '', date: '' });
      } else {
        setSubItemData({});
      }
    }
  }, [activeSubModal]);

  useEffect(() => {
    if (selectedProject) {
      const updated = projects.find(p => p.id === selectedProject.id);
      if (updated) setSelectedProject(updated);
    }
  }, [projects]);

  const sanitize = (data: any) => {
    const clean = { ...data };
    Object.keys(clean).forEach(key => {
      if (clean[key] === undefined) delete clean[key];
    });
    return clean;
  };

  const handleUpdateTaskStatus = async (taskId: string, newStatus: 'Pendente' | 'Em andamento' | 'Concluído') => {
    if (!selectedProject) return;
    const updatedTasks = selectedProject.tasks?.map(t => 
      t.id === taskId ? { 
        ...t, 
        status: newStatus, 
        completedDate: newStatus === 'Concluído' ? new Date().toISOString() : (t.completedDate || null) 
      } : t
    ) || [];
    
    // Sanitize each task in the list
    const sanitizedTasks = updatedTasks.map(task => sanitize(task));

    await updateDocument('engineering-projects', selectedProject.id, {
      tasks: sanitizedTasks,
      updatedAt: new Date().toISOString()
    });
  };

  const handleSaveSubItem = async () => {
    if (!selectedProject || !activeSubModal) return;
    const { type, mode, data } = activeSubModal;
    const collectionName = type === 'task' ? 'tasks' : type === 'adjustment' ? 'adjustments' : 'indicators';
    
    let itemToSave = sanitize({ ...subItemData });
    if (type === 'indicator') {
      const before = parseFloat(subItemData.before || 0);
      const after = parseFloat(subItemData.after || 0);
      const variation = before !== 0 ? ((after - before) / before) * 100 : 0;
      itemToSave = {
        ...itemToSave,
        before,
        after,
        variation: Number.isNaN(variation) ? 0 : parseFloat(variation.toFixed(2))
      };
    }

    let updatedList = [...(selectedProject[collectionName as keyof EngineeringProject] as any[] || [])];
    
    if (mode === 'create') {
      updatedList.push({ ...itemToSave, id: Math.random().toString(36).substr(2, 9) });
    } else {
      updatedList = updatedList.map(item => item.id === data.id ? { ...item, ...itemToSave } : item);
    }
    
    // Sanitize the entire list before saving
    const sanitizedList = updatedList.map(item => sanitize(item));

    await updateDocument('engineering-projects', selectedProject.id, {
      [collectionName]: sanitizedList,
      updatedAt: new Date().toISOString()
    });
    setActiveSubModal(null);
    setSubItemData({});
  };

  const filteredProjects = useMemo(() => {
    return projects.filter(project => {
      const matchesSearch = (project.title || '').toLowerCase().includes(search.toLowerCase()) || 
                           (project.responsible || '').toLowerCase().includes(search.toLowerCase());
      const matchesStatus = filterStatus === 'Todos' || project.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [projects, search, filterStatus]);

  const renderSubItemModal = () => {
    if (!activeSubModal) return null;
    const { type, mode, data } = activeSubModal;
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white p-6 rounded-3xl w-full max-w-md flex flex-col max-h-full">
          <h3 className="text-xl font-bold shrink-0">{mode === 'create' ? 'Adicionar' : 'Editar'} {type}</h3>
          <div className="space-y-4 overflow-y-auto py-4 flex-1 min-h-0">
            {type === 'task' && (
              <>
                <input placeholder="Nome da Tarefa" value={subItemData?.name || ''} className="w-full p-3 border rounded-xl" onChange={e => setSubItemData({...subItemData, name: e.target.value})} />
                <input placeholder="Responsável" value={subItemData?.responsible || ''} className="w-full p-3 border rounded-xl" onChange={e => setSubItemData({...subItemData, responsible: e.target.value})} />
                <input type="date" value={subItemData?.plannedDate || ''} className="w-full p-3 border rounded-xl" onChange={e => setSubItemData({...subItemData, plannedDate: e.target.value})} />
                <input type="number" placeholder="Valor do Investimento (R$)" value={Number.isNaN(subItemData?.investmentValue) ? '' : (subItemData?.investmentValue ?? '')} className="w-full p-3 border rounded-xl" onChange={e => setSubItemData({...subItemData, investmentValue: parseFloat(e.target.value) || 0})} />
              </>
            )}
            {type === 'indicator' && (
              <>
                <input placeholder="Nome do Indicador" value={subItemData?.name || ''} className="w-full p-3 border rounded-xl" onChange={e => setSubItemData({...subItemData, name: e.target.value})} />
                <input type="number" placeholder="Antes" value={Number.isNaN(subItemData?.before) ? '' : (subItemData?.before ?? '')} className="w-full p-3 border rounded-xl" onChange={e => setSubItemData({...subItemData, before: parseFloat(e.target.value) || 0})} />
                <input type="number" placeholder="Depois" value={Number.isNaN(subItemData?.after) ? '' : (subItemData?.after ?? '')} className="w-full p-3 border rounded-xl" onChange={e => setSubItemData({...subItemData, after: parseFloat(e.target.value) || 0})} />
              </>
            )}
            {type === 'adjustment' && (
              <>
                <input placeholder="Descrição" value={subItemData?.description || ''} className="w-full p-3 border rounded-xl" onChange={e => setSubItemData({...subItemData, description: e.target.value})} />
                <input placeholder="Responsável" value={subItemData?.responsible || ''} className="w-full p-3 border rounded-xl" onChange={e => setSubItemData({...subItemData, responsible: e.target.value})} />
                <input type="date" value={subItemData?.date || ''} className="w-full p-3 border rounded-xl" onChange={e => setSubItemData({...subItemData, date: e.target.value})} />
              </>
            )}
          </div>
          <div className="flex justify-end gap-2 shrink-0 pt-2 border-t border-slate-100">
            <button onClick={() => setActiveSubModal(null)} className="px-4 py-2 text-slate-600">Cancelar</button>
            <button onClick={handleSaveSubItem} className="px-4 py-2 bg-blue-600 text-white rounded-xl">Salvar</button>
          </div>
        </div>
      </div>
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Planejado': return 'bg-slate-100 text-slate-700';
      case 'Em execução': return 'bg-amber-100 text-amber-700';
      case 'Em teste': return 'bg-blue-100 text-blue-700';
      case 'Validado': return 'bg-emerald-100 text-emerald-700';
      case 'Cancelado': return 'bg-rose-100 text-rose-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const generatePDF = (project: EngineeringProject) => {
    const doc = new jsPDF();
    const assetsCount = project.assets?.length || 1;
    const sumTasksInvestment = project.tasks?.reduce((sum, task) => sum + (task.investmentValue || 0), 0) || 0;
    const total = sumTasksInvestment * assetsCount;
    
    doc.setFontSize(18);
    doc.setTextColor(30, 64, 175); // Blue-800
    doc.text(`Relatório de Projeto: ${project.title}`, 10, 15);
    
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Responsável: ${project.responsible}`, 10, 25);
    doc.text(`Status: ${project.status}`, 10, 32);
    doc.text(`Escopo: ${project.scope === 'specific' ? 'Equipamento Específico' : 'Todos os Equipamentos'}`, 10, 39);
    doc.text(`Data de Início: ${project.startDate ? format(new Date(project.startDate), 'dd/MM/yyyy') : '-'}`, 10, 46);
    
    doc.setFontSize(14);
    doc.text('Descrição e Objetivos', 10, 60);
    doc.setFontSize(10);
    doc.text(`Problema: ${project.description}`, 10, 67, { maxWidth: 180 });
    doc.text(`Objetivo: ${project.objective}`, 10, 77, { maxWidth: 180 });
    doc.text(`Indicador Principal: ${project.indicator}`, 10, 87);
    
    let y = 100;

    // Equipamentos Table
    doc.setFontSize(14);
    doc.text('Equipamentos do Projeto', 10, y);
    autoTable(doc, {
      head: [['TAG', 'Modelo', 'Descrição']],
      body: project.assets?.map(a => [a.tag, a.model, a.description]) || [[project.assetName, '-', '-']],
      startY: y + 5,
      headStyles: { fillColor: [30, 64, 175] }
    });
    y = (doc as any).lastAutoTable.finalY + 15;

    // Tasks Table
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Plano de Ação e Investimentos', 10, y);
    doc.setFont('helvetica', 'normal');
    
    autoTable(doc, {
      head: [['Tarefa', 'Responsável', 'Data Planejada', 'Investimento Unit.', 'Investimento Total']],
      body: project.tasks?.map(t => [
        t.name, 
        t.responsible, 
        t.plannedDate ? format(new Date(t.plannedDate), 'dd/MM/yyyy') : '-', 
        `R$ ${t.investmentValue?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}`,
        `R$ ${((t.investmentValue || 0) * assetsCount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      ]) || [],
      startY: y + 5,
      headStyles: { 
        fillColor: [30, 64, 175],
        fontSize: 10,
        halign: 'center'
      },
      columnStyles: {
        3: { halign: 'right' },
        4: { halign: 'right' }
      },
      styles: { fontSize: 9 }
    });
    
    y = (doc as any).lastAutoTable.finalY + 10;
    
    // Check for page break before summary box
    if (y > 240) {
      doc.addPage();
      y = 20;
    }

    // Investment Summary Box
    const summaryWidth = 85;
    const summaryX = 200 - summaryWidth; 
    
    doc.setFillColor(255, 255, 255); // White background
    doc.setDrawColor(241, 245, 249); // slate-100
    doc.roundedRect(summaryX, y, summaryWidth, 32, 3, 3, 'FD');
    
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.setFont('helvetica', 'normal');
    doc.text('Soma das Etapas:', summaryX + 5, y + 8);
    doc.text('Quantidade de Equipamentos:', summaryX + 5, y + 16);
    
    doc.setTextColor(30, 41, 59); // slate-900
    doc.setFont('helvetica', 'bold');
    doc.text(`R$ ${sumTasksInvestment.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 195, y + 8, { align: 'right' });
    doc.text(`${assetsCount}`, 195, y + 16, { align: 'right' });
    
    doc.setDrawColor(241, 245, 249);
    doc.line(summaryX + 5, y + 20, 195, y + 20);
    
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59); // slate-900
    doc.text('Investimento Total:', summaryX + 5, y + 27);
    doc.text(`R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 195, y + 27, { align: 'right' });
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    
    y += 45;

    // Indicators Table
    if (project.indicators && project.indicators.length > 0) {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFontSize(14);
      doc.text('Indicadores de Desempenho', 10, y);
      autoTable(doc, {
        head: [['Indicador', 'Antes', 'Depois', 'Variação']],
        body: project.indicators.map(i => [i.name, i.before, i.after, `${i.variation}%`]),
        startY: y + 5,
        headStyles: { fillColor: [30, 64, 175] }
      });
      y = (doc as any).lastAutoTable.finalY + 15;
    }

    if (project.lessonsLearned) {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFontSize(14);
      doc.text('Encerramento e Lições Aprendidas', 10, y);
      doc.setFontSize(10);
      doc.text(`Resultado: ${project.result || '-'}`, 10, y + 7);
      doc.text(`Lições: ${project.lessonsLearned}`, 10, y + 14, { maxWidth: 180 });
    }
    
    doc.save(`relatorio_melhoria_${project.title.replace(/\s+/g, '_')}.pdf`);
  };

  if (selectedProject && modalMode === 'view') {
    const projectFromList = projects.find(p => p.id === selectedProject.id);
    const project = projectFromList || selectedProject;
    
    const testStartDate = project.testStartDate ? new Date(project.testStartDate) : null;
    const testDays = testStartDate && !isNaN(testStartDate.getTime()) ? differenceInDays(new Date(), testStartDate) : 0;
    const assetsCount = project.assets?.length || 1;
    const sumTasksInvestment = project.tasks?.reduce((sum, task) => sum + (task.investmentValue || 0), 0) || 0;
    const totalInvestment = sumTasksInvestment * assetsCount;
    
    return (
      <div className="p-4 sm:p-6 space-y-6 bg-slate-100 min-h-screen">
        <button onClick={() => {setSelectedProject(null); setModalMode(null);}} className="text-slate-500 hover:text-slate-900">← Voltar</button>
        
        {/* Header */}
        <div className="bg-white p-6 rounded-3xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{project.title}</h2>
            <div className="flex gap-4 text-sm text-slate-600 mt-2">
              <p>Responsável: <span className="font-bold">{project.responsible}</span></p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => generatePDF(project)}
              className="px-4 py-2 bg-slate-800 text-white rounded-full text-sm font-bold flex items-center gap-2 hover:bg-slate-900"
            >
              <Download className="w-4 h-4" /> Relatório PDF
            </button>
            <select 
              className="px-4 py-2 rounded-full text-sm font-bold border border-slate-200"
              value={project.status ?? 'Planejado'}
              onChange={async (e) => {
                const newStatus = e.target.value;
                await updateDocument('engineering-projects', project.id, {
                  status: newStatus,
                  updatedAt: new Date().toISOString()
                });
              }}
            >
              <option value="Planejado">Planejado</option>
              <option value="Em execução">Em execução</option>
              <option value="Em teste">Em teste</option>
              <option value="Validado">Validado</option>
              <option value="Cancelado">Cancelado</option>
            </select>
          </div>
        </div>

        {/* Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card: Descrição */}
          <div className="bg-white p-6 rounded-3xl shadow-sm space-y-4 border border-slate-100">
            <h3 className="font-bold text-lg text-slate-800">Descrição do Projeto</h3>
            <div className="space-y-3 text-sm">
              <p><span className="font-bold text-slate-700">Problema:</span> <span className="text-slate-600">{project.description}</span></p>
              <p><span className="font-bold text-slate-700">Objetivo:</span> <span className="text-slate-600">{project.objective}</span></p>
              <p><span className="font-bold text-slate-700">Indicador:</span> <span className="text-slate-600">{project.indicator}</span></p>
            </div>
            
            <div className="pt-6 mt-4 border-t border-slate-100 space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-slate-500 text-sm">Soma das Etapas:</p>
                <p className="font-bold text-slate-900">R$ {sumTasksInvestment.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-slate-500 text-sm">Quantidade de Equipamentos:</p>
                <p className="font-bold text-slate-900">{assetsCount}</p>
              </div>
              <div className="pt-4 mt-2 border-t border-slate-100 flex justify-between items-center">
                <p className="font-bold text-lg text-blue-600">Investimento Total:</p>
                <p className="font-bold text-xl text-blue-600">R$ {totalInvestment.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
          </div>

          {/* Card: Controle de Teste */}
          <div className="bg-white p-6 rounded-3xl shadow-sm space-y-4">
            <h3 className="font-bold text-lg">Controle de Teste</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Status do Teste</p>
                <p className={`font-bold ${project.testStatus === 'Em teste' ? 'text-blue-600' : project.testStatus === 'Aprovado' ? 'text-emerald-600' : 'text-slate-700'}`}>
                  {project.testStatus}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Início do Teste</p>
                <p className="font-bold">{project.testStartDate ? format(new Date(project.testStartDate), 'dd/MM/yyyy') : '-'}</p>
              </div>
              <div>
                <p className="text-slate-500">Tempo Planejado</p>
                <p className="font-bold">{project.plannedTestDays} dias</p>
              </div>
              <div>
                <p className="text-slate-500">Tempo Decorrido</p>
                <p className="font-bold">{testDays} dias</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {project.testStatus !== 'Em teste' && project.testStatus !== 'Aprovado' && project.testStatus !== 'Reprovado' ? (
                <button 
                  onClick={() => startTest(project)} 
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2"
                >
                  <Clock className="w-4 h-4" />
                  Iniciar Teste
                </button>
              ) : project.testStatus === 'Em teste' ? (
                <div className="flex flex-wrap gap-2 w-full">
                  <p className="w-full text-xs font-bold text-slate-400 uppercase mb-1">Finalizar teste como:</p>
                  <button 
                    onClick={() => finishTest(project, 'Sucesso')} 
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors"
                  >
                    Sucesso
                  </button>
                  <button 
                    onClick={() => finishTest(project, 'Parcial')} 
                    className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors"
                  >
                    Parcial
                  </button>
                  <button 
                    onClick={() => finishTest(project, 'Falha')} 
                    className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors"
                  >
                    Falha
                  </button>
                </div>
              ) : (
                <div className="bg-slate-50 p-3 rounded-xl w-full border border-slate-100 text-center">
                  <p className="text-sm text-slate-600 font-medium">Teste concluído com resultado: <span className="font-bold text-blue-600">{project.result}</span></p>
                </div>
              )}
            </div>
          </div>

          {/* Card: Plano de Ação */}
          <div className="bg-white rounded-3xl shadow-sm col-span-1 lg:col-span-2 overflow-hidden border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-lg text-slate-800">Plano de Ação e Investimentos</h3>
              <button 
                onClick={() => setActiveSubModal({type: 'task', mode: 'create'})} 
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-sm"
              >
                <Plus className="w-4 h-4" /> Adicionar Tarefa
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="text-left bg-slate-800 text-white">
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[10px]">Tarefa</th>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[10px]">Responsável</th>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[10px]">Data Planejada</th>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[10px]">Investimento Unit.</th>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[10px]">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {project.tasks?.map(task => (
                    <tr key={task.id} onClick={() => setActiveSubModal({type: 'task', mode: 'edit', data: task})} className="group cursor-pointer hover:bg-blue-50/30 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-700">{task.name}</td>
                      <td className="px-6 py-4 text-slate-600">{task.responsible}</td>
                      <td className="px-6 py-4 text-slate-600">
                        {task.plannedDate ? format(new Date(task.plannedDate), 'dd/MM/yyyy') : '-'}
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-700">
                        R$ {task.investmentValue?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                      </td>
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <select 
                          value={task.status ?? 'Pendente'}
                          onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value as any)}
                          className={`px-3 py-1.5 rounded-full text-[10px] font-bold border-none outline-none cursor-pointer transition-all ${
                            task.status === 'Concluído' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 
                            task.status === 'Em andamento' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 
                            'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          <option value="Pendente">Pendente</option>
                          <option value="Em andamento">Em andamento</option>
                          <option value="Concluído">Concluído</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex flex-col items-end space-y-3">
              <div className="flex justify-between w-full max-w-xs text-sm">
                <span className="text-slate-500">Soma das Etapas:</span>
                <span className="font-bold text-slate-900">R$ {sumTasksInvestment.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between w-full max-w-xs text-sm">
                <span className="text-slate-500">Quantidade de Equipamentos:</span>
                <span className="font-bold text-slate-900">{assetsCount}</span>
              </div>
              <div className="pt-4 mt-2 border-t border-slate-200 flex justify-between w-full max-w-xs">
                <span className="font-bold text-slate-900">Investimento Total:</span>
                <span className="font-bold text-slate-900">R$ {totalInvestment.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Card: Indicadores */}
          <div className="bg-white p-6 rounded-3xl shadow-sm overflow-x-auto">
            <h3 className="font-bold text-lg mb-4">Indicadores</h3>
            <table className="w-full text-sm min-w-[400px]">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="pb-2">Indicador</th>
                  <th className="pb-2">Antes</th>
                  <th className="pb-2">Depois</th>
                  <th className="pb-2">Variação</th>
                </tr>
              </thead>
              <tbody>
                {project.indicators?.map(ind => (
                  <tr key={ind.id} onClick={() => setActiveSubModal({type: 'indicator', mode: 'edit', data: ind})} className="cursor-pointer hover:bg-slate-50">
                    <td className="py-3">{ind.name}</td>
                    <td className="py-3">{ind.before}</td>
                    <td className="py-3">{ind.after}</td>
                    <td className={`py-3 font-bold ${ind.variation > 0 ? 'text-emerald-600' : ind.variation < 0 ? 'text-rose-600' : 'text-slate-600'}`}>
                      {ind.variation > 0 ? '+' : ''}{ind.variation}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={() => setActiveSubModal({type: 'indicator', mode: 'create'})} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold">+ Adicionar Indicador</button>
          </div>

          {/* Card: Histórico de Ajustes */}
          <div className="bg-white p-6 rounded-3xl shadow-sm">
            <h3 className="font-bold text-lg mb-4">Histórico de Ajustes</h3>
            <ul className="space-y-2 text-sm">
              {project.adjustments?.map(adj => (
                <li key={adj.id} onClick={() => setActiveSubModal({type: 'adjustment', mode: 'edit', data: adj})} className="border-b pb-2 cursor-pointer hover:bg-slate-50">
                  {adj.date ? format(new Date(adj.date), 'dd/MM/yyyy') : '-'} - {adj.description} - {adj.responsible}
                </li>
              ))}
            </ul>
            <button onClick={() => setActiveSubModal({type: 'adjustment', mode: 'create'})} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold">+ Adicionar Ajuste</button>
          </div>
          
          {activeSubModal && renderSubItemModal()}

          {/* Card: Encerramento */}
          <div className="bg-white p-6 rounded-3xl shadow-sm col-span-1 lg:col-span-2 space-y-4">
            <h3 className="font-bold text-lg">Encerramento</h3>
            <select 
              className="w-full p-3 border rounded-xl"
              value={project.result ?? ''}
              onChange={e => setSelectedProject({...project, result: e.target.value as any})}
            >
              <option value="">Selecione o Resultado</option>
              <option value="Sucesso">Sucesso</option>
              <option value="Parcial">Parcial</option>
              <option value="Falha">Falha</option>
            </select>
            <textarea 
              placeholder="Lições aprendidas" 
              className="w-full p-3 border rounded-xl" 
              rows={3}
              value={project.lessonsLearned ?? ''}
              onChange={e => setSelectedProject({...project, lessonsLearned: e.target.value})}
            />
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <label className="flex items-start gap-3 group cursor-pointer">
                <div className="pt-0.5">
                  <input 
                    type="checkbox" 
                    checked={project.standardize || false}
                    onChange={e => setSelectedProject({...project, standardize: e.target.checked})}
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  /> 
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-800">Padronizar Solução</span>
                  <p className="text-xs text-slate-500 mt-1">
                    Marque esta opção se a melhoria foi validada e deve ser replicada em outros ativos similares como um novo padrão técnico da engenharia.
                  </p>
                </div>
              </label>
            </div>
            <button 
              onClick={async () => {
                if (!project.id) return;
                try {
                  await updateDocument('engineering-projects', project.id, {
                    result: project.result || '',
                    lessonsLearned: project.lessonsLearned || '',
                    standardize: project.standardize || false,
                    updatedAt: new Date().toISOString()
                  });
                  showToast('Encerramento salvo com sucesso!', 'success');
                } catch (error) {
                  console.error('Error saving closure:', error);
                  showToast('Erro ao salvar encerramento', 'error');
                }
              }}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-200"
            >
              Salvar Encerramento
            </button>
          </div>
        </div>

        {/* Card: Equipamentos do Projeto (MOVED TO THE VERY END) */}
        <div className="bg-white p-6 rounded-3xl shadow-sm space-y-4">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Box className="w-5 h-5 text-blue-600" />
            Equipamentos do Projeto
          </h3>
          <div className="space-y-2">
            {project.assets && project.assets.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {project.assets.map((asset, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="font-bold text-slate-900 text-sm">{asset.tag}</p>
                    <p className="text-xs text-slate-500">{asset.model} - {asset.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="font-bold text-slate-900 text-sm">{project.assetName || 'Nenhum equipamento específico'}</p>
                <p className="text-xs text-slate-500">Equipamento principal do projeto</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-900">Gestão de Melhorias</h2>
        <button 
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700"
          onClick={() => openModal(null, 'create')}
        >
          <Plus className="w-5 h-5" /> Novo Projeto
        </button>
      </div>

      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-3xl w-full max-w-lg flex flex-col max-h-full">
            <h3 className="text-xl font-bold shrink-0">
              {modalMode === 'create' ? 'Novo Projeto de Melhoria' : 'Editar Projeto'}
            </h3>
            <div className="space-y-4 overflow-y-auto py-4 flex-1 min-h-0">
              <input 
                placeholder="Título" 
                className="w-full p-3 border rounded-xl"
                value={newProject.title ?? ''}
                onChange={e => setNewProject({...newProject, title: e.target.value})}
              />
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">Modelos</label>
                <div className="max-h-40 overflow-y-auto border rounded-xl p-2">
                  {models.map(model => (
                    <label key={model} className="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={selectedModels.includes(model)}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedModels([...selectedModels, model]);
                          } else {
                            setSelectedModels(selectedModels.filter(m => m !== model));
                          }
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm">{model}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-bold text-slate-700">Ativos</label>
                  <button 
                    type="button"
                    className="text-xs text-blue-600 font-bold"
                    onClick={() => {
                      const allSelected = filteredAssets.every(a => newProject.assets?.some(na => na.id === a.id));
                      let updatedAssets;
                      if (allSelected) {
                        updatedAssets = newProject.assets?.filter(na => !filteredAssets.some(fa => fa.id === na.id));
                      } else {
                        updatedAssets = [...(newProject.assets || [])];
                        filteredAssets.forEach(fa => {
                          if (!updatedAssets.some(na => na.id === fa.id)) {
                            updatedAssets.push({ id: fa.id, tag: fa.Tag, model: fa.Model, description: fa.Description });
                          }
                        });
                      }
                      setNewProject({
                        ...newProject,
                        assets: updatedAssets
                      });
                    }}
                  >
                    {filteredAssets.every(a => newProject.assets?.some(na => na.id === a.id)) ? 'Desmarcar Todos' : 'Selecionar Todos'}
                  </button>
                </div>
                <div className="max-h-40 overflow-y-auto border rounded-xl p-2">
                  {filteredAssets.map(asset => (
                    <label key={asset.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={newProject.assets?.some(a => a.id === asset.id)}
                        onChange={e => {
                          let updatedAssets;
                          if (e.target.checked) {
                            updatedAssets = [...(newProject.assets || []), { id: asset.id, tag: asset.Tag, model: asset.Model, description: asset.Description }];
                          } else {
                            updatedAssets = (newProject.assets || []).filter(a => a.id !== asset.id);
                          }
                          setNewProject({
                            ...newProject,
                            assets: updatedAssets
                          });
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm">{asset.Tag} ({asset.Description})</span>
                    </label>
                  ))}
                </div>
              </div>
              <input 
                placeholder="Descrição" 
                className="w-full p-3 border rounded-xl"
                value={newProject.description ?? ''}
                onChange={e => setNewProject({...newProject, description: e.target.value})}
              />
              <input 
                placeholder="Objetivo" 
                className="w-full p-3 border rounded-xl"
                value={newProject.objective ?? ''}
                onChange={e => setNewProject({...newProject, objective: e.target.value})}
              />
              <input 
                placeholder="Indicador" 
                className="w-full p-3 border rounded-xl"
                value={newProject.indicator ?? ''}
                onChange={e => setNewProject({...newProject, indicator: e.target.value})}
              />
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">Escopo do Investimento</label>
                <select 
                  className="w-full p-3 border rounded-xl"
                  value={newProject.scope ?? 'specific'}
                  onChange={e => setNewProject({...newProject, scope: e.target.value as any})}
                >
                  <option value="specific">Equipamento Específico</option>
                  <option value="all">Todos os Equipamentos</option>
                </select>
              </div>
              <input 
                type="number"
                placeholder="Dias Planejados para Teste" 
                className="w-full p-3 border rounded-xl"
                value={Number.isNaN(newProject.plannedTestDays) ? '' : (newProject.plannedTestDays ?? '')}
                onChange={e => setNewProject({...newProject, plannedTestDays: parseInt(e.target.value) || 0})}
              />
              <div className="space-y-1">
                <input 
                  placeholder="Responsável" 
                  className="w-full p-3 border rounded-xl"
                  value={newProject.responsible ?? ''}
                  onChange={e => setNewProject({...newProject, responsible: e.target.value})}
                />
                <p className="text-[10px] text-slate-500 italic px-1">
                  * Digite o nome do responsável pelo projeto.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 shrink-0 pt-2 border-t border-slate-100">
              <button onClick={() => {setShowNewModal(false); setSelectedProject(null); setModalMode(null);}} className="px-4 py-2 text-slate-600">
                Cancelar
              </button>
              <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-xl">Salvar</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-sm overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold">
            <tr>
              <th className="px-6 py-4 text-left">Projeto</th>
              <th className="px-6 py-4 text-left">Status</th>
              <th className="px-6 py-4 text-left">Responsável</th>
              <th className="px-6 py-4 text-left">Início</th>
              <th className="px-6 py-4 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredProjects.map(project => (
              <tr key={project.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-bold text-slate-900">{project.title}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${getStatusColor(project.status)}`}>
                    {project.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-600">{project.responsible}</td>
                <td className="px-6 py-4 text-slate-600">{project.startDate ? format(new Date(project.startDate), 'dd/MM/yyyy', { locale: ptBR }) : '-'}</td>
                <td className="px-6 py-4 text-center">
                  <div className="flex justify-center gap-2">
                    <button 
                      className="p-1.5 bg-blue-500 text-white rounded hover:bg-blue-600"
                      onClick={() => openModal(project, 'view')}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {(userProfile?.role === 'admin' || 
                      project.createdBy === userProfile?.uid || 
                      employees.find(emp => emp.ID === project.responsibleId)?.userUid === userProfile?.uid ||
                      project.responsibleId === userProfile?.uid) && (
                      <>
                        <button 
                          className="p-1.5 bg-amber-500 text-white rounded hover:bg-amber-600"
                          onClick={() => openModal(project, 'edit')}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 bg-rose-500 text-white rounded hover:bg-rose-600" onClick={() => {
                          if (window.confirm('Tem certeza que deseja excluir este projeto?')) {
                            onDelete(project.id);
                          }
                        }}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
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
