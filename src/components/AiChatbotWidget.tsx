/**
 * ClearBill AI - Personalized Floating Real-Time AI Chatbot Widget
 * Responsive floating chat panel grounded in verified store database metrics.
 * Supports role-based suggestions for Manager, Retailer, Customer, and Admin.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  MessageSquare,
  X,
  Send,
  Sparkles,
  RefreshCw,
  Trash2,
  Minimize2,
  TrendingUp,
  Receipt,
  ScanLine,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { User, Company, Outlet } from '../types.ts';

interface AiChatbotWidgetProps {
  currentUser: User | null;
  currentCompany: Company | null;
  currentOutlet?: Outlet | null;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  isConfirmedData?: boolean;
  isFallback?: boolean;
}

export const AiChatbotWidget: React.FC<AiChatbotWidgetProps> = ({
  currentUser,
  currentCompany,
  currentOutlet,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const role = currentUser?.role || 'retailer';

  // Role-specific initial greeting and suggestions
  const getInitialGreeting = (): string => {
    if (role === 'manager') {
      return `Hello ${currentUser?.fullName || 'Manager'}! I am your ClearBill AI Store Intelligence Assistant.\n\nI analyze your live MySQL transactions, summarize daily revenue, explain payment settlements, and audit paperless sustainability metrics.`;
    }
    if (role === 'retailer') {
      return `Hello ${currentUser?.fullName || 'Cashier'}! I am your POS Assistant.\n\nAsk me how to scan barcodes, manage line items, apply discounts, or generate paperless digital receipts.`;
    }
    if (role === 'customer') {
      return `Welcome ${currentUser?.fullName || 'Customer'}! I can help you locate saved digital receipts, explain taxes and breakdowns, and claim receipts into your account vault.`;
    }
    return 'Hello! I am your ClearBill AI Assistant. How can I help you today?';
  };

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-init',
      sender: 'assistant',
      text: getInitialGreeting(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Suggestions depending on role
  const getSuggestions = () => {
    if (role === 'manager') {
      return [
        'What are my total sales today?',
        'Compare Cash vs UPI vs Card settlements',
        'Which products sold the most?',
        'How many paper receipts were avoided?',
        'Show my outlet performance',
      ];
    }
    if (role === 'retailer') {
      return [
        'How do I create a bill?',
        'How do I scan a barcode?',
        'How do I correct a billing mistake?',
        'How do I generate a digital receipt?',
      ];
    }
    return [
      'How do I view my receipt?',
      'How do I download my receipt as PDF?',
      'How can I find my saved receipts in vault?',
      'How do taxes work on my bill?',
    ];
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || prompt).trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setPrompt('');
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser?.id || 'usr-mgr-01',
        },
        body: JSON.stringify({
          prompt: text,
          role,
          companyId: currentCompany?.id || 'cmp-demo-01',
          outletId: currentOutlet?.id || 'out-demo-01',
        }),
      });

      const data = await res.json();
      if (res.ok && data.answer) {
        setMessages(prev => [
          ...prev,
          {
            id: `msg-resp-${Date.now()}`,
            sender: 'assistant',
            text: data.answer,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isConfirmedData: Boolean(data.metrics),
            isFallback: Boolean(data.isFallback),
          },
        ]);
      } else {
        setError(data.error || 'Failed to receive AI assistant response.');
      }
    } catch (err: any) {
      setError('Connection failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: `msg-${Date.now()}`,
        sender: 'assistant',
        text: `Conversation history reset. How can I assist you with ${currentCompany?.business_name || 'your store'} today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 z-40 px-3.5 py-2.5 bg-[#172033] hover:bg-[#263449] text-white rounded-full shadow-lg flex items-center gap-2 border border-slate-700 transition-all active:scale-95 group cursor-pointer"
          title="Open ClearBill AI Assistant"
        >
          <div className="w-6 h-6 rounded-full bg-[#16A34A] flex items-center justify-center text-white">
            <Bot className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold tracking-tight pr-1">Ask ClearBill AI</span>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        </button>
      )}

      {/* Floating Chat Modal Panel */}
      {isOpen && (
        <div className="fixed bottom-5 right-5 z-50 w-[94vw] sm:w-[420px] max-h-[600px] h-[82vh] bg-white border border-[#E2E8F0] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="px-4 py-3 bg-[#172033] text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#16A34A] flex items-center justify-center text-white">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-xs tracking-tight">ClearBill AI Assistant</h3>
                <span className="text-[10px] text-slate-300 block leading-none">
                  {role === 'manager' ? 'Store Intelligence' : role === 'retailer' ? 'Cashier POS Guide' : 'Customer Vault'} · {currentCompany?.business_name || 'Live Store'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 text-slate-300">
              <button
                onClick={handleClearHistory}
                className="p-1 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
                title="Start New Conversation"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
                title="Minimize Chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Suggestion Chips */}
          <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex gap-1.5 overflow-x-auto text-[11px] shrink-0 no-scrollbar">
            {getSuggestions().map((s, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(s)}
                className="px-2.5 py-1 bg-white border border-slate-200 hover:border-[#16A34A] hover:bg-emerald-50 text-slate-700 font-medium rounded-full shrink-0 transition-colors shadow-2xs cursor-pointer"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Message List */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3 text-xs bg-[#F7F9FC]">
            {messages.map(m => (
              <div
                key={m.id}
                className={`flex gap-2 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.sender === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}
                <div
                  className={`max-w-[82%] rounded-xl p-3 leading-relaxed whitespace-pre-line shadow-2xs ${
                    m.sender === 'user'
                      ? 'bg-[#172033] text-white font-medium'
                      : 'bg-white border border-slate-200 text-slate-900'
                  }`}
                >
                  <p>{m.text}</p>
                  <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-slate-100/50 text-[10px] text-slate-400">
                    <span>{m.timestamp}</span>
                    {m.isConfirmedData && (
                      <span className="flex items-center gap-1 text-[#15803D] font-bold">
                        <CheckCircle2 className="w-3 h-3 text-[#16A34A]" />
                        <span>Verified DB Grounded</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-slate-500 text-xs py-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#16A34A]" />
                <span>Analyzing store transactions...</span>
              </div>
            )}

            {error && (
              <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Box */}
          <div className="p-2.5 bg-white border-t border-slate-200 shrink-0">
            <form
              onSubmit={e => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                placeholder={role === 'manager' ? "Ask about today's sales, UPI, top products..." : 'Ask a question...'}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                disabled={loading}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#16A34A] focus:bg-white"
              />
              <button
                type="submit"
                disabled={!prompt.trim() || loading}
                className={`p-2 rounded-xl transition-colors cursor-pointer ${
                  prompt.trim() && !loading
                    ? 'bg-[#16A34A] hover:bg-[#15803D] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
                title="Send Message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
