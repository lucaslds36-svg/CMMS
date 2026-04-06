import React, { useState, useMemo, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, LabelList 
} from 'recharts';
import { Upload, FileSpreadsheet, Filter, X, Eye, Clock, User, Settings, Info, Download, Printer } from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';
import autoTable from 'jspdf-autotable';

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
  const [rawData, setRawData] = useState<any[]>(Array.isArray(data) ? data : []);
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

  // Pre-calculate column names once when rawData changes
  const colNames = useMemo(() => {
    if (!rawData || rawData.length === 0) return {};
    const keys = Object.keys(rawData[0]);
    const findCol = (possibleNames: string[]) => {
      const upperPossible = possibleNames.map(n => n.toUpperCase());
      const exact = keys.find(k => upperPossible.includes(k.toUpperCase()));
      if (exact) return exact;
      const partial = keys.find(k => {
        const s = k.toUpperCase();
        return upperPossible.some(p => s.includes(p));
      });
      return partial || possibleNames[0];
    };

    return {
      data: findCol(['Data', 'Dia', 'Date', 'Day', 'Ocorrência', 'Ocorrencia', 'Início', 'Inicio']),
      ano: findCol(['Ano', 'Year']),
      mes: findCol(['Mês', 'Mes', 'Month']),
      dia: findCol(['Dia', 'Day']),
      grupo: findCol(['Grupo', 'Tipo', 'Tipo (Grupo)', 'Categoria']),
      maquina: findCol(['Máquina', 'Maquina', 'Equipamento', 'Ativo']),
      parte: findCol(['Parte', 'Componente', 'Subconjunto']),
      causa: findCol(['Causa', 'Motivo', 'Falha']),
      setor: findCol(['Setor', 'Área', 'Area', 'Departamento'])
    };
  }, [rawData]);

  // Pre-parse dates for better performance
  const rawDataWithDates = useMemo(() => {
    if (!Array.isArray(rawData) || !colNames.data) return [];
    
    const monthsNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    
    const monthsMap: Record<string, number> = {};
    monthsNames.forEach((name, i) => { monthsMap[name] = i; });

    return rawData.map(row => {
      let date: Date | null = null;
      const val = row[colNames.data];
      
      if (val) {
        if (val instanceof Date) {
          date = val;
        } else if (typeof val === 'number') {
          // Excel serial date
          date = new Date((val - 25569) * 86400 * 1000);
          if (val < 61) date.setDate(date.getDate() + 1);
          date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
        } else if (typeof val === 'string') {
          const s = val.trim();
          if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
            const [y, m, d] = s.split(/[-T ]/).map(Number);
            date = new Date(y, m - 1, d);
          } else if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
            const [d, m, y] = s.split('/').map(Number);
            date = new Date(y, m - 1, d);
          } else if (/^\d{2}-\d{2}-\d{4}/.test(s)) {
            const [d, m, y] = s.split('-').map(Number);
            date = new Date(y, m - 1, d);
          } else {
            date = new Date(s);
          }
        }
      }

      // Fallback to separate columns
      if ((!date || isNaN(date.getTime())) && row[colNames.ano] && row[colNames.mes]) {
        const monthStr = String(row[colNames.mes]);
        const month = monthsMap[monthStr] !== undefined ? monthsMap[monthStr] : (parseInt(monthStr) - 1);
        const day = parseInt(row[colNames.dia]) || 1;
        date = new Date(parseInt(row[colNames.ano]), month, day);
      }

      const normalizedDate = (date && !isNaN(date.getTime())) 
        ? new Date(date.getFullYear(), date.getMonth(), date.getDate())
        : null;

      // Derive year and month for filtering
      const derivedYear = normalizedDate ? String(normalizedDate.getFullYear()) : String(row[colNames.ano] || '');
      const derivedMonth = normalizedDate ? monthsNames[normalizedDate.getMonth()] : String(row[colNames.mes] || '');

      return { 
        ...row, 
        _parsedDate: normalizedDate,
        _derivedYear: derivedYear,
        _derivedMonth: derivedMonth
      };
    });
  }, [rawData, colNames]);

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

  useEffect(() => {
    console.log("FailureAnalysisModule: Received data length:", Array.isArray(data) ? data.length : 0);
    if (Array.isArray(data) && data.length > 0) {
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
      
      // Correcting for Excel's 1900 leap year bug
      if (dateVal < 61) {
        date.setDate(date.getDate() + 1);
      }
      
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
    const dataCol = getColName(['Data', 'Dia', 'Date', 'Day', 'Ocorrência', 'Ocorrencia', 'Início', 'Inicio']);
    const val = row[dataCol];
    if (!val) return null;

    let date: Date | null = null;
    
    if (val instanceof Date) {
      date = val;
    } else if (typeof val === 'number') {
      date = new Date((val - 25569) * 86400 * 1000);
      if (val < 61) date.setDate(date.getDate() + 1);
      date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
    } else if (typeof val === 'string') {
      const s = val.trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        const [y, m, d] = s.split(/[-T ]/).map(Number);
        date = new Date(y, m - 1, d);
      } else if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
        const [d, m, y] = s.split('/').map(Number);
        date = new Date(y, m - 1, d);
      } else if (/^\d{2}-\d{2}-\d{4}/.test(s)) {
        const [d, m, y] = s.split('-').map(Number);
        date = new Date(y, m - 1, d);
      } else {
        date = new Date(s);
      }
    } else {
      date = new Date(val);
    }
    
    if (!date || isNaN(date.getTime())) {
      const anoCol = getColName(['Ano', 'Year']);
      const mesCol = getColName(['Mês', 'Mes', 'Month']);
      const diaCol = getColName(['Dia', 'Day']);
      
      if (row[anoCol] && row[mesCol]) {
        const monthsNames = [
          'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
          'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        const monthsMap: Record<string, number> = {};
        monthsNames.forEach((name, i) => { monthsMap[name] = i; });

        const monthStr = String(row[mesCol]);
        const month = monthsMap[monthStr] !== undefined ? monthsMap[monthStr] : (parseInt(monthStr) - 1);
        const day = parseInt(row[diaCol]) || 1;
        date = new Date(parseInt(row[anoCol]), month, day);
      }
    }

    if (date && !isNaN(date.getTime())) {
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
      
      // Read as array of arrays first to find header
      const rawData: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      
      let headerRowIdx = 0;
      for (let i = 0; i < Math.min(rawData.length, 30); i++) {
        const row = rawData[i];
        if (Array.isArray(row)) {
          // Look for a row that has at least 2 of our key columns
          const matches = row.filter(h => {
            const s = String(h || '').toUpperCase();
            return s.includes('HORA') || s.includes('MAQUINA') || s.includes('MÁQUINA') || s.includes('GRUPO') || s.includes('SETOR') || s.includes('CAUSA') || s.includes('DESCRIÇÃO') || s.includes('STATUS');
          }).length;
          
          if (matches >= 2) {
            headerRowIdx = i;
            break;
          }
        }
      }

      const data = XLSX.utils.sheet_to_json(sheet, { range: headerRowIdx, raw: true });
      console.log('FailureAnalysisModule: Parsed data:', data);
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

  const handleChartClick = (key: string, value: any) => {
    const strValue = String(value).trim();
    if (!strValue || strValue === 'N/A' || strValue === 'undefined') return;
    
    const isSelected = filters[key] === strValue;
    const newValue = isSelected ? '' : strValue;
    
    if (showToast) {
      if (isSelected) showToast(`Filtro de ${key} removido`, 'success');
      else showToast(`Filtrando por ${key}: ${strValue}`, 'success');
    }
    
    setFilters(prev => ({ ...prev, [key]: newValue }));
  };

  const clearFilters = () => {
    setFilters({
      Ano: '', Mês: '', Turno: '', Setor: '', Grupo: '', Máquina: '', Parte: '', startDate: '', endDate: ''
    });
  };

  const generatePDF = async () => {
    if (filteredData.length === 0) {
      if (showToast) showToast('Não há dados para gerar o PDF.', 'error');
      return;
    }

    if (showToast) showToast('Gerando relatório PDF profissional...', 'success');

    // Wait for UI to settle
    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      // Professional Header
      doc.setFillColor(30, 58, 138); 
      doc.rect(0, 0, pageWidth, 25, 'F');
      
      doc.setFontSize(20);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text('RELATÓRIO DE ANÁLISE DE FALHAS', pageWidth / 2, 16, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, pageWidth - 15, 20, { align: 'right' });
      
      let currentY = 35;

      // Stats Section
      doc.setTextColor(30, 58, 138);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Resumo Executivo', 15, currentY);
      
      currentY += 8;
      doc.setDrawColor(226, 232, 240);
      doc.line(15, currentY, pageWidth - 15, currentY);
      
      currentY += 10;
      doc.setFontSize(11);
      doc.setTextColor(51, 65, 85);
      doc.setFont('helvetica', 'normal');
      
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(15, currentY, 85, 20, 2, 2, 'F');
      doc.roundedRect(110, currentY, 85, 20, 2, 2, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.text('Total de Horas Paradas', 20, currentY + 7);
      doc.text('Total de Ocorrências', 115, currentY + 7);
      
      doc.setFontSize(14);
      doc.setTextColor(30, 58, 138);
      doc.text(`${totalHoras}h`, 20, currentY + 15);
      doc.text(`${filteredData.length}`, 115, currentY + 15);
      
      currentY += 30;

      // Filters summary
      const activeFilters = Object.entries(filters).filter(([_, v]) => v !== '');
      if (activeFilters.length > 0) {
        doc.setFontSize(12);
        doc.setTextColor(30, 58, 138);
        doc.setFont('helvetica', 'bold');
        doc.text('Parâmetros de Seleção', 15, currentY);
        currentY += 6;
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.setFont('helvetica', 'normal');
        
        const filterTexts = activeFilters.map(([k, v]) => `${k}: ${v}`).join('  |  ');
        const splitFilters = doc.splitTextToSize(filterTexts, pageWidth - 30);
        doc.text(splitFilters, 15, currentY);
        currentY += (splitFilters.length * 5) + 10;
      }

      // Capture charts
      doc.setFontSize(14);
      doc.setTextColor(30, 58, 138);
      doc.setFont('helvetica', 'bold');
      doc.text('Análise Gráfica', 15, currentY);
      currentY += 10;

      const chartContainers = document.querySelectorAll('.failure-analysis-chart');
      const chartTitles = [
        'Hr. Parada / Grupo (Tipo)',
        'Hr. Parada / Setor (Elétrico vs Mecânico)',
        'Hr. Parada / Máquina',
        'Hr. Parada / Parte',
        'Hr. Parada / Causa'
      ];
      
      for (let i = 0; i < chartContainers.length; i++) {
        // Maximize width to page margins (210mm - 20mm = 190mm)
        const imgWidth = 190;
        // Increase height for better visibility
        const imgHeight = 135; 
        const spacing = 10;
        const xPos = (pageWidth - imgWidth) / 2;

        // Check if we need a new page before adding the title and chart
        // Title (8mm) + Chart (135mm) + Margin (10mm)
        if (currentY + imgHeight + 15 > pageHeight - 15) {
          doc.addPage();
          currentY = 20;
        }
        
        doc.setFontSize(12);
        doc.setTextColor(30, 58, 138);
        doc.setFont('helvetica', 'bold');
        doc.text(chartTitles[i] || `Gráfico ${i + 1}`, 15, currentY);
        currentY += 8;

        try {
          const element = chartContainers[i] as HTMLElement;
          
          // Use toPng with high quality and stable dimensions
          // We use a 16:9-ish aspect ratio for the capture to match the PDF dimensions
          const imgData = await toPng(element, {
            quality: 1,
            pixelRatio: 3,
            backgroundColor: '#ffffff',
            width: 1400, 
            height: 900, 
            style: {
              padding: '30px', 
              margin: '0',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }
          });
          
          doc.addImage(imgData, 'PNG', xPos, currentY, imgWidth, imgHeight);
          currentY += imgHeight + spacing;
        } catch (err) {
          console.error(`Failed to capture chart ${i}:`, err);
          doc.setFontSize(10);
          doc.setTextColor(239, 68, 68);
          doc.text(`[Erro na renderização do gráfico ${i + 1}]`, 20, currentY + 10);
          currentY += 20;
        }
      }

      // Action History Table
      doc.addPage();
      currentY = 20;
      doc.setFontSize(14);
      doc.setTextColor(30, 58, 138);
      doc.setFont('helvetica', 'bold');
      doc.text('Histórico Detalhado de Ocorrências', 15, currentY);
      
      const tableData = filteredData.map(row => [
        formatDate(row['Data'] || row['Dia'] || row['Date']),
        row['Máquina'] || row['Maquina'] || row['Equipamento'] || '-',
        row['Setor'] || row['Área'] || '-',
        row['Causa'] || row['Motivo'] || '-',
        `${parseHours(row[horasCol]).toFixed(2)}h`,
        row['Descrição'] || row['Descricao'] || '-'
      ]);

      autoTable(doc, {
        head: [['Data', 'Máquina', 'Setor', 'Causa', 'Horas', 'Descrição']],
        body: tableData,
        startY: currentY + 10,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 20 },
          1: { cellWidth: 25 },
          2: { cellWidth: 20 },
          3: { cellWidth: 25 },
          4: { cellWidth: 15 },
          5: { cellWidth: 'auto' }
        },
        margin: { left: 15, right: 15 }
      });
      
      // Add page numbers to all pages
      const totalPages = doc.internal.pages.length - 1;
      for (let j = 1; j <= totalPages; j++) {
        doc.setPage(j);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`Página ${j} de ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      }

      doc.save(`Relatorio_Analise_Falhas_${new Date().getTime()}.pdf`);

      if (showToast) showToast('Relatório PDF gerado com sucesso!', 'success');
    } catch (error) {
      console.error('Error generating PDF:', error);
      if (showToast) showToast('Erro ao gerar relatório PDF.', 'error');
    }
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
    if (!Array.isArray(rawDataWithDates)) return [];
    
    const actualKey = filterColMapping[key];
    
    // Filter rawDataWithDates by other active filters to show only relevant options (cascading)
    const dataForOptions = rawDataWithDates.filter(row => {
      return Object.entries(filters).every(([fKey, fValue]) => {
        if (!fValue || fKey === key || fKey === 'startDate' || fKey === 'endDate') return true;
        
        if (fKey === 'Ano') return row._derivedYear === String(fValue);
        if (fKey === 'Mês') return row._derivedMonth === String(fValue);
        
        const fActualKey = filterColMapping[fKey];
        if (!fActualKey) return true;
        return String(row[fActualKey]) === String(fValue);
      });
    });

    let values: any[] = [];
    if (key === 'Ano') {
      values = dataForOptions.map(row => row._derivedYear);
    } else if (key === 'Mês') {
      values = dataForOptions.map(row => row._derivedMonth);
    } else if (actualKey) {
      values = dataForOptions.map(row => row[actualKey]);
    }

    const cleanValues = values.filter(val => val !== undefined && val !== null && val !== '');
    return Array.from(new Set(cleanValues)).sort((a: any, b: any) => {
      if (key === 'Mês') {
        const monthsOrder = [
          'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
          'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        return monthsOrder.indexOf(a) - monthsOrder.indexOf(b);
      }
      if (typeof a === 'number' && typeof b === 'number') return a - b;
      return String(a).localeCompare(String(b), undefined, { numeric: true });
    });
  };

  // Filter data
  const filteredData = useMemo(() => {
    if (!Array.isArray(rawDataWithDates)) return [];
    
    const start = filters.startDate ? parseInputDate(filters.startDate) : null;
    const end = filters.endDate ? parseInputDate(filters.endDate) : null;
    if (end) end.setHours(23, 59, 59, 999);

    const activeFilterEntries = Object.entries(filters).filter(([key, value]) => 
      value !== '' && key !== 'startDate' && key !== 'endDate'
    );

    return rawDataWithDates.filter(row => {
      // Date range filter
      if (start || end) {
        const rowDate = row._parsedDate;
        if (!rowDate) return false;
        if (start && rowDate < start) return false;
        if (end && rowDate > end) return false;
      }

      return activeFilterEntries.every(([key, value]) => {
        if (key === 'Ano') return row._derivedYear === String(value);
        if (key === 'Mês') return row._derivedMonth === String(value);
        
        const actualKey = filterColMapping[key];
        return String(row[actualKey]) === String(value);
      });
    });
  }, [rawDataWithDates, filters, filterColMapping]);

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

  const lastUpdateDate = useMemo(() => {
    if (!Array.isArray(rawData) || rawData.length === 0) return null;
    let maxDate: Date | null = null;
    rawData.forEach(row => {
      const date = parseToDate(row);
      if (date && (!maxDate || date > maxDate)) {
        maxDate = date;
      }
    });
    return maxDate;
  }, [rawData]);

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
              <div className="bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-xl flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <div>
                  <p className="text-[9px] font-bold text-emerald-400 uppercase leading-none">Dados Atualizados Até</p>
                  <p className="text-lg font-black text-emerald-600">{lastUpdateDate ? formatDate(lastUpdateDate) : '-'}</p>
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
            <div className="flex items-center space-x-4">
              <button 
                onClick={generatePDF}
                className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center space-x-1 font-bold bg-emerald-50 px-3 py-1.5 rounded-lg transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Gerar PDF</span>
              </button>
              <button 
                onClick={clearFilters}
                className="text-xs text-slate-500 hover:text-blue-600 flex items-center space-x-1"
              >
                <X className="w-3 h-3" />
                <span>Limpar Filtros</span>
              </button>
            </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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

              {/* Filtro Agrupado: Tipo e Máquina */}
              <div className="flex flex-col col-span-1 sm:col-span-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 ml-1 flex items-center">
                  <Filter className="w-3 h-3 mr-1" /> Filtro Combinado (Tipo & Máquina)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Tipo (Grupo)</label>
                    <select 
                      className="text-xs border border-slate-200 rounded-lg p-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                      value={filters['Grupo']}
                      onChange={(e) => handleFilterChange('Grupo', e.target.value)}
                    >
                      <option value="">Todos</option>
                      {getUniqueValues('Grupo').map((val: any, idx) => (
                        <option key={idx} value={val}>{val}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Máquina</label>
                    <select 
                      className="text-xs border border-slate-200 rounded-lg p-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                      value={filters['Máquina']}
                      onChange={(e) => handleFilterChange('Máquina', e.target.value)}
                    >
                      <option value="">Todas</option>
                      {getUniqueValues('Máquina').map((val: any, idx) => (
                        <option key={idx} value={val}>{val}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {Object.keys(filters).filter(k => k !== 'startDate' && k !== 'endDate' && k !== 'Grupo' && k !== 'Máquina').map(filterKey => (
                <div key={filterKey} className="flex flex-col col-span-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">
                    {filterKey}
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
              <div className="h-96 failure-analysis-chart">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
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
                      isAnimationActive={false}
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
              <div className="h-96 failure-analysis-chart">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <PieChart>
                    <Pie
                      data={setorData}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      isAnimationActive={false}
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
              <div className="h-96 failure-analysis-chart">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
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
                      isAnimationActive={false}
                      onClick={(data) => handleChartClick('Máquina', String(data.name))}
                      style={{ cursor: 'pointer' }}
                    >
                      <LabelList dataKey={horasCol} position="right" fontSize={12} fontWeight="bold" formatter={(val: any) => `${val}h`} />
                    </Bar>
                    <Bar dataKey="paradas" name="Número paradas" fill="#1e3a8a" barSize={20} isAnimationActive={false}>
                      <LabelList dataKey="paradas" position="right" fontSize={12} fontWeight="bold" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h4 className="font-bold text-slate-700 mb-4">Hr. Parada / Parte</h4>
              <div className="h-96 failure-analysis-chart">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
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
                      isAnimationActive={false}
                      onClick={(data) => handleChartClick('Parte', String(data.name))}
                      style={{ cursor: 'pointer' }}
                    >
                      <LabelList dataKey={horasCol} position="right" fontSize={12} fontWeight="bold" formatter={(val: any) => `${val}h`} />
                    </Bar>
                    <Bar dataKey="paradas" name="Número Paradas" fill="#1e3a8a" barSize={20} isAnimationActive={false}>
                      <LabelList dataKey="paradas" position="right" fontSize={12} fontWeight="bold" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm lg:col-span-2">
              <h4 className="font-bold text-slate-700 mb-4">Hr. Parada / Causa</h4>
              <div className="h-96 failure-analysis-chart">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
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
                      isAnimationActive={false}
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
