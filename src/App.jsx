import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Utensils, ShoppingCart, Send, User, ChevronLeft, Minus, Plus,
  CheckCircle, Search, ChefHat, UserCircle2, Users, LayoutDashboard,
  Trash2, Package, DollarSign, X, Coffee, Pizza, Sandwich, ClipboardList,
  Wallet, TrendingUp, LogOut, Edit3, Calendar, ChevronRight, Coins,
  ArrowDownCircle, ArrowUpCircle, Save, Lock, Unlock, AlertCircle, PlusCircle,
  AlertTriangle, CalendarDays, BarChart3, Loader2, ListPlus, ChevronDown,
  CheckCircle2, FolderLock, Archive, Banknote, RotateCcw, Landmark, History,
  Clock, ArrowRightLeft, Store, MonitorSmartphone, Cake, CalendarClock, Phone,
  CheckSquare, Printer, Settings, MessageCircle, AlertOctagon, Sparkles
} from 'lucide-react';
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from "firebase/auth";
import { getFirestore, collection, addDoc, onSnapshot, query, doc, updateDoc, deleteDoc, setDoc, getDoc, Timestamp, writeBatch } from "firebase/firestore";

// --- CONFIGURAÇÃO DO FIREBASE ---
const fallbackFirebaseConfig = {
  apiKey: "AIzaSyAzaNVsJsB4vFMNW1WG1MQbdQDYoDnmduA",
  authDomain: "lanchonete-6b915.firebaseapp.com",
  projectId: "lanchonete-6b915",
  storageBucket: "lanchonete-6b915.firebasestorage.app",
  messagingSenderId: "894517269506",
  appId: "1:894517269506:web:3c25cf6a65cb4d4687831b"
};

let firebaseConfig = fallbackFirebaseConfig;
try {
  if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    firebaseConfig = typeof __firebase_config === 'string' ? JSON.parse(__firebase_config) : __firebase_config;
  }
} catch (e) {
  console.error("Falha ao analisar __firebase_config. Usando fallback.", e);
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const appId = (typeof __app_id !== 'undefined' && __app_id) ? __app_id : 'cafe-da-praca-fortaleza';

const getCollectionRef = (colName) => collection(db, 'artifacts', appId, 'public', 'data', colName);
const getDocRef = (colName, docId) => doc(db, 'artifacts', appId, 'public', 'data', colName, docId);

// --- CONFIGURAÇÃO GEMINI API ---
const apiKey = ""; 

const callGemini = async (prompt) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
  const payload = { contents: [{ parts: [{ text: prompt }] }] };

  let retries = 5;
  const delays = [1000, 2000, 4000, 8000, 16000];

  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`Erro API: ${response.status}`);
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "Não foi possível gerar resposta.";
    } catch (error) {
      if (i === retries - 1) return "IA indisponível.";
      await new Promise(res => setTimeout(res, delays[i]));
    }
  }
};

// --- DADOS PADRÃO ---
const DEFAULT_PRODUCTS_SEED = [
  { id: 1, name: 'Café 210ml', price: 4.00, category: 'Bebidas', stock: 100, icon: 'drink' },
  { id: 2, name: 'Tapioca', price: 4.00, category: 'Lanches', stock: 50, icon: 'burger' },
  { id: 3, name: 'Cuscuz', price: 4.00, category: 'Lanches', stock: 50, icon: 'burger' },
  { id: 4, name: 'Carne Desfiada 80g', price: 5.00, category: 'Adicionais', stock: 30, icon: 'fries' },
  { id: 5, name: 'Frango Desfiado 80g', price: 5.00, category: 'Adicionais', stock: 30, icon: 'fries' },
  { id: 6, name: 'Queijo Fatia', price: 3.00, category: 'Adicionais', stock: 50, icon: 'fries' },
  { id: 7, name: 'Ovo 1 un', price: 3.00, category: 'Adicionais', stock: 50, icon: 'fries' },
];

const CATEGORIES = ['Lanches', 'Adicionais', 'Bebidas', 'Salgados', 'Sobremesas', 'Bolos'];
const MESAS = Array.from({ length: 10 }, (_, i) => `Mesa ${String(i + 1).padStart(2, '0')}`);

// --- HELPERS E COMPONENTES COMPARTILHADOS ---
const formatMoney = (val) => {
  const n = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(n)) return 'R$ 0,00';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatDate = (dateStr) => {
  if (!dateStr) return '--/--';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
  return dateStr;
};

const getTodayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getWeekId = (dateStr) => {
  if (!dateStr) return 'sem-data';
  try {
    const d = new Date(dateStr + 'T12:00:00');
    const onejan = new Date(d.getFullYear(), 0, 1);
    const millis = d.getTime() - onejan.getTime();
    const week = Math.ceil((((millis / 86400000) + onejan.getDay() + 1) / 7));
    return `${d.getFullYear()}-W${week.toString().padStart(2, '0')}`;
  } catch (e) { return 'erro-data'; }
};

