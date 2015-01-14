(function ($) {

  window.WisemblyMixpanel = {

    version: '0.1.4',

    options: {
      identifier: '',
      script: '//cdn.mxpnl.com/libs/mixpanel-2.2.min.js',
      scriptTimeout: 5000,
      isEnabled: true,
      identity: null,
      onBoot: null,
      onStore: null,
      onFlush: null,
      onTrack: null,
      onTrackError: null,
      onScript: null,
      onScriptError: null
    },

    setOptions: function (options) {
      options = options || {};
      this.options = $.extend(this.options, options);
    },

    init: function () {
      var self = this;

      window.mixpanel = window.mixpanel || [];
      window.mixpanel.__SV = 1.2;

      if (!this.boot()) {
        this._loadScript().done(function () { self.boot(); })
      }
    },

    _get: function (property) {
      if (typeof this.options[property] === 'function')
        return this.options[property].call(this);
      return this.options[property];
    },

    _notify: function (eventName) {
      if (typeof this.options[eventName] === 'function')
        this.options[eventName].apply(this, [].slice.call(arguments, 1));
    },

    _loadScript: function () {
      var self = this;
      return $.ajax({ url: this._get('script'), dataType: 'script', timeout: this._get('scriptTimeout') })
        .done(function () { self._notify('onScript'); })
        .fail(function () { self._notify('onScriptError'); });
    },

    boot: function () {
      if (!this.isEnabled())
        return false;
      window.mixpanel.init(this._get('identifier'));
      this.track('identify', this._get('identity'), {}, true);
      this._notify('onBoot');
      return true;
    },

    isReady: function () {
      return window.mixpanel && typeof window.mixpanel.init === 'function' && this.options;
    },

    isEnabled: function () {
      if (!this.isReady())
        return false;
      return this._get('isEnabled');
    },

    track: function (type, data, metadata, priority) {
      if (!type)
        return false;
      this.store(type, data, metadata, priority);
      if (this.isReady())
        this.flush();
      return true;
    },

    store: function (type, data, metadata, priority) {
      this._storedEvents = this._storedEvents || [];
      this._storedId = this._storedId || 0;
      // Build and store Deferred
      var _event = {
          id: ++this._storedId,
          dfd: $.Deferred(),
          type: type,
          data: data,
          metadata: metadata
        };

      if (priority !== true)
        this._storedEvents.push(_event);
      else
        this._storedEvents.unshift(_event);

      this._notify('onStore', _event);

      return _event;
    },

    flush: function () {
      var self = this;
      while (this._storedEvents && this._storedEvents.length) {
        (function (_event) {
          self._notify('onFlush', _event);
          self.mixpanelTrack(_event)
            .done(function () { self._notify('onTrack', _event); })
            .fail(function () { self._notify('onTrackError', _event); });
        })(this._storedEvents.shift());
      }
    },

    mixpanelTrack: function (_event) {
      if (!this.isEnabled())
        return _event.dfd.reject().promise();

      var fnCallback = function (status) {
        if (status === 1)
          _event.dfd.resolve();
        else
          _event.dfd.reject();
      };

      switch (_event.type) {
        case 'identify':
          window.mixpanel.identify(_event.data);
          window.mixpanel.register({ user_id: _event.data });
          _event.dfd.resolve();
          break;
        case 'track':
          window.mixpanel.track(_event.data, _event.metadata, fnCallback);
          break;
        case 'people.set':
          window.mixpanel.people.set(_event.data, fnCallback);
          break;
        case 'people.set_once':
          window.mixpanel.people.set_once(_event.data, fnCallback);
          break;
        case 'people.increment':
          window.mixpanel.people.increment(_event.data, fnCallback);
          break;
        case 'people.append':
          window.mixpanel.people.append(_event.data, fnCallback);
          break;
        case 'people.track_charge':
          window.mixpanel.people.track_charge(_event.data, fnCallback);
          break;
        default:
          _event.dfd.reject();
      }

      return _event.dfd.promise();
    }
  };

})(jQuery);