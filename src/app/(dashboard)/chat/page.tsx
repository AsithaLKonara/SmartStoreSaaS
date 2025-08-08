'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Send, 
  Search, 
  Filter, 
  MoreVertical,
  Phone,
  Mail,
  User,
  MessageSquare,
  Bot,
  CheckCircle,
  Clock,
  AlertTriangle,
  Archive,
  Tag,
  Paperclip,
  Smile
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDate, formatTime } from '@/lib/utils';
import toast from 'react-hot-toast';

interface ChatMessage {
  id: string;
  content: string;
  sender: 'customer' | 'agent' | 'bot';
  timestamp: string;
  channel: 'whatsapp' | 'messenger' | 'instagram' | 'website';
  customerId: string;
  customer: {
    name: string;
    phone: string;
    email: string;
  };
}

interface ChatConversation {
  id: string;
  customerId: string;
  customer: {
    name: string;
    phone: string;
    email: string;
  };
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  status: 'active' | 'resolved' | 'pending';
  channel: 'whatsapp' | 'messenger' | 'instagram' | 'website';
  tags: string[];
}

export default function ChatPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/auth/signin');
      return;
    }
    fetchConversations();
  }, [session, status]);

  useEffect(() => {
    const customerId = searchParams.get('customer');
    if (customerId && conversations.length > 0) {
      const conversation = conversations.find(c => c.customerId === customerId);
      if (conversation) {
        setSelectedConversation(conversation);
        fetchMessages(conversation.id);
      }
    }
  }, [searchParams, conversations]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversations = async () => {
    try {
      const response = await fetch('/api/chat/conversations');
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast.error('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/chat/conversations/${conversationId}/messages`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to load messages');
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      const response = await fetch(`/api/chat/conversations/${selectedConversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newMessage,
          sender: 'agent',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(prev => [...prev, data.message]);
        setNewMessage('');
        
        // Update conversation in list
        setConversations(prev => prev.map(conv => 
          conv.id === selectedConversation.id 
            ? { ...conv, lastMessage: newMessage, lastMessageTime: new Date().toISOString() }
            : conv
        ));
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const filteredConversations = conversations.filter(conversation => {
    const matchesSearch = 
      conversation.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conversation.customer.phone.includes(searchTerm) ||
      conversation.customer.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = !statusFilter || conversation.status === statusFilter;
    const matchesChannel = !channelFilter || conversation.channel === channelFilter;
    
    return matchesSearch && matchesStatus && matchesChannel;
  });

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'whatsapp':
        return <MessageSquare className="w-4 h-4 text-green-600" />;
      case 'messenger':
        return <MessageSquare className="w-4 h-4 text-blue-600" />;
      case 'instagram':
        return <MessageSquare className="w-4 h-4 text-pink-600" />;
      case 'website':
        return <MessageSquare className="w-4 h-4 text-gray-600" />;
      default:
        return <MessageSquare className="w-4 h-4" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'resolved':
        return <Archive className="w-4 h-4 text-gray-600" />;
      default:
        return <AlertTriangle className="w-4 h-4" />;
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="loading-spinner w-8 h-8"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - Conversations */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-semibold text-gray-900">Chat Center</h1>
            <Button variant="outline" size="sm">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {/* Filters */}
          <div className="grid grid-cols-2 gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="resolved">Resolved</option>
            </select>
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
            >
              <option value="">All Channels</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="messenger">Messenger</option>
              <option value="instagram">Instagram</option>
              <option value="website">Website</option>
            </select>
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.map((conversation) => (
            <div
              key={conversation.id}
              onClick={() => {
                setSelectedConversation(conversation);
                fetchMessages(conversation.id);
              }}
              className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                selectedConversation?.id === conversation.id ? 'bg-blue-50 border-blue-200' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-semibold text-sm">
                    {conversation.customer.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="ml-3 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900 text-sm">
                        {conversation.customer.name}
                      </h3>
                      {getStatusIcon(conversation.status)}
                      {getChannelIcon(conversation.channel)}
                    </div>
                    <p className="text-xs text-gray-500">
                      {conversation.customer.phone}
                    </p>
                  </div>
                </div>
                {conversation.unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1">
                    {conversation.unreadCount}
                  </span>
                )}
              </div>
              
              <p className="text-sm text-gray-600 line-clamp-2">
                {conversation.lastMessage}
              </p>
              
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-400">
                  {formatTime(conversation.lastMessageTime)}
                </span>
                {conversation.tags.length > 0 && (
                  <div className="flex gap-1">
                    {conversation.tags.slice(0, 2).map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        <Tag className="w-3 h-3 mr-1" />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="bg-white border-b border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-semibold">
                    {selectedConversation.customer.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="ml-3">
                    <h2 className="font-semibold text-gray-900">
                      {selectedConversation.customer.name}
                    </h2>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center">
                        <Phone className="w-4 h-4 mr-1" />
                        {selectedConversation.customer.phone}
                      </span>
                      <span className="flex items-center">
                        <Mail className="w-4 h-4 mr-1" />
                        {selectedConversation.customer.email}
                      </span>
                      {getChannelIcon(selectedConversation.channel)}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <User className="w-4 h-4 mr-1" />
                    View Profile
                  </Button>
                  <Button variant="outline" size="sm">
                    <Archive className="w-4 h-4 mr-1" />
                    Resolve
                  </Button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'agent' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.sender === 'agent'
                        ? 'bg-primary text-white'
                        : message.sender === 'bot'
                        ? 'bg-gray-100 text-gray-800'
                        : 'bg-white border border-gray-200 text-gray-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {message.sender === 'bot' && <Bot className="w-4 h-4" />}
                      <span className="text-xs opacity-75">
                        {message.sender === 'agent' ? 'You' : message.customer.name}
                      </span>
                    </div>
                    <p className="text-sm">{message.content}</p>
                    <p className="text-xs opacity-75 mt-1">
                      {formatTime(message.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="bg-white border-t border-gray-200 p-4">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message..."
                    rows={1}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Paperclip className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <Smile className="w-4 h-4" />
                  </Button>
                  <Button onClick={sendMessage} disabled={!newMessage.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a conversation</h3>
              <p className="text-gray-600">Choose a conversation from the sidebar to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 