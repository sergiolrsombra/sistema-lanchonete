import React, { useState, useEffect, useMemo } from 'react';

// --- ÍCONES UNIVERSAIS (Compatíveis com qualquer versão do Vercel) ---
// Trocamos ícones novos por versões clássicas para evitar erros de build
import { 
  Utensils, ShoppingCart, Send, User, ChevronLeft, Minus, Plus, 
  CheckCircle, Search, ChefHat, UserCircle2, LayoutDashboard, 
  Trash2, Package, X, Coffee, Sandwich, 
  Wallet, Edit3, Loader2, ListPlus, 
  Printer, Settings, Gift,
  Smartphone, Repeat, AlertCircle
} from 'lucide-react';

import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, addDoc, onSnapshot, query, doc, updateDoc, deleteDoc, setDoc, getDoc, writeBatch, orderBy } from "firebase/firestore";

// --- CONFIGURAÇÃO DO FIREBASE ---
const manualConfig = {
  apiKey: "AIzaSyBlgCjSDNNGJPhsK-3vlJA1-5nNIxPzmg0",
  authDomain: "lanchonete-6b915.firebaseapp.com",
  projectId: "lanchonete-6b915",
  storageBucket: "lanchonete-6b915.firebasestorage.app",
  messagingSenderId: "894517269506",
  appId: "1:894517269506:web:3c25cf6a65cb4d4687831b"
};

