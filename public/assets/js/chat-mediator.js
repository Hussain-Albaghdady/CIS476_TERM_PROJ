/**
 * chat-mediator.js
 *
 * Implements the Mediator design pattern for the DriveShare messaging system.
 *
 * The ChatMediator acts as the single communication hub between all chat UI
 * components.  Components never reference or call each other directly — they
 * only emit events to the mediator, which decides what to coordinate next.
 *
 * Components registered with the mediator:
 *   threads  – ThreadListComponent   (conversation sidebar)
 *   messages – MessageWindowComponent (message display pane)
 *   header   – ChatHeaderComponent    (active-thread title bar)
 *   input    – MessageInputComponent  (textarea + send button)
 *   newChat  – NewChatComponent       (start-new-conversation panel)
 *   polling  – PollingComponent       (background refresh interval)
 *
 * Usage — host (ownerPage.html):
 *   var mediator = createChatMediator({
 *     mode: 'host',
 *     ids: { threadList:'chat-thread-list', chatMessages:'chat-messages', ... },
 *     api: { threads:'/api/host/chat-threads', messages:'/api/host/chat-messages',
 *            send:'/api/host/chat-send', contacts:'/api/host/eligible-renters' },
 *     threadKey: 'renter_username',
 *     buildThreadQuery: function(t){ return 'renter_username='+enc(t.renter_username)+...; },
 *     buildSelectOptions: function(items, ea, eh){ return items.map(...).join(''); },
 *     panelToggle: { triggerId:'view-messaging-btn', contentId:'messaging-content' }
 *   });
 *   mediator.init();
 *
 * Usage — renter (account.html):
 *   var mediator = createChatMediator({
 *     mode: 'renter',
 *     ids: { threadList:'rc-thread-list', ... },
 *     api: { ... },
 *     threadKey: 'host_username',
 *     buildThreadQuery: function(t){ return 'host_username='+enc(t.host_username)+...; },
 *     buildSelectOptions: function(items, ea, eh){ return items.map(...).join(''); },
 *     panelCollapsible: { triggerId:'rc-messaging-collapsible' }
 *   });
 *   mediator.init();
 */

// ── Shared utilities ───────────────────────────────────────────────────────────
function _escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
function _escAttr(s) {
  return String(s == null ? '' : s).replace(/"/g, '&quot;');
}

// ── Event catalogue ────────────────────────────────────────────────────────────
var ChatEvents = Object.freeze({
  PANEL_OPENED:       'PANEL_OPENED',
  PANEL_CLOSED:       'PANEL_CLOSED',
  THREAD_SELECTED:    'THREAD_SELECTED',
  MESSAGE_SENT:       'MESSAGE_SENT',
  NEW_CHAT_REQUESTED: 'NEW_CHAT_REQUESTED',
  NEW_CHAT_CANCELLED: 'NEW_CHAT_CANCELLED',
  NEW_CHAT_OPENED:    'NEW_CHAT_OPENED',
  POLL_TICK:          'POLL_TICK',
});

// ── Base component ─────────────────────────────────────────────────────────────
function ChatComponent() {
  this.mediator = null; // set by mediator.register()
}
ChatComponent.prototype.notify = function (event, data) {
  if (this.mediator) this.mediator.notify(this, event, data);
};

// ── ThreadListComponent ────────────────────────────────────────────────────────
// Owns the sidebar list of conversation threads.
// Emits: THREAD_SELECTED
function ThreadListComponent(ids, config) {
  ChatComponent.call(this);
  this._el        = document.getElementById(ids.threadList);
  this._threadKey = config.threadKey;   // 'host_username' | 'renter_username'
  this._threadsUrl = config.api.threads;
  this._activeThread = null;
}
ThreadListComponent.prototype = Object.create(ChatComponent.prototype);
ThreadListComponent.prototype.constructor = ThreadListComponent;

ThreadListComponent.prototype.setActiveThread = function (thread) {
  this._activeThread = thread;
};

ThreadListComponent.prototype.load = function () {
  var self = this;
  fetch(self._threadsUrl, { credentials: 'include' })
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (threads) { self._render(threads); });
};

