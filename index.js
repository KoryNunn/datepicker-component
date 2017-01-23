var fastn = require('fastn')({
    _generic: require('fastn/genericComponent'),
    text: require('fastn/textComponent'),
    datePicker: require('./datepickerComponent')
});

module.exports = function(settings){
    return fastn('datePicker', settings).attach().render();
};