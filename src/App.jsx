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
// Adicione esta linha no topo para definir um ID fixo para a loja
const STORE_ID = "loja-joseane-sombra-v1";
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from "firebase/auth";
import { getFirestore, collection, addDoc, onSnapshot, query, doc, updateDoc, deleteDoc, setDoc, getDoc, Timestamp, writeBatch } from "firebase/firestore";

// --- CONFIGURAÇÃO DO FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyAzaNVsJsB4vFMNW1WG1MQbdQDYoDnmduA",
  authDomain: "lanchonete-6b915.firebaseapp.com",
  projectId: "lanchonete-6b915",
  storageBucket: "lanchonete-6b915.firebasestorage.app",
  messagingSenderId: "894517269506",
  appId: "1:894517269506:web:3c25cf6a65cb4d4687831b"
};

// Inicializar o Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'lanchonete-joseane-sombra';

// --- CONFIGURAÇÃO GEMINI API ---
const apiKey = ""; // A chave será injetada pelo ambiente

const callGemini = async (prompt) => {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Erro API: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "Não foi possível gerar resposta.";
  } catch (error) {
    console.error("Erro Gemini:", error);
    return null;
  }
};

// --- DADOS PADRÃO (SEED) ---
const DEFAULT_PRODUCTS_SEED = [
  { id: 1, name: 'Bolo de Pote (Chocolate)', price: 12.00, category: 'Sobremesas', stock: 20, icon: 'dessert' },
  { id: 2, name: 'Torta de Frango', price: 15.00, category: 'Salgados', stock: 15, icon: 'burger' },
  { id: 3, name: 'Tapioca Mista', price: 18.00, category: 'Lanches', stock: 50, icon: 'burger' },
  { id: 4, name: 'Suco de Laranja', price: 10.00, category: 'Bebidas', stock: 30, icon: 'drink' },
  { id: 5, name: 'Café Expresso', price: 5.00, category: 'Bebidas', stock: 100, icon: 'drink' },
  { id: 6, name: 'Bolo Vulcão (Encomenda)', price: 65.00, category: 'Sobremesas', stock: 5, icon: 'dessert' },
];