ThreadListComponent.prototype._render = function (threads) {
  var self = this;
  var list = self._el;
  var key  = self._threadKey;

  if (!threads.length) {
    list.innerHTML =
      '<div class="chat-empty-state">' +
      '<i class="bx bx-message-dots"></i>' +
      '<p>No conversations yet.</p></div>';
    return;
  }

  list.innerHTML = threads.map(function (t) {
    var isActive =
      self._activeThread &&
      self._activeThread[key] === t[key] &&
      (self._activeThread.vehicle_id || null) === (t.vehicle_id || null);

    var badge = t.unread_count > 0
      ? '<span class="chat-unread-badge">' + t.unread_count + '</span>'
      : '';
    var vehicleTag = t.vehicle_label
      ? '<span class="chat-thread-vehicle">' + _escHtml(t.vehicle_label) + '</span>'
      : '';
    var preview = _escHtml((t.last_message || '').substring(0, 60));

    return (
      '<div class="chat-thread-item' + (isActive ? ' active' : '') + '" ' +
      'data-contact="' + _escAttr(t[key]) + '" ' +
      'data-vehicle="' + _escAttr(t.vehicle_id || '') + '" ' +
      'data-vehicle-label="' + _escAttr(t.vehicle_label || '') + '">' +
      '<div class="chat-thread-top">' +
      '<span class="chat-thread-name">' + _escHtml(t[key]) + '</span>' + badge +
      '</div>' +
      vehicleTag +
      '<div class="chat-thread-preview">' + preview + '</div>' +
      '</div>'
    );
  }).join('');

  list.querySelectorAll('.chat-thread-item').forEach(function (el) {
    el.addEventListener('click', function () {
      var thread = { vehicle_id: el.dataset.vehicle || null,
                     vehicle_label: el.dataset.vehicleLabel || '' };
      thread[key] = el.dataset.contact;
      self.notify(ChatEvents.THREAD_SELECTED, thread);
    });
  });
};

// ── MessageWindowComponent ─────────────────────────────────────────────────────
// Owns the message display pane.
// Does not emit events — purely reactive.
function MessageWindowComponent(ids) {
  ChatComponent.call(this);
  this._messagesEl    = document.getElementById(ids.chatMessages);
  this._activeEl      = document.getElementById(ids.chatActive);
  this._placeholderEl = document.getElementById(ids.chatPlaceholder);
}
MessageWindowComponent.prototype = Object.create(ChatComponent.prototype);
MessageWindowComponent.prototype.constructor = MessageWindowComponent;

MessageWindowComponent.prototype.showWindow = function () {
  if (this._placeholderEl) this._placeholderEl.style.display = 'none';
  if (this._activeEl)      this._activeEl.style.display = 'flex';
};

MessageWindowComponent.prototype.load = function (url, currentUsername) {
  var self = this;
  fetch(url, { credentials: 'include' })
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (msgs) { self._render(msgs, currentUsername); });
};

MessageWindowComponent.prototype._render = function (messages, currentUsername) {
  var container = this._messagesEl;
  if (!messages.length) {
    container.innerHTML = '<div class="chat-no-msgs">No messages yet. Say hello!</div>';
    return;
  }
  container.innerHTML = messages.map(function (m) {
    var isMine = m.from_username === currentUsername;
    var time   = m.createdAt
      ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';
    return (
      '<div class="chat-msg ' + (isMine ? 'chat-msg-mine' : 'chat-msg-theirs') + '">' +
      '<div class="chat-bubble">' + _escHtml(m.body) + '</div>' +
      '<div class="chat-msg-time">' + time + '</div>' +
      '</div>'
    );
  }).join('');
  container.scrollTop = container.scrollHeight;
};

