/**
 * ClearBill AI - Server-Side AI Assistant
 * Powered by Gemini 3.8 Flash via server-side Express API.
 * Provides verifiable store summaries, discrepancy explanations, and spending audits.
 */

import React, { useState } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  HelpCircle,
  TrendingUp,
  Receipt,
  Scale,
  Leaf,
  CheckCircle2,
} from 'lucide-react';
import { User, Company } from '../types.ts';

interface AiAssistantScreenProps {
  currentUser: User | null;
  currentCompany: Company | null;
}

export const AiAssistantScreen: React.FC<AiAssistantScreenProps> = ({
  currentUser,
  currentCompany,
}) => {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<
    { role: 'user' | 'assistant'; text: string; isFallback?: boolean }[]
  >([
    {
      role: 'assistant',
      text: `Hello ${currentUser?.fullName || 'Store Manager'}! I am your ClearBill AI Assistant.\n\nI can analyze your verified MySQL transaction records, summarize daily revenue, explain payment settlement breakdowns, and audit paperless sustainability metrics. How can I assist you today?`,
    },
  ]);
  const [loading, setLoading] = useState(false);

  const quickPrompts = [
    "Summarize today's sales and paper savings",
    'Explain the difference between Cash and UPI settlements today',
    'Which product is our highest volume Quick Bill item?',
    'Provide a 3-point recommendation to increase digital receipt adoption',
  ];

  const handleSubmit = async (textToSend: string) => {
    const text = textToSend.trim();
    if (!text || loading) return;

    setMessages(prev => [...prev, { role: 'user', text }]);
    setPrompt('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser?.id || 'usr-mgr-01',
        },
        body: JSON.stringify({
          prompt: text,
          role: currentUser?.role || 'manager',
          companyId: currentCompany?.id || 'cmp-demo-01',
        }),
      });

      const data = await res.json();
      if (res.ok && data.answer) {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', text: data.answer, isFallback: data.isFallback },
        ]);
      } else {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', text: 'Error querying AI assistant: ' + (data.error || 'Unknown error') },
        ]);
      }
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', text: 'Connection to backend failed: ' + err.message },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Banner */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-[#172B4D] flex items-center gap-2">
              <Bot className="w-5 h-5 text-[#16A34A]" />
              ClearBill AI Retail Assistant
            </h2>
            <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
              Gemini 3.8 Flash SDK
            </span>
          </div>
          <p className="text-xs text-[#64748B] mt-0.5">
            Deterministic business intelligence strictly grounded in your store's MySQL database.
          </p>
        </div>
      </div>

      {/* Suggested Quick Prompt Chips */}
      <div className="flex flex-wrap gap-2 text-xs">
        {quickPrompts.map((qp, idx) => (
          <button
            key={idx}
            onClick={() => handleSubmit(qp)}
            className="px-3 py-1.5 bg-white border border-slate-200 hover:border-[#16A34A] hover:bg-emerald-50/40 text-slate-700 rounded-lg transition-all shadow-xs text-left"
          >
            {qp}
          </button>
        ))}
      </div>

      {/* Chat Messages Log */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs min-h-[360px] flex flex-col justify-between space-y-4">
        <div className="space-y-4 overflow-y-auto max-h-[480px] pr-2 text-xs">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.role === 'assistant' && (
                <div className="w-7 h-7 rounded-lg bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}
              <div
                className={`max-w-xl rounded-xl p-3.5 leading-relaxed whitespace-pre-line ${
                  m.role === 'user'
                    ? 'bg-[#172033] text-white font-medium'
                    : 'bg-slate-50 border border-slate-200 text-slate-800'
                }`}
              >
                {m.text}
                {m.isFallback && (
                  <span className="block mt-2 text-[10px] text-slate-400 italic">
                    (Standard Mode · Verified against MySQL Ledger)
                  </span>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 items-center text-xs text-slate-400">
              <div className="w-6 h-6 rounded-lg bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center animate-spin">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <span>Querying Gemini 3.8 Flash & calculating financial aggregates...</span>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSubmit(prompt);
          }}
          className="pt-3 border-t border-slate-100 flex gap-2"
        >
          <input
            type="text"
            placeholder="Ask about sales, receipts, GST, or paper savings..."
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            className="flex-1 bg-white border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#16A34A]"
          />
          <button
            type="submit"
            disabled={!prompt.trim() || loading}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 ${
              prompt.trim() && !loading
                ? 'bg-[#16A34A] hover:bg-[#15803D] text-white cursor-pointer'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
