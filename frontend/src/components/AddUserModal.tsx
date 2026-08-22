import React, { useState, useEffect } from 'react';
import { X, UserPlus, Lock, User as UserIcon, Check, Trash2, Shield, Download, AlertCircle, Key, Copy, Plus } from 'lucide-react';
import { createAdminUser, fetchAdminUsers, deleteAdminUser, fetchAPIKeys, createAPIKey, deleteAPIKey, APIKeyListItem } from '../api';
import { User, UserListItem } from '../types';
import { copyToClipboard } from '../utils/clipboard';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  initialTab?: 'users' | 'apikeys';
}

export const AddUserModal: React.FC<AddUserModalProps> = ({ isOpen, onClose, currentUser, initialTab }) => {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // API Keys state
  const [apiKeys, setApiKeys] = useState<APIKeyListItem[]>([]);
  const [keyName, setKeyName] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [newlyGeneratedKey, setNewlyGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [keyLoading, setKeyLoading] = useState(false);

  const isAdmin = currentUser?.isAdmin || currentUser?.id === 1;
  const [activeTab, setActiveTab] = useState<'users' | 'apikeys'>('users');

  const loadUsers = () => {
    if (!isAdmin) return;
    fetchAdminUsers()
      .then(setUsers)
      .catch(() => {});
  };

  const loadKeys = async () => {
    try {
      const data = await fetchAPIKeys();
      setApiKeys(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch API keys');
    }
  };

  useEffect(() => {
    if (isOpen) {
      setError('');
      setSuccessMsg('');
      setUsername('');
      setPassword('');
      setKeyName('');
      setNewlyGeneratedKey(null);
      setCopied(false);

      if (currentUser) {
        setSelectedUserId(String(currentUser.id));
      }

      if (initialTab) {
        setActiveTab(initialTab);
      } else {
        setActiveTab(isAdmin ? 'users' : 'apikeys');
      }

      loadUsers();
      loadKeys();
    }
  }, [isOpen, initialTab, isAdmin, currentUser]);

  // Load keys when tab changes
  useEffect(() => {
    if (isOpen && activeTab === 'apikeys') {
      loadKeys();
    }
  }, [activeTab, isOpen]);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await createAdminUser(username.trim(), password);
      setSuccessMsg(`User @${res.user.username} created successfully!`);
      setUsername('');
      setPassword('');
      loadUsers();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userRecord: UserListItem) => {
    if (userRecord.id === 1) return;
    const confirmMsg = `Are you sure you want to remove user @${userRecord.username}?\n\nTheir account and data will be deleted from the database, and an HTML backup of their ${userRecord.bookmark_count || 0} bookmarks will automatically download to your computer.`;
    if (!window.confirm(confirmMsg)) return;

    setDeletingId(userRecord.id);
    setError('');
    setSuccessMsg('');

    try {
      const res = await deleteAdminUser(userRecord.id);
      
      // Trigger automatic backup download of exported Netscape HTML
      if (res.exportHtml) {
        const blob = new Blob([res.exportHtml], { type: 'text/html;charset=utf-8' });
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `backup_deleted_user_${userRecord.username}_bookmarks.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
      }

      setSuccessMsg(`User @${userRecord.username} removed. ${res.bookmarkCount} bookmarks exported and downloaded!`);
      loadUsers();
      loadKeys(); // Refresh keys in case a user owned some
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete user');
    } finally {
      setDeletingId(null);
    }
  };

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setKeyLoading(true);
    setError('');
    setSuccessMsg('');
    setNewlyGeneratedKey(null);
    setCopied(false);

    try {
      const targetUserId = selectedUserId ? Number(selectedUserId) : undefined;
      const res = await createAPIKey(keyName.trim() || 'API Key', targetUserId);
      setNewlyGeneratedKey(res.apiKey);
      setSuccessMsg("API Key generated successfully! Please copy it now, as you won't be able to see it again.");
      setKeyName('');
      loadKeys();
    } catch (err: any) {
      setError(err.message || 'Failed to generate API key');
    } finally {
      setKeyLoading(false);
    }
  };

  const handleRevokeKey = async (id: number, name: string) => {
    if (!window.confirm(`Are you sure you want to revoke the API key "${name}"? Any applications using this key will lose access.`)) {
      return;
    }

    try {
      await deleteAPIKey(id);
      setSuccessMsg('API Key revoked successfully');
      setTimeout(() => setSuccessMsg(''), 3000);
      loadKeys();
    } catch (err: any) {
      setError(err.message || 'Failed to revoke API key');
    }
  };

  const handleCopyKey = async () => {
    if (!newlyGeneratedKey) return;
    const success = await copyToClipboard(newlyGeneratedKey);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setError('');
    setSuccessMsg('');
    setUsername('');
    setPassword('');
    setKeyName('');
    setNewlyGeneratedKey(null);
    onClose();
  };

  const getHeaderTitle = () => {
    if (!isAdmin) return 'API Keys';
    return activeTab === 'users' ? 'Manage Users' : 'API Keys';
  };

  const getHeaderSubtitle = () => {
    if (!isAdmin) return 'Manage tokens for Chrome Extension and iOS Shortcuts';
    return activeTab === 'users'
      ? 'Provision or remove user accounts on your instance'
      : 'Manage access keys for developer extensions and integrations';
  };

  const getHeaderIcon = () => {
    if (!isAdmin) return <Key size={18} />;
    return activeTab === 'users' ? <UserPlus size={18} /> : <Key size={18} />;
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" style={{ maxWidth: '480px', padding: '28px', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        
        {/* Modal Header */}
        <div className="modal-header" style={{ marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--color-tertiary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-primary)'
            }}>
              {getHeaderIcon()}
            </div>
            <div>
              <h2 className="modal-title" style={{ fontSize: '18px', fontWeight: 600 }}>{getHeaderTitle()}</h2>
              <p style={{ fontSize: '13px', color: 'var(--color-muted)', marginTop: '2px' }}>
                {getHeaderSubtitle()}
              </p>
            </div>
          </div>
          <button className="modal-close" onClick={handleClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Tab Selector (Admins only) */}
        {isAdmin && (
          <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: '18px', width: '100%' }}>
            <button
              type="button"
              onClick={() => {
                setActiveTab('users');
                setError('');
                setSuccessMsg('');
              }}
              style={{
                flex: 1,
                padding: '10px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'users' ? '2px solid var(--color-primary)' : 'none',
                color: activeTab === 'users' ? 'var(--color-primary)' : 'var(--color-muted)',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                textAlign: 'center'
              }}
            >
              Users
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('apikeys');
                setError('');
                setSuccessMsg('');
              }}
              style={{
                flex: 1,
                padding: '10px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'apikeys' ? '2px solid var(--color-primary)' : 'none',
                color: activeTab === 'apikeys' ? 'var(--color-primary)' : 'var(--color-muted)',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                textAlign: 'center'
              }}
            >
              API Keys
            </button>
          </div>
        )}

        {/* Error and Success Banners */}
        {error && (
          <div style={{ color: 'var(--color-error)', fontSize: '13px', marginBottom: '14px', background: 'rgba(228, 43, 12, 0.08)', padding: '10px 14px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div style={{ color: 'var(--color-primary)', fontSize: '13px', marginBottom: '14px', background: 'var(--color-tertiary)', padding: '10px 14px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Check size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* TAB 1: USERS */}
        {activeTab === 'users' && isAdmin && (
          <>
            {/* Existing Users List */}
            <div style={{ marginBottom: '22px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-muted)', marginBottom: '10px' }}>
                Existing Users ({users.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                {users.map((u) => (
                  <div
                    key={u.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      background: 'var(--color-surface)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: u.id === 1 ? 'var(--color-primary)' : 'var(--color-tertiary)',
                        color: u.id === 1 ? '#ffffff' : 'var(--color-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 600
                      }}>
                        {u.id === 1 ? <Shield size={14} /> : u.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          @{u.username}
                          {u.id === 1 && (
                            <span style={{ fontSize: '10px', background: 'var(--color-tertiary)', color: 'var(--color-primary)', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                              Admin
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
                          {u.bookmark_count || 0} bookmarks
                        </div>
                      </div>
                    </div>

                    {u.id !== 1 && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '6px 8px', color: 'var(--color-error)' }}
                        onClick={() => handleDelete(u)}
                        disabled={deletingId === u.id}
                        title="Remove user and download backup export"
                      >
                        <Trash2 size={14} />
                        <span style={{ fontSize: '12px', marginLeft: '4px' }}>
                          {deletingId === u.id ? 'Removing...' : 'Remove'}
                        </span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Add User Form */}
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '18px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-muted)', marginBottom: '12px' }}>
                Add New User
              </div>

              <form onSubmit={handleCreate}>
                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label" style={{ fontSize: '13px', fontWeight: 500, marginBottom: '6px', display: 'block' }}>Username</label>
                  <div style={{ position: 'relative' }}>
                    <UserIcon size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
                    <input
                      type="text"
                      required
                      className="form-input"
                      style={{ width: '100%', paddingLeft: '38px' }}
                      placeholder="e.g. alex"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '18px' }}>
                  <label className="form-label" style={{ fontSize: '13px', fontWeight: 500, marginBottom: '6px', display: 'block' }}>Password</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
                    <input
                      type="password"
                      required
                      className="form-input"
                      style={{ width: '100%', paddingLeft: '38px' }}
                      placeholder="Min. 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleClose}
                    disabled={loading}
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading || !username.trim() || password.length < 8}
                  >
                    {loading ? 'Creating...' : 'Create User'}
                  </button>
                </div>
              </form>
            </div>
          </>
        )}

        {/* TAB 2: API KEYS (Shown to all users, activeTab is forced for non-admins) */}
        {(activeTab === 'apikeys' || !isAdmin) && (
          <>
            {/* Existing Keys List */}
            <div style={{ marginBottom: '22px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-muted)', marginBottom: '10px' }}>
                Active API Keys ({apiKeys.length})
              </div>
              {apiKeys.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-muted)', fontSize: '13px', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px dotted var(--color-border)' }}>
                  No API keys generated yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                  {apiKeys.map((k) => (
                    <div
                      key={k.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        background: 'var(--color-surface)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: 'var(--color-tertiary)',
                          color: 'var(--color-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: 600
                        }}>
                          <Key size={14} />
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {k.name}
                            {isAdmin && (
                              <span style={{ fontSize: '10px', background: 'var(--color-tertiary)', color: 'var(--color-primary)', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                @{k.username}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
                            Created {new Date(k.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '6px 8px', color: 'var(--color-error)' }}
                        onClick={() => handleRevokeKey(k.id, k.name)}
                        title="Revoke Key"
                      >
                        <Trash2 size={14} />
                        <span style={{ fontSize: '12px', marginLeft: '4px' }}>Revoke</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Display newly generated key */}
            {newlyGeneratedKey && (
              <div style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-primary)',
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                marginBottom: '18px'
              }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-primary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Your New API Key (Copy Now)
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <code style={{
                    flex: 1,
                    padding: '8px 10px',
                    background: 'var(--color-bg-primary)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    wordBreak: 'break-all',
                    color: 'var(--color-secondary)'
                  }}>
                    {newlyGeneratedKey}
                  </code>
                  <button
                    type="button"
                    className={`btn ${copied ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={handleCopyKey}
                    style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Copy to clipboard"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            )}

            {/* Generate Key Form */}
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '18px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-muted)', marginBottom: '12px' }}>
                Generate New API Key
              </div>

              <form onSubmit={handleGenerateKey}>
                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label" style={{ fontSize: '13px', fontWeight: 500, marginBottom: '6px', display: 'block' }}>Key Label / Purpose</label>
                  <div style={{ position: 'relative' }}>
                    <Key size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
                    <input
                      type="text"
                      required
                      className="form-input"
                      style={{ width: '100%', paddingLeft: '38px' }}
                      placeholder="e.g. Chrome Extension, iPhone"
                      value={keyName}
                      onChange={(e) => setKeyName(e.target.value)}
                    />
                  </div>
                </div>

                {isAdmin && users.length > 0 && (
                  <div className="form-group" style={{ marginBottom: '18px' }}>
                    <label className="form-label" style={{ fontSize: '13px', fontWeight: 500, marginBottom: '6px', display: 'block' }}>Attach User</label>
                    <div style={{ position: 'relative' }}>
                      <UserIcon size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
                      <select
                        className="form-input"
                        style={{ width: '100%', paddingLeft: '38px', height: '40px', background: 'var(--color-bg-primary)' }}
                        value={selectedUserId}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                      >
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            @{u.username} {u.id === currentUser?.id ? '(You)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleClose}
                    disabled={keyLoading}
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={keyLoading || !keyName.trim()}
                  >
                    {keyLoading ? 'Generating...' : 'Generate Key'}
                  </button>
                </div>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