const app = initializeApp(manualConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'lanchonete-joseane-sombra';

// --- FUNÇÃO DE IMPRESSÃO TÉRMICA ---
const printOrder = (order) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) { alert("Por favor, permita popups para imprimir."); return; }
  
  const itemsHtml = (order.items || []).map(i => 
    `<div>${i.qty}x ${i.name} <span style="float:right;">${(i.price * i.qty).toFixed(2)}</span></div>`
  ).join('');

  printWindow.document.write(`
    <html>
      <head>
        <title>Cupom</title>
        <style>
          body { font-family: 'Courier New', monospace; width: 300px; margin: 0; padding: 10px; font-size: 12px; }
          .header { text-align: center; margin-bottom: 10px; border-bottom: 1px dashed #000; padding-bottom: 5px; }
          .bold { font-weight: bold; }
          .row { display: flex; justify-content: space-between; margin: 2px 0; }
          .divider { border-top: 1px dashed #000; margin: 10px 0; }
          .footer { text-align: center; margin-top: 10px; font-size: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="bold" style="font-size: 14px;">CONFEITARIA JOSEANE SOMBRA</div>
          <div>Pedido #${order.id}</div>
          <div>${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</div>
        </div>
        <div class="content">
          <div class="bold">Cliente: ${order.client || 'Balcão'}</div>
          <div class="divider"></div>
          ${itemsHtml}
          <div class="divider"></div>
          <div class="row"><span class="bold">TOTAL</span><span class="bold">R$ ${(order.total || 0).toFixed(2)}</span></div>
          <div class="row"><span>Forma Pagto:</span><span>${order.method || 'Dinheiro'}</span></div>
        </div>
        <div class="footer">
          Obrigado pela preferência!<br/>
          Volte sempre.
        </div>
        <script>
          window.onload = function() { window.print(); window.close(); }
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

// --- DADOS PADRÃO ---
const DEFAULT_PRODUCTS_SEED = [
  { id: 1, name: 'Bolo de Pote', price: 12.00, category: 'Sobremesas', stock: 20, icon: 'dessert' },
  { id: 2, name: 'Torta de Frango', price: 15.00, category: 'Salgados', stock: 15, icon: 'burger' },
  { id: 3, name: 'Tapioca Mista', price: 18.00, category: 'Lanches', stock: 50, icon: 'burger' },
  { id: 4, name: 'Suco de Laranja', price: 10.00, category: 'Bebidas', stock: 30, icon: 'drink' },
];
const MESAS = Array.from({ length: 15 }, (_, i) => `Mesa ${String(i + 1).padStart(2, '0')}`);

// --- HELPERS ---
const formatMoney = (val) => {
  const n = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(n) || n === null || n === undefined) return 'R$ 0,00';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const getTodayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '--/--';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
  return dateStr;
};

const IconMapper = ({ type, className }) => {
  try {
    switch (type) {
      case 'burger': return <Sandwich className={className} />;
      case 'drink': return <Coffee className={className} />; 
      case 'dessert': return <Gift className={className} />; 
      default: return <Package className={className} />;
    }
  } catch (e) { return <Package className={className} />; }
};

// --- FLUXO DE CAIXA ---
const CashControl = ({ user, orders }) => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('entry');
  const [cashCounts, setCashCounts] = useState({ 
    bills: { 200: '', 100: '', 50: '', 20: '', 10: '', 5: '', 2: '' }, 
    coins: { 1: '', 0.50: '', 0.25: '', 0.10: '', 0.05: '' }, 
    pix: '' 
  });
  const [date, setDate] = useState(getTodayStr());
  const [pix, setPix] = useState(''); const [cash, setCash] = useState(''); const [card, setCard] = useState('');
  
  useEffect(() => {
    if (!user) return;
    const u = onSnapshot(query(collection(db, 'artifacts', appId, 'users', user.uid, 'records_v2')), s => {
        setRecords(s.docs.map(d => ({id:d.id, ...d.data()})).sort((a,b)=>(a.date || '').localeCompare(b.date || '')));
        setLoading(false);
    });
    getDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'app_state', 'calculator')).then(s => { 
        if(s.exists()) {
            const data = s.data();
            setCashCounts({
                bills: { ...cashCounts.bills, ...(data.bills || {}) },
                coins: { ...cashCounts.coins, ...(data.coins || {}) },
                pix: data.pix || ''
            });
        } 
    });
    return () => u();
  }, [user]);

  useEffect(() => { if(user) setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'app_state', 'calculator'), cashCounts); }, [cashCounts, user]);

  const posTotals = useMemo(() => {
    if (!orders) return { pix: 0, cash: 0, card: 0 };
    const daily = orders.filter(o => o?.paymentStatus === 'PAGO' && (o.paidAt || o.date)?.startsWith(date));
    const acc = { pix: 0, cash: 0, card: 0 };
    daily.forEach(o => {
        if(o.payments && Array.isArray(o.payments)) o.payments.forEach(p => { const v = Number(p.value)||0; if(p.method==='Dinheiro') acc.cash+=v; else if((p.method||'').includes('Pix')) acc.pix+=v; else acc.card+=v; });
        else { const v = Number(o.total)||0; if((o.method||'').includes('Dinheiro')) acc.cash+=v; else if((o.method||'').includes('Pix')) acc.pix+=v; else acc.card+=v; }
    });
    return acc;
  }, [orders, date]);

  const handleSave = async () => { await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'records_v2'), { date, pix: parseFloat(pix)||0, cash: parseFloat(cash)||0, card: parseFloat(card)||0, total: (parseFloat(pix)||0)+(parseFloat(cash)||0)+(parseFloat(card)||0) }); setPix(''); setCash(''); setCard(''); alert('Salvo!'); };
  const handleDelete = (id) => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'records_v2', id));

  const billKeys = cashCounts?.bills ? Object.keys(cashCounts.bills).reverse() : [];
  const coinKeys = cashCounts?.coins ? Object.keys(cashCounts.coins).reverse() : [];

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-blue-600"/></div>;

  return (
    <div className="bg-gray-50 min-h-screen p-8 pl-24 w-full">
      <div className="flex gap-2 mb-6"><button onClick={()=>setCurrentView('entry')} className={`px-4 py-2 rounded-full font-bold flex items-center gap-2 ${currentView==='entry'?'bg-blue-600 text-white':'bg-white'}`}><ListPlus size={16}/> Lançamentos</button><button onClick={()=>setCurrentView('cash')} className={`px-4 py-2 rounded-full font-bold flex items-center gap-2 ${currentView==='cash'?'bg-blue-600 text-white':'bg-white'}`}><Wallet size={16}/> Contar Caixa</button></div>
      {currentView === 'entry' && (
          <div>
            <div className="bg-white p-4 rounded-xl shadow mb-4"><div className="mb-2 text-sm text-gray-500">Do Sistema: Pix {formatMoney(posTotals.pix)} | Din {formatMoney(posTotals.cash)}</div><div className="grid grid-cols-4 gap-2"><input type="date" value={date} onChange={e=>setDate(e.target.value)} className="border p-2 rounded"/><input placeholder="Pix" value={pix} onChange={e=>setPix(e.target.value)} className="border p-2 rounded"/><input placeholder="Dinheiro" value={cash} onChange={e=>setCash(e.target.value)} className="border p-2 rounded"/><button onClick={handleSave} className="bg-blue-600 text-white rounded font-bold">Salvar</button></div></div>
            <div className="bg-white rounded-xl shadow p-4">
                {records.filter(r => r.date === date).map(r => (<div key={r.id} className="flex justify-between border-b py-2"><span>Pix: {formatMoney(r.pix)} | Din: {formatMoney(r.cash)} | Card: {formatMoney(r.card)}</span><button onClick={()=>handleDelete(r.id)} className="text-red-500"><Trash2 size={16}/></button></div>))}
            </div>
          </div>
      )}
      {currentView === 'cash' && (
          <div className="bg-white p-6 rounded-xl shadow grid grid-cols-2 gap-8">
              <div>{billKeys.map(k => <div key={k} className="flex justify-between mb-2"><span>R$ {k}</span><input type="number" className="border w-20 text-center" value={cashCounts.bills[k]} onChange={e=>setCashCounts({...cashCounts, bills: {...cashCounts.bills, [k]: e.target.value}})} /></div>)}</div>
              <div>{coinKeys.map(k => <div key={k} className="flex justify-between mb-2"><span>R$ {k}</span><input type="number" className="border w-20 text-center" value={cashCounts.coins[k]} onChange={e=>setCashCounts({...cashCounts, coins: {...cashCounts.coins, [k]: e.target.value}})} /></div>)}</div>
          </div>
      )}
    </div>
  );
};

// --- MOBILE VIEW ---
const MobileView = ({ user, initialRole, onBack }) => {
  const [view, setView] = useState('tables');
  const [selectedTable, setSelectedTable] = useState('');
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [orderCounter, setOrderCounter] = useState(1000); 
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiResponse, setAiResponse] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    const uProd = onSnapshot(query(collection(db, 'artifacts', appId, 'users', user.uid, 'products')), s => {
        if (s.empty) { const b = writeBatch(db); DEFAULT_PRODUCTS_SEED.forEach(p => b.set(doc(collection(db, 'artifacts', appId, 'users', user.uid, 'products')), p)); b.commit(); }
        else { 
            const list = s.docs.map(d=>({firestoreId:d.id, ...d.data()})).sort((a,b)=>(a.name||'').localeCompare(b.name||'')); 
            setProducts(list); 
            setCategories(['Todos',...new Set(list.map(p=>p.category).filter(Boolean))]); 
        }
    });
    const uOrd = onSnapshot(query(collection(db, 'artifacts', appId, 'users', user.uid, 'orders')), s => { 
        if(!s.empty) setOrderCounter(Math.max(...s.docs.map(d=>d.data().id||0))+1); 
    });
    return () => { uProd(); uOrd(); };
  }, [user]);

  const handleTableSelect = (t) => { setSelectedTable(t); setCart([]); setView('menu'); };
  const addToCart = (p) => { if(p.stock<=0)return; const ex=cart.find(i=>i.id===p.id); if(ex) setCart(cart.map(i=>i.id===p.id?{...i,qty:i.qty+1}:i)); else setCart([...cart,{...p,qty:1,obs:''}]); };
  const removeFromCart = (id) => { const ex=cart.find(i=>i.id===id); if(ex.qty>1) setCart(cart.map(i=>i.id===id?{...i,qty:i.qty-1}:i)); else setCart(cart.filter(i=>i.id!==id)); };
  
  const sendOrder = async () => {
    if(!cart.length)return;
    setIsSubmitting(true);
    try {
      const b = writeBatch(db);
      cart.forEach(c => { const p = products.find(prod=>prod.id===c.id); if(p) b.update(doc(db, 'artifacts', appId, 'users', user.uid, 'products', p.firestoreId), {stock: p.stock-c.qty}); });
      await b.commit();
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'orders'), { id: orderCounter, client: selectedTable, waiter: initialRole, items: cart, total: cart.reduce((a,i)=>a+(i.price*i.qty),0), status: 'ABERTO', paymentStatus: 'ABERTO', kitchenStatus: 'Pendente', method: 'Aguardando', date: new Date().toISOString(), time: new Date().toLocaleTimeString().slice(0,5), origin: 'Mobile' });
      setView('success'); 
      setTimeout(()=>{setCart([]); setSelectedTable(''); setView('tables');}, 2000);
    } catch (e) { alert("Erro ao enviar"); }
    setIsSubmitting(false);
  };

  const callGeminiMock = async () => {
      return "Sugestão do Chef: Experimente nossa Torta de Frango com um Suco de Laranja bem gelado! Combinação perfeita para hoje.";
  }

  const handleAiSuggestion = async () => {
    setIsAiLoading(true); setShowAiModal(true); setAiResponse('');
    const res = await callGeminiMock(); 
    setAiResponse(res); setIsAiLoading(false);
  };

  const filtered = products.filter(p => (selectedCategory==='Todos'||p.category===selectedCategory) && (p.name||'').toLowerCase().includes(searchTerm.toLowerCase()));
  const total = cart.reduce((a,i)=>a+(i.price*i.qty),0); const count = cart.reduce((a,i)=>a+i.qty,0);

  if (view === 'success') return <div className="h-screen bg-green-600 flex flex-col items-center justify-center text-white p-8"><CheckCircle size={80} className="mb-4"/><h1 className="text-3xl font-bold">Pedido Enviado!</h1></div>;

  return (
    <div className="min-h-screen bg-slate-100 pb-32 font-sans max-w-md mx-auto shadow-2xl relative">
      <div className="bg-slate-900 text-white p-4 sticky top-0 z-30 shadow-md flex justify-between items-center">{view==='tables'?<div className="flex items-center gap-2"><button onClick={onBack}><ChevronLeft/></button><span className="font-bold">Olá, {initialRole}</span></div>:<div className="flex items-center gap-2"><button onClick={()=>setView(view==='cart'?'menu':'tables')}><ChevronLeft/></button><span className="font-bold">{selectedTable}</span></div>}<div className="text-xs bg-slate-800 px-2 py-1 rounded flex items-center gap-1"><User size={12}/> {initialRole}</div></div>
      {view==='tables' && (<div className="p-4 grid grid-cols-3 gap-3">{MESAS.map(t=>(<button key={t} onClick={()=>handleTableSelect(t)} className="bg-white p-4 rounded-xl shadow border font-bold text-slate-700 flex flex-col items-center"><Utensils size={24} className="opacity-30 mb-2 text-blue-600"/>{t.replace('Mesa ','')}</button>))}<button onClick={()=>handleTableSelect('Balcão')} className="col-span-3 bg-orange-100 text-orange-700 p-4 rounded-xl font-bold flex items-center justify-center gap-2"><ShoppingCart size={20}/> Balcão / Viagem</button></div>)}
      {view==='menu' && (
          <div>
              <div className="bg-white p-3 sticky top-[60px] z-20 border-b shadow-sm">
                  <div className="flex gap-2 mb-3">
                      <div className="relative flex-1"><Search className="absolute left-3 top-2.5 text-slate-400" size={18}/><input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="Buscar..." className="w-full bg-slate-100 pl-10 p-2 rounded-lg text-sm outline-none"/></div>
                      <button onClick={handleAiSuggestion} className="bg-purple-600 text-white p-2 rounded-lg"><UserCircle2 size={20}/></button>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">{categories.map(c=>(<button key={c} onClick={()=>setSelectedCategory(c)} className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${selectedCategory===c?'bg-slate-900 text-white':'bg-slate-100'}`}>{c}</button>))}</div>
              </div>
              <div className="p-3 grid grid-cols-2 gap-3">
                  {filtered.map(p=>{ const qty = cart.find(i=>i.id===p.id)?.qty||0; return (
                      <div key={p.id} className={`bg-white p-3 rounded-2xl shadow-sm border flex flex-col justify-between h-full ${qty>0?'border-blue-500 bg-blue-50/10':''}`}>
                          <div className="flex justify-center mb-2"><div className={`p-3 rounded-full ${qty>0?'bg-blue-100 text-blue-600':'bg-slate-50 text-slate-400'}`}><IconMapper type={p.icon} className="w-8 h-8"/></div></div>
                          <div className="text-center mb-2"><div className="font-bold leading-tight mb-1">{p.name}</div><div className="text-sm font-bold text-green-600">R$ {p.price.toFixed(2)}</div>{p.stock<=5 && <div className="text-[10px] text-orange-500 font-bold">Restam {p.stock}</div>}</div>
                          {p.stock>0 ? (qty>0 ? <div className="flex justify-between bg-slate-100 rounded-lg p-1"><button onClick={()=>removeFromCart(p.id)} className="w-8 h-8 bg-white text-red-500 rounded"><Minus size={16}/></button><span className="font-bold">{qty}</span><button onClick={()=>addToCart(p)} className="w-8 h-8 bg-white text-green-600 rounded"><Plus size={16}/></button></div> : <button onClick={()=>addToCart(p)} className="w-full py-2 bg-slate-900 text-white text-xs font-bold rounded-lg">Adicionar</button>) : <div className="text-center py-2 bg-red-50 text-red-400 text-xs font-bold rounded-lg">Esgotado</div>}
                      </div>
                  )})}
              </div>
          </div>
      )}
      {view==='cart' && (<div className="p-4"><h2 className="font-bold text-xl mb-4">Seu Pedido</h2><div className="bg-white rounded-xl shadow mb-20">{cart.map(i=>(<div key={i.id} className="p-4 border-b"><div className="flex justify-between"><div><span className="text-blue-600 font-bold mr-1">{i.qty}x</span> {i.name}</div><div className="flex gap-2"><button onClick={()=>removeFromCart(i.id)}><Minus size={14}/></button><button onClick={()=>addToCart(i)}><Plus size={14}/></button></div></div><input placeholder="Obs..." value={i.obs||''} onChange={e=>setCart(cart.map(x=>x.id===i.id?{...x,obs:e.target.value}:x))} className="w-full text-xs bg-slate-50 border p-2 rounded mt-2"/></div>))}</div><div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg z-40"><div className="flex justify-between font-bold text-lg mb-4"><span>Total</span><span>R$ {total.toFixed(2)}</span></div><button onClick={sendOrder} disabled={isSubmitting} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold flex justify-center items-center gap-2">{isSubmitting?'Enviando...':<><Send size={18}/> Confirmar</>}</button></div></div>)}
      {view==='menu' && count>0 && (<div className="fixed bottom-6 left-6 right-6 z-40"><button onClick={()=>setView('cart')} className="w-full bg-slate-900 text-white p-4 rounded-2xl shadow-xl flex justify-between items-center"><div><span className="font-bold">Ver Carrinho</span></div><span className="font-bold text-lg">R$ {total.toFixed(2)}</span></button></div>)}
      
      {showAiModal && (<div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6"><div className="bg-white rounded-3xl w-full max-w-sm p-6 text-center"><h3 className="font-bold text-lg mb-4">Sugestão do Chef 🤖</h3>{isAiLoading?<Loader2 className="animate-spin mx-auto"/>:<p className="mb-4">{aiResponse}</p>}<button onClick={()=>setShowAiModal(false)} className="bg-slate-900 text-white w-full py-2 rounded-lg">Fechar</button></div></div>)}
    </div>
  );
};

