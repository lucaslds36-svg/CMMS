export interface Asset {
  ID: string;
  Tag: string;
  Model: string;
  Description: string;
  Status: 'Ativo' | 'Inativo' | 'Em Manutenção' | 'Parado';
  Location: string;
  Plant: string;
  Manufacturer: string;
  InstallDate: string;
}

export interface WorkOrder {
  ID: string;
  AssetID: string;
  PlanID?: string;
  Description: string;
  Priority: 'Baixa' | 'Média' | 'Alta' | 'Crítica';
  Status: 'Em Aberto' | 'Em Execução' | 'Concluída' | 'Cancelada';
  AssignedTo: string;
  CreatedAt: string;
  ScheduledDate: string;
  StartDate?: string;
  EndDate?: string;
  CompletedAt: string;
  EstimatedTime?: number;
  Collaborators?: number;
}

export interface PreventivePlan {
  ID: string;
  AssetIDs: string[];
  AssetLastDones?: Record<string, string>;
  AssetNextDues?: Record<string, string>;
  Task: string;
  Frequency: string;
  LastDone: string;
  NextDue: string;
  Type: 'Preventiva' | 'Inspeção' | 'Lubrificação' | 'Manutenção Programada';
  Criticality: 'Alta' | 'Média' | 'Baixa';
  AssetType: string;
  Location: string;
  Plant: string;
  EstimatedTime: number;
  Collaborators: number;
}

export interface Employee {
  ID: string;
  Name: string;
  Function: 'Mecânico' | 'Eletrônico' | 'Outro';
  Status: 'Ativo' | 'Férias' | 'Afastado';
  Type: 'Próprio' | 'Terceiro';
}

export interface ServiceDemandScopeChange {
  id: string;
  description: string;
  date: string;
  user: string;
}

export interface EngineeringTask {
  id: string;
  name: string;
  responsible: string;
  plannedDate: string;
  completedDate?: string;
  status: 'Pendente' | 'Em andamento' | 'Concluído';
  type: 'Interno' | 'Externo';
  requiresMaterial: boolean;
  investmentValue?: number;
}

export interface EngineeringAdjustment {
  id: string;
  date: string;
  description: string;
  responsible: string;
}

export interface EngineeringIndicator {
  id: string;
  name: string;
  before: number;
  after: number;
  variation: number;
}

export interface EngineeringComment {
  id: string;
  text: string;
  user: string;
  date: string;
}

export interface EngineeringStatusChange {
  id: string;
  status: string;
  date: string;
  user: string;
}

export interface EngineeringProject {
  id: string;
  title: string;
  assetId: string;
  assetName: string;
  description: string;
  objective: string;
  indicator: string;
  responsible: string;
  status: 'Planejado' | 'Em execução' | 'Em teste' | 'Validado' | 'Cancelado';
  startDate: string; // ISO string
  testStartDate?: string; // ISO string
  plannedTestDays: number;
  testStatus: 'Não iniciado' | 'Em teste' | 'Aprovado' | 'Reprovado';
  result?: 'Sucesso' | 'Parcial' | 'Falha';
  lessonsLearned?: string;
  standardize: boolean;
  createdAt: string;
  updatedAt: string;
  tasks?: EngineeringTask[];
  adjustments?: EngineeringAdjustment[];
  indicators?: EngineeringIndicator[];
  comments?: EngineeringComment[];
  statusHistory?: EngineeringStatusChange[];
}

export interface ServiceDemandStatusChange {
  id: string;
  status: 'Não Iniciado' | 'Em andamento' | 'Parado' | 'Cancelado' | 'Concluído';
  date: string;
  user: string;
}

export interface MaterialRequisition {
  item: string;
  requisitionNumber: string;
  deliveryDate: string;
}

export interface ServiceDemand {
  id: string;
  openedAt: string;
  requesterUid: string;
  requesterName: string;
  description: string;
  area: 'Trefila' | 'Cordeira Car' | 'Cordeira Truck' | 'Semi Pronto' | 'Logistica' | 'Centralizado' | 'Área externa' | 'Utilidades';
  executorType: 'Próprio' | 'Terceiro';
  responsibleId: string;
  responsibleName: string;
  priority: 'Alta' | 'Média' | 'Baixa';
  estimatedDeliveryDate: string;
  startDate?: string;
  executorName?: string;
  status: 'Não Iniciado' | 'Em andamento' | 'Parado' | 'Cancelado' | 'Concluído';
  needsMaterial: boolean;
  materialRequisition?: MaterialRequisition;
  scopeChanges: ServiceDemandScopeChange[];
  statusHistory: ServiceDemandStatusChange[];
  closedAt?: string;
}

export interface UserPermissions {
  dashboard: boolean;
  assets: boolean;
  workOrders: boolean;
  preventive: boolean;
  employees: boolean;
  failureAnalysis: boolean;
  database: boolean;
  users: boolean;
  serviceManagement: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  role: 'admin' | 'user';
  createdAt: string;
  permissions?: UserPermissions;
}
