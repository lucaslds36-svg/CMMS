// ==========================================
// 🔥 FIREBASE ULTRA OTIMIZADO - CMMS
// ==========================================

import {
  getDoc,
  getDocs,
  doc,
  collection,
  query,
  limit,
  enableIndexedDbPersistence
} from "firebase/firestore"

import { db } from "../firebase"

// ==========================================
// ⚙️ CONFIG
// ==========================================
const CACHE_TIME = 5 * 60 * 1000 // 5 minutos

// ==========================================
// 🧠 CACHE EM MEMÓRIA
// ==========================================
const cache: {
  globalData: any;
  notifications: any;
  assets: any;
  workOrders: any;
  lastFetch: Record<string, number>;
} = {
  globalData: null,
  notifications: null,
  assets: null,
  workOrders: null,
  lastFetch: {}
}

// ==========================================
// 💾 CACHE OFFLINE (MOBILE)
// ==========================================
try {
  enableIndexedDbPersistence(db)
} catch (e) {
  console.warn("Cache offline já ativo ou não suportado")
}

// ==========================================
// 🧠 VALIDADOR DE CACHE
// ==========================================
function isValid(key: keyof typeof cache) {
  return (
    cache[key] &&
    cache.lastFetch[key] &&
    Date.now() - cache.lastFetch[key] < CACHE_TIME
  )
}

// ==========================================
// 🔁 RETRY INTELIGENTE (QUOTA)
// ==========================================
async function retry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  try {
    return await fn()
  } catch (err: any) {
    if (
      err.message?.includes("Quota") &&
      retries > 0
    ) {
      await new Promise(r => setTimeout(r, 1500))
      return retry(fn, retries - 1)
    }
    throw err
  }
}

// ==========================================
// 🌐 GLOBAL DATA (1 DOC)
// ==========================================
export async function getGlobalData() {
  if (isValid("globalData")) return cache.globalData

  const result = await retry(async () => {
    const snap = await getDoc(doc(db, "globalData", "main"))
    return snap.exists() ? snap.data() : {}
  })

  cache.globalData = result
  cache.lastFetch.globalData = Date.now()

  return result
}

// ==========================================
// 🔔 NOTIFICAÇÕES (LIMITADO)
// ==========================================
export async function getNotifications() {
  if (isValid("notifications")) return cache.notifications

  const result = await retry(async () => {
    const q = query(collection(db, "notifications"), limit(10))
    const snap = await getDocs(q)

    return snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }))
  })

  cache.notifications = result
  cache.lastFetch.notifications = Date.now()

  return result
}

// ==========================================
// 🏭 ASSETS
// ==========================================
export async function getAssets() {
  if (isValid("assets")) return cache.assets

  const result = await retry(async () => {
    const snap = await getDocs(collection(db, "assets"))

    return snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }))
  })

  cache.assets = result
  cache.lastFetch.assets = Date.now()

  return result
}

// ==========================================
// 📋 WORK ORDERS
// ==========================================
export async function getWorkOrders() {
  if (isValid("workOrders")) return cache.workOrders

  const result = await retry(async () => {
    const snap = await getDocs(collection(db, "work-orders"))

    return snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }))
  })

  cache.workOrders = result
  cache.lastFetch.workOrders = Date.now()

  return result
}

// ==========================================
// 👥 USERS
// ==========================================
export async function getUsers() {
  const result = await retry(async () => {
    const snap = await getDocs(collection(db, "users"))
    return snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }))
  })
  return result
}

// ==========================================
// 📅 PREVENTIVE PLANS
// ==========================================
export async function getPreventivePlans() {
  const result = await retry(async () => {
    const snap = await getDocs(collection(db, "preventive-plans"))
    return snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }))
  })
  return result
}

// ==========================================
// 👷 EMPLOYEES
// ==========================================
export async function getEmployees() {
  const result = await retry(async () => {
    const snap = await getDocs(collection(db, "employees"))
    return snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }))
  })
  return result
}

// ==========================================
// 🛠️ SERVICE DEMANDS
// ==========================================
export async function getServiceDemands() {
  const result = await retry(async () => {
    const snap = await getDocs(collection(db, "serviceDemands"))
    return snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }))
  })
  return result
}

// ==========================================
// 🧠 FETCH PADRÃO (SUBSTITUI SNAPSHOT)
// ==========================================
export async function loadData<T>(fn: () => Promise<T>, setState: (data: T) => void) {
  try {
    const data = await fn()
    setState(data)
  } catch (err) {
    console.error("Erro ao carregar:", err)
  }
}

// ==========================================
// 🔄 REFRESH MANUAL
// ==========================================
export function refresh(key: keyof typeof cache) {
  cache[key] = null
}

// ==========================================
// 🔄 REFRESH GERAL
// ==========================================
export function refreshAll() {
  Object.keys(cache).forEach(k => {
    if (k !== "lastFetch") cache[k as keyof typeof cache] = null
  })
}

// ==========================================
// 🚫 BLOQUEIO DE MULTI-REQUEST
// ==========================================
const pending: Record<string, Promise<any>> = {}

export async function safeCall<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (pending[key]) return pending[key]

  pending[key] = fn()

  try {
    const result = await pending[key]
    return result
  } finally {
    delete pending[key]
  }
}