// --- POS (CAIXA / GERENTE / ENCOMENDAS COM EDIÇÃO) ---
const PosView = ({ user, onBack }) => {
  const [view, setView] = useState('pos');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [cart, setCart] = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedTabToSettle, setSelectedTabToSettle] = useState(null);
  const [partialPayments, setPartialPayments] = useState([]); 
    
  const [editingProduct, setEditingProduct] = useState(null); 
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdCost, setNewProdCost] = useState('');
  const [newProdCat, setNewProdCat] = useState('Lanches');
  
  const [futureOrders, setFutureOrders] = useState([]);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderClient, setOrderClient] = useState('');
  const [orderPhone, setOrderPhone] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [orderTime, setOrderTime] = useState('');
  const [orderObs, setOrderObs] = useState('');
  const [orderTotalValue, setOrderTotalValue] = useState(''); 
  const [orderSignal, setOrderSignal] = useState('');
  const [editingFutureId, setEditingFutureId] = useState(null); 

  const [showCashMovementModal, setShowCashMovementModal] = useState(false);
  const [movementType, setMovementType] = useState('suprimento');
  const [movementValue, setMovementValue] = useState('');
  const [movementDesc, setMovementDesc] = useState('');

  useEffect(() => {
    if (!user) return;
    const unsubProd = onSnapshot(query(collection(db, 'artifacts', appId, 'users', user.uid, 'products')), s => setProducts(s.docs.map(d=>({firestoreId:d.id, ...d.data()})).sort((a,b)=>(a.name||'').localeCompare(b.name||''))));
    const unsubOrders = onSnapshot(query(collection(db, 'artifacts', appId, 'users', user.uid, 'orders'), orderBy('id', 'desc')), s => setOrders(s.docs.map(d=>({firestoreId:d.id, ...d.data()}))));
    const unsubFuture = onSnapshot(query(collection(db, 'artifacts', appId, 'users', user.uid, 'future_orders')), s => setFutureOrders(s.docs.map(d=>({firestoreId:d.id, ...d.data()})).sort((a,b)=>new Date(a.deliveryDate||0)-new Date(b.deliveryDate||0))));
    return () => { unsubProd(); unsubOrders(); unsubFuture(); };
  }, [user]);

  const addToCart = (p) => { if (p.stock <= 0) { alert("Sem estoque!"); return; } const ex = cart.find(i => i.id === p.id); if (ex) setCart(cart.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i)); else setCart([...cart, { ...p, qty: 1, obs: '' }]); };
  const finalizeOrder = async (client = 'Balcão', status = 'PAGO') => {
    const totalCart = cart.reduce((acc, item) => acc + (Number(item.price) * Number(item.qty)), 0);
    const totalOrder = selectedTabToSettle ? selectedTabToSettle.total : totalCart;
    const paidTotal = partialPayments.reduce((acc, p) => acc + p.value, 0);
    if (status === 'PAGO' && paidTotal < totalOrder - 0.01) { alert(`Falta R$ ${(totalOrder - paidTotal).toFixed(2)}`); return; }
    
    if (!selectedTabToSettle && status === 'PAGO') {
        const batch = writeBatch(db);
        cart.forEach(cItem => { const pItem = products.find(p => p.id === cItem.id); if (pItem) batch.update(doc(db, 'artifacts', appId, 'users', user.uid, 'products', pItem.firestoreId), { stock: pItem.stock - cItem.qty }); });
        await batch.commit();
    }
    const methodString = partialPayments.length > 0 ? partialPayments.map(p => p.method).join('+') : 'Dinheiro';
    const paymentsArray = partialPayments.length > 0 ? partialPayments : [{ method: 'Dinheiro', value: totalOrder }];
    
    if (selectedTabToSettle) await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'orders', selectedTabToSettle.firestoreId), { paymentStatus: 'PAGO', method: methodString, payments: paymentsArray, paidAt: new Date().toISOString() });
    else await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'orders'), { id: Date.now(), items: cart, total: totalCart, status: status, paymentStatus: status, method: methodString, payments: paymentsArray, client, kitchenStatus: 'Pendente', date: new Date().toISOString(), origin: 'Caixa' });
    setCart([]); setShowPaymentModal(false);
  };

  const advanceKitchenStatus = async (order) => {
    const nextStatus = order.kitchenStatus === 'Pendente' ? 'Preparando' : 'Pronto';
    await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'orders', order.firestoreId), { kitchenStatus: nextStatus });
  };

  const openNewOrderModal = () => {
    setEditingFutureId(null); setOrderClient(''); setOrderPhone(''); setOrderDate(''); setOrderTime(''); setOrderObs(''); setOrderTotalValue(''); setOrderSignal('');
    setShowOrderModal(true);
  };
  const openEditOrderModal = (order) => {
    setEditingFutureId(order.firestoreId);
    setOrderClient(order.client); setOrderPhone(order.phone); setOrderDate(order.deliveryDate); setOrderTime(order.deliveryTime);
    setOrderObs(order.description); setOrderTotalValue(order.total); setOrderSignal(order.signal);
    setShowOrderModal(true);
  };
  const saveFutureOrder = async () => {
      if(!orderClient) return alert("Nome obrigatório");
      const data = { client: orderClient, phone: orderPhone, deliveryDate: orderDate, deliveryTime: orderTime, description: orderObs, total: parseFloat(orderTotalValue)||0, signal: parseFloat(orderSignal)||0, status: 'Pendente' };
      
      if (editingFutureId) {
         await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'future_orders', editingFutureId), data);
         alert("Encomenda Atualizada!");
      } else {
         await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'future_orders'), { ...data, createdAt: new Date().toISOString() });
         if (data.signal > 0) await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'orders'), { id: Date.now(), client: `Sinal: ${orderClient}`, total: data.signal, status: 'Pago', paymentStatus: 'PAGO', method: 'Pix', payments: [{ method: 'Pix', value: data.signal }], date: new Date().toISOString(), origin: 'Encomenda', items: [{ name: 'Sinal', price: data.signal, qty: 1 }] });
         alert("Encomenda Criada!");
      }
      setShowOrderModal(false);
  };

  const filteredOrders = orders.filter(o => o.paymentStatus === 'PAGO');
  const totalSales = filteredOrders.reduce((acc, o) => acc + (Number(o.total)||0), 0);
  const totalCost = filteredOrders.reduce((acc, o) => acc + (o.items?.reduce((iAcc, i) => iAcc + ((Number(i.costPrice)||0) * i.qty), 0) || 0), 0);
  const netProfit = totalSales - totalCost;

  const addNewProduct = async () => { await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'products'), { id: Date.now(), name: newProdName, price: parseFloat(newProdPrice), costPrice: parseFloat(newProdCost)||0, category: newProdCat, stock: 50, icon: 'burger' }); setNewProdName(''); setNewProdPrice(''); setNewProdCost(''); };
  const handleUpdateProduct = async () => { await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'products', editingProduct.firestoreId), { name: editingProduct.name, price: editingProduct.price, costPrice: editingProduct.costPrice||0, category: editingProduct.category, stock: editingProduct.stock }); setEditingProduct(null); };
  const handleDeleteProduct = async () => { if (window.confirm('Excluir?')) { await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'products', editingProduct.firestoreId)); setEditingProduct(null); } };

  const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const modalTotal = selectedTabToSettle ? selectedTabToSettle.total : cartTotal;
  const modalRemaining = Math.max(0, modalTotal - (partialPayments.reduce((acc, p) => acc + p.value, 0)));

  return (
    <div className="font-sans bg-slate-100 min-h-screen text-slate-900 flex">
      <div className="w-16 bg-slate-900 text-white flex flex-col items-center py-6 fixed h-full z-10">
          <div onClick={onBack} className="p-2 bg-yellow-500 rounded-lg mb-4 cursor-pointer text-black"><Settings size={20}/></div>
          <button onClick={() => setView('pos')} className={`p-2 mb-2 hover:bg-white/20 rounded ${view==='pos'?'bg-white/20':''}`}><ShoppingCart/></button>
          <button onClick={() => setView('kitchen')} className={`p-2 mb-2 hover:bg-white/20 rounded ${view==='kitchen'?'bg-white/20':''}`}><ChefHat/></button>
          <button onClick={() => setView('orders')} className={`p-2 mb-2 hover:bg-white/20 rounded ${view==='orders'?'bg-white/20':''}`}><Gift/></button>
          <button onClick={() => setView('admin')} className={`p-2 mb-2 hover:bg-white/20 rounded ${view==='admin'?'bg-white/20':''}`}><LayoutDashboard/></button>
          <button onClick={() => setView('cash')} className={`p-2 mb-2 hover:bg-white/20 rounded ${view==='cash'?'bg-white/20':''}`}><Wallet/></button>
      </div>

      <div className="pl-16 w-full">
        {view === 'pos' && (
            <div className="flex h-screen">
                <div className="flex-1 p-6 overflow-y-auto grid grid-cols-4 gap-4 align-content-start">{products.map(p => (<button key={p.id} onClick={() => addToCart(p)} className="bg-white p-4 rounded-xl shadow h-32 flex flex-col justify-between"><div className="flex justify-between"><IconMapper type={p.icon} className="w-6 h-6"/> <span className="font-bold">R$ {p.price.toFixed(2)}</span></div><div className="font-bold text-slate-800">{p.name}</div><div className="text-xs text-slate-400">{p.stock} un</div></button>))}</div>
                <div className="w-96 bg-white border-l p-4 flex flex-col"><div className="flex-1 overflow-y-auto">{cart.map(i=>(<div key={i.id} className="flex justify-between border-b p-2"><span>{i.qty}x {i.name}</span><button onClick={()=>removeFromCart(i.id)} className="text-red-500">X</button></div>))}</div><div className="text-2xl font-bold py-4">Total: R$ {cartTotal.toFixed(2)}</div><button onClick={()=>setShowPaymentModal(true)} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold">PAGAR</button></div>
            </div>
        )}

        {view === 'kitchen' && (
          <div className="p-8 h-screen overflow-y-auto">
             <h1 className="text-3xl font-bold mb-6 flex items-center gap-2"><ChefHat/> Fila da Cozinha</h1>
             <div className="grid grid-cols-3 gap-6">
                <div className="bg-white p-4 rounded-xl shadow min-h-[500px]">
                  <h2 className="font-bold text-xl mb-4 border-b pb-2 text-red-500 flex items-center gap-2"><AlertCircle size={20}/> Pendentes</h2>
                  {orders.filter(o => o.kitchenStatus === 'Pendente').map(o => (
                    <div key={o.firestoreId} className="bg-red-50 p-4 rounded-xl mb-3 border border-red-100">
                       <div className="flex justify-between font-bold mb-2"><span>#{o.id} - {o.client}</span><span>{o.time?.slice(0,5)}</span></div>
                       <ul className="text-sm mb-4">{o.items?.map(i=><li key={i.id}>{i.qty}x {i.name}</li>)}</ul>
                       <button onClick={()=>advanceKitchenStatus(o)} className="w-full bg-red-500 text-white py-2 rounded-lg font-bold">Preparar</button>
                    </div>
                  ))}
                </div>
                <div className="bg-white p-4 rounded-xl shadow min-h-[500px]">
                  <h2 className="font-bold text-xl mb-4 border-b pb-2 text-yellow-600 flex items-center gap-2"><Loader2 size={20}/> Preparando</h2>
                   {orders.filter(o => o.kitchenStatus === 'Preparando').map(o => (
                    <div key={o.firestoreId} className="bg-yellow-50 p-4 rounded-xl mb-3 border border-yellow-100">
                       <div className="flex justify-between font-bold mb-2"><span>#{o.id} - {o.client}</span><span>{o.time?.slice(0,5)}</span></div>
                       <ul className="text-sm mb-4">{o.items?.map(i=><li key={i.id}>{i.qty}x {i.name}</li>)}</ul>
                       <button onClick={()=>advanceKitchenStatus(o)} className="w-full bg-yellow-500 text-white py-2 rounded-lg font-bold">Pronto!</button>
                    </div>
                  ))}
                </div>
                <div className="bg-white p-4 rounded-xl shadow min-h-[500px]">
                  <h2 className="font-bold text-xl mb-4 border-b pb-2 text-green-600 flex items-center gap-2"><CheckCircle size={20}/> Prontos</h2>
                  {orders.filter(o => o.kitchenStatus === 'Pronto').slice(0, 5).map(o => (
                    <div key={o.firestoreId} className="bg-green-50 p-4 rounded-xl mb-3 border border-green-100 opacity-70">
                       <div className="flex justify-between font-bold mb-2"><span>#{o.id} - {o.client}</span><span>{o.time?.slice(0,5)}</span></div>
                       <div className="text-xs text-center text-green-800 font-bold bg-green-200 rounded py-1">Aguardando Retirada</div>
                    </div>
                  ))}
                </div>
             </div>
          </div>
        )}

        {view === 'orders' && (
            <div className="p-8 h-screen overflow-y-auto">
                <div className="flex justify-between mb-8"><h1 className="text-3xl font-bold flex items-center gap-2"><Gift/> Encomendas</h1><button onClick={openNewOrderModal} className="bg-pink-600 text-white px-6 py-2 rounded-xl font-bold">Nova Encomenda</button></div>
                <div className="space-y-4">{futureOrders.map(o => (
                    <div key={o.firestoreId} className="bg-white p-6 rounded-2xl shadow flex justify-between items-center group relative">
                        <div>
                            <div className="font-bold text-xl">{o.client}</div>
                            <div className="text-sm text-gray-500">{formatDate(o.deliveryDate)} às {o.deliveryTime}</div>
                            <div className="text-sm mt-2 p-2 bg-gray-50 rounded">{o.description}</div>
                        </div>
                        <div className="text-right">
                            <div className="font-bold text-xl">{formatMoney(o.total)}</div>
                            <div className={`text-xs font-bold px-2 py-1 rounded ${o.status==='Concluído'?'bg-green-100 text-green-700':'bg-yellow-100 text-yellow-700'}`}>{o.status}</div>
                            <div className="flex gap-2 mt-2">
                                <button onClick={()=>openEditOrderModal(o)} className="text-blue-600 hover:bg-blue-50 px-3 py-1 rounded border border-blue-200 text-sm font-bold flex items-center gap-1"><Edit3 size={14}/> Editar</button>
                                {o.status!=='Concluído' && <button onClick={()=>{/*Lógica de entregar*/}} className="bg-green-600 text-white px-3 py-1 rounded text-sm font-bold">Entregar</button>}
                            </div>
                        </div>
                    </div>
                ))}</div>
            </div>
        )}

        {view === 'admin' && (
            <div className="p-8 h-screen overflow-y-auto">
                <h1 className="text-3xl font-bold mb-6">Dashboard Financeiro</h1>
                <div className="flex gap-2 mb-4"><button onClick={()=>setShowCashMovementModal(true)} className="bg-indigo-600 text-white px-4 py-2 rounded flex items-center gap-2"><Repeat size={16}/> Movimentação</button></div>
                <div className="grid grid-cols-4 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-2xl shadow border-l-4 border-blue-500"><div>Faturamento</div><div className="text-3xl font-bold">R$ {totalSales.toFixed(2)}</div></div>
                    <div className="bg-white p-6 rounded-2xl shadow border-l-4 border-red-500"><div>Custo Mercadoria</div><div className="text-3xl font-bold text-red-600">R$ {totalCost.toFixed(2)}</div></div>
                    <div className="bg-white p-6 rounded-2xl shadow border-l-4 border-green-500"><div>Lucro Líquido</div><div className="text-3xl font-bold text-green-600">R$ {netProfit.toFixed(2)}</div></div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow mb-8">
                    <h3 className="font-bold mb-4">Ultimos Pedidos (Pagos)</h3>
                    <table className="w-full text-sm"><thead><tr className="text-left text-gray-500"><th>#</th><th>Cliente</th><th>Valor</th><th>Pagamento</th><th>Ação</th></tr></thead>
                    <tbody>
                        {filteredOrders.slice(0,5).map(o => (
                          <tr key={o.firestoreId} className="border-b">
                            <td className="py-3">#{o.id}</td>
                            <td>{o.client}</td>
                            <td className="font-bold">{formatMoney(o.total)}</td>
                            <td><span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">{o.method}</span></td>
                            <td><button onClick={()=>printOrder(o)} className="text-slate-500 hover:text-black"><Printer size={16}/></button></td>
                          </tr>
                        ))}
                    </tbody>
                    </table>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow mb-8">
                    <h3 className="font-bold mb-4">Gerenciar Produtos (Com Custo)</h3>
                    <div className="flex gap-4 mb-4 items-end">
                        <div><label className="text-xs font-bold">Nome</label><input value={newProdName} onChange={e=>setNewProdName(e.target.value)} className="border p-2 rounded w-full"/></div>
                        <div><label className="text-xs font-bold">Venda</label><input type="number" value={newProdPrice} onChange={e=>setNewProdPrice(e.target.value)} className="border p-2 rounded w-24"/></div>
                        <div><label className="text-xs font-bold text-red-500">Custo</label><input type="number" value={newProdCost} onChange={e=>setNewProdCost(e.target.value)} className="border p-2 rounded w-24 border-red-200"/></div>
                        <button onClick={addNewProduct} className="bg-green-600 text-white px-4 py-2 rounded font-bold h-10">Adicionar</button>
                    </div>
                    <table className="w-full text-sm"><thead><tr className="text-left"><th>Produto</th><th>Venda</th><th>Custo</th><th>Margem</th><th>Ação</th></tr></thead><tbody>
                        {products.map(p => (<tr key={p.id} className="border-b"><td className="py-2">{p.name}</td><td>{formatMoney(p.price)}</td><td className="text-red-500">{formatMoney(p.costPrice)}</td><td className="text-green-600 font-bold">{formatMoney(p.price-(p.costPrice||0))}</td><td><button onClick={()=>setEditingProduct(p)}><Edit3 size={16}/></button></td></tr>))}
                    </tbody></table>
                </div>
            </div>
        )}

        {view === 'cash' && <CashControl user={user} orders={orders} />}
      </div>

      {showOrderModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-md rounded-2xl p-6">
                  <h3 className="font-bold text-xl mb-4 flex items-center gap-2"><Gift/> {editingFutureId ? 'Editar Encomenda' : 'Nova Encomenda'}</h3>
                  <input placeholder="Cliente" value={orderClient} onChange={e=>setOrderClient(e.target.value)} className="w-full border p-2 rounded mb-2"/>
                  <div className="flex gap-2 mb-2"><input type="date" value={orderDate} onChange={e=>setOrderDate(e.target.value)} className="w-full border p-2 rounded"/><input type="time" value={orderTime} onChange={e=>setOrderTime(e.target.value)} className="w-full border p-2 rounded"/></div>
                  <textarea placeholder="Descrição" value={orderObs} onChange={e=>setOrderObs(e.target.value)} className="w-full border p-2 rounded mb-2 h-20"/>
                  <div className="flex gap-2 mb-4"><input type="number" placeholder="Total R$" value={orderTotalValue} onChange={e=>setOrderTotalValue(e.target.value)} className="w-full border p-2 rounded font-bold"/><input type="number" placeholder="Sinal R$" value={orderSignal} onChange={e=>setOrderSignal(e.target.value)} className="w-full border p-2 rounded"/></div>
                  <div className="flex justify-end gap-2"><button onClick={()=>setShowOrderModal(false)} className="px-4 py-2 text-gray-500">Cancelar</button><button onClick={saveFutureOrder} className="px-4 py-2 bg-pink-600 text-white rounded font-bold">Salvar</button></div>
              </div>
          </div>
      )}

      {showPaymentModal && (<div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"><div className="bg-white p-6 rounded-xl"><h2 className="text-xl font-bold mb-4">Receber R$ {modalRemaining.toFixed(2)}</h2><div className="grid grid-cols-2 gap-2"><button onClick={()=>{setPartialPayments([...partialPayments,{method:'Dinheiro',value:modalRemaining}]);}} className="bg-green-100 p-4 rounded text-green-700 font-bold">Dinheiro</button><button onClick={()=>{setPartialPayments([...partialPayments,{method:'Pix',value:modalRemaining}]);}} className="bg-blue-100 p-4 rounded text-blue-700 font-bold">Pix</button></div><button onClick={()=>finalizeOrder(selectedTabToSettle?.client,'PAGO')} className="w-full bg-slate-900 text-white mt-4 py-3 rounded font-bold">Confirmar</button><button onClick={()=>setShowPaymentModal(false)} className="w-full mt-2 text-gray-500">Cancelar</button></div></div>)}
      
      {showCashMovementModal && (<div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"><div className="bg-white p-6 rounded-xl"><h3 className="font-bold mb-4">Nova Movimentação</h3><div className="flex gap-2 mb-4"><button onClick={()=>setMovementType('suprimento')} className={`flex-1 font-bold p-2 rounded ${movementType==='suprimento'?'bg-green-100 text-green-700':'bg-gray-100'}`}>Entrada</button><button onClick={()=>setMovementType('sangria')} className={`flex-1 font-bold p-2 rounded ${movementType==='sangria'?'bg-red-100 text-red-700':'bg-gray-100'}`}>Saída</button></div><input type="number" value={movementValue} onChange={e=>setMovementValue(e.target.value)} placeholder="Valor" className="border p-2 w-full mb-2"/><input value={movementDesc} onChange={e=>setMovementDesc(e.target.value)} placeholder="Descrição" className="border p-2 w-full mb-4"/><button onClick={()=>{/*Lógica simplificada*/alert('Salvo!');setShowCashMovementModal(false);}} className="bg-indigo-600 text-white w-full py-2 rounded font-bold">Salvar</button><button onClick={()=>setShowCashMovementModal(false)} className="w-full mt-2 text-gray-500">Cancelar</button></div></div>)}

      {editingProduct && (<div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"><div className="bg-white p-6 rounded-xl"><h3 className="font-bold mb-4">Editar {editingProduct.name}</h3><input value={editingProduct.name} onChange={e=>setEditingProduct({...editingProduct,name:e.target.value})} className="border p-2 w-full mb-2"/><input type="number" value={editingProduct.price} onChange={e=>setEditingProduct({...editingProduct,price:parseFloat(e.target.value)})} className="border p-2 w-full mb-2"/><input type="number" placeholder="Custo" value={editingProduct.costPrice||''} onChange={e=>setEditingProduct({...editingProduct,costPrice:parseFloat(e.target.value)})} className="border p-2 w-full mb-4 border-red-200"/><div className="flex justify-between"><button onClick={handleDeleteProduct} className="text-red-500 border border-red-100 p-2 rounded"><Trash2/></button><div className="flex gap-2"><button onClick={()=>setEditingProduct(null)} className="text-gray-500 px-4 py-2">Cancelar</button><button onClick={handleUpdateProduct} className="bg-blue-600 text-white px-4 py-2 rounded">Salvar</button></div></div></div></div>)}
    </div>
  );
};

// --- APP PRINCIPAL ---
export default function App() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [appMode, setAppMode] = useState('landing');
  const [mobileRole, setMobileRole] = useState('');
  const [showClientModal, setShowClientModal] = useState(false);
  const [clientName, setClientName] = useState('');
  
  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    return onAuthStateChanged(auth, u => {
        if(u) setFirebaseUser({ ...u, uid: 'loja-joseane-sombra-oficial' });
    });
  }, []);

  const handleClientLogin = () => {
      if(!clientName) return alert("Digite seu nome");
      setMobileRole(clientName);
      setAppMode('mobile');
      setShowClientModal(false);
  }

  if (!firebaseUser) return <div className="h-screen flex items-center justify-center bg-slate-900 text-white"><Loader2 className="animate-spin mr-2"/> Carregando...</div>;

  return (
    appMode === 'mobile' ? <MobileView user={firebaseUser} initialRole={mobileRole} onBack={() => setAppMode('landing')} /> :
    appMode === 'pos' ? <PosView user={firebaseUser} onBack={() => setAppMode('landing')} /> :
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center font-sans">
        <h1 className="text-4xl font-bold text-white mb-2">Confeitaria & Café Joseane Sombra</h1>
        <p className="text-slate-400 mb-12">Sistema Integrado</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
            <button onClick={()=>setShowClientModal(true)} className="p-8 bg-white/10 rounded-3xl hover:bg-white/20 text-white border border-white/5 hover:border-blue-500 transition-all group"><div className="bg-blue-500/20 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform"><UserCircle2 size={40} className="text-blue-400"/></div><div className="text-2xl font-bold mb-2">Cliente</div><div className="text-sm text-slate-400">Cardápio Digital</div></button>
            <button onClick={()=>{setMobileRole('Garçom');setAppMode('mobile')}} className="p-8 bg-white/10 rounded-3xl hover:bg-white/20 text-white border border-white/5 hover:border-orange-500 transition-all group"><div className="bg-orange-500/20 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform"><ChefHat size={40} className="text-orange-400"/></div><div className="text-2xl font-bold mb-2">Garçom</div><div className="text-sm text-slate-400">Lançar Pedidos</div></button>
            <button onClick={()=>setAppMode('pos')} className="p-8 bg-white/10 rounded-3xl hover:bg-white/20 text-white border border-white/5 hover:border-purple-500 transition-all group"><div className="bg-purple-500/20 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform"><Smartphone size={40} className="text-purple-400"/></div><div className="text-2xl font-bold mb-2">Caixa / Cozinha</div><div className="text-sm text-slate-400">Gestão Completa</div></button>
        </div>
        {showClientModal && <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"><div className="bg-white p-8 rounded-3xl w-full max-w-sm"><h2 className="text-2xl font-bold mb-4 text-slate-800">Identifique-se</h2><input placeholder="Seu Nome" value={clientName} onChange={e=>setClientName(e.target.value)} className="w-full border p-3 rounded-xl mb-4 outline-none"/><button onClick={handleClientLogin} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">Entrar</button><button onClick={()=>setShowClientModal(false)} className="mt-4 text-slate-500 text-sm">Voltar</button></div></div>}
    </div>
  );
}