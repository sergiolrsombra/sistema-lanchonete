import React, { useState, useEffect } from 'react';
import { 
  Utensils, ShoppingCart, Send, User, ChevronLeft, 
  Minus, Plus, CheckCircle, Search, ChefHat, UserCircle2
} from 'lucide-react';

import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore, collection, addDoc, onSnapshot, query, doc, updateDoc, writeBatch } from "firebase/firestore";

// --- CONFIGURAÇÃO DO FIREBASE ---
const manualConfig = {
  apiKey: "COLE_SUA_API_KEY_AQUI",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_PROJETO.firebasestorage.app",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : manualConfig;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// CORREÇÃO: Usar o ID fornecido pelo sistema ou um padrão seguro
// Isso garante que estamos lendo/escrevendo na pasta permitida pelas regras de segurança
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// DADOS DE SEMEADURA (Caso o banco esteja vazio)
const DEFAULT_PRODUCTS_SEED = [
  { id: 1, name: 'X-Bacon', price: 28.00, category: 'Lanches', stock: 50, icon: 'burger' },
  { id: 2, name: 'X-Salada', price: 22.00, category: 'Lanches', stock: 45, icon: 'burger' },
  { id: 3, name: 'Coca-Cola 350ml', price: 6.00, category: 'Bebidas', stock: 100, icon: 'drink' },
  { id: 4, name: 'Suco Natural', price: 10.00, category: 'Bebidas', stock: 30, icon: 'drink' },
  { id: 5, name: 'Batata Frita', price: 25.00, category: 'Lanches', stock: 20, icon: 'fries' },
  { id: 6, name: 'Pudim', price: 12.00, category: 'Sobremesas', stock: 15, icon: 'dessert' },
];

export default function MobileApp() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('profile');
  const [profileType, setProfileType] = useState('');
  const [selectedTable, setSelectedTable] = useState('');
  
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderCounter, setOrderCounter] = useState(1000); 

  useEffect(() => {
    signInAnonymously(auth).then(u => setUser(u.user)).catch(console.error);
  }, []);

  useEffect(() => {
    if (!user) return;
    
    // CAMINHO UNIFICADO: artifacts -> {appId} -> public -> data -> products
    // Usando appId dinâmico para evitar erros de permissão
    const qProd = query(collection(db, 'artifacts', appId, 'public', 'data', 'products'));
    const unsubProd = onSnapshot(qProd, (snap) => {
        if (snap.empty) {
             // Auto-seed se estiver vazio
             const batch = writeBatch(db);
             DEFAULT_PRODUCTS_SEED.forEach(p => {
                 const ref = doc(collection(db, 'artifacts', appId, 'public', 'data', 'products'));
                 batch.set(ref, p);
             });
             batch.commit().catch(e => console.log("Seed error", e));
        } else {
            const list = snap.docs.map(d => ({ firestoreId: d.id, ...d.data() }));
            list.sort((a,b) => a.name.localeCompare(b.name));
            setProducts(list);
            const cats = ['Todos', ...new Set(list.map(p => p.category).filter(Boolean))];
            setCategories(cats);
        }
    }, (error) => {
        console.error("ERRO FIREBASE (PRODUTOS):", error.message);
        if (error.code === 'permission-denied') {
            console.warn("Verifique se as regras do Firestore permitem leitura/escrita pública ou para este usuário.");
        }
    });

    const qOrders = query(collection(db, 'artifacts', appId, 'public', 'data', 'orders'));
    const unsubOrders = onSnapshot(qOrders, (snap) => {
        const list = snap.docs.map(d => d.data());
        if (list.length > 0) {
            const maxId = Math.max(...list.map(o => Number(o.id) || 0));
            setOrderCounter(maxId + 1);
        }
    }, (error) => {
        console.error("ERRO FIREBASE (PEDIDOS):", error.message);
    });

    return () => { unsubProd(); unsubOrders(); };
  }, [user]);

  const selectProfile = (type) => { setProfileType(type); setView('tables'); };
  const handleTableSelect = (table) => { setSelectedTable(table); setCart([]); setView('menu'); };

  const addToCart = (product) => {
    if (product.stock <= 0) return;
    const existing = cart.find(item => item.id === product.id);
    if (existing) setCart(cart.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item));
    else setCart([...cart, { ...product, qty: 1, obs: '' }]);
  };

  const removeFromCart = (productId) => {
    const existing = cart.find(item => item.id === productId);
    if (existing.qty > 1) setCart(cart.map(item => item.id === productId ? { ...item, qty: item.qty - 1 } : item));
    else setCart(cart.filter(item => item.id !== productId));
  };

  const updateObs = (productId, newObs) => {
    setCart(cart.map(item => item.id === productId ? { ...item, obs: newObs } : item));
  };

  const sendOrder = async () => {
    if (cart.length === 0) return;
    setIsSubmitting(true);
    try {
      const total = cart.reduce((acc, item) => acc + (Number(item.price) * item.qty), 0);
      const nowISO = new Date().toISOString();

      const batch = writeBatch(db);
      cart.forEach(cItem => {
          const pItem = products.find(p => p.id === cItem.id);
          if (pItem && pItem.firestoreId) {
              const newStock = pItem.stock - cItem.qty;
              const ref = doc(db, 'artifacts', appId, 'public', 'data', 'products', pItem.firestoreId);
              batch.update(ref, { stock: newStock });
          }
      });
      await batch.commit();

      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'orders'), {
        id: orderCounter,
        client: selectedTable,
        waiter: profileType,
        items: cart,
        total: total,
        status: 'ABERTO',
        paymentStatus: 'ABERTO', 
        kitchenStatus: 'Pendente', 
        method: 'Aguardando',
        date: nowISO,
        time: new Date().toLocaleTimeString().slice(0,5),
        origin: 'Mobile'
      });

      setView('success');
      setTimeout(() => { setCart([]); setSelectedTable(''); setView('tables'); setIsSubmitting(false); }, 2000);
    } catch (error) { console.error(error); alert("Erro ao enviar: " + error.message); setIsSubmitting(false); }
  };

  const filteredProducts = products.filter(p => (selectedCategory === 'Todos' || p.category === selectedCategory) && p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const cartTotal = cart.reduce((acc, item) => acc + (Number(item.price) * item.qty), 0);
  const cartCount = cart.reduce((acc, item) => acc + item.qty, 0);

  if (!user) return <div className="h-screen flex items-center justify-center bg-slate-900 text-white"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div></div>;

  if (view === 'success') return (
    <div className="h-screen bg-green-600 flex flex-col items-center justify-center text-white p-8 animate-in zoom-in">
      <CheckCircle size={80} className="mb-4" />
      <h1 className="text-3xl font-bold mb-2">Pedido Enviado!</h1>
      <p className="opacity-80">A cozinha já recebeu.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 pb-24 font-sans">
      <div className="bg-slate-900 text-white p-4 sticky top-0 z-20 shadow-md">
        <div className="flex justify-between items-center">
          {view === 'profile' ? <div className="flex items-center gap-2 font-bold text-lg"><ChefHat /> Lanchonete App</div> : 
           view === 'tables' ? <div className="flex items-center gap-2"><button onClick={() => setView('profile')}><ChevronLeft /></button><span className="font-bold">Olá, {profileType}</span></div> :
           <div className="flex items-center gap-2"><button onClick={() => setView(view === 'cart' ? 'menu' : 'tables')}><ChevronLeft /></button><span className="font-bold">{selectedTable}</span></div>}
          {profileType && view !== 'profile' && <div className="text-xs bg-slate-800 px-2 py-1 rounded flex items-center gap-1"><User size={12}/> {profileType}</div>}
        </div>
      </div>

      {view === 'profile' && (
          <div className="p-6 h-[80vh] flex flex-col justify-center animate-in slide-in-from-bottom">
              <h2 className="text-2xl font-bold text-center text-slate-800 mb-8">Quem é você?</h2>
              <div className="grid gap-4">
                  <button onClick={() => selectProfile('Cliente')} className="bg-white p-6 rounded-2xl shadow-lg border-2 border-transparent hover:border-blue-500 flex flex-col items-center gap-3 transition-all active:scale-95"><div className="bg-blue-100 p-4 rounded-full text-blue-600"><UserCircle2 size={40}/></div><span className="text-xl font-bold text-slate-700">Sou Cliente</span></button>
                  <button onClick={() => selectProfile('Garçom')} className="bg-white p-6 rounded-2xl shadow-lg border-2 border-transparent hover:border-orange-500 flex flex-col items-center gap-3 transition-all active:scale-95"><div className="bg-orange-100 p-4 rounded-full text-orange-600"><ChefHat size={40}/></div><span className="text-xl font-bold text-slate-700">Sou Garçom</span></button>
              </div>
          </div>
      )}

      {view === 'tables' && (
        <div className="p-4 animate-in slide-in-from-right">
          <h2 className="font-bold text-slate-700 mb-3 text-lg text-center">Selecione sua Mesa</h2>
          <div className="grid grid-cols-3 gap-3">
            {Array.from({length: 15}, (_, i) => i + 1).map(num => (
                <button key={num} onClick={() => handleTableSelect(`Mesa ${String(num).padStart(2, '0')}`)} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 font-bold text-slate-700 hover:bg-blue-50 transition-all active:scale-95 flex flex-col items-center gap-1"><Utensils size={20} className="opacity-50"/>{String(num).padStart(2, '0')}</button>
            ))}
            <button onClick={() => handleTableSelect('Balcão')} className="bg-orange-100 border-orange-200 text-orange-700 p-4 rounded-xl shadow-sm font-bold col-span-3">Balcão / Viagem</button>
          </div>
        </div>
      )}

      {view === 'menu' && (
        <div className="animate-in slide-in-from-right">
          <div className="bg-white p-4 shadow-sm border-b sticky top-[60px] z-10">
            <div className="relative mb-3"><Search className="absolute left-3 top-2.5 text-slate-400" size={18} /><input placeholder="Buscar produto..." className="w-full bg-slate-100 pl-10 p-2 rounded-lg text-sm outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/></div>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">{categories.map(cat => (<button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${selectedCategory === cat ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>{cat}</button>))}</div>
          </div>
          <div className="p-4 space-y-3">
            {products.length === 0 ? <div className="text-center py-10 text-slate-400"><p>Carregando cardápio...</p></div> : filteredProducts.map(p => {
              const qty = cart.find(i => i.id === p.id)?.qty || 0;
              return (
                <div key={p.id} className={`bg-white p-4 rounded-xl shadow-sm border flex justify-between items-center ${qty > 0 ? 'border-blue-500 bg-blue-50/30' : 'border-slate-100'}`}>
                  <div className="flex-1"><div className="font-bold text-slate-800">{p.name}</div><div className="text-sm font-bold text-slate-500">R$ {Number(p.price).toFixed(2)}</div></div>
                  {p.stock > 0 ? <div className="flex items-center bg-slate-100 rounded-lg p-1">{qty > 0 ? <><button onClick={() => removeFromCart(p.id)} className="w-8 h-8 flex items-center justify-center bg-white rounded shadow text-red-500 font-bold"><Minus size={16}/></button><span className="w-8 text-center font-bold text-slate-800">{qty}</span><button onClick={() => addToCart(p)} className="w-8 h-8 flex items-center justify-center bg-white rounded shadow text-green-600 font-bold"><Plus size={16}/></button></> : <button onClick={() => addToCart(p)} className="px-4 py-1.5 bg-white rounded shadow text-sm font-bold text-slate-700">Adicionar</button>}</div> : <span className="text-xs font-bold text-red-400 bg-red-50 px-2 py-1 rounded">Esgotado</span>}
                </div>
              );
            })}
            <div className="h-20"></div>
          </div>
        </div>
      )}

      {view === 'cart' && (
        <div className="p-4 animate-in slide-in-from-bottom">
          <h2 className="font-bold text-xl mb-4 flex items-center gap-2"><ShoppingCart /> Resumo do Pedido</h2>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-4">{cart.map(item => (<div key={item.id} className="p-4 border-b last:border-0"><div className="flex justify-between items-start mb-2"><div><div className="font-bold text-slate-800"><span className="text-blue-600 mr-1">{item.qty}x</span> {item.name}</div><div className="text-sm text-slate-500">R$ {(Number(item.price) * item.qty).toFixed(2)}</div></div><div className="flex gap-2"><button onClick={() => removeFromCart(item.id)} className="p-1 bg-red-100 text-red-600 rounded"><Minus size={14}/></button><button onClick={() => addToCart(item)} className="p-1 bg-green-100 text-green-600 rounded"><Plus size={14}/></button></div></div><input placeholder="Obs (ex: sem cebola)" value={item.obs || ''} onChange={(e) => updateObs(item.id, e.target.value)} className="w-full text-xs bg-slate-50 border border-slate-200 p-2 rounded-lg outline-none"/></div>))}</div>
          <button onClick={sendOrder} disabled={isSubmitting} className="w-full bg-green-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">{isSubmitting ? 'Enviando...' : <><Send size={20} /> Enviar para Cozinha</>}</button>
        </div>
      )}

      {view === 'menu' && cartCount > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-30">
          <button onClick={() => setView('cart')} className="w-full bg-slate-900 text-white p-4 rounded-2xl shadow-xl flex justify-between items-center animate-in slide-in-from-bottom-5">
            <div className="flex items-center gap-3"><div className="bg-white text-slate-900 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">{cartCount}</div><span className="font-bold">Ver Carrinho</span></div>
            <span className="font-bold text-lg">R$ {cartTotal.toFixed(2)}</span>
          </button>
        </div>
      )}
    </div>
  );
}