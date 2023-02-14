var Media = {
    params: {},
    name: '',
    labels: [],
    HTTPProxy: '',
    components: [],

    // function to insert parameters into array at "Media.params"
    setParams: function (params) {
        // exit if input is not object.
        if (typeof params !== 'object') {
            return;
        }
        Media.params = params;
        Media.params.api += Media.params.api.endsWith('/') ? '' : '/';
    },
    setProxy: function (HTTPProxy) {
        if (typeof HTTPProxy !== 'undefined' && HTTPProxy.trim() !== '') {
            Media.HTTPProxy = HTTPProxy;
        }
    },
    setTags: function(event_tags_json) {
        // validate
        if (typeof event_tags_json !== 'undefined' && event_tags_json !== '' && event_tags_json !== '{EVENT.TAGSJSON}') {
            try {
                var tags = JSON.parse(event_tags_json),
                    label;
                tags.forEach(function (tag) {
                    if (typeof tag.tag === 'string') {
                        label = (tag.tag + (typeof tag.value !== 'undefined' && tag.value !== '' ? (':' + tag.value) : '')).replace(/\s/g, '_');
                        if (tag.tag === 'statuspage_component' && tag.value) {
                            Media.components.push(tag.value)
                        }
                        Media.labels.push(label);
                    }
                });
            }
            catch (error) {
                Zabbix.log(4, '[ ' + Media.name + ' Webhook ] Failed to parse "event_tags_json" param');
            }
        }
    },
    request: function (method, query, data, allow_404) {
        // if allow_404 is not defined, set it to false
        if (typeof(allow_404) === 'undefined') {
            allow_404 = false;
        }
        // if api or token parameters are not defined, throw an error.
        ['api', 'token', 'component'].forEach(function (field) {
            if (typeof Media.params !== 'object' || typeof Media.params[field] === 'undefined'
                    || Media.params[field] === '') {
                throw 'Required ' + Media.name + ' param is not set: "' + field + '".';
            }
        });
        // initialize vars.
        var response,
            url = Media.params.api + query,
            request = new HttpRequest();
        request.addHeader('Content-Type: application/json');
        request.addHeader('Authorization: ' + Media.params.token);
        request.setProxy(Media.HTTPProxy);
        if (typeof data !== 'undefined') {
            data = JSON.stringify(data);
        }

        Zabbix.log(4, '[ ' + Media.name + ' Webhook ] Sending request: ' +
            url + ((typeof data === 'string') ? ('\n' + data) : ''));
        
        switch (method) {
            case 'get':
                response = request.get(url, data);
                break;

            case 'post':
                response = request.post(url, data);
                break;

            case 'put':
                response = request.put(url, data);
                break;

            default:
                throw 'Unsupported HTTP request method: ' + method;
        }

        Zabbix.log(4, '[ ' + Media.name + ' Webhook ] Received response with status code ' +
            request.getStatus() + '\n' + response);
        
        if (response !== null) {
            try {
                response = JSON.parse(response);
            }
            catch (error) {
                Zabbix.log(4, '[ ' + Media.name + ' Webhook ] Failed to parse response.');
                response = null;
            }
        }
        if ((request.getStatus() < 200 || request.getStatus() >= 300)
                && (!allow_404 || request.getStatus() !== 404)) {
            var message = 'Request failed with status code ' + request.getStatus();
            if (response !== null) {
                if (typeof response.errors === 'object' && Object.keys(response.errors).length > 0) {
                    message += ': ' + JSON.stringify(response.errors);
                }
                else if (typeof response.errorMessages === 'object' && Object.keys(response.errorMessages).length > 0) {
                    message += ': ' + JSON.stringify(response.errorMessages);
                }
                else if (typeof response.message === 'string') {
                    message += ': ' + response.message;
                }
            }

            throw message + ' Check debug log for more information.';
        }

        return {
            status: request.getStatus(),
            response: response
        };
    },

};

