// ── SERVICE WORKER ──────────────────────────────────────
// Bump version when you update any app files
const CACHE = 'tasks-v2';

const FILES = [
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  'https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@700;800&display=swap',
  'https://fonts.gstatic.com/s/dmmono/v14/aFTR7PB1QTsUX8KYvrGyIYetlXw.woff2',
  'https://fonts.gstatic.com/s/syne/v22/8vIS7w4qzmVxsWxjBZRjr0FKM_04uQ.woff2'
];

// ── INSTALL ─────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(FILES.map(url => cache.add(url).catch(() => console.warn('SW: could not cache', url))))
    ).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── FETCH ────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200) return response;
        const clone = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        if (event.request.destination === 'document') return caches.match('/index.html');
      });
    })
  );
});

// ── NOTIFICATION SCHEDULING ──────────────────────────────
// Stores active timers so we can clear them when rescheduling
const scheduledTimers = new Map();

// Priority emoji
function priorityIcon(p) {
  return p === 'high' ? '🔴' : p === 'medium' ? '🟡' : '🟢';
}

// Clear all existing scheduled timers
function clearAllTimers() {
  scheduledTimers.forEach(ids => ids.forEach(id => clearTimeout(id)));
  scheduledTimers.clear();
}

// Schedule notifications for a task:
// - 8am the day before due date
// - 8am on the due date
function scheduleForTask(task) {
  const timers = [];
  const now = Date.now();
  const due = new Date(task.dueDate + 'T08:00:00');
  const dayBefore = new Date(task.dueDate + 'T08:00:00');
  dayBefore.setDate(dayBefore.getDate() - 1);

  // Day before reminder
  const msBefore = dayBefore.getTime() - now;
  if (msBefore > 0) {
    const id = setTimeout(() => {
      self.registration.showNotification('Task Manager', {
        body: priorityIcon(task.priority) + ' Due tomorrow: ' + task.text,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'reminder-before-' + task.id,
        data: { url: self.registration.scope }
      });
    }, msBefore);
    timers.push(id);
  }

  // Due date reminder
  const msDue = due.getTime() - now;
  if (msDue > 0) {
    const id = setTimeout(() => {
      self.registration.showNotification('Task Manager', {
        body: priorityIcon(task.priority) + ' Due today: ' + task.text,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'reminder-due-' + task.id,
        data: { url: self.registration.scope }
      });
    }, msDue);
    timers.push(id);
  }

  if (timers.length) scheduledTimers.set(task.id, timers);
}

// Listen for messages from the app
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SCHEDULE_REMINDERS') {
    clearAllTimers();
    const reminders = event.data.reminders || [];
    reminders.forEach(scheduleForTask);
    console.log('SW: scheduled reminders for', reminders.length, 'tasks');
  }
});

// Tap notification → open the app
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
