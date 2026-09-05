import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { Send, ArrowRight, User, Check, CheckCheck, Wifi, WifiOff } from 'lucide-react';

export default function ChatWindow() {
  const { orderId } = useParams();
  const navigate    = useNavigate();
  const { user }    = useAuth();
  const socket      = useSocket();

  const [messages, setMessages]   = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatInfo, setChatInfo]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [otherName, setOtherName] = useState('المحادثة');
  const [isConnected, setIsConnected] = useState(socket.connected);

  const messagesEndRef = useRef(null);
  // Keep a ref that is ALWAYS in sync with chatInfo so socket callbacks
  // can read the current chatId without stale-closure issues.
  const chatIdRef = useRef(null);

  // ── Scroll helper ─────────────────────────────────────────────────────────
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  // ── Socket: connection status ──────────────────────────────────────────────
  useEffect(() => {
    const onConnect    = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    socket.on('connect',    onConnect);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('connect',    onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [socket]);

  // ── Socket: incoming messages ─────────────────────────────────────────────
  // Depends on [socket] only — the ref keeps it current with no stale closures.
  useEffect(() => {
    const handleNewMessage = ({ chatId, message }) => {
      // Use ref (never stale) rather than state-captured chatInfo
      if (chatIdRef.current && String(chatId) === String(chatIdRef.current)) {
        setMessages(prev => {
          if (prev.some(m => m.id === message.id)) return prev; // dedup
          return [...prev, message];
        });
      }
    };
    socket.on('new_message', handleNewMessage);
    return () => socket.off('new_message', handleNewMessage);
  }, [socket]);

  // ── Fetch messages ────────────────────────────────────────────────────────
  const fetchMessages = useCallback(async (chatId) => {
    try {
      const res = await api.get(`/chat/${chatId}/messages`);
      setMessages(res.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Initialise chat ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!orderId || !user) return;

    let cancelled = false;
    setLoading(true);
    setMessages([]);
    chatIdRef.current = null;
    setChatInfo(null);

    const init = async () => {
      try {
        let otherId   = null;
        let otherLabel = 'المحادثة';

        if (user.role === 'customer') {
          const res   = await api.get(`/customers/orders/${orderId}`);
          otherId      = res.data.driver_user_id;
          otherLabel   = res.data.driver_name || 'السائق';
        } else if (user.role === 'driver') {
          const res   = await api.get(`/drivers/order/${orderId}`);
          otherId      = res.data.customer_user_id;
          otherLabel   = res.data.customer_name || 'العميل';
        }

        if (!otherId || cancelled) { setLoading(false); return; }

        const chatRes = await api.post('/chat/get-or-create', {
          order_id: orderId,
          participant_id: otherId,
          chat_type: 'customer_driver'
        });

        if (cancelled) return;

        const chat = chatRes.data;
        chatIdRef.current = chat.id; // update ref BEFORE setting state so socket handler is ready
        setChatInfo(chat);
        setOtherName(otherLabel);
        await fetchMessages(chat.id);
      } catch {
        if (!cancelled) setLoading(false);
      }
    };

    init();
    return () => { cancelled = true; };
  }, [orderId, user, fetchMessages]);

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = async (e) => {
    e.preventDefault();
    const content = newMessage.trim();
    if (!content || !chatInfo) return;

    // Optimistic UI
    const tempId  = `temp-${Date.now()}`;
    const tempMsg = {
      id: tempId,
      content,
      sender_id:  user.id,
      created_at: new Date().toISOString(),
      is_read: false
    };
    setMessages(prev => [...prev, tempMsg]);
    setNewMessage('');

    try {
      const res = await api.post(`/chat/${chatInfo.id}/messages`, { content });
      // Swap temp with server-confirmed message
      setMessages(prev => prev.map(m => m.id === tempId ? res.data : m));
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const formatTime = (date) =>
    new Date(date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-100 dark:border-gray-700">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <ArrowRight size={20} />
          </button>
          <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
            <User size={20} className="text-primary-600" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-gray-900 dark:text-white text-sm">{otherName}</p>
            <p className={`text-xs flex items-center gap-1 ${isConnected ? 'text-green-500' : 'text-gray-400'}`}>
              {isConnected
                ? <><Wifi size={10} /><span className="w-2 h-2 bg-green-500 rounded-full inline-block" /> متصل</>
                : <><WifiOff size={10} /> غير متصل</>
              }
            </p>
          </div>
        </div>
      </div>

      {/* ── Messages ─────────────────────────────────────────────────── */}
      <div className="flex-1 max-w-lg mx-auto w-full px-4 py-4 space-y-3 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
              <Send size={24} className="text-gray-400" />
            </div>
            <p className="text-gray-500">ابدأ المحادثة الآن</p>
          </div>
        ) : (
          messages.map(msg => {
            const isMe = msg.sender_id === user.id;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl ${
                  isMe
                    ? 'bg-primary-500 text-white rounded-br-sm'
                    : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm shadow-sm border border-gray-100 dark:border-gray-700'
                }`}>
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                  <div className={`flex items-center gap-1 mt-1 ${isMe ? 'justify-end text-white/70' : 'text-gray-400'}`}>
                    <span className="text-[10px]">{formatTime(msg.created_at)}</span>
                    {isMe && (msg.is_read ? <CheckCheck size={12} /> : <Check size={12} />)}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input ────────────────────────────────────────────────────── */}
      <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 p-3">
        <form onSubmit={sendMessage} className="max-w-lg mx-auto flex items-center gap-2">
          <input
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            className="flex-1 input-field py-2.5"
            placeholder="اكتب رسالتك..."
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="w-11 h-11 bg-primary-500 text-white rounded-xl flex items-center justify-center hover:bg-primary-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
