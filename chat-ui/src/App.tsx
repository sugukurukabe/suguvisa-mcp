import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, Briefcase, FileText, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: string[];
  status?: 'sending' | 'sent' | 'error';
};

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'こんにちは！SuguVisa AIエージェントです。\n「在留カードの写真」と「雇用条件」を教えていただければ、最適なビザ（特定技能など）の判定から必要書類の洗い出しまで自動で行います。\nまずは、採用予定の方の情報やご質問を入力してください。'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:3000/api/v1/chatbot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer your_secure_api_key_here'
        },
        body: JSON.stringify({
          messages: [
            ['system', 'あなたはビザ申請専門のアシスタント SuguVisa AI です。ユーザーに丁寧に対応し、提供されたツールを使って正確に回答してください。返答はマークダウン形式で行います。'],
            ...messages.filter(m => m.id !== 'welcome').map(m => [m.role, m.content]),
            ['human', userMsg.content] // 最新のメッセージを追加
          ]
        })
      });

      const data = await response.json();
      
      if (data.status === 'success' && data.reply) {
         setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: typeof data.reply.content === 'string' ? data.reply.content : JSON.stringify(data.reply.content)
         }]);
      } else {
         throw new Error(data.message || 'エラーが発生しました');
      }

    } catch (error: any) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `**エラー**: サーバーに接続できませんでした。(${error.message})`,
        status: 'error'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4 sm:p-8">
      
      {/* Header */}
      <header className="w-full max-w-4xl flex items-center justify-between mb-8 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-[0_0_20px_rgba(59,130,246,0.3)]">
            S
          </div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
            SuguVisa Agent
          </h1>
        </div>
        <div className="flex items-center gap-4 text-sm font-medium text-slate-300">
          <span className="flex items-center gap-1.5"><Briefcase size={16} className="text-purple-400"/> 法人モード</span>
          <span className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 px-3 py-1.5 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.15)]"><CheckCircle2 size={16} /> API Online</span>
        </div>
      </header>

      {/* Main Chat Area */}
      <main className="w-full max-w-4xl flex-1 glass-panel rounded-3xl overflow-hidden flex flex-col relative z-10 transition-all duration-300">
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 sm:p-8 flex flex-col gap-6"
        >
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] sm:max-w-[75%] p-4 rounded-2xl ${
                  msg.role === 'user' 
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-sm shadow-lg shadow-blue-900/30 font-medium' 
                    : 'bg-white/5 border border-white/10 text-slate-200 rounded-bl-sm ai-glow'
                }`}>
                  <div className="whitespace-pre-wrap leading-relaxed text-[15px]">
                    {msg.content.split('\n').map((line, i) => {
                      if (line.includes('[WIDGET:DOWNLOAD]')) {
                        return (
                          <div key={i} className="my-4 p-5 rounded-2xl download-widget glass-panel flex flex-col sm:flex-row gap-4 items-center justify-between border-white/10">
                             <div className="flex items-center gap-4">
                               <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                                 <FileText size={24} />
                               </div>
                               <div>
                                 <h4 className="text-white font-semibold mb-1">定期報告書 (Excel)</h4>
                                 <p className="text-xs text-slate-400">所属機関向けフォーマット</p>
                               </div>
                             </div>
                             <button className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl transition-colors shadow-lg shadow-blue-500/30 whitespace-nowrap">
                               ダウンロード
                             </button>
                          </div>
                        );
                      }
                      return <p key={i} className="min-h-[1.5em]">{line}</p>;
                    })}
                  </div>
                </div>
              </motion.div>
            ))}
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex w-full justify-start"
              >
                <div className="bg-white/5 border border-white/10 p-4 rounded-2xl rounded-bl-sm flex items-center gap-3 w-32 ai-glow">
                   <div className="flex gap-1.5 pl-1">
                     <span className="w-2.5 h-2.5 bg-blue-500/80 rounded-full thinking-dot [animation-delay:-0.3s]"></span>
                     <span className="w-2.5 h-2.5 bg-indigo-500/80 rounded-full thinking-dot [animation-delay:-0.15s]"></span>
                     <span className="w-2.5 h-2.5 bg-purple-500/80 rounded-full thinking-dot"></span>
                   </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Suggestion Chips */}
        {messages.length === 1 && !isLoading && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-6 pb-4 flex flex-wrap gap-2 z-20"
          >
            <button
              onClick={() => setInput('所属機関の定期報告の、オフライン申請版を自動生成したい')}
              className="suggestion-chip px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2"
            >
              <FileText size={14} /> 定期報告(オフライン)の生成
            </button>
            <button
              onClick={() => setInput('特定技能1号の農業に変更したい')}
              className="suggestion-chip px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2"
            >
              <Briefcase size={14} /> ビザ変更パターンの判定
            </button>
          </motion.div>
        )}

        {/* Input Area */}
        <div className="p-4 sm:p-6 bg-black/20 backdrop-blur-3xl border-t border-white/5 relative z-20">
          <form onSubmit={handleSubmit} className="flex gap-3 relative">
            <button 
              type="button"
              className="p-3 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200 ease-out"
              title="在留カード画像をアップロード"
            >
              <ImageIcon size={22} />
            </button>
            <div className="flex-1 relative flex items-center glass-input rounded-2xl transition-all duration-300">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="「特定技能1号の農業に変更したい」などと入力してください..."
                className="w-full bg-transparent border-none py-3 pl-4 pr-12 outline-none text-slate-200 placeholder:text-slate-500/80"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="absolute right-2 p-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-500 hover:to-indigo-500 disabled:opacity-30 disabled:grayscale transition-all shadow-lg"
              >
                <Send size={18} />
              </button>
            </div>
            <button 
              type="button"
              className="p-3 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200 ease-out hidden sm:block"
              title="書類を自動生成"
            >
              <FileText size={22} />
            </button>
          </form>
          <div className="text-center mt-4">
            <p className="text-xs text-slate-500">SuguVisa Agent は法人・行政書士向けの専門AIです。正式な書類提出前に専門家の確認を推奨します。</p>
          </div>
        </div>
      </main>

    </div>
  );
}
