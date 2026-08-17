import React, { useState, useEffect } from 'react';
import { X, UserPlus, Lock, User as UserIcon, Check, Trash2, Shield, Download, AlertCircle } from 'lucide-react';
import { createAdminUser, fetchAdminUsers, deleteAdminUser } from '../api';
import { UserListItem } from '../types';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddUserModal: React.FC<AddUserModalProps> = ({ isOpen, onClose }) => {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadUsers = () => {
    fetchAdminUsers()
      .then(setUsers)
      .catch(() => {});
  };

  useEffect(() => {
    if (isOpen) {
      loadUsers();
      setError('');
      setSuccessMsg('');
    }
  }, [isOpen]);

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

  const handleDelete = async (user: UserListItem) => {
    if (user.id === 1) return;
    const confirmMsg = `Are you sure you want to remove user @${user.username}?\n\nTheir account and data will be deleted from the database, and an HTML backup of their ${user.bookmark_count || 0} bookmarks will automatically download to your computer.`;
    if (!window.confirm(confirmMsg)) return;

    setDeletingId(user.id);
    setError('');
    setSuccessMsg('');

    try {
      const res = await deleteAdminUser(user.id);
      
      // Trigger automatic backup download of exported Netscape HTML
      if (res.exportHtml) {
        const blob = new Blob([res.exportHtml], { type: 'text/html;charset=utf-8' });
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `backup_deleted_user_${user.username}_bookmarks.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
      }

      setSuccessMsg(`User @${user.username} removed. ${res.bookmarkCount} bookmarks exported and downloaded!`);
      loadUsers();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete user');
    } finally {
      setDeletingId(null);
    }
  };

  const handleClose = () => {
    setError('');
    setSuccessMsg('');
    setUsername('');
    setPassword('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" style={{ maxWidth: '480px', padding: '28px', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
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
              <UserPlus size={18} />
            </div>
            <div>
              <h2 className="modal-title" style={{ fontSize: '18px', fontWeight: 600 }}>Manage Users</h2>
              <p style={{ fontSize: '13px', color: 'var(--color-muted)', marginTop: '2px' }}>
                Provision or remove user accounts on your instance
              </p>
            </div>
          </div>
          <button className="modal-close" onClick={handleClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

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
      </div>
    </div>
  );
};
