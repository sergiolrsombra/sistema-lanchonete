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
    // ISO 8601: semana começa na segunda-feira
    // Ajusta o dia: segunda=0, terça=1, ..., domingo=6
    const dayOfWeek = (dateObj.getDay() + 6) % 7; // converte domingo(0) para 6, segunda(1) para 0
    // Vai para a quinta-feira da semana atual (referência ISO)
    const thursday = new Date(dateObj);
    thursday.setDate(dateObj.getDate() - dayOfWeek + 3);
    // Primeira quinta-feira do ano
    const firstThursday = new Date(thursday.getFullYear(), 0, 1);
    if (firstThursday.getDay() !== 4) {
      firstThursday.setMonth(0, 1 + ((4 - firstThursday.getDay()) + 7) % 7);
    }
    const week = 1 + Math.round((thursday - firstThursday) / 604800000);
    return thursday.getFullYear() + '-W' + String(week).padStart(2, '0');
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
      itemsHtml += `<div style="margin-top: 4px; border-bottom: 1px dashed #000; font-weight: bold; font-size: 13px; padding-bottom: 2px;">👤 ${guest}</div>`;
    }
    
    groupedItems[guest].forEach(i => {
      itemsHtml += `
        <div style="display: flex; justify-content: space-between; margin-bottom: 1px; margin-top: 2px; font-size: 12px; font-weight: 900;">
          <span style="font-weight: 900;">${i.qty}x ${i.name}</span>
          ${type === 'customer' ? `<span>${formatMoney(calcItemTotal(i))}</span>` : ''}
        </div>
      `;
      i.subItems?.forEach(sub => {
        itemsHtml += `<div style="margin-left: 8px; font-size: 11px; color: #000; font-weight: 900;">+ ${sub.qty * i.qty}x ${sub.name}</div>`;
      });
      if (i.obs) {
        itemsHtml += `<div style="margin-left: 8px; font-size: 11px; font-style: italic; font-weight: bold;">Obs: ${i.obs}</div>`;
      }
    });
  });

  const content = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${type === 'customer' ? 'Recibo' : 'Ticket Cozinha'}</title>
        <style>
          @page { margin: 0; } /* Deixa o driver da impressora cortar onde o conteúdo termina */
          html, body { margin: 0; padding: 0; background: #fff; height: fit-content; }
          body { font-family: Arial, Helvetica, sans-serif; width: 76mm; padding: 2mm 2mm 5mm 2mm; color: #000 !important; line-height: 1.2; font-size: 12px; font-weight: 700; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 4px; margin-bottom: 4px; }
          .footer { text-align: center; border-top: 2px dashed #000; padding-top: 4px; margin-top: 6px; font-size: 11px; padding-bottom: 8mm; font-weight: 700; }
          .bold { font-weight: 900; }
          .total-box { border-top: 2px solid #000; margin-top: 6px; padding-top: 4px; }
          .flex-between { display: flex; justify-content: space-between; margin-bottom: 2px; }
          .text-lg { font-size: 15px; font-weight: 900; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2 style="margin: 0; font-size: 18px; font-weight: 900;">${storeName}</h2>
          ${type === 'customer' ? `<p style="margin: 2px 0 0 0; font-size: 11px;">${storeAddress}<br/>Tel: ${storePhone}</p>` : '<h2 style="margin: 2px 0 0 0;">TICKET COZINHA</h2>'}
        </div>
        
        <div style="margin-bottom: 6px; font-size: 12px;">
          <div class="flex-between"><span class="bold">Pedido:</span> <span>#${order.id || 'N/A'}</span></div>
          <div class="flex-between"><span class="bold">Cliente:</span> <span>${order.client}</span></div>
          <div class="flex-between"><span class="bold">Data:</span> <span>${new Date(order.paidAt || order.date).toLocaleString('pt-BR')}</span></div>
        </div>

        <div style="border-top: 1px dashed #000; padding-top: 6px; margin-bottom: 6px;">
          ${itemsHtml}
        </div>

        ${type === 'customer' ? `
          <div class="total-box">
            <div class="flex-between bold text-lg"><span>TOTAL:</span><span>${formatMoney(order.total)}</span></div>
            <div class="flex-between mt-2"><span>PAGAMENTO:</span><span>${order.method || 'Dinheiro'}</span></div>
            ${order.receivedValue ? `<div class="flex-between"><span>RECEBIDO:</span><span>${formatMoney(order.receivedValue)}</span></div>` : ''}
            ${order.changeValue ? `<div class="flex-between"><span>TROCO:</span><span>${formatMoney(order.changeValue)}</span></div>` : ''}
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

// --- IMPRESSÃO: RECIBO DE ENCOMENDA ---
const handlePrintOrderReceipt = (order, settings) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  const storeName = settings?.storeName || 'CAFÉ DA PRAÇA';
  const storePhone = settings?.phone || '';
  const storeAddress = settings?.address || '';
  const [y, m, d] = (order.deliveryDate || '').split('-');
  const deliveryStr = order.deliveryDate ? d + '/' + m + '/' + y + ' às ' + (order.deliveryTime || '') : '—';
  const signal = Number(order.signal || 0);
  const total = Number(order.total || 0);
  const remaining = total - signal;
  const content = `<!DOCTYPE html><html><head><title>Recibo de Encomenda</title>
  <style>
    @page { margin: 0; }
    body { font-family: Arial, Helvetica, sans-serif; width: 76mm; padding: 3mm; color: #000; font-weight: 700; font-size: 12px; line-height: 1.4; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    h2 { margin: 0; font-size: 16px; font-weight: 900; text-align: center; }
    .center { text-align: center; }
    .sub { font-size: 10px; text-align: center; margin-bottom: 4px; font-weight: 700; }
    .divider { border-top: 2px dashed #000; margin: 6px 0; }
    .section { font-size: 11px; font-weight: 900; text-transform: uppercase; margin: 6px 0 3px; }
    .row { display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 11px; }
    .desc { font-size: 11px; line-height: 1.5; margin: 4px 0; white-space: pre-wrap; }
    .total { font-size: 14px; font-weight: 900; }
    .remaining { font-size: 13px; font-weight: 900; color: #dc2626; }
    .paid { font-size: 11px; color: #16a34a; font-weight: 900; }
    .badge { background: #fce7f3; border: 1px solid #f9a8d4; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 900; display: inline-block; margin-bottom: 4px; }
  </style></head><body>
  <h2>${storeName}</h2>
  ${storeAddress ? '<div class="sub">' + storeAddress + '</div>' : ''}
  ${storePhone ? '<div class="sub">Tel: ' + storePhone + '</div>' : ''}
  <div class="divider"></div>
  <div class="center"><div class="badge">🎂 RECIBO DE ENCOMENDA</div></div>
  <div class="section">Dados do Cliente</div>
  <div class="row"><span>Cliente:</span><span>${order.client || '—'}</span></div>
  ${order.phone ? '<div class="row"><span>Telefone:</span><span>' + order.phone + '</span></div>' : ''}
  <div class="divider"></div>
  <div class="section">Detalhes da Encomenda</div>
  <div class="row"><span>Entrega:</span><span>${deliveryStr}</span></div>
  ${order.description ? '<div class="desc">' + order.description + '</div>' : ''}
  <div class="divider"></div>
  <div class="section">Valores</div>
  <div class="row total"><span>TOTAL DA ENCOMENDA:</span><span>R$ ${total.toFixed(2)}</span></div>
  ${signal > 0 ? '<div class="row paid"><span>✅ Sinal Recebido (' + (order.signalMethod || 'Pix') + '):</span><span>R$ ' + signal.toFixed(2) + '</span></div>' : ''}
  ${remaining > 0 && signal > 0 ? '<div class="row remaining"><span>⏳ Restante na Entrega:</span><span>R$ ' + remaining.toFixed(2) + '</span></div>' : ''}
  ${remaining <= 0 ? '<div class="row paid"><span>✅ PAGO INTEGRALMENTE</span></div>' : ''}
  <div class="divider"></div>
  <div class="sub">Emitido em ${new Date().toLocaleString('pt-BR')}</div>
  <div class="sub" style="margin-top:4px">Obrigado pela preferência! 🎂</div>
  <script>window.onload=function(){setTimeout(function(){window.print();window.close();},500);}</script>
  </body></html>`;
  printWindow.document.write(content);
  printWindow.document.close();
};

// --- IMPRESSÃO: RELATÓRIO FINANCEIRO DO DIA/SEMANA/MÊS ---
const handlePrintFinancialReport = (orders, movements, byMethod, totalSales, totalSup, totalSang, reportDate, reportMode, settings, costsData = [], totalCostsData = 0, cmvPrint = 0, lanchTotal = 0, encTotal = 0, encOrdersList = []) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  const storeName = settings?.storeName || 'CAFÉ DA PRAÇA';
  const periodLabel = reportMode === 'daily'
    ? reportDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
    : reportMode === 'weekly'
    ? `Semana ${String(reportDate.getDate()).padStart(2,'0')}/${String(reportDate.getMonth()+1).padStart(2,'0')}/${reportDate.getFullYear()}`
    : reportDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const content = `<!DOCTYPE html><html><head><title>Relatório Financeiro</title>
  <style>
    @page { margin: 0; }
    body { font-family: Arial, sans-serif; width: 76mm; padding: 3mm; color: #000; font-weight: 700; font-size: 12px; line-height: 1.4; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    h2 { margin: 0; font-size: 16px; font-weight: 900; text-align: center; }
    .sub { font-size: 10px; text-align: center; margin-bottom: 6px; }
    .divider { border-top: 2px dashed #000; margin: 6px 0; }
    .row { display: flex; justify-content: space-between; margin-bottom: 3px; }
    .total { font-size: 15px; font-weight: 900; }
    .lucro { font-size: 14px; font-weight: 900; }
    .section { font-size: 11px; font-weight: 900; text-transform: uppercase; margin: 6px 0 3px; }
  </style></head><body>
  <h2>${storeName}</h2>
  <div class="sub">RELATÓRIO FINANCEIRO</div>
  <div class="sub">${periodLabel}</div>
  <div class="divider"></div>
  <div class="section">Vendas por Método</div>
  <div class="row"><span>💠 PIX</span><span>R$ ${byMethod.pix.toFixed(2)}</span></div>
  <div class="row"><span>💵 Dinheiro</span><span>R$ ${byMethod.dinheiro.toFixed(2)}</span></div>
  <div class="row"><span>💳 Cartão</span><span>R$ ${byMethod.cartao.toFixed(2)}</span></div>
  <div class="divider"></div>
  <div class="row total"><span>FATURAMENTO BRUTO</span><span>R$ ${totalSales.toFixed(2)}</span></div>
  <div class="row"><span>(-) CMV</span><span>R$ ${cmvPrint.toFixed(2)}</span></div>
  <div class="row"><span>(=) Lucro Bruto</span><span>R$ ${(totalSales - cmvPrint).toFixed(2)}</span></div>
  <div class="divider"></div>
  <div class="section">(-) Custos do Período</div>
  ${costsData.length > 0 ? costsData.map(c => '<div class="row"><span>' + (c.description||c.category) + '</span><span>R$ ' + Number(c.value).toFixed(2) + '</span></div>').join('') : '<div class="row"><span>Nenhum custo lançado</span></div>'}
  <div class="divider"></div>
  <div class="row total"><span>TOTAL CUSTOS</span><span>R$ ${totalCostsData.toFixed(2)}</span></div>
  <div class="divider"></div>
  <div class="row lucro" style="color:${(totalSales - cmvPrint - totalCostsData) >= 0 ? '#16a34a' : '#dc2626'}"><span>(=) LUCRO LÍQUIDO</span><span>R$ ${(totalSales - cmvPrint - totalCostsData).toFixed(2)}</span></div>

  <div class="divider"></div>
  <div class="section">Movimentações de Caixa</div>
  <div class="row"><span>⬆️ Suprimento</span><span>R$ ${totalSup.toFixed(2)}</span></div>
  <div class="row"><span>⬇️ Sangria</span><span>R$ ${totalSang.toFixed(2)}</span></div>
  <div class="divider"></div>
  <div class="row"><span>Nº de Pedidos</span><span>${orders.length}</span></div>
  <div class="row"><span>Ticket Médio</span><span>R$ ${orders.length > 0 ? (totalSales / orders.length).toFixed(2) : '0.00'}</span></div>
  <div class="divider"></div>
  <div class="section">Origem das Vendas</div>
  <div class="row"><span>🏪 Lanchonete</span><span>R$ ${lanchTotal.toFixed(2)}</span></div>
  <div class="row"><span>🎂 Encomendas</span><span>R$ ${encTotal.toFixed(2)}</span></div>
  ${encOrdersList.length > 0 ? '<div class="section" style="margin-top:4px">Detalhamento Encomendas</div>' + encOrdersList.map(o => '<div class="row" style="font-size:10px"><span>' + o.client.replace('Sinal: ','🔸 Sinal: ').replace('Restante: ','✅ Rest: ') + '</span><span>R$ ' + Number(o.total).toFixed(2) + '</span></div>').join('') : ''}
  <div class="divider"></div>
  <div class="sub">Impresso em ${new Date().toLocaleString('pt-BR')}</div>
  <script>window.onload=function(){setTimeout(function(){window.print();window.close();},500);}</script>
  </body></html>`;
  printWindow.document.write(content);
  printWindow.document.close();
};

// --- IMPRESSÃO: TOP MAIS VENDIDOS ---
const handlePrintTopSelling = (orders, reportDate, reportMode, settings) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  const storeName = settings?.storeName || 'CAFÉ DA PRAÇA';
  const periodLabel = reportMode === 'daily'
    ? reportDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : reportMode === 'weekly' ? 'Esta Semana'
    : reportDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const ranking = Object.entries(orders.reduce((a, o) => {
    o.items?.forEach(i => {
      a[i.name] = (a[i.name] || 0) + i.qty;
      i.subItems?.forEach(sub => { a[sub.name] = (a[sub.name] || 0) + (sub.qty * i.qty); });
    });
    return a;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 15);

  const rows = ranking.map((([n, q], idx) => `<div class="row"><span>${idx+1}. ${n}</span><span>${q} un</span></div>`)).join('') || '<div class="row"><span>Nenhuma venda</span></div>';

  const content = `<!DOCTYPE html><html><head><title>Top Mais Vendidos</title>
  <style>
    @page { margin: 0; }
    body { font-family: Arial, sans-serif; width: 76mm; padding: 3mm; color: #000; font-weight: 700; font-size: 12px; line-height: 1.4; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    h2 { margin: 0; font-size: 16px; font-weight: 900; text-align: center; }
    .sub { font-size: 10px; text-align: center; margin-bottom: 6px; }
    .divider { border-top: 2px dashed #000; margin: 6px 0; }
    .row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 11px; }
  </style></head><body>
  <h2>${storeName}</h2>
  <div class="sub">🏆 TOP MAIS VENDIDOS</div>
  <div class="sub">${periodLabel}</div>
  <div class="divider"></div>
  ${rows}
  <div class="divider"></div>
  <div class="sub">Impresso em ${new Date().toLocaleString('pt-BR')}</div>
  <script>window.onload=function(){setTimeout(function(){window.print();window.close();},500);}</script>
  </body></html>`;
  printWindow.document.write(content);
  printWindow.document.close();
};

// --- IMPRESSÃO: RELATÓRIO DO HISTÓRICO (por data) ---
const handlePrintHistoryReport = (orders, date, settings) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  const storeName = settings?.storeName || 'CAFÉ DA PRAÇA';
  const [y, m, d] = date.split('-');
  const dateLabel = `${d}/${m}/${y}`;
  const total = orders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
  const byMethod = orders.reduce((acc, o) => {
    const payments = o.payments || [];
    if (payments.length) {
      payments.forEach(p => {
        const v = Number(p.value) || 0;
        if (p.method === 'Dinheiro') acc.dinheiro += v;
        else if (['Pix','PIX'].includes(p.method)) acc.pix += v;
        else acc.cartao += v;
      });
    } else {
      const v = Number(o.total) || 0; const met = o.method || '';
      if (met.includes('Dinheiro')) acc.dinheiro += v;
      else if (met.includes('Pix') || met.includes('PIX')) acc.pix += v;
      else acc.cartao += v;
    }
    return acc;
  }, { pix: 0, dinheiro: 0, cartao: 0 });

  const rows = orders.map(o => `
    <div class="row"><span>#${o.id} ${o.client}</span><span>R$ ${Number(o.total).toFixed(2)}</span></div>
    <div class="sub2">${new Date(o.paidAt||o.date).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})} • ${o.method||'—'}</div>
  `).join('');

  const content = `<!DOCTYPE html><html><head><title>Fechamento do Dia</title>
  <style>
    @page { margin: 0; }
    body { font-family: Arial, sans-serif; width: 76mm; padding: 3mm; color: #000; font-weight: 700; font-size: 11px; line-height: 1.4; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    h2 { margin: 0; font-size: 16px; font-weight: 900; text-align: center; }
    .sub { font-size: 10px; text-align: center; margin-bottom: 4px; }
    .sub2 { font-size: 10px; color: #333; margin-bottom: 4px; padding-left: 4px; }
    .divider { border-top: 2px dashed #000; margin: 6px 0; }
    .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
    .total { font-size: 14px; font-weight: 900; }
    .section { font-size: 11px; font-weight: 900; text-transform: uppercase; margin: 6px 0 3px; }
  </style></head><body>
  <h2>${storeName}</h2>
  <div class="sub">FECHAMENTO DO DIA</div>
  <div class="sub">${dateLabel}</div>
  <div class="divider"></div>
  <div class="section">Resumo</div>
  <div class="row"><span>Total de vendas</span><span>${orders.length}</span></div>
  <div class="row"><span>💠 PIX</span><span>R$ ${byMethod.pix.toFixed(2)}</span></div>
  <div class="row"><span>💵 Dinheiro</span><span>R$ ${byMethod.dinheiro.toFixed(2)}</span></div>
  <div class="row"><span>💳 Cartão</span><span>R$ ${byMethod.cartao.toFixed(2)}</span></div>
  <div class="divider"></div>
  <div class="row total"><span>TOTAL GERAL</span><span>R$ ${total.toFixed(2)}</span></div>
  <div class="divider"></div>
  <div class="section">Pedidos do Dia</div>
  ${rows}
  <div class="divider"></div>
  <div class="sub">Impresso em ${new Date().toLocaleString('pt-BR')}</div>
  <script>window.onload=function(){setTimeout(function(){window.print();window.close();},500);}</script>
  </body></html>`;
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

// Função para calcular tempo decorrido (helper global)
const getElapsedTime = (dateStr) => {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 1) return 'agora';
  if (diff === 1) return 'há 1 min';
  if (diff < 60) return 'há ' + diff + ' min';
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return 'há ' + h + 'h' + (m > 0 ? ' ' + m + 'min' : '');
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
  const [categoryOrder, setCategoryOrder] = useState([]);
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
    // Carregar ordem das categorias
    getDoc(getDocRef('app_state', 'category_order')).then(snap => {
      if (snap.exists()) setCategoryOrder(snap.data().order || []);
    }).catch(() => {});
    return () => { unsubProd(); unsubOrders(); };
  }, [user]);

  const showToastMsg = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };
  const getMobileOrderedCategories = () => {
    const saved = categoryOrder.filter(c => categories.includes(c));
    const unsaved = categories.filter(c => !saved.includes(c));
    return [...saved, ...unsaved];
  };





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
    <div className="min-h-screen bg-slate-100 pb-24 font-sans w-full sm:max-w-md mx-auto sm:shadow-2xl relative sm:border-x border-slate-200 animate-in fade-in">
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
              {getMobileOrderedCategories().map(c => (
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
        </div>
      )}
      
      {/* MODAL DE ADICIONAIS (CLIENTE) */}
      {addonModalConfig.isOpen && addonModalConfig.baseItem && (
        <div className="fixed inset-0 bg-black/60 z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-full sm:zoom-in-95">
             <div className="p-4 sm:p-6 border-b flex justify-between items-center bg-slate-50 sm:rounded-t-3xl rounded-t-3xl">
               <div>
                 <h3 className="font-bold text-xl text-slate-800">Monte: {addonModalConfig.baseItem.name}</h3>
                 <p className="text-sm font-bold text-blue-600">{formatMoney(addonModalConfig.baseItem.price)}</p>
               </div>
               <button onClick={() => setAddonModalConfig({isOpen:false, baseItem:null, addons:{}})} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><X size={20}/></button>
             </div>

             <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
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

             <div className="p-4 sm:p-6 border-t bg-white sm:rounded-b-3xl">
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
        <div className="fixed bottom-4 left-0 right-0 z-30 w-full sm:max-w-md mx-auto px-4 animate-in slide-in-from-bottom-5">
          <button onClick={() => setView('cart')} className="w-full bg-slate-900 text-white p-4 rounded-2xl shadow-xl flex justify-between items-center hover:bg-slate-800 transition-colors active:scale-95">
            <div className="flex items-center gap-3">
              <div className="bg-white text-slate-900 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">{count}</div>
              <span className="font-bold">Ver Carrinho</span>
            </div>
            <span className="font-bold text-lg">R$ {total.toFixed(2)}</span>
          </button>
        </div>
      )}
    </div>
  );
};

// --------------------------------------------------------------------------------
// SISTEMA POS (CAIXA E ADMIN)
// --------------------------------------------------------------------------------
const PosView = ({ user, onBack, initialSettings }) => {
  const [view, setView] = useState('pos');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [orderCounter, setOrderCounter] = useState(1);
  const [settings, setSettings] = useState(initialSettings);
  const [toast, setToast] = useState(null);
  const [confirmState, setConfirmState] = useState({ isOpen: false, msg: '', action: null });

  const [showMobileCart, setShowMobileCart] = useState(false);

  const [currentGuest, setCurrentGuest] = useState('Pessoa 1');
  const [guestList, setGuestList] = useState(['Pessoa 1']);
  const [payingGuest, setPayingGuest] = useState('Mesa Completa');
  const [renameModal, setRenameModal] = useState({ show: false, oldName: '', newName: '' });

  const [categories, setCategories] = useState([]);
  const [categoryOrder, setCategoryOrder] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedTabToSettle, setSelectedTabToSettle] = useState(null);
  const [partialPayments, setPartialPayments] = useState([]);
  const [paymentInputValue, setPaymentInputValue] = useState('');
  
  const [finalizedOrder, setFinalizedOrder] = useState(null);

  const [editingProduct, setEditingProduct] = useState(null);
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdCat, setNewProdCat] = useState('');
  const [newProdCost, setNewProdCost] = useState('');

  const [cashMovements, setCashMovements] = useState([]);
  const [costs, setCosts] = useState([]);
  const [showCostModal, setShowCostModal] = useState(false);
  const [costValue, setCostValue] = useState('');
  const [costDesc, setCostDesc] = useState('');
  const [costCategory, setCostCategory] = useState('Ingredientes');
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
  const [editingOrderDetails, setEditingOrderDetails] = useState(null);
  
  const [showDeleteAuthModal, setShowDeleteAuthModal] = useState(false);
  const [deletePasswordInput, setDeletePasswordInput] = useState('');
  const [deleteSingleOrderModal, setDeleteSingleOrderModal] = useState({ isOpen: false, orderId: null, orderFsId: null });
  const [deleteSinglePasswordInput, setDeleteSinglePasswordInput] = useState('');
  const [deleteSinglePasswordError, setDeleteSinglePasswordError] = useState('');

  const [configForm, setConfigForm] = useState({
    ...initialSettings,
    docType: initialSettings?.docType || 'CNPJ',
    docId: initialSettings?.docId || initialSettings?.cnpj || ''
  });

  const [reportDate, setReportDate] = useState(new Date());
  const [reportMode, setReportMode] = useState('daily');
  const [kitchenExpandedOrder, setKitchenExpandedOrder] = useState(null);
  const [now, setNow] = useState(Date.now());
  const prevOrderIds = useRef(new Set());
  const audioCtx = useRef(null);

  
  const [historyDate, setHistoryDate] = useState(getTodayStr());
  const [historySearch, setHistorySearch] = useState('');
  const [historyMethodFilter, setHistoryMethodFilter] = useState('Todos');

  const [addonModalConfig, setAddonModalConfig] = useState({ isOpen: false, baseItem: null, addons: {} });

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
      const list = snap.docs.map(d => ({ firestoreId: d.id, ...d.data() })).sort((a, b) => b.id - a.id);
      // Som de notificação para pedidos novos pendentes na cozinha
      const newPending = list.filter(o => o.kitchenStatus === 'Pendente' && o.items?.some(i => i.kitchenStatus === 'Pendente' || !i.kitchenStatus));
      const hasNewOrder = newPending.some(o => !prevOrderIds.current.has(o.firestoreId));
      if (hasNewOrder && prevOrderIds.current.size > 0) playNotificationSound();
      prevOrderIds.current = new Set(list.map(o => o.firestoreId));
      setOrders(list);
      if (list.length > 0) {
        const maxId = Math.max(0, ...list.map(o => Number(o.id) || 0));
        setOrderCounter(maxId + 1);
      }
    });
    const unsubMove = onSnapshot(query(getCollectionRef('cash_movements')), (snapshot) => { setCashMovements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))); });
    const unsubFuture = onSnapshot(query(getCollectionRef('future_orders')), (snap) => { setFutureOrders(snap.docs.map(d => ({ firestoreId: d.id, ...d.data() })).sort((a, b) => new Date(a.deliveryDate + 'T' + a.deliveryTime) - new Date(b.deliveryDate + 'T' + b.deliveryTime))); });
    const unsubCosts = onSnapshot(query(getCollectionRef('costs')), (snap) => { setCosts(snap.docs.map(d => ({ firestoreId: d.id, ...d.data() })).sort((a,b) => (b.date||'').localeCompare(a.date||''))); });
    // Carregar ordem das categorias
    const loadCatOrder = async () => {
      try {
        const snap = await getDoc(getDocRef('app_state', 'category_order'));
        if (snap.exists()) setCategoryOrder(snap.data().order || []);
      } catch(e) {}
    };
    loadCatOrder();
    return () => { unsubProd(); unsubOrders(); unsubMove(); unsubFuture(); unsubCosts(); };
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

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const playNotificationSound = () => {
    try {
      if (!audioCtx.current) audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioCtx.current;
      const freqs = [880, 1100, 880];
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.4, ctx.currentTime + i * 0.18);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.15);
        osc.start(ctx.currentTime + i * 0.18);
        osc.stop(ctx.currentTime + i * 0.18 + 0.15);
      });
    } catch(e) { console.log('Audio não suportado'); }
  };

  const addToCart = (p) => { 
    if (p.stock <= 0) { showToastMsg("Sem estoque!", "error"); return; } 
    const currentGuestName = currentGuest || 'Pessoa 1';

    if (BASE_CATEGORIES_FOR_ADDONS.includes(p.category)) {
      setAddonModalConfig({ isOpen: true, baseItem: p, addons: {} });
      return;
    }

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
      guest: currentGuest || 'Pessoa 1'
    };

    setCart([...cart, newItem]);
    setAddonModalConfig({ isOpen: false, baseItem: null, addons: {} });
    showToastMsg(`${baseItem.name} montado com sucesso!`);
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
    
    const isPartialPayment = payingGuest !== 'Mesa Completa';
    
    const cartWithStatus = cart.map(i => ({ ...i, kitchenStatus: i.kitchenStatus || 'Pendente' }));

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
          const updatedItems = [...(existing.items || []), ...cartWithStatus];
          await updateDoc(getDocRef('orders', existing.firestoreId), { 
            items: updatedItems, 
            total: (existing.total || 0) + getCartTotal(), 
            kitchenStatus: updatedItems.some(i => i.kitchenStatus === 'Pendente') ? 'Pendente' : 'Pronto', 
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
            kitchenStatus: cartWithStatus.some(i => i.kitchenStatus === 'Pendente') ? 'Pendente' : 'Pronto', 
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
        setShowMobileCart(false);
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
        paidAt: nowISO,
        receivedValue: cashPay ? received : null,
        changeValue: change > 0 ? change : null
      };

      if (selectedTabToSettle) {
        if (isPartialPayment && itemsToKeep.length > 0) {
          await addDoc(getCollectionRef('orders'), { 
            ...orderData, 
            origin: 'Caixa (Parcial)', 
            kitchenStatus: itemsToPay.some(i => i.kitchenStatus === 'Pendente') ? 'Pendente' : 'Pronto', 
            time: new Date().toLocaleTimeString().slice(0, 5),
            payments: paymentsToProcess.length > 0 ? paymentsToProcess : [{ method: 'Dinheiro', value: totalOrder }],
          });
          
          await updateDoc(getDocRef('orders', selectedTabToSettle.firestoreId), { 
            items: itemsToKeep,
            total: itemsToKeep.reduce((acc, item) => acc + calcItemTotal(item), 0),
            kitchenStatus: itemsToKeep.some(i => i.kitchenStatus === 'Pendente') ? 'Pendente' : 'Pronto',
            updatedAt: nowISO 
          });
        } else {
          await updateDoc(getDocRef('orders', selectedTabToSettle.firestoreId), { 
            paymentStatus: 'PAGO', 
            status: 'Pago',
            method: methodString, 
            payments: paymentsToProcess.length > 0 ? paymentsToProcess : [{ method: 'Dinheiro', value: totalOrder }], 
            paidAt: nowISO,
            receivedValue: orderData.receivedValue,
            changeValue: orderData.changeValue,
            kitchenStatus: itemsToPay.some(i => i.kitchenStatus === 'Pendente') ? 'Pendente' : 'Pronto'
          });
        }
      } else {
        if (isPartialPayment && itemsToKeep.length > 0) {
          await addDoc(getCollectionRef('orders'), { 
            ...orderData, 
            origin: 'Caixa (Parcial)', 
            kitchenStatus: itemsToPay.some(i => i.kitchenStatus === 'Pendente') ? 'Pendente' : 'Pronto', 
            time: new Date().toLocaleTimeString().slice(0, 5),
            payments: paymentsToProcess.length > 0 ? paymentsToProcess : [{ method: 'Dinheiro', value: totalOrder }]
          });
          await deductStock(itemsToPay);
          
          setFinalizedOrder(orderData);
          setCart(itemsToKeep); 
          const remainingGuests = [...new Set(itemsToKeep.map(i => i.guest || 'Pessoa 1'))];
          setGuestList(remainingGuests.length > 0 ? remainingGuests : ['Pessoa 1']);
          setCurrentGuest(remainingGuests.length > 0 ? remainingGuests[0] : 'Pessoa 1');
          setPartialPayments([]);
          setPayingGuest('Mesa Completa');
          setShowPaymentModal(false);
          setShowMobileCart(false);
          showToastMsg(`Venda finalizada para ${payingGuest}! O restante continua no carrinho.`);
          return; 
        } else {
          await addDoc(getCollectionRef('orders'), { 
            ...orderData, 
            origin: 'Caixa', 
            kitchenStatus: itemsToPay.some(i => i.kitchenStatus === 'Pendente') ? 'Pendente' : 'Pronto', 
            time: new Date().toLocaleTimeString().slice(0, 5),
            payments: paymentsToProcess.length > 0 ? paymentsToProcess : [{ method: 'Dinheiro', value: totalOrder }]
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
      setShowMobileCart(false);
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

    if (action === 'cancel') {
      try {
        const batch = writeBatch(db);
        const restores = getStockDeductions(order.items);
        Object.entries(restores).forEach(([prodId, totalQty]) => {
          const pItem = products.find(p => String(p.id) === String(prodId));
          if (pItem && pItem.firestoreId) {
            batch.update(getDocRef('products', pItem.firestoreId), { stock: pItem.stock + totalQty });
          }
        });
        const orderRef = getDocRef('orders', order.firestoreId);
        batch.delete(orderRef);
        await batch.commit();
        showToastMsg("Pedido cancelado e estoque restaurado!");
      } catch (error) { console.error(error); showToastMsg("Erro ao processar ação.", "error"); }
    } else if (action === 'edit') {
      setEditingOrderDetails(JSON.parse(JSON.stringify(order)));
    }
    setActionAuthModal({ show: false, action: null, order: null });
    setActionPassword('');
  };

  const handleSaveEditedOrder = async () => {
    if (!editingOrderDetails) return;
    try {
      const originalOrder = orders.find(o => o.firestoreId === editingOrderDetails.firestoreId);
      if (!originalOrder) return;

      const originalDeductions = getStockDeductions(originalOrder.items || []);
      const newDeductions = getStockDeductions(editingOrderDetails.items || []);

      const batch = writeBatch(db);
      
      products.forEach(pItem => {
         const oldQty = originalDeductions[pItem.id] || 0;
         const newQty = newDeductions[pItem.id] || 0;
         const diff = newQty - oldQty; 
         if (diff !== 0) {
            batch.update(getDocRef('products', pItem.firestoreId), {
               stock: Math.max(0, pItem.stock - diff)
            });
         }
      });

      const newTotal = editingOrderDetails.items.reduce((acc, item) => acc + calcItemTotal(item), 0);

      batch.update(getDocRef('orders', editingOrderDetails.firestoreId), {
         items: editingOrderDetails.items,
         total: newTotal,
         updatedAt: new Date().toISOString()
      });

      await batch.commit();
      showToastMsg("Comanda atualizada com sucesso!");
      setEditingOrderDetails(null);
    } catch(e) {
      console.error(e);
      showToastMsg("Erro ao atualizar comanda.", "error");
    }
  };
  
  const triggerClearHistory = () => {
    setShowDeleteAuthModal(true);
    setDeletePasswordInput('');
  };

  const handleDeleteSingleOrder = (order) => {
    setDeleteSinglePasswordInput('');
    setDeleteSinglePasswordError('');
    setDeleteSingleOrderModal({ isOpen: true, orderId: order.id, orderFsId: order.firestoreId });
  };

  const confirmDeleteSingleOrder = async () => {
    const currentPass = settings?.posPassword || '1234';
    if (deleteSinglePasswordInput.trim() !== currentPass.trim()) {
      setDeleteSinglePasswordError('Senha incorreta.');
      return;
    }
    const { orderFsId, orderId } = deleteSingleOrderModal;
    setDeleteSingleOrderModal({ isOpen: false, orderId: null, orderFsId: null });
    setConfirmState({
      isOpen: true,
      msg: `Excluir o pedido #${orderId} permanentemente? Esta ação não pode ser desfeita.`,
      action: async () => {
        try {
          await deleteDoc(getDocRef('orders', orderFsId));
          setConfirmState({ isOpen: false, msg: '', action: null });
          showToastMsg('Pedido excluído com sucesso!', 'success');
        } catch (e) {
          setConfirmState({ isOpen: false, msg: '', action: null });
          showToastMsg('Erro ao excluir pedido.', 'error');
        }
      }
    });
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
    setOrderDate(getLocalYMD(order.deliveryDate));
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
      deliveryDate: orderDate || getTodayStr(),
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
          await addDoc(getCollectionRef('orders'), { id: orderCounter + 1, client: `Sinal: ${orderClient}`, total: signalVal, status: 'Pago', paymentStatus: 'PAGO', method: orderSignalMethod, payments: [{ method: orderSignalMethod, value: signalVal }], date: new Date().toISOString(), paidAt: new Date().toISOString(), time: new Date().toLocaleTimeString().slice(0, 5), origin: 'Encomenda', kitchenStatus: 'N/A', items: [{ name: 'Sinal Encomenda', price: signalVal, qty: 1 }] });
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
      if (amountReceived > 0) await addDoc(getCollectionRef('orders'), { id: orderCounter + 1, client: `Restante: ${selectedFutureOrder.client}`, total: amountReceived, status: 'Pago', paymentStatus: 'PAGO', method: settleMethod, payments: [{ method: settleMethod, value: amountReceived }], date: new Date().toISOString(), paidAt: new Date().toISOString(), time: new Date().toLocaleTimeString().slice(0, 5), origin: 'Encomenda', kitchenStatus: 'N/A', items: [{ name: 'Restante Encomenda', price: amountReceived, qty: 1 }] });
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

  const saveCategoryOrder = async (newOrder) => {
    setCategoryOrder(newOrder);
    try { await setDoc(getDocRef('app_state', 'category_order'), { order: newOrder }); }
    catch(e) { console.error(e); }
  };

  const moveCategoryUp = (cat) => {
    const ordered = getOrderedCategories();
    const idx = ordered.indexOf(cat);
    if (idx <= 0) return;
    const newOrder = [...ordered];
    [newOrder[idx-1], newOrder[idx]] = [newOrder[idx], newOrder[idx-1]];
    saveCategoryOrder(newOrder);
  };

  const moveCategoryDown = (cat) => {
    const ordered = getOrderedCategories();
    const idx = ordered.indexOf(cat);
    if (idx >= ordered.length - 1) return;
    const newOrder = [...ordered];
    [newOrder[idx], newOrder[idx+1]] = [newOrder[idx+1], newOrder[idx]];
    saveCategoryOrder(newOrder);
  };

  const getOrderedCategories = () => {
    // Merge saved order with current categories (handles new categories)
    const current = [...new Set(products.map(p => p.category).filter(Boolean))];
    const saved = categoryOrder.filter(c => current.includes(c));
    const unsaved = current.filter(c => !saved.includes(c));
    return [...saved, ...unsaved];
  };

  const handleAddCost = async () => {
    if (!costValue || parseFloat(costValue) <= 0 || !user) return;
    try {
      await addDoc(getCollectionRef('costs'), {
        value: parseFloat(costValue),
        description: costDesc,
        category: costCategory,
        date: new Date().toISOString(),
        createdAt: Timestamp.now()
      });
      setShowCostModal(false);
      setCostValue('');
      setCostDesc('');
      showToastMsg('Custo registrado!');
    } catch(e) { console.error(e); showToastMsg('Erro ao registrar custo.', 'error'); }
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
      await addDoc(getCollectionRef('products'), { id: Date.now(), name: newProdName, price: safePrice, cost: parseFloat(newProdCost) || 0, category: newProdCat, stock: 50, icon: 'burger' }); 
      setNewProdName(''); 
      setNewProdPrice('');
      setNewProdCost('');
      showToastMsg("Produto adicionado!"); 
    }
    catch(e) { console.error("Adicionar produto erro:", e); showToastMsg("Erro: " + e.message, "error"); }
  };
  
  const handleUpdateProduct = async () => { 
    if (!editingProduct || !user) return; 
    try { 
      const priceStr = String(editingProduct.price).replace(',', '.');
      const priceNum = parseFloat(priceStr);
      if (isNaN(priceNum)) throw new Error("Preço inválido.");
      await updateDoc(getDocRef('products', editingProduct.firestoreId), { name: editingProduct.name, price: priceNum, cost: parseFloat(editingProduct.cost) || 0, category: editingProduct.category, stock: editingProduct.stock }); 
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
          const cols = ['orders', 'records_v2', 'closed_weeks', 'cash_movements', 'future_orders', 'costs'];
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
      if (!o || o.paymentStatus !== 'PAGO' || (!o.paidAt && !o.date)) return false;
      try {
        const orderDateStr = o.paidAt || o.date;
        const localYMD = getLocalYMD(orderDateStr);
        const [oy, om, od] = localYMD.split('-').map(Number);

        if (reportMode === 'daily') {
            return od === reportDate.getDate() && (om - 1) === reportDate.getMonth() && oy === reportDate.getFullYear();
        } else if (reportMode === 'weekly') {
            return getWeekId(localYMD) === getWeekId(reportDate.getFullYear() + '-' + String(reportDate.getMonth()+1).padStart(2,'0') + '-' + String(reportDate.getDate()).padStart(2,'0'));
        } else {
            return (om - 1) === reportDate.getMonth() && oy === reportDate.getFullYear();
        }
      } catch { return false; }
    });
  };
  
  const filteredOrders = getFilteredOrders();
  const filteredCosts = costs.filter(c => {
    if (!c.date) return false;
    const localYMD = getLocalYMD(c.date);
    const [oy, om, od] = localYMD.split('-').map(Number);
    const rdY = reportDate.getFullYear(), rdM = reportDate.getMonth(), rdD = reportDate.getDate();
    const rdYMD = rdY + '-' + String(rdM+1).padStart(2,'0') + '-' + String(rdD).padStart(2,'0');
    if (reportMode === 'daily') return od === rdD && (om-1) === rdM && oy === rdY;
    else if (reportMode === 'weekly') return getWeekId(localYMD) === getWeekId(rdYMD);
    else return (om-1) === rdM && oy === rdY;
  });
  const totalCosts = filteredCosts.reduce((acc, c) => acc + (Number(c.value) || 0), 0);
  const totalSales = filteredOrders.reduce((acc, order) => acc + (Number(order.total) || 0), 0);
  // Separar lanchonete vs encomendas
  const encOrders = filteredOrders.filter(o => o.origin === 'Encomenda');
  const lanchOrders = filteredOrders.filter(o => o.origin !== 'Encomenda');
  const totalEncomendas = encOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
  const totalLanchonete = lanchOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
  const lucroBruto = totalSales - cmvTotal;           // Faturamento - CMV
  const lucroLiquido = lucroBruto - totalCosts;        // Lucro Bruto - Custos do Período

  // CMV: custo de mercadoria vendida (qty vendida × custo cadastrado do produto)
  const cmvTotal = filteredOrders.reduce((acc, order) => {
    order.items?.forEach(item => {
      const prod = products.find(p => String(p.id) === String(item.id) || p.name === item.name);
      const cost = Number(prod?.cost || 0);
      acc += cost * Number(item.qty || 1);
      item.subItems?.forEach(sub => {
        const subProd = products.find(p => String(p.id) === String(sub.id) || p.name === sub.name);
        acc += Number(subProd?.cost || 0) * Number(sub.qty || 1) * Number(item.qty || 1);
      });
    });
    return acc;
  }, 0);
  const cmvPercent = totalSales > 0 ? ((cmvTotal / totalSales) * 100).toFixed(1) : '0.0';
  const salesByMethod = filteredOrders.reduce((acc, order) => {
    if (order.payments && Array.isArray(order.payments)) {
      order.payments.forEach(p => { const val = Number(p.value) || 0; if (p.method === 'Dinheiro') acc.dinheiro += val; else if (p.method === 'Pix') acc.pix += val; else if (['Crédito', 'Débito'].includes(p.method)) acc.cartao += val; });
    }
    else { const val = Number(order.total) || 0; const m = order.method || ''; if (m.includes('Dinheiro')) acc.dinheiro += val; else if (m.includes('Pix') || m.includes('PIX')) acc.pix += val; else acc.cartao += val; }
    return acc;
  }, { dinheiro: 0, pix: 0, cartao: 0 });
  
  const filteredMovements = cashMovements.filter(m => {
    if (!m.date) return false;
    const localYMD = getLocalYMD(m.date);
    const [oy, om, od] = localYMD.split('-').map(Number);

    const rdY = reportDate.getFullYear(), rdM = reportDate.getMonth(), rdD = reportDate.getDate();
    const rdYMD = rdY + '-' + String(rdM+1).padStart(2,'0') + '-' + String(rdD).padStart(2,'0');
    if (reportMode === 'daily') return od === rdD && (om-1) === rdM && oy === rdY;
    else if (reportMode === 'weekly') return getWeekId(localYMD) === getWeekId(rdYMD);
    else return (om-1) === rdM && oy === rdY;
  });
  
  const totalSuprimento = filteredMovements.filter(m => m.type === 'suprimento').reduce((acc, m) => acc + (Number(m.value) || 0), 0);
  const totalSangria = filteredMovements.filter(m => m.type === 'sangria').reduce((acc, m) => acc + (Number(m.value) || 0), 0);
  
  const orderMetrics = useMemo(() => {
    const today = getTodayStr(); 
    const cm = today.slice(0, 7); 
    const cy = today.slice(0, 4); 
    const cw = getWeekId(today); 
    
    let day = 0, week = 0, month = 0, year = 0; 
    futureOrders.forEach(o => {
      if (o.status === 'Cancelado') return; 
      const d = getLocalYMD(o.deliveryDate || ''); 
      const val = Number(o.total) || 0; 
      if (d === today) day += val; 
      if (d.startsWith(cm)) month += val; 
      if (d.startsWith(cy)) year += val; 
      if (getWeekId(d) === cw && d.startsWith(cy)) week += val;
    });
    return { day, week, month, year };
  }, [futureOrders]);

  const historyOrders = useMemo(() => {
    return orders.filter(o => {
      if (o.paymentStatus !== 'PAGO') return false;
      if (getLocalYMD(o.paidAt || o.date) !== historyDate) return false;
      if (historySearch && !o.client?.toLowerCase().includes(historySearch.toLowerCase())) return false;
      if (historyMethodFilter !== 'Todos') {
        const method = o.method || '';
        const payments = o.payments || [];
        // Verifica em payments individuais OU no método combinado salvo
        const normalizeMethod = (m) => m?.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        const filterNorm = normalizeMethod(historyMethodFilter);
        const hasMethod = payments.some(p => normalizeMethod(p.method) === filterNorm) 
          || normalizeMethod(method).includes(filterNorm);
        if (!hasMethod) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.paidAt || b.date) - new Date(a.paidAt || a.date));
  }, [orders, historyDate, historySearch, historyMethodFilter]);

  return (
    <div className="font-sans bg-slate-100 min-h-screen text-slate-900 flex animate-in fade-in">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <ConfirmDialog isOpen={confirmState.isOpen} message={confirmState.msg} onConfirm={confirmState.action} onCancel={() => setConfirmState({ isOpen: false, msg: '', action: null })} />

      {/* NAVBAR RESPONSIVA - Fundo na Mobile / Esquerda na Desktop */}
      <div className="bg-slate-900 text-white flex flex-row md:flex-col items-center justify-around md:justify-start md:py-6 fixed w-full h-16 bottom-0 md:h-full md:w-16 md:top-0 md:left-0 z-[60] shadow-[0_-10px_20px_rgba(0,0,0,0.1)] md:shadow-2xl px-2 md:px-0">
        <div onClick={onBack} className="hidden md:flex p-2 bg-amber-500 rounded-lg mb-2 cursor-pointer hover:bg-amber-400 transition-colors" title="Sair"><Store size={20} className="text-slate-900" /></div>
        <div className="flex flex-row md:flex-col items-center gap-1 sm:gap-2 md:gap-4 w-full md:mt-4 justify-between md:justify-start overflow-x-auto hide-scrollbar px-1">
          {[{v:'pos',i:ShoppingCart},{v:'tabs',i:ClipboardList},{v:'kitchen',i:ChefHat},{v:'orders',i:Cake},{v:'history',i:History},{v:'cash',i:Coins},{v:'admin',i:LayoutDashboard},{v:'costs',i:DollarSign},{v:'settings',i:Settings}].map(nav => {
            const Icon = nav.i;
            return (
              <button key={nav.v} onClick={() => { if(nav.v==='settings' && !isSettingsUnlocked) setShowSettingsPasswordModal(true); else setView(nav.v); }} className={`p-2.5 md:p-2 rounded-xl relative transition-all shrink-0 ${view === nav.v ? 'bg-indigo-600 shadow-lg text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                <Icon className="w-[22px] h-[22px] md:w-5 md:h-5" />
                {nav.v==='tabs' && orders.some(o=>o.paymentStatus==='ABERTO') && <span className="absolute -top-1 -right-1 bg-red-500 w-2 h-2 rounded-full"></span>}
                {nav.v==='admin' && products.some(p=>p.stock<=5) && <span className="absolute -top-1 -right-1 bg-red-500 w-2 h-2 rounded-full animate-pulse"></span>}
                {nav.v==='kitchen' && orders.some(o=>o.kitchenStatus==='Pendente' && o.items?.some(i => i.kitchenStatus === 'Pendente' || !i.kitchenStatus)) && <span className="absolute -top-1 -right-1 bg-red-500 w-2 h-2 rounded-full animate-pulse"></span>}
              </button>
            );
          })}
          <button onClick={onBack} className="md:hidden p-2.5 text-amber-500 hover:bg-slate-800 rounded-xl shrink-0"><LogOut className="w-[22px] h-[22px]" /></button>
        </div>
      </div>

      <div className="flex-1 w-full relative pb-16 md:pb-0 md:pl-16">
        
        {/* Modais Globais POS */}
        {showSettingsPasswordModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"><div className="bg-white rounded-2xl p-6 w-full max-w-sm"><h3 className="text-xl font-bold mb-4 text-center">Acesso Configurações</h3><input type="password" autoFocus placeholder="Senha" className="w-full border p-3 rounded-xl mb-4 text-center" value={settingsPasswordInput} onChange={e=>setSettingsPasswordInput(e.target.value)} onKeyDown={e=>e.key==='Enter' && (settingsPasswordInput===(settings?.settingsPassword||'1234')?(setIsSettingsUnlocked(true),setShowSettingsPasswordModal(false),setView('settings')):(showToastMsg("Senha incorreta","error"),setSettingsPasswordInput('')))} /><div className="flex gap-2"><button onClick={()=>setShowSettingsPasswordModal(false)} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold text-slate-600">Cancelar</button><button onClick={()=>settingsPasswordInput===(settings?.settingsPassword||'1234')?(setIsSettingsUnlocked(true),setShowSettingsPasswordModal(false),setView('settings')):(showToastMsg("Senha incorreta","error"),setSettingsPasswordInput(''))} className="flex-1 bg-gray-800 text-white py-3 rounded-xl font-bold">Acessar</button></div></div></div>
        )}

        {actionAuthModal.show && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 p-4"><div className="bg-white rounded-2xl p-6 w-full max-w-sm"><div className="flex justify-center mb-4 text-red-500"><AlertOctagon size={48} /></div><h3 className="text-xl font-bold mb-2 text-center">{actionAuthModal.action === 'cancel' ? 'Cancelar Pedido' : 'Editar Pedido'}</h3><p className="text-sm text-slate-500 mb-4 text-center">Esta ação requer autorização de gerente.</p><input type="password" autoFocus placeholder="Senha do Caixa" className="w-full border p-3 text-center mb-4 rounded-xl" value={actionPassword} onChange={e=>setActionPassword(e.target.value)} onKeyDown={e=>e.key==='Enter' && confirmActionAuth()} /><div className="flex gap-2"><button onClick={()=>{setActionAuthModal({show:false,action:null,order:null});setActionPassword('');}} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold text-slate-600">Cancelar</button><button onClick={confirmActionAuth} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold">Confirmar</button></div></div></div>
        )}

        {kitchenExpandedOrder && (
          <div className="fixed inset-0 bg-black/80 z-[400] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setKitchenExpandedOrder(null)}>
            <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
              <div className="bg-orange-500 text-white p-5 flex justify-between items-center">
                <div>
                  <div className="font-black text-xl">{kitchenExpandedOrder.client}</div>
                  <div className="text-orange-100 text-sm font-bold">Pedido #{String(kitchenExpandedOrder.id).slice(0,4)} • {kitchenExpandedOrder.time}</div>
                </div>
                <button onClick={() => setKitchenExpandedOrder(null)} className="p-2 hover:bg-white/20 rounded-full transition-colors"><X size={24}/></button>
              </div>
              <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
                {(kitchenExpandedOrder.items?.filter(i => i.kitchenStatus === 'Pendente' || !i.kitchenStatus) || []).map((item, idx) => (
                  <div key={idx} className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="bg-orange-500 text-white font-black text-lg px-3 py-1 rounded-xl">{item.qty}x</span>
                      <span className="font-black text-slate-800 text-lg">{item.name}</span>
                      {item.guest && !kitchenExpandedOrder.client?.includes(item.guest) && (
                        <span className="text-xs font-bold text-slate-500 bg-slate-200 px-2 py-1 rounded-full ml-auto">{item.guest}</span>
                      )}
                    </div>
                    {item.subItems && item.subItems.length > 0 && (
                      <div className="pl-4 space-y-1 mt-2">
                        {item.subItems.map((sub, sIdx) => (
                          <div key={sIdx} className="text-sm font-bold text-slate-700 bg-white border border-slate-200 px-3 py-1.5 rounded-xl">
                            + {sub.qty * item.qty}x {sub.name}
                          </div>
                        ))}
                      </div>
                    )}
                    {item.obs && (
                      <div className="mt-2 text-sm font-bold text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-xl">
                        ⚠️ OBS: {item.obs}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="p-5 border-t bg-slate-50 flex gap-3">
                <button onClick={() => setKitchenExpandedOrder(null)} className="flex-1 py-3.5 bg-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-300 transition-colors">Fechar</button>
                <button onClick={() => {
                  const updatedItems = (kitchenExpandedOrder.items || []).map(i => ({ ...i, kitchenStatus: 'Pronto' }));
                  updateDoc(getDocRef('orders', kitchenExpandedOrder.firestoreId), { kitchenStatus: 'Pronto', items: updatedItems });
                  showToastMsg('Pedido finalizado na cozinha!');
                  setKitchenExpandedOrder(null);
                }} className="flex-1 py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-xl shadow-lg transition-colors active:scale-95 flex items-center justify-center gap-2">
                  <CheckSquare size={20}/> Marcar Pronto
                </button>
              </div>
            </div>
          </div>
        )}

        {showDeleteAuthModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 p-4"><div className="bg-white rounded-2xl p-6 w-full max-w-sm"><div className="flex justify-center mb-4 text-red-500"><AlertTriangle size={48}/></div><h3 className="text-xl font-bold mb-2 text-center">Apagar Vendas</h3><p className="text-sm text-slate-500 mb-4 text-center">Esta ação apagará permanentemente todos os pedidos finalizados. Necessita senha de Configurações.</p><input type="password" autoFocus placeholder="Senha de Configuração" className="w-full border p-3 text-center mb-4 rounded-xl" value={deletePasswordInput} onChange={e=>setDeletePasswordInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&confirmClearHistory()} /><div className="flex gap-2"><button onClick={()=>{setShowDeleteAuthModal(false);setDeletePasswordInput('');}} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold text-slate-600">Cancelar</button><button onClick={confirmClearHistory} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold">Confirmar</button></div></div></div>
        )}

        {deleteSingleOrderModal.isOpen && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border-t-4 border-red-600 animate-in zoom-in-95">
              <div className="flex justify-center mb-4">
                <div className="bg-red-50 p-4 rounded-full text-red-600"><Lock size={36} /></div>
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-1 text-center">Confirmar Exclusão</h3>
              <p className="text-sm text-slate-500 mb-2 text-center">Pedido <span className="font-bold text-slate-800">#{deleteSingleOrderModal.orderId}</span></p>
              <p className="text-xs text-slate-400 mb-5 text-center">Digite a senha do gerente para continuar.</p>
              <input
                type="password"
                autoFocus
                placeholder="Senha do gerente"
                className="w-full border-2 p-4 rounded-xl text-center text-xl font-bold outline-none focus:border-red-500 transition-all mb-2"
                value={deleteSinglePasswordInput}
                onChange={(e) => { setDeleteSinglePasswordInput(e.target.value); setDeleteSinglePasswordError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && confirmDeleteSingleOrder()}
              />
              {deleteSinglePasswordError && (
                <p className="text-red-500 text-sm font-bold text-center mb-2">{deleteSinglePasswordError}</p>
              )}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setDeleteSingleOrderModal({ isOpen: false, orderId: null, orderFsId: null })}
                  className="flex-1 py-3.5 text-slate-500 bg-slate-100 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                >Cancelar</button>
                <button
                  onClick={confirmDeleteSingleOrder}
                  className="flex-1 bg-red-600 text-white py-3.5 rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-500/20"
                >Confirmar</button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL EDIÇÃO SEGURA DE COMANDA */}
        {editingOrderDetails && (
          <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95">
              <div className="p-6 border-b flex justify-between items-center bg-slate-50 rounded-t-3xl">
                 <div>
                   <h3 className="font-bold text-xl text-slate-800">Gerenciar Comanda</h3>
                   <p className="text-sm font-bold text-blue-600">{editingOrderDetails.client}</p>
                 </div>
                 <button onClick={() => setEditingOrderDetails(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><X size={20}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {editingOrderDetails.items?.length === 0 ? (
                    <div className="text-center text-slate-500 font-medium py-10">Nenhum item na comanda.</div>
                ) : (
                    editingOrderDetails.items.map(item => (
                        <div key={item.cartItemId} className="bg-white border rounded-2xl p-4 shadow-sm">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <div className="font-bold text-slate-800"><span className="text-blue-600 mr-1">{item.qty}x</span> {item.name}</div>
                                    <div className="text-sm text-slate-500 font-medium">{formatMoney(calcItemTotal(item))}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => {
                                        setEditingOrderDetails(prev => ({
                                            ...prev,
                                            items: prev.items.map(i => i.cartItemId === item.cartItemId ? { ...i, qty: Math.max(1, i.qty - 1) } : i)
                                        }));
                                    }} className="w-8 h-8 flex items-center justify-center bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200"><Minus size={16}/></button>
                                    <button onClick={() => {
                                        setEditingOrderDetails(prev => ({
                                            ...prev,
                                            items: prev.items.map(i => i.cartItemId === item.cartItemId ? { ...i, qty: i.qty + 1 } : i)
                                        }));
                                    }} className="w-8 h-8 flex items-center justify-center bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200"><Plus size={16}/></button>
                                    <button onClick={() => {
                                        setEditingOrderDetails(prev => ({
                                            ...prev,
                                            items: prev.items.filter(i => i.cartItemId !== item.cartItemId)
                                        }));
                                    }} className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-500 rounded-lg hover:bg-red-100 ml-2"><Trash2 size={16}/></button>
                                </div>
                            </div>
                            {item.subItems && item.subItems.length > 0 && (
                                <div className="pl-3 mt-3 space-y-2 border-l-2 border-indigo-200">
                                    {item.subItems.map(sub => (
                                        <div key={sub.id} className="flex justify-between items-center bg-slate-50 p-2 rounded-lg text-sm border border-slate-100">
                                            <span className="font-bold text-slate-600 text-xs">+ {sub.qty * item.qty}x {sub.name}</span>
                                            <button onClick={() => {
                                                setEditingOrderDetails(prev => ({
                                                    ...prev,
                                                    items: prev.items.map(i => i.cartItemId === item.cartItemId ? {
                                                        ...i, subItems: i.subItems.filter(s => String(s.id) !== String(sub.id))
                                                    } : i)
                                                }))
                                            }} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={14}/></button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))
                )}
              </div>
              <div className="p-6 border-t bg-white rounded-b-3xl">
                  <div className="flex justify-between items-center mb-4">
                      <span className="font-bold text-slate-500 uppercase text-sm">Novo Total</span>
                      <span className="font-black text-2xl text-blue-600">{formatMoney(editingOrderDetails.items?.reduce((acc, item) => acc + calcItemTotal(item), 0) || 0)}</span>
                  </div>
                  <button onClick={handleSaveEditedOrder} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-lg shadow-lg hover:bg-blue-700 active:scale-95 transition-all">
                    Salvar Alterações
                  </button>
              </div>
            </div>
          </div>
        )}

        {finalizedOrder && (
          <div className="fixed inset-0 bg-slate-900/80 z-[300] flex items-center justify-center p-4"><div className="bg-white rounded-3xl p-8 w-full max-w-sm text-center"><div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle size={48} className="text-green-600"/></div><h2 className="text-2xl font-black mb-2">Venda Finalizada!</h2><div className="space-y-3 mt-8"><button onClick={() => handlePrint(finalizedOrder, settings, 'customer')} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2"><Printer size={20}/> Imprimir Recibo</button><button onClick={() => setFinalizedOrder(null)} className="w-full bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold">Voltar ao Início</button></div></div></div>
        )}

        {/* MODAL PAGAMENTO OTIMIZADO RESPONSIVO */}
        {showPaymentModal && (
          <div className="fixed inset-0 bg-black/60 z-[250] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh] animate-in zoom-in-95">
              <div className="p-4 bg-slate-900 text-white flex justify-between items-center shrink-0">
                <h3 className="font-bold text-lg">Finalizar Venda</h3>
                <button onClick={()=>{setShowPaymentModal(false); setSelectedTabToSettle(null);}} className="p-1 hover:bg-white/20 rounded-full transition-colors"><X size={20}/></button>
              </div>
              <div className="p-4 space-y-3 overflow-y-auto">
                {uniqueGuestsInTab.length > 1 && (
                  <div className="bg-slate-50 p-2 rounded-xl">
                    <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                      <button onClick={()=>{setPayingGuest('Mesa Completa');setPartialPayments([]);setPaymentInputValue('');}} className={`px-4 py-2 rounded-lg text-xs font-bold border shrink-0 ${payingGuest==='Mesa Completa'?'bg-blue-600 text-white shadow-sm':'bg-white text-slate-600 border-slate-200'}`}>Tudo</button>
                      {uniqueGuestsInTab.map(g=><button key={g} onClick={()=>{setPayingGuest(g);setPartialPayments([]);setPaymentInputValue('');}} className={`px-4 py-2 rounded-lg text-xs font-bold border shrink-0 ${payingGuest===g?'bg-blue-600 text-white shadow-sm':'bg-white text-slate-600 border-slate-200'}`}>{g}</button>)}
                    </div>
                  </div>
                )}
                
                <div className="bg-white p-3 rounded-xl border shadow-sm max-h-36 overflow-y-auto">
                  <div className="space-y-2">
                    {itemsToPayLive.map(i=>(
                      <div key={i.cartItemId||Math.random()} className="flex justify-between text-sm border-b pb-2 last:border-0 last:pb-0">
                        <div className="flex gap-2">
                          <span className="font-black text-blue-600">{i.qty}x</span>
                          <span className="font-bold leading-tight">{i.name}{i.subItems?.map(s=><span key={s.id} className="block text-xs font-medium text-slate-500">+ {s.qty*i.qty}x {s.name}</span>)}</span>
                        </div>
                        <span className="font-black">{formatMoney(calcItemTotal(i))}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="bg-slate-100 p-3 rounded-xl flex justify-between items-center">
                  <span className="font-bold text-sm text-slate-600">A Receber</span>
                  <span className="text-2xl font-black text-blue-600">{formatMoney(modalTotal)}</span>
                </div>
                
                <div>
                  <input type="number" step="0.01" value={paymentInputValue} onChange={e=>setPaymentInputValue(e.target.value)} className="w-full p-3 border border-slate-300 rounded-xl text-lg font-black outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all" placeholder="Valor Dinheiro R$" />
                  {liveChange>0 && <div className="bg-emerald-50 p-3 rounded-xl mt-2 flex justify-between items-center border border-emerald-100"><span className="font-bold text-emerald-700 text-sm">TROCO:</span><span className="text-xl font-black text-emerald-800">{formatMoney(liveChange)}</span></div>}
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  {['Dinheiro', 'Pix', 'Crédito', 'Débito'].map(m=>(
                    <button key={m} onClick={()=>{const r=parseFloat((paymentInputValue||'').replace(',','.'))||modalRemaining; const v=Math.min(r,modalRemaining); const up=[...partialPayments,{method:m,value:v,receivedValue:m==='Dinheiro'?r:v,changeValue:m==='Dinheiro'?Math.max(0,r-modalRemaining):0}]; setPartialPayments(up); setPaymentInputValue(''); if(up.reduce((a,p)=>a+p.value,0)>=modalTotal-0.01) finalizeOrder(customerName||'Balcão','PAGO',up); }} className="py-3 border border-slate-200 rounded-xl font-bold text-sm text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors">{m}</button>
                  ))}
                </div>
                
                {!selectedTabToSettle && partialPayments.length===0 && (
                  <div className="pt-4 border-t border-slate-100 mt-1">
                    <div className="grid grid-cols-5 gap-1.5 mb-3">
                      {MESAS.map(m=><button key={m} onClick={()=>finalizeOrder(m,'ABERTO')} className={`py-1.5 text-[10px] font-bold rounded-lg border transition-colors ${orders.some(o=>o.client===m&&o.paymentStatus==='ABERTO')?'bg-indigo-50 text-indigo-700 border-indigo-200':'bg-white hover:bg-slate-50 border-slate-200'}`}>{m.replace('Mesa ','')}</button>)}
                    </div>
                    <div className="flex gap-2">
                      <input placeholder="Nome Cliente" value={customerName} onChange={e=>setCustomerName(e.target.value)} className="flex-1 border border-slate-300 p-2.5 rounded-xl text-sm outline-none font-bold focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all" />
                      <button onClick={()=>finalizeOrder(customerName,'ABERTO')} disabled={!customerName} className="bg-orange-500 hover:bg-orange-600 transition-colors text-white px-4 rounded-xl font-bold text-sm disabled:opacity-50 shadow-sm">Abrir Conta</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {renameModal.show && <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4"><div className="bg-white rounded-3xl p-6 w-full max-w-sm"><input autoFocus value={renameModal.newName} onChange={e=>setRenameModal({...renameModal,newName:e.target.value})} onKeyDown={e=>{if(e.key==='Enter'){const fn=renameModal.newName.trim()||renameModal.oldName; if(fn!==renameModal.oldName&&!guestList.includes(fn)){setGuestList(guestList.map(g=>g===renameModal.oldName?fn:g)); if(currentGuest===renameModal.oldName)setCurrentGuest(fn); setCart(cart.map(i=>i.guest===renameModal.oldName?{...i,guest:fn}:i));} setRenameModal({show:false,oldName:'',newName:''});}}} className="w-full border p-4 rounded-xl mb-6 text-lg font-bold" placeholder="Nome" /><div className="flex gap-2"><button onClick={()=>setRenameModal({show:false,oldName:'',newName:''})} className="flex-1 py-3 bg-slate-100 font-bold rounded-xl">Cancelar</button><button onClick={()=>{const fn=renameModal.newName.trim()||renameModal.oldName; if(fn!==renameModal.oldName&&!guestList.includes(fn)){setGuestList(guestList.map(g=>g===renameModal.oldName?fn:g)); if(currentGuest===renameModal.oldName)setCurrentGuest(fn); setCart(cart.map(i=>i.guest===renameModal.oldName?{...i,guest:fn}:i));} setRenameModal({show:false,oldName:'',newName:''});}} className="flex-1 bg-indigo-600 text-white font-bold py-3 rounded-xl">Salvar</button></div></div></div>}

        {/* MODAL DE ADICIONAIS (POS) */}
        {addonModalConfig.isOpen && addonModalConfig.baseItem && (
          <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95">
               <div className="p-6 border-b flex justify-between items-center bg-slate-50 rounded-t-3xl">
                 <div>
                   <h3 className="font-bold text-xl text-slate-800">Monte: {addonModalConfig.baseItem.name}</h3>
                   <p className="text-sm font-bold text-blue-600">{formatMoney(addonModalConfig.baseItem.price)}</p>
                 </div>
                 <button onClick={() => setAddonModalConfig({isOpen:false, baseItem:null, addons:{}})} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><X size={20}/></button>
               </div>

               <div className="flex-1 overflow-y-auto p-6 space-y-3">
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

               <div className="p-6 border-t bg-white rounded-b-3xl">
                  <button onClick={confirmAddonModal} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg shadow-lg hover:bg-indigo-700 active:scale-95 transition-all flex justify-between px-6 items-center">
                    <span>Confirmar & Adicionar</span>
                    <span className="bg-indigo-800/50 px-3 py-1 rounded-lg">{formatMoney(calculateModalTotal())}</span>
                  </button>
               </div>
            </div>
          </div>
        )}

        {/* MODAL MOVIMENTAÇÃO */}
        {showCostModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl animate-in zoom-in-95">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2"><DollarSign size={20} className="text-rose-600"/> Lançar Custo</h3>
                <button onClick={() => setShowCostModal(false)} className="hover:bg-slate-100 p-2 rounded-full transition-colors"><X size={20} className="text-slate-500" /></button>
              </div>
              <div className="mb-4">
                <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Categoria</label>
                <div className="flex gap-2 flex-wrap">
                  {['Ingredientes', 'Contas Fixas', 'Fornecedor', 'Outros'].map(cat => (
                    <button key={cat} onClick={() => setCostCategory(cat)} className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${costCategory === cat ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>{cat}</button>
                  ))}
                </div>
              </div>
              <div className="mb-4">
                <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Valor (R$)</label>
                <input type="number" step="0.01" autoFocus value={costValue} onChange={e => setCostValue(e.target.value)} className="w-full p-4 border border-slate-300 rounded-xl text-xl font-black text-center outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100 transition-all" placeholder="0.00" />
              </div>
              <div className="mb-8">
                <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Descrição</label>
                <input type="text" value={costDesc} onChange={e => setCostDesc(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddCost()} className="w-full p-4 border border-slate-300 rounded-xl outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100 transition-all font-medium" placeholder="Ex: Farinha de trigo, Conta de luz..." />
              </div>
              <button onClick={handleAddCost} className="w-full bg-rose-600 text-white py-4 rounded-xl font-bold hover:bg-rose-700 transition-colors shadow-xl shadow-rose-600/20 active:scale-95 text-lg">Confirmar Custo</button>
            </div>
          </div>
        )}

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
                  <div><label className="block text-xs font-bold text-slate-500 uppercase mb-2">Preço (R$)</label><input type="text" value={editingProduct.price} onChange={(e) => setEditingProduct({ ...editingProduct, price: e.target.value })} className="w-full p-3.5 border border-slate-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all font-bold text-slate-800" /></div>
                  <div><label className="block text-xs font-bold text-rose-500 uppercase mb-2">Custo CMV (R$)</label><input type="number" step="0.01" value={editingProduct.cost || ''} onChange={(e) => setEditingProduct({ ...editingProduct, cost: e.target.value })} className="w-full p-3.5 border border-rose-200 bg-rose-50 rounded-xl focus:border-rose-500 focus:ring-2 focus:ring-rose-100 outline-none transition-all font-bold text-rose-800" placeholder="0.00" /></div>
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

        {/* MODAL NOVA ENCOMENDA / EDITAR */}
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

        {/* MODAL DE FINALIZAR ENTREGA (ENCOMENDA) */}
        {selectedFutureOrder && (
          <div className="fixed inset-0 bg-black/60 z-[250] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95">
              <div className="p-6 bg-slate-900 text-white flex justify-between items-center"><h3 className="font-bold text-xl">Finalizar Entrega</h3><button onClick={() => setSelectedFutureOrder(null)}><X/></button></div>
              <div className="p-6 space-y-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">Cliente</p>
                  <p className="font-bold text-slate-800">{selectedFutureOrder.client}</p>
                </div>
                <div className="bg-indigo-50 p-5 rounded-2xl flex justify-between items-center border border-indigo-100">
                  <span className="font-bold text-indigo-900">Restante a Receber</span>
                  <span className="text-2xl font-black text-indigo-600">{formatMoney(selectedFutureOrder.total - selectedFutureOrder.signal)}</span>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Valor Recebido (R$)</label>
                  <input type="number" step="0.01" value={settleValue} onChange={e => setSettleValue(e.target.value)} className="w-full p-4 border rounded-2xl text-xl font-black outline-none focus:border-indigo-500" placeholder="0.00" autoFocus />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Método de Pagamento</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['Pix', 'Dinheiro', 'Cartão'].map(m => (
                      <button key={m} onClick={() => setSettleMethod(m)} className={`py-3 rounded-xl font-bold border transition-colors ${settleMethod === m ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>{m}</button>
                    ))}
                  </div>
                </div>
                <button onClick={handleSettleOrder} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-black text-lg shadow-lg active:scale-95 transition-all mt-4">Confirmar e Entregar</button>
              </div>
            </div>
          </div>
        )}

        {/* VIEWS */}
        {view === 'pos' && (
          <div className="flex h-[calc(100vh-4rem)] md:h-screen relative">
            <div className="flex-1 p-4 md:p-6 overflow-y-auto bg-slate-50 pb-28 md:pb-6">
              <h1 className="text-2xl font-bold mb-6">Novo Pedido (Balcão)</h1>
              <div className="bg-white p-4 mb-4 sticky top-0 z-10 border-b shadow-sm rounded-xl"><div className="flex gap-2 mb-3"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 text-slate-400" size={18} /><input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="Buscar..." className="w-full bg-slate-100 pl-10 p-2 rounded-lg text-sm outline-none" /></div></div><div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">{getOrderedCategories().map(c => <button key={c} onClick={()=>setSelectedCategory(c)} className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${selectedCategory===c?'bg-slate-900 text-white':'bg-slate-100 text-slate-600'}`}>{c}</button>)}</div></div>
              <div className="bg-white p-3 mb-6 flex items-center gap-2 overflow-x-auto shadow-sm rounded-xl border border-slate-200 hide-scrollbar"><Users size={18} className="text-slate-400 mr-1 shrink-0" />{guestList.map(g => (<div key={g} className={`flex items-center rounded-full border shrink-0 ${currentGuest===g?'bg-indigo-600 text-white':'bg-slate-50 text-slate-600'}`}><button onClick={()=>setCurrentGuest(g)} className="px-4 py-1.5 text-xs font-bold">{g}</button>{currentGuest===g && <button onClick={()=>setRenameModal({show:true,oldName:g,newName:g})} className="pr-3 pl-1 py-1.5"><Edit3 size={12}/></button>}</div>))}<button onClick={()=>{const nG=`Pessoa ${guestList.length+1}`;setGuestList([...guestList,nG]);setCurrentGuest(nG);}} className="px-4 py-1.5 rounded-full text-xs font-bold bg-white border border-dashed border-slate-400 flex items-center gap-1 shrink-0"><Plus size={12}/> Add Pessoa</button></div>
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-24">
                {filtered.map(p => (
                  <button key={p.id} onClick={()=>addToCart(p)} disabled={p.stock<=0} className={`bg-white p-4 rounded-2xl shadow-sm border flex flex-col text-left active:scale-95 ${p.stock<=0?'opacity-50':''}`}><div className="flex justify-between items-center mb-3 w-full"><div className="bg-blue-50 p-2 rounded-lg"><IconMapper type={p.icon} className="w-5 h-5 text-blue-600" /></div><span className="font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded-lg">{formatMoney(p.price)}</span></div><div className="font-bold text-slate-800 leading-tight mb-1">{p.name}</div><div className="text-xs font-bold text-slate-400">{p.stock} un</div></button>
                ))}
              </div>
            </div>

            {/* CARRINHO RESPONSIVO: Flutuante no Mobile, Fixo no Desktop */}
            <div className={`${showMobileCart ? 'fixed inset-0 z-[100] flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in' : 'hidden'} md:relative md:flex md:w-96 md:bg-white md:border-l md:border-slate-200 md:shadow-xl flex-col md:z-10`}>
               <div className={`w-full max-w-md bg-white h-full flex flex-col shadow-2xl md:shadow-none ${showMobileCart ? 'animate-in slide-in-from-right' : ''}`}>
                <div className="p-4 md:p-5 border-b bg-slate-50 flex justify-between items-center">
                  <div className="font-bold text-lg flex gap-2 items-center text-slate-800"><ShoppingCart size={22} className="text-blue-600" /> Carrinho</div>
                  <button onClick={() => setShowMobileCart(false)} className="md:hidden p-2 text-slate-500 bg-slate-200 rounded-full"><X size={20}/></button>
                </div>
                <div className="p-4 border-b bg-slate-50">
                  <div className="space-y-2"><label className="text-xs font-bold text-slate-500 uppercase">Vincular Cliente/Mesa:</label><input placeholder="Nome ou Mesa..." value={customerName} onChange={e=>setCustomerName(e.target.value)} className="w-full border p-2.5 rounded-xl text-sm outline-none font-bold" />{orders.filter(o=>o.paymentStatus==='ABERTO').length>0 && <div className="flex gap-2 overflow-x-auto pb-1 pt-1 hide-scrollbar">{orders.filter(o=>o.paymentStatus==='ABERTO').map(o=><button key={o.id} onClick={()=>setCustomerName(o.client)} className="px-3 py-1.5 rounded-lg text-xs font-bold border whitespace-nowrap bg-white hover:bg-slate-50">{o.client}</button>)}</div>}</div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white pb-20 md:pb-4">
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
                <div className="p-5 border-t bg-slate-50 mt-auto"><div className="flex justify-between mb-4 items-center"><span className="font-bold uppercase text-sm">Total</span><span className="text-3xl font-black text-blue-600">{formatMoney(cartTotal)}</span></div><div className="flex flex-col gap-3">{customerName && <button onClick={()=>finalizeOrder(customerName, 'ABERTO')} disabled={cart.length===0} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold flex justify-center gap-2 disabled:opacity-50"><ListPlus size={18}/> Lançar Comanda</button>}<button onClick={()=>{ if(cart.length>0){ const fakeOrder = { id: 'ATUAL', client: customerName || 'Balcão', items: cart, total: cartTotal, date: new Date().toISOString(), paidAt: null }; handlePrint(fakeOrder, settings, 'kitchen'); }}} disabled={cart.length===0} className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-bold flex justify-center gap-2 disabled:opacity-50 transition-colors"><Printer size={18}/> Imprimir Cozinha</button><button onClick={()=>{if(cart.length>0){setSelectedTabToSettle(null);setPartialPayments([]);setPaymentInputValue('');setPayingGuest('Mesa Completa');setShowPaymentModal(true);}}} disabled={cart.length===0} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-lg disabled:opacity-50">COBRAR AGORA</button></div></div>
              </div>
            </div>

            {/* BOTÃO FLUTUANTE CARRINHO (MOBILE) */}
            {cart.length > 0 && !showMobileCart && (
               <div className="md:hidden fixed bottom-20 left-4 right-4 z-[40]">
                 <button onClick={() => setShowMobileCart(true)} className="w-full bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex justify-between items-center active:scale-95 transition-transform border border-slate-700">
                   <div className="flex items-center gap-3">
                     <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">{cart.reduce((a,c)=>a+c.qty,0)}</div>
                     <span className="font-bold">Ver Carrinho</span>
                   </div>
                   <span className="font-bold text-lg">{formatMoney(cartTotal)}</span>
                 </button>
               </div>
            )}
          </div>
        )}

        {view === 'tabs' && (
          <div className="p-4 md:p-8 h-[calc(100vh-4rem)] md:h-screen overflow-y-auto bg-slate-50">
            <h1 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8 text-slate-800 flex items-center gap-3"><ClipboardList size={32} className="text-indigo-600" /> Comandas Abertas</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {orders.filter(o => o.paymentStatus === 'ABERTO').map(o => (
                <div key={o.id} className="bg-white p-5 rounded-2xl shadow-sm border border-indigo-100 relative overflow-hidden group hover:shadow-md transition-shadow">
                  {o.origin === 'Mobile' || o.origin === 'WhatsApp' ? <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] px-3 py-1 rounded-bl-xl font-bold shadow-sm">App/Site</div> : null}
                  <div className="font-bold text-xl text-indigo-900 mb-1">{o.client}</div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded font-bold">Origem: {o.waiter || 'Balcão'}</span>
                    <span className={`text-xs font-bold px-2 py-1 rounded ${(() => { const diff = Math.floor((Date.now() - new Date(o.date).getTime()) / 60000); return diff > 20 ? 'bg-red-100 text-red-700' : diff > 10 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'; })()}`}>
                      <Clock size={10} className="inline mr-1"/>{getElapsedTime(o.date)}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl mb-4 border border-slate-100">
                    <div className="text-sm font-bold text-slate-700 mb-1">{o.items ? o.items.length : 0} Lanches/Bebidas</div>
                    <div className="text-2xl font-black text-slate-800">{formatMoney(o.total)}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setSelectedTabToSettle(o); setPartialPayments([]); setPaymentInputValue(''); setPayingGuest('Mesa Completa'); setShowPaymentModal(true); }} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold text-sm transition-colors shadow-sm active:scale-95">Receber</button>
                    <button onClick={() => handlePrint(o, settings, 'customer')} className="bg-slate-100 text-slate-600 hover:bg-slate-200 p-3 rounded-xl transition-colors" title="Imprimir Comanda"><Printer size={18} /></button>
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
          <div className="p-4 md:p-8 h-[calc(100vh-4rem)] md:h-screen overflow-y-auto bg-slate-50">
            <h1 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8 text-slate-800 flex items-center gap-3"><ChefHat size={32} className="text-orange-500" /> Painel da Cozinha</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {orders.filter(o => o.kitchenStatus === 'Pendente' && o.items?.some(i => i.kitchenStatus === 'Pendente' || !i.kitchenStatus)).map(o => {
                const pendingItems = o.items?.filter(i => i.kitchenStatus === 'Pendente' || !i.kitchenStatus) || [];
                return (
                <div key={o.firestoreId} className="bg-white border-l-4 border-orange-500 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="font-bold text-lg text-slate-800 block leading-tight">{o.client}</span>
                      <span className="text-xs text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded">Pedido #{String(o.id).slice(0, 4)}</span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">{o.time}</span>
                    <span className={`text-xs font-bold px-2 py-1 rounded ${(() => { const diff = Math.floor((Date.now() - new Date(o.date).getTime()) / 60000); return diff > 20 ? 'bg-red-100 text-red-700 animate-pulse' : diff > 10 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'; })()}`}>
                      <Clock size={10} className="inline mr-1"/>{getElapsedTime(o.date)}
                    </span>
                  </div>
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

        {view === 'orders' && (
          <div className="p-4 md:p-8 h-[calc(100vh-4rem)] md:h-screen overflow-y-auto bg-slate-50">
            <header className="mb-6 md:mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-3"><Cake size={32} className="text-pink-600" /> Encomendas e Bolos</h1>
              <button onClick={() => { setEditingFutureOrder(null); setOrderClient(''); setOrderPhone(''); setOrderObs(''); setOrderSignal(''); setOrderTotalValue(''); setShowOrderModal(true); }} className="w-full md:w-auto bg-pink-600 hover:bg-pink-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-pink-600/20 flex items-center justify-center gap-2 active:scale-95 transition-all"><PlusCircle size={20} /> Nova Encomenda</button>
            </header>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
              <div className="bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-pink-100"><div className="text-[10px] md:text-xs text-slate-500 uppercase font-bold mb-1">Total Hoje</div><div className="text-xl md:text-2xl font-bold text-pink-600">{formatMoney(orderMetrics.day)}</div></div>
              <div className="bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-pink-100"><div className="text-[10px] md:text-xs text-slate-500 uppercase font-bold mb-1">Total Semana</div><div className="text-xl md:text-2xl font-bold text-pink-600">{formatMoney(orderMetrics.week)}</div></div>
              <div className="bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-pink-100"><div className="text-[10px] md:text-xs text-slate-500 uppercase font-bold mb-1">Total Mês</div><div className="text-xl md:text-2xl font-bold text-pink-600">{formatMoney(orderMetrics.month)}</div></div>
              <div className="bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-pink-100"><div className="text-[10px] md:text-xs text-slate-500 uppercase font-bold mb-1">Total Ano</div><div className="text-xl md:text-2xl font-bold text-pink-600">{formatMoney(orderMetrics.year)}</div></div>
            </div>
            <div className="space-y-4">{futureOrders.map(order => (
              <div key={order.firestoreId} onClick={() => setSelectedFutureOrder(order)} className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 md:gap-6 hover:shadow-md transition-all relative group">
                {(() => {
                  if (order.status === 'Concluído') return null;
                  const today = new Date(); today.setHours(0,0,0,0);
                  const delivery = new Date(order.deliveryDate); delivery.setHours(0,0,0,0);
                  const diffDays = Math.round((delivery - today) / 86400000);
                  if (diffDays < 0) return <div className="absolute top-4 right-4 bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1 animate-pulse"><AlertTriangle size={12}/> ATRASADA</div>;
                  if (diffDays === 0) return <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1 animate-pulse"><AlertTriangle size={12}/> HOJE</div>;
                  if (diffDays === 1) return <div className="absolute top-4 right-4 bg-amber-500 text-white px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1"><Clock size={12}/> AMANHÃ</div>;
                  if (diffDays === 2) return <div className="absolute top-4 right-4 bg-amber-400 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1"><Clock size={12}/> 2 dias</div>;
                  return null;
                })()}
                {order.status === 'Concluído' && <div className="absolute top-4 right-4 text-green-600 bg-green-50 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 border border-green-100"><CheckCircle2 size={14} /> Entregue</div>}
                <div className={`flex flex-col items-center justify-center p-4 rounded-xl min-w-[120px] border ${order.status === 'Concluído' ? 'bg-slate-50 border-slate-200 text-slate-400' : 'bg-pink-50 border-pink-100 text-pink-800 shadow-inner'}`}><span className="text-sm font-bold uppercase tracking-wider">{new Date(order.deliveryDate).toLocaleDateString('pt-BR', { month: 'short' })}</span><span className="text-4xl font-black my-1">{new Date(order.deliveryDate).getDate()}</span><span className="text-xs font-bold bg-white px-3 py-1 rounded-full border border-pink-200 shadow-sm">{order.deliveryTime}</span></div>
                <div className="flex-1">
                  <div className="flex flex-col md:flex-row md:justify-between items-start mb-3"><div><h3 className="text-xl font-bold text-slate-800 pr-24 md:pr-0">{order.client}</h3><div className="flex items-center gap-2 mt-2 md:mt-1"><p className="text-sm text-slate-500 font-medium flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-md"><Phone size={14} /> {order.phone}</p><button onClick={(e) => { e.stopPropagation(); openWhatsApp(order.phone); }} className="bg-green-500 hover:bg-green-600 text-white p-1.5 rounded-lg shadow-sm transition-colors active:scale-95" title="WhatsApp"><MessageCircle size={16} /></button>
                        <button onClick={(e) => {
                          e.stopPropagation();
                          if (!order.phone) { showToastMsg('Sem telefone cadastrado.', 'error'); return; }
                          const [y, m, d] = order.deliveryDate.split('-');
                          const dateStr = d + '/' + m + '/' + y;
                          const storeName = settings?.storeName || 'Café';
                          const msg = 'Olá ' + order.client + '! 😊 Passando para lembrar que sua encomenda está agendada para *' + dateStr + ' às ' + order.deliveryTime + '*.' + (order.signal < order.total ? ' O valor restante é de *R$ ' + (order.total - order.signal).toFixed(2) + '*.' : '') + ' Qualquer dúvida estamos à disposição! 🎂 ' + storeName;
                          const clean = order.phone.replace(/\D/g, '');
                          window.open('https://wa.me/55' + clean + '?text=' + encodeURIComponent(msg), '_blank');
                        }} className="bg-blue-500 hover:bg-blue-600 text-white p-1.5 rounded-lg shadow-sm transition-colors active:scale-95" title="Enviar lembrete WhatsApp"><Send size={16} /></button></div></div><div className="text-left md:text-right mt-3 md:mt-0"><div className="text-2xl font-black text-slate-800">{formatMoney(order.total)}</div>{order.signal > 0 ? (<span className="text-xs font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-md border border-green-100 mt-1 inline-block">Sinal: {formatMoney(order.signal)}</span>) : (<span className="text-xs font-bold text-red-500 bg-red-50 px-2.5 py-1 rounded-md border border-red-100 mt-1 inline-block">Sem Sinal</span>)}</div></div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4"><p className="text-xs font-bold text-slate-400 uppercase mb-2">Descrição da Produção</p><p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{order.description || 'Sem detalhes.'}</p></div>
                  <div className="flex flex-wrap gap-2 justify-end">
                    {order.status !== 'Concluído' && (
                      <button onClick={(e) => { e.stopPropagation(); setSelectedFutureOrder(order); }} className="flex-1 md:flex-none text-xs text-emerald-600 hover:text-emerald-800 font-bold px-4 py-2 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1"><CheckSquare size={14}/> Finalizar Entrega</button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); openEditOrderModal(order); }} className="flex-1 md:flex-none text-xs text-blue-600 hover:text-blue-800 font-bold px-4 py-2 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center gap-1"><Edit3 size={14}/> Editar</button>
                    <button onClick={(e) => { e.stopPropagation(); handlePrintOrderReceipt(order, settings); }} className="flex-1 md:flex-none text-xs text-indigo-600 hover:text-indigo-800 font-bold px-4 py-2 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors flex items-center justify-center gap-1"><Printer size={14}/> Recibo</button>
                    <button onClick={(e) => { e.stopPropagation(); setConfirmState({ isOpen: true, msg: 'Excluir Encomenda?', action: async () => { await deleteDoc(getDocRef('future_orders', order.firestoreId)); setConfirmState({isOpen:false}); showToastMsg("Excluída!"); } }); }} className="text-xs text-red-500 hover:text-red-700 font-bold z-10 px-4 py-2 bg-red-50 rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center gap-1"><Trash2 size={14}/> Excluir</button>
                  </div>
                </div>
              </div>
            ))}
            {futureOrders.length === 0 && <div className="text-center text-slate-400 py-10 font-medium">Nenhuma encomenda registrada.</div>}
            </div>
          </div>
        )}

        {view === 'admin' && (
          <div className="p-4 md:p-8 h-[calc(100vh-4rem)] md:h-screen overflow-y-auto bg-slate-50">
            <header className="mb-6 md:mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-3"><LayoutDashboard size={32} className="text-purple-600" /> Dashboard & Gestão</h1>
              {products.filter(p => p.stock <= 5).length > 0 && (
                <div className="w-full md:w-auto bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-start gap-3">
                  <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-red-700 text-sm">Estoque crítico!</div>
                    <div className="text-xs text-red-600 font-medium">
                      {products.filter(p => p.stock <= 5).map(p => `${p.name} (${p.stock} un)`).join(' • ')}
                    </div>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2 md:gap-3 w-full md:w-auto">
                <button onClick={triggerClearHistory} className="flex-1 md:flex-none justify-center bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all shadow-sm border border-red-200 flex items-center gap-2 active:scale-95"><Trash2 size={18} /> Apagar Vendas</button>
                <button onClick={() => handlePrintFinancialReport(filteredOrders, filteredMovements, salesByMethod, totalSales, totalSuprimento, totalSangria, reportDate, reportMode, settings, filteredCosts, totalCosts, cmvTotal, totalLanchonete, totalEncomendas, encOrders)} disabled={filteredOrders.length === 0} className="flex-1 md:flex-none justify-center bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all shadow-sm flex items-center gap-2 active:scale-95 disabled:opacity-50"><Printer size={18}/> Relatório Financeiro</button>
                <button onClick={() => handlePrintTopSelling(filteredOrders, reportDate, reportMode, settings)} disabled={filteredOrders.length === 0} className="flex-1 md:flex-none justify-center bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all shadow-sm flex items-center gap-2 active:scale-95 disabled:opacity-50"><TrendingUp size={18}/> Top Vendidos</button>
                <button onClick={() => setShowCashMovementModal(true)} className="flex-1 md:flex-none justify-center bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2 active:scale-95"><ArrowRightLeft size={18} /> Lançar Movimentação</button>
                <button onClick={() => setShowCostModal(true)} className="flex-1 md:flex-none justify-center bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all shadow-lg flex items-center gap-2 active:scale-95"><DollarSign size={18} /> Lançar Custo</button>
                <div className="flex w-full md:w-auto bg-white p-1.5 rounded-xl shadow-sm border border-slate-200 mt-2 md:mt-0">
                  <button onClick={() => setReportMode('daily')} className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all ${reportMode === 'daily' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>Diário</button>
                  <button onClick={() => setReportMode('weekly')} className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all ${reportMode === 'weekly' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>Semanal</button>
                  <button onClick={() => setReportMode('monthly')} className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all ${reportMode === 'monthly' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>Mensal</button>
                </div>
              </div>
            </header>
            
            <div className="mb-8 flex flex-col md:flex-row justify-between items-center bg-white p-4 md:p-5 rounded-3xl shadow-sm border border-slate-200 gap-4">
              <div className="flex items-center gap-2 md:gap-4 w-full md:w-auto justify-between">
                <button onClick={() => reportMode === 'daily' ? changeDate(-1) : reportMode === 'weekly' ? changeWeek(-1) : changeMonth(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ChevronLeft size={24} className="text-slate-600" /></button>
                <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3"><Calendar size={20} className="text-blue-600 hidden sm:block" />
                  <span className="text-lg md:text-xl font-bold text-slate-800 capitalize min-w-[150px] md:min-w-[200px] text-center">
                    {reportMode === 'daily' ? reportDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }) : 
                     reportMode === 'weekly' ? `Semana ${getWeekId(reportDate.toISOString().split('T')[0]).split('-W')[1]} de ${reportDate.getFullYear()}` :
                     reportDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                  </span>
                </div>
                <button onClick={() => reportMode === 'daily' ? changeDate(1) : reportMode === 'weekly' ? changeWeek(1) : changeMonth(1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ChevronRight size={24} className="text-slate-600" /></button>
              </div>
              <button onClick={() => setReportDate(new Date())} className="w-full md:w-auto text-sm font-bold text-blue-600 bg-blue-50 md:bg-transparent hover:bg-blue-100 md:hover:bg-blue-50 px-4 py-3 md:py-2 rounded-xl border border-blue-100 transition-colors">Voltar para Hoje</button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
              <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="p-5 md:p-6 bg-gradient-to-br from-emerald-50 to-green-50 rounded-3xl border border-emerald-100 flex items-center justify-between shadow-sm"><div><div className="text-emerald-700 text-xs md:text-sm font-bold uppercase mb-2 flex items-center gap-2"><ArrowUpCircle size={18} /> Entrada (Suprimento)</div><div className="text-3xl md:text-4xl font-black text-slate-800">{formatMoney(totalSuprimento)}</div></div><div className="bg-white p-3 md:p-4 rounded-2xl text-emerald-600 shadow-sm border border-emerald-100"><Coins size={28} className="md:w-8 md:h-8" /></div></div>
                <div className="p-5 md:p-6 bg-gradient-to-br from-red-50 to-rose-50 rounded-3xl border border-red-100 flex items-center justify-between shadow-sm"><div><div className="text-red-700 text-xs md:text-sm font-bold uppercase mb-2 flex items-center gap-2"><ArrowDownCircle size={18} /> Saída (Sangria)</div><div className="text-3xl md:text-4xl font-black text-slate-800">{formatMoney(totalSangria)}</div></div><div className="bg-white p-3 md:p-4 rounded-2xl text-red-600 shadow-sm border border-red-100"><Wallet size={28} className="md:w-8 md:h-8" /></div></div>
              </div>
              
              <div className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-slate-200 lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                <div className="p-4 md:p-5 bg-blue-50/50 rounded-2xl border border-blue-100">
                  <div className="text-blue-700 text-xs md:text-sm font-bold uppercase mb-2 flex items-center gap-2"><DollarSign size={18} /> Faturamento Bruto</div>
                  <div className="text-3xl md:text-4xl font-black text-slate-800">{formatMoney(totalSales)}</div>
                  <div className="text-xs text-slate-400 mt-1">{filteredOrders.length} pedido(s) • Ticket médio: {formatMoney(filteredOrders.length > 0 ? totalSales / filteredOrders.length : 0)}</div>
                </div>
                <div className="p-4 md:p-5 bg-orange-50/50 rounded-2xl border border-orange-100">
                  <div className="text-orange-700 text-xs md:text-sm font-bold uppercase mb-2 flex items-center gap-2"><Package size={18} /> (-) CMV</div>
                  <div className="text-3xl md:text-4xl font-black text-slate-800">{formatMoney(cmvTotal)}</div>
                  <div className="text-xs text-orange-500 mt-1">{cmvPercent}% do faturamento</div>
                </div>
                <div className={`p-4 md:p-5 rounded-2xl border ${lucroBruto >= 0 ? 'bg-teal-50/50 border-teal-100' : 'bg-red-50/50 border-red-100'}`}>
                  <div className={`text-xs md:text-sm font-bold uppercase mb-2 flex items-center gap-2 ${lucroBruto >= 0 ? 'text-teal-700' : 'text-red-700'}`}><TrendingUp size={18} /> (=) Lucro Bruto</div>
                  <div className={`text-3xl md:text-4xl font-black ${lucroBruto >= 0 ? 'text-teal-700' : 'text-red-700'}`}>{formatMoney(lucroBruto)}</div>
                  <div className="text-xs text-slate-400 mt-1">{totalSales > 0 ? ((lucroBruto/totalSales)*100).toFixed(1) : '0.0'}% margem bruta</div>
                </div>
                <div className="p-4 md:p-5 bg-rose-50/50 rounded-2xl border border-rose-100">
                  <div className="text-rose-700 text-xs md:text-sm font-bold uppercase mb-2 flex items-center gap-2"><ArrowDownCircle size={18} /> (-) Custos do Período</div>
                  <div className="text-3xl md:text-4xl font-black text-slate-800">{formatMoney(totalCosts)}</div>
                </div>
                <div className={`p-4 md:p-5 rounded-2xl border md:col-span-2 ${lucroLiquido >= 0 ? 'bg-emerald-50/50 border-emerald-100' : 'bg-red-50/50 border-red-100'}`}>
                  <div className={`text-xs md:text-sm font-bold uppercase mb-2 flex items-center gap-2 ${lucroLiquido >= 0 ? 'text-emerald-700' : 'text-red-700'}`}><TrendingUp size={18} /> (=) Lucro Líquido</div>
                  <div className={`text-4xl md:text-5xl font-black ${lucroLiquido >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatMoney(lucroLiquido)}</div>
                  <div className="text-xs text-slate-400 mt-1">{totalSales > 0 ? ((lucroLiquido/totalSales)*100).toFixed(1) : '0.0'}% margem líquida</div>
                </div>
                <div className="p-4 md:p-5 bg-pink-50/50 rounded-2xl border border-pink-100"><div className="text-pink-700 text-xs md:text-sm font-bold uppercase mb-2 flex items-center gap-2"><Cake size={18} /> 🎂 Encomendas</div><div className="flex items-end gap-4"><div className="text-3xl md:text-4xl font-black text-slate-800">{formatMoney(totalEncomendas)}</div><div className="text-sm font-bold text-pink-600 mb-1">{encOrders.length} pedido(s)</div></div><div className="text-xs text-pink-500 font-medium mt-1">Lanchonete: {formatMoney(totalLanchonete)}</div></div>
              </div>
              
              <div className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-slate-200 lg:col-span-2">
                <h3 className="font-bold text-lg md:text-xl text-slate-800 mb-4 md:mb-6 flex items-center gap-2"><Wallet size={20} className="text-blue-500" /> Detalhamento Financeiro</h3>
                <div className="overflow-x-auto rounded-2xl border border-slate-100 w-full">
                  <table className="w-full text-left min-w-[400px]">
                    <thead className="bg-slate-50 text-slate-500 text-[10px] md:text-xs uppercase font-bold tracking-wider"><tr><th className="p-3 md:p-4">Método de Pagamento</th><th className="p-3 md:p-4 text-right">Valor Total Recebido</th></tr></thead>
                    <tbody className="divide-y divide-slate-100 text-xs md:text-sm">
                      <tr className="hover:bg-slate-50 transition-colors"><td className="p-3 md:p-4 font-bold text-slate-700 flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-teal-400"></div> PIX</td><td className="p-3 md:p-4 text-right font-mono text-sm md:text-base font-medium">R$ {salesByMethod.pix.toFixed(2)}</td></tr>
                      <tr className="hover:bg-slate-50 transition-colors"><td className="p-3 md:p-4 font-bold text-slate-700 flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-400"></div> Dinheiro</td><td className="p-3 md:p-4 text-right font-mono text-sm md:text-base font-medium">R$ {salesByMethod.dinheiro.toFixed(2)}</td></tr>
                      <tr className="hover:bg-slate-50 transition-colors"><td className="p-3 md:p-4 font-bold text-slate-700 flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-indigo-400"></div> Cartão (Déb/Créd)</td><td className="p-3 md:p-4 text-right font-mono text-sm md:text-base font-medium">R$ {salesByMethod.cartao.toFixed(2)}</td></tr>
                      <tr className="hover:bg-slate-50 transition-colors"><td className="p-3 md:p-4 font-bold text-slate-700 flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-orange-300"></div> 🏪 Lanchonete</td><td className="p-3 md:p-4 text-right font-mono text-sm md:text-base font-medium">R$ {totalLanchonete.toFixed(2)}</td></tr>
                      <tr className="hover:bg-slate-50 transition-colors"><td className="p-3 md:p-4 font-bold text-slate-700 flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-pink-400"></div> 🎂 Encomendas</td><td className="p-3 md:p-4 text-right font-mono text-sm md:text-base font-medium">R$ {totalEncomendas.toFixed(2)}</td></tr>
                      <tr className="bg-slate-50 border-t-2 border-slate-200"><td className="p-4 md:p-5 font-black text-slate-800 uppercase text-xs md:text-sm">Total Consolidado</td><td className="p-4 md:p-5 text-right font-black text-slate-900 font-mono text-lg md:text-xl text-blue-600">R$ {totalSales.toFixed(2)}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
              
              <div className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-slate-200 lg:col-span-1">
                <h3 className="font-bold text-lg md:text-xl text-slate-800 mb-4 md:mb-6 flex items-center gap-2"><TrendingUp size={20} className="text-yellow-500" /> Top 10 Mais Vendidos</h3>
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
                      <div className="flex justify-between text-xs md:text-sm mb-1.5"><span className="font-bold text-slate-700 truncate pr-2">{i + 1}. {n}</span><span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md shrink-0">{q} un</span></div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{ width: '100%' }}></div></div>
                    </div>
                  ))}
                  {Object.keys(filteredOrders).length === 0 && <div className="text-slate-400 text-sm text-center font-medium pt-10">Nenhuma venda no período.</div>}
                </div>
              </div>
              
              <div className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-slate-200 lg:col-span-3">
                <h3 className="font-bold text-lg md:text-xl text-slate-800 mb-4 md:mb-6 flex items-center gap-2"><Plus size={20} className="text-emerald-500" /> Cadastro e Gestão de Produtos</h3>
                <div className="space-y-4 mb-6 md:mb-8 p-4 md:p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <div><label className="block text-xs font-bold text-slate-500 uppercase mb-2">Nome do Produto</label><input value={newProdName} onChange={(e) => setNewProdName(e.target.value)} className="w-full p-3.5 border border-slate-200 bg-white rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm" placeholder="Ex: X-Tudo, Bolo de Cenoura..." /></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-2">Preço (R$)</label><input type="number" step="0.01" value={newProdPrice} onChange={(e) => setNewProdPrice(e.target.value)} className="w-full p-3.5 border border-slate-200 bg-white rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm" placeholder="0.00" /></div><div><label className="block text-xs font-bold text-rose-500 uppercase mb-2">Custo CMV (R$)</label><input type="number" step="0.01" value={newProdCost} onChange={(e) => setNewProdCost(e.target.value)} className="w-full p-3.5 border border-rose-200 bg-rose-50 rounded-xl outline-none focus:ring-2 focus:ring-rose-100 text-sm font-bold text-rose-800" placeholder="0.00" /></div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Categoria</label>
                      <input type="text" list="cat-list" value={newProdCat} onChange={(e) => setNewProdCat(e.target.value)} className="w-full p-3.5 border border-slate-200 bg-white rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm" placeholder="Ex: Lanches, Bebidas..." />
                      <datalist id="cat-list">
                        {categories.map(c => <option key={c} value={c} />)}
                      </datalist>
                    </div>
                  </div>
                  <button onClick={addNewProduct} className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20 active:scale-95 text-base md:text-lg mt-2">Adicionar Novo Produto</button>
                </div>
                
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-bold text-slate-600 text-sm uppercase">Produtos cadastrados</h4>
                  <button onClick={() => {
                    const updates = products.map(p => ({ ...p, newStock: '' }));
                    setConfirmState({ isOpen: true, msg: 'Deseja repor o estoque de todos os produtos para 50 unidades?', action: async () => {
                      const batch = writeBatch(db);
                      products.forEach(p => { if (p.firestoreId) batch.update(getDocRef('products', p.firestoreId), { stock: 50 }); });
                      await batch.commit();
                      setConfirmState({ isOpen: false, msg: '', action: null });
                      showToastMsg('Estoque de todos os produtos reposto para 50 un!');
                    }});
                  }} className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl text-sm border border-blue-200 transition-colors active:scale-95">
                    <PlusCircle size={16}/> Repor Tudo (50 un)
                  </button>
                </div>
                <div className="space-y-4">
                  {getOrderedCategories().map((cat, catIdx) => {
                    const catProducts = products.filter(p => p.category === cat);
                    if (catProducts.length === 0) return null;
                    const orderedCats = getOrderedCategories();
                    return (
                      <div key={cat} className="rounded-2xl border border-slate-200 overflow-hidden">
                        {/* Cabeçalho da categoria */}
                        <div className="bg-slate-800 text-white px-4 py-3 flex justify-between items-center">
                          <span className="font-black text-sm tracking-wide uppercase">{cat}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 font-medium">{catProducts.length} produto(s)</span>
                            <div className="flex gap-1">
                              <button onClick={() => moveCategoryUp(cat)} disabled={catIdx === 0} className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg disabled:opacity-30 transition-colors" title="Mover categoria para cima"><ChevronLeft size={14} className="rotate-90"/></button>
                              <button onClick={() => moveCategoryDown(cat)} disabled={catIdx === orderedCats.length - 1} className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg disabled:opacity-30 transition-colors" title="Mover categoria para baixo"><ChevronRight size={14} className="rotate-90"/></button>
                            </div>
                          </div>
                        </div>
                        {/* Produtos da categoria */}
                        <table className="w-full text-left">
                          <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-wider font-bold border-b border-slate-100">
                            <tr><th className="px-4 py-2">Produto</th><th className="px-4 py-2">Preço</th><th className="px-4 py-2 text-rose-500">CMV</th><th className="px-4 py-2 text-center">Estoque</th><th className="px-4 py-2 text-right">Ações</th></tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs md:text-sm">
                            {catProducts.map(p => (
                              <tr key={p.id} className="hover:bg-blue-50/50 transition-colors">
                                <td className="px-4 py-3 font-bold text-slate-800">{p.name}</td>
                                <td className="px-4 py-3 font-medium text-slate-700">R$ {Number(p.price).toFixed(2)}</td>
                                <td className="px-4 py-3"><span className="text-rose-600 font-bold">R$ {Number(p.cost || 0).toFixed(2)}</span></td>
                                <td className="px-4 py-3 text-center"><span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${p.stock <= 5 ? 'bg-red-100 text-red-700' : p.stock < 15 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{p.stock} un</span></td>
                                <td className="px-4 py-3 text-right">
                                  <div className="flex justify-end gap-1 md:gap-2">
                                    <button onClick={() => setEditingProduct(p)} className="text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 md:px-3 py-1.5 rounded-lg flex items-center gap-1 font-bold text-[10px] md:text-xs transition-colors"><Edit3 size={14} className="hidden md:block"/> Editar</button>
                                    <button onClick={() => confirmDeleteProduct(p)} className="text-red-600 bg-red-50 hover:bg-red-100 px-2 md:px-3 py-1.5 rounded-lg flex items-center gap-1 font-bold text-[10px] md:text-xs transition-colors"><Trash2 size={14} className="hidden md:block"/> Excluir</button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'history' && (
          <div className="p-4 md:p-8 h-[calc(100vh-4rem)] md:h-screen overflow-y-auto bg-slate-50">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-3">
              <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-3"><History size={32} className="text-indigo-600" /> Histórico de Vendas</h1>
              {historyOrders.length > 0 && (
                <div className="flex items-center gap-3">
                  <div className="bg-blue-50 border border-blue-100 px-4 py-2 rounded-xl flex items-center gap-2">
                    <ShoppingCart size={16} className="text-blue-600" />
                    <span className="font-bold text-blue-700 text-sm">{historyOrders.length} venda{historyOrders.length > 1 ? 's' : ''}</span>
                  </div>
                  <div className="bg-green-50 border border-green-100 px-4 py-2 rounded-xl flex items-center gap-2">
                    <DollarSign size={16} className="text-green-600" />
                    <span className="font-black text-green-700">{formatMoney(historyOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0))}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-6 flex flex-col gap-3">
              <div className="flex flex-col md:flex-row gap-3">
                <input type="date" value={historyDate} onChange={e => { setHistoryDate(e.target.value); setHistoryMethodFilter('Todos'); setHistorySearch(''); }} className="p-3 border border-slate-300 rounded-xl outline-none font-bold w-full md:w-auto text-sm md:text-base" />
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
                  <input value={historySearch} onChange={e => setHistorySearch(e.target.value)} placeholder="Buscar cliente..." className="w-full bg-slate-50 pl-10 p-3 border border-slate-300 rounded-xl outline-none font-bold text-sm md:text-base" />
                </div>
                <button onClick={() => handlePrintHistoryReport(historyOrders, historyDate, settings)} disabled={historyOrders.length === 0} className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm disabled:opacity-50 transition-colors shadow-sm active:scale-95 whitespace-nowrap"><Printer size={16}/> Imprimir Relatório</button>
                <button onClick={() => {
                  const rows = [['Pedido','Cliente','Data','Hora','Método','Total']];
                  historyOrders.forEach(o => {
                    const dt = new Date(o.paidAt || o.date);
                    rows.push(['#' + o.id, o.client, dt.toLocaleDateString('pt-BR'), dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}), o.method || '', 'R$ ' + Number(o.total).toFixed(2)]);
                  });
                  const csv = rows.map(r => r.map(v => '"' + String(v).replace(/"/g,'""') + '"').join(',')).join(String.fromCharCode(10));
                  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = 'vendas-' + historyDate + '.csv'; a.click();
                  URL.revokeObjectURL(url);
                }} disabled={historyOrders.length === 0} className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm disabled:opacity-50 transition-colors shadow-sm active:scale-95 whitespace-nowrap"><ArrowDownCircle size={16}/> Exportar CSV</button>
              </div>
              <div className="flex gap-2 flex-wrap">
                {['Todos', 'Pix', 'Dinheiro', 'Crédito', 'Débito'].map(m => (
                  <button key={m} onClick={() => setHistoryMethodFilter(m)} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-colors ${historyMethodFilter === m ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>{m}</button>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              {historyOrders.map(order => (
                <div key={order.id} className="bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <div className="font-bold text-base md:text-lg text-slate-800 flex items-center gap-2">
                      {order.origin === 'Encomenda' && <span className="text-xs font-black bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full border border-pink-200">🎂 Encomenda</span>}
                      {order.client}
                    </div>
                    <div className="text-xs md:text-sm text-slate-500">{new Date(order.paidAt || order.date).toLocaleString('pt-BR')} • {order.method}</div>
                  </div>
                  <div className="text-left md:text-right w-full md:w-auto flex justify-between md:block items-center">
                    <div className="font-black text-lg md:text-xl text-blue-600">{formatMoney(order.total)}</div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handlePrint(order, settings, 'customer')} className="mt-0 md:mt-2 text-xs md:text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 md:py-1.5 rounded-lg flex items-center gap-1"><Printer size={14}/> Recibo</button>
                      <button onClick={() => handleDeleteSingleOrder(order)} className="mt-0 md:mt-2 text-xs md:text-sm font-bold text-red-500 bg-red-50 hover:bg-red-100 px-3 py-2 md:py-1.5 rounded-lg flex items-center gap-1" title="Excluir pedido"><Trash2 size={14}/></button>
                      <button onClick={() => {
                        setConfirmState({ isOpen: true, msg: 'Reabrir o pedido #' + order.id + ' como ABERTO? Ele voltará para Comandas.', action: async () => {
                          await updateDoc(getDocRef('orders', order.firestoreId), { paymentStatus: 'ABERTO', status: 'ABERTO', paidAt: null, method: 'Aguardando', payments: [] });
                          setConfirmState({ isOpen: false, msg: '', action: null });
                          showToastMsg('Pedido #' + order.id + ' reaberto com sucesso!');
                        }});
                      }} className="mt-0 md:mt-2 text-xs md:text-sm font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 px-3 py-2 md:py-1.5 rounded-lg flex items-center gap-1" title="Reabrir pedido"><RotateCcw size={14}/> Reabrir</button>
                    </div>
                  </div>
                </div>
              ))}
              {historyOrders.length === 0 && <div className="text-center text-slate-500 py-10 font-medium">Nenhuma venda encontrada.</div>}
            </div>
          </div>
        )}

        {view === 'cash' && <CashControl user={user} orders={orders} />}

        {view === 'costs' && (
          <div className="p-4 md:p-8 h-[calc(100vh-4rem)] md:h-screen overflow-y-auto bg-slate-50">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-3"><DollarSign size={32} className="text-rose-600" /> Custos</h1>
              <button onClick={() => setShowCostModal(true)} className="w-full md:w-auto bg-rose-600 hover:bg-rose-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"><PlusCircle size={20} /> Novo Custo</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {['Ingredientes','Contas Fixas','Fornecedor','Outros'].map(cat => {
                const catTotal = costs.filter(c => c.category === cat).reduce((a,c) => a + (Number(c.value)||0), 0);
                return (
                  <div key={cat} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
                    <div className="text-xs font-bold text-slate-400 uppercase mb-1">{cat}</div>
                    <div className="text-lg font-black text-rose-600">{formatMoney(catTotal)}</div>
                  </div>
                );
              })}
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-rose-50 p-4 border-b flex justify-between items-center">
                <span className="font-bold text-rose-900">{costs.length} lançamento(s)</span>
                <span className="font-black text-rose-700 text-lg">{formatMoney(costs.reduce((a,c) => a + (Number(c.value)||0), 0))}</span>
              </div>
              {costs.length === 0 && <div className="p-10 text-center text-slate-400 font-medium">Nenhum custo lançado.</div>}
              {costs.map(c => (
                <div key={c.firestoreId} className="flex items-center justify-between p-4 border-b last:border-0 hover:bg-slate-50 transition-colors">
                  <div>
                    <div className="font-bold text-slate-800">{c.description || '—'}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">{c.category}</span>
                      <span className="text-xs text-slate-400">{c.date ? new Date(c.date).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : ''}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-black text-rose-600 text-lg">{formatMoney(c.value)}</span>
                    <button onClick={() => setConfirmState({ isOpen: true, msg: 'Excluir este custo?', action: async () => { await deleteDoc(getDocRef('costs', c.firestoreId)); setConfirmState({isOpen:false,msg:'',action:null}); showToastMsg('Custo excluído!'); }})} className="p-2 bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 rounded-xl transition-colors"><Trash2 size={16}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'settings' && (
          <div className="p-4 md:p-8 h-[calc(100vh-4rem)] md:h-screen overflow-y-auto bg-slate-50">
            <header className="mb-6 md:mb-8 flex justify-between items-center">
              <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-3"><Settings size={32} className="text-slate-600" /> Configurações do Sistema</h1>
            </header>

            <div className="bg-white p-5 md:p-8 rounded-3xl shadow-sm border border-slate-200 max-w-4xl">
              <h2 className="text-lg md:text-xl font-bold mb-4 md:mb-6 text-slate-800 border-b pb-4">Dados da Loja</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Nome da Loja</label>
                  <input value={configForm.storeName || ''} onChange={e => setConfigForm({...configForm, storeName: e.target.value})} className="w-full p-3.5 md:p-4 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-800 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Telefone / WhatsApp</label>
                  <input value={configForm.phone || ''} onChange={e => setConfigForm({...configForm, phone: e.target.value})} className="w-full p-3.5 md:p-4 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-800 text-sm" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Endereço Completo</label>
                  <input value={configForm.address || ''} onChange={e => setConfigForm({...configForm, address: e.target.value})} className="w-full p-3.5 md:p-4 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-800 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Documento (CNPJ/CPF)</label>
                  <input value={configForm.docId || ''} onChange={e => setConfigForm({...configForm, docId: e.target.value})} className="w-full p-3.5 md:p-4 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-800 text-sm" />
                </div>
              </div>

              <h2 className="text-lg md:text-xl font-bold mb-4 md:mb-6 text-slate-800 border-b pb-4">Segurança</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Senha do Gerente (POS)</label>
                  <input type="password" value={configForm.posPassword || ''} onChange={e => setConfigForm({...configForm, posPassword: e.target.value})} className="w-full p-3.5 md:p-4 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-800 text-sm" placeholder="Padrão: 1234" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Senha de Configurações</label>
                  <input type="password" value={configForm.settingsPassword || ''} onChange={e => setConfigForm({...configForm, settingsPassword: e.target.value})} className="w-full p-3.5 md:p-4 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-800 text-sm" placeholder="Padrão: 1234" />
                </div>
              </div>

              <div className="flex flex-col md:flex-row justify-between items-center pt-6 border-t border-slate-100 gap-4">
                <div className="flex gap-2 w-full md:w-auto flex-col md:flex-row">
                  <button onClick={factoryResetSales} className="bg-red-50 text-red-600 hover:bg-red-100 px-6 py-4 rounded-xl font-bold flex items-center gap-2 transition-all w-full md:w-auto justify-center text-sm md:text-base"><RotateCcw size={20} /> Zerar Vendas</button>
                  <button onClick={factoryResetProducts} className="bg-red-50 text-red-600 hover:bg-red-100 px-6 py-4 rounded-xl font-bold flex items-center gap-2 transition-all w-full md:w-auto justify-center text-sm md:text-base"><Trash2 size={20} /> Zerar Produtos</button>
                </div>
                <button onClick={saveSettings} className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-xl font-bold shadow-lg shadow-blue-600/20 active:scale-95 transition-all text-base md:text-lg flex items-center gap-2 w-full md:w-auto justify-center"><Save size={20} /> Salvar Configurações</button>
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
