/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import baseToast from 'react-hot-toast';

/**
 * Toast — thin wrapper around react-hot-toast with brand styling helpers.
 *
 * The <Toaster /> mount in App.js already applies global token styling, so
 * these helpers just standardise how toasts are summoned across the app.
 *
 * Usage:
 *   import { toast } from 'components/ui/toast';
 *   toast.success('Saved');
 *   toast.error('Failed to save');
 *   await toast.promise(savePromise, {
 *     loading: 'Saving…',
 *     success: 'Saved',
 *     error:   (err) => `Failed: ${err.message}`,
 *   });
 */

const DEFAULT_DURATION = 3500;

export const toast = {
  success(message, opts) {
    return baseToast.success(message, { duration: DEFAULT_DURATION, ...opts });
  },

  error(message, opts) {
    return baseToast.error(message, { duration: 5000, ...opts });
  },

  info(message, opts) {
    return baseToast(message, {
      duration: DEFAULT_DURATION,
      icon: 'ℹ️',
      ...opts,
    });
  },

  loading(message, opts) {
    return baseToast.loading(message, opts);
  },

  promise(promise, msgs, opts) {
    return baseToast.promise(promise, msgs, opts);
  },

  dismiss(id) {
    return baseToast.dismiss(id);
  },

  raw: baseToast,
};

export default toast;