const calcItemTotal = (item) => {
  const subTotal = (item.subItems || []).reduce((acc, sub) => acc + (sub.price * sub.qty), 0);
  return (item.price + subTotal) * item.qty;
};

const getStockDeductions = (cartArray) => {
  const deductions = {};
  cartArray.forEach(item => {
    deductions[item.id] = (deductions[item.id] || 0) + item.qty;
    item.subItems?.forEach(sub => {
      deductions[sub.id] = (deductions[sub.id] || 0) + (sub.qty * item.qty);
    });
  });
  return deductions;
};

// --- FUNÇÃO DE IMPRESSÃO VERSÁTIL ---
const handlePrint = (order, settings, type = 'customer') => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const storeName = settings?.storeName || "CAFÉ DA PRAÇA";
  const storePhone = settings?.phone || "(85) 9 9675-2621";
  const storeAddress = settings?.address || "Av. Contorno Norte, 1050-A, Conjunto Esperança";
  
  let itemsHtml = '';
  order.items?.forEach(i => {
    itemsHtml += `
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
        <span style="font-weight: bold;">${i.qty}x ${i.name}</span>
        ${type === 'customer' ? `<span>${formatMoney(calcItemTotal(i))}</span>` : ''}
      </div>
    `;
    i.subItems?.forEach(sub => {
      itemsHtml += `<div style="margin-left: 10px; font-size: 0.85em; color: #444;">+ ${sub.qty * i.qty}x ${sub.name}</div>`;
    });
    if (i.obs) {
      itemsHtml += `<div style="margin-left: 10px; font-size: 0.85em; font-style: italic; color: #d32f2f;">Obs: ${i.obs}</div>`;
    }
  });

  const content = `
    <html>
      <head>
        <title>${type === 'customer' ? 'Recibo' : 'Ticket Cozinha'}</title>
        <style>
          body { font-family: 'Courier New', monospace; padding: 20px; max-width: 300px; margin: 0 auto; color: #000; line-height: 1.2; }
          .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
          .footer { text-align: center; border-top: 1px dashed #000; padding-top: 10px; margin-top: 20px; font-size: 0.8em; }
          .bold { font-weight: bold; }
          .total { font-size: 1.2em; border-top: 1px solid #00; margin-top: 10px; padding-top: 5px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2 style="margin: 0;">${storeName}</h2>
          ${type === 'customer' ? `<p style="margin: 2px 0;">${storeAddress}<br/>Tel: ${storePhone}</p>` : '<p style="margin: 2px 0; font-weight: bold;">TICKET DE PRODUÇÃO</p>'}
        </div>
        
        <div style="margin-bottom: 10px;">
          <p style="margin: 2px 0;">ID: #${order.id || 'N/A'}</p>
          <p style="margin: 2px 0;">Cliente: <span class="bold">${order.client}</span></p>
          <p style="margin: 2px 0;">Data/Hora: ${new Date().toLocaleString('pt-BR')}</p>
        </div>

        <div style="border-top: 1px solid #000; padding-top: 8px;">
          ${itemsHtml}
        </div>

        ${type === 'customer' ? `
          <div class="total">
            <div style="display: flex; justify-content: space-between;"><span class="bold">TOTAL:</span><span class="bold">${formatMoney(order.total)}</span></div>
            <div style="display: flex; justify-content: space-between; font-size: 0.8em; margin-top:4px;"><span>PAGAMENTO:</span><span>${order.method || 'Dinheiro'}</span></div>
            ${order.receivedValue ? `<div style="display: flex; justify-content: space-between; font-size: 0.8em;"><span>RECEBIDO:</span><span>${formatMoney(order.receivedValue)}</span></div>` : ''}
            ${order.changeValue ? `<div style="display: flex; justify-content: space-between; font-size: 0.8em;"><span>TROCO:</span><span>${formatMoney(order.changeValue)}</span></div>` : ''}
          </div>
        ` : ''}

        <div class="footer">
          <p>Agradecemos a preferência!</p>
        </div>
        <script>window.onload = function() { window.print(); window.close(); }</script>
      </body>
    </html>
  `;

  printWindow.document.write(content);
  printWindow.document.close();
};

const IconMapper = ({ type, className }) => {
  switch (type) {
    case 'burger': return <Sandwich className={className} />;
    case 'drink': return <Coffee className={className} />;
    case 'fries': return <Package className={className} />;
    case 'dessert': return <Cake className={className} />;
    default: return <Package className={className} />;
  }
};

