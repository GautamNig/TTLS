// src/hooks/useChat.js
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function useChat(user) {
  const [messages, setMessages] = useState([]);
  const [privateMessages, setPrivateMessages] = useState({});

  // Realtime subscription for public chat messages
  useEffect(() => {
    if (!user) return;

    const chatChannel = supabase
      .channel('chat_messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages'
        },
        (payload) => {
          const newMessage = payload.new;
          const messageTime = new Date(newMessage.created_at);
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

          if (messageTime > fiveMinutesAgo) {
            setMessages(prev => [...prev, newMessage]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(chatChannel);
    };
  }, [user]);

  // Realtime subscription for private messages
  useEffect(() => {
    if (!user) return;

    const privateChannel = supabase
      .channel('private_messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'private_messages'
        },
        async (payload) => {
          const newMessage = payload.new;

          // Check if this message is for the current user
          if (newMessage.receiver_id === user.id || newMessage.sender_id === user.id) {
            const friendId = newMessage.sender_id === user.id ? newMessage.receiver_id : newMessage.sender_id;

            setPrivateMessages(prev => ({
              ...prev,
              [friendId]: [...(prev[friendId] || []), newMessage]
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(privateChannel);
    };
  }, [user]);

  // Auto-clean old messages every 5 minutes
  useEffect(() => {
    if (!user) return;

    const cleanupInterval = setInterval(async () => {
      try {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        await supabase
          .from('chat_messages')
          .delete()
          .lt('created_at', oneHourAgo);
      } catch (error) {
        console.error('Error cleaning old messages:', error);
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(cleanupInterval);
  }, [user]);

  const handleSendMessage = async (content) => {
    if (!user || !content.trim()) return;

    try {
      await supabase
        .from('chat_messages')
        .insert({
          sender_email: user.email,
          sender_id: user.id,
          content: content.trim(),
          type: 'user',
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleSendPrivateMessage = async (friendId, content) => {
    if (!user || !content.trim()) return;

    try {
      await supabase
        .from('private_messages')
        .insert({
          sender_id: user.id,
          receiver_id: friendId,
          content: content.trim(),
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error sending private message:', error);
    }
  };

  return {
    messages,
    setMessages,
    privateMessages,
    setPrivateMessages,
    handleSendMessage,
    handleSendPrivateMessage
  };
}