/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

import AIChatPanel from './AIChatPanel';
import { useAuth } from '../../hooks/useAuth';

/**
 * AIFloatingTrigger — bottom-right brand-gradient bubble + Cmd+J shortcut.
 *
 * Renders nothing for unauthenticated users. Owns the open/close state of
 * the AIChatPanel. Mount once at the AppShell level.
 *
 * Keyboard:
 *   Cmd+J / Ctrl+J — toggle the panel
 *   Esc            — close (handled by AIChatPanel's parent close)
 */
export default function AIFloatingTrigger() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  // Cmd+J / Ctrl+J keyboard shortcut
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!user) return null;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open Social Stats (Cmd+J)"
          title="Social Stats (⌘J)"
          style={{
            position: 'fixed',
            bottom: 'calc(20px + env(safe-area-inset-bottom))',
            right: 20,
            zIndex: 950,
            width: 52, height: 52,
            minHeight: 'unset', minWidth: 'unset',
            borderRadius: '50%',
            border: 'none',
            background: 'var(--brand-gradient)',
            boxShadow: '0 8px 24px rgba(0,168,216,0.40), 0 2px 6px rgba(0,168,216,0.30)',
            color: '#fff',
            cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            transition: 'transform var(--transition-fast)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.06)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          <Sparkles size={22} strokeWidth={2.4} />
        </button>
      )}

      <AIChatPanel
        open={open}
        onClose={() => setOpen(false)}
        clientId={user?.client_id || null}
      />
    </>
  );
}
