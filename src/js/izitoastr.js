$.fn.serializeObject = function() {
    var o = {};
    var a = this.serializeArray();
    $.each(a, function() {
        if (o[this.name]) {
            if (!o[this.name].push) {
                o[this.name] = [o[this.name]];
            }
            o[this.name].push(this.value || '');
        } else {
            o[this.name] = this.value || '';
        }
    });
    return o;
};

;(function (root, factory) {

    if (typeof define === 'function' && define.amd) {
        define(factory);
    } else if (typeof exports === 'object') {
        module.exports = factory();
    } else {
        root.Toastr = factory();
    }

})(this, function () {

    var Toastr = window.Toastr = {};
        Toastr.version = '0.1.0';

    var Dict = Toastr.dict = {};
    var DictTimeout = Toastr.dictTimeout = {};
    var Interval = Toastr.interval = undefined;

    var Mutex = Toastr.mutex = {extract:false, consume:false};

    var Settings = Toastr.settings = {

        theme: 'light', // dark
        resetOnHover: true,
        closeOnClick: false,
        progressBarColor: 'rgb(0, 0, 0)',
        transitionIn: 'flipInX',
        transitionOut: 'flipOutX',
        position: 'topRight',

        consume:1,
        consume_delay:1500,
        consume_max:5,
        autoconsume:true,

        colors : {
            default: "#FFFFFF",
            error  : "red",
            info   : "blue",
            warning: "orange",
            success: "green"
        },

        timeout: {
            default: 10000,
            error  : undefined,
            info   : 10000,
            warning: undefined,
            success: 10000
        },

        icons: {
            default: 'fas fa-fw fa-bell',
            error  : "fas fa-fw fa-exclamation-triangle",
            info   : "fas fa-fw fa-info-circle",
            warning: "fas fa-fw fa-exclamation-circle",
            success: "fas fa-fw fa-clipboard-check"
        }
    };

    var disable = false;
    var debug = false;
    var ready = false;
    Toastr.ready = function (options = {}, toasterId = "#toaster") {

        if("debug" in options)
            debug = options["debug"];

        iziToast.destroy();
        Toastr.configure(options);
        ready = true;

        if(debug) console.log("Toastr is ready.");
        dispatchEvent(new Event('toastr:ready'));

        Toastr.extract();
        if (Toastr.get("autoconsume"))
            Toastr.consume();

        return this;
    };

    Toastr.get = function(key) {

        if(key in Toastr.settings)
            return Toastr.settings[key];

        return null;
    };

    Toastr.set = function(key, value) {

        Toastr.settings[key] = value;
        return this;
    };

    Toastr.add = function(key, value) {

        if(! (key in Toastr.settings))
            Toastr.settings[key] = [];

        if (Toastr.settings[key].indexOf(value) === -1)
            Toastr.settings[key].push(value);

        return this;
    };

    Toastr.remove = function(key, value) {

        if(key in Toastr.settings) {

            Toastr.settings[key] = Toastr.settings[key].filter(function(setting, index, arr){
                return value != setting;
            });

            return Toastr.settings[key];
        }

        return null;
    };

    Toastr.configure = function (options) {

        var key, value;
        for (key in options) {
            value = options[key];
            if (value !== undefined && options.hasOwnProperty(key)) Settings[key] = value;
        }

        if(debug) console.log("Toastr configuration: ", Settings);
        return this;
    };

    Toastr.extract = function(toasterId = "#toaster", callback = undefined) {

        if(Toastr.mutex.extract) return;
        Toastr.mutex.extract = true;

        $(toasterId).each(function() {

            var toasterElement  = $("#" + $(this).data("toaster-proxy-id")) || this;
            var toasterChildren = toasterElement.children();

            $(toasterChildren).each(callback || function() {

                var options = $(this).data();
                var title = $(this).find(".title");
                    title = (title.length ? title[0].innerHTML.trim() : undefined);
                    if(title) title = title.trim();

                var message = $(this).find(".message");
                    message = (message.length ? message[0].innerHTML.trim() : undefined);
                    if(!title) message = message || this.innerHTML;
                    if(message) message = message.trim();

                var type = undefined;
                if($(this).hasClass("alert-warning")) type = "warning";
                if($(this).hasClass("alert-success")) type = "success";
                if($(this).hasClass("alert-danger" )) type = "error";
                if($(this).hasClass("alert-error"  )) type = "error";
                if($(this).hasClass("alert-info"   )) type = "info";
                if(type) options = Object.assign({}, options, {type: type});

                this.remove();

                Toastr.add(title, message, options);
            });
        });

        Toastr.mutex.extract = false;
    }

    Toastr.uuidv4 = function() {
        return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
          (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
    };

    Toastr.isReady = function() { return ready; }

    Toastr.add = function(title, message, options) {

        var uuid = Toastr.uuidv4();
        var time = new Date();

        Toastr.dict[uuid] = Object.assign({}, {
            title: title || ("0" + time.getHours()).slice(-2) + ":" + ("0" + time.getMinutes()).slice(-2),
            message: message || "",
            resetOnHover : Toastr.get("resetOnHover"),
            closeOnClick : Toastr.get("closeOnClick"),
            position     : Toastr.get("position"),
            theme        : Toastr.get("theme"),
            transitionIn : Toastr.get("transitionIn"),
            transitionOut: Toastr.get("transitionOut")
        }, options);

        Toastr.extract();

        if (Toastr.isReady() && Toastr.get("autoconsume") && !Toastr.mutex.extract)
            Toastr.consume();
    }

    Toastr.consume = function(consume = undefined, consume_delay = undefined, consume_max = undefined) {

        if(Toastr.mutex.consume) return;
        Toastr.mutex.consume = true;

        consume = consume || Toastr.get("consume");
        consume_delay = consume_delay || Toastr.get("consume_delay");
        consume_max = consume_max || Toastr.get("consume_max");

        if(disable && debug) console.log("Toastr is disabled");
        if(disable) return;

        if(debug) {
            var nToasts = Object.keys(Toastr.dict).length;
            if (nToasts) console.log("Toastr: " + nToasts + " toast(s) to consume");
            else console.log("Toastr: nothing to consume");
        }


        function _atomic() {

            Object.entries(Toastr.dictTimeout).forEach(([uuid,timeout]) => {

                Toastr.dictTimeout[uuid] -= consume_delay;
                if(Toastr.dictTimeout[uuid] < 0) delete Toastr.dictTimeout[uuid];
            });

            if(Toastr.dictTimeout.length >= consume_max) return;

            var keys = Object.keys(Toastr.dict);
            if (keys.length < 1) return;

            var key = Object.keys(Toastr.dict)[0];
            var toast = Toastr.dict[key];

            if(toast) {

                var type = toast.type || "default";
                if(!("icon" in toast))
                    toast["icon"]    = Toastr.get("icons")[type] || undefined;
                if(!("timeout" in toast))
                    toast["timeout"] = Toastr.get("timeout")[type] || 0;
                if(!("color" in toast))
                    toast["color"] = Toastr.get("colors")[type];

                Toastr.dictTimeout[key] = toast["timeout"];

                switch(toast.type) {
                    case "success":
                        iziToast.success(toast);
                    break;
                    case "info":
                        iziToast.info(toast);
                    break;
                    case "error":
                        iziToast.error(toast);
                    break;
                    case "warning":
                        iziToast.warning(toast);
                    break;
                    default:
                        iziToast.show(toast);
                }

                delete Toastr.dict[key];
            }

            var keys = Object.keys(Toastr.dict);
            if (keys.length < 1) {
                clearInterval(Toastr.interval);
                Toastr.interval = undefined;

                Toastr.mutex.consume = false;

                return;
            }
        }

        if (Toastr.interval === undefined) {
            Toastr.interval = setInterval(_atomic, consume_delay);
            _atomic();
        }
    }

    return Toastr;
});
