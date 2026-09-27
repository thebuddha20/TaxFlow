import React, { useState } from 'react';
import { Sparkles, Send, Bot, User, CornerDownLeft, Loader2 } from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export const AiAssistantView: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome_1',
      sender: 'assistant',
      text: `Hello! I am your TaxFlow AI Assistant, specialized in Indian Chartered Accountancy workflows, GST statutory rules, bank statement reconciliation, and Tally Prime integrations.\n\nYou can ask me about:\n- Duplicate transaction detections in your bank statements\n- GSTR-2B vs Books reconciliation and Sec 16(2)(aa) ITC eligibility\n- Tally XML import configurations and ledger groupings\n- HSN/SAC codes and tax rate classifications`,
      timestamp: 'Just now',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || inputText;
    if (!textToSend.trim() || isThinking) return;

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsThinking(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textToSend }),
      });

      const data = await res.json();
      const reply = data.reply || 'I processed your query against the firm accounting and GST database.';

      const botMsg: ChatMessage = {
        id: `bot_${Date.now()}`,
        sender: 'assistant',
        text: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: 'assistant',
          text: 'Unable to reach the TaxFlow AI service. Please verify your connection or Gemini API credentials.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const suggestions = [
    'Why were Swiggy and Electricity flagged as duplicates?',
    'What is our GSTR-2B ITC discrepancy for April 2026?',
    'How do I map UPI Food orders to Tally ledgers?',
    'Explain Section 16(2)(aa) of CGST Act for ITC availment',
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] rounded-xl bg-slate-900 border border-slate-800 overflow-hidden shadow-sm">
      {/* Assistant Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-purple-600/20 text-purple-400 border border-purple-500/30">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white flex items-center gap-2">
              <span>TaxFlow AI Advisory &amp; Statutory Assistant</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-800">
                Gemini 3.8
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">
              Context-grounded in current company data, bank reconciliations, and Indian tax jurisprudence
            </p>
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex gap-3 text-xs ${
              msg.sender === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {msg.sender === 'assistant' && (
              <div className="w-7 h-7 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center shrink-0 text-purple-400">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div
              className={`max-w-2xl p-4 rounded-xl space-y-1.5 shadow-sm ${
                msg.sender === 'user'
                  ? 'bg-emerald-600 text-white rounded-br-none'
                  : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-bl-none'
              }`}
            >
              <div className="whitespace-pre-line leading-relaxed font-sans">{msg.text}</div>
              <div
                className={`text-[10px] text-right ${
                  msg.sender === 'user' ? 'text-emerald-200' : 'text-slate-500'
                }`}
              >
                {msg.timestamp}
              </div>
            </div>

            {msg.sender === 'user' && (
              <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0 text-white">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {isThinking && (
          <div className="flex gap-3 text-xs justify-start items-center text-slate-400">
            <div className="w-7 h-7 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
            <span>Analyzing accounting ledger books &amp; statutory rules...</span>
          </div>
        )}
      </div>

      {/* Suggested prompts pills */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 flex items-center gap-2 overflow-x-auto">
        <span className="text-[10px] uppercase font-semibold text-slate-500 whitespace-nowrap">Suggested:</span>
        {suggestions.map((s, idx) => (
          <button
            key={idx}
            id={`ai-suggestion-btn-${idx}`}
            onClick={() => handleSend(s)}
            className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] whitespace-nowrap border border-slate-700/80 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Input box */}
      <div className="p-4 border-t border-slate-800 bg-slate-900">
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            id="ai-chat-input"
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder="Ask anything about bank transactions, ITC reconciliation, or Tally vouchers..."
            className="flex-1 px-4 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
          />
          <button
            type="submit"
            id="ai-chat-submit-btn"
            disabled={!inputText.trim() || isThinking}
            className="px-4 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
