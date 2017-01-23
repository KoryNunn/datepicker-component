var parseDate = require('date-parse'),
    dehumanizeDate = require('dehumanize-date'),
    auzzieDate = /(.*)[\/,\s-](.*)[\/,\s-](.{4})/;

module.exports = function(value){
    var date;

    if(typeof value === 'string'){
        var match = value.match(auzzieDate);
        if(match){
            date = new Date([match[3], match[2], match[1]].join('/'));
            if(!isNaN(date)){
                return date;
            }
        }
    }

    return parseDate(dehumanizeDate(value) || value);
};