// ── ChatHeaderComponent ────────────────────────────────────────────────────────
// Owns the header bar showing who the user is chatting with.
// Does not emit events.
function ChatHeaderComponent(ids) {
  ChatComponent.call(this);
  this._nameEl    = document.getElementById(ids.chatHeaderName);
  this._vehicleEl = document.getElementById(ids.chatHeaderVehicle);
}
ChatHeaderComponent.prototype = Object.create(ChatComponent.prototype);
ChatHeaderComponent.prototype.constructor = ChatHeaderComponent;

ChatHeaderComponent.prototype.show = function (contactName, vehicleLabel) {
  if (this._nameEl)    this._nameEl.textContent    = contactName    || '';
  if (this._vehicleEl) this._vehicleEl.textContent = vehicleLabel   || '';
};

// ── MessageInputComponent ──────────────────────────────────────────────────────
// Owns the textarea + send button.
// Emits: MESSAGE_SENT
function MessageInputComponent(ids) {
  ChatComponent.call(this);
  this._inputEl   = document.getElementById(ids.chatInput);
  this._sendBtnEl = document.getElementById(ids.chatSendBtn);
  var self = this;

  self._sendBtnEl.addEventListener('click', function () {
    self._triggerSend();
  });
  self._inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      self._triggerSend();
    }
  });
}
MessageInputComponent.prototype = Object.create(ChatComponent.prototype);
MessageInputComponent.prototype.constructor = MessageInputComponent;

MessageInputComponent.prototype._triggerSend = function () {
  var body = this._inputEl.value.trim();
  if (body) this.notify(ChatEvents.MESSAGE_SENT, { body: body });
};

MessageInputComponent.prototype.clear = function () {
  this._inputEl.value = '';
};

// ── NewChatComponent ───────────────────────────────────────────────────────────
// Owns the "start new conversation" panel including the contact selector.
// Emits: NEW_CHAT_REQUESTED, NEW_CHAT_CANCELLED, NEW_CHAT_OPENED
function NewChatComponent(ids, config) {
  ChatComponent.call(this);
  this._panelEl        = document.getElementById(ids.newChatPanel);
  this._newBtnEl       = document.getElementById(ids.newChatBtn);
  this._cancelBtnEl    = document.getElementById(ids.newChatCancelBtn);
  this._openBtnEl      = document.getElementById(ids.newChatOpenBtn);
  this._selectEl       = document.getElementById(ids.newChatSelect);
  this._contactsUrl    = config.api.contacts;
  this._buildOptions   = config.buildSelectOptions;
  var self = this;

  self._newBtnEl.addEventListener('click', function () {
    self.notify(ChatEvents.NEW_CHAT_REQUESTED);
  });
  self._cancelBtnEl.addEventListener('click', function () {
    self.notify(ChatEvents.NEW_CHAT_CANCELLED);
  });
  self._openBtnEl.addEventListener('click', function () {
    if (!self._selectEl.value) return;
    var parts = self._selectEl.value.split('::');
    var opt   = self._selectEl.options[self._selectEl.selectedIndex];
    self.notify(ChatEvents.NEW_CHAT_OPENED, {
      contactUsername: parts[0],
      vehicleId:       parts[1] || null,
      vehicleLabel:    opt ? (opt.dataset.label || '') : '',
    });
  });
}
NewChatComponent.prototype = Object.create(ChatComponent.prototype);
NewChatComponent.prototype.constructor = NewChatComponent;

