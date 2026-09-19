import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import { Search, Info, Package, CheckCheck, User, MessageCircle, Trash2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminChats() {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchParams] = useSearchParams();
  const messagesEndRef = useRef(null);

  // Delete state
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Read chat_id from URL query if present (e.g. from AdminOrders)
  const queryChatId = searchParams.get('chat_id');

  useEffect(() => {
    fetchChats();
  }, []);

  useEffect(() => {
    if (queryChatId && chats.length > 0) {
      const chat = chats.find(c => c.id === queryChatId);
      if (chat) {
        handleSelectChat(chat);
      } else {
        toast.error('المحادثة غير موجودة أو تم حذفها');
      }
    }
  }, [queryChatId, chats]);

  const fetchChats = () => {
    setLoading(true);
    api.get('/admin/chats')
      .then(res => {
        setChats(res.data);
      })
      .catch(err => {
        toast.error('فشل جلب المحادثات');
      })
      .finally(() => setLoading(false));
  };

  const handleSelectChat = (chat) => {
    setSelectedChat(chat);
    setMessagesLoading(true);
    api.get(`/admin/chats/${chat.id}/messages`)
      .then(res => {
        setMessages(res.data);
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      })
      .catch(err => {
        toast.error('فشل جلب الرسائل');
      })
      .finally(() => setMessagesLoading(false));
  };

  const handleDeleteAll = async () => {
    setDeleting(true);
    try {
      const res = await api.delete('/admin/chats');
      toast.success(res.data.message);
      setChats([]);
      setSelectedChat(null);
      setMessages([]);
      setShowDeleteAll(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل حذف المحادثات');
    } finally {
      setDeleting(false);
    }
  };

  const getParticipantInfo = (chat, pType) => {
    if (pType === 1) return { name: chat.participant_1_name, role: chat.participant_1_role, avatar: chat.participant_1_avatar };
    return { name: chat.participant_2_name, role: chat.participant_2_role, avatar: chat.participant_2_avatar };
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
  };

  const filteredChats = chats.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const p1 = c.participant_1_name?.toLowerCase() || '';
    const p2 = c.participant_2_name?.toLowerCase() || '';
    const orderNum = c.order_number?.toLowerCase() || '';
    return p1.includes(q) || p2.includes(q) || orderNum.includes(q);
  });

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden animate-fade-in">
      <div className="flex h-full">
        {/* Sidebar - Chat List */}
        <div className={`w-full md:w-1/3 lg:w-1/4 flex flex-col border-l border-gray-100 dark:border-gray-700 ${selectedChat ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">مراقبة المحادثات</h1>
              {chats.length > 0 && (
                <button
                  onClick={() => setShowDeleteAll(true)}
                  className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                  title="حذف كل السجل"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="بحث بالاسم أو رقم الطلب..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-4 pr-10 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center p-8">
                <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : filteredChats.length === 0 ? (
              <div className="text-center p-8 text-gray-500 text-sm flex flex-col items-center">
                <MessageCircle size={32} className="mb-2 opacity-50" />
                <p>لا توجد محادثات</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {filteredChats.map(chat => {
                  const isSelected = selectedChat?.id === chat.id;
                  const p1 = getParticipantInfo(chat, 1);
                  const p2 = getParticipantInfo(chat, 2);
                  
                  return (
                    <button
                      key={chat.id}
                      onClick={() => handleSelectChat(chat)}
                      className={`w-full text-right p-4 transition-colors hover:bg-primary-50 dark:hover:bg-primary-900/20 ${isSelected ? 'bg-primary-50 dark:bg-primary-900/30 relative' : ''}`}
                    >
                      {isSelected && <div className="absolute right-0 top-0 bottom-0 w-1 bg-primary-500"></div>}
                      
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex gap-2">
                          {/* Avatars */}
                          <div className="flex -space-x-2 space-x-reverse">
                            {p1.avatar ? (
                              <img src={p1.avatar} alt={p1.name} className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800 object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                <User size={14} className="text-gray-500" />
                              </div>
                            )}
                            {p2.avatar ? (
                              <img src={p2.avatar} alt={p2.name} className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800 object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                <User size={14} className="text-gray-500" />
                              </div>
                            )}
                          </div>
                          
                          <div className="mr-2">
                            <p className="text-sm font-bold text-gray-900 dark:text-white line-clamp-1">
                              {p1.name?.split(' ')[0]} & {p2.name?.split(' ')[0]}
                            </p>
                            {chat.order_number && (
                              <p className="text-xs text-primary-600 font-mono mt-0.5">#{chat.order_number}</p>
                            )}
                          </div>
                        </div>
                        {chat.last_message_at && (
                          <span className="text-[10px] text-gray-400 whitespace-nowrap">
                            {formatDate(chat.last_message_at)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 pr-10">
                        {chat.last_message || 'لا توجد رسائل'}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Main Area - Chat Messages */}
        <div className={`w-full md:w-2/3 lg:w-3/4 flex flex-col bg-gray-50 dark:bg-gray-900/50 ${!selectedChat ? 'hidden md:flex' : 'flex'}`}>
          {selectedChat ? (
            <>
              {/* Chat Header */}
              <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 flex items-center gap-4">
                <button
                  onClick={() => setSelectedChat(null)}
                  className="md:hidden p-2 -mr-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                      محادثة {selectedChat.participant_1_name} و {selectedChat.participant_2_name}
                    </h2>
                    <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded-md">
                      للقراءة فقط
                    </span>
                  </div>
                  
                  {selectedChat.order_id ? (
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Package size={12}/> طلب #{selectedChat.order_number}</span>
                      <span className="flex items-center gap-1"><Info size={12}/> الحالة: {selectedChat.order_status}</span>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><Info size={12}/> محادثة عامة (غير مرتبطة بطلب)</p>
                  )}
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messagesLoading ? (
                  <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400">
                    <MessageCircle size={48} className="mb-4 opacity-20" />
                    <p>لا توجد رسائل في هذه المحادثة حتى الآن</p>
                  </div>
                ) : (
                  <>
                    <div className="text-center my-4">
                      <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-300 px-3 py-1 rounded-full">
                        بداية المحادثة
                      </span>
                    </div>
                    
                    {messages.map((msg, index) => {
                      const isCustomer = msg.sender_role === 'customer';
                      
                      return (
                        <div key={msg.id} className={`flex flex-col ${isCustomer ? 'items-start' : 'items-end'}`}>
                          <span className="text-xs text-gray-400 mb-1 px-1">
                            {msg.sender_name} ({isCustomer ? 'عميل' : 'سائق'})
                          </span>
                          <div
                            className={`max-w-[75%] lg:max-w-[60%] rounded-2xl px-4 py-2 shadow-sm relative group ${
                              isCustomer
                                ? 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-tr-sm border border-gray-100 dark:border-gray-700'
                                : 'bg-primary-50 dark:bg-primary-900/30 text-primary-900 dark:text-primary-100 rounded-tl-sm border border-primary-100 dark:border-primary-800/30'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                            <div className="flex items-center justify-end gap-1 mt-1 opacity-70">
                              <span className="text-[10px]">{formatTime(msg.created_at)}</span>
                              {msg.is_read && <CheckCheck size={12} className="text-blue-500" />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>
              
              {/* Read Only Footer */}
              <div className="p-3 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 text-center">
                <p className="text-xs text-gray-500 flex items-center justify-center gap-1">
                  <Info size={14} /> المشرفون لديهم صلاحية القراءة فقط للمحادثات
                </p>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-600">
              <MessageCircle size={64} className="mb-4 opacity-20" />
              <p className="text-lg font-medium">اختر محادثة لعرض التفاصيل</p>
              <p className="text-sm mt-2 opacity-70">يمكنك البحث عن المحادثات باستخدام رقم الطلب أو أسماء الأطراف</p>
            </div>
          )}
        </div>
      </div>

      {/* Delete ALL confirmation modal */}
      {showDeleteAll && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={24} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white text-lg">حذف السجل</h3>
                <p className="text-sm text-gray-500 mt-0.5">إجراء لا يمكن التراجع عنه</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-3">
              ⚠️ سيتم حذف <strong>جميع المحادثات ({chats.length})</strong> بشكل دائم من النظام. هل أنت متأكد؟
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteAll(false)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold text-sm hover:bg-gray-200 transition-colors">
                إلغاء
              </button>
              <button onClick={handleDeleteAll} disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {deleting
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><Trash2 size={15} /> نعم، احذف الكل</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
