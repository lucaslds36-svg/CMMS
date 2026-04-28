import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Search, Calendar, Tag, Trash2, Edit2, Wrench, X, Download, ClipboardList, User, Eye } from 'lucide-react';
import { cn } from '../lib/utils';
import { format, parseISO } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import { Asset } from '../types';

interface SolutionStep {
  id: string;
  texto: string;
  imagem: string | null;
}

interface Solution {
  id: string;
  titulo: string;
  responsavelAcompanhamento: string;
  maquina: string;
  resumoBreve: string;
  resumoAcao?: string;
  processo?: string;
  tipo: 'Mecânico' | 'Elétrico' | 'Automação' | 'Outros';
  problema: string;
  solucao: string;
  passos: SolutionStep[];
  tags: string[];
  fotoAntes: string | null;
  fotoDepois: string | null;
  data: string;
  observacoes?: string;
}

interface MaintenanceSolutionsModuleProps {
  assets: Asset[];
}

export const MaintenanceSolutionsModule: React.FC<MaintenanceSolutionsModuleProps> = ({ assets }) => {
  const [solutions, setSolutions] = useState<Solution[]>([]);

  // LocalStorage Persistence
  useEffect(() => {
    const saved = localStorage.getItem('manutencao_conhecimento');
    if (saved) {
      try {
        setSolutions(JSON.parse(saved));
      } catch (e) {
        console.error('Erro ao carregar do localStorage', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('manutencao_conhecimento', JSON.stringify(solutions));
  }, [solutions]);

  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingSolution, setViewingSolution] = useState<Solution | null>(null);
  
  // Form State
  const [form, setForm] = useState({
    titulo: '',
    responsavelAcompanhamento: '',
    localizacao: '',
    modelo: '',
    maquina: '',
    resumoBreve: '',
    resumoAcao: '',
    tipo: 'Mecânico' as Solution['tipo'],
    problema: '',
    solucao: '',
    passos: [] as SolutionStep[],
    tags: '',
    observacoes: '',
    fotoAntes: null as string | null,
    fotoDepois: null as string | null,
    data: format(new Date(), 'yyyy-MM-dd HH:mm')
  });

  const resetForm = () => {
    setForm({
      titulo: '',
      responsavelAcompanhamento: '',
      localizacao: '',
      modelo: '',
      maquina: '',
      resumoBreve: '',
      resumoAcao: '',
      tipo: 'Mecânico',
      problema: '',
      solucao: '',
      passos: [],
      tags: '',
      observacoes: '',
      fotoAntes: null,
      fotoDepois: null,
      data: format(new Date(), 'yyyy-MM-dd HH:mm')
    });
    setEditingId(null);
  };

  const addStep = () => {
    setForm({
      ...form,
      passos: [...form.passos, { id: Date.now().toString(), texto: '', imagem: null }]
    });
  };

  const removeStep = (stepId: string) => {
    setForm({
      ...form,
      passos: form.passos.filter(p => p.id !== stepId)
    });
  };

  const updateStep = (stepId: string, updates: Partial<SolutionStep>) => {
    setForm({
      ...form,
      passos: form.passos.map(p => p.id === stepId ? { ...p, ...updates } : p)
    });
  };

  const handleStepImage = (e: React.ChangeEvent<HTMLInputElement>, stepId: string) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateStep(stepId, { imagem: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const startEdit = (solution: Solution) => {
    setEditingId(solution.id);
    setForm({
      titulo: solution.titulo || '',
      responsavelAcompanhamento: solution.responsavelAcompanhamento || '',
      localizacao: '', // Users will re-select or we could try to find it
      modelo: '',
      maquina: solution.maquina,
      resumoBreve: solution.resumoBreve || '',
      resumoAcao: solution.resumoAcao || '',
      tipo: solution.tipo,
      problema: solution.problema,
      solucao: solution.solucao,
      passos: solution.passos || [],
      tags: solution.tags.join(', '),
      observacoes: solution.observacoes || '',
      fotoAntes: solution.fotoAntes,
      fotoDepois: solution.fotoDepois,
      data: format(parseISO(solution.data), "yyyy-MM-dd'T'HH:mm")
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Triple Grouping: Location -> Model -> [Assets]
  const assetTree = useMemo(() => {
    const tree: Record<string, Record<string, Asset[]>> = {};

    assets.forEach(asset => {
      const location = asset.Location || 'Geral';
      const model = asset.Model || 'S/M (Modelo não informado)';

      if (!tree[location]) tree[location] = {};
      if (!tree[location][model]) tree[location][model] = [];
      
      tree[location][model].push(asset);
    });

    // Sort locations
    const sortedTree: Record<string, Record<string, Asset[]>> = {};
    Object.keys(tree).sort().forEach(loc => {
      sortedTree[loc] = {};
      // Sort models within location
      Object.keys(tree[loc]).sort().forEach(mod => {
        sortedTree[loc][mod] = tree[loc][mod].sort((a, b) => 
          (a.Description || a.Tag).localeCompare(b.Description || b.Tag)
        );
      });
    });
    return sortedTree;
  }, [assets]);

  const locations = useMemo(() => Object.keys(assetTree), [assetTree]);
  const modelsForSelectedLocation = useMemo(() => {
    return form.localizacao ? Object.keys(assetTree[form.localizacao] || {}) : [];
  }, [form.localizacao, assetTree]);

  const assetsForSelectedModel = useMemo(() => {
    return (form.localizacao && form.modelo) ? assetTree[form.localizacao][form.modelo] : [];
  }, [form.localizacao, form.modelo, assetTree]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'fotoAntes' | 'fotoDepois') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm(prev => ({ ...prev, [field]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const filteredSolutions = useMemo(() => {
    return solutions.filter(s => 
      s.maquina.toLowerCase().includes(search.toLowerCase()) ||
      s.problema.toLowerCase().includes(search.toLowerCase()) ||
      s.resumoBreve?.toLowerCase().includes(search.toLowerCase()) ||
      s.titulo?.toLowerCase().includes(search.toLowerCase()) ||
      s.responsavelAcompanhamento?.toLowerCase().includes(search.toLowerCase()) ||
      s.tags.some(t => t.toLowerCase().includes(search.toLowerCase())) ||
      (s.processo && s.processo.toLowerCase().includes(search.toLowerCase()))
    ).sort((a,b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }, [solutions, search]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const solutionData: Omit<Solution, 'id'> = {
      titulo: form.titulo,
      responsavelAcompanhamento: form.responsavelAcompanhamento,
      maquina: form.maquina,
      resumoBreve: form.resumoBreve,
      resumoAcao: form.resumoAcao,
      processo: form.localizacao && form.modelo ? `${form.localizacao} > ${form.modelo}` : (editingId ? solutions.find(s => s.id === editingId)?.processo : 'Geral'),
      tipo: form.tipo,
      problema: form.problema,
      solucao: form.solucao,
      passos: form.passos,
      tags: form.tags.split(',').map(t => t.trim()).filter(t => t !== ''),
      data: new Date(form.data).toISOString(),
      fotoAntes: form.fotoAntes,
      fotoDepois: form.fotoDepois,
      observacoes: form.observacoes
    };

    if (editingId) {
      setSolutions(solutions.map(s => s.id === editingId ? { ...s, ...solutionData } : s));
    } else {
      setSolutions([{ id: Date.now().toString(), ...solutionData }, ...solutions]);
    }
    resetForm();
  };

  const removeSolution = (id: string) => {
    setSolutions(solutions.filter(s => s.id !== id));
  };

  const generatePDF = () => {
    const doc = new jsPDF() as any;
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    
    // Header
    doc.setFillColor(15, 23, 42); // Slate 900
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('GESTÃO DE CONHECIMENTO', margin, 18);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Base Técnica de Manutenção - Relatório Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, margin, 26);
    
    doc.setFillColor(30, 58, 138); // Blue 800 for badge
    doc.roundedRect(pageWidth - margin - 45, 12, 45, 12, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(`${filteredSolutions.length} REGISTROS`, pageWidth - margin - 22.5, 20, { align: 'center' });

    let currentY = 55;

    filteredSolutions.forEach((s, index) => {
      // Check if need new page
      if (currentY > 230) {
        doc.addPage();
        currentY = 20;
      }

      // Solution Container Header
      doc.setFillColor(241, 245, 249); // Slate 100
      doc.rect(margin, currentY, contentWidth, 12, 'F');
      doc.setDrawColor(226, 232, 240); // Slate 200
      doc.rect(margin, currentY, contentWidth, 12, 'D');
      
      doc.setTextColor(30, 41, 59); // Slate 800
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`${(index + 1).toString().padStart(2, '0')}. ${s.titulo?.toUpperCase() || 'SEM TÍTULO'}`, margin + 5, currentY + 8);
      
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139); // Slate 500
      doc.text(s.maquina, pageWidth - margin - 5, currentY + 8, { align: 'right' });

      currentY += 12;

      const tableData = [
        ['Especialidade:', s.tipo, 'Data Registro:', format(new Date(s.data), 'dd/MM/yyyy')],
        ['Responsável:', s.responsavelAcompanhamento || '-', 'Local:', s.processo || 'Geral'],
        ['Resumo Falha:', { content: s.resumoBreve || '-', colSpan: 1 }, 'Resumo Ação:', { content: s.resumoAcao || '-', colSpan: 1 }],
        [{ content: 'PROBLEMA / CAUSA RAIZ:', colSpan: 1, styles: { fontStyle: 'bold' as const, textColor: [185, 28, 28] } }, { content: s.problema, colSpan: 3 }],
        [{ content: 'AÇÃO / LIÇÃO APRENDIDA:', colSpan: 1, styles: { fontStyle: 'bold' as const, textColor: [21, 128, 61] } }, { content: s.solucao, colSpan: 3 }]
      ];

      autoTable(doc, {
        startY: currentY,
        body: tableData as any,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 3.5, lineColor: [226, 232, 240] },
        columnStyles: {
          0: { cellWidth: 40, fontStyle: 'bold', fillColor: [248, 250, 252] },
          2: { cellWidth: 40, fontStyle: 'bold', fillColor: [248, 250, 252] }
        },
        margin: { left: margin, right: margin }
      });

      currentY = (doc as any).lastAutoTable.finalY + 5;

      // Add Step by Step section
      if (s.passos && s.passos.length > 0) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text('PASSO A PASSO TÉCNICO:', margin, currentY + 5);
        currentY += 8;

        s.passos.forEach((passo, pIndex) => {
          if (currentY > 250) {
            doc.addPage();
            currentY = 20;
          }

          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.text(`Passo ${pIndex + 1}:`, margin, currentY);
          
          const splitText = doc.splitTextToSize(passo.texto, contentWidth - 20);
          doc.setFont('helvetica', 'normal');
          doc.text(splitText, margin + 15, currentY);
          
          currentY += (splitText.length * 4) + 3;

          // Add image to step in bulk report
          if (passo.imagem) {
            try {
              const stepImgH = 30;
              const stepImgW = 50;
              if (currentY + stepImgH > 270) {
                doc.addPage();
                currentY = 20;
              }
              doc.addImage(passo.imagem, 'JPEG', margin + 15, currentY, stepImgW, stepImgH);
              currentY += stepImgH + 5;
            } catch(e) { }
          }
          currentY += 2;
        });
      }

      currentY += 10;

      // Add Images section to full report
      if (s.fotoAntes || s.fotoDepois) {
        if (currentY > 230) {
          doc.addPage();
          currentY = 20;
        }
        
        const imgSize = 40;
        if (s.fotoAntes) {
          try {
            doc.addImage(s.fotoAntes, 'JPEG', margin, currentY, imgSize, imgSize);
            doc.setFontSize(7);
            doc.text('SITUAÇÃO INICIAL', margin + (imgSize/2), currentY + imgSize + 3, { align: 'center' });
          } catch(e) { console.warn('Erro ao add imagem antes no PDF bulk'); }
        }
        
        if (s.fotoDepois) {
          try {
            const xPos = margin + imgSize + 5;
            doc.addImage(s.fotoDepois, 'JPEG', xPos, currentY, imgSize, imgSize);
            doc.setFontSize(7);
            doc.text('RESULTADO FINAL', xPos + (imgSize/2), currentY + imgSize + 3, { align: 'center' });
          } catch(e) { console.warn('Erro ao add imagem depois no PDF bulk'); }
        }
        currentY += imgSize + 10;
      }

      currentY += 5;
    });

    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Sistema de Gestão de Manutenção PRO - Página ${i} de ${totalPages}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
    }

    doc.save(`base_conhecimento_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
  };

  const generateSinglePDF = (solution: Solution) => {
    const doc = new jsPDF() as any;
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    
    doc.setFillColor(15, 23, 42); 
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('RELATÓRIO TÉCNICO INDIVIDUAL', margin, 18);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`ID Registro: #${solution.id.slice(-6)} - Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, margin, 26);

    let currentY = 55;

    doc.setFillColor(241, 245, 249);
    doc.rect(margin, currentY, contentWidth, 12, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, currentY, contentWidth, 12, 'D');
    
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(solution.titulo?.toUpperCase() || 'SEM TÍTULO', margin + 5, currentY + 8);
    
    currentY += 12;

    const tableData = [
      ['Equipamento:', solution.maquina, 'Especialidade:', solution.tipo],
      ['Responsável:', solution.responsavelAcompanhamento || '-', 'Data:', format(new Date(solution.data), 'dd/MM/yyyy')],
      ['Resumo Falha:', solution.resumoBreve || '-', 'Resumo Ação:', solution.resumoAcao || '-'],
      ['Localização:', { content: solution.processo || 'Geral', colSpan: 3 }],
      [{ content: 'PROBLEMA / CAUSA RAIZ:', colSpan: 1, styles: { fontStyle: 'bold' as const, textColor: [185, 28, 28] } }, { content: solution.problema, colSpan: 3 }],
      [{ content: 'AÇÃO / LIÇÃO APRENDIDA:', colSpan: 1, styles: { fontStyle: 'bold' as const, textColor: [21, 128, 61] } }, { content: solution.solucao, colSpan: 3 }]
    ];

    autoTable(doc, {
      startY: currentY,
      body: tableData as any,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 4, lineColor: [226, 232, 240] },
      columnStyles: {
        0: { cellWidth: 40, fontStyle: 'bold', fillColor: [248, 250, 252] },
        2: { cellWidth: 40, fontStyle: 'bold', fillColor: [248, 250, 252] }
      },
      margin: { left: margin, right: margin }
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;

    if (solution.passos && solution.passos.length > 0) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('DETALHAMENTO PASSO A PASSO:', margin, currentY);
      currentY += 7;

      solution.passos.forEach((passo, pIdx) => {
        if (currentY > 260) {
          doc.addPage();
          currentY = 20;
        }
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(`Passo ${pIdx + 1}:`, margin, currentY);
        const splitText = doc.splitTextToSize(passo.texto, contentWidth - 25);
        doc.setFont('helvetica', 'normal');
        doc.text(splitText, margin + 20, currentY);
        currentY += (splitText.length * 4) + 3;

        // Add Step Image if exists
        if (passo.imagem) {
          try {
            const stepImgHeight = 35;
            const stepImgWidth = 60;
            if (currentY + stepImgHeight > 270) {
              doc.addPage();
              currentY = 20;
            }
            doc.addImage(passo.imagem, 'JPEG', margin + 20, currentY, stepImgWidth, stepImgHeight);
            currentY += stepImgHeight + 5;
          } catch(e) { 
            console.warn('Erro ao carregar imagem do passo no PDF', e);
          }
        }
        currentY += 3;
      });
    }

    if (solution.fotoAntes || solution.fotoDepois) {
      if (currentY > 180) {
        doc.addPage();
        currentY = 20;
      }
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('EVIDÊNCIAS FOTOGRÁFICAS:', margin, currentY);
      currentY += 10;

      const imgWidth = (contentWidth / 2) - 5;
      if (solution.fotoAntes) {
        doc.addImage(solution.fotoAntes, 'JPEG', margin, currentY, imgWidth, imgWidth);
        doc.setFontSize(7);
        doc.text('SITUAÇÃO INICIAL', margin + (imgWidth/2), currentY + imgWidth + 5, { align: 'center' });
      }
      if (solution.fotoDepois) {
        doc.addImage(solution.fotoDepois, 'JPEG', margin + imgWidth + 10, currentY, imgWidth, imgWidth);
        doc.setFontSize(7);
        doc.text('RESULTADO FINAL', margin + imgWidth + 10 + (imgWidth/2), currentY + imgWidth + 5, { align: 'center' });
      }
    }

    doc.save(`relatorio_${solution.id.slice(-6)}.pdf`);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Gestão de Conhecimento</h2>
          <p className="text-sm text-slate-500">Documentação técnica de falhas e soluções</p>
        </div>
        <div className="flex items-center gap-3">
          {solutions.length > 0 && (
            <button 
              onClick={generatePDF}
              className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
            >
              <Download className="w-4 h-4 text-blue-600" /> Exportar PDF
            </button>
          )}
          <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
            <Wrench className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-bold text-blue-700 uppercase">Foco em MTTR</span>
          </div>
        </div>
      </div>
      
      {/* Form Card */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
          {editingId ? <Edit2 className="w-5 h-5 text-amber-600" /> : <Plus className="w-5 h-5 text-blue-600" />}
          {editingId ? 'Editar Conhecimento' : 'Registrar Novo Conhecimento'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Título do Conhecimento</label>
              <input 
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold" 
                placeholder="Ex: Falha recorrente no rolamento do motor principal" 
                value={form.titulo} 
                onChange={e => setForm({...form, titulo: e.target.value})} 
                required 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 text-blue-600">Resumo da Falha</label>
              <input 
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                placeholder="Ex: Quebra do motor" 
                value={form.resumoBreve} 
                onChange={e => setForm({...form, resumoBreve: e.target.value})} 
                required 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 text-emerald-600">Resumo da Ação</label>
              <input 
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all" 
                placeholder="Ex: Substituição completa" 
                value={form.resumoAcao} 
                onChange={e => setForm({...form, resumoAcao: e.target.value})} 
                required 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Data do Registro</label>
              <input 
                type="datetime-local"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                value={form.data} 
                onChange={e => setForm({...form, data: e.target.value})} 
                required 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">1. Localização</label>
              <select 
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                value={form.localizacao} 
                onChange={e => setForm({...form, localizacao: e.target.value, modelo: '', maquina: ''})}
                required={!editingId}
              >
                <option value="">Selecione a Localização</option>
                {locations.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">2. Modelo</label>
              <select 
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-50" 
                value={form.modelo} 
                onChange={e => setForm({...form, modelo: e.target.value, maquina: ''})}
                disabled={!form.localizacao}
                required={!editingId}
              >
                <option value="">Selecione o Modelo</option>
                {modelsForSelectedLocation.map(mod => (
                  <option key={mod} value={mod}>{mod}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">3. Equipamento (Selecione p/ Vincular)</label>
              <select 
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-50" 
                value={form.maquina} 
                onChange={e => setForm({...form, maquina: e.target.value})}
                disabled={!form.modelo && !editingId}
                required 
              >
                <option value="">{editingId ? form.maquina : 'Selecione a Descrição'}</option>
                {assetsForSelectedModel.map(a => (
                  <option key={a.id} value={`${a.Description || 'Sem Descrição'} ${a.Tag ? `[${a.Tag}]` : ''}`.trim()}>
                    {a.Description || 'Sem Descrição'} {a.Tag ? `(${a.Tag})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Especialidade</label>
              <select 
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                value={form.tipo} 
                onChange={e => setForm({...form, tipo: e.target.value as any})}
              >
                <option>Mecânico</option>
                <option>Elétrico</option>
                <option>Automação</option>
                <option>Outros</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Responsável Acompanhamento</label>
              <input 
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                placeholder="Nome do técnico/engenheiro" 
                value={form.responsavelAcompanhamento} 
                onChange={e => setForm({...form, responsavelAcompanhamento: e.target.value})} 
                required 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Tags (Separadas por Vírgula)</label>
              <input 
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                placeholder="Ex: rolamento, vibração" 
                value={form.tags} 
                onChange={e => setForm({...form, tags: e.target.value})} 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 text-rose-600">Descrição do Problema / Causa Raiz</label>
              <textarea 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl min-h-[100px] focus:ring-2 focus:ring-rose-500 outline-none transition-all" 
                placeholder="Descreva detalhadamente o problema encontrado..." 
                value={form.problema} 
                onChange={e => setForm({...form, problema: e.target.value})} 
                required 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 text-emerald-600">Resumo da Solução Aplicada</label>
              <textarea 
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl min-h-[100px] focus:ring-2 focus:ring-emerald-500 outline-none transition-all" 
                placeholder="Descreva de forma breve o que foi feito..." 
                value={form.solucao} 
                onChange={e => setForm({...form, solucao: e.target.value})} 
                required 
              />
            </div>
          </div>

          {/* Passo a Passo Section */}
          <div className="space-y-4 p-5 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-blue-600" /> Passo a Passo Técnico (Detalhamento)
              </h4>
              <button 
                type="button" 
                onClick={addStep}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 transition-all flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Adicionar Passo
              </button>
            </div>

            <div className="space-y-4">
              {form.passos.map((passo, idx) => (
                <div key={passo.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4 relative group/step">
                  <button 
                    type="button"
                    onClick={() => removeStep(passo.id)}
                    className="absolute top-2 right-2 p-1.5 text-slate-300 hover:text-rose-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  
                  <div className="flex gap-4">
                    <div className="flex-1 space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Passo {idx + 1}</label>
                      <textarea 
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg min-h-[80px] text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        placeholder="Descreva o que deve ser feito neste passo..."
                        value={passo.texto}
                        onChange={e => updateStep(passo.id, { texto: e.target.value })}
                        required
                      />
                    </div>
                    <div className="w-32 shrink-0 space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Imagem</label>
                      <label className="flex flex-col items-center justify-center w-full h-[80px] bg-slate-50 border border-dashed border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 hover:border-blue-300 transition-all overflow-hidden">
                        {passo.imagem ? (
                          <img src={passo.imagem} className="w-full h-full object-cover" alt={`Passo ${idx + 1}`} />
                        ) : (
                          <>
                            <Plus className="w-4 h-4 text-slate-400" />
                            <span className="text-[8px] font-bold text-slate-400 mt-1">Súbir</span>
                          </>
                        )}
                        <input type="file" className="hidden" accept="image/*" onChange={e => handleStepImage(e, passo.id)} />
                      </label>
                      {passo.imagem && (
                        <button type="button" onClick={() => updateStep(passo.id, { imagem: null })} className="text-[9px] text-rose-500 font-bold w-full text-center hover:underline">Remover</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {form.passos.length === 0 && (
                <p className="text-center py-4 text-xs text-slate-400 font-medium italic">Nenhum passo adicionado. Use o botão acima para detalhar a solução.</p>
              )}
            </div>
          </div>

          {/* Antes e Depois Upload */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                <span className="w-2 h-2 bg-rose-500 rounded-full"></span> Foto do Problema (Geral)
              </p>
              <div className="flex items-center gap-4">
                <label className="flex flex-col items-center justify-center w-32 h-32 bg-white border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all overflow-hidden shrink-0">
                  {form.fotoAntes ? (
                    <img src={form.fotoAntes} className="w-full h-full object-cover" alt="Antes" />
                  ) : (
                    <>
                      <Plus className="w-6 h-6 text-slate-400" />
                      <span className="text-[10px] font-bold text-slate-400 mt-1">Súbir Foto</span>
                    </>
                  )}
                  <input type="file" className="hidden" accept="image/*" onChange={e => handleImageUpload(e, 'fotoAntes')} />
                </label>
                {form.fotoAntes && (
                  <button type="button" onClick={() => setForm({...form, fotoAntes: null})} className="text-xs text-rose-600 font-bold hover:underline">Remover</button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full"></span> Foto do Resultado (Geral)
              </p>
              <div className="flex items-center gap-4">
                <label className="flex flex-col items-center justify-center w-32 h-32 bg-white border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all overflow-hidden shrink-0">
                  {form.fotoDepois ? (
                    <img src={form.fotoDepois} className="w-full h-full object-cover" alt="Depois" />
                  ) : (
                    <>
                      <Plus className="w-6 h-6 text-slate-400" />
                      <span className="text-[10px] font-bold text-slate-400 mt-1">Súbir Foto</span>
                    </>
                  )}
                  <input type="file" className="hidden" accept="image/*" onChange={e => handleImageUpload(e, 'fotoDepois')} />
                </label>
                {form.fotoDepois && (
                  <button type="button" onClick={() => setForm({...form, fotoDepois: null})} className="text-xs text-rose-600 font-bold hover:underline">Remover</button>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            {editingId && (
              <button 
                type="button"
                onClick={resetForm}
                className="flex-1 bg-slate-100 text-slate-600 p-4 rounded-2xl font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
              >
                CANCELAR
              </button>
            )}
            <button className="flex-[2] bg-slate-900 text-white p-4 rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 flex items-center justify-center gap-2 active:scale-[0.98]">
              {editingId ? <Edit2 className="w-5 h-5"/> : <Plus className="w-5 h-5"/>}
              {editingId ? 'SALVAR ALTERAÇÕES' : 'REGISTRAR CONHECIMENTO'}
            </button>
          </div>
        </form>
      </div>

      {/* Search Bar */}
      <div className="relative group">
        <Search className="absolute left-4 top-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
        <input 
          className="w-full pl-12 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium" 
          placeholder="Buscar conhecimento por equipamento, falha ou processo..." 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
        />
      </div>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredSolutions.length > 0 ? filteredSolutions.map(s => (
          <div key={s.id} className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden group hover:shadow-md transition-all flex flex-col">
            <div className="p-5 flex-1 space-y-4">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900 text-lg leading-tight uppercase tracking-tight">
                    {s.titulo || s.maquina}
                  </h4>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn(
                      "text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider",
                      s.tipo === 'Mecânico' ? "bg-amber-50 text-amber-600 border border-amber-100" :
                      s.tipo === 'Elétrico' ? "bg-blue-50 text-blue-600 border border-blue-100" :
                      "bg-slate-50 text-slate-600 border border-slate-100"
                    )}>
                      {s.tipo}
                    </span>
                    {s.processo && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                        {s.processo.split(' > ')[0]}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {format(new Date(s.data), 'dd/MM/yyyy HH:mm')}
                    </span>
                  </div>
                  {s.responsavelAcompanhamento && (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase">
                      <User className="w-3 h-3 text-blue-500" />
                      Resp: {s.responsavelAcompanhamento}
                    </div>
                  )}
                  {s.resumoBreve && (
                    <p className="text-xs font-bold text-blue-600 italic bg-blue-50 px-2 py-1 rounded-lg border border-blue-100 inline-block mt-1">
                      {s.resumoBreve}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setViewingSolution(s)}
                    className="p-2.5 bg-blue-100 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl transition-all shadow-sm hover:shadow-md active:scale-95"
                    title="Visualizar Relatório"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => startEdit(s)}
                    className="p-2.5 bg-amber-100 text-amber-600 hover:bg-amber-600 hover:text-white rounded-xl transition-all shadow-sm hover:shadow-md active:scale-95"
                    title="Editar"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => removeSolution(s.id)}
                    className="p-2.5 bg-rose-100 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl transition-all shadow-sm hover:shadow-md active:scale-95"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="bg-rose-50/50 p-3 rounded-2xl border border-rose-100/50">
                  <p className="text-[9px] font-bold text-rose-500 uppercase mb-1">Problema / Causa Raiz</p>
                  <p className="text-sm font-semibold text-slate-800 leading-relaxed line-clamp-3">{s.problema}</p>
                </div>
                
                <div className="bg-emerald-50/50 p-3 rounded-2xl border border-emerald-100/50 relative">
                  <p className="text-[9px] font-bold text-emerald-500 uppercase mb-1">Ação Corretiva / Lição Aprendida</p>
                  <p className="text-sm text-slate-700 leading-relaxed line-clamp-3">{s.solucao}</p>
                  {s.passos && s.passos.length > 0 && (
                    <div className="mt-2 flex items-center gap-1 text-[10px] font-black text-emerald-600 uppercase">
                      <ClipboardList className="w-3 h-3" /> {s.passos.length} Passos Técnicos Detalhados
                    </div>
                  )}
                </div>
              </div>

              {/* Antes e Depois Preview */}
              {(s.fotoAntes || s.fotoDepois) && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="relative group/img overflow-hidden rounded-xl border border-slate-100">
                    <p className="absolute top-2 left-2 z-10 text-[8px] font-black bg-rose-600 text-white px-2 py-0.5 rounded-full shadow-lg">ANTES</p>
                    {s.fotoAntes ? (
                      <img src={s.fotoAntes} className="w-full h-24 object-cover hover:scale-110 transition-transform duration-500" alt="Antes" />
                    ) : (
                      <div className="w-full h-24 bg-slate-50 flex items-center justify-center text-[10px] text-slate-400 font-bold">Sem Foto</div>
                    )}
                  </div>
                  <div className="relative group/img overflow-hidden rounded-xl border border-slate-100">
                    <p className="absolute top-2 left-2 z-10 text-[8px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-full shadow-lg">DEPOIS</p>
                    {s.fotoDepois ? (
                      <img src={s.fotoDepois} className="w-full h-24 object-cover hover:scale-110 transition-transform duration-500" alt="Depois" />
                    ) : (
                      <div className="w-full h-24 bg-slate-50 flex items-center justify-center text-[10px] text-slate-400 font-bold">Sem Foto</div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-1.5 flex-wrap pt-2">
                {s.tags.map(t => (
                  <span key={t} className="bg-slate-100 text-slate-500 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 hover:bg-blue-50 hover:text-blue-600 transition-colors cursor-default">
                    <Tag className="w-3 h-3" /> {t.toUpperCase()}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )) : (
          <div className="col-span-full py-12 text-center bg-white rounded-3xl border border-slate-100 border-dashed">
            <Wrench className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-medium">Nenhum registro encontrado na base de conhecimento.</p>
          </div>
        )}
      </div>

      {/* Solution Viewer Modal */}
      {viewingSolution && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 my-8">
            {/* Modal Header */}
            <div className="bg-slate-900 p-6 text-white flex justify-between items-start">
              <div className="space-y-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-blue-600 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest">Relatório Técnico</span>
                  <span className="text-slate-400 text-xs font-medium">#{viewingSolution.id.slice(-6)}</span>
                </div>
                <h2 className="text-2xl font-bold uppercase">{viewingSolution.titulo || viewingSolution.maquina}</h2>
                <div className="flex items-center gap-4 text-slate-400 text-xs">
                  <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {format(new Date(viewingSolution.data), 'dd/MM/yyyy HH:mm')}</span>
                  <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> {viewingSolution.responsavelAcompanhamento}</span>
                </div>
              </div>
              <button 
                onClick={() => setViewingSolution(null)}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8 space-y-8 overflow-y-auto max-h-[calc(100vh-200px)]">
              {/* Info Bar */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Equipamento</p>
                  <p className="font-bold text-slate-800">{viewingSolution.maquina}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Localização / Contexto</p>
                  <p className="font-bold text-slate-800">{viewingSolution.processo || 'Geral'}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Especialidade</p>
                  <p className="font-bold text-slate-800">{viewingSolution.tipo}</p>
                </div>
              </div>

              {/* Status Bar */}
              {(viewingSolution.resumoBreve || viewingSolution.resumoAcao) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {viewingSolution.resumoBreve && (
                    <div className="p-6 bg-blue-50 rounded-3xl border border-blue-100">
                      <p className="text-[10px] font-bold text-blue-500 uppercase mb-2 tracking-widest">Resumo da Falha</p>
                      <p className="text-lg font-bold text-slate-800 italic">"{viewingSolution.resumoBreve}"</p>
                    </div>
                  )}
                  {viewingSolution.resumoAcao && (
                    <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100">
                      <p className="text-[10px] font-bold text-emerald-500 uppercase mb-2 tracking-widest">Resumo da Ação</p>
                      <p className="text-lg font-bold text-slate-800 italic">"{viewingSolution.resumoAcao}"</p>
                    </div>
                  )}
                </div>
              )}

              {/* Problem/Solution Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-rose-50 p-6 rounded-3xl border border-rose-100">
                  <h4 className="text-xs font-black text-rose-600 uppercase mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-rose-600 rounded-full animate-pulse" /> Problema / Falha
                  </h4>
                  <p className="text-slate-800 font-medium leading-relaxed">{viewingSolution.problema}</p>
                </div>
                <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
                  <h4 className="text-xs font-black text-emerald-600 uppercase mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-600 rounded-full" /> Resumo da Solução
                  </h4>
                  <p className="text-slate-800 font-medium leading-relaxed">{viewingSolution.solucao}</p>
                </div>
              </div>

              {/* Step by Step Detailing */}
              {viewingSolution.passos && viewingSolution.passos.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest border-b pb-2 flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-blue-600" /> Passo a Passo Detalhado
                  </h4>
                  <div className="space-y-6">
                    {viewingSolution.passos.map((passo, idx) => (
                      <div key={passo.id} className="flex flex-col md:flex-row gap-6 p-4 rounded-2xl hover:bg-slate-50 transition-colors">
                        <div className="w-full md:w-1/2 space-y-2">
                          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">PASSO {idx + 1}</span>
                          <p className="text-slate-700 leading-relaxed font-medium">{passo.texto}</p>
                        </div>
                        {passo.imagem && (
                          <div className="w-full md:w-1/2 aspect-video rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                            <img src={passo.imagem} className="w-full h-full object-cover" alt={`Passo ${idx + 1}`} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Photos Comparison */}
              {(viewingSolution.fotoAntes || viewingSolution.fotoDepois) && (
                <div className="space-y-4">
                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest border-b pb-2">Evidências Fotográficas</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {viewingSolution.fotoAntes && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-rose-500 uppercase text-center">Situação Inicial</p>
                        <div className="aspect-square rounded-3xl overflow-hidden border-4 border-white shadow-xl">
                          <img src={viewingSolution.fotoAntes} className="w-full h-full object-cover" alt="Antes" />
                        </div>
                      </div>
                    )}
                    {viewingSolution.fotoDepois && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-emerald-500 uppercase text-center">Resultado Final</p>
                        <div className="aspect-square rounded-3xl overflow-hidden border-4 border-white shadow-xl">
                          <img src={viewingSolution.fotoDepois} className="w-full h-full object-cover" alt="Depois" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Final Observations */}
              {viewingSolution.observacoes && (
                <div className="p-6 bg-amber-50 rounded-3xl border border-amber-100 italic text-slate-700 text-sm">
                  <span className="block text-[10px] font-bold text-amber-600 uppercase not-italic mb-1">Notas Adicionais:</span>
                  "{viewingSolution.observacoes}"
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 p-6 border-t border-slate-100 flex justify-end gap-3 font-bold text-sm no-print">
              <button 
                onClick={() => setViewingSolution(null)}
                className="px-6 py-2.5 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all uppercase"
              >
                Fechar
              </button>
              <button 
                onClick={() => window.print()}
                className="bg-slate-100 text-slate-700 px-6 py-2.5 rounded-xl hover:bg-slate-200 shadow-sm flex items-center gap-2 uppercase tracking-tight"
              >
                <Eye className="w-4 h-4" /> Impressão Direta
              </button>
              <button 
                onClick={() => {
                  generateSinglePDF(viewingSolution);
                }}
                className="bg-slate-900 text-white px-6 py-2.5 rounded-xl hover:bg-slate-800 shadow-lg flex items-center gap-2 uppercase tracking-tight"
              >
                <Download className="w-4 h-4" /> Exportar PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
