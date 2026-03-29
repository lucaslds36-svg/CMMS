import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  Plus, 
  Search, 
  Pencil, 
  Trash2, 
  Eye
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { EngineeringProject, UserProfile } from '../types';

interface ImprovementManagementModuleProps {
  userProfile: UserProfile | null;
  onSave: (project: Partial<EngineeringProject>) => Promise<void>;
  onDelete: (projectId: string) => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const ImprovementManagementModule = ({
  userProfile,
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
  const [newProject, setNewProject] = useState<Partial<EngineeringProject>>({
    status: 'Planejado',
    testStatus: 'Não iniciado',
    standardize: false
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'engineering-projects'), (snapshot) => {
      const projectsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EngineeringProject));
      setProjects(projectsData);
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async () => {
    if (!newProject.title || !newProject.assetId || !newProject.assetName || !newProject.description || !newProject.objective || !newProject.indicator || !newProject.responsible) {
      showToast('Preencha todos os campos obrigatórios', 'error');
      return;
    }
    await onSave({
      ...newProject,
      startDate: newProject.startDate || new Date().toISOString(),
      plannedTestDays: newProject.plannedTestDays || 0,
      testStatus: newProject.testStatus || 'Não iniciado',
      standardize: newProject.standardize || false,
      createdAt: newProject.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as EngineeringProject);
    setShowNewModal(false);
    setSelectedProject(null);
    setModalMode(null);
    setNewProject({ status: 'Planejado', testStatus: 'Não iniciado', standardize: false });
  };

  const openModal = (project: EngineeringProject | null, mode: 'view' | 'edit' | 'create') => {
    if (mode === 'view') {
      setSelectedProject(project);
      setModalMode('view');
    } else {
      setSelectedProject(project);
      setModalMode(mode);
      setNewProject(project || { status: 'Planejado', testStatus: 'Não iniciado', standardize: false });
      setShowNewModal(true);
    }
  };

  const startTest = async (project: EngineeringProject) => {
    await updateDoc(doc(db, 'engineering-projects', project.id), {
      testStartDate: new Date().toISOString(),
      testStatus: 'Em teste'
    });
  };

  const finishTest = async (project: EngineeringProject, result: 'Sucesso' | 'Parcial' | 'Falha') => {
    await updateDoc(doc(db, 'engineering-projects', project.id), {
      testStatus: result === 'Sucesso' ? 'Aprovado' : 'Reprovado',
      result: result
    });
  };

  const [activeSubModal, setActiveSubModal] = useState<{type: 'task' | 'adjustment' | 'indicator' | 'comment', mode: 'create' | 'edit', data?: any} | null>(null);
  const [subItemData, setSubItemData] = useState<any>({});

  useEffect(() => {
    if (activeSubModal?.mode === 'edit') {
      setSubItemData(activeSubModal.data);
    } else {
      setSubItemData({});
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
      t.id === taskId ? { ...t, status: newStatus, completedDate: newStatus === 'Concluído' ? new Date().toISOString() : t.completedDate } : t
    ) || [];
    await updateDoc(doc(db, 'engineering-projects', selectedProject.id), {
      tasks: updatedTasks,
      updatedAt: new Date().toISOString()
    });
  };

  const handleSaveSubItem = async () => {
    if (!selectedProject || !activeSubModal) return;
    const { type, mode, data } = activeSubModal;
    const collectionName = type === 'task' ? 'tasks' : type === 'adjustment' ? 'adjustments' : 'indicators';
    
    let itemToSave = { ...subItemData };
    if (type === 'indicator') {
      const before = parseFloat(subItemData.before || 0);
      const after = parseFloat(subItemData.after || 0);
      const variation = before !== 0 ? ((after - before) / before) * 100 : 0;
      itemToSave = {
        ...itemToSave,
        before,
        after,
        variation: parseFloat(variation.toFixed(2))
      };
    }

    let updatedList = [...(selectedProject[collectionName as keyof EngineeringProject] as any[] || [])];
    
    if (mode === 'create') {
      updatedList.push({ ...itemToSave, id: Math.random().toString(36).substr(2, 9) });
    } else {
      updatedList = updatedList.map(item => item.id === data.id ? { ...item, ...itemToSave } : item);
    }
    
    await updateDoc(doc(db, 'engineering-projects', selectedProject.id), {
      [collectionName]: updatedList,
      updatedAt: new Date().toISOString()
    });
    setActiveSubModal(null);
    setSubItemData({});
  };

  const renderSubItemModal = () => {
    if (!activeSubModal) return null;
    const { type, mode, data } = activeSubModal;
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-3xl w-full max-w-md space-y-4">
          <h3 className="text-xl font-bold">{mode === 'create' ? 'Adicionar' : 'Editar'} {type}</h3>
          {type === 'task' && (
            <>
              <input placeholder="Nome da Tarefa" value={subItemData?.name || ''} className="w-full p-3 border rounded-xl" onChange={e => setSubItemData({...subItemData, name: e.target.value})} />
              <input placeholder="Responsável" value={subItemData?.responsible || ''} className="w-full p-3 border rounded-xl" onChange={e => setSubItemData({...subItemData, responsible: e.target.value})} />
              <input type="date" value={subItemData?.plannedDate || ''} className="w-full p-3 border rounded-xl" onChange={e => setSubItemData({...subItemData, plannedDate: e.target.value})} />
            </>
          )}
          {type === 'indicator' && (
            <>
              <input placeholder="Nome do Indicador" value={subItemData?.name || ''} className="w-full p-3 border rounded-xl" onChange={e => setSubItemData({...subItemData, name: e.target.value})} />
              <input placeholder="Antes" value={subItemData?.before || ''} className="w-full p-3 border rounded-xl" onChange={e => setSubItemData({...subItemData, before: e.target.value})} />
              <input placeholder="Depois" value={subItemData?.after || ''} className="w-full p-3 border rounded-xl" onChange={e => setSubItemData({...subItemData, after: e.target.value})} />
            </>
          )}
          {type === 'adjustment' && (
            <>
              <input placeholder="Descrição" value={subItemData?.description || ''} className="w-full p-3 border rounded-xl" onChange={e => setSubItemData({...subItemData, description: e.target.value})} />
              <input placeholder="Responsável" value={subItemData?.responsible || ''} className="w-full p-3 border rounded-xl" onChange={e => setSubItemData({...subItemData, responsible: e.target.value})} />
              <input type="date" value={subItemData?.date || ''} className="w-full p-3 border rounded-xl" onChange={e => setSubItemData({...subItemData, date: e.target.value})} />
            </>
          )}
          <div className="flex justify-end gap-2">
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

  if (selectedProject && modalMode === 'view') {
    const testDays = selectedProject.testStartDate ? differenceInDays(new Date(), new Date(selectedProject.testStartDate)) : 0;
    
    return (
      <div className="p-6 space-y-6 bg-slate-100 min-h-screen">
        <button onClick={() => {setSelectedProject(null); setModalMode(null);}} className="text-slate-500 hover:text-slate-900">← Voltar</button>
        
        {/* Header */}
        <div className="bg-white p-6 rounded-3xl shadow-sm flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{selectedProject.title}</h2>
            <div className="flex gap-4 text-sm text-slate-600 mt-2">
              <p>Equipamento: <span className="font-bold">{selectedProject.assetName}</span></p>
              <p>Responsável: <span className="font-bold">{selectedProject.responsible}</span></p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <select 
              className="px-4 py-2 rounded-full text-sm font-bold border border-slate-200"
              value={selectedProject.status}
              onChange={async (e) => {
                const newStatus = e.target.value;
                await updateDoc(doc(db, 'engineering-projects', selectedProject.id), {
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
        <div className="grid grid-cols-2 gap-6">
          {/* Card: Descrição */}
          <div className="bg-white p-6 rounded-3xl shadow-sm space-y-4">
            <h3 className="font-bold text-lg">Descrição do Projeto</h3>
            <p><span className="font-bold">Problema:</span> {selectedProject.description}</p>
            <p><span className="font-bold">Objetivo:</span> {selectedProject.objective}</p>
            <p><span className="font-bold">Indicador:</span> {selectedProject.indicator}</p>
          </div>

          {/* Card: Controle de Teste */}
          <div className="bg-white p-6 rounded-3xl shadow-sm space-y-4">
            <h3 className="font-bold text-lg">Controle de Teste</h3>
            <p>Início do Teste: {selectedProject.testStartDate ? format(new Date(selectedProject.testStartDate), 'dd/MM/yyyy') : '-'}</p>
            <p>Tempo Planejado: {selectedProject.plannedTestDays} dias</p>
            <p>Tempo em Teste: {testDays} dias</p>
            <div className="flex gap-2">
              <button onClick={() => startTest(selectedProject)} className="bg-blue-600 text-white px-4 py-2 rounded-xl">Iniciar Teste</button>
              <button onClick={() => finishTest(selectedProject, 'Sucesso')} className="bg-emerald-600 text-white px-4 py-2 rounded-xl">Finalizar (Sucesso)</button>
            </div>
          </div>

          {/* Card: Plano de Ação */}
          <div className="bg-white p-6 rounded-3xl shadow-sm col-span-2">
            <h3 className="font-bold text-lg mb-4">Plano de Ação</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="pb-2">Tarefa</th>
                  <th className="pb-2">Responsável</th>
                  <th className="pb-2">Data Prevista</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {selectedProject.tasks?.map(task => (
                  <tr key={task.id} onClick={() => setActiveSubModal({type: 'task', mode: 'edit', data: task})} className="cursor-pointer hover:bg-slate-50">
                    <td className="py-3">{task.name}</td>
                    <td className="py-3">{task.responsible}</td>
                    <td className="py-3">{task.plannedDate ? format(new Date(task.plannedDate), 'dd/MM/yyyy') : '-'}</td>
                    <td className="py-3" onClick={(e) => e.stopPropagation()}>
                      <select 
                        value={task.status}
                        onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value as any)}
                        className={`px-2 py-1 rounded text-xs font-bold border-none outline-none cursor-pointer ${
                          task.status === 'Concluído' ? 'bg-emerald-100 text-emerald-700' : 
                          task.status === 'Em andamento' ? 'bg-blue-100 text-blue-700' : 
                          'bg-slate-100 text-slate-700'
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
            <button onClick={() => setActiveSubModal({type: 'task', mode: 'create'})} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold">+ Adicionar Tarefa</button>
          </div>

          {/* Card: Indicadores */}
          <div className="bg-white p-6 rounded-3xl shadow-sm">
            <h3 className="font-bold text-lg mb-4">Indicadores</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="pb-2">Indicador</th>
                  <th className="pb-2">Antes</th>
                  <th className="pb-2">Depois</th>
                  <th className="pb-2">Variação</th>
                </tr>
              </thead>
              <tbody>
                {selectedProject.indicators?.map(ind => (
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
              {selectedProject.adjustments?.map(adj => (
                <li key={adj.id} onClick={() => setActiveSubModal({type: 'adjustment', mode: 'edit', data: adj})} className="border-b pb-2 cursor-pointer hover:bg-slate-50">
                  {adj.date ? format(new Date(adj.date), 'dd/MM/yyyy') : '-'} - {adj.description} - {adj.responsible}
                </li>
              ))}
            </ul>
            <button onClick={() => setActiveSubModal({type: 'adjustment', mode: 'create'})} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold">+ Adicionar Ajuste</button>
          </div>
          
          {activeSubModal && renderSubItemModal()}

          {/* Card: Encerramento */}
          <div className="bg-white p-6 rounded-3xl shadow-sm col-span-2 space-y-4">
            <h3 className="font-bold text-lg">Encerramento</h3>
            <select 
              className="w-full p-3 border rounded-xl"
              value={selectedProject.result || ''}
              onChange={e => setSelectedProject({...selectedProject, result: e.target.value})}
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
              value={selectedProject.lessonsLearned || ''}
              onChange={e => setSelectedProject({...selectedProject, lessonsLearned: e.target.value})}
            />
            <label className="flex items-center gap-2">
              <input 
                type="checkbox" 
                checked={selectedProject.standardize || false}
                onChange={e => setSelectedProject({...selectedProject, standardize: e.target.checked})}
              /> Padronizar Solução
            </label>
            <button 
              onClick={async () => {
                await updateDoc(doc(db, 'engineering-projects', selectedProject.id), {
                  result: selectedProject.result || '',
                  lessonsLearned: selectedProject.lessonsLearned || '',
                  standardize: selectedProject.standardize || false,
                  updatedAt: new Date().toISOString()
                });
                alert('Encerramento salvo com sucesso!');
              }}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold"
            >
              Salvar Encerramento
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">Gestão de Melhorias</h2>
        <button 
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700"
          onClick={() => openModal(null, 'create')}
        >
          <Plus className="w-5 h-5" /> Novo Projeto
        </button>
      </div>

      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-3xl w-full max-w-lg space-y-4">
            <h3 className="text-xl font-bold">
              {modalMode === 'create' ? 'Novo Projeto de Melhoria' : 'Editar Projeto'}
            </h3>
            <input 
              placeholder="Título" 
              className="w-full p-3 border rounded-xl"
              value={newProject.title || ''}
              onChange={e => setNewProject({...newProject, title: e.target.value})}
            />
            <input 
              placeholder="ID do Ativo" 
              className="w-full p-3 border rounded-xl"
              value={newProject.assetId || ''}
              onChange={e => setNewProject({...newProject, assetId: e.target.value})}
            />
            <input 
              placeholder="Nome do Ativo" 
              className="w-full p-3 border rounded-xl"
              value={newProject.assetName || ''}
              onChange={e => setNewProject({...newProject, assetName: e.target.value})}
            />
            <input 
              placeholder="Descrição" 
              className="w-full p-3 border rounded-xl"
              value={newProject.description || ''}
              onChange={e => setNewProject({...newProject, description: e.target.value})}
            />
            <input 
              placeholder="Objetivo" 
              className="w-full p-3 border rounded-xl"
              value={newProject.objective || ''}
              onChange={e => setNewProject({...newProject, objective: e.target.value})}
            />
            <input 
              placeholder="Indicador" 
              className="w-full p-3 border rounded-xl"
              value={newProject.indicator || ''}
              onChange={e => setNewProject({...newProject, indicator: e.target.value})}
            />
            <input 
              type="number"
              placeholder="Dias Planejados para Teste" 
              className="w-full p-3 border rounded-xl"
              value={newProject.plannedTestDays || ''}
              onChange={e => setNewProject({...newProject, plannedTestDays: parseInt(e.target.value)})}
            />
            <input 
              placeholder="Responsável" 
              className="w-full p-3 border rounded-xl"
              value={newProject.responsible || ''}
              onChange={e => setNewProject({...newProject, responsible: e.target.value})}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => {setShowNewModal(false); setSelectedProject(null); setModalMode(null);}} className="px-4 py-2 text-slate-600">
                Cancelar
              </button>
              <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-xl">Salvar</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold">
            <tr>
              <th className="px-6 py-4 text-left">Projeto</th>
              <th className="px-6 py-4 text-left">Equipamento</th>
              <th className="px-6 py-4 text-left">Status</th>
              <th className="px-6 py-4 text-left">Responsável</th>
              <th className="px-6 py-4 text-left">Início</th>
              <th className="px-6 py-4 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {projects.map(project => (
              <tr key={project.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-bold text-slate-900">{project.title}</td>
                <td className="px-6 py-4 text-slate-600">{project.assetName}</td>
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
                    <button 
                      className="p-1.5 bg-amber-500 text-white rounded hover:bg-amber-600"
                      onClick={() => openModal(project, 'edit')}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 bg-rose-500 text-white rounded hover:bg-rose-600" onClick={() => onDelete(project.id)}>
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
  );
};
