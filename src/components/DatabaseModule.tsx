import React, { useState, useEffect } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Trash2, Database } from 'lucide-react';
import * as XLSX from 'xlsx';
import { auth, saveDatabaseEntry, saveGlobalData } from '../firebase';

interface DatabaseModuleProps {
  onDataImported: (data: { bditss: any[], dinamica: any[], failureAnalysis: any[], indicators: any[], chartData: any[] }) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  isAdmin?: boolean;
}

export const DatabaseModule: React.FC<DatabaseModuleProps> = ({ onDataImported, showToast, isAdmin }) => {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    bdCount: 0,
    pdgCount: 0,
    bditssCount: 0,
    lastUpdate: ''
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = () => {
    let bd = [];
    let pdg = [];
    let bditss = [];
    
    try {
      const bdStr = localStorage.getItem('bdData');
      bd = bdStr && bdStr !== "undefined" ? JSON.parse(bdStr) : [];
    } catch (e) {
      console.error("Failed to parse bdData", e);
      localStorage.removeItem('bdData');
    }

    try {
      const pdgStr = localStorage.getItem('dinamicaData');
      pdg = pdgStr && pdgStr !== "undefined" ? JSON.parse(pdgStr) : [];
    } catch (e) {
      console.error("Failed to parse dinamicaData", e);
      localStorage.removeItem('dinamicaData');
    }

    try {
      const bditssStr = localStorage.getItem('bditssData');
      bditss = bditssStr && bditssStr !== "undefined" ? JSON.parse(bditssStr) : [];
    } catch (e) {
      console.error("Failed to parse bditssData", e);
      localStorage.removeItem('bditssData');
    }
    
    const lastUpdate = localStorage.getItem('lastDatabaseUpdate') || 'Nunca';

    setStats({
      bdCount: bd.length,
      pdgCount: pdg.length,
      bditssCount: bditss.length,
      lastUpdate
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      
      console.log('Sheet names found:', workbook.SheetNames);

      // 1. Parse BD (Dashboard main base)
      const bdSheetName = workbook.SheetNames.find(name => name.trim().toUpperCase() === 'BD');
      let bdData: any[] = [];
      let bdFound = false;
      if (bdSheetName) {
        const sheet = workbook.Sheets[bdSheetName];
        bdData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        bdFound = true;
      }

      // 2. Parse PDG (Dashboard goals)
      const pdgSheetName = workbook.SheetNames.find(name => name.trim().toUpperCase() === 'PDG');
      let pdgData: any[] = [];
      let pdgFound = false;
      if (pdgSheetName) {
        const sheet = workbook.Sheets[pdgSheetName];
        pdgData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        pdgFound = true;
      }

      // 3. Parse BDITSS (Failure Analysis base)
      const bditssSheetName = workbook.SheetNames.find(name => name.trim().toUpperCase() === 'BDITSS');
      console.log('BDITSS sheet name found:', bditssSheetName);
      let bditssData: any[] = [];
      let bditssFound = false;
      if (bditssSheetName) {
        const sheet = workbook.Sheets[bditssSheetName];
        // Read as array of arrays first to find header
        const bditssRaw: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        
        let headerRowIdx = 0;
        for (let i = 0; i < Math.min(bditssRaw.length, 30); i++) {
          const row = bditssRaw[i];
          if (Array.isArray(row)) {
            // Look for a row that has at least 2 of our key columns
            const matches = row.filter(h => {
              const s = String(h || '').toUpperCase();
              return s.includes('HORA') || s.includes('MAQUINA') || s.includes('MÁQUINA') || s.includes('GRUPO') || s.includes('SETOR') || s.includes('CAUSA') || s.includes('DESCRIÇÃO');
            }).length;
            
            if (matches >= 2) {
              headerRowIdx = i;
              break;
            }
          }
        }
        
        // Convert to objects using the found header row
        // Use raw: true to get the actual numbers directly from Excel
        const bditssParsed = XLSX.utils.sheet_to_json(sheet, { range: headerRowIdx, raw: true });
        
        // Filter out rows that are clearly empty or just summary footers
        bditssData = bditssParsed.filter((row: any) => {
          const values = Object.values(row);
          const isEmptyRow = values.every(v => v === null || v === '' || v === undefined);
          const isSummaryRow = values.some(v => String(v).toUpperCase() === 'TOTAL GERAL') && values.length < 5;
          return !isEmptyRow && !isSummaryRow;
        });

        console.log(`BDITSS sheet found: "${bditssSheetName}" at row ${headerRowIdx + 1} with ${bditssData.length} rows.`);
        bditssFound = true;
      } else {
        console.log('BDITSS sheet not found');
      }

      // 4. Save to LocalStorage and Firestore
      const now = new Date().toLocaleString('pt-BR');
      if (bdFound) {
        const bdJson = JSON.stringify(bdData);
        localStorage.setItem('bdData', bdJson);
        if (isAdmin) {
          console.log("Saving bdData to global Firestore...");
          try {
            await saveGlobalData('bdData', bdData);
            console.log("bdData saved successfully.");
          } catch (e) {
            console.error("Failed to save bdData to Firestore:", e);
          }
        }
      }
      if (pdgFound) {
        const pdgJson = JSON.stringify(pdgData);
        localStorage.setItem('dinamicaData', pdgJson);
        if (isAdmin) {
          console.log("Saving dinamicaData to global Firestore...");
          try {
            await saveGlobalData('dinamicaData', pdgData);
            console.log("dinamicaData saved successfully.");
          } catch (e) {
            console.error("Failed to save dinamicaData to Firestore:", e);
          }
        }
      }
      if (bditssFound) {
        const bditssJson = JSON.stringify(bditssData);
        localStorage.setItem('bditssData', bditssJson);
        if (isAdmin) {
          console.log("Saving bditssData to global Firestore...");
          try {
            await saveGlobalData('bditssData', bditssData);
            console.log("bditssData saved successfully.");
          } catch (e) {
            console.error("Failed to save bditssData to Firestore:", e);
          }
        }
        window.dispatchEvent(new Event('failureAnalysisDataUpdated'));
      }
      
      // Clear old indicators as they are now calculated dynamically
      localStorage.removeItem('dashboardIndicators');
      localStorage.removeItem('dashboardChartData');
      localStorage.setItem('lastDatabaseUpdate', now);

      if (bdFound || pdgFound || bditssFound) {
        onDataImported({ bditss: bdData, dinamica: pdgData, failureAnalysis: bditssData, indicators: [], chartData: [] });
        loadStats();
        
        const loadedSheets = [
          bdFound ? 'BD' : '',
          pdgFound ? 'PDG' : '',
          bditssFound ? 'BDITSS' : ''
        ].filter(Boolean).join(', ');
        
        showToast(`Base de dados importada com sucesso! (${loadedSheets})`, 'success');
      } else {
        showToast('Nenhuma aba compatível encontrada (BD, PDG ou BDITSS).', 'error');
      }
    } catch (error) {
      console.error('Error importing database:', error);
      showToast('Erro ao importar base de dados. Verifique o formato do arquivo.', 'error');
    } finally {
      setLoading(false);
      // Reset input so the same file can be uploaded again
      e.target.value = '';
    }
  };

  const clearDatabase = async () => {
    localStorage.removeItem('bdData');
    localStorage.removeItem('dinamicaData');
    localStorage.removeItem('bditssData');
    localStorage.removeItem('dashboardIndicators');
    localStorage.removeItem('lastDatabaseUpdate');
    localStorage.removeItem('failureAnalysisData');
    
    // If admin, also clear global storage in Firestore
    if (isAdmin) {
      try {
        await saveGlobalData('bdData', '[]');
        await saveGlobalData('dinamicaData', '[]');
        await saveGlobalData('bditssData', '[]');
        console.log("Global Firestore data cleared.");
      } catch (e) {
        console.error("Failed to clear global Firestore data:", e);
      }
    }
    
    onDataImported({ bditss: [], dinamica: [], failureAnalysis: [], indicators: [], chartData: [] });
    loadStats();
    showToast('Base de dados local limpa com sucesso!');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-200">
          <Database className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Banco de Dados Local</h1>
          <p className="text-slate-500 font-medium">Importe arquivos .xlsx ou .xlsb para alimentar o sistema</p>
        </div>
      </div>

      <div className="bg-white p-4 sm:p-8 rounded-3xl border border-slate-100 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
          <div className="p-4 sm:p-6 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="text-slate-500 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-2">Registros BD</div>
            <div className="text-2xl sm:text-3xl font-bold text-slate-900">{stats.bdCount}</div>
          </div>
          <div className="p-4 sm:p-6 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="text-slate-500 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-2">Registros PDG</div>
            <div className="text-2xl sm:text-3xl font-bold text-slate-900">{stats.pdgCount}</div>
          </div>
          <div className="p-4 sm:p-6 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="text-slate-500 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-2">Registros BDITSS</div>
            <div className="text-2xl sm:text-3xl font-bold text-slate-900">{stats.bditssCount}</div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center p-6 sm:p-12 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50 hover:bg-slate-50 transition-colors">
          <FileSpreadsheet className="w-10 h-10 sm:w-12 sm:h-12 text-slate-300 mb-4" />
          <h4 className="text-lg font-bold text-slate-900 mb-2 text-center">Importar Nova Planilha</h4>
          <p className="text-slate-500 text-sm mb-6 text-center max-w-md">
            Selecione um arquivo .xlsx ou .xlsb contendo as abas BD, PDG e BDITSS para atualizar as informações do sistema.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            {loading ? (
              <div className="flex items-center justify-center space-x-3 px-6 py-3 bg-slate-100 text-slate-500 rounded-xl font-bold animate-pulse w-full">
                <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"></div>
                <span>Processando...</span>
              </div>
            ) : (
              <label className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 cursor-pointer flex items-center justify-center space-x-2 w-full sm:w-auto">
                <Upload className="w-5 h-5" />
                <span>Selecionar Arquivo</span>
                <input 
                  type="file" 
                  accept=".xlsx, .xlsb, .xls" 
                  className="hidden" 
                  onChange={handleFileUpload} 
                />
              </label>
            )}
            
            <button 
              onClick={clearDatabase}
              disabled={loading}
              className="px-6 py-3 bg-white text-rose-600 border border-rose-100 rounded-xl font-bold hover:bg-rose-50 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
            >
              <Trash2 className="w-5 h-5" />
              <span>Limpar Tudo</span>
            </button>
          </div>
        </div>

        <div className="mt-8 p-4 bg-blue-50 text-blue-700 rounded-2xl flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-bold mb-1">Informação de Sincronização</p>
            <p>Os dados importados por usuários Master são salvos na nuvem e sincronizados automaticamente para todos os dispositivos. Usuários Executantes podem visualizar os dados atualizados em tempo real.</p>
            <p className="mt-2 text-xs opacity-70">Última atualização: {stats.lastUpdate}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