const Toast = ({ message, type, onClose }) => (
  <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg animate-in slide-in-from-bottom-5 fade-in duration-300 ${type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
    {type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
    <span className="font-medium text-sm">{message}</span>
    <button onClick={onClose} className="ml-2 hover:bg-white/20 rounded-full p-1"><X size={14} /></button>
  </div>
);

// --------------------------------------------------------------------------------
// COMPONENTE: FLUXO DE CAIXA
// --------------------------------------------------------------------------------
const CashControl = ({ user, orders }) => {
  const [records, setRecords] = useState([]);
  const [closedWeeks, setClosedWeeks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [confirmState, setConfirmState] = useState({ isOpen: false, msg: '', action: null });
  const [currentView, setCurrentView] = useState('entry');
  const [cashCounts, setCashCounts] = useState({ bills: { 200: '', 100: '', 50: '', 20: '', 10: '', 5: '', 2: '' }, coins: { 1: '', 0.50: '', 0.25: '', 0.10: '', 0.05: '' }, pix: '' });
  const [date, setDate] = useState(getTodayStr());
  const [pix, setPix] = useState('');
  const [cash, setCash] = useState('');
  const [card, setCard] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const cashCalculatorRefs = useRef({});
  const isCalculatorLoaded = useRef(false);

  useEffect(() => {
    if (!user) return;
    const unsubRecord = onSnapshot(query(getCollectionRef('records_v2')), (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      setRecords(docs); setLoading(false);
    }, (err) => { console.error("Records error:", err); setLoading(false); });
    
    const unsubWeeks = onSnapshot(query(getCollectionRef('closed_weeks')), (snap) => {
      setClosedWeeks(snap.docs.map(d => d.id));
    }, (err) => console.error("Weeks error:", err));
    
    const loadCalculator = async () => {
      try {
        const docSnap = await getDoc(getDocRef('app_state', 'calculator')); 
        if (docSnap.exists()) setCashCounts(docSnap.data()); 
        isCalculatorLoaded.current = true;
      } catch (e) { isCalculatorLoaded.current = true; }
    };
    loadCalculator();
    return () => { unsubRecord(); unsubWeeks(); };
  }, [user]);

  useEffect(() => {
    if (!user || !isCalculatorLoaded.current) return; 
    const timer = setTimeout(async () => { 
      try { await setDoc(getDocRef('app_state', 'calculator'), cashCounts); } catch (e) {} 
    }, 1000); 
    return () => clearTimeout(timer);
  }, [cashCounts, user]);

  const posTotals = useMemo(() => {
    if (!orders || !date) return { pix: 0, cash: 0, card: 0, total: 0 };
    const dailyOrders = orders.filter(o => o?.paymentStatus === 'PAGO' && (o.paidAt || o.date)?.startsWith(date));
    const acc = { pix: 0, cash: 0, card: 0, total: 0 };
    dailyOrders.forEach(order => {
      acc.total += Number(order.total) || 0;
      if (order.payments?.length) {
        order.payments.forEach(p => {
          const val = Number(p.value) || 0; 
          if (['Dinheiro'].includes(p.method)) acc.cash += val; 
          else if (['Pix', 'PIX'].includes(p.method)) acc.pix += val; 
          else acc.card += val;
        });
      } else { 
        const m = order.method || ''; 
        const val = Number(order.total) || 0; 
        if (m.includes('Dinheiro')) acc.cash += val; 
        else if (m.includes('Pix') || m.includes('PIX')) acc.pix += val; 
        else acc.card += val; 
      }
    });
    return acc;
  }, [orders, date]);

  const handleSave = async () => { 
    if (!user || isSubmitting) return; 
    const valPix = parseFloat(pix) || 0, valCash = parseFloat(cash) || 0, valCard = parseFloat(card) || 0; 
    setIsSubmitting(true); 
    try {
      await addDoc(getCollectionRef('records_v2'), { date, pix: valPix, cash: valCash, card: valCard, total: valPix + valCash + valCard, createdAt: Timestamp.now() }); 
      setPix(''); setCash(''); setCard(''); 
      setToast({ msg: "Salvo com sucesso!", type: 'success' });
    } catch(e) { setToast({ msg: "Erro ao salvar.", type: 'error' }); }
    setIsSubmitting(false); 
  };

  const handleCashCountChange = (type, denom, value) => setCashCounts(prev => ({ ...prev, [type]: { ...prev[type], [denom]: value } }));
  const calculateCashTotal = useMemo(() => {
    let totalBills = 0, totalCoins = 0;
    Object.keys(cashCounts.bills).forEach(k => totalBills += (parseFloat(cashCounts.bills[k]) || 0) * parseFloat(k)); 
    Object.keys(cashCounts.coins).forEach(k => totalCoins += (parseFloat(cashCounts.coins[k]) || 0) * parseFloat(k));
    return { totalBills, totalCoins, grandTotal: totalBills + totalCoins + (parseFloat(cashCounts.pix) || 0) };
  }, [cashCounts]);

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="bg-gray-50 min-h-screen p-4 pb-20 pl-20 w-full">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 flex items-center gap-2 border-b pb-4"><div className="bg-blue-600 p-2 rounded-lg text-white"><TrendingUp size={20} /></div><h1 className="text-2xl font-bold">Fluxo de Caixa</h1></div>
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {['Lançamentos', 'Semanal', 'Mensal', 'Anual', 'Saldo Caixa'].map(label => (
            <button key={label} onClick={() => setCurrentView(label.toLowerCase().replace(' ', '_'))} className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap ${currentView === label.toLowerCase().replace(' ', '_') ? 'bg-blue-600 text-white' : 'bg-white border'}`}>{label}</button>
          ))}
        </div>

        {currentView === 'entry' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="col-span-1 md:col-span-1"><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Data</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="border p-3 rounded-lg w-full outline-none focus:border-blue-500" /></div>
              <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Pix</label><input type="number" value={pix} onChange={e => setPix(e.target.value)} className="border p-3 rounded-lg w-full text-right outline-none focus:border-blue-500" /></div>
              <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Dinheiro</label><input type="number" value={cash} onChange={e => setCash(e.target.value)} className="border p-3 rounded-lg w-full text-right outline-none focus:border-blue-500" /></div>
              <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Cartão</label><input type="number" value={card} onChange={e => setCard(e.target.value)} className="border p-3 rounded-lg w-full text-right outline-none focus:border-blue-500" /></div>
            </div>
            <button onClick={handleSave} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-95">Salvar Lançamento do Dia</button>
          </div>
        )}

        {currentView === 'saldo_caixa' && (
          <div className="bg-white rounded-xl shadow-sm border p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-slate-50 p-6 rounded-xl border">
              <h3 className="font-bold mb-4 flex items-center gap-2"><Banknote size={20} className="text-emerald-600"/> Cédulas</h3>
              <div className="space-y-3">
                {[200, 100, 50, 20, 10, 5, 2].map(val => (
                  <div key={val} className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-600 w-20">R$ {val},00</span>
                    <input type="number" value={cashCounts.bills[val]} onChange={e => handleCashCountChange('bills', val, e.target.value)} className="border rounded-lg p-2 w-20 text-center font-bold" />
                    <span className="text-sm font-black text-slate-800 w-24 text-right">{formatMoney((parseFloat(cashCounts.bills[val]) || 0) * val)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-slate-50 p-6 rounded-xl border">
              <h3 className="font-bold mb-4 flex items-center gap-2"><Coins size={20} className="text-amber-600"/> Moedas</h3>
              <div className="space-y-3">
                {[1, 0.50, 0.25, 0.10, 0.05].map(val => (
                  <div key={val} className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-600 w-20">R$ {val.toFixed(2)}</span>
                    <input type="number" value={cashCounts.coins[val]} onChange={e => handleCashCountChange('coins', val, e.target.value)} className="border rounded-lg p-2 w-20 text-center font-bold" />
                    <span className="text-sm font-black text-slate-800 w-24 text-right">{formatMoney((parseFloat(cashCounts.coins[val]) || 0) * val)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="col-span-1 md:col-span-2 bg-slate-900 text-white p-6 rounded-2xl flex justify-between items-center shadow-xl">
               <span className="text-lg font-bold">TOTAL EM ESPÉCIE NO CAIXA</span>
               <span className="text-3xl font-black text-emerald-400">{formatMoney(calculateCashTotal.grandTotal)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --------------------------------------------------------------------------------
// SISTEMA POS (CAIXA / GERENTE / CONFIGURAÇÕES)
// --------------------------------------------------------------------------------
const PosView = ({ user, onBack, initialSettings }) => {
  const [view, setView] = useState('pos');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [orderCounter, setOrderCounter] = useState(100);
  const [settings, setSettings] = useState(initialSettings);
  const [toast, setToast] = useState(null);
  const [confirmState, setConfirmState] = useState({ isOpen: false, msg: '', action: null });

  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedTabToSettle, setSelectedTabToSettle] = useState(null);
  const [partialPayments, setPartialPayments] = useState([]);
  const [paymentInputValue, setPaymentInputValue] = useState('');
  
  // Estados para Venda Finalizada
  const [finalizedOrder, setFinalizedOrder] = useState(null);

  const [editingProduct, setEditingProduct] = useState(null);
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdCat, setNewProdCat] = useState('Lanches');

  const [cashMovements, setCashMovements] = useState([]);
  const [showCashMovementModal, setShowCashMovementModal] = useState(false);
  const [movementType, setMovementType] = useState('suprimento');
  const [movementValue, setMovementValue] = useState('');
  const [movementDesc, setMovementDesc] = useState('');

  const [futureOrders, setFutureOrders] = useState([]);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [editingFutureOrder, setEditingFutureOrder] = useState(null); 
  const [orderClient, setOrderClient] = useState('');
  const [orderPhone, setOrderPhone] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [orderTime, setOrderTime] = useState('');
  const [orderObs, setOrderObs] = useState('');
  const [orderTotalValue, setOrderTotalValue] = useState('');
  const [orderSignal, setOrderSignal] = useState('');
  const [orderSignalMethod, setOrderSignalMethod] = useState('Pix');

  const [showSettingsPasswordModal, setShowSettingsPasswordModal] = useState(false);
  const [settingsPasswordInput, setSettingsPasswordInput] = useState('1234');
  const [isSettingsUnlocked, setIsSettingsUnlocked] = useState(false);

  const [actionAuthModal, setActionAuthModal] = useState({ show: false, action: null, order: null });
  const [actionPassword, setActionPassword] = useState('');

  const [configForm, setConfigForm] = useState({
    ...initialSettings,
    docType: initialSettings?.docType || 'CNPJ',
    docId: initialSettings?.docId || initialSettings?.cnpj || ''
  });

  useEffect(() => {
    if (!user) return;
    const unsubProd = onSnapshot(query(getCollectionRef('products')), (snap) => { 
      if (snap.empty) { 
        const batch = writeBatch(db);
        DEFAULT_PRODUCTS_SEED.forEach(p => { batch.set(doc(getCollectionRef('products'), p.id.toString()), p); });
        batch.commit();
      } else {
        const list = snap.docs.map(d => ({ firestoreId: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name)); 
        setProducts(list); 
      } 
    });
    const unsubOrders = onSnapshot(query(getCollectionRef('orders')), (snap) => {
      const list = snap.docs.map(d => ({ firestoreId: d.id, ...d.data() })).sort((a, b) => b.id - a.id); setOrders(list); if (list.length > 0) setOrderCounter(Math.max(...list.map(o => o.id)) + 1);
    });
    const unsubMove = onSnapshot(query(getCollectionRef('cash_movements')), (snapshot) => { setCashMovements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); });
    const unsubFuture = onSnapshot(query(getCollectionRef('future_orders')), (snap) => { setFutureOrders(snap.docs.map(d => ({ firestoreId: d.id, ...d.data() }))); });
    return () => { unsubProd(); unsubOrders(); unsubMove(); unsubFuture(); };
  }, [user]);

  const showToastMsg = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const addToCart = (p) => { 
    if (p.stock <= 0) { showToastMsg("Sem estoque!", "error"); return; } 
    const ex = cart.find(i => i.id === p.id && (!i.subItems || i.subItems.length === 0));
    if (ex) {
      setCart(cart.map(i => i.cartItemId === ex.cartItemId ? { ...i, qty: i.qty + 1 } : i));
    } else {
      setCart([...cart, { ...p, cartItemId: Date.now().toString() + Math.random().toString(), qty: 1, obs: '', subItems: [] }]);
    }
  };

  const getCartTotal = () => cart.reduce((acc, item) => acc + calcItemTotal(item), 0);

  const finalizeOrder = async (client = 'Balcão', status = 'PAGO') => {
    if (!user) return;
    const totalOrder = selectedTabToSettle ? selectedTabToSettle.total : getCartTotal();
    const paidTotal = partialPayments.reduce((acc, p) => acc + p.value, 0);
    if (status === 'PAGO' && paidTotal < totalOrder - 0.01) { showToastMsg("Pagamento insuficiente.", "error"); return; }

    const nowISO = new Date().toISOString();
    const methodString = partialPayments.length > 0 ? partialPayments.map(p => p.method).join(' + ') : 'Dinheiro';
    
    // Calcular troco para o objeto de impressão
    const cashPay = partialPayments.find(p => p.method === 'Dinheiro');
    const received = cashPay ? cashPay.value : totalOrder;
    const change = Math.max(0, received - totalOrder);

    const orderData = { 
      id: orderCounter, 
      items: selectedTabToSettle ? selectedTabToSettle.items : cart, 
      total: totalOrder, 
      status: 'Pago', 
      paymentStatus: 'PAGO', 
      method: methodString, 
      client, 
      date: nowISO, 
      receivedValue: cashPay ? received : null,
      changeValue: change > 0 ? change : null
    };

    try {
      if (selectedTabToSettle) {
        await updateDoc(getDocRef('orders', selectedTabToSettle.firestoreId), { paymentStatus: 'PAGO', method: methodString, payments: partialPayments, paidAt: nowISO });
      } else {
        await addDoc(getCollectionRef('orders'), { ...orderData, origin: 'Caixa', kitchenStatus: 'Pendente', time: new Date().toLocaleTimeString().slice(0, 5) });
        // Dedução de estoque
        const batch = writeBatch(db);
        const deductions = getStockDeductions(cart);
        Object.entries(deductions).forEach(([pid, qty]) => {
          const prod = products.find(p => p.id === parseInt(pid));
          if (prod?.firestoreId) batch.update(getDocRef('products', prod.firestoreId), { stock: prod.stock - qty });
        });
        await batch.commit();
      }
      setFinalizedOrder(orderData);
      setCart([]);
      setShowPaymentModal(false);
      showToastMsg("Venda finalizada!");
    } catch (e) { showToastMsg("Erro ao salvar.", "error"); }
  };

  const saveSettings = async () => {
    try { 
      const cleanData = Object.fromEntries(Object.entries(configForm).filter(([_, v]) => v !== undefined));
      await setDoc(getDocRef('app_state', 'settings'), cleanData, { merge: true }); 
      setSettings(cleanData);
      showToastMsg("Salvo!"); 
    } catch (e) { showToastMsg("Erro ao salvar.", "error"); }
  };

  const addNewProduct = async () => { 
    if (!newProdName || !newProdPrice) return; 
    try { 
      const p = parseFloat(newProdPrice.toString().replace(',', '.'));
      await addDoc(getCollectionRef('products'), { id: Date.now(), name: newProdName, price: p, category: newProdCat, stock: 50, icon: 'burger' }); 
      setNewProdName(''); setNewProdPrice(''); 
      showToastMsg("Adicionado!"); 
    } catch(e) { showToastMsg("Erro.", "error"); }
  };

  const modalTotal = selectedTabToSettle ? selectedTabToSettle.total : getCartTotal();
  const modalPaid = partialPayments.reduce((acc, p) => acc + p.value, 0);
  const modalRemaining = Math.max(0, modalTotal - modalPaid);
  
  // Cálculo de troco em tempo real no modal
  const liveChange = useMemo(() => {
    if (!paymentInputValue) return 0;
    const val = parseFloat(paymentInputValue.replace(',', '.'));
    return Math.max(0, val - modalRemaining);
  }, [paymentInputValue, modalRemaining]);

  return (
    <div className="font-sans bg-slate-100 min-h-screen text-slate-900 flex">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* SIDEBAR */}
      <div className="w-16 bg-slate-900 text-white flex flex-col items-center py-6 fixed h-full left-0 z-10 shadow-2xl">
        <div onClick={onBack} className="p-2 bg-amber-500 rounded-lg mb-6 cursor-pointer hover:bg-amber-400 transition-colors"><Store size={20} className="text-slate-900" /></div>
        <div className="flex flex-col items-center gap-4">
          <button onClick={() => setView('pos')} className={`p-2 rounded-xl ${view === 'pos' ? 'bg-blue-600' : 'text-slate-400 hover:text-white'}`}><ShoppingCart size={20} /></button>
          <button onClick={() => setView('tabs')} className={`p-2 rounded-xl ${view === 'tabs' ? 'bg-indigo-600' : 'text-slate-400 hover:text-white'}`}><ClipboardList size={20} /></button>
          <button onClick={() => setView('kitchen')} className={`p-2 rounded-xl ${view === 'kitchen' ? 'bg-orange-600' : 'text-slate-400 hover:text-white'}`}><ChefHat size={20} /></button>
          <button onClick={() => setView('cash')} className={`p-2 rounded-xl ${view === 'cash' ? 'bg-emerald-600' : 'text-slate-400 hover:text-white'}`}><Coins size={20} /></button>
          <button onClick={() => setView('admin')} className={`p-2 rounded-xl ${view === 'admin' ? 'bg-purple-600' : 'text-slate-400 hover:text-white'}`}><LayoutDashboard size={20} /></button>
          <button onClick={() => setView('settings')} className={`p-2 rounded-xl ${view === 'settings' ? 'bg-gray-600' : 'text-slate-400 hover:text-white'}`}><Settings size={20} /></button>
        </div>
      </div>

      <div className="flex-1 pl-16">
        {view === 'pos' && (
          <div className="flex h-screen">
            <div className="flex-1 p-6 overflow-y-auto bg-slate-50">
              <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">Novo Pedido</h1>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {products.map(p => (
                  <button key={p.id} onClick={() => addToCart(p)} className="bg-white p-4 rounded-xl border hover:border-blue-500 shadow-sm transition-all flex flex-col text-left">
                    <div className="flex justify-between items-center mb-2">
                      <IconMapper type={p.icon} className="text-blue-500"/>
                      <span className="font-bold text-sm">{formatMoney(p.price)}</span>
                    </div>
                    <span className="font-bold text-slate-800 truncate">{p.name}</span>
                    <span className="text-xs text-slate-400">{p.stock} un</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="w-80 bg-white border-l flex flex-col shadow-xl">
              <div className="p-4 border-b font-bold bg-slate-50">Carrinho</div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {cart.map(i => (
                  <div key={i.cartItemId} className="p-2 border rounded-lg text-sm bg-slate-50">
                    <div className="flex justify-between font-bold"><span>{i.qty}x {i.name}</span><span>{formatMoney(calcItemTotal(i))}</span></div>
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => setCart(cart.filter(x => x.cartItemId !== i.cartItemId))} className="text-red-500"><Trash2 size={14}/></button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t bg-slate-50 space-y-3">
                <div className="flex justify-between font-black text-xl"><span>Total</span><span>{formatMoney(getCartTotal())}</span></div>
                <button onClick={() => { setPartialPayments([]); setPaymentInputValue(''); setShowPaymentModal(true); }} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold">RECEBER PAGAMENTO</button>
              </div>
            </div>
          </div>
        )}

        {view === 'kitchen' && (
          <div className="p-8">
            <h1 className="text-3xl font-black mb-8 flex items-center gap-3"><ChefHat className="text-orange-500"/> Cozinha</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {orders.filter(o => o.kitchenStatus === 'Pendente').map(o => (
                <div key={o.firestoreId} className="bg-white p-5 rounded-2xl shadow-sm border-l-8 border-orange-500">
                  <div className="flex justify-between items-start mb-4">
                    <div className="font-black text-lg">{o.client}</div>
                    <div className="bg-slate-100 p-2 rounded-lg"><Clock size={16} className="text-slate-500"/></div>
                  </div>
                  <div className="space-y-2 mb-6">
                    {o.items?.map((item, idx) => (
                      <div key={idx} className="text-sm font-bold bg-slate-50 p-2 rounded border">
                        {item.qty}x {item.name}
                        {item.obs && <div className="text-red-500 text-xs italic">Obs: {item.obs}</div>}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handlePrint(o, settings, 'kitchen')} className="flex-1 border p-3 rounded-xl hover:bg-slate-50 flex items-center justify-center gap-2"><Printer size={18}/> Ticket</button>
                    <button onClick={() => updateDoc(getDocRef('orders', o.firestoreId), { kitchenStatus: 'Pronto' })} className="flex-1 bg-orange-500 text-white p-3 rounded-xl font-bold">Pronto</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'settings' && (
          <div className="p-8 max-w-2xl">
            <h1 className="text-3xl font-black mb-8 flex items-center gap-2"><Settings/> Configurações</h1>
            <div className="bg-white p-6 rounded-2xl shadow-sm space-y-4">
              <div><label className="text-xs font-bold text-slate-500 uppercase">Nome da Loja</label><input value={configForm.storeName} onChange={e => setConfigForm({...configForm, storeName: e.target.value})} className="w-full border p-3 rounded-xl" /></div>
              <div><label className="text-xs font-bold text-slate-500 uppercase">Endereço Completo</label><input value={configForm.address} onChange={e => setConfigForm({...configForm, address: e.target.value})} className="w-full border p-3 rounded-xl" /></div>
              <div><label className="text-xs font-bold text-slate-500 uppercase">Telefone</label><input value={configForm.phone} onChange={e => setConfigForm({...configForm, phone: e.target.value})} className="w-full border p-3 rounded-xl" /></div>
              <button onClick={saveSettings} className="w-full bg-green-600 text-white py-4 rounded-xl font-bold">Salvar Dados</button>
            </div>
          </div>
        )}
        
        {view === 'cash' && <CashControl user={user} orders={orders} />}
      </div>

      {/* MODAL PAGAMENTO COM TROCO */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-xl">Finalizar Venda</h3>
              <button onClick={() => setShowPaymentModal(false)}><X/></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="bg-slate-100 p-5 rounded-2xl flex justify-between items-center">
                <span className="font-bold text-slate-500 uppercase">Total a Receber</span>
                <span className="text-3xl font-black text-blue-600">{formatMoney(modalTotal)}</span>
              </div>
              
              <div className="space-y-4">
                <label className="text-xs font-bold text-slate-500 uppercase">Valor Recebido (Dinheiro)</label>
                <div className="relative">
                  <span className="absolute left-4 top-3.5 text-slate-400 font-bold">R$</span>
                  <input type="number" step="0.01" value={paymentInputValue} onChange={e => setPaymentInputValue(e.target.value)} className="w-full pl-12 p-4 border rounded-2xl text-xl font-black outline-none focus:ring-4 focus:ring-blue-100" placeholder="0,00" />
                </div>
                
                {liveChange > 0 && (
                  <div className="bg-emerald-50 p-4 rounded-2xl border-2 border-emerald-200 animate-in slide-in-from-top-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-emerald-700">TROCO PARA O CLIENTE:</span>
                      <span className="text-2xl font-black text-emerald-800">{formatMoney(liveChange)}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {['Dinheiro', 'Pix', 'Crédito', 'Débito'].map(m => (
                  <button key={m} onClick={() => {
                    const received = paymentInputValue ? parseFloat(paymentInputValue.replace(',', '.')) : modalTotal;
                    setPartialPayments([{ method: m, value: modalTotal, receivedValue: received, changeValue: liveChange }]);
                    finalizeOrder(customerName || 'Balcão', 'PAGO');
                  }} className="py-4 border rounded-xl font-bold hover:bg-slate-50 transition-colors">{m}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SUCESSO E IMPRESSÃO DE RECIBO */}
      {finalizedOrder && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm text-center animate-in zoom-in-95">
            <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={48} className="text-green-600"/>
            </div>
            <h2 className="text-2xl font-black mb-2">Venda Finalizada!</h2>
            <p className="text-slate-500 mb-8 font-medium">O que deseja fazer agora?</p>
            
            <div className="space-y-3">
              <button onClick={() => handlePrint(finalizedOrder, settings, 'customer')} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg"><Printer size={20}/> Imprimir Recibo</button>
              <button onClick={() => setFinalizedOrder(null)} className="w-full bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold">Voltar ao Início</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --------------------------------------------------------------------------------
// COMPONENTE PRINCIPAL (ENTRY POINT)
// --------------------------------------------------------------------------------
export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [initialRole, setInitialRole] = useState('');
  const [settings, setSettings] = useState({
    storeName: "CAFÉ DA PRAÇA",
    phone: "(85) 9 9675-2621",
    address: "Av. Contorno Norte, 1050-A, Conjunto Esperança"
  });
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const [showAdminAuth, setShowAdminAuth] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminError, setAdminError] = useState('');

  const handleAdminLogin = () => {
    const currentPass = settings?.posPassword || '1234';
    if (adminPasswordInput === currentPass) {
      setInitialRole('Gerência');
      setRole('pos');
      setShowAdminAuth(false);
    } else { setAdminError('Senha incorreta.'); }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else { await signInAnonymously(auth); }
      } catch (e) {
        console.error(e);
        setAuthError(e.code === 'auth/operation-not-allowed' ? 'Login Anônimo desativado no Firebase.' : e.message);
        setIsLoading(false);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsLoading(false);
    }, (error) => { setAuthError(error.message); setIsLoading(false); });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubSettings = onSnapshot(getDocRef('app_state', 'settings'), (snap) => {
      if (snap.exists()) setSettings(snap.data());
    });
    return () => unsubSettings();
  }, [user]);

  if (isLoading) return <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-900 text-white gap-4"><Loader2 className="animate-spin text-blue-500" size={48} /><p>Carregando...</p></div>;

  if (!role) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-100 p-4 relative">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-2xl border border-slate-200">
          <div className="flex justify-center mb-4">
            <img src="/logo.jpg" alt="Logo" className="h-32 w-32 object-contain rounded-full shadow-lg border-4 border-amber-50" onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/150x150/fdf8f6/b45309?text=Café&font=montserrat'; }} />
          </div>
          <h1 className="text-3xl font-black text-center text-slate-800 mb-1 tracking-tight uppercase">{settings.storeName}</h1>
          <div className="flex items-center justify-center gap-1.5 text-amber-600 mb-6 font-bold"><Phone size={16} /><span>{settings.phone}</span></div>
          <p className="text-center text-slate-500 mb-6 font-medium">Selecione o seu perfil de acesso</p>
          {authError && <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6 text-xs text-center"><AlertTriangle className="mx-auto mb-2" size={20} />Conexão Firebase Recusada:<br/>{authError}</div>}
          <div className="space-y-4">
            <button onClick={() => { setInitialRole('Garçom / Cliente'); setRole('mobile'); }} className="w-full flex items-center p-5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-2xl transition-all group"><div className="bg-indigo-500 text-white p-3 rounded-xl mr-4"><MonitorSmartphone size={24} /></div><div className="text-left flex-1 font-bold text-indigo-900 text-lg">App Mobile</div><ChevronRight className="text-indigo-400" /></button>
            <button onClick={() => setShowAdminAuth(true)} className="w-full flex items-center p-5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl shadow-lg group"><div className="bg-blue-500 text-white p-3 rounded-xl mr-4"><LayoutDashboard size={24} /></div><div className="text-left flex-1 font-bold text-lg">Painel Administrativo</div><ChevronRight className="text-slate-500" /></button>
          </div>
        </div>
        {showAdminAuth && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 border-t-4 border-blue-600">
              <div className="flex justify-center mb-4"><div className="bg-blue-50 p-4 rounded-full text-blue-600"><Lock size={40} /></div></div>
              <h3 className="text-xl font-black text-slate-800 mb-2 text-center">Acesso Gerencial</h3>
              <p className="text-sm text-slate-500 mb-6 text-center">Digite a Senha Caixa para acessar o painel.</p>
              <input type="password" autoFocus placeholder="Senha de Acesso" className="w-full border-2 p-4 rounded-xl text-center text-xl font-bold outline-none focus:border-blue-500 transition-all mb-2" value={adminPasswordInput} onChange={(e) => { setAdminPasswordInput(e.target.value); setAdminError(''); }} onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()} />
              {adminError && <p className="text-red-500 text-sm font-bold text-center">{adminError}</p>}
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowAdminAuth(false)} className="flex-1 py-3.5 text-slate-500 bg-slate-100 font-bold rounded-xl">Cancelar</button>
                <button onClick={handleAdminLogin} className="flex-1 bg-blue-600 text-white py-3.5 rounded-xl font-bold">Acessar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {role === 'mobile' && <MobileView user={user} initialRole={initialRole} onBack={() => setRole(null)} />}
      {role === 'pos' && <PosView user={user} initialRole={initialRole} onBack={() => setRole(null)} initialSettings={settings} />}
    </>
  );
}
