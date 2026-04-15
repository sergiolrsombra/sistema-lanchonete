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
  CheckSquare, Printer, Settings, MessageCircle, AlertOctagon, Sparkles, Maximize
} from 'lucide-react';
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from "firebase/auth";
import { getFirestore, collection, addDoc, onSnapshot, query, doc, updateDoc, deleteDoc, setDoc, getDoc, getDocs, Timestamp, writeBatch } from "firebase/firestore";

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
  { id: 2, name: 'Tapioca', price: 4.00, category: 'Tapiocas', stock: 50, icon: 'burger' },
  { id: 3, name: 'Cuscuz', price: 4.00, category: 'Cuscuz', stock: 50, icon: 'burger' },
  { id: 8, name: 'Pão na Chapa', price: 3.50, category: 'Pão', stock: 50, icon: 'burger' },
  { id: 4, name: 'Carne Desfiada 80g', price: 5.00, category: 'Adicionais', stock: 30, icon: 'fries' },
  { id: 5, name: 'Frango Desfiado 80g', price: 5.00, category: 'Adicionais', stock: 30, icon: 'fries' },
  { id: 6, name: 'Queijo Fatia', price: 3.00, category: 'Adicionais', stock: 50, icon: 'fries' },
  { id: 7, name: 'Ovo 1 un', price: 3.00, category: 'Adicionais', stock: 50, icon: 'fries' },
];

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
    const d = new Date(dateStr.split('T')[0] + 'T12:00:00');
    const start = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil((((d.getTime() - start.getTime()) / 86400000) + start.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
  } catch (e) { return 'erro-data'; }
};

const calcItemTotal = (item) => {
  const subTotal = (item.subItems || []).reduce((acc, sub) => acc + (Number(sub.price) * Number(sub.qty)), 0);
  return (Number(item.price) + subTotal) * Number(item.qty);
};

const getStockDeductions = (cartArray) => {
  const deductions = {};
  cartArray.forEach(item => {
    deductions[item.id] = (deductions[item.id] || 0) + Number(item.qty);
    item.subItems?.forEach(sub => {
      deductions[sub.id] = (deductions[sub.id] || 0) + (Number(sub.qty) * Number(item.qty));
    });
  });
  return deductions;
};

