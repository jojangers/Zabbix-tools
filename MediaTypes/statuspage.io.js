var media = {
    params: {},
    name: '',
    labels: [],
    HTTPProxy: '',

    setParams: function (params) {
        if (typeof params !== 'object') {
            return;
        }

        media.params = params;
        Media.params.api += Media.params.api.endsWith('/') ? '' : '/';
        Media.params.web += Media.params.web.endsWith('/') ? '' : '/';
    },

    setProxy: function (HTTPProxy) {
        if (typeof HTTPProxy !== 'undefined' && HTTPProxy.trim() !== '') {
            Media.HTTPProxy = HTTPProxy;
        }
    },

    setTags: function(event_tags_json) {
        if (typeof event_tags_json !== 'undefined' && event_tags_json !== ''
                && event_tags_json !== '{EVENT.TAGSJSON}') {

            try {
                var tags = JSON.parse(event_tags_json),
                    label;

                tags.forEach(function (tag) {
                    if (typeof tag.tag === 'string') {
                        label = (tag.tag + (typeof tag.value !== 'undefined'
                                && tag.value !== '' ? (':' + tag.value) : '')).replace(/\s/g, '_');
                        Media.labels.push(label);
                    }
                });
            }
            catch (error) {
                Zabbix.log(4, '[ ' + Media.name + ' Webhook ] Failed to parse "event_tags_json" param');
            }
        }
    },
}