try {
    // create all used variables.
    var result = {tags: {}},
        params = JSON.parse(value),
        media = {},
        fields = {},
        incident = {},
        resp = {},
        responders = [],
        tags = [],
        required_params = [
            // alert message subject + message
            'alert_subject',
            'alert_message',
            // metadata about event origin and type
            'event_id',
            'event_source',
            'event_value',
            'event_update_status',
            // page id
            // defined in media type itself.
            'statuspage_api',
            // component id
            // defined in "sendto"
            'statuspage_component',
            // api O-authoken
            'statuspage_token'
        ],
        severities = [
            'not_classified',
            'information',
            'warning',
            'average',
            'high',
            'disaster',
            'resolved',
            'default'
        ],
        priority;

    Object.keys(params)
        .forEach(function (key) {
            // if the key exists in "required_params" and the value is empty, throw an error
            if (required_params.indexOf(key) !== -1 && params[key].trim() === '') {
                throw 'Parameter "' + key + '" cannot be empty.';
            }
            // if the key starts with "statuspage_"
            // first remove the "statuspage_" from key name
            // then set media[key] to the key value
            if (key.startsWith('statuspage_')) {
                media[key.substring(11)] = params[key];
            }
        });

    ////////////////
    // VALIDATION //
    ////////////////

    // Possible values of event_source:
    // 0 - Trigger, 1 - Discovery, 2 - Autoregistration, 3 - Internal.
    if ([0, 4].indexOf(parseInt(params.event_source)) === -1) {
        throw 'Incorrect "event_source" parameter given: "' + params.event_source + '".\nMust be 0 or 4.';
    }
    // Check event_value for trigger-based and internal events.
    // Possible values: 1 for problem, 0 for recovering
    if (params.event_value !== '0' && params.event_value !== '1') {
        throw 'Incorrect "event_value" parameter given: ' + params.event_value + '\nMust be 0 or 1.';
    }
    // Check event_update_status only for trigger-based events.
    // Possible values: 0 - Webhook was called because of problem/recovery event, 1 - Update operation.
    if (params.event_source === '0' && params.event_update_status !== '0' && params.event_update_status !== '1') {
        throw 'Incorrect "event_update_status" parameter given: ' + params.event_update_status + '\nMust be 0 or 1.';
    }
    // Check event_id for a numeric value.
    if (isNaN(parseInt(params.event_id)) || params.event_id < 1) {
        throw 'Incorrect "event_id" parameter given: ' + params.event_id + '\nMust be a positive number.';
    }

    //////////////
    // SET VARS //
    //////////////

    // if event severity is not in 0-5, set severity to 7 (default)
    if ([0, 1, 2, 3, 4, 5].indexOf(parseInt(params.event_nseverity)) === -1) {
        params.event_nseverity = '7';
    }
    // if event value is 0, set severity to 6 (resolved/recovering)
    if (params.event_value === '0') {
        params.event_nseverity = '6';
    }
    // Ensure zbxurl ends with "/"
    params.zbxurl = params.zbxurl + (params.zbxurl.endsWith('/') ? '' : '/');

    Media.name = 'Statuspage.io';
    // set parameters from media variable into Media.[]
    Media.setParams(media);
    Media.setProxy(params.HTTPProxy);
    Media.setTags(params.event_tags_json); // Set Media.labels



    //////////////////
    // SEND REQUEST //
    //////////////////


    Zabbix.log(2, 'components: ' + Media.components)
    Zabbix.log(2, 'params: ' + JSON.stringify(params))
    Zabbix.log(2, 'Media: ' + JSON.stringify(Media))
    // Numeric value of the event that triggered an action (1 for problem, 0 for recovering).
    if (params.event_value == 1) {
            
        incident.name = params.alert_subject;
        incident.body = params.alert_message;
        incident.status = '';
        incident.impact_override = '';
        incident.component_ids = Media.components;
//        incident.metadata.labels = Media.labels

//        incident.description = params.alert_message;
//        incident.priority = priority;
//        incident.source = 'Zabbix';
//        incident.tags = Media.labels;
        fields.incident = incident;

        // SEND THE ACTUAL REQUEST
//        resp = Media.request('post', 'incidents', fields);
        throw 'end of test'
        if (typeof resp.response !== 'object' || typeof resp.response.result === 'undefined') {
            throw 'Cannot create ' + Media.name + ' issue. Check debug log for more information.';
        }

        if (resp.status === 201) {
            if ((params.event_source == 0 && params.event_value == 1 && params.event_update_status == 0)
            || (params.event_source == 4 && params.event_value == 1)) {
                result.tags.statuspage_issue_id = resp.response.id;
                result.tags.statuspage_link = resp.response.shortlink;
                result.tags.statuspage_status = resp.response.status;
            }
        }
        else {
            throw Media.name + ' response code is unexpected. Check debug log for more information.';
        }
    }
    // Update a created issue.
    else {

        // SEND THE ACTUAL REQUEST
//        resp = Media.request('put', 'incidents' + params.issue_id, fields);
        throw 'end of test'

        if (typeof resp.response !== 'object' || typeof resp.response.result === 'undefined') {
            throw 'Cannot update ' + Media.name + ' issue. Check debug log for more information.';
        }

        if (resp.status === 200) {

        }
        else {
            throw Media.name + ' response code is unexpected. Check debug log for more information.';
        }
    }

    return JSON.stringify(result);
}
catch (error) {
    Zabbix.log(3, '[ ' + Media.name + ' Webhook ] ERROR: ' + error);
    throw 'Sending failed: ' + error;
}
// overview:
// data required:
// - page name 
// - incident name
// - incident component
// how to get from zabbix:
// incident name: summary?
// page name: sendto??
//  
