// src/components/PrivateChatPopup.jsx
import React, { useState, useRef, useEffect, useCallback } from "react";

export default function PrivateChatPopup({ 
  user, 
  friends, 
  privateMessages, 
  onSendPrivateMessage,
  onMarkMessagesAsRead
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(null);
  const [messageInputs, setMessageInputs] = useState({});
  const [markingAsRead, setMarkingAsRead] = useState(new Set());
  const [isUserScrolling, setIsUserScrolling] = useState(false);

  const messagesEndRefs = useRef({});
  const messagesContainerRefs = useRef({});
  const scrollTimeoutRef = useRef(null);
  const lastMessageCountRef = useRef({});

  // Remove duplicate friends based on friend_id
  const uniqueFriends = React.useMemo(() => {
    const seen = new Set();
    return friends.filter(friend => {
      if (seen.has(friend.friend_id)) {
        return false;
      }
      seen.add(friend.friend_id);
      return true;
    });
  }, [friends]);

  // Function to get unread messages for a friend
  const getUnreadMessages = useCallback((friendId) => {
    const messages = privateMessages[friendId] || [];
    return messages.filter(msg => 
      msg.receiver_id === user.id && !msg.is_read
    );
  }, [user.id, privateMessages]);

  // Mark messages as read for a specific friend
  const markAsRead = useCallback(async (friendId) => {
    const unreadMessages = getUnreadMessages(friendId);
    
    if (unreadMessages.length > 0 && !markingAsRead.has(friendId)) {
      console.log(`📨 Marking ${unreadMessages.length} messages as read for friend ${friendId}`);
      
      // Set marking state to prevent duplicate calls
      setMarkingAsRead(prev => new Set([...prev, friendId]));
      
      try {
        await onMarkMessagesAsRead(friendId);
        console.log(`✅ Successfully marked messages as read for ${friendId}`);
      } catch (error) {
        console.error(`❌ Failed to mark messages as read:`, error);
      } finally {
        // Remove from marking state after a delay to allow UI to update
        setTimeout(() => {
          setMarkingAsRead(prev => {
            const newSet = new Set(prev);
            newSet.delete(friendId);
            return newSet;
          });
        }, 1000);
      }
    }
  }, [getUnreadMessages, onMarkMessagesAsRead, markingAsRead]);

  // Handle scroll events to detect manual scrolling
  const handleScroll = useCallback((friendId) => {
    if (!isUserScrolling) {
      setIsUserScrolling(true);
    }

    // Clear any existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Set a timeout to reset the scrolling flag when user stops scrolling
    scrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
    }, 1000);
  }, [isUserScrolling]);

  // Smart auto-scroll function
  const smartScrollToBottom = useCallback((friendId) => {
    if (!activeTab || activeTab !== friendId) return;
    
    const container = messagesContainerRefs.current[friendId];
    const messagesEnd = messagesEndRefs.current[friendId];
    
    if (!container || !messagesEnd) return;

    // If user is manually scrolling, don't auto-scroll
    if (isUserScrolling) {
      return;
    }

    // Check if user is already near the bottom
    const scrollThreshold = 100; // pixels from bottom
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight <= scrollThreshold;

    // Only auto-scroll if:
    // 1. User is near the bottom, OR
    // 2. New messages were added (not just loading existing ones)
    const currentMessageCount = privateMessages[friendId]?.length || 0;
    const lastMessageCount = lastMessageCountRef.current[friendId] || 0;
    const hasNewMessages = currentMessageCount > lastMessageCount;

    if (isNearBottom || hasNewMessages) {
      setTimeout(() => {
        messagesEnd.scrollIntoView({ 
          behavior: "smooth",
          block: "nearest"
        });
      }, 100);
    }

    // Update message count reference
    lastMessageCountRef.current[friendId] = currentMessageCount;
  }, [activeTab, isUserScrolling, privateMessages]);

  // Mark messages as read when tab becomes active
  useEffect(() => {
    if (activeTab && isOpen) {
      markAsRead(activeTab);
    }
  }, [activeTab, isOpen, markAsRead]);

  // Mark messages as read when popup opens or active tab changes
  useEffect(() => {
    if (isOpen && activeTab) {
      const timer = setTimeout(() => {
        markAsRead(activeTab);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, activeTab, markAsRead]);

  // Smart auto-scroll when messages change
  useEffect(() => {
    if (activeTab) {
      smartScrollToBottom(activeTab);
    }
  }, [privateMessages, activeTab, smartScrollToBottom]);

  // Reset scrolling state when changing tabs
  useEffect(() => {
    if (activeTab) {
      setIsUserScrolling(false);
      // Reset message count when changing tabs
      lastMessageCountRef.current[activeTab] = privateMessages[activeTab]?.length || 0;
    }
  }, [activeTab, privateMessages]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Mark messages as read when user focuses on input area
  const handleInputFocus = useCallback((friendId) => {
    if (friendId === activeTab && isOpen) {
      markAsRead(friendId);
    }
  }, [activeTab, isOpen, markAsRead]);

  // Mark messages as read when user clicks anywhere in the chat area
  const handleChatAreaClick = useCallback((friendId) => {
    if (friendId === activeTab && isOpen) {
      markAsRead(friendId);
    }
  }, [activeTab, isOpen, markAsRead]);

  // Scroll to bottom manually (for scroll button)
  const handleScrollToBottom = useCallback((friendId) => {
    const messagesEnd = messagesEndRefs.current[friendId];
    if (messagesEnd) {
      setIsUserScrolling(false);
      messagesEnd.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

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
      // Reset scrolling state when sending a message
      setIsUserScrolling(false);
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
    // Reset scrolling state when opening a chat
    setIsUserScrolling(false);
  };

  const closeTab = (friendId, e) => {
    e.stopPropagation();
    if (activeTab === friendId) {
      const remainingFriends = uniqueFriends.filter(f => f.friend_id !== friendId);
      if (remainingFriends.length > 0) {
        setActiveTab(remainingFriends[0].friend_id);
      } else {
        setActiveTab(null);
        setIsOpen(false);
      }
    }
  };

  const getUnreadCount = (friendId) => {
    return getUnreadMessages(friendId).length;
  };

  // Calculate total unread count for the button
  const totalUnreadCount = React.useMemo(() => {
    return uniqueFriends.reduce((total, friend) => total + getUnreadCount(friend.friend_id), 0);
  }, [uniqueFriends, getUnreadMessages]);

  // Check if scroll to bottom button should be shown
  const shouldShowScrollButton = (friendId) => {
    const container = messagesContainerRefs.current[friendId];
    if (!container) return false;
    
    const scrollThreshold = 200; // pixels from bottom
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight <= scrollThreshold;
    
    return !isNearBottom;
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
        <span>👥 Friends ({uniqueFriends.length})</span>
        {totalUnreadCount > 0 && (
          <div style={{
            background: '#EF4444',
            color: 'white',
            borderRadius: '50%',
            width: '20px',
            height: '20px',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: '4px'
          }}>
            {totalUnreadCount}
          </div>
        )}
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
              {uniqueFriends.map(friend => (
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
                  {markingAsRead.has(friend.friend_id) && (
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#3B82F6',
                      animation: 'pulse 1s infinite'
                    }} />
                  )}
                </div>
              ))}
            </div>

            {/* Chat Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
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
                        {getUsername(uniqueFriends.find(f => f.friend_id === activeTab)?.friend_email || 'Friend')}
                        {markingAsRead.has(activeTab) && (
                          <span style={{ marginLeft: '8px', fontSize: '12px', color: '#3B82F6' }}>
                            (Marking as read...)
                          </span>
                        )}
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

                  {/* Messages Container */}
                  <div 
                    ref={el => messagesContainerRefs.current[activeTab] = el}
                    style={{
                      flex: 1,
                      overflowY: 'auto',
                      padding: '16px',
                      background: 'linear-gradient(to bottom, rgba(15, 23, 42, 0.5), rgba(88, 28, 135, 0.3))',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleChatAreaClick(activeTab)}
                    onScroll={() => handleScroll(activeTab)}
                  >
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
                              textAlign: 'right',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              gap: '4px'
                            }}>
                              {formatTime(message.created_at)}
                              {isCurrentUser && (
                                <span style={{ 
                                  fontSize: '8px',
                                  opacity: message.is_read ? 1 : 0.5 
                                }}>
                                  {message.is_read ? '✓✓' : '✓'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={el => messagesEndRefs.current[activeTab] = el} />
                  </div>

                  {/* Scroll to Bottom Button */}
                  {shouldShowScrollButton(activeTab) && (
                    <button
                      onClick={() => handleScrollToBottom(activeTab)}
                      style={{
                        position: 'absolute',
                        bottom: '70px',
                        right: '20px',
                        background: 'rgba(59, 130, 246, 0.9)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '50%',
                        width: '40px',
                        height: '40px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                        zIndex: 100
                      }}
                      title="Scroll to bottom"
                    >
                      ↓
                    </button>
                  )}

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
                        onFocus={() => handleInputFocus(activeTab)}
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

      {/* Add pulse animation */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>
    </>
  );
}