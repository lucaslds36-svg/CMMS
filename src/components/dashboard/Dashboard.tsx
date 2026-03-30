import React, { useState, useMemo } from 'react';
import { AlertTriangle, Info, FileSpreadsheet, CheckCircle2, Clock, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { ComposedChart, Line, LabelList, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Asset, WorkOrder } from '../../types';
import { parsePercent, getMonthNumber, CustomDataLabel, CustomMetaLabel, GreenArrow } from '../../utils/chartUtils';
import { cn } from '../../lib/utils';

const ConfirmModal = ({ 
  show, 
  title, 
  message, 
  onConfirm, 
  onCancel 
}: { 
  show: boolean, 
  title: string, 
  message: string, 
  onConfirm: () => void, 
  onCancel: () => void 
}) => {
  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold mb-2">{title}</h3>
              <p className="text-slate-500 text-sm mb-8">{message}</p>
              
              <div className="flex space-x-3">
                <button 
                  onClick={onCancel}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={onConfirm}
                  className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-200"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const mockChartData = [
  { month: 'Jan', manutencao: 2.87, metaManutencao: 4.00, mecanica: 1.41, metaMecanica: 2.40, eletrica: 1.46, metaEletrica: 1.60 },
  { month: 'Fev', manutencao: 3.83, metaManutencao: 4.00, mecanica: 2.43, metaMecanica: 2.40, eletrica: 1.40, metaEletrica: 1.60 },
  { month: 'Mar', manutencao: 3.19, metaManutencao: 4.00, mecanica: 1.79, metaMecanica: 2.40, eletrica: 1.40, metaEletrica: 1.60 },
  { month: 'Abr', metaManutencao: 4.00, metaMecanica: 2.40, metaEletrica: 1.60 },
  { month: 'Mai', metaManutencao: 4.00, metaMecanica: 2.40, metaEletrica: 1.60 },
  { month: 'Jun', metaManutencao: 4.00, metaMecanica: 2.40, metaEletrica: 1.60 },
  { month: 'Jul', metaManutencao: 4.00, metaMecanica: 2.40, metaEletrica: 1.60 },
  { month: 'Ago', metaManutencao: 4.00, metaMecanica: 2.40, metaEletrica: 1.60 },
  { month: 'Set', metaManutencao: 4.00, metaMecanica: 2.40, metaEletrica: 1.60 },
  { month: 'Out', metaManutencao: 4.00, metaMecanica: 2.40, metaEletrica: 1.60 },
  { month: 'Nov', metaManutencao: 4.00, metaMecanica: 2.40, metaEletrica: 1.60 },
  { month: 'Dez', metaManutencao: 4.00, metaMecanica: 2.40, metaEletrica: 1.60 },
];

export const Dashboard = ({ 
  assets, 
  wos, 
  bditssData, 
  dinamicaData, 
  setBditssData,
  setDinamicaData,
  handleFileUpload,
  filters,
  setFilters,
  isProcessingFile
}: { 
  assets: Asset[], 
  wos: WorkOrder[], 
  bditssData: any[], 
  dinamicaData: any[], 
  setBditssData: React.Dispatch<React.SetStateAction<any[]>>,
  setDinamicaData: React.Dispatch<React.SetStateAction<any[]>>,
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void,
  filters: { year: string, month: string, viewType: 'Acumulada' | 'Diária' },
  setFilters: React.Dispatch<React.SetStateAction<{ year: string, month: string, viewType: 'Acumulada' | 'Diária' }>>,
  isProcessingFile?: boolean
}) => {
  const [loading, setLoading] = useState(false);

  const formatPercent = (val: string | number | null) => {
    const num = parsePercent(val);
    if (num === null) return '-';
    return num.toFixed(2).replace('.', ',') + '%';
  };

  const getStatusColor = (atual: any, meta: any) => {
    const a = parsePercent(atual);
    const m = parsePercent(meta);
    
    if (a === null || m === null) return 'bg-slate-300';
    if (a <= m) return 'bg-emerald-500';
    if (a <= m * 1.05) return 'bg-amber-400';
    return 'bg-red-500';
  };

  // ... (I need to copy the calculatedIndicators logic here)
  const calculatedIndicators = useMemo(() => {
    if (!Array.isArray(bditssData) || bditssData.length === 0) return [];

    // 1. Identify header row and headers in BD
    let headerRowIdx = 0;
    let headers: any[] = [];
    
    for (let i = 0; i < Math.min(bditssData.length, 50); i++) {
      const row = bditssData[i];
      if (Array.isArray(row)) {
        const hasAno = row.some(h => String(h || '').toUpperCase().includes('ANO'));
        const hasMes = row.some(h => {
          const s = String(h || '').toUpperCase();
          return s.includes('MÊS') || s.includes('MES') || s === 'MS';
        });
        const hasGrupo = row.some(h => {
          const s = String(h || '').toUpperCase();
          return s.includes('GRUPO') || s.includes('PROCESSO') || s.includes('TAG');
        });
        
        if ((hasAno && hasMes) || (hasAno && hasGrupo) || (hasMes && hasGrupo)) {
          headerRowIdx = i;
          headers = row;
          break;
        }
      }
    }

    if (headers.length === 0) {
      headers = Array.isArray(bditssData[0]) ? bditssData[0] : [];
    }

    const findIdx = (keywords: string[]) => headers.findIndex((h: any) => {
      const s = String(h || '').toUpperCase();
      return keywords.some(k => {
        const key = k.toUpperCase();
        return s === key || s.includes(' ' + key) || s.includes(key + ' ') || s.includes(key);
      });
    });

    const grupoIdx = findIdx(['GRUPO', 'PROCESSO', 'EQUIPAMENTO', 'MÁQUINA', 'MAQUINA', 'TAG', 'ASSET']);
    const dataIdx = findIdx(['DATA', 'DIA', 'DATE']);
    const horasIdx = findIdx(['HORA', 'PARADA', 'DURAÇÃO', 'DURACAO', 'TEMPO', 'MANUT. MECÂNICA', 'MANUT. ELÉTRICA']);
    const mecHoursIdx = findIdx(['MANUT. MECÂNICA', 'MANUT. MECANICA', 'MECÂNICA', 'MECANICA', 'MANUT. MECÂNICO']);
    const eleHoursIdx = findIdx(['MANUT. ELÉTRICA', 'MANUT. ELETRICA', 'ELÉTRICA', 'ELETRICA', 'MANUT. ELÉTRICO']);
    const anoIdx = findIdx(['ANO', 'YEAR']);
    const mesIdx = findIdx(['MÊS', 'MES', 'MONTH', 'MS']);
    const progHoursIdx = findIdx(['HORA PROG.', 'HORA PROG', 'HORAS PROG', 'HR PROG', 'HRS PROG', 'PROGRAMAÇÃO', 'PROGRAMACAO']);
    
    const indispMecDiarIdx = findIdx(['INDISP. MÊC. DIAR', 'INDISP. MEC. DIAR', 'INDSIP. MC. DIRIA']);
    const indispEleDiarIdx = findIdx(['INDISP. ELÉT. DIÁR', 'INDISP. ELE. DIAR', 'INDSIP. ELT. DIRIA']);
    const indispMecMensalIdx = findIdx(['INDISP. MENSAL MÊ', 'INDISP. MENSAL ME', 'INDISP. MENSAL MC.']);
    const indispEleMensalIdx = findIdx(['INDISP. MENSAL ELE', 'INDISP. MENSAL ELET.']);
    
    if (grupoIdx === -1) {
      console.warn('Header "GRUPO" (or equivalent) not found in BDITSS data. Found headers:', headers);
      return [];
    }

    const filteredBD = bditssData.slice(headerRowIdx + 1).filter(row => {
      if (!Array.isArray(row)) return false;
      const rowYear = row[anoIdx] ? String(row[anoIdx]).trim() : '';
      const rowMonth = row[mesIdx] ? String(row[mesIdx]).trim() : '';
      const rowGroup = String(row[grupoIdx] || '').toUpperCase();
      
      if (rowGroup.includes('TOTAL') || rowGroup.includes('GERAL') || rowGroup === '') return false;

      const matchYear = !filters.year || rowYear === filters.year;
      const isAcum = filters.viewType === 'Acumulada';
      
      let matchMonth = false;
      if (!filters.month) {
        matchMonth = true;
      } else {
        const rowMonthNum = getMonthNumber(rowMonth);
        const filterMonthNum = parseInt(filters.month);
        if (rowMonthNum !== null && rowMonthNum === filterMonthNum) {
          matchMonth = true;
        }
      }
      
      return matchYear && matchMonth;
    });

    let finalBD = filteredBD;
    if (filters.viewType === 'Diária' && filteredBD.length > 0 && dataIdx !== -1) {
      const dates = filteredBD.map(row => {
        const d = row[dataIdx];
        if (!d) return 0;
        if (typeof d === 'number') return d;
        const parsed = new Date(d).getTime();
        return isNaN(parsed) ? 0 : parsed;
      });
      const maxDate = Math.max(...dates);
      if (maxDate > 0) {
        finalBD = filteredBD.filter(row => {
          const d = row[dataIdx];
          if (typeof d === 'number') return d === maxDate;
          return new Date(d).getTime() === maxDate;
        });
      }
    }

    const sectionsMap: Record<string, Record<string, any>> = {};
    let groupAreaMap: Record<string, string> = {};
    let uniqueGroups: string[] = [];
    
    if (Array.isArray(dinamicaData) && dinamicaData.length > 0) {
      const pdgHeaders = Array.isArray(dinamicaData[0]) ? dinamicaData[0] : [];
      const pdgGrupoIdx = pdgHeaders.findIndex((h: any) => String(h).toUpperCase().includes('GRUPO'));
      const pdgAreaIdx = pdgHeaders.findIndex((h: any) => {
        const s = String(h).toUpperCase();
        return s.includes('ÁREA') || s.includes('AREA') || s.includes('SETOR') || s.includes('PROCESSO');
      });
      
      if (pdgGrupoIdx !== -1) {
        dinamicaData.slice(1).forEach(row => {
          if (!Array.isArray(row)) return;
          const g = String(row[pdgGrupoIdx]).trim();
          const a = pdgAreaIdx !== -1 ? String(row[pdgAreaIdx] || 'OUTROS').trim() : 'INDICADORES DE INDISPONIBILIDADE';
          if (g && g !== 'undefined' && g !== '') {
            groupAreaMap[g] = a;
            if (!uniqueGroups.includes(g)) uniqueGroups.push(g);
          }
        });
      }
    }
    
    if (uniqueGroups.length === 0) {
      uniqueGroups = Array.from(new Set(filteredBD.map(row => Array.isArray(row) ? String(row[grupoIdx]).trim() : ''))).filter(g => g && g !== 'undefined' && g !== '' && !g.toUpperCase().includes('TOTAL'));
      uniqueGroups.forEach(g => { groupAreaMap[g] = 'INDICADORES DE INDISPONIBILIDADE'; });
    } else {
      uniqueGroups = uniqueGroups.filter(g => !g.toUpperCase().includes('TOTAL'));
    }

    const metas: Record<string, { mec: number, ele: number }> = {};
    if (Array.isArray(dinamicaData) && dinamicaData.length > 0) {
      const pdgHeaders = Array.isArray(dinamicaData[0]) ? dinamicaData[0] : [];
      const pdgProcessoIdx = pdgHeaders.findIndex((h: any) => {
        const s = String(h || '').toUpperCase();
        return s === 'PROCESSO' || s === 'GRUPO' || s.includes('PROCESSO') || s.includes('GRUPO');
      });
      
      const metaYearSuffix = filters.year.slice(-2);
      const pdgMetaMecIdx = pdgHeaders.findIndex((h: any) => {
        const s = String(h || '').toUpperCase();
        return s.includes('MEC') && (s.includes('META') || s.includes(metaYearSuffix));
      });
      const pdgMetaEleIdx = pdgHeaders.findIndex((h: any) => {
        const s = String(h || '').toUpperCase();
        return s.includes('ELE') && (s.includes('META') || s.includes(metaYearSuffix));
      });
      
      const fallbackMetaMecIdx = pdgHeaders.findIndex((h: any) => {
        const s = String(h || '').toUpperCase();
        return s === 'MECÂNICA' || s === 'MECANICA' || s === 'MEC';
      });
      const fallbackMetaEleIdx = pdgHeaders.findIndex((h: any) => {
        const s = String(h || '').toUpperCase();
        return s === 'ELÉTRICA' || s === 'ELETRICA' || s === 'ELE';
      });

      dinamicaData.slice(1).forEach(row => {
        if (!Array.isArray(row)) return;
        const g = String(row[pdgProcessoIdx] || '').trim();
        if (g && g !== 'undefined' && !g.toUpperCase().includes('TOTAL')) {
          metas[g] = {
            mec: parsePercent(row[pdgMetaMecIdx] !== undefined ? row[pdgMetaMecIdx] : row[fallbackMetaMecIdx]) || 2.4,
            ele: parsePercent(row[pdgMetaEleIdx] !== undefined ? row[pdgMetaEleIdx] : row[fallbackMetaEleIdx]) || 1.6
          };
        }
      });
    }

    uniqueGroups.forEach(groupName => {
      const groupRows = finalBD.filter(row => String(row[grupoIdx] || '').trim() === groupName);
      const areaName = groupAreaMap[groupName] || 'OUTROS';
      
      if (groupRows.length === 0) return;

      let mecHours = 0;
      let eleHours = 0;
      let totalProgHours = 0;
      
      if (mecHoursIdx !== -1 && eleHoursIdx !== -1) {
        groupRows.forEach(row => {
          mecHours += parseFloat(String(row[mecHoursIdx] || '0').replace(',', '.'));
          eleHours += parseFloat(String(row[eleHoursIdx] || '0').replace(',', '.'));
        });
      }

      if (progHoursIdx !== -1) {
        groupRows.forEach(row => {
          const progVal = parseFloat(String(row[progHoursIdx] || '0').replace(',', '.'));
          totalProgHours += progVal;
        });
      }

      let mecVal = 0;
      let eleVal = 0;
      const isAcum = filters.viewType === 'Acumulada';

      if (totalProgHours > 0) {
        mecVal = (mecHours / totalProgHours) * 100;
        eleVal = (eleHours / totalProgHours) * 100;
      } else {
        if (isAcum && indispMecMensalIdx !== -1 && indispEleMensalIdx !== -1) {
          const lastRow = groupRows[groupRows.length - 1];
          if (lastRow) {
            mecVal = parsePercent(lastRow[indispMecMensalIdx]) || 0;
            eleVal = parsePercent(lastRow[indispEleMensalIdx]) || 0;
          }
        } else if (!isAcum && indispMecDiarIdx !== -1 && indispEleDiarIdx !== -1) {
          let count = 0;
          groupRows.forEach(row => {
            mecVal += parsePercent(row[indispMecDiarIdx]) || 0;
            eleVal += parsePercent(row[indispEleDiarIdx]) || 0;
            count++;
          });
          if (count > 0) {
            mecVal /= count;
            eleVal /= count;
          }
        } else {
          const daysInMonth = new Date(parseInt(filters.year), parseInt(filters.month), 0).getDate();
          const divisor = isAcum ? (daysInMonth * 24) : 24;
          mecVal = (mecHours / divisor) * 100;
          eleVal = (eleHours / divisor) * 100;
        }
      }

      const sparklinePoints: string[] = [];
      if (dataIdx !== -1) {
        const daysInMonth = new Date(parseInt(filters.year), parseInt(filters.month), 0).getDate();
        for (let d = 1; d <= daysInMonth; d++) {
          const dayRows = filteredBD.filter(row => {
            const rowG = String(row[grupoIdx]).trim();
            const rowD = row[dataIdx];
            if (rowG !== groupName) return false;
            
            if (typeof rowD === 'number') {
              const date = new Date((rowD - 25569) * 86400 * 1000);
              return date.getDate() === d;
            } else {
              const date = new Date(rowD);
              return date.getDate() === d;
            }
          });
          
          let dayMec = 0;
          let dayEle = 0;
          let dayProg = 0;
          dayRows.forEach(r => {
            const hMec = parseFloat(String(r[mecHoursIdx] || '0').replace(',', '.'));
            const hEle = parseFloat(String(r[eleHoursIdx] || '0').replace(',', '.'));
            dayMec += hMec;
            dayEle += hEle;
            
            if (progHoursIdx !== -1 && dayProg === 0) {
              dayProg = parseFloat(String(r[progHoursIdx] || '0').replace(',', '.'));
            }
          });
          
          const divisor = dayProg > 0 ? dayProg : 24;
          const dayPercent = ((dayMec + dayEle) / divisor) * 100;
          const y = 20 - Math.min(20, (dayPercent / 10) * 20); 
          sparklinePoints.push(`${(d / daysInMonth) * 100},${y}`);
        }
      }

      if (!sectionsMap[areaName]) sectionsMap[areaName] = {};
      
      sectionsMap[areaName][groupName] = {
        name: groupName,
        mecanica: {
          atual: mecVal,
          meta: metas[groupName]?.mec || 2.4
        },
        eletrica: {
          atual: eleVal,
          meta: metas[groupName]?.ele || 1.6
        },
        sparkline: sparklinePoints.join(' ')
      };
    });

    const dashboardStructure = [
      {
        title: "Cordeiras",
        machines: [
          "RIP", "CDT410", "CDT112", "CDT115", "K2002",
          "CDT47", "CDT46", "C21", "C22", "TD2/321",
          "TD2/402", "TD2601", "HKM", "REB", "K601",
          "KR83", "K83", "BTW", "BFI"
        ]
      },
      {
        title: "Trefila fina",
        machines: ["PN4/21", "HT18", "NDW", "P421", "PN4/201", "MM3B"]
      },
      {
        title: "SEMI PRONTO",
        machines: ["TG06", "BW", "MONOFIO"]
      }
    ];

    const allCalculatedMachines: any[] = [];
    Object.values(sectionsMap).forEach(machinesMap => {
      Object.values(machinesMap).forEach(machine => {
        allCalculatedMachines.push(machine);
      });
    });

    const result: any[] = [];

    dashboardStructure.forEach(sectionDef => {
      const sectionMachines: any[] = [];
      sectionDef.machines.forEach(targetName => {
        const found = allCalculatedMachines.find(m => 
          m.name.trim().toUpperCase() === targetName.trim().toUpperCase()
        );
        if (found) {
          sectionMachines.push(found);
        }
      });
      
      if (sectionMachines.length > 0) {
        result.push({
          name: sectionDef.title,
          machines: sectionMachines
        });
      }
    });

    return result;
  }, [bditssData, dinamicaData, filters]);

  // Calculate chart data based on bditssData
  const chartData = useMemo(() => {
    if (!Array.isArray(bditssData) || bditssData.length === 0) return mockChartData;

    // 1. Identify header row and headers in BD
    let headerRowIdx = 0;
    let headers: any[] = [];
    
    for (let i = 0; i < Math.min(bditssData.length, 20); i++) {
      const row = bditssData[i];
      if (Array.isArray(row)) {
        const hasAno = row.some(h => String(h).toUpperCase().includes('ANO'));
        const hasMes = row.some(h => {
          const s = String(h).toUpperCase();
          return s.includes('MÊS') || s.includes('MES') || s === 'MS';
        });
        const hasGrupo = row.some(h => {
          const s = String(h).toUpperCase();
          return s.includes('GRUPO') || s.includes('PROCESSO') || s.includes('TAG');
        });
        
        if ((hasAno && hasMes) || (hasAno && hasGrupo) || (hasMes && hasGrupo)) {
          headerRowIdx = i;
          headers = row;
          break;
        }
      }
    }

    if (headers.length === 0) {
      headers = Array.isArray(bditssData[0]) ? bditssData[0] : [];
    }

    const findIdx = (keywords: string[]) => headers.findIndex((h: any) => {
      const s = String(h || '').toUpperCase();
      return keywords.some(k => s.includes(k.toUpperCase()));
    });

    const horasIdx = findIdx(['HORA', 'PARADA', 'DURAÇÃO', 'DURACAO', 'TEMPO', 'MANUT. MECÂNICO', 'MANUT. MECANICO']);
    const mecHoursIdx = findIdx(['MANUT. MECÂNICO', 'MANUT. MECANICO']);
    const eleHoursIdx = findIdx(['MANUT. ELÉTRICA', 'MANUT. ELETRICA']);
    const anoIdx = findIdx(['ANO', 'YEAR']);
    const mesIdx = findIdx(['MÊS', 'MES', 'MONTH', 'MS']);
    const dataIdx = findIdx(['DATA', 'DATE', 'DIA', 'DAY']);
    const progHoursIdx = findIdx(['HORA PROG', 'HORAS PROG', 'HR PROG', 'HRS PROG', 'PROGRAMAÇÃO', 'PROGRAMACAO']);
    const setorIdx = findIdx(['SETOR', 'ÁREA', 'AREA', 'DISCIPLINA']);
    
    const indispMecMensalIdx = findIdx(['INDISP. MENSAL MÊ', 'INDISP. MENSAL ME', 'INDISP. MENSAL MC.']);
    const indispEleMensalIdx = findIdx(['INDISP. MENSAL ELE', 'INDISP. MENSAL ELET.']);
    const indispTotIdx = findIdx(['INDISP. TOT.']);

    if (anoIdx === -1 || mesIdx === -1) {
      console.warn('Required headers (ANO, MES) not found for chart data. Found headers:', headers);
      return mockChartData;
    }

    // Get global metas from PDG if available (usually a row with "TOTAL BMB" or similar)
    let globalMetaMec = 2.40;
    let globalMetaEle = 1.60;
    let globalMetaTotal = 4.00;

    if (Array.isArray(dinamicaData) && dinamicaData.length > 0) {
      let pdgHeaderRowIdx = 0;
      let pdgHeaders: any[] = [];
      
      for (let i = 0; i < Math.min(dinamicaData.length, 20); i++) {
        const row = dinamicaData[i];
        if (Array.isArray(row)) {
          const hasProcesso = row.some(h => String(h).toUpperCase().includes('PROCESSO'));
          const hasMeta = row.some(h => String(h).toUpperCase().includes('META') || String(h).toUpperCase().includes('25') || String(h).toUpperCase().includes('26'));
          if (hasProcesso && hasMeta) {
            pdgHeaderRowIdx = i;
            pdgHeaders = row;
            break;
          }
        }
      }
      
      if (pdgHeaders.length === 0) pdgHeaders = Array.isArray(dinamicaData[0]) ? dinamicaData[0] : [];

      const pdgGrupoIdx = pdgHeaders.findIndex((h: any) => {
        const s = String(h).toUpperCase();
        return s.includes('PROCESSO') || s.includes('GRUPO');
      });
      const pdgMetaMecIdx = pdgHeaders.findIndex((h: any) => String(h).toUpperCase().includes('MEC') && String(h).toUpperCase().includes('META') && !String(h).toUpperCase().includes('DIAR'));
      const pdgMetaEleIdx = pdgHeaders.findIndex((h: any) => String(h).toUpperCase().includes('ELE') && String(h).toUpperCase().includes('META') && !String(h).toUpperCase().includes('DIAR'));
      
      const totalRow = dinamicaData.slice(pdgHeaderRowIdx + 1).find(row => Array.isArray(row) && String(row[pdgGrupoIdx]).toUpperCase().includes('TOTAL'));
      if (totalRow) {
        globalMetaMec = parsePercent(totalRow[pdgMetaMecIdx]) || 2.40;
        globalMetaEle = parsePercent(totalRow[pdgMetaEleIdx]) || 1.60;
        globalMetaTotal = globalMetaMec + globalMetaEle;
      }
    }

    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const fullMonthNames = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];

    const dataByMonth = monthNames.map((name, idx) => {
      const monthNum = idx + 1;
      const monthFullName = fullMonthNames[idx];
      
      const monthRows = bditssData.slice(headerRowIdx + 1).filter(row => {
        if (!Array.isArray(row)) return false;
        const rowYear = String(row[anoIdx] || '').trim();
        const rowMonth = String(row[mesIdx] || '').trim();
        
        const matchYear = rowYear === filters.year;
        const rowMonthNum = getMonthNumber(rowMonth);
        const matchMonth = rowMonthNum !== null && rowMonthNum === monthNum;
        
        return matchYear && matchMonth;
      });

      if (monthRows.length === 0) {
        return {
          month: name,
          metaManutencao: globalMetaTotal,
          metaMecanica: globalMetaMec,
          metaEletrica: globalMetaEle
        };
      }

      let mecVal = 0;
      let eleVal = 0;
      let totalVal = 0;

      // Prioritize manual calculation if HORAS PROG and maintenance hours are found
      const hasManualColumns = (mecHoursIdx !== -1 && eleHoursIdx !== -1 || (setorIdx !== -1 && horasIdx !== -1)) && progHoursIdx !== -1;

      if (hasManualColumns) {
        let mecHours = 0;
        let eleHours = 0;
        let totalProgHours = 0;
        const daysProcessed = new Set();

        monthRows.forEach(row => {
          const dayKey = dataIdx !== -1 ? String(row[dataIdx]) : Math.random().toString();
          
          if (mecHoursIdx !== -1 && eleHoursIdx !== -1) {
            mecHours += parseFloat(String(row[mecHoursIdx] || '0').replace(',', '.'));
            eleHours += parseFloat(String(row[eleHoursIdx] || '0').replace(',', '.'));
          } else {
            const setor = String(row[setorIdx] || '').toUpperCase();
            const hours = parseFloat(String(row[horasIdx] || '0').replace(',', '.'));
            if (setor.includes('MEC')) mecHours += hours;
            if (setor.includes('ELE')) eleHours += hours;
          }
          
          if (progHoursIdx !== -1) {
            const progVal = parseFloat(String(row[progHoursIdx] || '0').replace(',', '.'));
            if (!daysProcessed.has(dayKey)) {
              totalProgHours += progVal;
              daysProcessed.add(dayKey);
            }
          }
        });

        const divisor = totalProgHours > 0 ? totalProgHours : 1;
        mecVal = (mecHours / divisor) * 100;
        eleVal = (eleHours / divisor) * 100;
        totalVal = mecVal + eleVal;
      } else if (indispMecMensalIdx !== -1 && indispEleMensalIdx !== -1) {
        // Use monthly pre-calculated values
        const lastRow = monthRows[monthRows.length - 1];
        if (lastRow) {
          mecVal = parsePercent(lastRow[indispMecMensalIdx]) || 0;
          eleVal = parsePercent(lastRow[indispEleMensalIdx]) || 0;
          totalVal = indispTotIdx !== -1 ? (parsePercent(lastRow[indispTotIdx]) || (mecVal + eleVal)) : (mecVal + eleVal);
        }
      } else {
        let mecHours = 0;
        let eleHours = 0;
        
        monthRows.forEach(row => {
          if (mecHoursIdx !== -1 && eleHoursIdx !== -1) {
            mecHours += parseFloat(String(row[mecHoursIdx] || '0').replace(',', '.'));
            eleHours += parseFloat(String(row[eleHoursIdx] || '0').replace(',', '.'));
          } else {
            const setor = String(row[setorIdx] || '').toUpperCase();
            const hours = parseFloat(String(row[horasIdx] || '0').replace(',', '.'));
            if (setor.includes('MEC')) mecHours += hours;
            if (setor.includes('ELE')) eleHours += hours;
          }
        });

        const daysInMonth = new Date(parseInt(filters.year), monthNum, 0).getDate();
        const totalHours = daysInMonth * 24;
        mecVal = (mecHours / totalHours) * 100;
        eleVal = (eleHours / totalHours) * 100;
        totalVal = mecVal + eleVal;
      }

      return {
        month: name,
        manutencao: totalVal,
        metaManutencao: globalMetaTotal,
        mecanica: mecVal,
        metaMecanica: globalMetaMec,
        eletrica: eleVal,
        metaEletrica: globalMetaEle
      };
    });

    return dataByMonth;
  }, [bditssData, dinamicaData, filters.year]);


  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex flex-col">
          <h2 className="text-xl font-bold text-slate-900">Indicadores de Indisponibilidade</h2>
          <div className="flex items-center mt-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <Info className="w-3 h-3 mr-1" />
            Cálculo: (Mecânica + Elétrica) / Horas Prog.
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center bg-slate-50 rounded-xl border border-slate-200 p-1 shadow-inner w-full sm:w-auto">
            <button 
              onClick={() => setFilters({ ...filters, viewType: 'Acumulada' })}
              className={cn(
                "flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
                filters.viewType === 'Acumulada' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:bg-slate-100"
              )}
            >
              Mensal
            </button>
            <button 
              onClick={() => setFilters({ ...filters, viewType: 'Diária' })}
              className={cn(
                "flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
                filters.viewType === 'Diária' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:bg-slate-100"
              )}
            >
              Diária
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select 
              value={filters.month}
              onChange={(e) => setFilters({ ...filters, month: e.target.value })}
              className="flex-1 sm:flex-none px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
            >
              {[{id: '1', name: 'Janeiro'}, {id: '2', name: 'Fevereiro'}, {id: '3', name: 'Março'}, {id: '4', name: 'Abril'}, {id: '5', name: 'Maio'}, {id: '6', name: 'Junho'}, {id: '7', name: 'Julho'}, {id: '8', name: 'Agosto'}, {id: '9', name: 'Setembro'}, {id: '10', name: 'Outubro'}, {id: '11', name: 'Novembro'}, {id: '12', name: 'Dezembro'}].map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>

            <select 
              value={filters.year}
              onChange={(e) => setFilters({ ...filters, year: e.target.value })}
              className="flex-1 sm:flex-none px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
            >
              {Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString()).map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </div>

      {calculatedIndicators.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-100 text-center shadow-sm">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileSpreadsheet className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Nenhum dado encontrado</h3>
          <p className="text-slate-500 max-w-md mx-auto">
            {bditssData.length > 0 
              ? `Não encontramos registros para o período de ${filters.month}/${filters.year}. Verifique se a planilha contém dados para este ano/mês ou tente ajustar os filtros acima.`
              : "Faça o upload da sua planilha contendo as abas BD e PDG para calcular os indicadores automaticamente."}
          </p>
          {bditssData.length > 0 && (
            <div className="mt-6 p-4 bg-slate-50 rounded-lg text-xs text-slate-400 font-mono text-left inline-block max-w-full overflow-auto">
              <p className="font-bold mb-1 uppercase">Debug Info:</p>
              <p>Rows in BD: {bditssData.length}</p>
              <p>Filter Year: {filters.year}</p>
              <p>Filter Month: {filters.month}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-12">
          {/* Charts Section */}
          <div className="space-y-8">
            <div className="bg-white p-6 rounded-sm border-[1.5px] border-orange-400 relative shadow-sm">
              <h3 className="absolute -top-3 left-4 bg-white px-2 text-lg font-bold text-slate-800 uppercase tracking-tight">Evolução Indisponibilidade Manutenção BMB</h3>
              <GreenArrow />
              <div className="h-80 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 25, right: 60, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                    <XAxis dataKey="month" axisLine={true} tickLine={false} tick={{ fontSize: 15, fontWeight: 600 }} />
                    <YAxis 
                      domain={[0, 8]} 
                      ticks={[0, 1, 2, 3, 4, 5, 6, 7, 8]} 
                      tickFormatter={(val) => val.toFixed(2).replace('.', ',') + '%'} 
                      axisLine={true} 
                      tickLine={false} 
                      tick={{ fontSize: 15, fontWeight: 600 }} 
                    />
                    <Tooltip 
                      contentStyle={{ fontSize: '15px', fontWeight: 'bold' }}
                      formatter={(value: number) => value.toFixed(2).replace('.', ',') + '%'} 
                    />
                    <Line type="monotone" dataKey="manutencao" stroke="#3b82f6" strokeWidth={3} strokeDasharray="5 5" name="Indisponibilidade (%)" dot={{ r: 5, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}>
                      <LabelList content={(props) => <CustomDataLabel {...props} data={chartData} metaKey="metaManutencao" />} />
                    </Line>
                    <Line type="linear" dataKey="metaManutencao" stroke="#10b981" strokeWidth={3} dot={false} name="Meta">
                      <LabelList content={(props) => <CustomMetaLabel {...props} data={chartData} />} />
                    </Line>
                    <Legend verticalAlign="bottom" height={40} iconType="plainline" wrapperStyle={{ paddingTop: '25px', fontSize: '15px', fontWeight: 'bold' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-6 rounded-sm border-[1.5px] border-orange-400 relative shadow-sm">
                <h3 className="absolute -top-3 left-4 bg-white px-2 text-lg font-bold text-slate-800 uppercase tracking-tight">Evolução Indisponibilidade Mecânica BMB</h3>
                <GreenArrow />
                <div className="h-72 mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 25, right: 60, left: 10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                      <XAxis dataKey="month" axisLine={true} tickLine={false} tick={{ fontSize: 15, fontWeight: 600 }} />
                      <YAxis 
                        domain={[0, 6]} 
                        ticks={[0, 1, 2, 3, 4, 5, 6]} 
                        tickFormatter={(val) => val.toFixed(2).replace('.', ',') + '%'} 
                        axisLine={true} 
                        tickLine={false} 
                        tick={{ fontSize: 15, fontWeight: 600 }} 
                      />
                      <Tooltip 
                        contentStyle={{ fontSize: '15px', fontWeight: 'bold' }}
                        formatter={(value: number) => value.toFixed(2).replace('.', ',') + '%'} 
                      />
                      <Line type="monotone" dataKey="mecanica" stroke="#3b82f6" strokeWidth={3} strokeDasharray="5 5" name="Indisp. Mecânica (%)" dot={{ r: 5, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}>
                        <LabelList content={(props) => <CustomDataLabel {...props} data={chartData} metaKey="metaMecanica" />} />
                      </Line>
                      <Line type="linear" dataKey="metaMecanica" stroke="#10b981" strokeWidth={3} dot={false} name="Meta">
                        <LabelList content={(props) => <CustomMetaLabel {...props} data={chartData} />} />
                      </Line>
                      <Legend verticalAlign="bottom" height={40} iconType="plainline" wrapperStyle={{ paddingTop: '25px', fontSize: '15px', fontWeight: 'bold' }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-6 rounded-sm border-[1.5px] border-orange-400 relative shadow-sm">
                <h3 className="absolute -top-3 left-4 bg-white px-2 text-lg font-bold text-slate-800 uppercase tracking-tight">Evolução Indisponibilidade Elétrica BMB</h3>
                <GreenArrow />
                <div className="h-72 mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 25, right: 60, left: 10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                      <XAxis dataKey="month" axisLine={true} tickLine={false} tick={{ fontSize: 15, fontWeight: 600 }} />
                      <YAxis 
                        domain={[0, 6]} 
                        ticks={[0, 1, 2, 3, 4, 5, 6]} 
                        tickFormatter={(val) => val.toFixed(2).replace('.', ',') + '%'} 
                        axisLine={true} 
                        tickLine={false} 
                        tick={{ fontSize: 15, fontWeight: 600 }} 
                      />
                      <Tooltip 
                        contentStyle={{ fontSize: '15px', fontWeight: 'bold' }}
                        formatter={(value: number) => value.toFixed(2).replace('.', ',') + '%'} 
                      />
                      <Line type="monotone" dataKey="eletrica" stroke="#3b82f6" strokeWidth={3} strokeDasharray="5 5" name="Indisp. Elétrica (%)" dot={{ r: 5, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}>
                        <LabelList content={(props) => <CustomDataLabel {...props} data={chartData} metaKey="metaEletrica" />} />
                      </Line>
                      <Line type="linear" dataKey="metaEletrica" stroke="#10b981" strokeWidth={3} dot={false} name="Meta">
                        <LabelList content={(props) => <CustomMetaLabel {...props} data={chartData} />} />
                      </Line>
                      <Legend verticalAlign="bottom" height={40} iconType="plainline" wrapperStyle={{ paddingTop: '25px', fontSize: '15px', fontWeight: 'bold' }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* Indicators Section */}
          <div className="space-y-12">
            {calculatedIndicators.map((section, sIdx) => (
              <div key={sIdx} className="space-y-6">
                <h3 className="text-xl text-slate-500 uppercase tracking-wider font-light border-b border-slate-100 pb-2">{section.name}</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-4 gap-y-6">
                  {section.machines.map((machine: any, mIdx: number) => (
                    <div key={mIdx} className="flex flex-col">
                      <h4 className="font-bold text-slate-700 text-sm mb-1.5 ml-1 truncate uppercase" title={machine.name}>{machine.name}</h4>
                      <div className="border border-orange-400 bg-white p-2 sm:p-3 rounded-sm shadow-sm relative min-h-[160px] flex flex-col">
                        
                        <div className="grid grid-cols-[85px_1fr_1fr] sm:grid-cols-[95px_1fr_1fr] gap-1 items-center mb-3">
                          <div className="text-[10px] sm:text-xs font-bold text-slate-500 text-right pr-1 italic">{filters.viewType === 'Acumulada' ? 'Mensal.:' : 'Diário.:'}</div>
                          <div className="text-[10px] sm:text-xs font-bold text-slate-800 text-center">ATUAL</div>
                          <div className="text-[10px] sm:text-xs font-bold text-slate-800 text-center">META</div>
                        </div>

                        <div className="grid grid-cols-[85px_1fr_1fr] sm:grid-cols-[95px_1fr_1fr] gap-1 items-center mb-2.5">
                          <div className="flex items-center justify-end space-x-2 pr-1">
                            <span className="text-[10px] sm:text-xs text-slate-700 font-bold">Mecânica.:</span>
                            <div className={cn("w-3 h-3 sm:w-4 sm:h-4 rounded-full border border-slate-300 shadow-sm", getStatusColor(machine.mecanica?.atual, machine.mecanica?.meta))} />
                          </div>
                          <div className="text-xs sm:text-sm text-slate-900 text-center font-bold">{formatPercent(machine.mecanica?.atual)}</div>
                          <div className="text-xs sm:text-sm text-slate-900 text-center font-bold">{formatPercent(machine.mecanica?.meta)}</div>
                        </div>

                        <div className="grid grid-cols-[85px_1fr_1fr] sm:grid-cols-[95px_1fr_1fr] gap-1 items-center mb-5">
                          <div className="flex items-center justify-end space-x-2 pr-1">
                            <span className="text-[10px] sm:text-xs text-slate-700 font-bold">Elétrica.:</span>
                            <div className={cn("w-3 h-3 sm:w-4 sm:h-4 rounded-full border border-slate-300 shadow-sm", getStatusColor(machine.eletrica?.atual, machine.eletrica?.meta))} />
                          </div>
                          <div className="text-xs sm:text-sm text-slate-900 text-center font-bold">{formatPercent(machine.eletrica?.atual)}</div>
                          <div className="text-xs sm:text-sm text-slate-900 text-center font-bold">{formatPercent(machine.eletrica?.meta)}</div>
                        </div>

                        <div className="mt-auto h-8 w-full flex items-end justify-center px-1 pb-1">
                          <svg viewBox="0 0 100 20" className="w-full h-full preserve-aspect-ratio-none overflow-visible">
                            <line x1="0" y1="12" x2="100" y2="12" stroke="#ef4444" strokeWidth="0.5" strokeDasharray="2,2" />
                            <polyline 
                              points={machine.sparkline || "0,15 10,12 20,18 30,15 40,15 50,15 60,15 70,15 80,15 90,15 100,15"} 
                              fill="none" 
                              stroke="#3b82f6" 
                              strokeWidth="1" 
                            />
                          </svg>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

};
