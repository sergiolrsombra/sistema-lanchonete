```react
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShoppingCart, User, ChevronLeft, Minus, Plus,
  CheckCircle, Search, ChefHat, Users, LayoutDashboard,
  Trash2, Package, DollarSign, X, Coffee, Sandwich, ClipboardList,
  Wallet, TrendingUp, LogOut, Edit3, Calendar, ChevronRight, Coins,
  ArrowDownCircle, ArrowUpCircle, Save, Lock, Unlock, AlertCircle, PlusCircle,
  AlertTriangle, Loader2, ListPlus, Banknote, RotateCcw, History,
  Clock, ArrowRightLeft, Store, MonitorSmartphone, Cake, Phone,
  CheckSquare, Printer, Settings, MessageCircle, AlertOctagon, Sparkles, Maximize,
  CheckCircle2, UserCircle2
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
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
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

// Categorias que abrem o modal de inclusão de porções
const BASE_CATEGORIES_FOR_ADDONS = ['Tapiocas', 'Cuscuz', 'Pão'];

// --- HELPERS E COMPONENTES COMPARTILHADOS ---
const formatMoney = (val) => {
  const n = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(n)) return 'R$ 0,00';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// Função blindada para pegar a data local (resolve o problema do fuso horário)
const getLocalYMD = (dateStr) => {
  if (!dateStr) return '';
  if (typeof dateStr === 'string' && dateStr.length === 10 && !dateStr.includes('T')) {
    return dateStr;
  }
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr).split('T')[0];
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  } catch (e) {
    return String(dateStr).split('T')[0];
  }
};

const formatDate = (dateStr) => {
  if (!dateStr) return '--/--';
  const localStr = getLocalYMD(dateStr);
  const parts = localStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
  return localStr;
};

const getTodayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getWeekId = (dateInput) => {
  if (!dateInput) return 'sem-data';
  try {
    const localYMD = getLocalYMD(dateInput);
    const [y, m, d] = localYMD.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d, 12, 0, 0); 
    const start = new Date(dateObj.getFullYear(), 0, 1);
    const week = Math.ceil((((dateObj.getTime() - start.getTime()) / 86400000) + start.getDay() + 1) / 7) || 1;
    return `${dateObj.getFullYear()}-W${String(week).padStart(2, '0')}`;
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
      itemsHtml += `<div style="margin-top: 4px; border-bottom: 1px dashed #000; font-weight: 900; font-size: 13px; padding-bottom: 2px;">👤 ${guest}</div>`;
    }
    
    groupedItems[guest].forEach(i => {
      itemsHtml += `
        <div style="display: flex; justify-content: space-between; margin-bottom: 1px; margin-top: 2px; font-size: 12px; font-weight: 700;">
          <span>${i.qty}x ${i.name}</span>
          ${type === 'customer' ? `<span>${formatMoney(calcItemTotal(i))}</span>` : ''}
        </div>
      `;
      i.subItems?.forEach(sub => {
        // Removido o tom de cinza (#333) e forçado o preto (#000) e negrito para sair forte na térmica
        itemsHtml += `<div style="margin-left: 8px; font-size: 11px; color: #000; font-weight: 700;">+ ${sub.qty * i.qty}x ${sub.name}</div>`;
      });
      if (i.obs) {
        itemsHtml += `<div style="margin-left: 8px; font-size: 11px; font-style: italic; font-weight: 900;">Obs: ${i.obs}</div>`;
      }
    });
  });

  const content = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${type === 'customer' ? 'Recibo' : 'Ticket Cozinha'}</title>
        <style>
          @page { margin: 0; } 
          html, body { margin: 0; padding: 0; background: #fff; height: fit-content; }
          body { 
            font-family: Arial, Helvetica, sans-serif;
            width: 76mm; 
            padding: 2mm 2mm 5mm 2mm; 
            color: #000 !important; 
            line-height: 1.2; 
            font-size: 12px; 
            font-weight: 700;
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact;
          }
          .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 4px; margin-bottom: 4px; }
          .footer { text-align: center; border-top: 2px dashed #000; padding-top: 4px; margin-top: 6px; font-size: 11px; padding-bottom: 8mm; font-weight: 700; }
          .bold { font-weight: 900; } /* Preto ultra forte */
          .total-box { border-top: 2px solid #000; margin-top: 6px; padding-top: 4px; }
          .flex-between { display: flex; justify-content: space-between; margin-bottom: 2px; }
          .text-lg { font-size: 15px; font-weight: 900; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2 style="margin: 0; font-size: 18px; font-weight: 900;">${storeName}</h2>
          ${type === 'customer' ? `<p style="margin: 2px 0 0 0; font-size: 11px; font-weight: 700;">${storeAddress}<br/>Tel: ${storePhone}</p>` : '<h2 style="margin: 2px 0 0 0; font-weight: 900;">TICKET COZINHA</h2>'}
        </div>
        
        <div style="margin-bottom: 6px; font-size: 12px;">
          <div class="flex-between"><span class="bold">Pedido:</span> <span>#${order.id || 'N/A'}</span></div>
          <div class="flex-between"><span class="bold">Cliente:</span> <span>${order.client}</span></div>
          <div class="flex-between"><span class="bold">Data:</span> <span>${new Date(order.paidAt || order.date).toLocaleString('pt-BR')}</span></div>
        </div>

        <div style="border-top: 2px dashed #000; padding-top: 6px; margin-bottom: 6px;">
          ${itemsHtml}
        </div>

        ${type === 'customer' ? `
          <div class="total-box">
            <div class="flex-between bold text-lg"><span>TOTAL:</span><span>${formatMoney(order.total)}</span></div>
            <div class="flex-between mt-2" style="font-weight: 700;"><span>PAGAMENTO:</span><span>${order.method || 'Dinheiro'}</span></div>
            ${order.receivedValue ? `<div class="flex-between" style="font-weight: 700;"><span>RECEBIDO:</span><span>${formatMoney(order.receivedValue)}</span></div>` : ''}
            ${order.changeValue ? `<div class="flex-between" style="font-weight: 700;"><span>TROCO:</span><span>${formatMoney(order.changeValue)}</span></div>` : ''}
          </div>
        ` : ''}

        <div class="footer">
          <p style="margin:0;">${type === 'customer' ? 'Obrigado pela preferência!' : '--- FIM DO PEDIDO ---'}</p>
        </div>
        <script>
          window.onload = function() { 
            setTimeout(function() {
              window.print(); 
              window.close(); 
            }, 500);
          }
        </script>
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
    {type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
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
    const dailyOrders = orders.filter(o => o?.paymentStatus === 'PAGO' && getLocalYMD(o.paidAt || o.date) === date);
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
        
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 hide-scrollbar">
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
                          <td className="p-3 font-medium whitespace-nowrap">{formatDate(r.date)}</td>
                          <td className="p-3 text-right text-slate-600 whitespace-nowrap">{formatMoney(r.pix)}</td>
                          <td className="p-3 text-right text-slate-600 whitespace-nowrap">{formatMoney(r.cash)}</td>
                          <td className="p-3 text-right text-slate-600 whitespace-nowrap">{formatMoney(r.card)}</td>
                          <td className="p-3 text-right font-bold text-blue-700 whitespace-nowrap">{formatMoney(r.total)}</td>
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
               <span className="text-xl font-bold uppercase tracking-wider text-slate-300 text-center md:text-left">Total Geral Apurado no Caixa</span>
               <span className="text-4xl md:text-5xl font-black text-emerald-400">{formatMoney(calculateCashTotal.grandTotal)}</span>
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

  const [addonModalConfig, setAddonModalConfig] = useState({ isOpen: false, baseItem: null, addons: {} });

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
    if (!customerName.trim()) {
      showToastMsg("Por favor, digite seu nome.", "error");
      return;
    }
    setView('menu');
  };
  
  const addToCart = (p) => {
    if (p.stock <= 0) { showToastMsg("Sem estoque!", "error"); return; }
    
    if (BASE_CATEGORIES_FOR_ADDONS.includes(p.category)) {
      setAddonModalConfig({ isOpen: true, baseItem: p, addons: {} });
      return;
    }

    const currentGuestName = 'Pessoa 1';
    const ex = cart.find(i => (String(i.id) === String(p.id) || (i.firestoreId && i.firestoreId === p.firestoreId)) && (i.guest || 'Pessoa 1') === currentGuestName && (!i.subItems || i.subItems.length === 0));
    
    if (ex) {
      setCart(cart.map(i => i.cartItemId === ex.cartItemId ? { ...i, qty: i.qty + 1 } : i));
      showToastMsg(`${p.name} quantidade aumentada!`);
    } else {
      setCart([...cart, { ...p, cartItemId: Date.now().toString() + Math.random().toString(), qty: 1, obs: '', subItems: [], guest: currentGuestName }]);
      showToastMsg(`${p.name} adicionado ao pedido!`);
    }
  };

  const handleAddonChange = (addonId, change) => {
    setAddonModalConfig(prev => {
      const currentQty = prev.addons[addonId] || 0;
      const newQty = Math.max(0, currentQty + change);
      return { ...prev, addons: { ...prev.addons, [addonId]: newQty } };
    });
  };

  const calculateModalTotal = () => {
    if (!addonModalConfig.baseItem) return 0;
    let total = Number(addonModalConfig.baseItem.price);
    Object.entries(addonModalConfig.addons).forEach(([addonId, qty]) => {
      if (qty > 0) {
        const p = products.find(prod => String(prod.id) === String(addonId));
        if (p) total += Number(p.price) * qty;
      }
    });
    return total;
  };

  const confirmAddonModal = () => {
    const { baseItem, addons } = addonModalConfig;
    if (!baseItem) return;

    let newSubItems = [];
    Object.entries(addons).forEach(([addonId, qty]) => {
      if (qty > 0) {
        const addonProduct = products.find(p => String(p.id) === String(addonId));
        if (addonProduct) {
          newSubItems.push({ ...addonProduct, qty });
        }
      }
    });

    const newItem = {
      ...baseItem,
      cartItemId: Date.now().toString() + Math.random().toString(),
      qty: 1,
      obs: '',
      subItems: newSubItems,
      guest: 'Pessoa 1'
    };

    setCart([...cart, newItem]);
    setAddonModalConfig({ isOpen: false, baseItem: null, addons: {} });
    showToastMsg(`${baseItem.name} montado com sucesso!`);
  };

  const incrementQty = (cartItemId) => { setCart(cart.map(i => i.cartItemId === cartItemId ? { ...i, qty: i.qty + 1 } : i)); };
  const removeFromCart = (cartItemId) => {
    const ex = cart.find(i => i.cartItemId === cartItemId);
    if (!ex) return;
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
    if (!parent) return;
    const subItem = parent.subItems?.find(s => String(s.id) === String(subItemId));
    if (!subItem) return;
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

      const cartWithStatus = cart.map(item => ({ ...item, kitchenStatus: item.kitchenStatus || 'Pendente' }));

      const ordersSnap = await getDocs(query(getCollectionRef('orders')));
      const existingDoc = ordersSnap.docs.find(d => {
        const data = d.data();
        return data.paymentStatus === 'ABERTO' && data.client?.toLowerCase().trim() === customerName?.toLowerCase().trim();
      });

      let msg = '';

      if (existingDoc) {
        const existingData = existingDoc.data();
        const updatedItems = [...(existingData.items || []), ...cartWithStatus];
        await updateDoc(getDocRef('orders', existingDoc.id), {
          items: updatedItems,
          total: (existingData.total || 0) + getCartTotal(),
          kitchenStatus: updatedItems.some(i => i.kitchenStatus === 'Pendente') ? 'Pendente' : 'Pronto',
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
          kitchenStatus: cartWithStatus.some(i => i.kitchenStatus === 'Pendente') ? 'Pendente' : 'Pronto', 
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
    <div className="min-h-screen bg-slate-100 pb-6 font-sans w-full lg:max-w-md mx-auto lg:shadow-2xl relative lg:border-x border-slate-200 animate-in fade-in">
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
                <button key={p.id} onClick={() => addToCart(p)} disabled={p.stock <= 0} className={`bg-white p-3 rounded-2xl shadow-sm border flex flex-col items-center text-center gap-2 transition-all active:scale-95 ${qty > 0 ? 'border-blue-500 bg-blue-50/30' : 'border-slate-100'} ${p.stock <= 0 ? 'opacity-50' : ''}`}>
                  <div className="bg-slate-100 p-4 rounded-full mb-1"><IconMapper type={p.icon} className="w-8 h-8 text-slate-700" /></div>
                  <div className="flex-1 w-full"><div className="font-bold text-sm leading-tight mb-1 truncate px-1 text-slate-800">{p.name}</div><div className="text-sm font-bold text-blue-600">R$ {p.price.toFixed(2)}</div></div>
                  {p.stock > 0 ? (
                    <div className="w-full mt-1">
                      <div className="w-full py-2 bg-slate-900 text-white text-sm font-bold rounded-lg shadow-sm hover:bg-slate-800 transition-transform">{qty > 0 ? `Adicionado (${qty})` : 'Adicionar'}</div>
                    </div>
                  ) : (<span className="text-xs font-bold text-red-400 mt-2 block w-full py-2 bg-red-50 rounded-lg">Esgotado</span>)}
                </button>
              )
            })}
          </div>

          {count > 0 && (
            <div className="px-4 pb-6 pt-2 w-full animate-in fade-in">
              <button onClick={() => setView('cart')} className="w-full bg-slate-900 text-white p-4 rounded-2xl shadow-xl flex justify-between items-center hover:bg-slate-800 transition-colors active:scale-95 border border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="bg-white text-slate-900 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">{count}</div>
                  <span className="font-bold">Ver Carrinho</span>
                </div>
                <span className="font-bold text-lg">R$ {total.toFixed(2)}</span>
              </button>
            </div>
          )}
        </div>
      )}
      
      {/* MODAL DE ADICIONAIS (CLIENTE) */}
      {addonModalConfig.isOpen && addonModalConfig.baseItem && (
        <div className="fixed inset-0 bg-black/60 z-[300] flex items-end lg:items-center justify-center p-0 lg:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full lg:max-w-md lg:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-full lg:zoom-in-95">
             <div className="p-4 lg:p-6 border-b flex justify-between items-center bg-slate-50 lg:rounded-t-3xl rounded-t-3xl">
               <div>
                 <h3 className="font-bold text-xl text-slate-800">Monte: {addonModalConfig.baseItem.name}</h3>
                 <p className="text-sm font-bold text-blue-600">{formatMoney(addonModalConfig.baseItem.price)}</p>
               </div>
               <button onClick={() => setAddonModalConfig({isOpen:false, baseItem:null, addons:{}})} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><X size={20}/></button>
             </div>

             <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-3">
               <h4 className="font-black text-slate-400 text-xs uppercase tracking-wider mb-2">Escolha seus adicionais</h4>
               {products.filter(p => p.category === 'Adicionais').map(addon => {
                 const qty = addonModalConfig.addons[addon.id] || 0;
                 return (
                   <div key={addon.id} className={`flex justify-between items-center border-2 rounded-2xl p-3 shadow-sm transition-all ${qty > 0 ? 'border-blue-500 bg-blue-50/50' : 'bg-white border-slate-100'}`}>
                     <div>
                       <div className="font-bold text-slate-800 text-sm">{addon.name}</div>
                       <div className="text-xs font-bold text-slate-500">+ {formatMoney(addon.price)}</div>
                     </div>
                     <div className="flex items-center gap-3 bg-slate-100 p-1 rounded-xl">
                       <button onClick={() => handleAddonChange(addon.id, -1)} className="w-8 h-8 flex items-center justify-center bg-white text-slate-600 rounded-lg shadow-sm hover:text-red-500 disabled:opacity-30" disabled={qty === 0}><Minus size={16}/></button>
                       <span className="font-black text-slate-800 w-4 text-center">{qty}</span>
                       <button onClick={() => handleAddonChange(addon.id, 1)} className="w-8 h-8 flex items-center justify-center bg-white text-slate-600 rounded-lg shadow-sm hover:text-green-600"><Plus size={16}/></button>
                     </div>
                   </div>
                 )
               })}
               {products.filter(p => p.category === 'Adicionais').length === 0 && (
                 <div className="text-center text-sm font-medium text-slate-400 py-6">Nenhum adicional cadastrado.</div>
               )}
             </div>

             <div className="p-4 lg:p-6 border-t bg-white lg:rounded-b-3xl">
                <button onClick={confirmAddonModal} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg shadow-lg hover:bg-indigo-700 active:scale-95 transition-all flex justify-between px-6 items-center">
                  <span>Confirmar & Adicionar</span>
                  <span className="bg-indigo-800/50 px-3 py-1 rounded-lg">{formatMoney(calculateModalTotal())}</span>
                </button>
             </div>
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
                    <button aria-label="Diminuir quantidade" onClick={() => removeFromCart(item.cartItemId)} className="w-7 h-7 flex items-center justify-center bg-red-50 text-red-500 rounded hover:bg-red-100 active:scale-95 transition-all">-</button>
                    <button aria-label="Aumentar quantidade" onClick={() => incrementQty(item.cartItemId)} className="w-7 h-7 flex items-center justify-center bg-green-50 text-green-600 rounded hover:bg-green-100 active:scale-95 transition-all">+</button>
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
    </div>
  );
};

// --------------------------------------------------------------------------------
// COMPONENTE: PAINEL ADMINISTRATIVO (POS)
// --------------------------------------------------------------------------------
const PosView = ({ user, initialRole, onBack, initialSettings }) => {
  const [activeTab, setActiveTab] = useState('caixa');
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState(initialSettings || {});
  const [toast, setToast] = useState(null);
  const [confirmState, setConfirmState] = useState({ isOpen: false, msg: '', action: null });

  // --- Estado do modal de senha de gerência para deletar pedido ---
  const [deleteAuthModal, setDeleteAuthModal] = useState({ isOpen: false, orderId: null, orderFsId: null });
  const [deletePasswordInput, setDeletePasswordInput] = useState('');
  const [deletePasswordError, setDeletePasswordError] = useState('');

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    if (!user) return;
    const unsubOrders = onSnapshot(query(getCollectionRef('orders')), (snap) => {
      setOrders(snap.docs.map(d => ({ firestoreId: d.id, ...d.data() })));
    });
    const unsubProducts = onSnapshot(query(getCollectionRef('products')), (snap) => {
      setProducts(snap.docs.map(d => ({ firestoreId: d.id, ...d.data() })));
    });
    const unsubSettings = onSnapshot(getDocRef('app_state', 'settings'), (snap) => {
      if (snap.exists()) setSettings(snap.data());
    });
    return () => { unsubOrders(); unsubProducts(); unsubSettings(); };
  }, [user]);

  // Pedidos pagos ordenados do mais recente para o mais antigo
  const paidOrders = useMemo(() =>
    orders
      .filter(o => o.paymentStatus === 'PAGO')
      .sort((a, b) => new Date(b.paidAt || b.date) - new Date(a.paidAt || a.date)),
    [orders]
  );

  // Abre o modal pedindo senha antes de deletar
  const handleDeleteOrderClick = (order) => {
    setDeletePasswordInput('');
    setDeletePasswordError('');
    setDeleteAuthModal({ isOpen: true, orderId: order.id, orderFsId: order.firestoreId });
  };

  // Valida a senha e, se correta, abre o ConfirmDialog
  const handleDeletePasswordConfirm = () => {
    const currentPass = settings?.posPassword || '1234';
    if (deletePasswordInput.trim() !== currentPass.trim()) {
      setDeletePasswordError('Senha incorreta.');
      return;
    }
    const { orderFsId, orderId } = deleteAuthModal;
    setDeleteAuthModal({ isOpen: false, orderId: null, orderFsId: null });
    setConfirmState({
      isOpen: true,
      msg: `Excluir o pedido #${orderId} permanentemente? Esta ação não pode ser desfeita.`,
      action: async () => {
        try {
          await deleteDoc(getDocRef('orders', orderFsId));
          setConfirmState({ isOpen: false, msg: '', action: null });
          showToast('Pedido excluído com sucesso!', 'success');
        } catch (e) {
          setConfirmState({ isOpen: false, msg: '', action: null });
          showToast('Erro ao excluir pedido.', 'error');
        }
      }
    });
  };

  const tabs = [
    { id: 'caixa', label: 'Caixa', icon: <ShoppingCart size={16} /> },
    { id: 'historico', label: 'Histórico', icon: <History size={16} /> },
    { id: 'estoque', label: 'Estoque', icon: <Package size={16} /> },
    { id: 'fluxo', label: 'Fluxo', icon: <TrendingUp size={16} /> },
  ];

  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmDialog
        isOpen={confirmState.isOpen}
        message={confirmState.msg}
        onConfirm={confirmState.action}
        onCancel={() => setConfirmState({ isOpen: false, msg: '', action: null })}
      />

      {/* MODAL DE SENHA PARA DELETAR */}
      {deleteAuthModal.isOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border-t-4 border-red-600 animate-in zoom-in-95">
            <div className="flex justify-center mb-4">
              <div className="bg-red-50 p-4 rounded-full text-red-600"><Lock size={36} /></div>
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-1 text-center">Confirmar Exclusão</h3>
            <p className="text-sm text-slate-500 mb-2 text-center">Pedido <span className="font-bold text-slate-800">#{deleteAuthModal.orderId}</span></p>
            <p className="text-xs text-slate-400 mb-5 text-center">Digite a senha de gerência para continuar.</p>
            <input
              type="password"
              autoFocus
              placeholder="Senha de gerência"
              className="w-full border-2 p-4 rounded-xl text-center text-xl font-bold outline-none focus:border-red-500 transition-all mb-2"
              value={deletePasswordInput}
              onChange={(e) => { setDeletePasswordInput(e.target.value); setDeletePasswordError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleDeletePasswordConfirm()}
            />
            {deletePasswordError && (
              <p className="text-red-500 text-sm font-bold text-center mb-2">{deletePasswordError}</p>
            )}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setDeleteAuthModal({ isOpen: false, orderId: null, orderFsId: null })}
                className="flex-1 py-3.5 text-slate-500 bg-slate-100 font-bold rounded-xl hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeletePasswordConfirm}
                className="flex-1 bg-red-600 text-white py-3.5 rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-500/20"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="bg-slate-900 text-white p-4 flex justify-between items-center shadow-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 hover:bg-slate-800 rounded-full transition-colors"><ChevronLeft size={20} /></button>
          <div>
            <div className="font-black text-sm leading-tight">{settings?.storeName || 'Painel'}</div>
            <div className="text-xs text-slate-400">{initialRole}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-300">{new Date().toLocaleDateString('pt-BR')}</div>
        </div>
      </div>

      {/* TABS */}
      <div className="bg-white border-b shadow-sm px-4 overflow-x-auto">
        <div className="flex gap-1 hide-scrollbar min-w-max">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3.5 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 max-w-5xl mx-auto pb-20">

        {/* ABA: CAIXA (pedidos abertos) */}
        {activeTab === 'caixa' && (
          <div className="space-y-3 animate-in fade-in">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><ShoppingCart size={20} className="text-blue-600" /> Pedidos em Aberto</h2>
            {orders.filter(o => o.paymentStatus === 'ABERTO').length === 0 && (
              <div className="bg-white rounded-2xl p-10 text-center text-slate-400 font-medium shadow-sm border">Nenhum pedido em aberto.</div>
            )}
            {orders.filter(o => o.paymentStatus === 'ABERTO').sort((a, b) => new Date(a.date) - new Date(b.date)).map(order => (
              <div key={order.firestoreId} className="bg-white rounded-2xl shadow-sm border p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="font-black text-slate-800 text-lg">#{order.id}</span>
                    <span className="ml-2 font-bold text-slate-600">{order.client}</span>
                  </div>
                  <span className="text-xs bg-amber-100 text-amber-700 font-bold px-2 py-1 rounded-full">{order.orderType || 'Local'}</span>
                </div>
                <div className="space-y-1 mb-3">
                  {order.items?.map((item, idx) => (
                    <div key={idx} className="text-sm text-slate-600 flex justify-between">
                      <span>{item.qty}x {item.name}</span>
                      <span className="font-medium">{formatMoney(calcItemTotal(item))}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center border-t pt-3">
                  <span className="font-black text-blue-700 text-lg">{formatMoney(order.total)}</span>
                  <div className="flex gap-2">
                    <button onClick={() => handlePrint(order, settings, 'kitchen')} className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors" title="Imprimir cozinha"><Printer size={16} /></button>
                    <button
                      onClick={async () => {
                        await updateDoc(getDocRef('orders', order.firestoreId), { paymentStatus: 'PAGO', paidAt: new Date().toISOString() });
                        showToast('Pedido marcado como pago!');
                      }}
                      className="px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                    >
                      Marcar Pago
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ABA: HISTÓRICO DE VENDAS */}
        {activeTab === 'historico' && (
          <div className="animate-in fade-in">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <History size={20} className="text-blue-600" /> Histórico de Vendas
              <span className="ml-auto text-sm font-medium text-slate-400">{paidOrders.length} pedido(s)</span>
            </h2>

            {paidOrders.length === 0 && (
              <div className="bg-white rounded-2xl p-10 text-center text-slate-400 font-medium shadow-sm border">Nenhuma venda registrada.</div>
            )}

            <div className="space-y-3">
              {paidOrders.map(order => (
                <div key={order.firestoreId} className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                  {/* Cabeçalho do pedido */}
                  <div className="flex items-center justify-between p-4 border-b bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div className="bg-green-100 text-green-700 p-2 rounded-xl">
                        <CheckCircle2 size={18} />
                      </div>
                      <div>
                        <div className="font-black text-slate-800">#{order.id} — {order.client}</div>
                        <div className="text-xs text-slate-500 font-medium">
                          {order.paidAt
                            ? new Date(order.paidAt).toLocaleString('pt-BR')
                            : formatDate(order.date)}
                          {order.method && <span className="ml-2 bg-slate-200 px-1.5 py-0.5 rounded text-slate-600">{order.method}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-green-700 text-lg">{formatMoney(order.total)}</span>
                      {/* BOTÃO DE DELETAR — só para pedidos PAGO */}
                      <button
                        onClick={() => handleDeleteOrderClick(order)}
                        className="p-2 bg-red-50 text-red-400 rounded-xl hover:bg-red-100 hover:text-red-600 transition-all active:scale-95"
                        title="Excluir pedido (requer senha de gerência)"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  {/* Itens */}
                  <div className="p-4 space-y-1">
                    {order.items?.map((item, idx) => (
                      <div key={idx} className="text-sm text-slate-600 flex justify-between">
                        <span>{item.qty}x {item.name}</span>
                        <span className="font-medium text-slate-700">{formatMoney(calcItemTotal(item))}</span>
                      </div>
                    ))}
                  </div>
                  {/* Rodapé com ações */}
                  <div className="px-4 pb-4 flex gap-2 justify-end border-t pt-3">
                    <button onClick={() => handlePrint(order, settings, 'customer')} className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-200 transition-colors">
                      <Printer size={14} /> Recibo
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ABA: ESTOQUE */}
        {activeTab === 'estoque' && (
          <div className="animate-in fade-in">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Package size={20} className="text-blue-600" /> Estoque de Produtos</h2>
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase border-b">
                  <tr>
                    <th className="p-3 text-left">Produto</th>
                    <th className="p-3 text-left">Categoria</th>
                    <th className="p-3 text-right">Preço</th>
                    <th className="p-3 text-right">Estoque</th>
                  </tr>
                </thead>
                <tbody>
                  {products.sort((a, b) => a.id - b.id).map(p => (
                    <tr key={p.firestoreId} className="border-b last:border-none hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-medium text-slate-800">{p.name}</td>
                      <td className="p-3 text-slate-500">{p.category}</td>
                      <td className="p-3 text-right font-bold text-blue-700">{formatMoney(p.price)}</td>
                      <td className="p-3 text-right">
                        <span className={`font-black px-2 py-0.5 rounded-full text-xs ${p.stock <= 5 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {p.stock}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ABA: FLUXO DE CAIXA */}
        {activeTab === 'fluxo' && (
          <CashControl user={user} orders={orders} />
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
    if (adminPasswordInput.trim() === currentPass.trim()) {
      setInitialRole('Gerência');
      setRole('pos');
      setShowAdminAuth(false);
      setAdminPasswordInput('');
    } else { setAdminError('Senha incorreta.'); }
  };

  useEffect(() => {
    // --- CORREÇÃO DE TELA ESTICADA NO MOBILE ---
    let viewport = document.querySelector("meta[name=viewport]");
    if (!viewport) {
        viewport = document.createElement("meta");
        viewport.name = "viewport";
        document.head.appendChild(viewport);
    }
    viewport.content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";
    // -------------------------------------------

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


```
