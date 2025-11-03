// src/components/PrivateChatPopup.jsx
import React, { useState, useRef, useEffect } from "react";

export default function PrivateChatPopup({ 
  user, 
  friends, 
  privateMessages, 
  onSendPrivateMessage 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(null); // friendId of active chat
  const [messageInputs, setMessageInputs] = useState({}); // { friendId: text }

  const messagesEndRefs = useRef({});

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (activeTab && messagesEndRefs.current[activeTab]) {
      messagesEndRefs.current[activeTab].scrollIntoView({ behavior: "smooth" });
    }
  }, [privateMessages, activeTab]);

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getUsername = (email) => {
    return email.split('@')[0];
  };

  const handleSendMessage = (friendId) => {
    const text = messageInputs[friendId] || '';
    if (text.trim()) {
      onSendPrivateMessage(friendId, text.trim());
      setMessageInputs(prev => ({ ...prev, [friendId]: '' }));
    }
  };

  const handleInputChange = (friendId, text) => {
    setMessageInputs(prev => ({ ...prev, [friendId]: text }));
  };

  const handleKeyPress = (friendId, e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(friendId);
    }
  };

  const openChat = (friendId) => {
    setActiveTab(friendId);
    if (!isOpen) setIsOpen(true);
  };

  const closeTab = (friendId, e) => {
    e.stopPropagation();
    if (activeTab === friendId) {
      // Find another tab to activate, or close popup if no tabs left
      const remainingFriends = friends.filter(f => f.friend_id !== friendId);
      if (remainingFriends.length > 0) {
        setActiveTab(remainingFriends[0].friend_id);
      } else {
        setActiveTab(null);
        setIsOpen(false);
      }
    }
  };

  const getUnreadCount = (friendId) => {
    const messages = privateMessages[friendId] || [];
    return messages.filter(msg => 
      msg.receiver_id === user.id && !msg.is_read
    ).length;
  };

  return (
    <>
      {/* Friends Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '20px',
          left: '20px',
          zIndex: 1000,
          background: 'linear-gradient(135deg, #3B82F6, #7C3AED)',
          color: 'white',
          border: 'none',
          borderRadius: '50px',
          padding: '12px 20px',
          fontWeight: 'bold',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px'
        }}
      >
        <span>👥 Friends ({friends.length})</span>
      </button>

      {/* Popup Window */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: '80px',
          left: '20px',
          width: '400px',
          height: '500px',
          background: 'linear-gradient(to bottom, #0f172a 0%, #581c87 100%)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          
          {/* Header */}
          <div style={{
            padding: '16px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(0,0,0,0.3)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ fontWeight: 'bold', fontSize: '16px' }}>Private Chats</div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                fontSize: '18px',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            
            {/* Friends List Sidebar */}
            <div style={{
              width: '150px',
              borderRight: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(0,0,0,0.2)',
              overflowY: 'auto'
            }}>
              {friends.map(friend => (
                <div
                  key={friend.friend_id}
                  onClick={() => openChat(friend.friend_id)}
                  style={{
                    padding: '12px',
                    cursor: 'pointer',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    background: activeTab === friend.friend_id ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    position: 'relative'
                  }}
                >
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: friend.is_online ? '#10B981' : '#6B7280'
                  }} />
                  <div style={{ flex: 1, fontSize: '12px' }}>
                    {getUsername(friend.friend_email)}
                  </div>
                  {getUnreadCount(friend.friend_id) > 0 && (
                    <div style={{
                      background: '#EF4444',
                      color: 'white',
                      borderRadius: '50%',
                      width: '16px',
                      height: '16px',
                      fontSize: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {getUnreadCount(friend.friend_id)}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Chat Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {activeTab ? (
                <>
                  {/* Chat Header */}
                  <div style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(0,0,0,0.2)',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>
                        {getUsername(friends.find(f => f.friend_id === activeTab)?.friend_email || 'Friend')}
                      </span>
                      <button
                        onClick={(e) => closeTab(activeTab, e)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'white',
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Messages */}
                  <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '16px',
                    background: 'linear-gradient(to bottom, rgba(15, 23, 42, 0.5), rgba(88, 28, 135, 0.3))'
                  }}>
                    {(privateMessages[activeTab] || []).map((message) => {
                      const isCurrentUser = message.sender_id === user.id;
                      
                      return (
                        <div
                          key={message.id}
                          style={{
                            display: 'flex',
                            justifyContent: isCurrentUser ? 'flex-end' : 'flex-start',
                            marginBottom: '12px'
                          }}
                        >
                          <div style={{
                            maxWidth: '80%',
                            padding: '8px 12px',
                            borderRadius: '12px',
                            background: isCurrentUser ? '#3B82F6' : '#374151',
                            borderTopRightRadius: isCurrentUser ? '4px' : '12px',
                            borderTopLeftRadius: isCurrentUser ? '12px' : '4px',
                          }}>
                            <div style={{ fontSize: '13px', lineHeight: '1.4' }}>
                              {message.content}
                            </div>
                            <div style={{
                              fontSize: '10px',
                              marginTop: '4px',
                              color: isCurrentUser ? 'rgba(219, 234, 254, 1)' : 'rgba(156, 163, 175, 1)',
                              textAlign: 'right'
                            }}>
                              {formatTime(message.created_at)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={el => messagesEndRefs.current[activeTab] = el} />
                  </div>

                  {/* Input Area */}
                  <div style={{
                    padding: '12px',
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(0,0,0,0.3)'
                  }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        value={messageInputs[activeTab] || ''}
                        onChange={(e) => handleInputChange(activeTab, e.target.value)}
                        onKeyPress={(e) => handleKeyPress(activeTab, e)}
                        placeholder="Type a private message..."
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: '20px',
                          background: 'rgba(0,0,0,0.4)',
                          color: 'white',
                          border: '1px solid rgba(255,255,255,0.2)',
                          outline: 'none',
                          fontSize: '13px'
                        }}
                      />
                      <button
                        onClick={() => handleSendMessage(activeTab)}
                        disabled={!messageInputs[activeTab]?.trim()}
                        style={{
                          padding: '8px 16px',
                          background: messageInputs[activeTab]?.trim() 
                            ? 'linear-gradient(135deg, #3B82F6, #7C3AED)'
                            : '#4B5563',
                          color: 'white',
                          border: 'none',
                          borderRadius: '20px',
                          cursor: messageInputs[activeTab]?.trim() ? 'pointer' : 'not-allowed',
                          fontSize: '13px'
                        }}
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                // No chat selected
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: '14px'
                }}>
                  Select a friend to start chatting
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}