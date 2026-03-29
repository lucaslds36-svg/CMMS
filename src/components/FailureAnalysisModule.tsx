import React, { useState, useMemo, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, LabelList 
} from 'recharts';
import { Upload, FileSpreadsheet, Filter, X, Eye, Clock, User, Settings, Info } from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';

export const FailureAnalysisModule = ({ 
  showToast, 
  handleFileUpload, 
  data = [], 
  onDataUpdate,
  loading = false
}: { 
  showToast?: (msg: string, type?: 'success' | 'error') => void, 
  handleFileUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void,
  data?: any[],
  onDataUpdate?: (data: any[]) => void,
  loading?: boolean
}) => {
  const [rawData, setRawData] = useState<any[]>(data);
  const [filters, setFilters] = useState<Record<string, string>>({
    Ano: '',
    Mês: '',
    Turno: '',
    Setor: '',
    Grupo: '', // Mapped from 'Tipo' as per user request
    Máquina: '',
    Parte: '',
    startDate: '',
    endDate: ''
  });
  const [selectedRow, setSelectedRow] = useState<any | null>(null);

  // Helper to find the actual column name in the data
  const getColName = (possibleNames: string[]) => {
    if (rawData.length === 0) return possibleNames[0];
    const keys = Object.keys(rawData[0]);
    const upperPossible = possibleNames.map(n => n.toUpperCase());
    
    // Exact match (case insensitive)
    const exact = keys.find(k => upperPossible.includes(k.toUpperCase()));
    if (exact) return exact;
    
    // Partial match
    const partial = keys.find(k => {
      const s = k.toUpperCase();
      return upperPossible.some(p => s.includes(p));
    });
    return partial || possibleNames[0];
  };

  const parseHours = (val: any) => {
    if (val === undefined || val === null || val === '-' || val === '') return 0;
    
    // If it's a number, it's likely a decimal hour (e.g. 0.49)
    if (typeof val === 'number') {
      // Excel serial time check: if it's a fraction of a day and the column is likely Time formatted
      // But based on user feedback, it's already decimal hours (0.49)
      return val;
    }
    
    if (typeof val === 'string') {
      const s = val.trim().replace(',', '.');
      
      // Handle HH:MM or HH:MM:SS (e.g. "01:30" or "01:30:00")
      if (s.includes(':')) {
        const parts = s.split(':').map(Number);
        if (parts.length >= 2 && !parts.some(isNaN)) {
          const h = parts[0];
          const m = parts[1];
          const s = parts[2] || 0;
          return h + (m / 60) + (s / 3600);
        }
      }
      
      const num = parseFloat(s);
      return isNaN(num) ? 0 : num;
    }
    
    return 0;
  };

  // Sync with props data
  useEffect(() => {
    if (data && data.length > 0) {
      // Fallback: if data is array of arrays (header: 1), convert to objects
      if (Array.isArray(data[0])) {
        console.log("FailureAnalysisModule: Received array of arrays, converting to objects...");
        const headers = data[0];
        const objects = data.slice(1).map(row => {
          const obj: any = {};
          if (Array.isArray(row)) {
            headers.forEach((h: any, i: number) => {
              if (h !== undefined && h !== null) {
                obj[String(h)] = row[i];
              }
            });
          }
          return obj;
        }).filter(obj => Object.keys(obj).length > 0);
        setRawData(objects);
        // Notify parent about the converted data if needed
        if (onDataUpdate) {
          setTimeout(() => onDataUpdate(objects), 0);
        }
      } else {
        setRawData(data);
      }
    } else {
      setRawData([]);
    }
  }, [data, onDataUpdate]);

  const formatDate = (dateVal: any) => {
    if (!dateVal) return '';
    
    // If it's a number (Excel serial date)
    if (typeof dateVal === 'number') {
      const date = new Date((dateVal - 25569) * 86400 * 1000);
      // Adjust for timezone offset to keep the same day
      date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
      return date.toLocaleDateString('pt-BR');
    }
    
    // If it's a string
    if (typeof dateVal === 'string') {
      // Handle YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}/.test(dateVal)) {
        const [y, m, d] = dateVal.split(/[-T ]/).map(Number);
        return new Date(y, m - 1, d).toLocaleDateString('pt-BR');
      }
      // Handle DD/MM/YYYY
      if (/^\d{2}\/\d{2}\/\d{4}/.test(dateVal)) {
        return dateVal;
      }
    }

    const date = new Date(dateVal);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('pt-BR');
    }
    
    return String(dateVal);
  };

  const parseToDate = (row: any) => {
    const dataCol = getColName(['Data', 'Dia', 'Date', 'Day']);
    const val = row[dataCol];
    if (!val) return null;

    let date: Date | null = null;
    
    if (typeof val === 'number') {
      // Excel serial date
      date = new Date((val - 25569) * 86400 * 1000);
      date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
    } else if (typeof val === 'string') {
      if (/^\d{4}-\d{2}-\d{2}/.test(val)) {
        const [y, m, d] = val.split(/[-T ]/).map(Number);
        date = new Date(y, m - 1, d);
      } else if (/^\d{2}\/\d{2}\/\d{4}/.test(val)) {
        const [d, m, y] = val.split('/').map(Number);
        date = new Date(y, m - 1, d);
      } else {
        date = new Date(val);
      }
    } else {
      date = new Date(val);
    }
    
    if (!date || isNaN(date.getTime())) {
      const anoCol = getColName(['Ano', 'Year']);
      const mesCol = getColName(['Mês', 'Mes', 'Month']);
      const diaCol = getColName(['Dia', 'Day']);
      
      if (row[anoCol] && row[mesCol] && row[diaCol]) {
        const months: Record<string, number> = {
          'Janeiro': 0, 'Fevereiro': 1, 'Março': 2, 'Abril': 3, 'Maio': 4, 'Junho': 5,
          'Julho': 6, 'Agosto': 7, 'Setembro': 8, 'Outubro': 9, 'Novembro': 10, 'Dezembro': 11
        };
        const monthStr = String(row[mesCol]);
        const month = months[monthStr] !== undefined ? months[monthStr] : (parseInt(monthStr) - 1);
        date = new Date(parseInt(row[anoCol]), month, parseInt(row[diaCol]));
      }
    }

    if (date && !isNaN(date.getTime())) {
      // Normalize to midnight local time
      return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }
    
    return null;
  };

  const parseInputDate = (dateStr: string) => {
    if (!dateStr) return null;
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const COLORS = ['#1e3a8a', '#f97316', '#10b981', '#6366f1', '#8b5cf6', '#ec4899'];
  const SECTOR_COLORS: Record<string, string> = {
    'Elétrico': '#1e3a8a',
    'Eletrico': '#1e3a8a',
    'Mecânico': '#f97316',
    'Mecanico': '#f97316'
  };

  const localHandleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (handleFileUpload) {
      handleFileUpload(e);
      return;
    }
    
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      
      const sheetName = workbook.SheetNames.find(name => 
        name.toUpperCase().includes('BDITSS') ||
        name.toLowerCase().includes('falha') || 
        name.toLowerCase().includes('failure') || 
        name.toLowerCase().includes('dados')
      ) || workbook.SheetNames[0];

      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet);
      setRawData(data);
      if (onDataUpdate) onDataUpdate(data);
      localStorage.setItem('failureAnalysisData', JSON.stringify(data));
      if (showToast) showToast('Arquivo carregado e salvo localmente!', 'success');
    } catch (error) {
      console.error('Error reading file:', error);
      if (showToast) showToast('Erro ao ler arquivo.', 'error');
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleChartClick = (key: string, value: string) => {
    if (value === 'N/A') return;
    setFilters(prev => {
      const isSelected = prev[key] === value;
      const newValue = isSelected ? '' : value;
      
      if (showToast) {
        if (isSelected) showToast(`Filtro de ${key} removido`, 'success');
        else showToast(`Filtrando por ${key}: ${value}`, 'success');
      }
      
      return { ...prev, [key]: newValue };
    });
  };

  const clearFilters = () => {
    setFilters({
      Ano: '', Mês: '', Turno: '', Setor: '', Grupo: '', Máquina: '', Parte: '', startDate: '', endDate: ''
    });
  };

  // Pre-calculate column mappings for filters to improve performance
  const filterColMapping = useMemo(() => {
    const mapping: Record<string, string> = {};
    Object.keys(filters).forEach(key => {
      if (key === 'startDate' || key === 'endDate') return;
      let possibleNames = [key, key.toUpperCase(), key.toLowerCase()];
      if (key === 'Grupo') possibleNames = ['Grupo', 'Tipo', 'Tipo (Grupo)', 'Categoria'];
      if (key === 'Máquina') possibleNames = ['Máquina', 'Maquina', 'Equipamento', 'Ativo'];
      if (key === 'Parte') possibleNames = ['Parte', 'Componente', 'Subconjunto'];
      if (key === 'Causa') possibleNames = ['Causa', 'Motivo', 'Falha'];
      if (key === 'Setor') possibleNames = ['Setor', 'Área', 'Area', 'Departamento'];
      mapping[key] = getColName(possibleNames);
    });
    return mapping;
  }, [rawData, filters]);

  const getUniqueValues = (key: string) => {
    const actualKey = filterColMapping[key];
    if (!actualKey) return [];
    
    // Filter rawData by other active filters to show only relevant options (cascading)
    // This ensures that if "Tipo" is selected, only machines of that type appear, and vice versa.
    const dataForOptions = rawData.filter(row => {
      return Object.entries(filters).every(([fKey, fValue]) => {
        if (!fValue || fKey === key || fKey === 'startDate' || fKey === 'endDate') return true;
        const fActualKey = filterColMapping[fKey];
        if (!fActualKey) return true;
        return String(row[fActualKey]) === String(fValue);
      });
    });

    const values = dataForOptions.map(row => row[actualKey]).filter(val => val !== undefined && val !== null && val !== '');
    return Array.from(new Set(values)).sort((a: any, b: any) => {
      if (typeof a === 'number' && typeof b === 'number') return a - b;
      return String(a).localeCompare(String(b));
    });
  };

  // Filter data
  const filteredData = useMemo(() => {
    return rawData.filter(row => {
      // Date range filter
      if (filters.startDate || filters.endDate) {
        const rowDate = parseToDate(row);
        if (rowDate) {
          if (filters.startDate) {
            const start = parseInputDate(filters.startDate);
            if (start && rowDate < start) return false;
          }
          if (filters.endDate) {
            const end = parseInputDate(filters.endDate);
            if (end) {
              end.setHours(23, 59, 59, 999);
              if (rowDate > end) return false;
            }
          }
        } else {
          // If we have a date filter but no date in row, exclude it
          return false; 
        }
      }

      return Object.entries(filters).every(([key, value]) => {
        if (!value || key === 'startDate' || key === 'endDate') return true; // No filter selected or handled above
        
        let possibleNames = [key, key.toUpperCase(), key.toLowerCase()];
        if (key === 'Grupo') possibleNames = ['Grupo', 'Tipo', 'Tipo (Grupo)', 'Categoria'];
        if (key === 'Máquina') possibleNames = ['Máquina', 'Maquina', 'Equipamento', 'Ativo'];
        if (key === 'Parte') possibleNames = ['Parte', 'Componente', 'Subconjunto'];
        if (key === 'Causa') possibleNames = ['Causa', 'Motivo', 'Falha'];
        if (key === 'Setor') possibleNames = ['Setor', 'Área', 'Area', 'Departamento'];

        const actualKey = getColName(possibleNames);
        return String(row[actualKey]) === String(value);
      });
    });
  }, [rawData, filters]);

  const aggregateData = (groupBy: string, sumBy: string, countBy?: string) => {
    const result: Record<string, any> = {};
    
    filteredData.forEach(row => {
      const key = row[groupBy] || 'N/A';
      if (!result[key]) {
        result[key] = { name: key, [sumBy]: 0 };
        if (countBy) result[key][countBy] = 0;
      }
      
      const hours = parseHours(row[sumBy]);
      result[key][sumBy] += hours;
      if (countBy) result[key][countBy] += 1;
    });
    
    // Format numbers to 2 decimal places
    return Object.values(result)
      .map(item => ({
        ...item,
        [sumBy]: Number(item[sumBy].toFixed(2))
      }))
      .sort((a, b) => b[sumBy] - a[sumBy]);
  };

  // Prepare chart data
  const horasCol = useMemo(() => {
    if (rawData.length === 0) return 'Horas';
    const keys = Object.keys(rawData[0]);
    // Prioritize exact matches or common names
    const priorityKeys = ['HORA', 'HORAS', 'DURAÇÃO', 'DURACAO', 'TEMPO', 'HR', 'HORA PARADA', 'HORA DE PARADA'];
    const foundPriority = keys.find(k => priorityKeys.includes(k.toUpperCase()));
    if (foundPriority) return foundPriority;

    const found = keys.find(k => {
      const s = k.toLowerCase();
      return s.includes('hora') || s.includes('duração') || s.includes('duracao') || s.includes('tempo') || s.includes('parada');
    });
    return found || 'Horas';
  }, [rawData]);

  const totalHoras = useMemo(() => {
    const total = filteredData.reduce((acc, row) => {
      const hours = parseHours(row[horasCol]);
      return acc + hours;
    }, 0);
    return Number(total.toFixed(2));
  }, [filteredData, horasCol]);
  
  const grupoCol = useMemo(() => getColName(['Grupo', 'Tipo', 'Tipo (Grupo)', 'Categoria']), [rawData]);
  const maquinaCol = useMemo(() => getColName(['Máquina', 'Maquina', 'Equipamento', 'Ativo']), [rawData]);
  const parteCol = useMemo(() => getColName(['Parte', 'Componente', 'Subconjunto']), [rawData]);
  const causaCol = useMemo(() => getColName(['Causa', 'Motivo', 'Falha']), [rawData]);
  const setorCol = useMemo(() => getColName(['Setor', 'Área', 'Area', 'Departamento']), [rawData]);

  const grupoData = useMemo(() => aggregateData(grupoCol, horasCol).slice(0, 10), [filteredData, horasCol, grupoCol]);
  const maquinaData = useMemo(() => aggregateData(maquinaCol, horasCol, 'paradas').slice(0, 10), [filteredData, horasCol, maquinaCol]);
  const parteData = useMemo(() => aggregateData(parteCol, horasCol, 'paradas').slice(0, 10), [filteredData, horasCol, parteCol]);
  const causaData = useMemo(() => aggregateData(causaCol, horasCol).slice(0, 10), [filteredData, horasCol, causaCol]);
  const setorData = useMemo(() => aggregateData(setorCol, horasCol).slice(0, 10), [filteredData, horasCol, setorCol]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex-1">
          <h3 className="text-xl font-bold text-slate-900">Análise de Falhas (BI)</h3>
          {rawData.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-3">
              <div className="bg-orange-50 border border-orange-100 px-3 py-1.5 rounded-xl flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                <div>
                  <p className="text-[9px] font-bold text-orange-400 uppercase leading-none">Total de Horas</p>
                  <p className="text-lg font-black text-orange-600">{totalHoras}h</p>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-xl flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                <div>
                  <p className="text-[9px] font-bold text-blue-400 uppercase leading-none">Total de Registros</p>
                  <p className="text-lg font-black text-blue-600">{filteredData.length}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {rawData.length === 0 ? (
        loading ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-100 text-center shadow-sm">
            <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Carregando dados...</h3>
            <p className="text-slate-500 max-w-md mx-auto">
              Aguarde enquanto buscamos suas informações no servidor.
            </p>
          </div>
        ) : (
          <div className="bg-white p-12 rounded-2xl border border-slate-100 text-center shadow-sm">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileSpreadsheet className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Nenhuma base de dados importada</h3>
            <p className="text-slate-500 max-w-md mx-auto">
              Faça o upload da sua planilha contendo o histórico de falhas para visualizar os dashboards dinâmicos.
            </p>
          </div>
        )
      ) : (
        <>
          {/* Filtros Dinâmicos */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2 text-slate-700 font-medium text-sm">
                <Filter className="w-4 h-4" />
                <span>Filtros Dinâmicos</span>
              </div>
              <button 
                onClick={clearFilters}
                className="text-xs text-slate-500 hover:text-blue-600 flex items-center space-x-1"
              >
                <X className="w-3 h-3" />
                <span>Limpar Filtros</span>
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="flex flex-col col-span-1 sm:col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">
                  Intervalo de Datas (Dia)
                </label>
                <div className="flex items-center space-x-2">
                  <input 
                    type="date"
                    className="flex-1 text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={filters.startDate}
                    onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  />
                  <span className="text-slate-400 text-xs">até</span>
                  <input 
                    type="date"
                    className="flex-1 text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={filters.endDate}
                    onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  />
                </div>
              </div>

              {Object.keys(filters).filter(k => k !== 'startDate' && k !== 'endDate').map(filterKey => (
                <div key={filterKey} className="flex flex-col">
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">
                    {filterKey === 'Grupo' ? 'Tipo (Grupo)' : filterKey}
                  </label>
                  <select 
                    className="text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={filters[filterKey]}
                    onChange={(e) => handleFilterChange(filterKey, e.target.value)}
                  >
                    <option value="">Todos</option>
                    {getUniqueValues(filterKey).map((val: any, idx) => (
                      <option key={idx} value={val}>{val}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-slate-500 text-right">
              Mostrando {filteredData.length} de {rawData.length} registros
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h4 className="font-bold text-slate-700 mb-4">Hr. Parada / Grupo (Tipo)</h4>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    layout="vertical"
                    data={grupoData}
                    margin={{ top: 5, right: 40, left: 40, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={120} fontSize={12} interval={0} />
                    <Tooltip cursor={{fill: 'transparent'}} />
                    <Bar 
                      dataKey={horasCol} 
                      name="Horas Paradas" 
                      fill="#f97316" 
                      barSize={30} 
                      onClick={(data) => handleChartClick('Grupo', String(data.name))}
                      style={{ cursor: 'pointer' }}
                    >
                      <LabelList dataKey={horasCol} position="right" fontSize={12} fontWeight="bold" formatter={(val: any) => `${val}h`} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h4 className="font-bold text-slate-700 mb-4">Hr. Parada / Setor (Elétrico vs Mecânico)</h4>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={setorData}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
                        if (percent <= 0.05) return null;
                        const RADIAN = Math.PI / 180;
                        const radius = outerRadius * 1.1;
                        const x = cx + radius * Math.cos(-midAngle * RADIAN);
                        const y = cy + radius * Math.sin(-midAngle * RADIAN);
                        return (
                          <text 
                            x={x} 
                            y={y} 
                            fill="#334155" 
                            textAnchor={x > cx ? 'start' : 'end'} 
                            dominantBaseline="central"
                            fontSize={12}
                            fontWeight="bold"
                          >
                            {`${name}: ${(percent * 100).toFixed(0)}%`}
                          </text>
                        );
                      }}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey={horasCol}
                      onClick={(data) => handleChartClick('Setor', String(data.name))}
                      style={{ cursor: 'pointer' }}
                    >
                      {setorData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={SECTOR_COLORS[String(entry.name)] || COLORS[index % COLORS.length]} 
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => [`${value}h`, 'Horas Paradas']} />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h4 className="font-bold text-slate-700 mb-4">Hr. Parada / Máquina</h4>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    layout="vertical"
                    data={maquinaData}
                    margin={{ top: 5, right: 40, left: 40, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={120} fontSize={12} interval={0} />
                    <Tooltip cursor={{fill: 'transparent'}} />
                    <Legend />
                    <Bar 
                      dataKey={horasCol} 
                      name="Hr. Total Parada" 
                      fill="#f97316" 
                      barSize={20} 
                      onClick={(data) => handleChartClick('Máquina', String(data.name))}
                      style={{ cursor: 'pointer' }}
                    >
                      <LabelList dataKey={horasCol} position="right" fontSize={12} fontWeight="bold" formatter={(val: any) => `${val}h`} />
                    </Bar>
                    <Bar dataKey="paradas" name="Número paradas" fill="#1e3a8a" barSize={20}>
                      <LabelList dataKey="paradas" position="right" fontSize={12} fontWeight="bold" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h4 className="font-bold text-slate-700 mb-4">Hr. Parada / Parte</h4>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    layout="vertical"
                    data={parteData}
                    margin={{ top: 5, right: 40, left: 40, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={180} fontSize={12} interval={0} />
                    <Tooltip cursor={{fill: 'transparent'}} />
                    <Legend />
                    <Bar 
                      dataKey={horasCol} 
                      name="Horas Paradas" 
                      fill="#f97316" 
                      barSize={20} 
                      onClick={(data) => handleChartClick('Parte', String(data.name))}
                      style={{ cursor: 'pointer' }}
                    >
                      <LabelList dataKey={horasCol} position="right" fontSize={12} fontWeight="bold" formatter={(val: any) => `${val}h`} />
                    </Bar>
                    <Bar dataKey="paradas" name="Número Paradas" fill="#1e3a8a" barSize={20}>
                      <LabelList dataKey="paradas" position="right" fontSize={12} fontWeight="bold" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm lg:col-span-2">
              <h4 className="font-bold text-slate-700 mb-4">Hr. Parada / Causa</h4>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    layout="vertical"
                    data={causaData}
                    margin={{ top: 5, right: 40, left: 40, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={180} fontSize={12} interval={0} />
                    <Tooltip cursor={{fill: 'transparent'}} />
                    <Bar 
                      dataKey={horasCol} 
                      name="Horas Paradas" 
                      fill="#f97316" 
                      barSize={30} 
                      onClick={(data) => handleChartClick('Causa', String(data.name))}
                      style={{ cursor: 'pointer' }}
                    >
                      <LabelList dataKey={horasCol} position="right" fontSize={12} fontWeight="bold" formatter={(val: any) => `${val}h`} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Histórico de Ações Table */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <h4 className="font-bold text-slate-700 mb-4">Histórico de Ações (Últimos 50 registros)</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3 font-bold text-slate-600">Descrição Detalhada</th>
                    <th className="px-4 py-3 font-bold text-slate-600">Executante</th>
                    <th className="px-4 py-3 font-bold text-slate-600 text-right">Hr. Parada</th>
                    <th className="px-4 py-3 font-bold text-slate-600">Data</th>
                    <th className="px-4 py-3 font-bold text-slate-600">Máquina</th>
                    <th className="px-4 py-3 font-bold text-slate-600">Causa</th>
                    <th className="px-4 py-3 font-bold text-slate-600 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredData.slice(0, 50).map((row: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="text-[11px] text-slate-700 leading-relaxed whitespace-normal min-w-[250px]">
                          {row['Descrição'] || row['Descricao'] || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        <div className="flex items-center space-x-2">
                          <User className="w-3 h-3 text-slate-400" />
                          <span>{row['Executante'] || row['Nome'] || row['Pessoa'] || '-'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-orange-600">
                        {row[horasCol] !== undefined ? Number(row[horasCol]).toFixed(2) : '-'}h
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        <div className="flex items-center space-x-2">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{formatDate(row['Data'] || row['Dia'])}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 font-medium">
                        {row['Máquina'] || row['Maquina'] || '-'}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold uppercase">
                          {row['Causa'] || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button 
                          onClick={() => setSelectedRow(row)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Ver Detalhes"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredData.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center justify-center text-slate-400">
                          <Info className="w-8 h-8 mb-2 opacity-20" />
                          <p>Nenhum registro encontrado para os filtros selecionados.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detail Modal */}
          <AnimatePresence>
            {selectedRow && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden"
                >
                  <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">Detalhes da Ocorrência</h3>
                        <p className="text-xs text-slate-500">Informações completas do registro</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSelectedRow(null)}
                      className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
                    {/* Descrição em destaque */}
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Descrição Completa</label>
                      <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-slate-800 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                        {selectedRow['Descrição'] || selectedRow['Descricao'] || 'Sem descrição detalhada.'}
                      </div>
                    </div>

                    {/* Grid de informações */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Máquina</label>
                        <p className="font-bold text-slate-900">{selectedRow['Máquina'] || selectedRow['Maquina'] || '-'}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Parte / Componente</label>
                        <p className="font-bold text-slate-900">{selectedRow['Parte'] || '-'}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tempo de Parada</label>
                        <p className="font-bold text-orange-600 text-lg">
                          {selectedRow[horasCol] !== undefined ? Number(selectedRow[horasCol]).toFixed(2) : '-'}h
                        </p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Causa</label>
                        <p className="font-bold text-slate-900">{selectedRow['Causa'] || '-'}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data</label>
                        <p className="font-bold text-slate-900">{formatDate(selectedRow['Data'] || selectedRow['Dia'])}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Executante</label>
                        <p className="font-bold text-slate-900">{selectedRow['Executante'] || selectedRow['Nome'] || selectedRow['Pessoa'] || '-'}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Turno</label>
                        <p className="font-bold text-slate-900">{selectedRow['Turno'] || '-'}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Setor</label>
                        <p className="font-bold text-slate-900">{selectedRow['Setor'] || '-'}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Grupo (Tipo)</label>
                        <p className="font-bold text-slate-900">{selectedRow['Grupo'] || '-'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                    <button 
                      onClick={() => setSelectedRow(null)}
                      className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                    >
                      Fechar
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
};