NewChatComponent.prototype.show = function () {
  this._panelEl.style.display = 'block';
  this._loadContacts();
};
NewChatComponent.prototype.hide = function () {
  this._panelEl.style.display = 'none';
};
NewChatComponent.prototype.toggle = function () {
  if (this._panelEl.style.display === 'block') {
    this.hide();
  } else {
    this.show();
  }
};
NewChatComponent.prototype._loadContacts = function () {
  var self = this;
  self._selectEl.innerHTML = '<option value="">Loading…</option>';
  fetch(self._contactsUrl, { credentials: 'include' })
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (items) {
      if (!items.length) {
        self._selectEl.innerHTML = '<option value="">No contacts available</option>';
        return;
      }
      self._selectEl.innerHTML =
        '<option value="">-- Select --</option>' +
        self._buildOptions(items, _escAttr, _escHtml);
    });
};

// ── PollingComponent ───────────────────────────────────────────────────────────
// Runs a setInterval and emits POLL_TICK so the mediator decides what to refresh.
// Emits: POLL_TICK
function PollingComponent(intervalMs) {
  ChatComponent.call(this);
  this._intervalMs = intervalMs || 5000;
  this._timer      = null;
}
PollingComponent.prototype = Object.create(ChatComponent.prototype);
PollingComponent.prototype.constructor = PollingComponent;

PollingComponent.prototype.start = function () {
  var self = this;
  self.stop();
  self._timer = setInterval(function () {
    self.notify(ChatEvents.POLL_TICK);
  }, self._intervalMs);
};
PollingComponent.prototype.stop = function () {
  if (this._timer) { clearInterval(this._timer); this._timer = null; }
};

// ── ChatMediator ───────────────────────────────────────────────────────────────
// Central coordinator.  Holds all state and routes every event.
function ChatMediator(config) {
  this.config          = config;
  this.currentUsername = null;
  this.activeThread    = null;
  this._components     = {};
}

ChatMediator.prototype._register = function (name, component) {
  component.mediator = this;
  this._components[name] = component;
};

/**
 * Build and wire all components, then attach the panel-open trigger.
 * Must be called once after the DOM is ready.
 */
ChatMediator.prototype.init = function () {
  var self = this;
  var cfg  = self.config;

  // Resolve the current user's username once
  fetch('/userdetail', { credentials: 'include' })
    .then(function (r) { return r.ok ? r.json() : {}; })
    .then(function (d) {
      self.currentUsername = d.user_name || d.username || null;
    });

  // Instantiate and register components
  self._register('threads',  new ThreadListComponent(cfg.ids, cfg));
  self._register('messages', new MessageWindowComponent(cfg.ids));
  self._register('header',   new ChatHeaderComponent(cfg.ids));
  self._register('input',    new MessageInputComponent(cfg.ids));
  self._register('newChat',  new NewChatComponent(cfg.ids, cfg));
  self._register('polling',  new PollingComponent(5000));

  // ── Panel trigger wiring ────────────────────────────────────────────────────
  // Two modes:
  //   panelToggle      – ownerPage.html: a button that toggles #messaging-content
  //   panelCollapsible – account.html:   a collapsible button (content managed by
  //                      the existing collapsible system; we lazy-init on first open)

  if (cfg.panelToggle) {
    var toggleBtn     = document.getElementById(cfg.panelToggle.triggerId);
    var toggleContent = document.getElementById(cfg.panelToggle.contentId);
    var panelOpen     = false;

    // Auto-open when navigated via #messaging hash
    if (window.location.hash === '#' + cfg.panelToggle.hashId) {
      panelOpen = true;
      if (toggleContent) toggleContent.style.display = 'block';
      self.notify(null, ChatEvents.PANEL_OPENED);
    }

    if (toggleBtn) {
      toggleBtn.addEventListener('click', function () {
        panelOpen = !panelOpen;
        if (toggleContent) toggleContent.style.display = panelOpen ? 'block' : 'none';
        self.notify(null, panelOpen ? ChatEvents.PANEL_OPENED : ChatEvents.PANEL_CLOSED);
      });
    }
  }

  if (cfg.panelCollapsible) {
    var collBtn     = document.getElementById(cfg.panelCollapsible.triggerId);
    var chatInitted = false;
    if (collBtn) {
      collBtn.addEventListener('click', function () {
        // The collapsible library toggles maxHeight; we fire PANEL_OPENED once
        // on the first expand.  We detect expansion by checking maxHeight on the
        // next sibling (.content div) after the click handler runs.
        setTimeout(function () {
          var content = collBtn.nextElementSibling;
          var isExpanded = content && !!content.style.maxHeight;
          if (isExpanded && !chatInitted) {
            chatInitted = true;
            self.notify(null, ChatEvents.PANEL_OPENED);
          }
          if (!isExpanded) {
            self.notify(null, ChatEvents.PANEL_CLOSED);
          }
        }, 0);
      });
    }
  }
};