const CATEGORIES = ['Lanches', 'Salgados', 'Bebidas', 'Sobremesas', 'Bolos'];
const MESAS = Array.from({ length: 15 }, (_, i) => `Mesa ${String(i + 1).padStart(2, '0')}`);

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
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getWeekId = (dateStr) => {
  if (!dateStr) return 'sem-data';
  try {
    const d = new Date(dateStr + 'T12:00:00');
    const onejan = new Date(d.getFullYear(), 0, 1);
    const millis = d.getTime() - onejan.getTime();
    const week = Math.ceil((((millis / 86400000) + onejan.getDay() + 1) / 7));
    return `${d.getFullYear()}-W${week.toString().padStart(2, '0')}`;
  } catch (e) {
    return 'erro-data';
  }
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

const printOrder = (order, settings) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert("Por favor, permita popups para imprimir.");
    return;
  }

  const remaining = order.total - (order.signal || 0);
  const storeName = settings?.storeName || "Confeitaria & Café";
  const storePhone = settings?.phone || "";
  const docId = settings?.docId || settings?.cnpj || "";
  const docType = settings?.docType || "";

  const itemsHtml = order.description
    ? `<div class="obs-box" style="margin-top:0; border:none; padding:0; background:none;">${order.description.replace(/\n/g, '<br/>')}</div>`
    : '<p style="text-align:center; font-style:italic;">Sem descrição detalhada</p>';

  printWindow.document.write(`
    <html>
      <head>
        <title>Pedido - ${order.client}</title>
        <style>
          body { font-family: 'Courier New', monospace; padding: 20px; max-width: 350px; margin: 0 auto; color: #000; }
          .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 15px; margin-bottom: 15px; }
          .header h2 { margin: 0 0 5px 0; font-size: 1.5em; text-transform: uppercase; }
          .header p { margin: 0; font-size: 0.9em; }
          .info { margin-bottom: 15px; font-size: 0.9em; }
          .info p { margin: 3px 0; }
          .section-title { font-weight: bold; border-bottom: 1px solid #000; margin: 10px 0 5px 0; font-size: 0.9em; }
          .totals { margin-top: 15px; border-top: 2px dashed #000; padding-top: 10px; }
          .total-row { display: flex; justify-content: space-between; margin-bottom: 5px; font-weight: bold; font-size: 1em; }
          .footer { margin-top: 30px; text-align: center; font-size: 0.75em; border-top: 1px dotted #000; padding-top: 10px; }
          @media print {
             .no-print { display: none; }
             body { -webkit-print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>${storeName}</h2>
          <p>Joseane Sombra</p>
          <p>Comprovante de Encomenda</p>
          ${storePhone ? `<p>Tel: ${storePhone}</p>` : ''}
          ${docId ? `<p>${docType || 'Doc'}: ${docId}</p>` : ''}
        </div>
        
        <div class="info">
          <p><strong>Cliente:</strong> ${order.client}</p>
          <p><strong>Telefone:</strong> ${order.phone || 'Não informado'}</p>
          <p><strong>Entrega:</strong> ${formatDate(order.deliveryDate)} às ${order.deliveryTime}</p>
          <p><strong>Status:</strong> ${order.status.toUpperCase()}</p>
        </div>

        <div class="section-title">DESCRIÇÃO</div>
        ${itemsHtml}

        <div class="totals">
          <div class="total-row"><span>TOTAL</span><span>${formatMoney(order.total)}</span></div>
          <div class="total-row" style="font-weight: normal; font-size: 0.9em;"><span>Sinal (${order.signalMethod || '-'})</span><span>- ${formatMoney(order.signal || 0)}</span></div>
          <div class="total-row" style="font-size: 1.2em; margin-top: 5px;"><span>A PAGAR</span><span>${formatMoney(remaining)}</span></div>
        </div>

        <div class="footer">
          <p>Documento gerado em ${new Date().toLocaleString('pt-BR')}</p>
          <p>Agradecemos a preferência!</p>
        </div>
        
        <script>
           window.onload = function() { window.print(); }
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

// --------------------------------------------------------------------------------
// COMPONENTE: FLUXO DE CAIXA
// --------------------------------------------------------------------------------
const CashControl = ({ user, orders }) => {
  const [records, setRecords] = useState([]);
  const [closedWeeks, setClosedWeeks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [currentView, setCurrentView] = useState('entry');
  const [cashCounts, setCashCounts] = useState({ bills: { 200: '', 100: '', 50: '', 20: '', 10: '', 5: '', 2: '' }, coins: { 1: '', 0.50: '', 0.25: '', 0.10: '', 0.05: '' }, pix: '' });
  const cashCalculatorRefs = useRef({});
  const isCalculatorLoaded = useRef(false);
  const [date, setDate] = useState(getTodayStr());
  const [pix, setPix] = useState('');
  const [cash, setCash] = useState('');
  const [card, setCard] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pixRef = useRef(null); const cashRef = useRef(null); const cardRef = useRef(null);

  const calculatorOrder = ['bill-200', 'bill-100', 'bill-50', 'bill-20', 'bill-10', 'bill-5', 'bill-2', 'coin-1', 'coin-0.5', 'coin-0.25', 'coin-0.1', 'coin-0.05', 'pix-val'];
  const handleCalcKeyDown = (e, currentId) => {
    if (e.key === 'Enter') {
      e.preventDefault(); const currentIndex = calculatorOrder.indexOf(currentId); if (currentIndex !== -1 && currentIndex < calculatorOrder.length - 1) {
        cashCalculatorRefs.current[calculatorOrder[currentIndex + 1]]?.focus();
      } else { e.target.blur(); }
    }
  };

  useEffect(() => {
    if (!user) return;
    const unsubRecord = onSnapshot(query(collection(db, 'artifacts', appId, 'users', user.uid, 'records_v2')), (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      setRecords(docs); setLoading(false);
    });
    const unsubWeeks = onSnapshot(query(collection(db, 'artifacts', appId, 'users', user.uid, 'closed_weeks')), (snap) => setClosedWeeks(snap.docs.map(d => d.id)));
    const loadCalculator = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'app_state', 'calculator')); if (docSnap.exists()) setCashCounts(docSnap.data()); isCalculatorLoaded.current = true;
      } catch (e) { isCalculatorLoaded.current = true; }
    };
    loadCalculator();
    return () => {
      unsubRecord(); unsubWeeks();
    };
  }, [user]);

  useEffect(() => {
    if (!user || !isCalculatorLoaded.current) return; const timer = setTimeout(async () => { try { await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'app_state', 'calculator'), cashCounts); } catch (e) { } }, 1000); return () => clearTimeout(timer);
  }, [cashCounts, user]);

  const posTotals = useMemo(() => {
    if (!orders || !date) return { pix: 0, cash: 0, card: 0, total: 0 };
    const dailyOrders = orders.filter(o => o?.paymentStatus === 'PAGO' && (o.paidAt || o.date)?.startsWith(date));
    const acc = { pix: 0, cash: 0, card: 0, total: 0 };
    dailyOrders.forEach(order => {
      acc.total += Number(order.total) || 0;
      if (order.payments?.length) order.payments.forEach(p => {
        const val = Number(p.value) || 0; if (['Dinheiro'].includes(p.method)) acc.cash += val; else if (['Pix', 'PIX'].includes(p.method)) acc.pix += val; else acc.card += val;
      });
      else { const m = order.method || ''; const val = Number(order.total) || 0; if (m.includes('Dinheiro')) acc.cash += val; else if (m.includes('Pix') || m.includes('PIX')) acc.pix += val; else acc.card += val; }
    });
    return acc;
  }, [orders, date]);

  const importFromPos = () => { if (posTotals.total === 0) { showToast("Nenhuma venda encontrada.", 'error'); return; } setPix(posTotals.pix.toFixed(2)); setCash(posTotals.cash.toFixed(2)); setCard(posTotals.card.toFixed(2)); showToast("Importado!", 'success'); };
  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };
  const handleCashCountChange = (type, denom, value) => setCashCounts(prev => ({ ...prev, [type]: { ...prev[type], [denom]: value } }));
  const handlePixCountChange = (value) => setCashCounts(prev => ({ ...prev, pix: value }));
  const calculateCashTotal = useMemo(() => {
    let totalBills = 0, totalCoins = 0;
    Object.keys(cashCounts.bills).forEach(k => totalBills += (parseFloat(cashCounts.bills[k]) || 0) * parseFloat(k)); Object.keys(cashCounts.coins).forEach(k => totalCoins += (parseFloat(cashCounts.coins[k]) || 0) * parseFloat(k));
    return { totalBills, totalCoins, pixVal: parseFloat(cashCounts.pix) || 0, grandTotal: totalBills + totalCoins + (parseFloat(cashCounts.pix) || 0) };
  }, [cashCounts]);
  const handleSave = async () => { if (!user || isSubmitting) return; const valPix = parseFloat(pix) || 0, valCash = parseFloat(cash) || 0, valCard = parseFloat(card) || 0; if ((valPix + valCash + valCard) < 0) { showToast("Valor negativo", 'error'); return; } setIsSubmitting(true); await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'records_v2'), { date, pix: valPix, cash: valCash, card: valCard, total: valPix + valCash + valCard, createdAt: Timestamp.now() }); setPix(''); setCash(''); setCard(''); showToast("Salvo!"); setIsSubmitting(false); };
  const handleDelete = async (id) => { if (window.confirm("Excluir?")) await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'records_v2', id)); };
  const toggleWeekClose = async (id, isClosed) => { if (isClosed) await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'closed_weeks', id)); else await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'closed_weeks', id), { at: Date.now() }); };
  
  const weeks = useMemo(() => {
    const groups = {}; records.forEach(rec => {
      const w = getWeekId(rec.date); if (!groups[w]) groups[w] = { id: w, records: [], total: 0, totalPix: 0, totalCash: 0, totalCard: 0, startDate: rec.date, endDate: rec.date }; groups[w].records.push(rec); groups[w].total += rec.total; groups[w].totalPix += rec.pix; groups[w].totalCash += rec.cash; groups[w].totalCard += rec.card; if (rec.date < groups[w].startDate) groups[w].startDate = rec.date; if (rec.date > groups[w].endDate) groups[w].endDate = rec.date;
    }); return Object.values(groups).sort((a, b) => b.id.localeCompare(a.id));
  }, [records]);

  // NEW: Months aggregation
  const months = useMemo(() => {
    const groups = {};
    records.forEach(rec => {
      if(!rec.date) return;
      const m = rec.date.substring(0, 7); // YYYY-MM
      if (!groups[m]) groups[m] = { id: m, total: 0, totalPix: 0, totalCash: 0, totalCard: 0 };
      groups[m].total += (rec.total || 0);
      groups[m].totalPix += (rec.pix || 0);
      groups[m].totalCash += (rec.cash || 0);
      groups[m].totalCard += (rec.card || 0);
    });
    return Object.values(groups).sort((a, b) => b.id.localeCompare(a.id));
  }, [records]);

  // NEW: Years aggregation
  const years = useMemo(() => {
    const groups = {};
    records.forEach(rec => {
      if(!rec.date) return;
      const y = rec.date.substring(0, 4); // YYYY
      if (!groups[y]) groups[y] = { id: y, total: 0, totalPix: 0, totalCash: 0, totalCard: 0 };
      groups[y].total += (rec.total || 0);
      groups[y].totalPix += (rec.pix || 0);
      groups[y].totalCash += (rec.cash || 0);
      groups[y].totalCard += (rec.card || 0);
    });
    return Object.values(groups).sort((a, b) => b.id.localeCompare(a.id));
  }, [records]);

  const currentEntryWeek = useMemo(() => weeks.find(w => w.id === getWeekId(date)), [weeks, date]);

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="bg-gray-50 min-h-screen p-4 pb-20 pl-20 w-full">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 flex items-center gap-2 border-b pb-4"><div className="bg-blue-600 p-2 rounded-lg text-white"><TrendingUp size={20} /></div><h1 className="text-2xl font-bold">Fluxo de Caixa</h1></div>
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {[{ id: 'entry', icon: ListPlus, label: 'Lançamentos' }, 
            { id: 'weekly', icon: CalendarDays, label: 'Semanal' }, 
            { id: 'monthly', icon: Calendar, label: 'Mensal' }, 
            { id: 'annual', icon: BarChart3, label: 'Anual' }, 
            { id: 'cash_count', icon: Wallet, label: 'Saldo Caixa' }]
            .map(tab => (
              <button key={tab.id} onClick={() => setCurrentView(tab.id)} className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap ${currentView === tab.id ? 'bg-blue-600 text-white' : 'bg-white border'}`}><tab.icon size={16} /> {tab.label}</button>
            ))}
        </div>

        {currentView === 'cash_count' && (
          <div className="bg-white rounded-xl shadow-sm border p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div><h3 className="font-bold mb-4">Cédulas</h3>{Object.keys(cashCounts.bills).reverse().map(d => (<div key={d} className="flex justify-between mb-2 items-center"><span className="text-sm font-medium w-20">R$ {d}</span><input ref={el => cashCalculatorRefs.current[`bill-${d}`] = el} type="number" className="border rounded px-2 w-20 text-center" value={cashCounts.bills[d]} onChange={e => handleCashCountChange('bills', d, e.target.value)} onKeyDown={e => handleCalcKeyDown(e, `bill-${d}`)} /><span className="text-sm font-bold w-24 text-right">{formatMoney((parseFloat(cashCounts.bills[d]) || 0) * d)}</span></div>))}</div>
            <div><h3 className="font-bold mb-4">Moedas e Pix</h3>{Object.keys(cashCounts.coins).reverse().map(d => (<div key={d} className="flex justify-between mb-2 items-center"><span className="text-sm font-medium w-20">{Number(d).toFixed(2)}</span><input ref={el => cashCalculatorRefs.current[`coin-${d}`] = el} type="number" className="border rounded px-2 w-20 text-center" value={cashCounts.coins[d]} onChange={e => handleCashCountChange('coins', d, e.target.value)} onKeyDown={e => handleCalcKeyDown(e, `coin-${d}`)} /><span className="text-sm font-bold w-24 text-right">{formatMoney((parseFloat(cashCounts.coins[d]) || 0) * d)}</span></div>))}<div className="mt-4 pt-4 border-t flex justify-between"><span className="font-bold text-green-600">Saldo Banco</span><input ref={el => cashCalculatorRefs.current['pix-val'] = el} type="number" step="0.01" className="border rounded px-2 w-28 text-right bg-green-50" value={cashCounts.pix} onChange={e => handlePixCountChange(e.target.value)} onKeyDown={e => handleCalcKeyDown(e, 'pix-val')} /></div></div>
            <div className="col-span-1 md:col-span-2 bg-gray-800 text-white p-6 flex justify-between"><span className="font-bold uppercase">Total Geral</span><span className="text-2xl text-yellow-400">{formatMoney(calculateCashTotal.grandTotal)}</span></div>
          </div>
        )}

        {currentView === 'entry' && (
          <div>
            <div className="bg-white p-4 rounded-xl shadow-sm border mb-8"><div className="mb-4 bg-indigo-50 border-indigo-100 border p-3 rounded-lg flex justify-between items-center"><div className="flex gap-3 items-center"><ShoppingCart size={16} className="text-indigo-600" /><div className="text-xs"><div>Vendas (POS) - {formatDate(date)}</div><div className="font-bold">Pix: {formatMoney(posTotals.pix)} | Din: {formatMoney(posTotals.cash)} | Card: {formatMoney(posTotals.card)}</div></div></div><button onClick={importFromPos} className="bg-indigo-600 text-white text-xs px-3 py-1 rounded font-bold">Importar</button></div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end"><input type="date" value={date} onChange={e => setDate(e.target.value)} className="border p-2 rounded text-sm col-span-2 md:col-span-1" /><input ref={pixRef} type="number" placeholder="Pix" value={pix} onChange={e => setPix(e.target.value)} className="border p-2 rounded text-sm text-right" /><input ref={cashRef} type="number" placeholder="Dinheiro" value={cash} onChange={e => setCash(e.target.value)} className="border p-2 rounded text-sm text-right" /><input ref={cardRef} type="number" placeholder="Cartão" value={card} onChange={e => setCard(e.target.value)} className="border p-2 rounded text-sm text-right" /><button onClick={handleSave} disabled={isSubmitting} className="bg-blue-600 text-white px-4 py-2 rounded font-bold text-sm col-span-2 md:col-span-1">Salvar</button></div>
            </div>
            {currentEntryWeek && (<div className="bg-white rounded-xl shadow-sm border overflow-hidden"><div className="bg-blue-50 p-3 border-b flex justify-between"><span className="font-bold text-sm">Semana Atual</span><div className="flex gap-2"><span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full font-bold">Total: {formatMoney(currentEntryWeek.total)}</span><button onClick={() => toggleWeekClose(currentEntryWeek.id, closedWeeks.includes(currentEntryWeek.id))}>{closedWeeks.includes(currentEntryWeek.id) ? <Lock size={14} /> : <Unlock size={14} />}</button></div></div><table className="w-full text-sm"><thead><tr className="bg-gray-50 text-xs text-gray-500 uppercase"><th className="p-2">Data</th><th className="p-2 text-right">Pix</th><th className="p-2 text-right">Din</th><th className="p-2 text-right">Card</th><th className="p-2 text-right">Total</th><th></th></tr></thead><tbody>{currentEntryWeek.records.map(r => (<tr key={r.id} className="border-b"><td className="p-2">{formatDate(r.date)}</td><td className="p-2 text-right">{formatMoney(r.pix)}</td><td className="p-2 text-right">{formatMoney(r.cash)}</td><td className="p-2 text-right">{formatMoney(r.card)}</td><td className="p-2 text-right font-bold">{formatMoney(r.total)}</td><td className="p-2 text-center"><button onClick={() => handleDelete(r.id)}><Trash2 size={14} className="text-red-400" /></button></td></tr>))}</tbody></table></div>)}
          </div>
        )}

        {currentView === 'weekly' && (<div className="space-y-4">{weeks.map(w => (<div key={w.id} className="bg-white border rounded-xl p-4"><div className="flex justify-between font-bold mb-2"><span>Semana {w.id.split('-W')[1]}</span><span>{formatMoney(w.total)}</span></div><div className="grid grid-cols-3 text-xs gap-2"><div className="bg-green-50 p-2 rounded text-green-700">Pix: {formatMoney(w.totalPix)}</div><div className="bg-blue-50 p-2 rounded text-blue-700">Din: {formatMoney(w.totalCash)}</div><div className="bg-purple-50 p-2 rounded text-purple-700">Card: {formatMoney(w.totalCard)}</div></div></div>))}</div>)}
        
        {currentView === 'monthly' && (<div className="space-y-4">{months.map(m => (<div key={m.id} className="bg-white border rounded-xl p-4"><div className="flex justify-between font-bold mb-2"><span>{new Date(m.id + '-02').toLocaleDateString('pt-BR', {month:'long', year:'numeric'}).toUpperCase()}</span><span>{formatMoney(m.total)}</span></div><div className="grid grid-cols-3 text-xs gap-2"><div className="bg-green-50 p-2 rounded text-green-700">Pix: {formatMoney(m.totalPix)}</div><div className="bg-blue-50 p-2 rounded text-blue-700">Din: {formatMoney(m.totalCash)}</div><div className="bg-purple-50 p-2 rounded text-purple-700">Card: {formatMoney(m.totalCard)}</div></div></div>))}</div>)}
        
        {currentView === 'annual' && (<div className="space-y-4">{years.map(y => (<div key={y.id} className="bg-white border rounded-xl p-4"><div className="flex justify-between font-bold mb-2"><span>ANO {y.id}</span><span>{formatMoney(y.total)}</span></div><div className="grid grid-cols-3 text-xs gap-2"><div className="bg-green-50 p-2 rounded text-green-700">Pix: {formatMoney(y.totalPix)}</div><div className="bg-blue-50 p-2 rounded text-blue-700">Din: {formatMoney(y.totalCash)}</div><div className="bg-purple-50 p-2 rounded text-purple-700">Card: {formatMoney(y.totalCard)}</div></div></div>))}</div>)}
      </div>
    </div>
  );
};

