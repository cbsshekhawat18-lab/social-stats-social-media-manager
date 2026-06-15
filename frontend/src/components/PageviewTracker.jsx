/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { init, pageview } from '../services/analytics';

/**
 * PageviewTracker — fires a pageview to the analytics service on every
 * route change. Mount once inside <BrowserRouter>. Renders nothing.
 *
 * The analytics service is a no-op until consent is granted, so this is
 * safe to mount unconditionally — visitors who have not opted in to
 * analytics cookies see no tracking happen.
 */
export default function PageviewTracker() {
  const { pathname, search } = useLocation();

  // Boot the underlying analytics script once on first mount.
  useEffect(() => { init(); }, []);

  // Re-fire on every navigation. The first one fires on initial load too.
  useEffect(() => {
    pageview(pathname + search);
  }, [pathname, search]);

  return null;
}