/**
 * Central dispatch.  All components call this via this.notify(event, data).
 * @param {ChatComponent|null} sender  – the component that raised the event
 * @param {string}             event   – one of ChatEvents
 * @param {*}                  [data]  – event payload
 */
ChatMediator.prototype.notify = function (sender, event, data) {
  var self = this;
  var c    = self._components;

  switch (event) {

    // ── Panel visibility ──────────────────────────────────────────────────────
    case ChatEvents.PANEL_OPENED:
      c.threads.load();
      break;

    case ChatEvents.PANEL_CLOSED:
      c.polling.stop();
      break;

    // ── Thread selection ──────────────────────────────────────────────────────
    case ChatEvents.THREAD_SELECTED:
      self.activeThread = data;
      c.threads.setActiveThread(data);
      c.header.show(data[self.config.threadKey], data.vehicle_label || '');
      c.messages.showWindow();
      self._loadMessages();
      c.polling.start();
      c.threads.load(); // refresh sidebar badges and active highlight
      break;

    // ── Sending a message ─────────────────────────────────────────────────────
    case ChatEvents.MESSAGE_SENT:
      if (!self.activeThread || !data || !data.body) return;
      var payload = {
        to_username: self.activeThread[self.config.threadKey],
        body:        data.body,
      };
      if (self.activeThread.vehicle_id) payload.vehicle_id = self.activeThread.vehicle_id;

      fetch(self.config.api.send, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify(payload),
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.success) {
            c.input.clear();
            self._loadMessages();
            c.threads.load();
          }
        });
      break;

    // ── New-chat panel ────────────────────────────────────────────────────────
    case ChatEvents.NEW_CHAT_REQUESTED:
      c.newChat.toggle();
      break;

    case ChatEvents.NEW_CHAT_CANCELLED:
      c.newChat.hide();
      break;

    case ChatEvents.NEW_CHAT_OPENED:
      c.newChat.hide();
      var thread = { vehicle_id: data.vehicleId || null,
                     vehicle_label: data.vehicleLabel || '' };
      thread[self.config.threadKey] = data.contactUsername;
      // Delegate to the normal THREAD_SELECTED flow
      self.notify(null, ChatEvents.THREAD_SELECTED, thread);
      break;

    // ── Polling tick ──────────────────────────────────────────────────────────
    case ChatEvents.POLL_TICK:
      self._loadMessages();
      c.threads.load();
      break;
  }
};

/** Build the messages-API URL for the active thread and ask the window to load. */
ChatMediator.prototype._loadMessages = function () {
  if (!this.activeThread) return;
  var url = this.config.api.messages + '?' +
            this.config.buildThreadQuery(this.activeThread);
  this._components.messages.load(url, this.currentUsername);
};

// ── Public factory ─────────────────────────────────────────────────────────────
/**
 * createChatMediator(config) → ChatMediator
 *
 * Convenience wrapper — validates the config and returns an initialised
 * ChatMediator instance.  Call .init() on the returned object.
 */
function createChatMediator(config) {
  if (!config || !config.ids || !config.api || !config.threadKey) {
    throw new Error('createChatMediator: missing required config fields');
  }
  return new ChatMediator(config);
}