// --------------------------------------------------------------------------------
// SISTEMA MOBILE (CLIENTE / GARÇOM)
// --------------------------------------------------------------------------------
const MobileView = ({ user, initialRole, onBack }) => {
  const [view, setView] = useState('tables');
  const [selectedTable, setSelectedTable] = useState('');
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderCounter, setOrderCounter] = useState(1000);

  // --- ESTADOS PARA IA (SUGESTÃO DO CHEF) ---
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiResponse, setAiResponse] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsubProd = onSnapshot(query(collection(db, 'artifacts', appId, 'users', user.uid, 'products')), (snap) => {
      if (snap.empty) {
        const batch = writeBatch(db);
        DEFAULT_PRODUCTS_SEED.forEach(p => { batch.set(doc(collection(db, 'artifacts', appId, 'users', user.uid, 'products')), p); });
        batch.commit();
      } else {
        const list = snap.docs.map(d => ({ firestoreId: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name));
        setProducts(list);
        setCategories(['Todos', ...new Set(list.map(p => p.category).filter(Boolean))]);
      }
    });
    const unsubOrders = onSnapshot(query(collection(db, 'artifacts', appId, 'users', user.uid, 'orders')), (snap) => {
      const list = snap.docs.map(d => d.data());
      if (list.length > 0) setOrderCounter(Math.max(...list.map(o => o.id || 0)) + 1);
    });
    return () => { unsubProd(); unsubOrders(); };
  }, [user]);

  const handleTableSelect = (t) => { setSelectedTable(t); setCart([]); setView('menu'); };
  const addToCart = (p) => {
    if (p.stock <= 0) return; const ex = cart.find(i => i.id === p.id);
    if (ex) setCart(cart.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i)); else setCart([...cart, { ...p, qty: 1, obs: '' }]);
  };
  const removeFromCart = (id) => {
    const ex = cart.find(i => i.id === id); if (ex.qty > 1) setCart(cart.map(i => i.id === id ? { ...i, qty: i.qty - 1 } : i)); else setCart(cart.filter(i => i.id !== id));
  };
  const sendOrder = async () => {
    if (!cart.length) return; setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      cart.forEach(c => { const p = products.find(prod => prod.id === c.id); if (p) batch.update(doc(db, 'artifacts', appId, 'users', user.uid, 'products', p.firestoreId), { stock: p.stock - c.qty }); });
      await batch.commit();
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'orders'), { id: orderCounter, client: selectedTable, waiter: initialRole, items: cart, total: cart.reduce((a, i) => a + (i.price * i.qty), 0), status: 'ABERTO', paymentStatus: 'ABERTO', kitchenStatus: 'Pendente', method: 'Aguardando', date: new Date().toISOString(), time: new Date().toLocaleTimeString().slice(0, 5), origin: 'Mobile' });
      setView('success'); setTimeout(() => { setCart([]); setSelectedTable(''); setView('tables'); setIsSubmitting(false); }, 2000);
    } catch (e) {
      alert("Erro"); setIsSubmitting(false);
    }
  };

  const handleAiSuggestion = async () => {
    setIsAiLoading(true);
    setShowAiModal(true);
    setAiResponse('');
    
    // Simplificar produtos para o prompt
    const availableProducts = products.map(p => `${p.name} (R$ ${p.price})`).join(', ');
    const cartItems = cart.length > 0 ? cart.map(i => i.name).join(', ') : 'nenhum item';
    
    const prompt = `Atue como um garçom experiente e amigável de uma confeitaria brasileira. 
    Aqui está o menu disponível: [${availableProducts}]. 
    O cliente tem atualmente no carrinho: [${cartItems}].
    Sugira APENAS UMA combinação ou item complementar do menu para este cliente. 
    Se o carrinho estiver vazio, sugira o item mais popular ou uma combinação clássica (ex: café e bolo).
    Responda em português de forma curta (máximo 2 frases) e convidativa. Use emojis.`;

    const result = await callGemini(prompt);
    setAiResponse(result || "Desculpe, o chef está ocupado agora!");
    setIsAiLoading(false);
  };

  const filtered = products.filter(p => (selectedCategory === 'Todos' || p.category === selectedCategory) && p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const total = cart.reduce((a, i) => a + (i.price * i.qty), 0); const count = cart.reduce((a, i) => a + i.qty, 0);

  if (view === 'success') return <div className="h-screen bg-green-600 flex flex-col items-center justify-center text-white p-8"><CheckCircle size={80} className="mb-4" /><h1 className="text-3xl font-bold">Pedido Enviado!</h1></div>;

  return (
    <div className="min-h-screen bg-slate-100 pb-24 font-sans max-w-md mx-auto shadow-2xl relative">
      <div className="bg-slate-900 text-white p-4 sticky top-0 z-20 shadow-md flex justify-between items-center">
        {view === 'tables' ? <div className="flex items-center gap-2"><button onClick={onBack}><ChevronLeft /></button><span className="font-bold">Olá, {initialRole}</span></div> : <div className="flex items-center gap-2"><button onClick={() => setView(view === 'cart' ? 'menu' : 'tables')}><ChevronLeft /></button><span className="font-bold">{selectedTable}</span></div>}
        <div className="text-xs bg-slate-800 px-2 py-1 rounded flex items-center gap-1"><User size={12} /> {initialRole}</div>
      </div>
      {view === 'tables' && <div className="p-4"><h2 className="font-bold text-center mb-4">Selecione a Mesa</h2><div className="grid grid-cols-3 gap-3">{MESAS.map(t => (<button key={t} onClick={() => handleTableSelect(t)} className="bg-white p-4 rounded-xl shadow-sm border font-bold text-slate-700 flex flex-col items-center"><Utensils size={20} className="opacity-50" />{t.replace('Mesa ', '')}</button>))}<button onClick={() => handleTableSelect('Balcão')} className="col-span-3 bg-orange-100 text-orange-700 p-4 rounded-xl font-bold">Balcão / Viagem</button></div></div>}
      {view === 'menu' && (
        <div>
          <div className="bg-white p-4 sticky top-[60px] z-10 border-b">
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1"><Search className="absolute left-3 top-2.5 text-slate-400" size={18} /><input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar..." className="w-full bg-slate-100 pl-10 p-2 rounded-lg text-sm" /></div>
              <button onClick={handleAiSuggestion} className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white p-2 rounded-lg shadow-md animate-pulse"><Sparkles size={20}/></button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">{categories.map(c => (<button key={c} onClick={() => setSelectedCategory(c)} className={`px-4 py-1 rounded-full text-xs font-bold whitespace-nowrap ${selectedCategory === c ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}>{c}</button>))}</div>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            {filtered.map(p => {
              const qty = cart.find(i => i.id === p.id)?.qty || 0;
              return (
                <div key={p.id} className={`bg-white p-3 rounded-2xl shadow-sm border flex flex-col items-center text-center gap-2 ${qty > 0 ? 'border-blue-500 bg-blue-50/30' : 'border-slate-100'}`}>
                  <div className="bg-slate-100 p-4 rounded-full mb-1">
                    <IconMapper type={p.icon} className="w-8 h-8 text-slate-700" />
                  </div>
                  <div className="flex-1 w-full">
                    <div className="font-bold text-sm leading-tight mb-1 truncate px-1">{p.name}</div>
                    <div className="text-sm font-bold text-blue-600">R$ {p.price.toFixed(2)}</div>
                  </div>

                  {p.stock > 0 ? (
                    <div className="w-full mt-1">
                      {qty > 0 ? (
                        <div className="flex items-center justify-between bg-slate-100 rounded-lg p-1">
                          <button onClick={() => removeFromCart(p.id)} className="w-8 h-8 flex items-center justify-center bg-white text-red-500 rounded-md shadow-sm active:scale-90 transition-transform"><Minus size={16} /></button>
                          <span className="font-bold text-sm">{qty}</span>
                          <button onClick={() => addToCart(p)} className="w-8 h-8 flex items-center justify-center bg-white text-green-600 rounded-md shadow-sm active:scale-90 transition-transform"><Plus size={16} /></button>
                        </div>
                      ) : (
                        <button onClick={() => addToCart(p)} className="w-full py-2 bg-slate-900 text-white text-sm font-bold rounded-lg shadow-sm hover:bg-slate-800 active:scale-95 transition-transform">Adicionar</button>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs font-bold text-red-400 mt-2 block w-full py-2 bg-red-50 rounded-lg">Esgotado</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
      {view === 'cart' && <div className="p-4"><h2 className="font-bold text-xl mb-4 flex items-center gap-2"><ShoppingCart /> Resumo</h2><div className="bg-white rounded-xl shadow-sm border overflow-hidden mb-4">{cart.map(i => (<div key={i.id} className="p-4 border-b"><div className="flex justify-between items-start mb-2"><div><div className="font-bold"><span className="text-blue-600 mr-1">{i.qty}x</span> {i.name}</div><div className="text-sm text-slate-500">R$ {(i.price * i.qty).toFixed(2)}</div></div><div className="flex gap-2"><button onClick={() => removeFromCart(i.id)} className="p-1 bg-red-100 text-red-600 rounded"><Minus size={14} /></button><button onClick={() => addToCart(i)} className="p-1 bg-green-100 text-green-600 rounded"><Plus size={14} /></button></div></div><input placeholder="Obs..." value={i.obs || ''} onChange={e => setCart(cart.map(x => x.id === i.id ? { ...x, obs: e.target.value } : x))} className="w-full text-xs bg-slate-50 border p-2 rounded" /></div>))}</div><div className="bg-white p-4 rounded-xl shadow-sm mb-6 flex justify-between font-bold text-lg"><span>Total</span><span>R$ {total.toFixed(2)}</span></div><button onClick={sendOrder} disabled={isSubmitting} className="w-full bg-green-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2">{isSubmitting ? 'Enviando...' : <><Send size={20} /> Enviar Pedido</>}</button></div>}
      {view === 'menu' && count > 0 && <div className="fixed bottom-4 left-4 right-4 z-30 max-w-md mx-auto"><button onClick={() => setView('cart')} className="w-full bg-slate-900 text-white p-4 rounded-2xl shadow-xl flex justify-between items-center"><div className="flex items-center gap-3"><div className="bg-white text-slate-900 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">{count}</div><span className="font-bold">Ver Carrinho</span></div><span className="font-bold text-lg">R$ {total.toFixed(2)}</span></button></div>}
      
      {/* AI Suggestion Modal */}
      {showAiModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden border-2 border-purple-100">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 text-white flex justify-between items-center">
              <h3 className="font-bold text-lg flex items-center gap-2"><Sparkles size={20} className="animate-spin-slow"/> Sugestão do Chef</h3>
              <button onClick={() => setShowAiModal(false)}><X size={20}/></button>
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
                  <button onClick={() => setShowAiModal(false)} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold w-full">Entendido!</button>
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
const PosView = ({ user, onBack, initialSettings, refreshSettings }) => {
  const [view, setView] = useState('pos');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [orderCounter, setOrderCounter] = useState(100);
  const [settings, setSettings] = useState(initialSettings);

  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedTabToSettle, setSelectedTabToSettle] = useState(null);
  const [partialPayments, setPartialPayments] = useState([]);
  const [paymentInputValue, setPaymentInputValue] = useState('');

  const [editingProduct, setEditingProduct] = useState(null);
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdCat, setNewProdCat] = useState('Lanches');

  const [reportDate, setReportDate] = useState(new Date());
  const [reportMode, setReportMode] = useState('daily');
  const [cashMovements, setCashMovements] = useState([]);
  const [showCashMovementModal, setShowCashMovementModal] = useState(false);
  const [movementType, setMovementType] = useState('suprimento');
  const [movementValue, setMovementValue] = useState('');
  const [movementDesc, setMovementDesc] = useState('');

  const [futureOrders, setFutureOrders] = useState([]);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [editingFutureOrder, setEditingFutureOrder] = useState(null); // Estado para edição
  const [orderClient, setOrderClient] = useState('');
  const [orderPhone, setOrderPhone] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [orderTime, setOrderTime] = useState('');
  const [orderObs, setOrderObs] = useState('');
  const [orderTotalValue, setOrderTotalValue] = useState('');
  const [orderSignal, setOrderSignal] = useState('');
  const [orderSignalMethod, setOrderSignalMethod] = useState('Pix');
  const [isAiLoading, setIsAiLoading] = useState(false); // Estado de loading para AI na POS

  const [selectedFutureOrder, setSelectedFutureOrder] = useState(null);
  const [settleValue, setSettleValue] = useState('');
  const [settleMethod, setSettleMethod] = useState('Pix');

  const [showSettingsPasswordModal, setShowSettingsPasswordModal] = useState(false);
  const [settingsPasswordInput, setSettingsPasswordInput] = useState('1234');
  const [isSettingsUnlocked, setIsSettingsUnlocked] = useState(false);

  // States para ação com senha (cancelar/editar)
  const [actionAuthModal, setActionAuthModal] = useState({ show: false, action: null, order: null });
  const [actionPassword, setActionPassword] = useState('');

  // Inicialização segura do configForm com docId sempre definido
  const [configForm, setConfigForm] = useState({
    ...initialSettings,
    docType: initialSettings.docType || 'CNPJ',
    docId: initialSettings.docId || initialSettings.cnpj || ''
  });

  // Refs for navigation
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
    const unsubProd = onSnapshot(query(collection(db, 'artifacts', appId, 'users', user.uid, 'products')), (snap) => { if (!snap.empty) { const list = snap.docs.map(d => ({ firestoreId: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name)); setProducts(list); } });
    const unsubOrders = onSnapshot(query(collection(db, 'artifacts', appId, 'users', user.uid, 'orders')), (snap) => {
      const list = snap.docs.map(d => ({ firestoreId: d.id, ...d.data() })).sort((a, b) => b.id - a.id); setOrders(list); if (list.length > 0) setOrderCounter(Math.max(...list.map(o => o.id)) + 1);
    });
    const unsubMove = onSnapshot(query(collection(db, 'artifacts', appId, 'users', user.uid, 'cash_movements')), (snapshot) => { setCashMovements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (b.date || '').localeCompare(a.date || ''))); });
    const unsubFuture = onSnapshot(query(collection(db, 'artifacts', appId, 'users', user.uid, 'future_orders')), (snap) => { setFutureOrders(snap.docs.map(d => ({ firestoreId: d.id, ...d.data() })).sort((a, b) => new Date(a.deliveryDate + 'T' + a.deliveryTime) - new Date(b.deliveryDate + 'T' + b.deliveryTime))); });
    return () => { unsubProd(); unsubOrders(); unsubMove(); unsubFuture(); };
  }, [user]);

  useEffect(() => {
    setSettings(initialSettings);
    setConfigForm({
      ...initialSettings,
      docType: initialSettings.docType || 'CNPJ',
      docId: initialSettings.docId || initialSettings.cnpj || ''
    });
  }, [initialSettings]);

  const addToCart = (p) => { if (p.stock <= 0) { alert("Sem estoque!"); return; } const ex = cart.find(i => i.id === p.id); if (ex) setCart(cart.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i)); else setCart([...cart, { ...p, qty: 1, obs: '' }]); };
  const removeFromCart = (id) => setCart(cart.filter(item => item.id !== id));
  const updateItemObs = (id) => { const item = cart.find(i => i.id === id); const newObs = prompt(`Observação:`, item.obs || ""); if (newObs !== null) setCart(cart.map(i => i.id === id ? { ...i, obs: newObs } : i)); };

  const finalizeOrder = async (client = 'Balcão', status = 'PAGO') => {
    if (!user) return;
    const totalCart = cart.reduce((acc, item) => acc + (Number(item.price) * Number(item.qty)), 0);
    const totalOrder = selectedTabToSettle ? selectedTabToSettle.total : totalCart;
    const paidTotal = partialPayments.reduce((acc, p) => acc + p.value, 0);
    if (status === 'PAGO' && paidTotal < totalOrder - 0.01) { alert(`Falta receber R$ ${(totalOrder - paidTotal).toFixed(2)}`); return; }

    if (!selectedTabToSettle && status === 'PAGO') {
      const batch = writeBatch(db);
      cart.forEach(cItem => { const pItem = products.find(p => p.id === cItem.id); if (pItem && pItem.firestoreId) { const newStock = pItem.stock - cItem.qty; batch.update(doc(db, 'artifacts', appId, 'users', user.uid, 'products', pItem.firestoreId), { stock: newStock }); } });
      await batch.commit();
    }
    const nowISO = new Date().toISOString();
    const methodString = partialPayments.length > 0 ? partialPayments.map(p => `${p.method}`).join(' + ') : 'Dinheiro';
    const paymentsArray = partialPayments.length > 0 ? partialPayments : [{ method: 'Dinheiro', value: totalOrder }];

    try {
      if (selectedTabToSettle) {
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'orders', selectedTabToSettle.firestoreId), { paymentStatus: 'PAGO', method: methodString, payments: paymentsArray, paidAt: nowISO, date: selectedTabToSettle.date || nowISO });
        alert("Comanda Recebida!");
      } else {
        if (status === 'ABERTO') {
          const existing = orders.find(o => o.client === client && o.paymentStatus === 'ABERTO');
          if (existing) await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'orders', existing.firestoreId), { items: [...existing.items, ...cart], total: existing.total + totalCart, kitchenStatus: 'Pendente', updatedAt: nowISO });
          else await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'orders'), { id: orderCounter, items: [...cart], total: totalCart, status: 'ABERTO', paymentStatus: 'ABERTO', method: 'Aguardando', client, kitchenStatus: 'Pendente', date: nowISO, paidAt: null, time: new Date().toLocaleTimeString().slice(0, 5), origin: 'Caixa' });
        } else {
          await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'orders'), { id: orderCounter, items: [...cart], total: totalCart, status: 'Pago', paymentStatus: 'PAGO', method: methodString, payments: paymentsArray, client, kitchenStatus: 'Pendente', date: nowISO, paidAt: nowISO, time: new Date().toLocaleTimeString().slice(0, 5), origin: 'Caixa' });
        }
      }
    } catch (e) { alert("Erro ao salvar pedido."); }
    setCart([]);
    setShowPaymentModal(false);
  };

  // --- FUNÇÕES DE SEGURANÇA (EDITAR/CANCELAR) ---
  const confirmActionAuth = () => {
    const currentPass = settings.posPassword || '1234';
    if (actionPassword === currentPass) {
      performAction();
    } else {
      alert('Senha incorreta!');
      setActionPassword('');
    }
  };

  const performAction = async () => {
    const { action, order } = actionAuthModal;
    if (!order) return;

    try {
      const batch = writeBatch(db);

      // 1. Restaurar Estoque
      order.items.forEach(cartItem => {
        const originalProduct = products.find(p => p.id === cartItem.id);
        if (originalProduct && originalProduct.firestoreId) {
          const productRef = doc(db, 'artifacts', appId, 'users', user.uid, 'products', originalProduct.firestoreId);
          batch.update(productRef, { stock: originalProduct.stock + cartItem.qty });
        }
      });

      // 2. Deletar o pedido original
      const orderRef = doc(db, 'artifacts', appId, 'users', user.uid, 'orders', order.firestoreId);
      batch.delete(orderRef);

      await batch.commit();

      if (action === 'cancel') {
        alert("Pedido cancelado e estoque restaurado!");
      } else if (action === 'edit') {
        // 3. Se for editar, joga os itens no carrinho e vai pro POS
        setCart(order.items);

        // Se for mesa, seleciona a mesa. Se for cliente balcão, preenche o nome
        const isTable = MESAS.includes(order.client);
        if (isTable) {
          setSelectedTabToSettle({ ...order, firestoreId: null }); // null ID para criar novo
          setCustomerName('');
        } else {
          setCustomerName(order.client);
          setSelectedTabToSettle(null);
        }

        setView('pos');
        alert(`Pedido de ${order.client} carregado para edição. Faça as alterações e salve novamente.`);
      }

    } catch (error) {
      console.error("Erro na ação:", error);
      alert("Erro ao processar ação.");
    }

    setActionAuthModal({ show: false, action: null, order: null });
    setActionPassword('');
  };

  // --- LÓGICA DE EDIÇÃO DE ENCOMENDAS ---
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
    const prompt = `Transforme esta anotação bruta de pedido de confeitaria em uma descrição comercial, clara e apetitosa em português. Mantenha todos os detalhes técnicos (sabor, peso, tema) mas escreva de forma profissional para a ficha de produção. Texto original: "${orderObs}"`;
    const improved = await callGemini(prompt);
    if (improved) setOrderObs(improved);
    setIsAiLoading(false);
  };

  const saveFutureOrder = async () => {
    if (!orderClient) { alert("Nome obrigatório"); return; }
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

    if (editingFutureOrder) {
      // Atualizando encomenda existente
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'future_orders', editingFutureOrder.firestoreId), {
        ...orderData,
        updatedAt: new Date().toISOString()
      });
      alert("Encomenda atualizada com sucesso!");
    } else {
      // Criando nova encomenda
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'future_orders'), {
        ...orderData,
        status: 'Pendente',
        createdAt: new Date().toISOString()
      });

      // Lançamento financeiro do sinal (apenas se for novo registro para não duplicar)
      if (signalVal > 0) {
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'orders'), { 
          id: orderCounter + 1, 
          client: `Sinal: ${orderClient}`, 
          total: signalVal, 
          status: 'Pago', 
          paymentStatus: 'PAGO', 
          method: orderSignalMethod, 
          payments: [{ method: orderSignalMethod, value: signalVal }], 
          date: new Date().toISOString(), 
          time: new Date().toLocaleTimeString().slice(0, 5), 
          origin: 'Encomenda', 
          kitchenStatus: 'N/A', 
          items: [{ name: 'Sinal Encomenda', price: signalVal, qty: 1 }] 
        });
      }
      alert("Encomenda salva!");
    }

    setShowOrderModal(false); 
    setEditingFutureOrder(null);
    setOrderClient(''); setOrderPhone(''); setOrderObs(''); setOrderSignal(''); setOrderTotalValue(''); 
  };

  const handleSettleOrder = async () => {
    if (!selectedFutureOrder) return;
    const amountReceived = parseFloat(settleValue) || 0;
    await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'future_orders', selectedFutureOrder.firestoreId), { status: 'Concluído', finalPayment: amountReceived, finalPaymentMethod: settleMethod, completedAt: new Date().toISOString() });
    if (amountReceived > 0) await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'orders'), { id: orderCounter + 1, client: `Restante: ${selectedFutureOrder.client}`, total: amountReceived, status: 'Pago', paymentStatus: 'PAGO', method: settleMethod, payments: [{ method: settleMethod, value: amountReceived }], date: new Date().toISOString(), time: new Date().toLocaleTimeString().slice(0, 5), origin: 'Encomenda', kitchenStatus: 'N/A', items: [{ name: 'Restante Encomenda', price: amountReceived, qty: 1 }] });
    setSelectedFutureOrder(null); alert("Encerrada!");
  };

  const openWhatsApp = (phone) => {
    if (!phone) return;
    const cleanPhone = phone.replace(/\D/g, '');
    const url = `https://wa.me/55${cleanPhone}`;
    window.open(url, '_blank');
  };

  const handleSettingsAccess = () => {
    if (isSettingsUnlocked) { setView('settings'); } else { setShowSettingsPasswordModal(true); }
  };

  const submitSettingsPassword = () => {
    const currentPass = settings.settingsPassword || '1234';
    if (settingsPasswordInput === currentPass) { setIsSettingsUnlocked(true); setShowSettingsPasswordModal(false); setView('settings'); setSettingsPasswordInput(''); } else { alert("Senha incorreta"); setSettingsPasswordInput(''); }
  };

  const saveSettings = async () => {
    try { await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'app_state', 'settings'), configForm); refreshSettings(configForm); alert("Configurações Salvas!"); } catch (e) { alert("Erro ao salvar"); }
  };

  const handleAddCashMovement = async () => {
    if (!movementValue || parseFloat(movementValue) <= 0 || !user) return;
    try { await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'cash_movements'), { type: movementType, value: parseFloat(movementValue), description: movementDesc, date: new Date().toISOString(), createdAt: Timestamp.now() }); setShowCashMovementModal(false); setMovementValue(''); setMovementDesc(''); alert("Sucesso!"); } catch (e) { alert("Erro"); }
  };

  const addNewProduct = async () => { if (!newProdName || !newProdPrice || !user) return; await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'products'), { id: Date.now(), name: newProdName, price: parseFloat(newProdPrice), category: newProdCat, stock: 50, icon: 'burger' }); setNewProdName(''); setNewProdPrice(''); };
  const handleUpdateProduct = async () => { if (!editingProduct || !user) return; await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'products', editingProduct.firestoreId), { name: editingProduct.name, price: editingProduct.price, category: editingProduct.category, stock: editingProduct.stock }); setEditingProduct(null); };
  const handleDeleteProduct = async () => { if (window.confirm('Excluir?') && editingProduct.firestoreId) { await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'products', editingProduct.firestoreId)); setEditingProduct(null); } };

  const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const modalTotal = selectedTabToSettle ? selectedTabToSettle.total : cartTotal;
  const modalPaid = partialPayments.reduce((acc, p) => acc + p.value, 0);
  const modalRemaining = Math.max(0, modalTotal - modalPaid);

  // --- DASHBOARD METRICS ---
  const getFilteredOrders = () => {
    return orders.filter(o => {
      if (!o || o.paymentStatus !== 'PAGO' || !o.date) return false;
      try {
        const orderDate = new Date(o.date);
        if (reportMode === 'daily') return orderDate.getDate() === reportDate.getDate() && orderDate.getMonth() === reportDate.getMonth() && orderDate.getFullYear() === reportDate.getFullYear();
        else return orderDate.getMonth() === reportDate.getMonth() && orderDate.getFullYear() === reportDate.getFullYear();
      } catch { return false; }
    });
  };
  const filteredOrders = getFilteredOrders();
  const totalSales = filteredOrders.reduce((acc, order) => acc + (Number(order.total) || 0), 0);
  const salesByMethod = filteredOrders.reduce((acc, order) => {
    if (order.payments && Array.isArray(order.payments)) {
      order.payments.forEach(p => { const val = Number(p.value) || 0; if (p.method === 'Dinheiro') acc.dinheiro += val; else if (p.method === 'Pix') acc.pix += val; else if (['Crédito', 'Débito'].includes(p.method)) acc.cartao += val; });
    }
    else { const val = Number(order.total) || 0; const m = order.method || ''; if (m.includes('Dinheiro')) acc.dinheiro += val; else if (m.includes('Pix') || m.includes('PIX')) acc.pix += val; else acc.card += val; }
    return acc;
  }, { dinheiro: 0, pix: 0, cartao: 0 });
  const filteredMovements = cashMovements.filter(m => {
    if (!m.date) return false;
    const mDate = new Date(m.date); if (reportMode === 'daily') return mDate.getDate() === reportDate.getDate() && mDate.getMonth() === reportDate.getMonth() && mDate.getFullYear() === reportDate.getFullYear(); else return mDate.getMonth() === reportDate.getMonth() && mDate.getFullYear() === reportDate.getFullYear();
  });
  const totalSuprimento = filteredMovements.filter(m => m.type === 'suprimento').reduce((acc, m) => acc + (Number(m.value) || 0), 0);
  const totalSangria = filteredMovements.filter(m => m.type === 'sangria').reduce((acc, m) => acc + (Number(m.value) || 0), 0);
  const changeDate = (days) => { const d = new Date(reportDate); d.setDate(d.getDate() + days); setReportDate(d); };
  const changeMonth = (months) => { const d = new Date(reportDate); d.setMonth(d.getMonth() + months); setReportDate(d); };
  const orderMetrics = useMemo(() => {
    const now = new Date(); const today = now.toISOString().split('T')[0]; const cm = today.slice(0, 7); const cy = today.slice(0, 4); const getWeek = (d) => { const date = new Date(d); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7); const w1 = new Date(date.getFullYear(), 0, 4); return 1 + Math.round(((date.getTime() - w1.getTime()) / 86400000 - 3 + (w1.getDay() + 6) % 7) / 7); }; const cw = getWeek(now); let day = 0, week = 0, month = 0, year = 0; futureOrders.forEach(o => {
      if (o.status === 'Cancelado') return; const d = o.deliveryDate; const val = Number(o.total) || 0; if (d === today) day += val; if (d.startsWith(cm)) month += val; if (d.startsWith(cy)) year += val; if (getWeek(new Date(d)) === cw && d.startsWith(cy)) week += val;
    });
    return { day, week, month, year };
  }, [futureOrders]);

  return (
    <div className="font-sans bg-slate-100 min-h-screen text-slate-900">
      <div className="w-16 bg-slate-900 text-white flex flex-col items-center py-6 fixed h-full left-0 z-10 shadow-2xl justify-between">
        <div className="flex flex-col items-center gap-4 w-full mt-4">
          <div onClick={onBack} className="p-2 bg-yellow-500 rounded-lg mb-2 cursor-pointer hover:bg-yellow-400" title="Sair"><Store size={20} className="text-slate-900" /></div>
          <button onClick={() => setView('pos')} className={`p-2 rounded-xl ${view === 'pos' ? 'bg-blue-600' : 'text-slate-400 hover:text-white'}`}><ShoppingCart size={20} /></button>
          <button onClick={() => setView('tabs')} className={`p-2 rounded-xl relative ${view === 'tabs' ? 'bg-indigo-600' : 'text-slate-400 hover:text-white'}`}><ClipboardList size={20} />{orders.filter(o => o.paymentStatus === 'ABERTO').length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 w-2 h-2 rounded-full"></span>}</button>
          <button onClick={() => setView('kitchen')} className={`p-2 rounded-xl relative ${view === 'kitchen' ? 'bg-orange-600' : 'text-slate-400 hover:text-white'}`}><ChefHat size={20} />{orders.filter(o => o.kitchenStatus === 'Pendente').length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 w-2 h-2 rounded-full animate-pulse"></span>}</button>
          <button onClick={() => setView('orders')} className={`p-2 rounded-xl ${view === 'orders' ? 'bg-pink-600' : 'text-slate-400 hover:text-white'}`}><Cake size={20} /></button>
          <button onClick={() => setView('cash')} className={`p-2 rounded-xl ${view === 'cash' ? 'bg-emerald-600' : 'text-slate-400 hover:text-white'}`}><Coins size={20} /></button>
          <button onClick={() => setView('admin')} className={`p-2 rounded-xl ${view === 'admin' ? 'bg-purple-600' : 'text-slate-400 hover:text-white'}`}><LayoutDashboard size={20} /></button>
          <button onClick={handleSettingsAccess} className={`p-2 rounded-xl ${view === 'settings' ? 'bg-gray-600 text-white' : 'text-slate-400 hover:text-white'}`}><Settings size={20} /></button>
        </div>
      </div>

      {showSettingsPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-xl font-bold text-slate-800 mb-4 text-center">Acesso Configurações</h3>
            <input type="password" autoFocus placeholder="Senha" className="w-full border p-3 rounded-xl mb-4 text-center text-lg outline-none focus:border-gray-500" value={settingsPasswordInput} onChange={(e) => setSettingsPasswordInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitSettingsPassword()} />
            <div className="flex gap-2"><button onClick={() => setShowSettingsPasswordModal(false)} className="flex-1 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-xl">Cancelar</button><button onClick={submitSettingsPassword} className="flex-1 bg-gray-800 text-white py-2 rounded-xl font-bold hover:bg-gray-900">Acessar</button></div>
          </div>
        </div>
      )}

      {/* MODAL DE AUTORIZAÇÃO DE AÇÃO (EDITAR/CANCELAR) */}
      {actionAuthModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-red-100 animate-in zoom-in-95">
            <div className="flex justify-center mb-4 text-red-500"><AlertOctagon size={48} /></div>
            <h3 className="text-xl font-bold text-slate-800 mb-2 text-center">{actionAuthModal.action === 'cancel' ? 'Cancelar Pedido' : 'Editar Pedido'}</h3>
            <p className="text-sm text-slate-500 mb-4 text-center">Esta ação requer autorização de gerente.</p>
            <input
              type="password"
              autoFocus
              placeholder="Senha do Caixa"
              className="w-full border border-slate-300 rounded-xl p-3 text-center text-lg font-bold tracking-widest outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 mb-4"
              value={actionPassword}
              onChange={(e) => setActionPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmActionAuth()}
            />
            <div className="flex gap-2">
              <button onClick={() => { setActionAuthModal({ show: false, action: null, order: null }); setActionPassword(''); }} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
              <button onClick={confirmActionAuth} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-500/20">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {view === 'settings' && (
        <div className="pl-16 p-8 h-screen overflow-y-auto bg-slate-50">
          <h1 className="text-3xl font-bold text-slate-800 mb-8 flex items-center gap-3"><Settings size={32} className="text-gray-600" /> Configurações da Loja</h1>
          <div className="max-w-2xl bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
            <div className="grid grid-cols-1 gap-6">
              <h3 className="font-bold text-lg border-b pb-2 text-slate-700">Dados do Estabelecimento</h3>
              <div><label className="block text-sm font-bold text-slate-500 mb-1">Nome da Loja</label><input value={configForm.storeName} onChange={e => setConfigForm({ ...configForm, storeName: e.target.value })} className="w-full border p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: Minha Confeitaria" /></div>
              <div><label className="block text-sm font-bold text-slate-500 mb-1">Endereço Completo</label><input value={configForm.address} onChange={e => setConfigForm({ ...configForm, address: e.target.value })} className="w-full border p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex gap-4 mb-1">
                    <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="docType" checked={configForm.docType === 'CNPJ'} onChange={() => setConfigForm({ ...configForm, docType: 'CNPJ', docId: '' })} /><span className="text-sm font-bold text-slate-500">CNPJ</span></label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="docType" checked={configForm.docType === 'CPF'} onChange={() => setConfigForm({ ...configForm, docType: 'CPF', docId: '' })} /><span className="text-sm font-bold text-slate-500">CPF</span></label>
                  </div>
                  <input
                    value={configForm.docId}
                    onChange={e => {
                      const val = configForm.docType === 'CPF' ? maskCpf(e.target.value) : maskCnpj(e.target.value);
                      setConfigForm({ ...configForm, docId: val });
                    }}
                    className="w-full border p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={configForm.docType === 'CPF' ? '000.000.000-00' : '00.000.000/0000-00'}
                  />
                </div>
                <div><label className="block text-sm font-bold text-slate-500 mb-1">Telefone / WhatsApp</label><input value={configForm.phone} onChange={e => setConfigForm({ ...configForm, phone: e.target.value })} className="w-full border p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" /></div>
              </div>
              <h3 className="font-bold text-lg border-b pb-2 text-slate-700 mt-4">Segurança</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-purple-50 p-4 rounded-xl border border-purple-100"><label className="block text-sm font-bold text-purple-700 mb-1">Senha Caixa</label><input type="text" value={configForm.posPassword} onChange={e => setConfigForm({ ...configForm, posPassword: e.target.value })} className="w-full border p-2 rounded-lg outline-none bg-white" /></div>
                <div className="bg-gray-100 p-4 rounded-xl border border-gray-200"><label className="block text-sm font-bold text-gray-700 mb-1">Senha Config</label><input type="text" value={configForm.settingsPassword} onChange={e => setConfigForm({ ...configForm, settingsPassword: e.target.value })} className="w-full border p-2 rounded-lg outline-none bg-white" /></div>
              </div>
              <button onClick={saveSettings} className="bg-green-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-green-700 shadow-lg shadow-green-600/20 mt-4">Salvar Configurações</button>
            </div>
          </div>
        </div>
      )}

      {view === 'pos' && (
        <div className="flex h-screen pl-16">
          <div className="flex-1 p-6 overflow-y-auto">
            <h1 className="text-2xl font-bold mb-4">Novo Pedido (Balcão)</h1>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{products.map(p => (<button key={p.id} onClick={() => addToCart(p)} disabled={p.stock <= 0} className={`bg-white p-4 rounded-2xl shadow-sm border flex flex-col text-left transition-all active:scale-95 ${p.stock <= 0 ? 'opacity-50' : 'hover:border-blue-300'}`}><div className="flex justify-between mb-2"><IconMapper type={p.icon} className="w-6 h-6 text-blue-600" /> <span className="font-bold">R$ {Number(p.price).toFixed(2)}</span></div><div className="font-bold text-slate-800">{p.name}</div><div className="text-xs text-slate-400">{p.stock} un</div></button>))}</div>
          </div>
          <div className="w-96 bg-white border-l shadow-xl flex flex-col">
            <div className="p-4 border-b bg-slate-50 font-bold text-lg flex gap-2 items-center"><ShoppingCart size={20} /> Carrinho</div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">{cart.map(item => (<div key={item.id} className="border rounded-lg p-3 relative group"><div className="flex justify-between"><div className="font-bold text-sm">{item.qty}x {item.name}</div><div className="font-bold text-sm">R$ {(item.price * item.qty).toFixed(2)}</div></div>{item.obs && <div className="text-xs text-orange-600 bg-orange-50 p-1 rounded mt-1">Obs: {item.obs}</div>}<div className="flex justify-end gap-2 mt-2"><button onClick={() => updateItemObs(item.id)} className="text-xs text-blue-500 flex items-center gap-1"><Edit3 size={12} /> Obs</button><button onClick={() => removeFromCart(item.id)} className="text-xs text-red-500 flex items-center gap-1"><Trash2 size={12} /> Remover</button></div></div>))}</div>
            <div className="p-4 border-t bg-slate-50"><div className="flex justify-between mb-4"><span className="text-slate-500">Total</span><span className="text-2xl font-bold">R$ {cartTotal.toFixed(2)}</span></div><button onClick={() => { if (cart.length > 0) { setSelectedTabToSettle(null); setCustomerName(''); setPartialPayments([]); setPaymentInputValue(''); setShowPaymentModal(true); } }} disabled={cart.length === 0} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold disabled:opacity-50">PAGAR</button></div>
          </div>
        </div>
      )}

      {view === 'orders' && (
        <div className="pl-16 p-8 h-screen overflow-y-auto bg-slate-50">
          <header className="mb-8 flex justify-between items-center"><h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3"><Cake size={32} className="text-pink-600" /> Encomendas e Bolos</h1><button onClick={() => { setEditingFutureOrder(null); setOrderClient(''); setOrderPhone(''); setOrderObs(''); setOrderSignal(''); setOrderTotalValue(''); setShowOrderModal(true); }} className="bg-pink-600 hover:bg-pink-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-pink-600/20 flex items-center gap-2 active:scale-95 transition-all"><PlusCircle size={20} /> Nova Encomenda</button></header>
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-pink-100"><div className="text-xs text-slate-500 uppercase font-bold mb-1">Total Hoje</div><div className="text-2xl font-bold text-pink-600">{formatMoney(orderMetrics.day)}</div></div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-pink-100"><div className="text-xs text-slate-500 uppercase font-bold mb-1">Total Semana</div><div className="text-2xl font-bold text-pink-600">{formatMoney(orderMetrics.week)}</div></div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-pink-100"><div className="text-xs text-slate-500 uppercase font-bold mb-1">Total Mês</div><div className="text-2xl font-bold text-pink-600">{formatMoney(orderMetrics.month)}</div></div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-pink-100"><div className="text-xs text-slate-500 uppercase font-bold mb-1">Total Ano</div><div className="text-2xl font-bold text-pink-600">{formatMoney(orderMetrics.year)}</div></div>
          </div>
          <div className="space-y-4">{futureOrders.map(order => (
            <div key={order.firestoreId} onClick={() => setSelectedFutureOrder(order)} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row gap-6 hover:shadow-md transition-shadow cursor-pointer relative group">
              {order.status === 'Concluído' && <div className="absolute top-4 right-4 text-green-600 bg-green-50 px-2 py-1 rounded text-xs font-bold flex items-center gap-1"><CheckCircle2 size={12} /> Entregue</div>}
              <div className={`flex flex-col items-center justify-center p-4 rounded-xl min-w-[100px] border ${order.status === 'Concluído' ? 'bg-slate-100 border-slate-200 text-slate-500' : 'bg-pink-50 border-pink-100 text-pink-800'}`}><span className="text-sm font-bold uppercase">{new Date(order.deliveryDate).toLocaleDateString('pt-BR', { month: 'short' })}</span><span className="text-3xl font-bold">{new Date(order.deliveryDate).getDate()}</span><span className="text-xs font-bold mt-1 bg-white px-2 py-0.5 rounded border border-pink-200">{order.deliveryTime}</span></div>
              <div className="flex-1">
                <div className="flex justify-between items-start mb-2"><div><h3 className="text-xl font-bold text-slate-800">{order.client}</h3><div className="flex items-center gap-2 mt-1"><p className="text-sm text-slate-500 font-medium flex items-center gap-1"><Phone size={12} /> {order.phone}</p><button onClick={(e) => { e.stopPropagation(); openWhatsApp(order.phone); }} className="bg-green-500 hover:bg-green-600 text-white p-1.5 rounded-full shadow-sm transition-colors" title="WhatsApp"><MessageCircle size={14} /></button></div></div><div className="text-right mr-8 md:mr-0"><div className="text-2xl font-bold text-slate-800">{formatMoney(order.total)}</div>{order.signal > 0 ? (<span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded">Sinal: {formatMoney(order.signal)}</span>) : (<span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded">Sem Sinal</span>)}</div></div>
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 mb-3"><p className="text-xs font-bold text-slate-400 uppercase mb-2">Descrição</p><p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{order.description}</p></div>
                <div className="flex gap-2 justify-end">
                  <button onClick={(e) => { e.stopPropagation(); openEditOrderModal(order); }} className="text-xs text-blue-600 hover:text-blue-800 font-bold px-3 py-1 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">Editar</button>
                  <button onClick={(e) => { e.stopPropagation(); if (window.confirm('Excluir?')) deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'future_orders', order.firestoreId)); }} className="text-xs text-red-400 hover:text-red-600 font-bold z-10 px-3 py-1 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">Excluir</button>
                </div>
              </div>
            </div>
          ))}</div>
        </div>
      )}

      {view === 'tabs' && (
        <div className="pl-16 p-8 h-screen overflow-y-auto">
          <h1 className="text-2xl font-bold mb-6">Comandas Abertas</h1>
          <div className="grid grid-cols-4 gap-4">
            {orders.filter(o => o.paymentStatus === 'ABERTO').map(o => (
              <div key={o.id} className="bg-white p-4 rounded-xl shadow border border-indigo-100 relative overflow-hidden group">
                {o.origin === 'Mobile' && <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded-bl-lg">App</div>}
                <div className="font-bold text-lg text-indigo-900">{o.client}</div>
                <div className="text-xs text-gray-500 font-bold mb-2">Garçom: {o.waiter || 'Balcão'}</div>
                <div className="text-sm text-slate-500 mb-2">{o.items ? o.items.length : 0} itens • R$ {Number(o.total).toFixed(2)}</div>
                <div className="flex gap-2">
                  <button onClick={() => { setSelectedTabToSettle(o); setPartialPayments([]); setPaymentInputValue(''); setShowPaymentModal(true); }} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-bold text-sm transition-colors">Receber</button>
                  <button onClick={() => setActionAuthModal({ show: true, action: 'edit', order: o })} className="bg-blue-100 text-blue-600 hover:bg-blue-200 p-2 rounded-lg transition-colors" title="Editar"><Edit3 size={18} /></button>
                  <button onClick={() => setActionAuthModal({ show: true, action: 'cancel', order: o })} className="bg-red-100 text-red-600 hover:bg-red-200 p-2 rounded-lg transition-colors" title="Cancelar"><Trash2 size={18} /></button>
                </div>
              </div>
            ))}
            {orders.filter(o => o.paymentStatus === 'ABERTO').length === 0 && (
              <div className="col-span-4 text-center text-gray-400 py-10">Nenhuma comanda aberta no momento.</div>
            )}
          </div>
        </div>
      )}

      {view === 'kitchen' && <div className="pl-16 p-8 h-screen overflow-y-auto"><h1 className="text-2xl font-bold mb-6">Cozinha</h1><div className="grid grid-cols-4 gap-4">{orders.filter(o => o.kitchenStatus === 'Pendente').map(o => (<div key={o.id} className="bg-white border-l-4 border-orange-500 p-4 rounded shadow"><div className="flex justify-between"><span className="font-bold">#{String(o.id).slice(0, 4)} {o.client}</span><span className="text-xs">{o.time}</span></div><hr className="my-2" /><ul className="text-sm mb-4">{o.items && o.items.map((i, idx) => <li key={idx}><b>{i.qty}x</b> {i.name}</li>)}</ul><button onClick={() => updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'orders', o.firestoreId), { kitchenStatus: 'Pronto' })} className="w-full bg-orange-100 text-orange-700 py-2 rounded font-bold">Pronto</button></div>))}</div></div>}
      {view === 'cash' && <CashControl user={user} orders={orders} />}

      {view === 'admin' && (
        <div className="pl-16 p-8 h-screen overflow-y-auto bg-slate-50">
          <header className="mb-8 flex justify-between items-center">
            <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3"><LayoutDashboard size={32} className="text-purple-600" /> Dashboard</h1>
            <div className="flex gap-2">
              <button onClick={() => setShowCashMovementModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm flex items-center gap-2"><ArrowRightLeft size={16} /> Movimentação</button>
              <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200"><button onClick={() => setReportMode('daily')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${reportMode === 'daily' ? 'bg-blue-100 text-blue-700' : 'text-slate-500'}`}>Diário</button><button onClick={() => setReportMode('monthly')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${reportMode === 'monthly' ? 'bg-blue-100 text-blue-700' : 'text-slate-500'}`}>Mensal</button></div>
            </div>
          </header>
          <div className="mb-8 flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-4"><button onClick={() => reportMode === 'daily' ? changeDate(-1) : changeMonth(-1)} className="p-2 hover:bg-slate-100 rounded-full"><ChevronLeft size={24} className="text-slate-600" /></button><div className="flex items-center gap-2"><Calendar size={24} className="text-blue-600" /><span className="text-xl font-bold text-slate-800 capitalize">{reportMode === 'daily' ? reportDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }) : reportDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span></div><button onClick={() => reportMode === 'daily' ? changeDate(1) : changeMonth(1)} className="p-2 hover:bg-slate-100 rounded-full"><ChevronRight size={24} className="text-slate-600" /></button></div><button onClick={() => setReportDate(new Date())} className="text-sm font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">Hoje</button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between"><div><div className="text-emerald-700 text-sm font-bold uppercase mb-1 flex items-center gap-2"><ArrowUpCircle size={16} /> Entrada Caixa (Suprimento)</div><div className="text-3xl font-bold text-slate-800">{formatMoney(totalSuprimento)}</div></div><div className="bg-emerald-100 p-3 rounded-full text-emerald-600"><Coins size={24} /></div></div>
              <div className="p-6 bg-red-50 rounded-2xl border border-red-100 flex items-center justify-between"><div><div className="text-red-700 text-sm font-bold uppercase mb-1 flex items-center gap-2"><ArrowDownCircle size={16} /> Saída Caixa (Sangria)</div><div className="text-3xl font-bold text-slate-800">{formatMoney(totalSangria)}</div></div><div className="bg-red-100 p-3 rounded-full text-red-600"><Wallet size={24} /></div></div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6"><div className="p-4 bg-blue-50 rounded-2xl border border-blue-100"><div className="text-blue-700 text-sm font-bold uppercase mb-1 flex items-center gap-2"><DollarSign size={16} /> Faturamento</div><div className="text-4xl font-bold text-slate-800">R$ {totalSales.toFixed(2)}</div></div><div className="p-4 bg-purple-50 rounded-2xl border border-purple-100"><div className="text-purple-700 text-sm font-bold uppercase mb-1 flex items-center gap-2"><ShoppingCart size={16} /> Vendas</div><div className="text-4xl font-bold text-slate-800">{filteredOrders.length}</div></div><div className="p-4 bg-amber-50 rounded-2xl border border-amber-100"><div className="text-amber-700 text-sm font-bold uppercase mb-1 flex items-center gap-2"><User size={16} /> Tkt Médio</div><div className="text-4xl font-bold text-slate-800">R$ {filteredOrders.length > 0 ? (totalSales / filteredOrders.length).toFixed(2) : '0.00'}</div></div></div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-2"><h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2"><Wallet size={18} className="text-blue-500" /> Detalhamento Financeiro</h3><div className="overflow-hidden rounded-xl border border-slate-100"><table className="w-full text-left"><thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold"><tr><th className="p-4">Método</th><th className="p-4 text-right">Valor Total</th></tr></thead><tbody className="divide-y divide-slate-100 text-sm"><tr><td className="p-4 font-medium text-slate-700">PIX</td><td className="p-4 text-right font-mono">R$ {salesByMethod.pix.toFixed(2)}</td></tr><tr><td className="p-4 font-medium text-slate-700">Dinheiro</td><td className="p-4 text-right font-mono">R$ {salesByMethod.dinheiro.toFixed(2)}</td></tr><tr><td className="p-4 font-medium text-slate-700">Cartão</td><td className="p-4 text-right font-mono">R$ {salesByMethod.cartao.toFixed(2)}</td></tr><tr className="bg-slate-50"><td className="p-4 font-bold text-slate-800 uppercase">Total Geral</td><td className="p-4 text-right font-bold text-slate-900 font-mono text-lg">R$ {totalSales.toFixed(2)}</td></tr></tbody></table></div></div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-1"><h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2"><TrendingUp size={18} className="text-yellow-500" /> Mais Vendidos</h3>
              <div className="space-y-4">{(Object.entries(filteredOrders.reduce((a, o) => { o.items?.forEach(i => { a[i.name] = (a[i.name] || 0) + i.qty }); return a; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5)).map(([n, q], i) => (<div key={i}><div className="flex justify-between text-sm mb-1"><span className="font-bold">{i + 1}. {n}</span><span>{q} un</span></div><div className="w-full bg-slate-100 h-2 rounded-full"><div className="h-full bg-blue-500 rounded-full" style={{ width: '100%' }}></div></div></div>))}</div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-3"><h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2"><Plus size={18} className="text-emerald-500" /> Gerenciar Produtos</h3><div className="space-y-4 mb-6 p-4 bg-slate-50 rounded-xl"><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome</label><input value={newProdName} onChange={(e) => setNewProdName(e.target.value)} className="w-full p-3 border border-slate-200 bg-white rounded-xl outline-none" placeholder="Ex: X-Tudo" /></div><div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Preço</label><input type="number" value={newProdPrice} onChange={(e) => setNewProdPrice(e.target.value)} className="w-full p-3 border border-slate-200 bg-white rounded-xl outline-none" placeholder="0.00" /></div><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Categoria</label><select value={newProdCat} onChange={(e) => setNewProdCat(e.target.value)} className="w-full p-3 border border-slate-200 bg-white rounded-xl outline-none">{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div></div><button onClick={addNewProduct} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20 active:scale-95">Adicionar Produto</button></div><div className="overflow-x-auto"><table className="w-full text-left border-collapse"><thead><tr className="border-b border-slate-100 text-slate-400 text-xs uppercase tracking-wider"><th className="pb-3 pl-2 font-medium">Produto</th><th className="pb-3 font-medium">Categoria</th><th className="pb-3 font-medium">Preço</th><th className="pb-3 font-medium">Estoque</th><th className="pb-3 font-medium text-right">Ações</th></tr></thead><tbody className="text-sm">{products.map(p => (<tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/80 transition-colors group"><td className="py-3 pl-2 font-semibold text-slate-700">{p.name}</td><td className="py-3 text-slate-500"><span className="px-2 py-1 bg-slate-100 rounded text-xs">{p.category}</span></td><td className="py-3 text-slate-600">R$ {Number(p.price).toFixed(2)}</td><td className="py-3"><span className={`px-2 py-1 rounded text-xs font-bold ${p.stock < 10 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>{p.stock} un</span></td><td className="py-3 text-right"><button onClick={() => setEditingProduct(p)} className="text-slate-400 hover:text-blue-600 font-medium text-xs opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 hover:bg-blue-50 rounded flex items-center gap-1 ml-auto"><Edit3 size={14} /> Editar</button></td></tr>))}</tbody></table></div></div>
          </div>
        </div>
      )}

      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 bg-slate-50 border-b flex justify-between items-center"><h3 className="font-bold text-lg text-slate-800">Pagamento</h3><button onClick={() => setShowPaymentModal(false)}><X size={20} /></button></div>
            <div className="p-6 overflow-y-auto">
              <div className="flex justify-between items-end mb-6 bg-slate-100 p-4 rounded-xl"><div><div className="text-xs text-slate-500 font-bold uppercase">Total</div><div className="text-3xl font-bold text-slate-800">R$ {modalTotal.toFixed(2)}</div></div><div className="text-right"><div className="text-xs text-slate-500 font-bold uppercase">Falta</div><div className={`text-xl font-bold ${modalRemaining === 0 ? 'text-green-600' : 'text-red-500'}`}>R$ {modalRemaining.toFixed(2)}</div></div></div>
              {modalRemaining > 0 && (<div className="mb-6"><div className="flex gap-2 mb-3"><div className="relative flex-1"><span className="absolute left-3 top-3 text-slate-400">R$</span><input type="number" placeholder={modalRemaining.toFixed(2)} value={paymentInputValue} onChange={e => setPaymentInputValue(e.target.value)} className="w-full pl-10 p-3 border border-slate-300 rounded-xl font-bold text-lg outline-none focus:border-blue-500" /></div></div><div className="grid grid-cols-4 gap-2">{['Dinheiro', 'Crédito', 'Débito', 'Pix'].map(m => (<button key={m} onClick={() => { const val = paymentInputValue ? parseFloat(paymentInputValue) : modalRemaining; setPartialPayments([...partialPayments, { method: m, value: val }]); setPaymentInputValue(''); }} className="py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 transition-colors">{m}</button>))}</div></div>)}
              {!selectedTabToSettle && partialPayments.length === 0 && (
                <div className="pt-4 border-t border-slate-100">
                  <div className="text-xs font-bold text-slate-400 uppercase mb-2">Ou Pendurar na Mesa</div>
                  <div className="grid grid-cols-5 gap-2 mb-3">
                    {MESAS.map(m => {
                      const occupied = orders.some(o => o?.client === m && o?.paymentStatus === 'ABERTO');
                      return (
                        <button
                          key={m}
                          onClick={() => finalizeOrder(m, 'ABERTO')}
                          className={`py-2 text-[10px] font-bold rounded border ${occupied ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-500'}`}
                        >
                          {m.replace('Mesa ', '')}
                        </button>
                      )
                    })}
                  </div>
                  <div className="flex gap-2">
                    <input placeholder="Nome Cliente (Balcão)" value={customerName} onChange={e => setCustomerName(e.target.value)} className="flex-1 border p-2 rounded-lg text-sm" />
                    <button onClick={() => finalizeOrder(customerName, 'ABERTO')} disabled={!customerName} className="bg-orange-500 text-white px-4 rounded-lg font-bold text-sm disabled:opacity-50">Abrir</button>
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 bg-slate-50 border-t"><button onClick={() => finalizeOrder(selectedTabToSettle?.client || 'Balcão', 'PAGO')} disabled={modalRemaining > 0} className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-green-600/20 transition-all">{modalRemaining > 0 ? `Falta R$ ${modalRemaining.toFixed(2)}` : 'FINALIZAR VENDA'}</button></div>
          </div>
        </div>
      )}

      {selectedFutureOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-5 bg-slate-900 text-white flex justify-between items-center"><h3 className="font-bold text-lg">{selectedFutureOrder.client}</h3><button onClick={() => setSelectedFutureOrder(null)}><X size={20} /></button></div>
            <div className="p-6">
              <div className="bg-slate-50 p-4 rounded-xl border mb-6 text-sm flex justify-between"><span>Restante a Pagar:</span><span className="font-bold text-red-500 text-lg">{formatMoney(selectedFutureOrder.total - selectedFutureOrder.signal)}</span></div>
              <button onClick={() => printOrder(selectedFutureOrder, settings)} className="w-full mb-4 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold flex items-center justify-center gap-2"><Printer size={18} /> Imprimir / PDF</button>
              {selectedFutureOrder.status !== 'Concluído' ? (
                <div className="space-y-4">
                  <input type="number" step="0.01" placeholder="Valor Recebido" className="w-full p-3 border rounded-xl font-bold text-lg" value={settleValue} onChange={e => setSettleValue(e.target.value)} />
                  <div className="grid grid-cols-3 gap-2">{['Pix', 'Dinheiro', 'Cartão'].map(m => (<button key={m} onClick={() => setSettleMethod(m)} className={`py-2 rounded-lg text-sm font-bold border ${settleMethod === m ? 'bg-blue-600 text-white' : 'bg-white'}`}>{m}</button>))}</div>
                  <button onClick={handleSettleOrder} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold">Confirmar e Entregar</button>
                </div>
              ) : <div className="text-center py-4 text-green-600 font-bold bg-green-50 rounded-xl border border-green-100">Encomenda Finalizada!</div>}
            </div>
          </div>
        </div>
      )}

      {showCashMovementModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white p-6 rounded-2xl w-96 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg text-slate-800">Nova Movimentação</h3><button onClick={() => setShowCashMovementModal(false)}><X size={20} className="text-slate-400 hover:text-slate-600" /></button></div>
            <div className="flex bg-slate-100 p-1 rounded-lg mb-4"><button onClick={() => setMovementType('suprimento')} className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${movementType === 'suprimento' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}>Suprimento</button><button onClick={() => setMovementType('sangria')} className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${movementType === 'sangria' ? 'bg-red-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}>Sangria</button></div>
            <div className="mb-3"><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Valor (R$)</label><input type="number" step="0.01" autoFocus value={movementValue} onChange={e => setMovementValue(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl text-lg font-bold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="0.00" /></div>
            <div className="mb-6"><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Descrição</label><input type="text" value={movementDesc} onChange={e => setMovementDesc(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="Ex: Troco inicial..." /></div>
            <button onClick={handleAddCashMovement} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">Confirmar</button>
          </div>
        </div>
      )}

      {showOrderModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 bg-pink-600 text-white flex justify-between items-center"><h3 className="font-bold text-xl flex items-center gap-2"><Cake /> {editingFutureOrder ? 'Editar Encomenda' : 'Nova Encomenda'}</h3><button onClick={() => setShowOrderModal(false)}><X size={24} /></button></div>
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-4">
              <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Cliente</label><input ref={clientRef} value={orderClient} onChange={e => setOrderClient(e.target.value)} onKeyDown={e => handleOrderKeyDown(e, phoneRef)} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-pink-500" placeholder="Ex: Maria Silva" autoFocus /></div>
              <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Telefone</label><input ref={phoneRef} value={orderPhone} onChange={e => setOrderPhone(e.target.value)} onKeyDown={e => handleOrderKeyDown(e, dateRef)} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-pink-500" placeholder="(00) 00000-0000" /></div><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Entrega</label><input ref={dateRef} type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} onKeyDown={e => handleOrderKeyDown(e, timeRef)} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-pink-500" /></div></div>
              <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Horário</label><input ref={timeRef} type="time" value={orderTime} onChange={e => setOrderTime(e.target.value)} onKeyDown={e => handleOrderKeyDown(e, totalRef)} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-pink-500" /></div><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1 text-pink-700">Valor Total (R$)</label><input ref={totalRef} type="number" step="0.01" value={orderTotalValue} onChange={e => setOrderTotalValue(e.target.value)} onKeyDown={e => handleOrderKeyDown(e, obsRef)} className="w-full p-3 border border-pink-200 bg-pink-50/50 rounded-xl outline-none focus:ring-2 focus:ring-pink-500 font-bold text-pink-700" placeholder="0.00" /></div></div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex justify-between">
                  Descrição
                  <button onClick={handleImproveDescription} disabled={isAiLoading} className="text-pink-600 hover:text-pink-800 flex items-center gap-1 text-[10px] bg-pink-50 px-2 rounded-full border border-pink-100 disabled:opacity-50">
                    {isAiLoading ? <Loader2 size={10} className="animate-spin"/> : <Sparkles size={10}/>} Melhorar com IA
                  </button>
                </label>
                <textarea ref={obsRef} value={orderObs} onChange={e => setOrderObs(e.target.value)} onKeyDown={e => handleOrderKeyDown(e, signalRef)} className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-pink-500 h-28 resize-none" placeholder="Ex: Bolo de chocolate com morango, escrever Parabéns Maria..." />
              </div>
              <div className="bg-slate-100 p-4 rounded-xl border border-slate-200"><div className="flex justify-between mb-2"><label className="block text-xs font-bold text-slate-500 uppercase">Sinal</label><span className="text-xs font-bold text-pink-600">Falta: {formatMoney((parseFloat(orderTotalValue) || 0) - (parseFloat(orderSignal) || 0))}</span></div><div className="grid grid-cols-2 gap-3"><input ref={signalRef} type="number" step="0.01" value={orderSignal} onChange={e => setOrderSignal(e.target.value)} onKeyDown={e => handleOrderKeyDown(e, signalMethodRef)} className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-pink-500" placeholder="Valor Pago" /><select ref={signalMethodRef} value={orderSignalMethod} onChange={e => setOrderSignalMethod(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-pink-500 bg-white"><option value="Pix">Pix</option><option value="Dinheiro">Dinheiro</option><option value="Cartão">Cartão</option></select></div></div>
            </div>
            <div className="p-4 bg-white border-t flex justify-end gap-3"><button onClick={() => setShowOrderModal(false)} className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors">Cancelar</button><button onClick={saveFutureOrder} className="px-8 py-3 rounded-xl font-bold bg-pink-600 text-white hover:bg-pink-700 shadow-lg shadow-pink-600/20 transition-all active:scale-95">Salvar</button></div>
          </div>
        </div>
      )}

      {editingProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center"><h3 className="text-xl font-bold text-slate-800">Editar Produto</h3><button onClick={() => setEditingProduct(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={20} /></button></div>
            <div className="p-6 space-y-4">
              <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome</label><input value={editingProduct.name} onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })} className="w-full p-3 border border-slate-200 bg-slate-50 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" /></div>
              <div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Preço</label><input type="number" value={editingProduct.price} onChange={(e) => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) })} className="w-full p-3 border border-slate-200 bg-slate-50 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" /></div><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Categoria</label><select value={editingProduct.category} onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })} className="w-full p-3 border border-slate-200 bg-slate-50 rounded-xl outline-none">{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div></div>
              <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Estoque</label><div className="flex items-center gap-3"><button onClick={() => setEditingProduct({ ...editingProduct, stock: Math.max(0, editingProduct.stock - 1) })} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200"><Trash2 size={16} /></button><input type="number" value={editingProduct.stock} onChange={(e) => setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value) || 0 })} className="flex-1 p-3 border border-slate-200 bg-slate-50 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-center font-bold" /><button onClick={() => setEditingProduct({ ...editingProduct, stock: editingProduct.stock + 1 })} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200"><Plus size={16} /></button></div></div>
              <div className="pt-4 flex gap-3"><button onClick={handleDeleteProduct} className="p-3 bg-red-50 text-red-500 font-bold hover:bg-red-100 rounded-xl transition-colors"><Trash2 size={20} /></button><button onClick={() => setEditingProduct(null)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors">Cancelar</button><button onClick={handleUpdateProduct} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20">Salvar Alterações</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --------------------------------------------------------------------------------
// APP PRINCIPAL
// --------------------------------------------------------------------------------
export default function App() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [appMode, setAppMode] = useState('landing');
  const [mobileRole, setMobileRole] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [storeSettings, setStoreSettings] = useState({ storeName: 'Confeitaria', address: '', cnpj: '', phone: '', posPassword: '1234', settingsPassword: '1234' });

  // Novos states para login do cliente
  const [showClientModal, setShowClientModal] = useState(false);
  const [clientNameInput, setClientNameInput] = useState('');
  const [clientPhoneInput, setClientPhoneInput] = useState('');

  useEffect(() => {
    const init = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) {
        console.error("Erro Auth:", e);
        if (e.code === 'auth/operation-not-allowed') {
          alert("Erro: Ative o login Anônimo no Console do Firebase.");
        }
      }
    };
    init();
    return onAuthStateChanged(auth, u => {
      setFirebaseUser(u);
      if (u) {
        getDoc(doc(db, 'artifacts', appId, 'users', u.uid, 'app_state', 'settings')).then(s => {
          if (s.exists()) setStoreSettings(s.data());
        });
      }
    });
  }, []);

  const submitPassword = () => {
    const currentPass = storeSettings.posPassword || '1234';
    if (passwordInput === currentPass) {
      setShowPasswordModal(false);
      setAppMode('pos');
      setPasswordInput('');
    } else {
      alert('Senha incorreta!');
      setPasswordInput('');
    }
  };

  const handleClientLogin = () => {
    if (!clientNameInput || !clientPhoneInput) {
      alert("Por favor, preencha seu nome e telefone.");
      return;
    }

    // Abre WhatsApp da Loja
    if (storeSettings.phone) {
      const cleanPhone = storeSettings.phone.replace(/\D/g, '');
      const text = `Olá, me chamo ${clientNameInput}. Gostaria de ver o cardápio e fazer um pedido.`;
      const url = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
    }

    setMobileRole(clientNameInput);
    setAppMode('mobile');
    setShowClientModal(false);
  };

  if (!firebaseUser) return <div className="h-screen flex items-center justify-center bg-slate-900 text-white"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div></div>;

  return (
    appMode === 'mobile' ? <MobileView user={firebaseUser} initialRole={mobileRole} onBack={() => setAppMode('landing')} /> :
      appMode === 'pos' ? <PosView user={firebaseUser} onBack={() => setAppMode('landing')} initialSettings={storeSettings} refreshSettings={setStoreSettings} /> :
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
          <div className="z-10 w-full max-w-4xl text-center">
            <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-2 tracking-tight">{storeSettings.storeName || "CONFEITARIA & CAFÉ"}</h1>
            <h2 className="text-2xl text-slate-300 font-light mb-12">Sistema Integrado</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <button onClick={() => setShowClientModal(true)} className="group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-500/50 p-8 rounded-3xl transition-all duration-300 hover:-translate-y-2"><div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform"><UserCircle2 size={40} className="text-white" /></div><h2 className="text-2xl font-bold text-white mb-2">Cliente</h2><p className="text-sm text-slate-400">Cardápio digital.</p></button>
              <button onClick={() => { setMobileRole('Garçom'); setAppMode('mobile'); }} className="group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-orange-500/50 p-8 rounded-3xl transition-all duration-300 hover:-translate-y-2"><div className="w-20 h-20 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg shadow-orange-500/30 group-hover:scale-110 transition-transform"><ChefHat size={40} className="text-white" /></div><h2 className="text-2xl font-bold text-white mb-2">Garçom</h2><p className="text-sm text-slate-400">Lançar pedidos.</p></button>
              <button onClick={() => setShowPasswordModal(true)} className="group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/50 p-8 rounded-3xl transition-all duration-300 hover:-translate-y-2"><div className="w-20 h-20 bg-gradient-to-br from-purple-400 to-purple-600 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg shadow-purple-500/30 group-hover:scale-110 transition-transform"><MonitorSmartphone size={40} className="text-white" /></div><h2 className="text-2xl font-bold text-white mb-2">Caixa / Cozinha</h2><p className="text-sm text-slate-400">Gestão completa.</p></button>
            </div>
          </div>

          {/* MODAL LOGIN CAIXA */}
          {showPasswordModal && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"><div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95"><h3 className="text-xl font-bold text-slate-800 mb-4 text-center">Acesso Restrito</h3><p className="text-sm text-slate-500 mb-4 text-center">Senha do Caixa</p><input type="password" autoFocus placeholder="Senha" className="w-full border border-slate-300 rounded-xl p-3 text-center text-lg font-bold tracking-widest outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 mb-4" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitPassword()} /><div className="flex gap-2"><button onClick={() => { setShowPasswordModal(false); setPasswordInput(''); }} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button><button onClick={submitPassword} className="flex-1 bg-purple-600 text-white py-3 rounded-xl font-bold hover:bg-purple-700 transition-colors shadow-lg shadow-purple-500/20">Entrar</button></div></div></div>)}

          {/* MODAL LOGIN CLIENTE */}
          {showClientModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4"><UserCircle2 size={32} /></div>
                  <h3 className="text-xl font-bold text-slate-800">Bem-vindo(a)!</h3>
                  <p className="text-sm text-slate-500">Identifique-se para começar.</p>
                </div>
                <div className="space-y-3 mb-6">
                  <input autoFocus placeholder="Seu Nome" className="w-full border border-slate-300 rounded-xl p-3 outline-none focus:border-blue-500" value={clientNameInput} onChange={(e) => setClientNameInput(e.target.value)} />
                  <input placeholder="Seu WhatsApp" className="w-full border border-slate-300 rounded-xl p-3 outline-none focus:border-blue-500" value={clientPhoneInput} onChange={(e) => setClientPhoneInput(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowClientModal(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-colors">Voltar</button>
                  <button onClick={handleClientLogin} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20">Entrar</button>
                </div>
              </div>
            </div>
          )}

          <div className="absolute bottom-6 text-slate-500 text-xs">Sistema Integrado v4.6 • Full Features</div>
        </div>
  );
}