const handlePrint = (order, settings, type = 'customer') => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const storeName = settings?.storeName || "CAFÉ DA PRAÇA";
  const storePhone = settings?.phone || "(85) 9 9675-2621";
  const storeAddress = settings?.address || "Av. Contorno Norte, 1050-A, Conjunto Esperança";
  
  let itemsHtml = '';
  
  // Agrupar itens por Pessoa
  const groupedItems = {};
  order.items?.forEach(i => {
    const guest = i.guest || 'Pessoa 1';
    if (!groupedItems[guest]) groupedItems[guest] = [];
    groupedItems[guest].push(i);
  });

  const guests = Object.keys(groupedItems);
  const multipleGuests = guests.length > 1;

  guests.forEach(guest => {
    if (multipleGuests || guest !== 'Pessoa 1') {
      itemsHtml += `<div style="margin-top: 10px; border-bottom: 1px dashed #ccc; font-weight: bold; font-size: 0.95em; padding-bottom: 2px;">👤 ${guest}</div>`;
    }
    
    groupedItems[guest].forEach(i => {
      itemsHtml += `
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px; margin-top: 4px;">
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
          .total { font-size: 1.2em; border-top: 1px solid #000; margin-top: 10px; padding-top: 5px; }
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
          <p style="margin: 2px 0;">Data/Hora: ${new Date(order.paidAt || order.date).toLocaleString('pt-BR')}</p>
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

const maskCpf = (value) => {
  if (!value) return "";
  return value
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .replace(/(-\d{2})\d+?$/, '$1');
};

const maskCnpj = (value) => {
  if (!value) return "";
  return value
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
    .replace(/(-\d{2})\d+?$/, '$1');
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

const ConfirmDialog = ({ isOpen, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white p-6 rounded-2xl max-w-sm w-full shadow-2xl animate-in zoom-in-95">
        <div className="flex justify-center text-red-500 mb-4"><AlertTriangle size={48} /></div>
        <h3 className="font-bold text-lg mb-6 text-center text-slate-800">{message}</h3>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors">Cancelar</button>
          <button onClick={onConfirm} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-colors shadow-lg shadow-red-500/20">Confirmar</button>
        </div>
      </div>
    </div>
  );
};

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
        if (docSnap.exists()) {
          const data = docSnap.data();
          setCashCounts({
            bills: data.bills || { 200: '', 100: '', 50: '', 20: '', 10: '', 5: '', 2: '' },
            coins: data.coins || { 1: '', 0.50: '', 0.25: '', 0.10: '', 0.05: '' },
            pix: data.pix || ''
          });
        }
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

  const importFromPos = () => { 
    if (posTotals.total === 0) { 
      setToast({ msg: "Nenhuma venda encontrada nesta data.", type: 'error' }); 
      return; 
    } 
    setPix(posTotals.pix.toFixed(2)); 
    setCash(posTotals.cash.toFixed(2)); 
    setCard(posTotals.card.toFixed(2)); 
    setToast({ msg: "Valores importados do Caixa!", type: 'success' }); 
  };

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

  const handleCashCountChange = (type, denom, value) => {
    setCashCounts(prev => ({ 
      ...prev, 
      [type]: { ...(prev[type] || {}), [denom]: value } 
    }));
  };
  
  const calculateCashTotal = useMemo(() => {
    let totalBills = 0, totalCoins = 0;
    if (cashCounts?.bills) {
      Object.keys(cashCounts.bills).forEach(k => totalBills += (parseFloat(cashCounts.bills[k]) || 0) * parseFloat(k)); 
    }
    if (cashCounts?.coins) {
      Object.keys(cashCounts.coins).forEach(k => totalCoins += (parseFloat(cashCounts.coins[k]) || 0) * parseFloat(k));
    }
    return { totalBills, totalCoins, grandTotal: totalBills + totalCoins + (parseFloat(cashCounts?.pix) || 0) };
  }, [cashCounts]);

  const handleCalcKeyDown = (e, currentId) => {
    const calculatorOrder = ['bill-200', 'bill-100', 'bill-50', 'bill-20', 'bill-10', 'bill-5', 'bill-2', 'coin-1', 'coin-0.5', 'coin-0.25', 'coin-0.1', 'coin-0.05', 'pix-val'];
    if (e.key === 'Enter') {
      e.preventDefault(); 
      const currentIndex = calculatorOrder.indexOf(currentId); 
      if (currentIndex !== -1 && currentIndex < calculatorOrder.length - 1) {
        cashCalculatorRefs.current[calculatorOrder[currentIndex + 1]]?.focus();
      } else { 
        e.target.blur(); 
      }
    }
  };

  const toggleWeekClose = async (id, isClosed) => { 
    try {
      if (isClosed) {
        await deleteDoc(getDocRef('closed_weeks', id)); 
      } else {
        await setDoc(getDocRef('closed_weeks', id), { at: Date.now() }); 
      }
    } catch(e) { console.error(e); }
  };
  
  const weeks = useMemo(() => {
    const groups = {}; 
    records.forEach(rec => {
      const w = getWeekId(rec.date); 
      if (!groups[w]) {
        groups[w] = { id: w, records: [], total: 0, totalPix: 0, totalCash: 0, totalCard: 0, startDate: rec.date, endDate: rec.date }; 
      }
      groups[w].records.push(rec); 
      groups[w].total += (Number(rec.total) || 0); 
      groups[w].totalPix += (Number(rec.pix) || 0); 
      groups[w].totalCash += (Number(rec.cash) || 0); 
      groups[w].totalCard += (Number(rec.card) || 0); 
      if (rec.date < groups[w].startDate) groups[w].startDate = rec.date; 
      if (rec.date > groups[w].endDate) groups[w].endDate = rec.date;
    }); 
    return Object.values(groups).sort((a, b) => b.id.localeCompare(a.id));
  }, [records]);

  const months = useMemo(() => {
    const groups = {};
    records.forEach(rec => {
      if(!rec.date) return;
      const m = String(rec.date).substring(0, 7); 
      if (!groups[m]) {
        groups[m] = { id: m, total: 0, totalPix: 0, totalCash: 0, totalCard: 0 };
      }
      groups[m].total += (Number(rec.total) || 0);
      groups[m].totalPix += (Number(rec.pix) || 0);
      groups[m].totalCash += (Number(rec.cash) || 0);
      groups[m].totalCard += (Number(rec.card) || 0);
    });
    return Object.values(groups).sort((a, b) => b.id.localeCompare(a.id));
  }, [records]);

  const years = useMemo(() => {
    const groups = {};
    records.forEach(rec => {
      if(!rec.date) return;
      const y = String(rec.date).substring(0, 4); 
      if (!groups[y]) {
        groups[y] = { id: y, total: 0, totalPix: 0, totalCash: 0, totalCard: 0 };
      }
      groups[y].total += (Number(rec.total) || 0);
      groups[y].totalPix += (Number(rec.pix) || 0);
      groups[y].totalCash += (Number(rec.cash) || 0);
      groups[y].totalCard += (Number(rec.card) || 0);
    });
    return Object.values(groups).sort((a, b) => b.id.localeCompare(a.id));
  }, [records]);

  const currentEntryWeek = useMemo(() => weeks.find(w => w.id === getWeekId(date)), [weeks, date]);

  const deleteRecord = (rId) => {
    setConfirmState({
      isOpen: true, 
      msg: 'Excluir?', 
      action: async () => { 
        await deleteDoc(getDocRef('records_v2', rId)); 
        setConfirmState({isOpen:false,msg:'',action:null}); 
        setToast({msg:'Excluído',type:'success'});
      }
    });
  };

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="bg-gray-50 min-h-screen p-4 pb-20 w-full animate-in fade-in">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmDialog isOpen={confirmState.isOpen} message={confirmState.msg} onConfirm={confirmState.action} onCancel={() => setConfirmState({ isOpen: false, msg: '', action: null })} />
      
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 flex items-center gap-2 border-b pb-4">
          <div className="bg-blue-600 p-2 rounded-lg text-white"><TrendingUp size={20} /></div>
          <h1 className="text-2xl font-bold">Fluxo de Caixa</h1>
        </div>
        
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { id: 'entry', label: 'Lançamentos' },
            { id: 'semanal', label: 'Semanal' },
            { id: 'mensal', label: 'Mensal' },
            { id: 'anual', label: 'Anual' },
            { id: 'saldo_caixa', label: 'Saldo Caixa' }
          ].map(tab => (
            <button 
              key={tab.id} 
              onClick={() => setCurrentView(tab.id)} 
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap ${currentView === tab.id ? 'bg-blue-600 text-white shadow-md' : 'bg-white border text-slate-600 hover:bg-slate-50'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {currentView === 'entry' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border space-y-6">
            <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex gap-4 items-center">
                <div className="bg-indigo-100 p-3 rounded-xl text-indigo-600">
                  <ShoppingCart size={24} />
                </div>
                <div>
                  <div className="text-sm font-bold text-indigo-900 mb-1">Vendas no Sistema (POS) - {formatDate(date)}</div>
                  <div className="text-xs font-medium text-indigo-700 flex flex-wrap gap-3">
                    <span>Pix: <b className="font-black">{formatMoney(posTotals.pix)}</b></span>
                    <span>Dinheiro: <b className="font-black">{formatMoney(posTotals.cash)}</b></span>
                    <span>Cartão: <b className="font-black">{formatMoney(posTotals.card)}</b></span>
                  </div>
                </div>
              </div>
              <button onClick={importFromPos} className="w-full md:w-auto bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors shadow-sm active:scale-95 whitespace-nowrap">
                Importar Valores
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-100" /></div>
              <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Pix</label><input type="number" value={pix} onChange={e => setPix(e.target.value)} className="w-full border p-3 rounded-xl text-right outline-none focus:ring-2 focus:ring-blue-100" /></div>
              <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Dinheiro</label><input type="number" value={cash} onChange={e => setCash(e.target.value)} className="w-full border p-3 rounded-xl text-right outline-none focus:ring-2 focus:ring-blue-100" /></div>
              <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cartão</label><input type="number" value={card} onChange={e => setCard(e.target.value)} className="w-full border p-3 rounded-xl text-right outline-none focus:ring-2 focus:ring-blue-100" /></div>
            </div>
            <button onClick={handleSave} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-95">Salvar Lançamento do Dia</button>
            
            {currentEntryWeek && (
              <div className="bg-white rounded-xl shadow-sm border overflow-hidden mt-6">
                <div className="bg-blue-50 p-4 border-b flex justify-between items-center">
                  <span className="font-bold text-sm text-blue-900">Semana Atual</span>
                  <div className="flex gap-2 items-center">
                    <span className="text-xs bg-blue-100 text-blue-800 px-3 py-1.5 rounded-full font-bold">Total: {formatMoney(currentEntryWeek.total)}</span>
                    <button onClick={() => toggleWeekClose(currentEntryWeek.id, closedWeeks.includes(currentEntryWeek.id))} className="bg-white p-1.5 rounded-full hover:bg-blue-200 transition-colors">
                      {closedWeeks.includes(currentEntryWeek.id) ? <Lock size={14} className="text-slate-600" /> : <Unlock size={14} className="text-slate-600" />}
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500 uppercase"><tr className="border-b border-slate-200"><th className="p-3 text-left">Data</th><th className="p-3 text-right">Pix</th><th className="p-3 text-right">Dinheiro</th><th className="p-3 text-right">Cartão</th><th className="p-3 text-right">Total</th><th></th></tr></thead>
                    <tbody>
                      {currentEntryWeek.records.map(r => (
                        <tr key={r.id} className="border-b last:border-none hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-medium">{formatDate(r.date)}</td>
                          <td className="p-3 text-right text-slate-600">{formatMoney(r.pix)}</td>
                          <td className="p-3 text-right text-slate-600">{formatMoney(r.cash)}</td>
                          <td className="p-3 text-right text-slate-600">{formatMoney(r.card)}</td>
                          <td className="p-3 text-right font-bold text-blue-700">{formatMoney(r.total)}</td>
                          <td className="p-3 text-center">
                            <button onClick={() => deleteRecord(r.id)} className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 hover:text-red-700 transition-colors"><Trash2 size={16} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {currentView === 'saldo_caixa' && (
          <div className="bg-white rounded-xl shadow-sm border p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
              <h3 className="font-bold mb-5 flex items-center gap-2 text-slate-800"><Banknote size={24} className="text-emerald-600"/> Cédulas</h3>
              <div className="space-y-4">
                {[200, 100, 50, 20, 10, 5, 2].map(val => (
                  <div key={val} className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-600 w-20">R$ {val},00</span>
                    <input type="number" ref={el => cashCalculatorRefs.current[`bill-${val}`] = el} onKeyDown={e => handleCalcKeyDown(e, `bill-${val}`)} value={cashCounts?.bills?.[val] || ''} onChange={e => handleCashCountChange('bills', val, e.target.value)} className="border border-slate-300 rounded-xl p-2.5 w-24 text-center font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                    <span className="text-sm font-black text-slate-800 w-24 text-right">{formatMoney((parseFloat(cashCounts?.bills?.[val]) || 0) * val)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
              <h3 className="font-bold mb-5 flex items-center gap-2 text-slate-800"><Coins size={24} className="text-amber-600"/> Moedas e Digital</h3>
              <div className="space-y-4">
                {[1, 0.50, 0.25, 0.10, 0.05].map(val => (
                  <div key={val} className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-600 w-20">R$ {val.toFixed(2)}</span>
                    <input type="number" ref={el => cashCalculatorRefs.current[`coin-${val}`] = el} onKeyDown={e => handleCalcKeyDown(e, `coin-${val}`)} value={cashCounts?.coins?.[val] || ''} onChange={e => handleCashCountChange('coins', val, e.target.value)} className="border border-slate-300 rounded-xl p-2.5 w-24 text-center font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                    <span className="text-sm font-black text-slate-800 w-24 text-right">{formatMoney((parseFloat(cashCounts?.coins?.[val]) || 0) * val)}</span>
                  </div>
                ))}
                <div className="mt-6 pt-6 border-t border-slate-200 flex justify-between items-center">
                  <span className="font-black text-green-700">Saldo Banco (Pix)</span>
                  <input type="number" step="0.01" ref={el => cashCalculatorRefs.current['pix-val'] = el} onKeyDown={e => handleCalcKeyDown(e, 'pix-val')} value={cashCounts?.pix || ''} onChange={e => setCashCounts(prev => ({ ...prev, pix: e.target.value }))} className="border border-green-300 p-3 rounded-xl w-32 text-right bg-green-50 font-black outline-none focus:border-green-600 focus:ring-2 focus:ring-green-200 text-green-800" placeholder="0.00"/>
                </div>
              </div>
            </div>
            <div className="col-span-1 md:col-span-2 bg-slate-900 text-white p-8 rounded-3xl flex flex-col md:flex-row justify-between items-center shadow-xl gap-4">
               <span className="text-xl font-bold uppercase tracking-wider text-slate-300">Total Geral Apurado no Caixa</span>
               <span className="text-5xl font-black text-emerald-400">{formatMoney(calculateCashTotal.grandTotal)}</span>
            </div>
          </div>
        )}
        
        {['semanal', 'mensal', 'anual'].includes(currentView) && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(currentView === 'semanal' ? weeks : currentView === 'mensal' ? months : years).map(i => (
              <div key={i.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between font-bold mb-4 text-slate-800 border-b pb-3">
                  <span className="flex items-center gap-2"><Calendar size={18} className="text-blue-500"/> {currentView === 'semanal' ? `Semana ${i.id.split('-W')[1]}` : currentView === 'anual' ? `ANO ${i.id}` : new Date(i.id+'-02').toLocaleDateString('pt-BR',{month:'long',year:'numeric'}).toUpperCase()}</span>
                  <span className="text-blue-700 text-lg">{formatMoney(i.total)}</span>
                </div>
                <div className="space-y-2 text-sm font-medium">
                  <div className="flex justify-between bg-green-50/50 p-2 rounded-lg"><span className="text-green-700">Pix</span><span className="font-bold text-green-800">{formatMoney(i.totalPix)}</span></div>
                  <div className="flex justify-between bg-blue-50/50 p-2 rounded-lg"><span className="text-blue-700">Dinheiro</span><span className="font-bold text-blue-800">{formatMoney(i.totalCash)}</span></div>
                  <div className="flex justify-between bg-purple-50/50 p-2 rounded-lg"><span className="text-purple-700">Cartão</span><span className="font-bold text-purple-800">{formatMoney(i.totalCard)}</span></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// --------------------------------------------------------------------------------
// SISTEMA MOBILE (CLIENTE / GARÇOM)
// --------------------------------------------------------------------------------
const MobileView = ({ user, initialRole, onBack, settings }) => {
  const [view, setView] = useState('login');
  
  // Dados do Cliente
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderType, setOrderType] = useState('Consumo no Local');

  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderCounter, setOrderCounter] = useState(1000);
  const [toast, setToast] = useState(null);

  const [showAiModal, setShowAiModal] = useState(false);
  const [aiResponse, setAiResponse] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsubProd = onSnapshot(query(getCollectionRef('products')), (snap) => {
      if (snap.empty) {
        const batch = writeBatch(db);
        DEFAULT_PRODUCTS_SEED.forEach(p => { batch.set(doc(getCollectionRef('products'), p.id.toString()), p); });
        batch.commit().catch(e => console.error("Erro ao popular BD:", e));
      } else {
        const list = snap.docs.map(d => ({ firestoreId: d.id, ...d.data() })).sort((a, b) => a.id - b.id);
        setProducts(list);
        const fetchedCategories = [...new Set(list.map(p => p.category).filter(Boolean))];
        setCategories(fetchedCategories);
        setSelectedCategory(prev => fetchedCategories.includes(prev) ? prev : (fetchedCategories[0] || ''));
      }
    });
    const unsubOrders = onSnapshot(query(getCollectionRef('orders')), (snap) => {
      const list = snap.docs.map(d => d.data());
      if (list.length > 0) {
        const maxId = Math.max(0, ...list.map(o => Number(o.id) || 0));
        setOrderCounter(maxId + 1);
      }
    });
    return () => { unsubProd(); unsubOrders(); };
  }, [user]);

  const showToastMsg = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (!customerName) {
      showToastMsg("Por favor, digite seu nome.", "error");
      return;
    }
    setView('menu');
  };
  
  const addToCart = (p) => {
    if (p.stock <= 0) { showToastMsg("Sem estoque!", "error"); return; }

    const baseCategories = ['Tapiocas', 'Cuscuz', 'Pão', 'Lanches', 'Salgados e Caldos'];
    const addonCategories = ['Adicionais'];

    // --- LÓGICA DE UNIÃO AUTOMÁTICA ---
    if (addonCategories.includes(p.category)) {
      const reversedCart = [...cart].reverse();
      const parentIdxInReversed = reversedCart.findIndex(i => baseCategories.includes(i.category));
      
      if (parentIdxInReversed !== -1) {
        const actualIdx = cart.length - 1 - parentIdxInReversed;
        const parentItem = cart[actualIdx];
        
        let newSubItems = [...(parentItem.subItems || [])];
        const existingSub = newSubItems.find(s => String(s.id) === String(p.id) || (s.firestoreId && s.firestoreId === p.firestoreId));
        
        if (existingSub) {
          newSubItems = newSubItems.map(s => (String(s.id) === String(p.id) || (s.firestoreId && s.firestoreId === p.firestoreId)) ? { ...s, qty: s.qty + 1 } : s);
        } else {
          newSubItems.push({ ...p, qty: 1 });
        }
        
        const newCart = [...cart];
        newCart[actualIdx] = { ...parentItem, subItems: newSubItems };
        setCart(newCart);
        showToastMsg(`${p.name} unido a ${parentItem.name}!`);
        return;
      }
    } else if (baseCategories.includes(p.category)) {
      const orphanAddons = cart.filter(i => (i.category === 'Adicionais' || i.category === 'Diversos') && (!i.subItems || i.subItems.length === 0));
      
      if (orphanAddons.length > 0) {
        let newCart = cart.filter(i => !((i.category === 'Adicionais' || i.category === 'Diversos') && (!i.subItems || i.subItems.length === 0)));
        
        let newSubItems = [];
        orphanAddons.forEach(orphan => {
           const ex = newSubItems.find(s => String(s.id) === String(orphan.id) || (s.firestoreId && s.firestoreId === orphan.firestoreId));
           if (ex) {
             ex.qty += orphan.qty;
           } else {
             newSubItems.push({ ...orphan });
           }
        });
        
        newCart.push({ ...p, cartItemId: Date.now().toString() + Math.random().toString(), qty: 1, obs: '', subItems: newSubItems });
        setCart(newCart);
        showToastMsg(`Adicionais unidos a ${p.name}!`);
        return;
      }
    }

    // Comportamento Normal
    const ex = cart.find(i => (String(i.id) === String(p.id) || (i.firestoreId && i.firestoreId === p.firestoreId)) && (!i.subItems || i.subItems.length === 0));
    if (ex) {
      setCart(cart.map(i => i.cartItemId === ex.cartItemId ? { ...i, qty: i.qty + 1 } : i));
    } else {
      setCart([...cart, { ...p, cartItemId: Date.now().toString() + Math.random().toString(), qty: 1, obs: '', subItems: [] }]);
    }
  };

  const incrementQty = (cartItemId) => { setCart(cart.map(i => i.cartItemId === cartItemId ? { ...i, qty: i.qty + 1 } : i)); };
  const removeFromCart = (cartItemId) => {
    const ex = cart.find(i => i.cartItemId === cartItemId);
    if (ex.qty > 1) setCart(cart.map(i => i.cartItemId === cartItemId ? { ...i, qty: i.qty - 1 } : i));
    else setCart(cart.filter(item => item.cartItemId !== cartItemId));
  };

  const linkItem = (sourceCartItemId, targetCartItemId) => {
    const sourceItem = cart.find(i => i.cartItemId === sourceCartItemId);
    if (!sourceItem) return;
    setCart(prevCart => {
      let newCart = prevCart.filter(i => i.cartItemId !== sourceCartItemId);
      newCart = newCart.map(item => {
        if (item.cartItemId === targetCartItemId) {
          const existingSub = (item.subItems || []).find(sub => String(sub.id) === String(sourceItem.id));
          let newSubItems = item.subItems || [];
          if (existingSub) newSubItems = newSubItems.map(sub => String(sub.id) === String(sourceItem.id) ? { ...sub, qty: sub.qty + sourceItem.qty } : sub);
          else newSubItems = [...newSubItems, { ...sourceItem }];
          return { ...item, subItems: newSubItems };
        }
        return item;
      });
      return newCart;
    });
    showToastMsg("Item agrupado com sucesso!");
  };

  const unlinkItem = (parentCartItemId, subItemId) => {
    const parent = cart.find(i => i.cartItemId === parentCartItemId);
    const subItem = parent.subItems.find(s => String(s.id) === String(subItemId));
    setCart(prevCart => {
      const newCart = prevCart.map(item => {
        if (item.cartItemId === parentCartItemId) return { ...item, subItems: item.subItems.filter(s => String(s.id) !== String(subItemId)) };
        return item;
      });
      newCart.push({ ...subItem, cartItemId: Date.now().toString() + Math.random().toString(), subItems: [] });
      return newCart;
    });
  };

  const getCartTotal = () => cart.reduce((acc, item) => acc + calcItemTotal(item), 0);

  const sendOrder = async () => {
    if (!cart.length) return; 
    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      const deductions = getStockDeductions(cart);
      Object.entries(deductions).forEach(([prodId, totalQty]) => {
        const pItem = products.find(p => String(p.id) === String(prodId));
        if (pItem && pItem.firestoreId) {
          batch.update(getDocRef('products', pItem.firestoreId), { stock: Math.max(0, pItem.stock - totalQty) });
        }
      });

      const cartWithStatus = cart.map(item => ({ ...item, kitchenStatus: 'Pendente' }));

      const ordersSnap = await getDocs(query(getCollectionRef('orders')));
      const existingDoc = ordersSnap.docs.find(d => {
        const data = d.data();
        return data.paymentStatus === 'ABERTO' && data.client?.toLowerCase().trim() === customerName?.toLowerCase().trim();
      });

      let msg = '';

      if (existingDoc) {
        const existingData = existingDoc.data();
        await updateDoc(getDocRef('orders', existingDoc.id), {
          items: [...(existingData.items || []), ...cartWithStatus],
          total: (existingData.total || 0) + getCartTotal(),
          kitchenStatus: 'Pendente',
          updatedAt: new Date().toISOString()
        });
        msg = `*ADICIONANDO AO PEDIDO - ${settings?.storeName}*\n\n`;
      } else {
        const orderData = { 
          id: orderCounter, 
          client: customerName,
          phone: customerPhone,
          orderType: orderType,
          waiter: 'WhatsApp', 
          items: cartWithStatus, 
          total: getCartTotal(), 
          status: 'ABERTO', 
          paymentStatus: 'ABERTO', 
          kitchenStatus: 'Pendente', 
          method: 'Aguardando', 
          date: new Date().toISOString(), 
          time: new Date().toLocaleTimeString().slice(0, 5), 
          origin: 'WhatsApp' 
        };
        await addDoc(getCollectionRef('orders'), orderData);
        msg = `*NOVO PEDIDO - ${settings?.storeName}*\n\n`;
      }

      await batch.commit();

      msg += `👤 *Cliente:* ${customerName}\n`;
      if (customerPhone) msg += `📞 *Contato:* ${customerPhone}\n`;
      msg += `🛵 *Tipo:* ${orderType}\n\n`;
      msg += `*ITENS ${existingDoc ? 'ADICIONADOS' : 'DO PEDIDO'}:*\n`;
      cart.forEach(item => {
         msg += `👉 ${item.qty}x ${item.name} - R$ ${calcItemTotal(item).toFixed(2)}\n`;
         item.subItems?.forEach(sub => {
             msg += `   + ${sub.qty * item.qty}x ${sub.name}\n`;
         });
         if (item.obs) msg += `   *Obs:* ${item.obs}\n`;
      });
      msg += `\n💰 *VALOR DESTA ADIÇÃO: R$ ${getCartTotal().toFixed(2)}*\n\n`;
      msg += `Aguardo a confirmação do pedido!`;

      const storePhoneNumber = settings?.phone?.replace(/\D/g, '') || '';
      if (storePhoneNumber) {
         window.open(`https://wa.me/55${storePhoneNumber}?text=${encodeURIComponent(msg)}`, '_blank');
      }

      setView('success'); 
      setTimeout(() => { 
        setCart([]); 
        setCustomerName('');
        setCustomerPhone('');
        setView('login'); 
        setIsSubmitting(false); 
      }, 3000);
    } catch (e) { showToastMsg("Erro ao enviar pedido", "error"); setIsSubmitting(false); }
  };

  const handleAiSuggestion = async () => {
    setIsAiLoading(true); setShowAiModal(true); setAiResponse('');
    const availableProducts = products.map(p => `${p.name} (R$ ${p.price})`).join(', ');
    const cartItems = cart.length > 0 ? cart.map(i => i.name).join(', ') : 'nenhum item';
    const prompt = `Atue como um garçom experiente e amigável de uma lanchonete brasileira. Aqui está o menu: [${availableProducts}]. O cliente tem atualmente no carrinho: [${cartItems}]. Sugira APENAS UMA combinação do menu para este cliente (ex: se pediu tapioca, sugira café). Se o carrinho estiver vazio, sugira o item mais popular. Responda em português de forma curta (máximo 2 frases) e convidativa. Use emojis.`;
    const result = await callGemini(prompt);
    setAiResponse(result || "Desculpe, o chef está ocupado agora!");
    setIsAiLoading(false);
  };

  const filtered = products.filter(p => p.category === selectedCategory && p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const total = getCartTotal(); 
  const count = cart.reduce((a, i) => a + i.qty, 0);

  if (view === 'success') return <div className="h-screen bg-green-600 flex flex-col items-center justify-center text-white p-8 animate-in fade-in zoom-in-95"><CheckCircle size={80} className="mb-4" /><h1 className="text-3xl font-bold">Pedido Enviado!</h1><p className="mt-4 text-green-100 text-center">Verifique o seu WhatsApp para concluir o pagamento.</p></div>;

  return (
    <div className="min-h-screen bg-slate-100 pb-24 font-sans max-w-md mx-auto shadow-2xl relative border-x border-slate-200 animate-in fade-in">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="bg-slate-900 text-white p-4 sticky top-0 z-20 shadow-md flex justify-between items-center">
        {view === 'login' ? (
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="p-1 hover:bg-slate-800 rounded-full transition-colors"><ChevronLeft /></button>
            <span className="font-bold">Cardápio Digital</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={() => setView(view === 'cart' ? 'menu' : 'login')} className="p-1 hover:bg-slate-800 rounded-full transition-colors"><ChevronLeft /></button>
            <span className="font-bold truncate max-w-[200px]">{customerName || 'Cardápio'}</span>
          </div>
        )}
        <div className="text-xs bg-slate-800 px-2 py-1 rounded flex items-center gap-1"><Store size={12} /> {settings?.storeName || 'Loja'}</div>
      </div>
      
      {view === 'login' && (
        <div className="p-6 animate-in fade-in">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <h2 className="font-black text-2xl text-slate-800 mb-2">Olá! 👋</h2>
            <p className="text-slate-500 mb-6 text-sm">Preencha seus dados para acessar o nosso cardápio e fazer seu pedido.</p>
            
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Seu Nome</label>
                <input required value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full p-4 border border-slate-300 rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-bold text-slate-800" placeholder="Ex: Maria Silva" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">WhatsApp</label>
                <input type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="w-full p-4 border border-slate-300 rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all text-slate-800" placeholder="(00) 00000-0000" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">O pedido é para:</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Consumo no Local', 'Retirada', 'Entrega'].map(t => (
                    <button type="button" key={t} onClick={() => setOrderType(t)} className={`py-3 px-2 text-xs font-bold rounded-xl border transition-colors ${orderType === t ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="pt-4">
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold shadow-lg shadow-indigo-600/20 transition-all active:scale-95 text-lg">Ver Cardápio</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {view === 'menu' && (
        <div className="animate-in fade-in">
          <div className="bg-white p-4 sticky top-[60px] z-10 border-b shadow-sm">
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar..." className="w-full bg-slate-100 pl-10 p-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <button onClick={handleAiSuggestion} className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white p-2 rounded-lg shadow-md animate-pulse hover:opacity-90 active:scale-95"><Sparkles size={20}/></button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
              {categories.map(c => (
                <button key={c} onClick={() => setSelectedCategory(c)} className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${selectedCategory === c ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{c}</button>
              ))}
            </div>
          </div>

          <div className="p-4 grid grid-cols-2 gap-3">
            {filtered.map(p => {
              const qty = cart.filter(i => i.id === p.id).reduce((sum, i) => sum + i.qty, 0);
              return (
                <div key={p.id} className={`bg-white p-3 rounded-2xl shadow-sm border flex flex-col items-center text-center gap-2 transition-all ${qty > 0 ? 'border-blue-500 bg-blue-50/30' : 'border-slate-100'}`}>
                  <div className="bg-slate-100 p-4 rounded-full mb-1"><IconMapper type={p.icon} className="w-8 h-8 text-slate-700" /></div>
                  <div className="flex-1 w-full"><div className="font-bold text-sm leading-tight mb-1 truncate px-1 text-slate-800">{p.name}</div><div className="text-sm font-bold text-blue-600">R$ {p.price.toFixed(2)}</div></div>
                  {p.stock > 0 ? (
                    <div className="w-full mt-1">
                      <button onClick={() => addToCart(p)} className="w-full py-2 bg-slate-900 text-white text-sm font-bold rounded-lg shadow-sm hover:bg-slate-800 active:scale-95 transition-transform">{qty > 0 ? `Adicionado (${qty})` : 'Adicionar'}</button>
                    </div>
                  ) : (<span className="text-xs font-bold text-red-400 mt-2 block w-full py-2 bg-red-50 rounded-lg">Esgotado</span>)}
                </div>
              )
            })}
          </div>
        </div>
      )}
      
      {view === 'cart' && (
        <div className="p-4 animate-in slide-in-from-right-4">
          <h2 className="font-bold text-xl mb-4 flex items-center gap-2 text-slate-800"><ShoppingCart /> Seu Pedido</h2>
          
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden mb-4">
            {cart.map(item => (
              <div key={item.cartItemId} className="p-4 border-b border-slate-100 last:border-0">
                <div className="flex justify-between items-start mb-2">
                  <div><div className="font-bold text-slate-800"><span className="text-blue-600 mr-1">{item.qty}x</span> {item.name}</div><div className="text-sm text-slate-500 font-medium">R$ {calcItemTotal(item).toFixed(2)}</div></div>
                  <div className="flex gap-2">
                    <button onClick={() => removeFromCart(item.cartItemId)} className="w-7 h-7 flex items-center justify-center bg-red-50 text-red-500 rounded hover:bg-red-100 active:scale-95 transition-all">-</button>
                    <button onClick={() => incrementQty(item.cartItemId)} className="w-7 h-7 flex items-center justify-center bg-green-50 text-green-600 rounded hover:bg-green-100 active:scale-95 transition-all">+</button>
                  </div>
                </div>
                {item.subItems && item.subItems.length > 0 && (
                  <div className="pl-3 mt-3 mb-3 border-l-2 border-indigo-200 space-y-2">
                    {item.subItems.map(sub => (
                      <div key={sub.id} className="flex justify-between items-center bg-slate-50 p-2 rounded-lg text-sm border border-slate-100">
                        <span className="font-bold text-slate-600 text-xs">+ {sub.qty * item.qty}x {sub.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500 text-xs font-medium">R$ {(sub.price * sub.qty * item.qty).toFixed(2)}</span>
                          <button onClick={() => unlinkItem(item.cartItemId, sub.id)} className="text-red-400 hover:text-red-600 p-1" title="Remover e deixar avulso"><Trash2 size={14}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <input placeholder="Ex: Tirar a cebola..." value={item.obs || ''} onChange={e => setCart(cart.map(x => x.cartItemId === item.cartItemId ? { ...x, obs: e.target.value } : x))} className="w-full text-xs bg-slate-50 border border-slate-200 p-2.5 rounded-lg outline-none focus:border-blue-500 transition-colors mt-2" />
              </div>
            ))}
            {cart.length === 0 && <div className="p-6 text-center text-slate-500 text-sm font-medium">Carrinho vazio</div>}
          </div>
          {cart.length > 0 && (
            <>
              <div className="bg-white p-4 rounded-xl shadow-sm mb-6 flex justify-between font-bold text-lg text-slate-800"><span>Total a Pagar</span><span className="text-blue-600">R$ {total.toFixed(2)}</span></div>
              <button onClick={sendOrder} disabled={isSubmitting} className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-600/20 transition-all active:scale-95 disabled:opacity-70">
                {isSubmitting ? 'Gerando...' : <><MessageCircle size={20} /> Enviar pelo WhatsApp</>}
              </button>
            </>
          )}
        </div>
      )}
      
      {view === 'menu' && count > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-30 max-w-md mx-auto animate-in slide-in-from-bottom-5">
          <button onClick={() => setView('cart')} className="w-full bg-slate-900 text-white p-4 rounded-2xl shadow-xl flex justify-between items-center hover:bg-slate-800 transition-colors active:scale-95">
            <div className="flex items-center gap-3">
              <div className="bg-white text-slate-900 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">{count}</div>
              <span className="font-bold">Ver Carrinho</span>
            </div>
            <span className="font-bold text-lg">R$ {total.toFixed(2)}</span>
          </button>
        </div>
      )}
      
      {/* AI Suggestion Modal */}
      {showAiModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden border-2 border-purple-100 animate-in zoom-in-95">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 text-white flex justify-between items-center">
              <h3 className="font-bold text-lg flex items-center gap-2"><Sparkles size={20} className="animate-spin-slow"/> Sugestão do Chef</h3>
              <button onClick={() => setShowAiModal(false)} className="hover:bg-white/20 p-1 rounded-full transition-colors"><X size={20}/></button>
            </div>
            <div className="p-6 text-center">
              {isAiLoading ? (
                <div className="py-8 flex flex-col items-center">
                  <Loader2 size={40} className="animate-spin text-purple-600 mb-4"/>
                  <p className="text-slate-500 font-medium">Consultando o chef...</p>
                </div>
              ) : (
                <div className="py-4">
                  <div className="text-lg font-medium text-slate-800 leading-relaxed mb-6">{aiResponse}</div>
                  <button onClick={() => setShowAiModal(false)} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold w-full hover:bg-slate-800 transition-colors shadow-lg">Entendido!</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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
  const [orderCounter, setOrderCounter] = useState(1);
  const [settings, setSettings] = useState(initialSettings);
  const [toast, setToast] = useState(null);
  const [confirmState, setConfirmState] = useState({ isOpen: false, msg: '', action: null });

  // Estados de "Pessoa/Lugar" no POS
  const [currentGuest, setCurrentGuest] = useState('Pessoa 1');
  const [guestList, setGuestList] = useState(['Pessoa 1']);
  const [payingGuest, setPayingGuest] = useState('Mesa Completa');
  const [renameModal, setRenameModal] = useState({ show: false, oldName: '', newName: '' });

  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

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
  const [newProdCat, setNewProdCat] = useState('');

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
  const [isAiLoading, setIsAiLoading] = useState(false); 

  const [selectedFutureOrder, setSelectedFutureOrder] = useState(null);
  const [settleValue, setSettleValue] = useState('');
  const [settleMethod, setSettleMethod] = useState('Pix');

  const [showSettingsPasswordModal, setShowSettingsPasswordModal] = useState(false);
  const [settingsPasswordInput, setSettingsPasswordInput] = useState('');
  const [isSettingsUnlocked, setIsSettingsUnlocked] = useState(false);

  const [actionAuthModal, setActionAuthModal] = useState({ show: false, action: null, order: null });
  const [actionPassword, setActionPassword] = useState('');
  
  const [showDeleteAuthModal, setShowDeleteAuthModal] = useState(false);
  const [deletePasswordInput, setDeletePasswordInput] = useState('');

  const [configForm, setConfigForm] = useState({
    ...initialSettings,
    docType: initialSettings?.docType || 'CNPJ',
    docId: initialSettings?.docId || initialSettings?.cnpj || ''
  });

  const [reportDate, setReportDate] = useState(new Date());
  const [reportMode, setReportMode] = useState('daily');
  const [kitchenExpandedOrder, setKitchenExpandedOrder] = useState(null);
  
  // History Feature States
  const [historyDate, setHistoryDate] = useState(getTodayStr());
  const [historySearch, setHistorySearch] = useState('');
  const [selectedHistoryOrder, setSelectedHistoryOrder] = useState(null);

  const clientRef = useRef(null);
  const phoneRef = useRef(null);
  const dateRef = useRef(null);
  const timeRef = useRef(null);
  const totalRef = useRef(null);
  const obsRef = useRef(null);
  const signalRef = useRef(null);
  const signalMethodRef = useRef(null);

  const handleOrderKeyDown = (e, nextRef) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      nextRef?.current?.focus();
    }
  };

  useEffect(() => {
    if (!user) return;
    const unsubProd = onSnapshot(query(getCollectionRef('products')), (snap) => { 
      const list = snap.docs.map(d => ({ firestoreId: d.id, ...d.data() })).sort((a, b) => a.id - b.id); 
      setProducts(list); 
      
      const fetchedCategories = [...new Set(list.map(p => p.category).filter(Boolean))];
      setCategories(fetchedCategories);
      setSelectedCategory(prev => fetchedCategories.includes(prev) ? prev : (fetchedCategories[0] || ''));
    });
    const unsubOrders = onSnapshot(query(getCollectionRef('orders')), (snap) => {
      const list = snap.docs.map(d => ({ firestoreId: d.id, ...d.data() })).sort((a, b) => b.id - a.id); setOrders(list); 
      if (list.length > 0) {
        const maxId = Math.max(0, ...list.map(o => Number(o.id) || 0));
        setOrderCounter(maxId + 1);
      }
    });
    const unsubMove = onSnapshot(query(getCollectionRef('cash_movements')), (snapshot) => { setCashMovements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))); });
    const unsubFuture = onSnapshot(query(getCollectionRef('future_orders')), (snap) => { setFutureOrders(snap.docs.map(d => ({ firestoreId: d.id, ...d.data() })).sort((a, b) => new Date(a.deliveryDate + 'T' + a.deliveryTime) - new Date(b.deliveryDate + 'T' + b.deliveryTime))); });
    return () => { unsubProd(); unsubOrders(); unsubMove(); unsubFuture(); };
  }, [user]);

  useEffect(() => {
    setSettings(initialSettings);
    setConfigForm({
      ...initialSettings,
      docType: initialSettings?.docType || 'CNPJ',
      docId: initialSettings?.docId || initialSettings?.cnpj || ''
    });
  }, [initialSettings]);

  const showToastMsg = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const addToCart = (p) => { 
    if (p.stock <= 0) { showToastMsg("Sem estoque!", "error"); return; } 
    
    const baseCategories = ['Tapiocas', 'Cuscuz', 'Pão', 'Lanches', 'Salgados e Caldos'];
    const addonCategories = ['Adicionais'];

    // --- LÓGICA DE UNIÃO AUTOMÁTICA NO POS ---
    if (addonCategories.includes(p.category)) {
      const reversedCart = [...cart].reverse();
      const parentIdxInReversed = reversedCart.findIndex(i => i.guest === currentGuest && baseCategories.includes(i.category));
      
      if (parentIdxInReversed !== -1) {
        const actualIdx = cart.length - 1 - parentIdxInReversed;
        const parentItem = cart[actualIdx];
        
        let newSubItems = [...(parentItem.subItems || [])];
        const existingSub = newSubItems.find(s => s.id === p.id);
        
        if (existingSub) {
          newSubItems = newSubItems.map(s => s.id === p.id ? { ...s, qty: s.qty + 1 } : s);
        } else {
          newSubItems.push({ ...p, qty: 1 });
        }
        
        const newCart = [...cart];
        newCart[actualIdx] = { ...parentItem, subItems: newSubItems };
        setCart(newCart);
        showToastMsg(`${p.name} unido a ${parentItem.name}!`);
        return;
      }
    } else if (baseCategories.includes(p.category)) {
      const orphanAddons = cart.filter(i => i.guest === currentGuest && addonCategories.includes(i.category) && (!i.subItems || i.subItems.length === 0));
      
      if (orphanAddons.length > 0) {
        let newCart = cart.filter(i => !(i.guest === currentGuest && addonCategories.includes(i.category) && (!i.subItems || i.subItems.length === 0)));
        
        let newSubItems = [];
        orphanAddons.forEach(orphan => {
           const ex = newSubItems.find(s => s.id === orphan.id);
           if (ex) {
             ex.qty += orphan.qty;
           } else {
             newSubItems.push({ ...orphan });
           }
        });
        
        newCart.push({ ...p, cartItemId: Date.now().toString() + Math.random().toString(), qty: 1, obs: '', subItems: newSubItems, guest: currentGuest });
        setCart(newCart);
        showToastMsg(`Adicionais unidos a ${p.name}!`);
        return;
      }
    }

    // Comportamento Normal
    const ex = cart.find(i => i.id === p.id && i.guest === currentGuest && (!i.subItems || i.subItems.length === 0));
    if (ex) {
      setCart(cart.map(i => i.cartItemId === ex.cartItemId ? { ...i, qty: i.qty + 1 } : i));
    } else {
      setCart([...cart, { ...p, cartItemId: Date.now().toString() + Math.random().toString(), qty: 1, obs: '', subItems: [], guest: currentGuest }]);
    }
  };

  const incrementQty = (cartItemId) => {
    setCart(cart.map(i => i.cartItemId === cartItemId ? { ...i, qty: i.qty + 1 } : i));
  };
  
  const removeFromCart = (cartItemId) => {
    const ex = cart.find(i => i.cartItemId === cartItemId);
    if (ex.qty > 1) {
      setCart(cart.map(i => i.cartItemId === cartItemId ? { ...i, qty: i.qty - 1 } : i));
    } else {
      setCart(cart.filter(item => item.cartItemId !== cartItemId));
    }
  };

  const linkItem = (sourceCartItemId, targetCartItemId) => {
    const sourceItem = cart.find(i => i.cartItemId === sourceCartItemId);
    if (!sourceItem) return;
    setCart(prevCart => {
      let newCart = prevCart.filter(i => i.cartItemId !== sourceCartItemId);
      newCart = newCart.map(item => {
        if (item.cartItemId === targetCartItemId) {
          const existingSub = (item.subItems || []).find(sub => sub.id === sourceItem.id);
          let newSubItems = item.subItems || [];
          if (existingSub) {
            newSubItems = newSubItems.map(sub => sub.id === sourceItem.id ? { ...sub, qty: sub.qty + sourceItem.qty } : sub);
          } else {
            newSubItems = [...newSubItems, { ...sourceItem }];
          }
          return { ...item, subItems: newSubItems };
        }
        return item;
      });
      return newCart;
    });
  };

  const unlinkItem = (parentCartItemId, subItemId) => {
    const parent = cart.find(i => i.cartItemId === parentCartItemId);
    const subItem = parent.subItems.find(s => s.id === subItemId);
    if (!subItem) return;
    setCart(prevCart => {
      const newCart = prevCart.map(item => {
        if (item.cartItemId === parentCartItemId) {
          return { ...item, subItems: (item.subItems || []).filter(s => s.id !== subItemId) };
        }
        return item;
      });
      newCart.push({ ...subItem, cartItemId: Date.now().toString() + Math.random().toString(), subItems: [] });
      return newCart;
    });
  };

  const getCartTotal = () => cart.reduce((acc, item) => acc + calcItemTotal(item), 0);
  const cartTotal = getCartTotal();

  const finalizeOrder = async (client = 'Balcão', status = 'PAGO', overridePayments = null) => {
    if (!user) return;
    const paymentsToProcess = overridePayments || partialPayments;
    
    // Lógica para divisão de conta (Partial Payment via Guest)
    const isPartialPayment = payingGuest !== 'Mesa Completa';
    
    const cartWithStatus = cart.map(i => ({ ...i, kitchenStatus: 'Pendente' }));

    const safeTabItems = selectedTabToSettle?.items || [];
    const itemsToPay = selectedTabToSettle 
        ? (isPartialPayment ? safeTabItems.filter(i => (i.guest || 'Pessoa 1') === payingGuest) : safeTabItems) 
        : (isPartialPayment ? cartWithStatus.filter(i => (i.guest || 'Pessoa 1') === payingGuest) : cartWithStatus);
    
    const itemsToKeep = selectedTabToSettle 
        ? (isPartialPayment ? safeTabItems.filter(i => (i.guest || 'Pessoa 1') !== payingGuest) : [])
        : (isPartialPayment ? cartWithStatus.filter(i => (i.guest || 'Pessoa 1') !== payingGuest) : []);

    const totalOrder = itemsToPay.reduce((acc, item) => acc + calcItemTotal(item), 0);

    if (status === 'PAGO') {
      const paidTotal = paymentsToProcess.reduce((acc, p) => acc + p.value, 0);
      if (paidTotal < totalOrder - 0.01) { showToastMsg("Pagamento insuficiente.", "error"); return; }
    }

    const nowISO = new Date().toISOString();

    const deductStock = async (itemsToDeduct) => {
      const batch = writeBatch(db);
      const deductions = getStockDeductions(itemsToDeduct);
      let hasUpdates = false;
      Object.entries(deductions).forEach(([pid, qty]) => {
        const prod = products.find(p => p.id === parseInt(pid));
        if (prod?.firestoreId) {
          batch.update(getDocRef('products', prod.firestoreId), { stock: Math.max(0, prod.stock - qty) });
          hasUpdates = true;
        }
      });
      if (hasUpdates) await batch.commit();
    };

    try {
      if (status === 'ABERTO') {
        const existing = orders.find(o => o.client?.toLowerCase().trim() === client?.toLowerCase().trim() && o.paymentStatus === 'ABERTO');
        if (existing) {
          await updateDoc(getDocRef('orders', existing.firestoreId), { 
            items: [...(existing.items || []), ...cartWithStatus], 
            total: (existing.total || 0) + getCartTotal(), 
            kitchenStatus: 'Pendente', 
            updatedAt: nowISO 
          });
          showToastMsg(`Itens adicionados à comanda de ${client}!`);
        } else {
          await addDoc(getCollectionRef('orders'), { 
            id: orderCounter, 
            items: cartWithStatus, 
            total: getCartTotal(), 
            status: 'ABERTO', 
            paymentStatus: 'ABERTO', 
            method: 'Aguardando', 
            client, 
            kitchenStatus: 'Pendente', 
            date: nowISO, 
            paidAt: null, 
            time: new Date().toLocaleTimeString().slice(0, 5), 
            origin: 'Caixa' 
          });
          showToastMsg(`Comanda aberta para ${client}!`);
        }
        await deductStock(cart);
        setCart([]);
        setGuestList(['Pessoa 1']);
        setCurrentGuest('Pessoa 1');
        setShowPaymentModal(false);
        setCustomerName('');
        return; 
      }

      const methodString = paymentsToProcess.length > 0 ? paymentsToProcess.map(p => p.method).join(' + ') : 'Dinheiro';
      
      const cashPay = paymentsToProcess.find(p => p.method === 'Dinheiro');
      let received = cashPay && cashPay.receivedValue !== undefined ? cashPay.receivedValue : totalOrder;
      const change = Math.max(0, received - totalOrder);

      const orderData = { 
        id: selectedTabToSettle ? selectedTabToSettle.id : orderCounter, 
        items: itemsToPay, 
        total: totalOrder, 
        status: 'Pago', 
        paymentStatus: 'PAGO', 
        method: methodString, 
        client: selectedTabToSettle ? (isPartialPayment ? `${selectedTabToSettle.client} (${payingGuest})` : selectedTabToSettle.client) : (client || (isPartialPayment ? `Balcão (${payingGuest})` : 'Balcão')), 
        date: selectedTabToSettle?.date || nowISO, 
        receivedValue: cashPay ? received : null,
        changeValue: change > 0 ? change : null
      };

      if (selectedTabToSettle) {
        if (isPartialPayment && itemsToKeep.length > 0) {
          // Pagamento de apenas 1 Pessoa: cria recibo dela e mantém a mesa aberta
          await addDoc(getCollectionRef('orders'), { 
            ...orderData, 
            origin: 'Caixa (Parcial)', 
            kitchenStatus: 'Pronto', 
            time: new Date().toLocaleTimeString().slice(0, 5),
            payments: paymentsToProcess.length > 0 ? paymentsToProcess : [{ method: 'Dinheiro', value: totalOrder }],
            paidAt: nowISO
          });
          
          await updateDoc(getDocRef('orders', selectedTabToSettle.firestoreId), { 
            items: itemsToKeep,
            total: itemsToKeep.reduce((acc, item) => acc + calcItemTotal(item), 0),
            updatedAt: nowISO 
          });
        } else {
          // Pagamento total da mesa
          await updateDoc(getDocRef('orders', selectedTabToSettle.firestoreId), { 
            paymentStatus: 'PAGO', 
            status: 'Pago',
            method: methodString, 
            payments: paymentsToProcess.length > 0 ? paymentsToProcess : [{ method: 'Dinheiro', value: totalOrder }], 
            paidAt: nowISO,
            receivedValue: orderData.receivedValue,
            changeValue: orderData.changeValue
          });
        }
      } else {
        // Pagamento Direto no POS (Novo Pedido)
        if (isPartialPayment && itemsToKeep.length > 0) {
          await addDoc(getCollectionRef('orders'), { 
            ...orderData, 
            origin: 'Caixa (Parcial)', 
            kitchenStatus: 'Pendente', 
            time: new Date().toLocaleTimeString().slice(0, 5),
            payments: paymentsToProcess.length > 0 ? paymentsToProcess : [{ method: 'Dinheiro', value: totalOrder }],
            paidAt: nowISO
          });
          await deductStock(itemsToPay);
          
          setFinalizedOrder(orderData);
          setCart(itemsToKeep); // Mantém os restantes no carrinho do POS
          const remainingGuests = [...new Set(itemsToKeep.map(i => i.guest || 'Pessoa 1'))];
          setGuestList(remainingGuests.length > 0 ? remainingGuests : ['Pessoa 1']);
          setCurrentGuest(remainingGuests.length > 0 ? remainingGuests[0] : 'Pessoa 1');
          setPartialPayments([]);
          setPayingGuest('Mesa Completa');
          setShowPaymentModal(false);
          showToastMsg(`Venda finalizada para ${payingGuest}! O restante continua no carrinho.`);
          return; // Previne o limpa-carrinho global abaixo
        } else {
          await addDoc(getCollectionRef('orders'), { 
            ...orderData, 
            origin: 'Caixa', 
            kitchenStatus: 'Pendente', 
            time: new Date().toLocaleTimeString().slice(0, 5),
            payments: paymentsToProcess.length > 0 ? paymentsToProcess : [{ method: 'Dinheiro', value: totalOrder }],
            paidAt: nowISO
          });
          await deductStock(itemsToPay);
        }
      }
      
      setFinalizedOrder(orderData);
      setCart([]);
      setGuestList(['Pessoa 1']);
      setCurrentGuest('Pessoa 1');
      setPartialPayments([]);
      setSelectedTabToSettle(null);
      setCustomerName('');
      setPayingGuest('Mesa Completa');
      setShowPaymentModal(false);
      showToastMsg("Venda finalizada!");
    } catch (e) { 
      console.error(e); 
      showToastMsg(`Erro ao salvar venda: ${e.message}`, "error"); 
    }
  };

  const confirmActionAuth = () => {
    const currentPass = settings.posPassword || '1234';
    if (actionPassword === currentPass) {
      performAction();
    } else {
      showToastMsg('Senha incorreta!', 'error');
      setActionPassword('');
    }
  };

  const performAction = async () => {
    const { action, order } = actionAuthModal;
    if (!order) return;

    try {
      const batch = writeBatch(db);
      const restores = getStockDeductions(order.items);
      Object.entries(restores).forEach(([prodId, totalQty]) => {
        const pItem = products.find(p => p.id === parseInt(prodId));
        if (pItem && pItem.firestoreId) {
          batch.update(getDocRef('products', pItem.firestoreId), { stock: pItem.stock + totalQty });
        }
      });
      const orderRef = getDocRef('orders', order.firestoreId);
      batch.delete(orderRef);
      await batch.commit();

      if (action === 'cancel') {
        showToastMsg("Pedido cancelado e estoque restaurado!");
      } else if (action === 'edit') {
        setCart(order.items.map(i => ({ ...i, cartItemId: Date.now().toString() + Math.random().toString() })));
        
        // Reconstrói a lista de convidados se houver
        const uniqueGuests = [...new Set(order.items.map(i => i.guest || 'Pessoa 1'))];
        setGuestList(uniqueGuests.length > 0 ? uniqueGuests : ['Pessoa 1']);
        setCurrentGuest(uniqueGuests.length > 0 ? uniqueGuests[0] : 'Pessoa 1');

        const isTable = MESAS.includes(order.client);
        if (isTable) {
          setSelectedTabToSettle({ ...order, firestoreId: null });
          setCustomerName('');
        } else {
          setCustomerName(order.client);
          setSelectedTabToSettle(null);
        }
        setView('pos');
        showToastMsg(`Pedido de ${order.client} carregado para edição.`);
      }
    } catch (error) { console.error(error); showToastMsg("Erro ao processar ação.", "error"); }
    setActionAuthModal({ show: false, action: null, order: null });
    setActionPassword('');
  };
  
  const triggerClearHistory = () => {
    setShowDeleteAuthModal(true);
    setDeletePasswordInput('');
  };

  const confirmClearHistory = async () => {
    const currentPass = settings?.settingsPassword || '1234';
    if (deletePasswordInput === currentPass) {
      try {
        const snapshot = await getDocs(query(getCollectionRef('orders')));
        const batch = writeBatch(db);
        let count = 0;
        snapshot.docs.forEach(docSnap => {
          if (docSnap.data().paymentStatus === 'PAGO') {
            batch.delete(docSnap.ref);
            count++;
          }
        });
        if (count > 0) {
           await batch.commit();
           showToastMsg(`${count} pedidos finalizados apagados!`, 'success');
        } else {
           showToastMsg(`Nenhum pedido para apagar.`, 'success');
        }
        setShowDeleteAuthModal(false);
        setDeletePasswordInput('');
      } catch (e) {
        console.error(e);
        showToastMsg("Erro ao apagar histórico.", "error");
      }
    } else {
      showToastMsg("Senha incorreta!", "error");
      setDeletePasswordInput('');
    }
  };

  const openEditOrderModal = (order) => {
    setEditingFutureOrder(order);
    setOrderClient(order.client);
    setOrderPhone(order.phone);
    setOrderDate(order.deliveryDate);
    setOrderTime(order.deliveryTime);
    setOrderObs(order.description);
    setOrderTotalValue(order.total);
    setOrderSignal(order.signal);
    setOrderSignalMethod(order.signalMethod || 'Pix');
    setShowOrderModal(true);
  };

  const handleImproveDescription = async () => {
    if (!orderObs || orderObs.length < 5) return;
    setIsAiLoading(true);
    const prompt = `Transforme esta anotação bruta de pedido de confeitaria em uma descrição comercial, clara e apetitosa em português. Mantenha todos os detalhes técnicos mas escreva de forma profissional para a ficha de produção. Texto original: "${orderObs}"`;
    const improved = await callGemini(prompt);
    if (improved) setOrderObs(improved);
    setIsAiLoading(false);
  };

  const saveFutureOrder = async () => {
    if (!orderClient) { showToastMsg("Nome obrigatório", "error"); return; }
    const totalVal = parseFloat(orderTotalValue) || 0;
    const signalVal = parseFloat(orderSignal) || 0;

    const orderData = {
      client: orderClient,
      phone: orderPhone,
      deliveryDate: orderDate || new Date().toISOString().split('T')[0],
      deliveryTime: orderTime || '12:00',
      description: orderObs,
      total: totalVal,
      signal: signalVal,
      signalMethod: orderSignalMethod
    };

    try {
      if (editingFutureOrder) {
        await updateDoc(getDocRef('future_orders', editingFutureOrder.firestoreId), { ...orderData, updatedAt: new Date().toISOString() });
        showToastMsg("Encomenda atualizada com sucesso!");
      } else {
        await addDoc(getCollectionRef('future_orders'), { ...orderData, status: 'Pendente', createdAt: new Date().toISOString() });
        if (signalVal > 0) {
          await addDoc(getCollectionRef('orders'), { id: orderCounter + 1, client: `Sinal: ${orderClient}`, total: signalVal, status: 'Pago', paymentStatus: 'PAGO', method: orderSignalMethod, payments: [{ method: orderSignalMethod, value: signalVal }], date: new Date().toISOString(), time: new Date().toLocaleTimeString().slice(0, 5), origin: 'Encomenda', kitchenStatus: 'N/A', items: [{ name: 'Sinal Encomenda', price: signalVal, qty: 1 }] });
        }
        showToastMsg("Encomenda salva!");
      }
    } catch(e) { console.error(e); showToastMsg("Erro ao salvar encomenda.", "error"); }

    setShowOrderModal(false); 
    setEditingFutureOrder(null);
    setOrderClient(''); setOrderPhone(''); setOrderObs(''); setOrderSignal(''); setOrderTotalValue(''); 
  };

  const handleSettleOrder = async () => {
    if (!selectedFutureOrder) return;
    try {
      const amountReceived = parseFloat(settleValue) || 0;
      await updateDoc(getDocRef('future_orders', selectedFutureOrder.firestoreId), { status: 'Concluído', finalPayment: amountReceived, finalPaymentMethod: settleMethod, completedAt: new Date().toISOString() });
      if (amountReceived > 0) await addDoc(getCollectionRef('orders'), { id: orderCounter + 1, client: `Restante: ${selectedFutureOrder.client}`, total: amountReceived, status: 'Pago', paymentStatus: 'PAGO', method: settleMethod, payments: [{ method: settleMethod, value: amountReceived }], date: new Date().toISOString(), time: new Date().toLocaleTimeString().slice(0, 5), origin: 'Encomenda', kitchenStatus: 'N/A', items: [{ name: 'Restante Encomenda', price: amountReceived, qty: 1 }] });
      setSelectedFutureOrder(null); 
      showToastMsg("Encerrada com sucesso!");
    } catch(e) { console.error(e); showToastMsg("Erro ao finalizar.", "error"); }
  };

  const openWhatsApp = (phone) => {
    if (!phone) return;
    const cleanPhone = phone.replace(/\D/g, '');
    const url = `https://wa.me/55${cleanPhone}`;
    window.open(url, '_blank');
  };

  const handleSettingsAccess = () => {
    if (isSettingsUnlocked) { setView('settings'); } else { setShowSettingsPasswordModal(true); setSettingsPasswordInput(''); }
  };

  const submitSettingsPassword = () => {
    const currentPass = settings?.settingsPassword || '1234';
    if (settingsPasswordInput === currentPass) { setIsSettingsUnlocked(true); setShowSettingsPasswordModal(false); setView('settings'); setSettingsPasswordInput(''); } 
    else { showToastMsg("Senha incorreta", "error"); setSettingsPasswordInput(''); }
  };

  const saveSettings = async () => {
    try { 
      const cleanData = Object.fromEntries(Object.entries(configForm).filter(([_, v]) => v !== undefined));
      await setDoc(getDocRef('app_state', 'settings'), cleanData, { merge: true }); 
      showToastMsg("Configurações Salvas!"); 
    } 
    catch (e) { 
      console.error("Erro no saveSettings", e); 
      showToastMsg("Erro ao salvar: " + e.message, "error"); 
    }
  };

  const handleAddCashMovement = async () => {
    if (!movementValue || parseFloat(movementValue) <= 0 || !user) return;
    try { await addDoc(getCollectionRef('cash_movements'), { type: movementType, value: parseFloat(movementValue), description: movementDesc, date: new Date().toISOString(), createdAt: Timestamp.now() }); setShowCashMovementModal(false); setMovementValue(''); setMovementDesc(''); showToastMsg("Movimentação registrada!"); } 
    catch (e) { console.error(e); showToastMsg("Erro ao registrar", "error"); }
  };

  const addNewProduct = async () => { 
    if (!newProdName || !newProdPrice || !user) return; 
    try { 
      const safePrice = parseFloat(newProdPrice.toString().replace(',', '.'));
      if (isNaN(safePrice)) throw new Error("Preço inválido.");
      await addDoc(getCollectionRef('products'), { id: Date.now(), name: newProdName, price: safePrice, category: newProdCat, stock: 50, icon: 'burger' }); 
      setNewProdName(''); 
      setNewProdPrice(''); 
      showToastMsg("Produto adicionado!"); 
    }
    catch(e) { console.error("Adicionar produto erro:", e); showToastMsg("Erro: " + e.message, "error"); }
  };
  
  const handleUpdateProduct = async () => { 
    if (!editingProduct || !user) return; 
    try { 
      const priceNum = parseFloat(editingProduct.price.toString().replace(',', '.'));
      await updateDoc(getDocRef('products', editingProduct.firestoreId), { name: editingProduct.name, price: priceNum, category: editingProduct.category, stock: editingProduct.stock }); 
      setEditingProduct(null); 
      showToastMsg("Produto atualizado!"); 
    }
    catch(e) { console.error(e); showToastMsg("Erro: " + e.message, "error"); }
  };

  const confirmDeleteProduct = (p) => {
    setConfirmState({
      isOpen: true,
      msg: `Excluir permanentemente o produto "${p.name}"?`,
      action: async () => {
        try {
          await deleteDoc(getDocRef('products', p.firestoreId));
          setToast({ msg: 'Produto excluído com sucesso!', type: 'success' });
          setEditingProduct(null);
        } catch (error) {
          console.error(error);
          setToast({ msg: 'Erro ao excluir produto.', type: 'error' });
        } finally {
          setConfirmState({ isOpen: false, msg: '', action: null });
        }
      }
    });
  };

  const changeDate = (days) => { const d = new Date(reportDate); d.setDate(d.getDate() + days); setReportDate(d); };
  const changeWeek = (weeks) => { const d = new Date(reportDate); d.setDate(d.getDate() + (weeks * 7)); setReportDate(d); };
  const changeMonth = (months) => { const d = new Date(reportDate); d.setMonth(d.getMonth() + months); setReportDate(d); };

  const factoryResetSales = async () => {
    setConfirmState({
      isOpen: true,
      msg: 'ATENÇÃO: Deseja apagar TODAS as vendas, fluxo de caixa, comandas e encomendas de teste? (Seus Produtos e Configurações serão mantidos). Esta ação é definitiva!',
      action: async () => {
        setConfirmState({ isOpen: false, msg: '', action: null });
        try {
          const cols = ['orders', 'records_v2', 'closed_weeks', 'cash_movements', 'future_orders'];
          for (const c of cols) {
            const snapshot = await getDocs(query(getCollectionRef(c)));
            if (!snapshot.empty) {
              const batch = writeBatch(db);
              snapshot.docs.forEach(docSnap => batch.delete(docSnap.ref));
              await batch.commit();
            }
          }
          await setDoc(getDocRef('app_state', 'calculator'), { bills: { 200: '', 100: '', 50: '', 20: '', 10: '', 5: '', 2: '' }, coins: { 1: '', 0.50: '', 0.25: '', 0.10: '', 0.05: '' }, pix: '' });
          
          showToastMsg("Sistema zerado e pronto para a inauguração!", "success");
          setOrderCounter(1);
        } catch (e) {
          console.error("Erro ao zerar:", e);
          showToastMsg("Erro ao limpar dados.", "error");
        }
      }
    });
  };

  const factoryResetProducts = async () => {
    setConfirmState({
      isOpen: true,
      msg: 'ATENÇÃO: Deseja apagar TODOS os produtos cadastrados? Esta ação é irreversível!',
      action: async () => {
        setConfirmState({ isOpen: false, msg: '', action: null });
        try {
          const snapshot = await getDocs(query(getCollectionRef('products')));
          if (!snapshot.empty) {
            const batch = writeBatch(db);
            snapshot.docs.forEach(docSnap => batch.delete(docSnap.ref));
            await batch.commit();
          }
          showToastMsg("Todos os produtos foram apagados!", "success");
        } catch (e) {
          console.error("Erro ao apagar produtos:", e);
          showToastMsg("Erro ao limpar produtos.", "error");
        }
      }
    });
  };

  const safeTabSettleItems = selectedTabToSettle?.items || [];
  const itemsToPayLive = selectedTabToSettle 
    ? (payingGuest === 'Mesa Completa' ? safeTabSettleItems : safeTabSettleItems.filter(i => (i.guest || 'Pessoa 1') === payingGuest)) 
    : (payingGuest === 'Mesa Completa' ? cart : cart.filter(i => (i.guest || 'Pessoa 1') === payingGuest));
    
  const modalTotal = itemsToPayLive.reduce((acc, item) => acc + calcItemTotal(item), 0);
  const modalPaid = partialPayments.reduce((acc, p) => acc + p.value, 0);
  const modalRemaining = Math.max(0, modalTotal - modalPaid);
  
  const liveChange = useMemo(() => {
    if (!paymentInputValue) return 0;
    const val = parseFloat(paymentInputValue.replace(',', '.'));
    return Math.max(0, val - modalRemaining);
  }, [paymentInputValue, modalRemaining]);

  const uniqueGuestsInTab = selectedTabToSettle ? [...new Set(safeTabSettleItems.map(i => i.guest || 'Pessoa 1'))] : [...new Set(cart.map(i => i.guest || 'Pessoa 1'))];

  const filtered = products.filter(p => p.category === selectedCategory && p.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const getFilteredOrders = () => {
    return orders.filter(o => {
      if (!o || o.paymentStatus !== 'PAGO' || !o.date) return false;
      try {
        const orderDate = new Date(o.date);
        if (reportMode === 'daily') {
            return orderDate.getDate() === reportDate.getDate() && orderDate.getMonth() === reportDate.getMonth() && orderDate.getFullYear() === reportDate.getFullYear();
        } else if (reportMode === 'weekly') {
            return getWeekId(String(o.date).split('T')[0] || String(o.date)) === getWeekId(reportDate.toISOString().split('T')[0]);
        } else {
            return orderDate.getMonth() === reportDate.getMonth() && orderDate.getFullYear() === reportDate.getFullYear();
        }
      } catch { return false; }
    });
  };
  
  const filteredOrders = getFilteredOrders();
  const totalSales = filteredOrders.reduce((acc, order) => acc + (Number(order.total) || 0), 0);
  const salesByMethod = filteredOrders.reduce((acc, order) => {
    if (order.payments && Array.isArray(order.payments)) {
      order.payments.forEach(p => { const val = Number(p.value) || 0; if (p.method === 'Dinheiro') acc.dinheiro += val; else if (p.method === 'Pix') acc.pix += val; else if (['Crédito', 'Débito'].includes(p.method)) acc.cartao += val; });
    }
    else { const val = Number(order.total) || 0; const m = order.method || ''; if (m.includes('Dinheiro')) acc.dinheiro += val; else if (m.includes('Pix') || m.includes('PIX')) acc.pix += val; else acc.cartao += val; }
    return acc;
  }, { dinheiro: 0, pix: 0, cartao: 0 });
  
  const filteredMovements = cashMovements.filter(m => {
    if (!m.date) return false;
    const mDate = new Date(m.date); 
    if (reportMode === 'daily') return mDate.getDate() === reportDate.getDate() && mDate.getMonth() === reportDate.getMonth() && mDate.getFullYear() === reportDate.getFullYear(); 
    else if (reportMode === 'weekly') return getWeekId(String(m.date).split('T')[0] || String(m.date)) === getWeekId(reportDate.toISOString().split('T')[0]);
    else return mDate.getMonth() === reportDate.getMonth() && mDate.getFullYear() === reportDate.getFullYear();
  });
  
  const totalSuprimento = filteredMovements.filter(m => m.type === 'suprimento').reduce((acc, m) => acc + (Number(m.value) || 0), 0);
  const totalSangria = filteredMovements.filter(m => m.type === 'sangria').reduce((acc, m) => acc + (Number(m.value) || 0), 0);
  
  const orderMetrics = useMemo(() => {
    const now = new Date(); const today = now.toISOString().split('T')[0]; const cm = today.slice(0, 7); const cy = today.slice(0, 4); 
    const getWeek = (d) => { const date = new Date(d); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7); const w1 = new Date(date.getFullYear(), 0, 4); return 1 + Math.round(((date.getTime() - w1.getTime()) / 86400000 - 3 + (w1.getDay() + 6) % 7) / 7); }; 
    const cw = getWeek(now); let day = 0, week = 0, month = 0, year = 0; 
    futureOrders.forEach(o => {
      if (o.status === 'Cancelado') return; const d = String(o.deliveryDate || ''); const val = Number(o.total) || 0; if (d === today) day += val; if (d.startsWith(cm)) month += val; if (d.startsWith(cy)) year += val; if (getWeek(new Date(d)) === cw && d.startsWith(cy)) week += val;
    });
    return { day, week, month, year };
  }, [futureOrders]);

  const historyOrders = useMemo(() => {
    return orders.filter(o => {
      if (o.paymentStatus !== 'PAGO') return false;
      const orderDateStr = o.paidAt || o.date || '';
      if (!orderDateStr.startsWith(historyDate)) return false;
      if (historySearch && !o.client?.toLowerCase().includes(historySearch.toLowerCase())) return false;
      return true;
    }).sort((a, b) => new Date(b.paidAt || b.date) - new Date(a.paidAt || a.date));
  }, [orders, historyDate, historySearch]);

  return (
    <div className="font-sans bg-slate-100 min-h-screen text-slate-900 flex animate-in fade-in">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmDialog isOpen={confirmState.isOpen} message={confirmState.msg} onConfirm={confirmState.action} onCancel={() => setConfirmState({ isOpen: false, msg: '', action: null })} />

      <div className="w-16 bg-slate-900 text-white flex flex-col items-center py-6 fixed h-full left-0 z-10 shadow-2xl justify-between">
        <div className="flex flex-col items-center gap-4 w-full mt-4">
          <div onClick={onBack} className="p-2 bg-amber-500 rounded-lg mb-2 cursor-pointer hover:bg-amber-400 transition-colors" title="Sair"><Store size={20} className="text-slate-900" /></div>
          {[{v:'pos',i:ShoppingCart},{v:'tabs',i:ClipboardList},{v:'kitchen',i:ChefHat},{v:'orders',i:Cake},{v:'history',i:History},{v:'cash',i:Coins},{v:'admin',i:LayoutDashboard},{v:'settings',i:Settings}].map(nav => {
            const Icon = nav.i;
            return (
              <button key={nav.v} onClick={() => { if(nav.v==='settings' && !isSettingsUnlocked) setShowSettingsPasswordModal(true); else setView(nav.v); }} className={`p-2 rounded-xl relative transition-all ${view === nav.v ? 'bg-indigo-600 shadow-lg' : 'text-slate-400 hover:text-white'}`}>
                <Icon size={20} />
                {nav.v==='tabs' && orders.some(o=>o.paymentStatus==='ABERTO') && <span className="absolute -top-1 -right-1 bg-red-500 w-2 h-2 rounded-full"></span>}
                {nav.v==='kitchen' && orders.some(o=>o.kitchenStatus==='Pendente' && o.items?.some(i => i.kitchenStatus === 'Pendente' || !i.kitchenStatus)) && <span className="absolute -top-1 -right-1 bg-red-500 w-2 h-2 rounded-full animate-pulse"></span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 w-full relative pl-16">
        
        {/* Modais Globais POS */}
        {showSettingsPasswordModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"><div className="bg-white rounded-2xl p-6 w-full max-w-sm"><h3 className="text-xl font-bold mb-4 text-center">Acesso Configurações</h3><input type="password" autoFocus placeholder="Senha" className="w-full border p-3 rounded-xl mb-4 text-center" value={settingsPasswordInput} onChange={e=>setSettingsPasswordInput(e.target.value)} onKeyDown={e=>e.key==='Enter' && (settingsPasswordInput===(settings?.settingsPassword||'1234')?(setIsSettingsUnlocked(true),setShowSettingsPasswordModal(false),setView('settings')):(showToastMsg("Senha incorreta","error"),setSettingsPasswordInput('')))} /><div className="flex gap-2"><button onClick={()=>setShowSettingsPasswordModal(false)} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold text-slate-600">Cancelar</button><button onClick={()=>settingsPasswordInput===(settings?.settingsPassword||'1234')?(setIsSettingsUnlocked(true),setShowSettingsPasswordModal(false),setView('settings')):(showToastMsg("Senha incorreta","error"),setSettingsPasswordInput(''))} className="flex-1 bg-gray-800 text-white py-3 rounded-xl font-bold">Acessar</button></div></div></div>
        )}

        {actionAuthModal.show && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 p-4"><div className="bg-white rounded-2xl p-6 w-full max-w-sm"><div className="flex justify-center mb-4 text-red-500"><AlertOctagon size={48} /></div><h3 className="text-xl font-bold mb-2 text-center">{actionAuthModal.action === 'cancel' ? 'Cancelar Pedido' : 'Editar Pedido'}</h3><p className="text-sm text-slate-500 mb-4 text-center">Esta ação requer autorização de gerente.</p><input type="password" autoFocus placeholder="Senha do Caixa" className="w-full border p-3 text-center mb-4 rounded-xl" value={actionPassword} onChange={e=>setActionPassword(e.target.value)} onKeyDown={e=>e.key==='Enter' && confirmActionAuth()} /><div className="flex gap-2"><button onClick={()=>{setActionAuthModal({show:false,action:null,order:null});setActionPassword('');}} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold text-slate-600">Cancelar</button><button onClick={confirmActionAuth} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold">Confirmar</button></div></div></div>
        )}

        {showDeleteAuthModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 p-4"><div className="bg-white rounded-2xl p-6 w-full max-w-sm"><div className="flex justify-center mb-4 text-red-500"><AlertTriangle size={48}/></div><h3 className="text-xl font-bold mb-2 text-center">Apagar Vendas</h3><p className="text-sm text-slate-500 mb-4 text-center">Esta ação apagará permanentemente todos os pedidos finalizados. Necessita senha de Configurações.</p><input type="password" autoFocus placeholder="Senha de Configuração" className="w-full border p-3 text-center mb-4 rounded-xl" value={deletePasswordInput} onChange={e=>setDeletePasswordInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&confirmClearHistory()} /><div className="flex gap-2"><button onClick={()=>{setShowDeleteAuthModal(false);setDeletePasswordInput('');}} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold text-slate-600">Cancelar</button><button onClick={confirmClearHistory} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold">Confirmar</button></div></div></div>
        )}

        {finalizedOrder && (
          <div className="fixed inset-0 bg-slate-900/80 z-[300] flex items-center justify-center p-4"><div className="bg-white rounded-3xl p-8 w-full max-w-sm text-center"><div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle size={48} className="text-green-600"/></div><h2 className="text-2xl font-black mb-2">Venda Finalizada!</h2><div className="space-y-3 mt-8"><button onClick={() => handlePrint(finalizedOrder, settings, 'customer')} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2"><Printer size={20}/> Imprimir Recibo</button><button onClick={() => setFinalizedOrder(null)} className="w-full bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold">Voltar ao Início</button></div></div></div>
        )}

        {/* VIEWS */}
        {view === 'pos' && (
          <div className="flex h-screen">
            <div className="flex-1 p-6 overflow-y-auto bg-slate-50">
              <h1 className="text-2xl font-bold mb-6">Novo Pedido (Balcão)</h1>
              <div className="bg-white p-4 mb-4 sticky top-0 z-10 border-b shadow-sm rounded-xl"><div className="flex gap-2 mb-3"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 text-slate-400" size={18} /><input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="Buscar..." className="w-full bg-slate-100 pl-10 p-2 rounded-lg text-sm outline-none" /></div></div><div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">{categories.map(c => <button key={c} onClick={()=>setSelectedCategory(c)} className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${selectedCategory===c?'bg-slate-900 text-white':'bg-slate-100 text-slate-600'}`}>{c}</button>)}</div></div>
              <div className="bg-white p-3 mb-6 flex items-center gap-2 overflow-x-auto shadow-sm rounded-xl border border-slate-200 hide-scrollbar"><Users size={18} className="text-slate-400 mr-1 shrink-0" />{guestList.map(g => (<div key={g} className={`flex items-center rounded-full border shrink-0 ${currentGuest===g?'bg-indigo-600 text-white':'bg-slate-50 text-slate-600'}`}><button onClick={()=>setCurrentGuest(g)} className="px-4 py-1.5 text-xs font-bold">{g}</button>{currentGuest===g && <button onClick={()=>setRenameModal({show:true,oldName:g,newName:g})} className="pr-3 pl-1 py-1.5"><Edit3 size={12}/></button>}</div>))}<button onClick={()=>{const nG=`Pessoa ${guestList.length+1}`;setGuestList([...guestList,nG]);setCurrentGuest(nG);}} className="px-4 py-1.5 rounded-full text-xs font-bold bg-white border border-dashed border-slate-400 flex items-center gap-1 shrink-0"><Plus size={12}/> Add Pessoa</button></div>
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-24">
                {filtered.map(p => (
                  <button key={p.id} onClick={()=>addToCart(p)} disabled={p.stock<=0} className={`bg-white p-4 rounded-2xl shadow-sm border flex flex-col text-left active:scale-95 ${p.stock<=0?'opacity-50':''}`}><div className="flex justify-between items-center mb-3 w-full"><div className="bg-blue-50 p-2 rounded-lg"><IconMapper type={p.icon} className="w-5 h-5 text-blue-600" /></div><span className="font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded-lg">{formatMoney(p.price)}</span></div><div className="font-bold text-slate-800 leading-tight mb-1">{p.name}</div><div className="text-xs font-bold text-slate-400">{p.stock} un</div></button>
                ))}
              </div>
            </div>
            <div className="w-96 bg-white border-l border-slate-200 shadow-xl flex flex-col z-10">
              <div className="p-5 border-b bg-slate-50">
                <div className="font-bold text-lg flex gap-2 items-center text-slate-800 mb-4"><ShoppingCart size={22} className="text-blue-600" /> Carrinho</div>
                <div className="space-y-2"><label className="text-xs font-bold text-slate-500 uppercase">Vincular Cliente/Mesa:</label><input placeholder="Nome ou Mesa..." value={customerName} onChange={e=>setCustomerName(e.target.value)} className="w-full border p-2.5 rounded-xl text-sm outline-none font-bold" />{orders.filter(o=>o.paymentStatus==='ABERTO').length>0 && <div className="flex gap-2 overflow-x-auto pb-1 pt-1 hide-scrollbar">{orders.filter(o=>o.paymentStatus==='ABERTO').map(o=><button key={o.id} onClick={()=>setCustomerName(o.client)} className="px-3 py-1.5 rounded-lg text-xs font-bold border whitespace-nowrap bg-white hover:bg-slate-50">{o.client}</button>)}</div>}</div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
                {guestList.map(g => {
                  const gI = cart.filter(i=>i.guest===g); if(gI.length===0) return null;
                  return (
                    <div key={g} className="border-b-4 border-slate-100 last:border-0 pb-2 mb-4"><div className="bg-slate-50 p-3 font-bold text-sm flex items-center gap-2 border-b rounded-t-xl"><UserCircle2 size={16}/> {g}</div>
                      {gI.map(item => (
                        <div key={item.cartItemId} className="p-4 border-b last:border-0"><div className="flex justify-between items-start mb-2"><div><div className="font-bold"><span className="text-blue-600 mr-1">{item.qty}x</span>{item.name}</div><div className="text-sm text-slate-500 font-medium">{formatMoney(calcItemTotal(item))}</div></div><div className="flex gap-2"><button onClick={()=>removeFromCart(item.cartItemId)} className="w-7 h-7 bg-red-50 text-red-500 rounded font-bold">-</button><button onClick={()=>incrementQty(item.cartItemId)} className="w-7 h-7 bg-green-50 text-green-600 rounded font-bold">+</button></div></div>
                          {item.subItems?.length>0 && <div className="pl-3 mt-2 mb-3 border-l-2 border-indigo-200 space-y-2">{item.subItems.map(sub=><div key={sub.id} className="flex justify-between items-center bg-slate-50 p-2 rounded-lg text-sm"><span className="font-bold text-xs text-slate-600">+ {sub.qty*item.qty}x {sub.name}</span><div className="flex items-center gap-3"><span className="text-xs font-medium">{formatMoney(sub.price*sub.qty*item.qty)}</span><button onClick={()=>unlinkItem(item.cartItemId, sub.id)} className="text-red-400 p-1"><Trash2 size={14}/></button></div></div>)}</div>}
                          <input placeholder="Obs..." value={item.obs||''} onChange={e=>setCart(cart.map(x=>x.cartItemId===item.cartItemId?{...x,obs:e.target.value}:x))} className="w-full text-xs bg-slate-50 border p-2.5 rounded-lg outline-none mt-2" />
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
              <div className="p-5 border-t bg-slate-50"><div className="flex justify-between mb-4 items-center"><span className="font-bold uppercase text-sm">Total</span><span className="text-3xl font-black text-blue-600">{formatMoney(cartTotal)}</span></div><div className="flex flex-col gap-3">{customerName && <button onClick={()=>finalizeOrder(customerName, 'ABERTO')} disabled={cart.length===0} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold flex justify-center gap-2 disabled:opacity-50"><ListPlus size={18}/> Lançar Comanda</button>}<button onClick={()=>{if(cart.length>0){setSelectedTabToSettle(null);setPartialPayments([]);setPaymentInputValue('');setPayingGuest('Mesa Completa');setShowPaymentModal(true);}}} disabled={cart.length===0} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-lg disabled:opacity-50">COBRAR AGORA</button></div></div>
            </div>
            
            {showPaymentModal && (
              <div className="fixed inset-0 bg-black/60 z-[250] flex items-center justify-center p-4"><div className="bg-white w-full max-w-md rounded-3xl overflow-hidden"><div className="p-6 bg-slate-900 text-white flex justify-between"><h3 className="font-bold text-xl">Finalizar Venda</h3><button onClick={()=>setShowPaymentModal(false)}><X/></button></div><div className="p-6 space-y-4">
                {uniqueGuestsInTab.length > 1 && <div className="bg-slate-50 p-4 rounded-2xl"><div className="flex gap-2 overflow-x-auto"><button onClick={()=>{setPayingGuest('Mesa Completa');setPartialPayments([]);setPaymentInputValue('');}} className={`px-5 py-2.5 rounded-xl text-sm font-bold border shrink-0 ${payingGuest==='Mesa Completa'?'bg-blue-600 text-white':'bg-white text-slate-600'}`}>Tudo</button>{uniqueGuestsInTab.map(g=><button key={g} onClick={()=>{setPayingGuest(g);setPartialPayments([]);setPaymentInputValue('');}} className={`px-5 py-2.5 rounded-xl text-sm font-bold border shrink-0 ${payingGuest===g?'bg-blue-600 text-white':'bg-white text-slate-600'}`}>{g}</button>)}</div></div>}
                <div className="bg-white p-4 rounded-2xl border shadow-sm max-h-48 overflow-y-auto"><div className="space-y-3">{itemsToPayLive.map(i=><div key={i.cartItemId||Math.random()} className="flex justify-between text-sm border-b pb-2"><div className="flex gap-2"><span className="font-black text-blue-600">{i.qty}x</span><span className="font-bold">{i.name}{i.subItems?.map(s=><span key={s.id} className="block text-xs font-medium text-slate-500">+ {s.qty*i.qty}x {s.name}</span>)}</span></div><span className="font-black">{formatMoney(calcItemTotal(i))}</span></div>)}</div></div>
                <div className="bg-slate-100 p-5 rounded-2xl flex justify-between"><span className="font-bold">A Receber</span><span className="text-3xl font-black text-blue-600">{formatMoney(modalTotal)}</span></div>
                <div><input type="number" step="0.01" value={paymentInputValue} onChange={e=>setPaymentInputValue(e.target.value)} className="w-full p-4 border rounded-2xl text-xl font-black outline-none" placeholder="Valor Dinheiro R$" />{liveChange>0 && <div className="bg-emerald-50 p-4 rounded-2xl mt-3 flex justify-between"><span className="font-bold text-emerald-700">TROCO:</span><span className="text-2xl font-black text-emerald-800">{formatMoney(liveChange)}</span></div>}</div>
                <div className="grid grid-cols-2 gap-3">{['Dinheiro', 'Pix', 'Crédito', 'Débito'].map(m=><button key={m} onClick={()=>{const r=parseFloat((paymentInputValue||'').replace(',','.'))||modalRemaining; const v=Math.min(r,modalRemaining); const up=[...partialPayments,{method:m,value:v,receivedValue:m==='Dinheiro'?r:v,changeValue:m==='Dinheiro'?Math.max(0,r-modalRemaining):0}]; setPartialPayments(up); setPaymentInputValue(''); if(up.reduce((a,p)=>a+p.value,0)>=modalTotal-0.01) finalizeOrder(customerName||'Balcão','PAGO',up); }} className="py-4 border rounded-xl font-bold hover:bg-slate-50">{m}</button>)}</div>
                {!selectedTabToSettle && partialPayments.length===0 && <div className="pt-6 border-t mt-2"><div className="grid grid-cols-5 gap-2 mb-4">{MESAS.map(m=><button key={m} onClick={()=>finalizeOrder(m,'ABERTO')} className={`py-2 text-xs font-bold rounded-lg border ${orders.some(o=>o.client===m&&o.paymentStatus==='ABERTO')?'bg-indigo-50 text-indigo-700':'bg-white hover:bg-slate-50'}`}>{m.replace('Mesa ','')}</button>)}</div><div className="flex gap-3"><input placeholder="Nome Cliente" value={customerName} onChange={e=>setCustomerName(e.target.value)} className="flex-1 border p-3 rounded-xl text-sm outline-none font-bold" /><button onClick={()=>finalizeOrder(customerName,'ABERTO')} disabled={!customerName} className="bg-orange-500 text-white px-6 rounded-xl font-bold text-sm disabled:opacity-50">Abrir Conta</button></div></div>}
              </div></div></div>
            )}

            {renameModal.show && <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4"><div className="bg-white rounded-3xl p-6 w-full max-w-sm"><input autoFocus value={renameModal.newName} onChange={e=>setRenameModal({...renameModal,newName:e.target.value})} onKeyDown={e=>{if(e.key==='Enter'){const fn=renameModal.newName.trim()||renameModal.oldName; if(fn!==renameModal.oldName&&!guestList.includes(fn)){setGuestList(guestList.map(g=>g===renameModal.oldName?fn:g)); if(currentGuest===renameModal.oldName)setCurrentGuest(fn); setCart(cart.map(i=>i.guest===renameModal.oldName?{...i,guest:fn}:i));} setRenameModal({show:false,oldName:'',newName:''});}}} className="w-full border p-4 rounded-xl mb-6 text-lg font-bold" placeholder="Nome" /><div className="flex gap-2"><button onClick={()=>setRenameModal({show:false,oldName:'',newName:''})} className="flex-1 py-3 bg-slate-100 font-bold rounded-xl">Cancelar</button><button onClick={()=>{const fn=renameModal.newName.trim()||renameModal.oldName; if(fn!==renameModal.oldName&&!guestList.includes(fn)){setGuestList(guestList.map(g=>g===renameModal.oldName?fn:g)); if(currentGuest===renameModal.oldName)setCurrentGuest(fn); setCart(cart.map(i=>i.guest===renameModal.oldName?{...i,guest:fn}:i));} setRenameModal({show:false,oldName:'',newName:''});}} className="flex-1 bg-indigo-600 text-white font-bold py-3 rounded-xl">Salvar</button></div></div></div>}
          </div>
        )}

        {view === 'tabs' && (
          <div className="p-8 h-screen overflow-y-auto bg-slate-50">
            <h1 className="text-3xl font-bold mb-8 text-slate-800 flex items-center gap-3"><ClipboardList size={32} className="text-indigo-600" /> Comandas Abertas</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {orders.filter(o => o.paymentStatus === 'ABERTO').map(o => (
                <div key={o.id} className="bg-white p-5 rounded-2xl shadow-sm border border-indigo-100 relative overflow-hidden group hover:shadow-md transition-shadow">
                  {o.origin === 'Mobile' || o.origin === 'WhatsApp' ? <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] px-3 py-1 rounded-bl-xl font-bold shadow-sm">App/Site</div> : null}
                  <div className="font-bold text-xl text-indigo-900 mb-1">{o.client}</div>
                  <div className="text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded inline-block font-bold mb-3">Origem: {o.waiter || 'Balcão'}</div>
                  <div className="bg-slate-50 p-3 rounded-xl mb-4 border border-slate-100">
                    <div className="text-sm font-bold text-slate-700 mb-1">{o.items ? o.items.length : 0} Lanches/Bebidas</div>
                    <div className="text-2xl font-black text-slate-800">{formatMoney(o.total)}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setSelectedTabToSettle(o); setPartialPayments([]); setPaymentInputValue(''); setPayingGuest('Mesa Completa'); setShowPaymentModal(true); }} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold text-sm transition-colors shadow-sm active:scale-95">Receber</button>
                    <button onClick={() => setActionAuthModal({ show: true, action: 'edit', order: o })} className="bg-blue-50 text-blue-600 hover:bg-blue-100 p-3 rounded-xl transition-colors" title="Editar Itens"><Edit3 size={18} /></button>
                    <button onClick={() => setActionAuthModal({ show: true, action: 'cancel', order: o })} className="bg-red-50 text-red-500 hover:bg-red-100 p-3 rounded-xl transition-colors" title="Cancelar Comanda"><Trash2 size={18} /></button>
                  </div>
                </div>
              ))}
              {orders.filter(o => o.paymentStatus === 'ABERTO').length === 0 && (
                <div className="col-span-full text-center text-slate-400 py-20 font-medium bg-white rounded-3xl border border-dashed border-slate-300">Nenhuma comanda aberta no momento. O salão está tranquilo.</div>
              )}
            </div>
          </div>
        )}

        {view === 'kitchen' && (
          <div className="p-8 h-screen overflow-y-auto bg-slate-50">
            <h1 className="text-3xl font-bold mb-8 text-slate-800 flex items-center gap-3"><ChefHat size={32} className="text-orange-500" /> Painel da Cozinha</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {orders.filter(o => o.kitchenStatus === 'Pendente' && o.items?.some(i => i.kitchenStatus === 'Pendente' || !i.kitchenStatus)).map(o => {
                const pendingItems = o.items?.filter(i => i.kitchenStatus === 'Pendente' || !i.kitchenStatus) || [];
                return (
                <div key={o.firestoreId} className="bg-white border-l-4 border-orange-500 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="font-bold text-lg text-slate-800 block leading-tight">{o.client}</span>
                      <span className="text-xs text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded">Pedido #{String(o.id).slice(0, 4)}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-500 flex items-center gap-1 bg-slate-100 px-2 py-1 rounded"><Clock size={14}/> {o.time}</span>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4 mb-4 border border-slate-100 min-h-[100px]">
                    <ul className="text-sm space-y-2">
                      {pendingItems.map((i, idx) => (
                        <li key={idx} className="flex flex-col gap-1 border-b border-slate-200 last:border-0 pb-3 last:pb-0">
                          <div className="flex gap-2 items-start">
                            <span className="font-black text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded text-xs">{i.qty}x</span> 
                            <span className="font-bold text-slate-700">{i.name} {i.guest && !o.client?.includes(i.guest) && <span className="text-xs font-normal text-slate-500">({i.guest})</span>}</span>
                          </div>
                          
                          {i.subItems && i.subItems.length > 0 && (
                            <div className="pl-7 space-y-1">
                              {i.subItems.map((sub, sIdx) => (
                                <div key={sIdx} className="text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-1 rounded inline-block">
                                  + {sub.qty * i.qty}x {sub.name}
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {i.obs && (
                            <div className="ml-7 mt-1 text-xs font-bold text-red-500 bg-red-50 border border-red-100 px-2 py-1 rounded inline-block">
                              OBS: {i.obs}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setKitchenExpandedOrder(o)} className="flex-1 bg-white border border-slate-300 text-slate-700 py-3 rounded-xl font-bold shadow-sm transition-colors hover:bg-slate-50 flex items-center justify-center gap-2"><Maximize size={18}/> Ampliar</button>
                    <button onClick={() => {
                       const updatedItems = (o.items || []).map(i => ({ ...i, kitchenStatus: 'Pronto' }));
                       updateDoc(getDocRef('orders', o.firestoreId), { kitchenStatus: 'Pronto', items: updatedItems });
                       showToastMsg(`Pedido #${String(o.id).slice(0,4)} finalizado na cozinha.`);
                    }} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-orange-500/20 transition-colors active:scale-95 flex items-center justify-center gap-2"><CheckSquare size={18}/> Pronto</button>
                  </div>
                </div>
              )})}
              {orders.filter(o => o.kitchenStatus === 'Pendente' && o.items?.some(i => i.kitchenStatus === 'Pendente' || !i.kitchenStatus)).length === 0 && (
                <div className="col-span-full text-center text-slate-400 py-20 font-medium bg-white rounded-3xl border border-dashed border-slate-300">Nenhum pedido pendente na cozinha.</div>
              )}
            </div>
          </div>
        )}

        {/* MODAL COZINHA AMPLIADA */}
        {kitchenExpandedOrder && (
          <div className="fixed inset-0 bg-slate-900 z-[150] flex flex-col animate-in fade-in zoom-in-95">
            <div className="p-6 bg-slate-800 text-white flex justify-between items-center shadow-lg">
              <div className="flex items-center gap-4">
                <ChefHat size={40} className="text-orange-500"/>
                <div>
                  <h2 className="text-4xl font-black uppercase tracking-wider">{kitchenExpandedOrder.client}</h2>
                  <p className="text-slate-400 font-bold text-lg mt-1">Hora do Pedido: {kitchenExpandedOrder.time}</p>
                </div>
              </div>
              <button onClick={() => setKitchenExpandedOrder(null)} className="p-4 bg-slate-700 hover:bg-slate-600 rounded-full transition-colors"><X size={32}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 md:p-10 bg-slate-100">
              <div className="max-w-5xl mx-auto space-y-6">
                {(kitchenExpandedOrder.items?.filter(i => i.kitchenStatus === 'Pendente' || !i.kitchenStatus) || []).map((item, idx) => (
                  <div key={idx} className="bg-white p-6 rounded-3xl shadow-lg border-l-[12px] border-orange-500">
                    <div className="flex items-start gap-5">
                      <span className="text-5xl font-black text-orange-600 bg-orange-100 px-5 py-3 rounded-2xl min-w-[100px] text-center">{item.qty}x</span>
                      <span className="text-5xl font-bold text-slate-800 leading-tight mt-1">{item.name} <span className="text-3xl font-medium text-slate-400 ml-2">({item.guest || 'Pessoa 1'})</span></span>
                    </div>
                    
                    {item.subItems && item.subItems.length > 0 && (
                      <div className="mt-5 pl-[120px] flex flex-wrap gap-3">
                        {item.subItems.map((sub, sIdx) => (
                          <div key={sIdx} className="text-3xl font-bold text-slate-600 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
                            + {sub.qty * item.qty}x {sub.name}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {item.obs && (
                      <div className="mt-6 pl-[120px]">
                        <div className="text-3xl font-black text-red-600 bg-red-50 p-5 rounded-2xl border-4 border-red-200">
                          OBS: {item.obs}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 bg-white border-t border-slate-200 flex gap-4 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
              <button onClick={() => setKitchenExpandedOrder(null)} className="flex-1 py-8 text-2xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-3xl transition-colors">Voltar</button>
              <button onClick={() => {
                const updatedItems = (kitchenExpandedOrder.items || []).map(i => ({ ...i, kitchenStatus: 'Pronto' }));
                updateDoc(getDocRef('orders', kitchenExpandedOrder.firestoreId), { kitchenStatus: 'Pronto', items: updatedItems });
                showToastMsg(`Pedido #${String(kitchenExpandedOrder.id).slice(0,4)} finalizado na cozinha.`);
                setKitchenExpandedOrder(null);
              }} className="flex-[2] py-8 text-3xl font-black bg-orange-500 text-white hover:bg-orange-600 rounded-3xl shadow-xl shadow-orange-500/30 transition-all active:scale-95 flex items-center justify-center gap-3">
                <CheckSquare size={40}/> Marcar como Pronto
              </button>
            </div>
          </div>
        )}

        {view === 'orders' && (
          <div className="p-8 h-screen overflow-y-auto bg-slate-50">
            <header className="mb-8 flex justify-between items-center"><h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3"><Cake size={32} className="text-pink-600" /> Encomendas e Bolos</h1><button onClick={() => { setEditingFutureOrder(null); setOrderClient(''); setOrderPhone(''); setOrderObs(''); setOrderSignal(''); setOrderTotalValue(''); setShowOrderModal(true); }} className="bg-pink-600 hover:bg-pink-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-pink-600/20 flex items-center gap-2 active:scale-95 transition-all"><PlusCircle size={20} /> Nova Encomenda</button></header>
            <div className="grid grid-cols-4 gap-4 mb-8">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-pink-100"><div className="text-xs text-slate-500 uppercase font-bold mb-1">Total Hoje</div><div className="text-2xl font-bold text-pink-600">{formatMoney(orderMetrics.day)}</div></div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-pink-100"><div className="text-xs text-slate-500 uppercase font-bold mb-1">Total Semana</div><div className="text-2xl font-bold text-pink-600">{formatMoney(orderMetrics.week)}</div></div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-pink-100"><div className="text-xs text-slate-500 uppercase font-bold mb-1">Total Mês</div><div className="text-2xl font-bold text-pink-600">{formatMoney(orderMetrics.month)}</div></div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-pink-100"><div className="text-xs text-slate-500 uppercase font-bold mb-1">Total Ano</div><div className="text-2xl font-bold text-pink-600">{formatMoney(orderMetrics.year)}</div></div>
            </div>
            <div className="space-y-4">{futureOrders.map(order => (
              <div key={order.firestoreId} onClick={() => setSelectedFutureOrder(order)} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row gap-6 hover:shadow-md transition-all cursor-pointer relative group">
                {order.status === 'Concluído' && <div className="absolute top-4 right-4 text-green-600 bg-green-50 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 border border-green-100"><CheckCircle2 size={14} /> Entregue</div>}
                <div className={`flex flex-col items-center justify-center p-4 rounded-xl min-w-[120px] border ${order.status === 'Concluído' ? 'bg-slate-50 border-slate-200 text-slate-400' : 'bg-pink-50 border-pink-100 text-pink-800 shadow-inner'}`}><span className="text-sm font-bold uppercase tracking-wider">{new Date(order.deliveryDate).toLocaleDateString('pt-BR', { month: 'short' })}</span><span className="text-4xl font-black my-1">{new Date(order.deliveryDate).getDate()}</span><span className="text-xs font-bold bg-white px-3 py-1 rounded-full border border-pink-200 shadow-sm">{order.deliveryTime}</span></div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-3"><div><h3 className="text-xl font-bold text-slate-800">{order.client}</h3><div className="flex items-center gap-2 mt-1"><p className="text-sm text-slate-500 font-medium flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-md"><Phone size={14} /> {order.phone}</p><button onClick={(e) => { e.stopPropagation(); openWhatsApp(order.phone); }} className="bg-green-500 hover:bg-green-600 text-white p-1.5 rounded-lg shadow-sm transition-colors active:scale-95" title="WhatsApp"><MessageCircle size={16} /></button></div></div><div className="text-right mr-10 md:mr-0"><div className="text-2xl font-black text-slate-800">{formatMoney(order.total)}</div>{order.signal > 0 ? (<span className="text-xs font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-md border border-green-100 mt-1 inline-block">Sinal: {formatMoney(order.signal)}</span>) : (<span className="text-xs font-bold text-red-500 bg-red-50 px-2.5 py-1 rounded-md border border-red-100 mt-1 inline-block">Sem Sinal</span>)}</div></div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4"><p className="text-xs font-bold text-slate-400 uppercase mb-2">Descrição da Produção</p><p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{order.description || 'Sem detalhes.'}</p></div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={(e) => { e.stopPropagation(); openEditOrderModal(order); }} className="text-xs text-blue-600 hover:text-blue-800 font-bold px-4 py-2 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1"><Edit3 size={14}/> Editar</button>
                    <button onClick={(e) => { e.stopPropagation(); setConfirmState({ isOpen: true, msg: 'Excluir Encomenda?', action: async () => { await deleteDoc(getDocRef('future_orders', order.firestoreId)); setConfirmState({isOpen:false}); showToastMsg("Excluída!"); } }); }} className="text-xs text-red-500 hover:text-red-700 font-bold z-10 px-4 py-2 bg-red-50 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1"><Trash2 size={14}/> Excluir</button>
                  </div>
                </div>
              </div>
            ))}
            {futureOrders.length === 0 && <div className="text-center text-slate-400 py-10 font-medium">Nenhuma encomenda registrada.</div>}
            </div>
          </div>
        )}

        {/* MODAL NOVA ENCOMENDA */}
        {showOrderModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in zoom-in-95">
              <div className="p-6 bg-pink-600 text-white flex justify-between items-center"><h3 className="font-bold text-xl flex items-center gap-3"><Cake size={24}/> {editingFutureOrder ? 'Editar Encomenda' : 'Nova Encomenda'}</h3><button onClick={() => setShowOrderModal(false)} className="hover:bg-white/20 p-2 rounded-full transition-colors"><X size={24} /></button></div>
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-5">
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-2">Nome do Cliente</label><input ref={clientRef} value={orderClient} onChange={e => setOrderClient(e.target.value)} onKeyDown={e => handleOrderKeyDown(e, phoneRef)} className="w-full p-3.5 border border-slate-300 rounded-xl outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100 transition-all font-bold text-slate-800" placeholder="Ex: Maria Silva" autoFocus /></div>
                <div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-slate-500 uppercase mb-2">Telefone</label><input ref={phoneRef} value={orderPhone} onChange={e => setOrderPhone(e.target.value)} onKeyDown={e => handleOrderKeyDown(e, dateRef)} className="w-full p-3.5 border border-slate-300 rounded-xl outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100 transition-all" placeholder="(00) 00000-0000" /></div><div><label className="block text-xs font-bold text-slate-500 uppercase mb-2">Data de Entrega</label><input ref={dateRef} type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} onKeyDown={e => handleOrderKeyDown(e, timeRef)} className="w-full p-3.5 border border-slate-300 rounded-xl outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100 transition-all" /></div></div>
                <div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-slate-500 uppercase mb-2">Horário</label><input ref={timeRef} type="time" value={orderTime} onChange={e => setOrderTime(e.target.value)} onKeyDown={e => handleOrderKeyDown(e, totalRef)} className="w-full p-3.5 border border-slate-300 rounded-xl outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100 transition-all" /></div><div><label className="block text-xs font-black text-pink-700 uppercase mb-2">Valor Total (R$)</label><input ref={totalRef} type="number" step="0.01" value={orderTotalValue} onChange={e => setOrderTotalValue(e.target.value)} onKeyDown={e => handleOrderKeyDown(e, obsRef)} className="w-full p-3.5 border-2 border-pink-300 bg-pink-50 rounded-xl outline-none focus:border-pink-600 focus:ring-2 focus:ring-pink-200 transition-all font-black text-pink-700 text-lg" placeholder="0.00" /></div></div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex justify-between items-center">
                    Detalhes da Produção
                    <button onClick={handleImproveDescription} disabled={isAiLoading} className="text-pink-600 hover:text-pink-800 flex items-center gap-1.5 text-xs font-bold bg-pink-100 px-3 py-1 rounded-full hover:bg-pink-200 disabled:opacity-50 transition-colors">
                      {isAiLoading ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12}/>} Melhorar com IA
                    </button>
                  </label>
                  <textarea ref={obsRef} value={orderObs} onChange={e => setOrderObs(e.target.value)} onKeyDown={e => handleOrderKeyDown(e, signalRef)} className="w-full p-4 border border-slate-300 rounded-xl outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100 transition-all h-32 resize-none text-sm" placeholder="Ex: Bolo massa de chocolate, recheio de brigadeiro com morango, cobertura de chantininho. Tema: Festa Infantil (Homem-Aranha). Escrever Parabéns João..." />
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm"><div className="flex justify-between items-center mb-4"><label className="block text-sm font-black text-slate-700 uppercase">Sinal (Adiantamento)</label><span className="text-sm font-black text-pink-600 bg-pink-50 px-3 py-1 rounded-lg">Falta Receber: {formatMoney((parseFloat(orderTotalValue) || 0) - (parseFloat(orderSignal) || 0))}</span></div><div className="grid grid-cols-2 gap-4"><input ref={signalRef} type="number" step="0.01" value={orderSignal} onChange={e => setOrderSignal(e.target.value)} onKeyDown={e => handleOrderKeyDown(e, signalMethodRef)} className="w-full p-3.5 border border-slate-300 rounded-xl outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100 transition-all font-bold" placeholder="Valor Pago R$" /><select ref={signalMethodRef} value={orderSignalMethod} onChange={e => setOrderSignalMethod(e.target.value)} className="w-full p-3.5 border border-slate-300 rounded-xl outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100 transition-all bg-white font-bold"><option value="Pix">Pix</option><option value="Dinheiro">Dinheiro</option><option value="Cartão">Cartão</option></select></div></div>
              </div>
              <div className="p-5 bg-white border-t border-slate-200 flex justify-end gap-3"><button onClick={() => setShowOrderModal(false)} className="px-6 py-3.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Cancelar</button><button onClick={saveFutureOrder} className="px-10 py-3.5 rounded-xl font-black bg-pink-600 text-white hover:bg-pink-700 shadow-lg shadow-pink-600/30 transition-all active:scale-95 text-lg">Salvar Encomenda</button></div>
            </div>
          </div>
        )}

        {view === 'admin' && (
          <div className="p-8 h-screen overflow-y-auto bg-slate-50">
            <header className="mb-8 flex justify-between items-center">
              <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3"><LayoutDashboard size={32} className="text-purple-600" /> Dashboard & Gestão</h1>
              <div className="flex gap-3">
                <button onClick={triggerClearHistory} className="bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm border border-red-200 flex items-center gap-2 active:scale-95"><Trash2 size={18} /> Apagar Vendas</button>
                <button onClick={() => setShowCashMovementModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2 active:scale-95"><ArrowRightLeft size={18} /> Lançar Movimentação</button>
                <div className="flex bg-white p-1.5 rounded-xl shadow-sm border border-slate-200">
                  <button onClick={() => setReportMode('daily')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${reportMode === 'daily' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>Diário</button>
                  <button onClick={() => setReportMode('weekly')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${reportMode === 'weekly' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>Semanal</button>
                  <button onClick={() => setReportMode('monthly')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${reportMode === 'monthly' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>Mensal</button>
                </div>
              </div>
            </header>
            
            <div className="mb-8 flex justify-between items-center bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-4">
                <button onClick={() => reportMode === 'daily' ? changeDate(-1) : reportMode === 'weekly' ? changeWeek(-1) : changeMonth(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ChevronLeft size={24} className="text-slate-600" /></button>
                <div className="flex items-center gap-3"><Calendar size={24} className="text-blue-600" />
                  <span className="text-xl font-bold text-slate-800 capitalize min-w-[200px] text-center">
                    {reportMode === 'daily' ? reportDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }) : 
                     reportMode === 'weekly' ? `Semana ${getWeekId(reportDate.toISOString().split('T')[0]).split('-W')[1]} de ${reportDate.getFullYear()}` :
                     reportDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                  </span>
                </div>
                <button onClick={() => reportMode === 'daily' ? changeDate(1) : reportMode === 'weekly' ? changeWeek(1) : changeMonth(1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ChevronRight size={24} className="text-slate-600" /></button>
              </div>
              <button onClick={() => setReportDate(new Date())} className="text-sm font-bold text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-xl border border-blue-100 transition-colors">Voltar para Hoje</button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 bg-gradient-to-br from-emerald-50 to-green-50 rounded-3xl border border-emerald-100 flex items-center justify-between shadow-sm"><div><div className="text-emerald-700 text-sm font-bold uppercase mb-2 flex items-center gap-2"><ArrowUpCircle size={18} /> Entrada Caixa (Suprimento)</div><div className="text-4xl font-black text-slate-800">{formatMoney(totalSuprimento)}</div></div><div className="bg-white p-4 rounded-2xl text-emerald-600 shadow-sm border border-emerald-100"><Coins size={32} /></div></div>
                <div className="p-6 bg-gradient-to-br from-red-50 to-rose-50 rounded-3xl border border-red-100 flex items-center justify-between shadow-sm"><div><div className="text-red-700 text-sm font-bold uppercase mb-2 flex items-center gap-2"><ArrowDownCircle size={18} /> Saída Caixa (Sangria)</div><div className="text-4xl font-black text-slate-800">{formatMoney(totalSangria)}</div></div><div className="bg-white p-4 rounded-2xl text-red-600 shadow-sm border border-red-100"><Wallet size={32} /></div></div>
              </div>
              
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-100"><div className="text-blue-700 text-sm font-bold uppercase mb-2 flex items-center gap-2"><DollarSign size={18} /> Faturamento Bruto</div><div className="text-4xl font-black text-slate-800">R$ {totalSales.toFixed(2)}</div></div>
                <div className="p-5 bg-purple-50/50 rounded-2xl border border-purple-100"><div className="text-purple-700 text-sm font-bold uppercase mb-2 flex items-center gap-2"><ShoppingCart size={18} /> Volume de Vendas</div><div className="text-4xl font-black text-slate-800">{filteredOrders.length} <span className="text-lg text-slate-500 font-medium">pedidos</span></div></div>
                <div className="p-5 bg-amber-50/50 rounded-2xl border border-amber-100"><div className="text-amber-700 text-sm font-bold uppercase mb-2 flex items-center gap-2"><User size={18} /> Ticket Médio</div><div className="text-4xl font-black text-slate-800">R$ {filteredOrders.length > 0 ? (totalSales / filteredOrders.length).toFixed(2) : '0.00'}</div></div>
              </div>
              
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 lg:col-span-2">
                <h3 className="font-bold text-xl text-slate-800 mb-6 flex items-center gap-2"><Wallet size={20} className="text-blue-500" /> Detalhamento Financeiro</h3>
                <div className="overflow-hidden rounded-2xl border border-slate-100">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold tracking-wider"><tr><th className="p-4">Método de Pagamento</th><th className="p-4 text-right">Valor Total Recebido</th></tr></thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      <tr className="hover:bg-slate-50 transition-colors"><td className="p-4 font-bold text-slate-700 flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-teal-400"></div> PIX</td><td className="p-4 text-right font-mono text-base font-medium">R$ {salesByMethod.pix.toFixed(2)}</td></tr>
                      <tr className="hover:bg-slate-50 transition-colors"><td className="p-4 font-bold text-slate-700 flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-400"></div> Dinheiro</td><td className="p-4 text-right font-mono text-base font-medium">R$ {salesByMethod.dinheiro.toFixed(2)}</td></tr>
                      <tr className="hover:bg-slate-50 transition-colors"><td className="p-4 font-bold text-slate-700 flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-indigo-400"></div> Cartão (Déb/Créd)</td><td className="p-4 text-right font-mono text-base font-medium">R$ {salesByMethod.cartao.toFixed(2)}</td></tr>
                      <tr className="bg-slate-50 border-t-2 border-slate-200"><td className="p-5 font-black text-slate-800 uppercase">Total Consolidado</td><td className="p-5 text-right font-black text-slate-900 font-mono text-xl text-blue-600">R$ {totalSales.toFixed(2)}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 lg:col-span-1">
                <h3 className="font-bold text-xl text-slate-800 mb-6 flex items-center gap-2"><TrendingUp size={20} className="text-yellow-500" /> Top 10 Mais Vendidos</h3>
                <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
                  {(Object.entries(filteredOrders.reduce((a, o) => { 
                    o.items?.forEach(i => { 
                      a[i.name] = (a[i.name] || 0) + i.qty;
                      i.subItems?.forEach(sub => {
                        a[sub.name] = (a[sub.name] || 0) + (sub.qty * i.qty);
                      });
                    }); 
                    return a; 
                  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 10)).map(([n, q], i) => (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-1.5"><span className="font-bold text-slate-700">{i + 1}. {n}</span><span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">{q} un</span></div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{ width: '100%' }}></div></div>
                    </div>
                  ))}
                  {Object.keys(filteredOrders).length === 0 && <div className="text-slate-400 text-sm text-center font-medium pt-10">Nenhuma venda no período.</div>}
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 lg:col-span-3">
                <h3 className="font-bold text-xl text-slate-800 mb-6 flex items-center gap-2"><Plus size={20} className="text-emerald-500" /> Cadastro e Gestão de Produtos</h3>
                <div className="space-y-4 mb-8 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <div><label className="block text-xs font-bold text-slate-500 uppercase mb-2">Nome do Produto</label><input value={newProdName} onChange={(e) => setNewProdName(e.target.value)} className="w-full p-3.5 border border-slate-200 bg-white rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Ex: X-Tudo, Bolo de Cenoura..." /></div>
                  <div className="grid grid-cols-2 gap-5">
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-2">Preço (R$)</label><input type="number" step="0.01" value={newProdPrice} onChange={(e) => setNewProdPrice(e.target.value)} className="w-full p-3.5 border border-slate-200 bg-white rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" placeholder="0.00" /></div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Categoria</label>
                      <input type="text" list="cat-list" value={newProdCat} onChange={(e) => setNewProdCat(e.target.value)} className="w-full p-3.5 border border-slate-200 bg-white rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Ex: Lanches, Bebidas..." />
                      <datalist id="cat-list">
                        {categories.map(c => <option key={c} value={c} />)}
                      </datalist>
                    </div>
                  </div>
                  <button onClick={addNewProduct} className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20 active:scale-95 text-lg mt-2">Adicionar Novo Produto</button>
                </div>
                
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left border-collapse">
                    <thead><tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider font-bold"><th className="p-4">Produto</th><th className="p-4">Categoria</th><th className="p-4">Preço</th><th className="p-4 text-center">Estoque</th><th className="p-4 text-right">Ações</th></tr></thead>
                    <tbody className="text-sm divide-y divide-slate-100">
                      {products.map(p => (
                        <tr key={p.id} className="hover:bg-blue-50/50 transition-colors group">
                          <td className="p-4 font-bold text-slate-800">{p.name}</td>
                          <td className="p-4"><span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold">{p.category}</span></td>
                          <td className="p-4 font-medium text-slate-700">R$ {Number(p.price).toFixed(2)}</td>
                          <td className="p-4 text-center"><span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${p.stock <= 5 ? 'bg-red-100 text-red-700' : p.stock < 15 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{p.stock} un</span></td>
                          <td className="p-4 text-right flex justify-end gap-2">
                            <button onClick={() => setEditingProduct(p)} className="text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg flex items-center gap-1 font-bold text-xs transition-colors"><Edit3 size={14} /> Editar</button>
                            <button onClick={() => confirmDeleteProduct(p)} className="text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg flex items-center gap-1 font-bold text-xs transition-colors"><Trash2 size={14} /> Excluir</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL MOVIMENTAÇÃO */}
        {showCashMovementModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl animate-in zoom-in-95">
              <div className="flex justify-between items-center mb-6"><h3 className="font-bold text-xl text-slate-800">Nova Movimentação</h3><button onClick={() => setShowCashMovementModal(false)} className="hover:bg-slate-100 p-2 rounded-full transition-colors"><X size={20} className="text-slate-500" /></button></div>
              <div className="flex bg-slate-100 p-1.5 rounded-xl mb-6"><button onClick={() => setMovementType('suprimento')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${movementType === 'suprimento' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'}`}>Suprimento (Entrada)</button><button onClick={() => setMovementType('sangria')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${movementType === 'sangria' ? 'bg-red-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'}`}>Sangria (Saída)</button></div>
              <div className="mb-4"><label className="text-xs font-bold text-slate-500 uppercase block mb-2">Valor (R$)</label><input type="number" step="0.01" autoFocus value={movementValue} onChange={e => setMovementValue(e.target.value)} className="w-full p-4 border border-slate-300 rounded-xl text-xl font-black text-center outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="0.00" /></div>
              <div className="mb-8"><label className="text-xs font-bold text-slate-500 uppercase block mb-2">Descrição / Motivo</label><input type="text" value={movementDesc} onChange={e => setMovementDesc(e.target.value)} className="w-full p-4 border border-slate-300 rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-medium" placeholder="Ex: Troco inicial, pagamento fornecedor..." /></div>
              <button onClick={handleAddCashMovement} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-xl shadow-indigo-600/20 active:scale-95 text-lg">Confirmar Registro</button>
            </div>
          </div>
        )}

        {/* MODAL EDITAR PRODUTO */}
        {editingProduct && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center"><h3 className="text-xl font-bold text-slate-800">Editar Produto</h3><button onClick={() => setEditingProduct(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={20} /></button></div>
              <div className="p-6 space-y-5 bg-white">
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-2">Nome</label><input value={editingProduct.name} onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })} className="w-full p-3.5 border border-slate-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all font-bold text-slate-800" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-slate-500 uppercase mb-2">Preço (R$)</label><input type="number" step="0.01" value={editingProduct.price} onChange={(e) => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) })} className="w-full p-3.5 border border-slate-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all font-bold text-slate-800" /></div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Categoria</label>
                    <input type="text" list="edit-cat-list" value={editingProduct.category} onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })} className="w-full p-3.5 border border-slate-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all font-bold text-slate-800 bg-white" placeholder="Categoria" />
                    <datalist id="edit-cat-list">
                      {categories.map(c => <option key={c} value={c} />)}
                    </datalist>
                  </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200"><label className="block text-xs font-bold text-slate-500 uppercase mb-3 text-center">Quantidade em Estoque</label><div className="flex items-center justify-center gap-4"><button onClick={() => setEditingProduct({ ...editingProduct, stock: Math.max(0, editingProduct.stock - 1) })} className="w-12 h-12 flex items-center justify-center bg-white border border-slate-300 rounded-full hover:bg-slate-100 text-red-500 shadow-sm transition-all active:scale-90"><Minus size={20} /></button><input type="number" value={editingProduct.stock} onChange={(e) => setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value) || 0 })} className="w-24 p-3 border border-slate-300 bg-white rounded-xl focus:border-blue-500 outline-none text-center font-black text-xl" /><button onClick={() => setEditingProduct({ ...editingProduct, stock: editingProduct.stock + 1 })} className="w-12 h-12 flex items-center justify-center bg-white border border-slate-300 rounded-full hover:bg-slate-100 text-green-600 shadow-sm transition-all active:scale-90"><Plus size={20} /></button></div></div>
                <div className="pt-6 flex gap-3 border-t border-slate-100">
                  <button onClick={() => confirmDeleteProduct(editingProduct)} className="p-3.5 bg-red-50 text-red-600 font-bold hover:bg-red-100 rounded-xl transition-colors border border-red-100" title="Excluir Produto"><Trash2 size={20} /></button>
                  <button onClick={() => setEditingProduct(null)} className="flex-1 py-3.5 text-slate-600 bg-slate-100 font-bold hover:bg-slate-200 rounded-xl transition-colors">Cancelar</button>
                  <button onClick={handleUpdateProduct} className="flex-1 bg-blue-600 text-white py-3.5 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 active:scale-95">Salvar</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ABA HISTÓRICO RESTAURADA */}
        {view === 'history' && (
          <div className="p-8 h-screen overflow-y-auto bg-slate-50">
            <h1 className="text-3xl font-bold mb-8 text-slate-800 flex items-center gap-3"><History size={32} className="text-indigo-600" /> Histórico de Vendas</h1>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-6 flex gap-4">
              <input type="date" value={historyDate} onChange={e => setHistoryDate(e.target.value)} className="p-3 border border-slate-300 rounded-xl outline-none font-bold" />
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
                <input value={historySearch} onChange={e => setHistorySearch(e.target.value)} placeholder="Buscar cliente..." className="w-full bg-slate-50 pl-10 p-3 border border-slate-300 rounded-xl outline-none font-bold" />
              </div>
            </div>
            <div className="space-y-4">
              {historyOrders.map(order => (
                <div key={order.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center">
                  <div>
                    <div className="font-bold text-lg text-slate-800">{order.client}</div>
                    <div className="text-sm text-slate-500">{new Date(order.paidAt || order.date).toLocaleString('pt-BR')} • {order.method}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-xl text-blue-600">{formatMoney(order.total)}</div>
                    <button onClick={() => handlePrint(order, settings, 'customer')} className="mt-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1"><Printer size={14}/> Recibo</button>
                  </div>
                </div>
              ))}
              {historyOrders.length === 0 && <div className="text-center text-slate-500 py-10 font-medium">Nenhuma venda encontrada.</div>}
            </div>
          </div>
        )}

        {/* ABA CAIXA/FLUXO RESTAURADA */}
        {view === 'cash' && <CashControl user={user} orders={orders} />}

        {/* ABA CONFIGURAÇÕES RESTAURADA */}
        {view === 'settings' && (
          <div className="p-8 h-screen overflow-y-auto bg-slate-50">
            <header className="mb-8 flex justify-between items-center">
              <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3"><Settings size={32} className="text-slate-600" /> Configurações do Sistema</h1>
            </header>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 max-w-4xl">
              <h2 className="text-xl font-bold mb-6 text-slate-800 border-b pb-4">Dados da Loja</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Nome da Loja</label>
                  <input value={configForm.storeName || ''} onChange={e => setConfigForm({...configForm, storeName: e.target.value})} className="w-full p-4 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-800" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Telefone / WhatsApp</label>
                  <input value={configForm.phone || ''} onChange={e => setConfigForm({...configForm, phone: e.target.value})} className="w-full p-4 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-800" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Endereço Completo</label>
                  <input value={configForm.address || ''} onChange={e => setConfigForm({...configForm, address: e.target.value})} className="w-full p-4 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-800" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Documento (CNPJ/CPF)</label>
                  <input value={configForm.docId || ''} onChange={e => setConfigForm({...configForm, docId: e.target.value})} className="w-full p-4 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-800" />
                </div>
              </div>

              <h2 className="text-xl font-bold mb-6 text-slate-800 border-b pb-4">Segurança</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Senha do Gerente (POS)</label>
                  <input type="password" value={configForm.posPassword || ''} onChange={e => setConfigForm({...configForm, posPassword: e.target.value})} className="w-full p-4 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-800" placeholder="Padrão: 1234" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Senha de Configurações</label>
                  <input type="password" value={configForm.settingsPassword || ''} onChange={e => setConfigForm({...configForm, settingsPassword: e.target.value})} className="w-full p-4 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-800" placeholder="Padrão: 1234" />
                </div>
              </div>

              <div className="flex flex-col md:flex-row justify-between items-center pt-6 border-t border-slate-100 gap-4">
                <div className="flex gap-2 w-full md:w-auto flex-col md:flex-row">
                  <button onClick={factoryResetSales} className="bg-red-50 text-red-600 hover:bg-red-100 px-6 py-4 rounded-xl font-bold flex items-center gap-2 transition-all w-full md:w-auto justify-center"><RotateCcw size={20} /> Zerar Vendas</button>
                  <button onClick={factoryResetProducts} className="bg-red-50 text-red-600 hover:bg-red-100 px-6 py-4 rounded-xl font-bold flex items-center gap-2 transition-all w-full md:w-auto justify-center"><Trash2 size={20} /> Zerar Produtos</button>
                </div>
                <button onClick={saveSettings} className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-xl font-bold shadow-lg shadow-blue-600/20 active:scale-95 transition-all text-lg flex items-center gap-2 w-full md:w-auto justify-center"><Save size={20} /> Salvar Configurações</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

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
      setAdminPasswordInput('');
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
            <button onClick={() => { setInitialRole('Garçom / Cliente'); setRole('mobile'); }} className="w-full flex items-center p-5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-2xl transition-all group"><div className="bg-indigo-500 text-white p-3 rounded-xl mr-4"><MonitorSmartphone size={24} /></div><div className="text-left flex-1 font-bold text-indigo-900 text-lg">Cardápio do Cliente</div><ChevronRight className="text-indigo-400" /></button>
            <button onClick={() => { setShowAdminAuth(true); setAdminPasswordInput(''); setAdminError(''); }} className="w-full flex items-center p-5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl shadow-lg group"><div className="bg-blue-500 text-white p-3 rounded-xl mr-4"><LayoutDashboard size={24} /></div><div className="text-left flex-1 font-bold text-lg">Painel Administrativo</div><ChevronRight className="text-slate-500" /></button>
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
      {role === 'mobile' && <MobileView user={user} initialRole={initialRole} onBack={() => setRole(null)} settings={settings} />}
      {role === 'pos' && <PosView user={user} initialRole={initialRole} onBack={() => setRole(null)} initialSettings={settings} />}
    </>
  );
}
