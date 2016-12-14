/*global define,require,module*/

(function (factory) {

  if (typeof define !== 'undefined' && define.amd) {
    define(['jquery', 'mixpanel-browser'], factory);
  } else if (typeof require !== 'undefined') {
    module.exports = factory(require('jquery'), require('mixpanel-browser'));
  } else if (typeof window !== 'undefined') {
    window.WisemblyRealTime = factory(window.$, window.mixpanel);
  } else {
    throw new Error('Unsupported environment');
  }

})(function ($, mixpanel) {

  var WisemblyMixpanel = function (options) {
    this.init(options);
  };

  WisemblyMixpanel.version = '0.2.0';

  WisemblyMixpanel.prototype = {

    defaultOptions: {
      identifier: '',
      isEnabled: true,
      identity: null,
      onBoot: null,
      onStore: null,
      onFlush: null,
      onTrack: null,
      onTrackError: null
    },

    init: function (options) {
      var self = this;

      this.options = $.extend({}, this.defaultOptions, options || {});

      // mixpanel expose a global variable in window
      // window.mixpanel = window.mixpanel || [];
      mixpanel.__SV = 1.2;

      this.boot();
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

    boot: function () {
      if (!this.isEnabled())
        return false;

      mixpanel.init(this._get('identifier'));
      this.initialized = true;

      this.track('identify', this._get('identity'), {}, true);
      this._notify('onBoot');
      return true;
    },

    isReady: function () {
      return this.initialized;
    },

    isEnabled: function () {
      return this._get('isEnabled');
    },

    track: function (type, data, metadata, priority) {
      if (!type)
        return false;
      this.store(type, data, metadata, priority);
      if (this.isReady() && this.isEnabled())
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
      if (!this.isReady() || !this.isEnabled())
        return _event.dfd.reject().promise();

      var fnCallback = function (status) {
        if (status === 1)
          _event.dfd.resolve();
        else
          _event.dfd.reject();
      };

      switch (_event.type) {
        case 'identify':
          mixpanel.identify(_event.data);
          mixpanel.register({ user_id: _event.data });
          _event.dfd.resolve();
          break;
        case 'track':
          mixpanel.track(_event.data, _event.metadata, fnCallback);
          break;
        case 'people.set':
          mixpanel.people.set(_event.data, fnCallback);
          break;
        case 'people.set_once':
          mixpanel.people.set_once(_event.data, fnCallback);
          break;
        case 'people.increment':
          var increment = _event.metadata ? _event.metadata.increment : undefined;
          mixpanel.people.increment(_event.data, increment, fnCallback);
          break;
        case 'people.append':
          mixpanel.people.append(_event.data, fnCallback);
          break;
        case 'people.track_charge':
          mixpanel.people.track_charge(_event.data, fnCallback);
          break;
        default:
          _event.dfd.reject();
      }

      return _event.dfd.promise();
    }
  };

  return WisemblyMixpanel;

});
