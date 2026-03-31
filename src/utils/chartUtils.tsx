import React from 'react';

export const getMonthNumber = (val: any) => {
  if (val === null || val === undefined) return null;
  
  // If it's already a number
  if (typeof val === 'number') {
    if (val >= 1 && val <= 12) return val;
    return null;
  }
  
  const s = String(val).trim().toUpperCase();
  
  // If it's a numeric string
  if (/^\d+$/.test(s)) {
    const num = parseInt(s);
    if (num >= 1 && num <= 12) return num;
    return null;
  }

  const fullMonths = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
  const shortMonths = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  
  const idx = fullMonths.indexOf(s);
  if (idx !== -1) return idx + 1;
  
  const shortIdx = shortMonths.indexOf(s);
  if (shortIdx !== -1) return shortIdx + 1;
  
  return null;
};

export const parsePercent = (val: any) => {
  if (typeof val === 'number') return val;
  if (typeof val !== 'string') return null;
  const clean = val.replace('%', '').replace(',', '.').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
};

export const CustomDataLabel = (props: any) => {
  const { x, y, value, index, data, metaKey } = props;
  if (value == null || value === 0) return null;
  
  const valNum = parsePercent(value) || 0;
  const meta = data[index][metaKey];
  const metaNum = parsePercent(meta) || 0;
  
  const isOverMeta = valNum > metaNum;
  const bgColor = isOverMeta ? '#f87171' : '#86efac'; 
  const textColor = isOverMeta ? '#ffffff' : '#064e3b'; 

  return (
    <g transform={`translate(${x},${y - 22})`}>
      <rect x={-24} y={-14} width={48} height={22} fill={bgColor} rx={4} />
      <text x={0} y={0} fill={textColor} fontSize={12} fontWeight="bold" textAnchor="middle" dominantBaseline="middle">
        {valNum.toFixed(2).replace('.', ',') + '%'}
      </text>
    </g>
  );
};

export const CustomMetaLabel = (props: any) => {
  const { x, y, value, index, data } = props;
  if (index !== data.length - 1 || value == null) return null;
  
  return (
    <g transform={`translate(${x + 45},${y})`}>
      <rect x={-25} y={-11} width={50} height={22} fill="#f1f5f9" stroke="#cbd5e1" strokeWidth={0.5} rx={4} />
      <text x={0} y={3} fill="#475569" fontSize={12} fontWeight="bold" textAnchor="middle">
        {value.toFixed(2).replace('.', ',') + '%'}
      </text>
    </g>
  );
};

export const GreenArrow = () => (
  <div className="absolute right-4 top-1/2 -translate-y-1/2">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 4V20M12 20L18 14M12 20L6 14" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </div>
);
