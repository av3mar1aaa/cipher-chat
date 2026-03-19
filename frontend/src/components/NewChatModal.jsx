import { useState, useCallback } from 'react';
import useStore from '../store/useStore';
import * as api from '../utils/api';
import UserAvatar from './UserAvatar';
import { FiX, FiSearch, FiUsers, FiUser } from 'react-icons/fi';

export default function NewChatModal({ onClose }) {
  const [mode, setMode] = useState('private'); // 'private' or 'group'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const { setActiveChat, fetchChats, user } = useStore();

  const handleSearch = useCallback(
    async (q) => {
      setSearchQuery(q);
      if (q.trim().length < 2) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      try {
        const results = await api.searchUsers(q);
        // Filter out self
        setSearchResults(results.filter((u) => u.id !== user?.id));
      } catch (e) {
        console.error('Search failed', e);
      } finally {
        setSearching(false);
      }
    },
    [user]
  );

  const toggleUserSelect = (u) => {
    if (mode === 'private') {
      setSelectedUsers([u]);
      return;
    }
    setSelectedUsers((prev) => {
      const exists = prev.find((s) => s.id === u.id);
      if (exists) return prev.filter((s) => s.id !== u.id);
      return [...prev, u];
    });
  };

  const handleCreate = async () => {
    setError('');
    if (selectedUsers.length === 0) {
      setError('Select at least one user');
      return;
    }
    if (mode === 'group' && !groupName.trim()) {
      setError('Group name required');
      return;
    }

    setCreating(true);
    try {
      const payload = {
        type: mode,
        participant_ids: selectedUsers.map((u) => u.id),
      };
      if (mode === 'group') {
        payload.name = groupName.trim();
      }
      const chat = await api.createChat(payload);
      await fetchChats();
      setActiveChat(chat);
      onClose();
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to create chat');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2>NEW TRANSMISSION</h2>
          <button className="icon-btn" onClick={onClose}>
            <FiX />
          </button>
        </div>

        <div className="modal__tabs">
          <button
            className={`modal__tab ${mode === 'private' ? 'modal__tab--active' : ''}`}
            onClick={() => {
              setMode('private');
              setSelectedUsers([]);
            }}
          >
            <FiUser size={14} /> PRIVATE
          </button>
          <button
            className={`modal__tab ${mode === 'group' ? 'modal__tab--active' : ''}`}
            onClick={() => {
              setMode('group');
              setSelectedUsers([]);
            }}
          >
            <FiUsers size={14} /> GROUP
          </button>
        </div>

        {mode === 'group' && (
          <div className="modal__group-name">
            <input
              type="text"
              placeholder="Group name..."
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
          </div>
        )}

        <div className="modal__search">
          <FiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            autoFocus
          />
        </div>

        {selectedUsers.length > 0 && (
          <div className="modal__selected">
            {selectedUsers.map((u) => (
              <div
                key={u.id}
                className="modal__selected-chip"
                onClick={() => toggleUserSelect(u)}
              >
                {u.display_name || u.username}
                <FiX size={12} />
              </div>
            ))}
          </div>
        )}

        <div className="modal__results">
          {searching ? (
            <div className="modal__loading text-dim">Scanning network...</div>
          ) : searchResults.length === 0 && searchQuery.length >= 2 ? (
            <div className="modal__loading text-dim">No users found</div>
          ) : (
            searchResults.map((u) => {
              const isSelected = selectedUsers.find((s) => s.id === u.id);
              return (
                <div
                  key={u.id}
                  className={`modal__user-item ${isSelected ? 'modal__user-item--selected' : ''}`}
                  onClick={() => toggleUserSelect(u)}
                >
                  <UserAvatar
                    name={u.display_name || u.username}
                    userId={u.id}
                    size={36}
                  />
                  <div className="modal__user-info">
                    <span className="modal__user-name">
                      {u.display_name || u.username}
                    </span>
                    <span className="modal__user-handle text-dim">
                      @{u.username}
                    </span>
                  </div>
                  {isSelected && (
                    <span className="modal__check">&#10003;</span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {error && <div className="modal__error">{error}</div>}

        <div className="modal__footer">
          <button className="btn-cancel" onClick={onClose}>
            CANCEL
          </button>
          <button
            className="btn-create"
            onClick={handleCreate}
            disabled={creating || selectedUsers.length === 0}
          >
            {creating ? 'ESTABLISHING...' : 'ESTABLISH LINK'}
          </button>
        </div>
      </div>
    </div>
  );
}
